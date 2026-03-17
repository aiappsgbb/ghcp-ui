import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { CopilotService } from "./services/copilot.service.js";
import { WorkspaceService } from "./services/workspace.service.js";
import { createChatRoutes } from "./routes/chat.routes.js";
import { createSessionRoutes } from "./routes/sessions.routes.js";
import { createWorkspaceRoutes } from "./routes/workspace.routes.js";
import healthRoutes from "./routes/health.routes.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const config = loadConfig();
  const app = express();

  // Middleware
  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction
        ? undefined
        : false,
    })
  );
  app.use(
    cors({
      origin: config.isProduction ? false : "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(morgan(config.isProduction ? "combined" : "dev"));
  app.use(express.json({ limit: "1mb" }));

  // Health routes (no auth)
  app.use("/api", healthRoutes);

  // Initialize services (non-blocking — server listens immediately)
  const copilot = new CopilotService(config);
  const workspace = new WorkspaceService(config);

  // API routes (registered before init completes — routes guard on client readiness)
  app.use("/api/sessions", createSessionRoutes(copilot, workspace));
  app.use("/api/chat", createChatRoutes(copilot));
  app.use("/api/workspace", createWorkspaceRoutes(workspace));

  // Global MCP servers endpoint (returns names only — no secrets)
  app.get("/api/mcp-servers", (_req, res) => {
    const servers = Object.entries(config.mcpServers).map(([name, srv]) => ({
      name,
      type: "type" in srv ? srv.type : "local",
      url: "url" in srv ? srv.url : undefined,
    }));
    res.json({ servers });
  });

  // Serve static frontend in production
  if (config.isProduction) {
    const clientDist = path.resolve(__dirname, "../../client/dist");
    app.use(express.static(clientDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] ${signal} received, shutting down...`);
    await copilot.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Start listening FIRST, then init services in background
  app.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║   GHCP-UI Server                                 ║
║   Port: ${String(config.port).padEnd(40)}║
║   Mode: ${config.nodeEnv.padEnd(40)}║
║   BYOK: ${String(config.copilot.useByok).padEnd(40)}║
║   Model: ${config.azure.foundryModel.padEnd(39)}║
╚══════════════════════════════════════════════════╝
    `);

    // Initialize heavy services after server is listening
    Promise.all([
      copilot.initialize(),
      workspace.initialize(),
    ]).then(() => {
      console.log("[Server] All services initialized");
    }).catch((err) => {
      console.error("[Server] Service initialization error:", err);
    });
  });
}

main().catch((err) => {
  console.error("[Server] Fatal error:", err);
  process.exit(1);
});
