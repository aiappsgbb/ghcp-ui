import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AppConfig } from "../config.js";

export interface WorkspaceFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  isDirectory: boolean;
}

export class WorkspaceService {
  private containerClient: ContainerClient | null = null;
  private localBaseDir: string;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.localBaseDir = path.join(os.tmpdir(), "ghcp-workspaces");
    fs.mkdirSync(this.localBaseDir, { recursive: true });
  }

  async initialize(): Promise<void> {
    const connString = this.config.azure.storageConnectionString;
    const accountName = this.config.azure.storageAccountName;
    const containerName = this.config.azure.storageContainerName || "workspaces";

    if (connString) {
      const blobService = BlobServiceClient.fromConnectionString(connString);
      this.containerClient = blobService.getContainerClient(containerName);
    } else if (accountName) {
      const credential = new DefaultAzureCredential();
      const blobService = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential
      );
      this.containerClient = blobService.getContainerClient(containerName);
    }

    if (this.containerClient) {
      await this.containerClient.createIfNotExists();
      console.log("[WorkspaceService] Connected to Azure Blob Storage");
    } else {
      console.log("[WorkspaceService] Running in local-only mode (no Azure Storage configured)");
    }
  }

  getWorkspacePath(userId: string): string {
    const wsDir = path.join(this.localBaseDir, userId);
    fs.mkdirSync(wsDir, { recursive: true });
    return wsDir;
  }

  async listFiles(userId: string, dirPath: string = ""): Promise<WorkspaceFile[]> {
    const wsDir = this.getWorkspacePath(userId);
    const targetDir = path.join(wsDir, dirPath);

    if (!fs.existsSync(targetDir)) return [];

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    return entries.map((entry) => {
      const fullPath = path.join(targetDir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        path: path.join(dirPath, entry.name).replace(/\\/g, "/"),
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
        isDirectory: entry.isDirectory(),
      };
    });
  }

  async uploadFile(
    userId: string,
    filePath: string,
    content: Buffer
  ): Promise<WorkspaceFile> {
    const wsDir = this.getWorkspacePath(userId);
    const fullPath = path.join(wsDir, filePath);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content);

    // Sync to blob storage if available
    if (this.containerClient) {
      const blobName = `${userId}/${filePath}`.replace(/\\/g, "/");
      const blockBlob = this.containerClient.getBlockBlobClient(blobName);
      await blockBlob.uploadData(content);
    }

    const stat = fs.statSync(fullPath);
    return {
      name: path.basename(filePath),
      path: filePath.replace(/\\/g, "/"),
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
      isDirectory: false,
    };
  }

  async downloadFile(userId: string, filePath: string): Promise<Buffer> {
    const wsDir = this.getWorkspacePath(userId);
    const fullPath = path.join(wsDir, filePath);

    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath);
    }

    // Try blob storage
    if (this.containerClient) {
      const blobName = `${userId}/${filePath}`.replace(/\\/g, "/");
      const blockBlob = this.containerClient.getBlockBlobClient(blobName);
      const downloadResponse = await blockBlob.download(0);
      const chunks: Buffer[] = [];
      if (downloadResponse.readableStreamBody) {
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.from(chunk));
        }
      }
      const content = Buffer.concat(chunks);
      // Cache locally
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
      return content;
    }

    throw new Error(`File not found: ${filePath}`);
  }

  async deleteFile(userId: string, filePath: string): Promise<void> {
    const wsDir = this.getWorkspacePath(userId);
    const fullPath = path.join(wsDir, filePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    if (this.containerClient) {
      const blobName = `${userId}/${filePath}`.replace(/\\/g, "/");
      const blockBlob = this.containerClient.getBlockBlobClient(blobName);
      await blockBlob.deleteIfExists();
    }
  }

  async syncFromBlob(userId: string): Promise<void> {
    if (!this.containerClient) return;

    const prefix = `${userId}/`;
    const wsDir = this.getWorkspacePath(userId);

    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
      const localPath = path.join(wsDir, blob.name.slice(prefix.length));
      if (!fs.existsSync(localPath)) {
        const blockBlob = this.containerClient.getBlockBlobClient(blob.name);
        const downloadResponse = await blockBlob.download(0);
        const chunks: Buffer[] = [];
        if (downloadResponse.readableStreamBody) {
          for await (const chunk of downloadResponse.readableStreamBody) {
            chunks.push(Buffer.from(chunk));
          }
        }
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        fs.writeFileSync(localPath, Buffer.concat(chunks));
      }
    }
  }
}
