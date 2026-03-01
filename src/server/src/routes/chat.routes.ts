import { Router, type Request, type Response } from "express";
import type { CopilotService } from "../services/copilot.service.js";

export function createChatRoutes(copilot: CopilotService): Router {
  const router = Router();

  // POST /api/chat — SSE streaming response
  router.post("/:sessionId", async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const { prompt } = req.body as { prompt?: string };

    if (!prompt?.trim()) {
      res.status(400).json({ error: { message: "prompt is required" } });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      for await (const event of copilot.streamChat(sessionId, prompt)) {
        res.write(`event: ${event.type}\ndata: ${event.data}\n\n`);
      }
      res.write("event: done\ndata: {}\n\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    } finally {
      res.end();
    }
  });

  // POST /api/chat/:sessionId/sync — non-streaming response
  router.post("/:sessionId/sync", async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const { prompt } = req.body as { prompt?: string };

    if (!prompt?.trim()) {
      res.status(400).json({ error: { message: "prompt is required" } });
      return;
    }

    try {
      const response = await copilot.sendAndWait(sessionId, prompt);
      res.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: { message } });
    }
  });

  return router;
}
