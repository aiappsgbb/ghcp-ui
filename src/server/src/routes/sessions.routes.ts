import { Router, type Request, type Response } from "express";
import type { CopilotService } from "../services/copilot.service.js";
import type { WorkspaceService } from "../services/workspace.service.js";

export function createSessionRoutes(copilot: CopilotService, workspace: WorkspaceService): Router {
  const router = Router();

  // GET /api/sessions — list all sessions
  router.get("/", (_req: Request, res: Response) => {
    if (!copilot.isReady) {
      res.json({ sessions: [], ready: false });
      return;
    }
    const sessions = copilot.listSessions();
    res.json({ sessions, ready: true });
  });

  // POST /api/sessions — create new session
  router.post("/", async (req: Request, res: Response) => {
    if (!copilot.isReady) {
      res.status(503).json({ error: { message: "Copilot service is still initializing. Please wait." } });
      return;
    }

    const { model, workspacePath, mcpServers } = req.body as {
      model?: string;
      workspacePath?: string;
      mcpServers?: Record<string, { type: "http" | "sse"; url: string; headers?: Record<string, string>; tools: string[] }>;
    };

    // Resolve workspace folder name to absolute path
    const userId = "default";
    const resolvedPath = workspacePath
      ? workspace.getFolderPath(userId, workspacePath)
      : workspace.getWorkspacePath(userId);

    try {
      const session = await copilot.createSession(model, resolvedPath, mcpServers);
      res.status(201).json(session);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: { message } });
    }
  });

  // GET /api/sessions/:id/messages — get session messages
  router.get("/:id/messages", (req: Request, res: Response) => {
    try {
      const messages = copilot.getSessionMessages(req.params.id as string);
      res.json(messages);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(404).json({ error: { message } });
    }
  });

  // DELETE /api/sessions/:id — delete session
  router.delete("/:id", async (req: Request, res: Response) => {
    try {
      await copilot.deleteSession(req.params.id as string);
      res.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(404).json({ error: { message } });
    }
  });

  return router;
}
