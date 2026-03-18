import { Router, type Request, type Response } from "express";
import type { CopilotService } from "../services/copilot.service.js";
import type { WorkspaceService } from "../services/workspace.service.js";

export function createSessionRoutes(copilot: CopilotService, workspace: WorkspaceService): Router {
  const router = Router();

  // GET /api/sessions — list all sessions for the current user
  router.get("/", async (req: Request, res: Response) => {
    if (!copilot.isReady) {
      res.json({ sessions: [], ready: false });
      return;
    }
    try {
      const sessions = await copilot.listSessions(req.userId);
      res.json({ sessions, ready: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: { message } });
    }
  });

  // POST /api/sessions — create new session
  router.post("/", async (req: Request, res: Response) => {
    if (!copilot.isReady) {
      res.status(503).json({ error: { message: "Copilot service is still initializing. Please wait." } });
      return;
    }

    const { model, workspacePath, mcpServers } = (req.body ?? {}) as {
      model?: string;
      workspacePath?: string;
      mcpServers?: Record<string, { type: "http" | "sse"; url: string; headers?: Record<string, string>; tools: string[] }>;
    };

    const resolvedPath = workspacePath
      ? workspace.getFolderPath(req.userId, workspacePath)
      : workspace.getWorkspacePath(req.userId);

    try {
      const session = await copilot.createSession(req.userId, model, resolvedPath, mcpServers);
      res.status(201).json(session);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[sessions] createSession error: ${message}`);
      res.status(500).json({ error: { message } });
    }
  });

  // POST /api/sessions/:id/resume — resume an existing session
  router.post("/:id/resume", async (req: Request, res: Response) => {
    if (!copilot.isReady) {
      res.status(503).json({ error: { message: "Copilot service is still initializing. Please wait." } });
      return;
    }

    try {
      const session = await copilot.resumeSession(req.userId, req.params.id as string);
      res.json(session);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: { message } });
    }
  });

  // GET /api/sessions/:id/messages — get session messages
  router.get("/:id/messages", async (req: Request, res: Response) => {
    try {
      const messages = await copilot.getSessionMessages(req.params.id as string);
      res.json(messages);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(404).json({ error: { message } });
    }
  });

  // PATCH /api/sessions/:id — update session title
  router.patch("/:id", (req: Request, res: Response) => {
    const { title } = req.body as { title?: string };
    if (!title) {
      res.status(400).json({ error: { message: "title is required" } });
      return;
    }
    try {
      copilot.updateSessionTitle(req.userId, req.params.id as string, title);
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(404).json({ error: { message } });
    }
  });

  // DELETE /api/sessions/:id — permanently delete session
  router.delete("/:id", async (req: Request, res: Response) => {
    try {
      await copilot.deleteSession(req.userId, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(404).json({ error: { message } });
    }
  });

  return router;
}
