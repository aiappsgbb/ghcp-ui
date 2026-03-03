import { Router, type Request, type Response } from "express";
import multer from "multer";
import type { WorkspaceService } from "../services/workspace.service.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export function createWorkspaceRoutes(workspace: WorkspaceService): Router {
  const router = Router();

  // GET /api/workspace/:userId/files — list files
  router.get("/:userId/files", async (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const dirPath = (req.query.path as string) ?? "";
    try {
      const files = await workspace.listFiles(userId, dirPath);
      res.json({ files });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: { message } });
    }
  });

  // POST /api/workspace/:userId/files — upload file (multipart)
  router.post("/:userId/files", upload.single("file"), async (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const file = req.file;
    const targetPath = (req.body.path as string) ?? file?.originalname;

    if (!file || !targetPath) {
      res.status(400).json({ error: { message: "file and path are required" } });
      return;
    }

    try {
      const result = await workspace.uploadFile(userId, targetPath, file.buffer);
      res.status(201).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: { message } });
    }
  });

  // GET /api/workspace/:userId/files/:filePath — download file
  router.get("/:userId/files/:filePath", async (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const filePath = req.params.filePath as string;
    if (!filePath) {
      res.status(400).json({ error: { message: "path is required" } });
      return;
    }

    try {
      const content = await workspace.downloadFile(userId, filePath);
      res.setHeader("Content-Disposition", `attachment; filename="${filePath.split("/").pop()}"`);
      res.send(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(404).json({ error: { message } });
    }
  });

  // DELETE /api/workspace/:userId/files/:filePath — delete file
  router.delete("/:userId/files/:filePath", async (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const filePath = req.params.filePath as string;
    if (!filePath) {
      res.status(400).json({ error: { message: "path is required" } });
      return;
    }

    try {
      await workspace.deleteFile(userId, filePath);
      res.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: { message } });
    }
  });

  // GET /api/workspace/:userId/path — get the workspace directory path
  router.get("/:userId/path", (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const wsPath = workspace.getWorkspacePath(userId);
    res.json({ path: wsPath });
  });

  return router;
}
