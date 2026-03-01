import { Router, type Request, type Response } from "express";
import multer from "multer";
import type { WorkspaceService } from "../services/workspace.service.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const DEFAULT_USER = "default";

export function createWorkspaceRoutes(workspace: WorkspaceService): Router {
  const router = Router();

  // GET /api/workspace/files — list files
  router.get("/files", async (req: Request, res: Response) => {
    const dirPath = (req.query.path as string) ?? "";
    try {
      const files = await workspace.listFiles(DEFAULT_USER, dirPath);
      res.json(files);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: { message } });
    }
  });

  // POST /api/workspace/upload — upload file
  router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
    const file = req.file;
    const targetPath = (req.body.path as string) ?? file?.originalname;

    if (!file || !targetPath) {
      res.status(400).json({ error: { message: "file and path are required" } });
      return;
    }

    try {
      const result = await workspace.uploadFile(DEFAULT_USER, targetPath, file.buffer);
      res.status(201).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: { message } });
    }
  });

  // GET /api/workspace/download/:path — download file
  router.get("/download/*", async (req: Request, res: Response) => {
    const filePath = (req.params as Record<string, string>)[0] ?? "";
    if (!filePath) {
      res.status(400).json({ error: { message: "path is required" } });
      return;
    }

    try {
      const content = await workspace.downloadFile(DEFAULT_USER, filePath);
      res.setHeader("Content-Disposition", `attachment; filename="${filePath.split("/").pop()}"`);
      res.send(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(404).json({ error: { message } });
    }
  });

  // DELETE /api/workspace/files/:path — delete file
  router.delete("/files/*", async (req: Request, res: Response) => {
    const filePath = (req.params as Record<string, string>)[0] ?? "";
    if (!filePath) {
      res.status(400).json({ error: { message: "path is required" } });
      return;
    }

    try {
      await workspace.deleteFile(DEFAULT_USER, filePath);
      res.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: { message } });
    }
  });

  // GET /api/workspace/path — get the workspace directory path
  router.get("/path", (_req: Request, res: Response) => {
    const wsPath = workspace.getWorkspacePath(DEFAULT_USER);
    res.json({ path: wsPath });
  });

  return router;
}
