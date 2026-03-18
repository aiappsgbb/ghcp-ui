import {
  CopilotClient,
  approveAll,
  type CopilotSession,
  type MCPServerConfig,
  type SessionEventHandler,
  type SessionMetadata,
} from "@github/copilot-sdk";
import { v4 as uuidv4 } from "uuid";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { AppConfig } from "../config.js";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  modifiedAt?: string;
  model: string;
  title?: string;
  summary?: string;
  messageCount: number;
  active: boolean;
}

/** Lightweight sidecar stored alongside each session */
interface SessionMeta {
  model: string;
  title?: string;
  createdAt: string;
}

interface ManagedSession {
  session: CopilotSession;
  model: string;
  createdAt: Date;
}

export class CopilotService {
  private client: CopilotClient | null = null;
  /** Active (in-memory) sessions only */
  private sessions = new Map<string, ManagedSession>();
  private config: AppConfig;
  private _ready = false;

  constructor(config: AppConfig) {
    this.config = config;
  }

  get isReady(): boolean {
    return this._ready && this.client !== null;
  }

  /** Directory where the CLI persists session state */
  private get configDir(): string {
    const base = this.config.workspaceMountPath || "/tmp/ghcp-sessions";
    const dir = join(base, ".copilot");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Path to the sidecar metadata file for a session */
  private metaPath(sessionId: string): string {
    const dir = join(this.configDir, "session-meta");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return join(dir, `${sessionId}.json`);
  }

  private writeMeta(sessionId: string, meta: SessionMeta): void {
    try {
      writeFileSync(this.metaPath(sessionId), JSON.stringify(meta));
    } catch (err) {
      console.warn(`[CopilotService] Failed to write session meta for ${sessionId}:`, err);
    }
  }

  private readMeta(sessionId: string): SessionMeta | null {
    try {
      const raw = readFileSync(this.metaPath(sessionId), "utf-8");
      return JSON.parse(raw) as SessionMeta;
    } catch {
      return null;
    }
  }

  async initialize(): Promise<void> {
    try {
      const clientOpts: Record<string, unknown> = {};

      if (this.config.copilot.githubToken) {
        clientOpts.githubToken = this.config.copilot.githubToken;
      }

      if (this.config.copilot.useByok) {
        clientOpts.useLoggedInUser = false;
      }

      this.client = new CopilotClient(clientOpts);
      await this.client.start();
      this._ready = true;
      console.log("[CopilotService] Client started successfully");
      console.log(`[CopilotService] configDir: ${this.configDir}`);
    } catch (err) {
      console.warn("[CopilotService] Failed to start Copilot CLI — chat unavailable");
      console.warn("[CopilotService]", (err as Error).message ?? err);
      this.client = null;
      this._ready = false;
    }
  }

  async shutdown(): Promise<void> {
    // Destroy active sessions (state preserved on disk for later resume)
    for (const [id, managed] of this.sessions) {
      try {
        await managed.session.destroy();
      } catch (e) {
        console.warn(`[CopilotService] Error destroying session ${id}:`, e);
      }
    }
    this.sessions.clear();

    if (this.client) {
      await this.client.stop();
      this.client = null;
    }
    console.log("[CopilotService] Shut down (sessions preserved on disk for resume)");
  }

  /** Build the BYOK provider config if configured */
  private get providerConfig() {
    if (!this.config.copilot.useByok) return undefined;
    return {
      type: "openai" as const,
      baseUrl: this.config.azure.foundryEndpoint,
      wireApi: "responses" as const,
      apiKey: this.config.azure.foundryApiKey,
    };
  }

  /** Build merged MCP servers from global + workspace + per-session */
  private buildMcpServers(
    workingDirectory?: string,
    extra?: Record<string, { type: "http" | "sse"; url: string; headers?: Record<string, string>; tools: string[] }>
  ): Record<string, MCPServerConfig> | undefined {
    const merged: Record<string, MCPServerConfig> = { ...this.config.mcpServers };

    if (workingDirectory) {
      merged.workspace = {
        type: "local" as const,
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", workingDirectory],
        tools: ["*"],
      };
    }

    if (extra) Object.assign(merged, extra);

    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  async createSession(
    model?: string,
    workingDirectory?: string,
    mcpServers?: Record<string, { type: "http" | "sse"; url: string; headers?: Record<string, string>; tools: string[] }>
  ): Promise<SessionInfo> {
    if (!this.client) throw new Error("CopilotService not initialized");

    const sessionId = uuidv4();
    const selectedModel = model ?? this.config.azure.foundryModel;

    const session = await this.client.createSession({
      sessionId,
      model: selectedModel,
      configDir: this.configDir,
      onPermissionRequest: approveAll,
      workingDirectory,
      mcpServers: this.buildMcpServers(workingDirectory, mcpServers),
      provider: this.providerConfig,
    });

    const now = new Date();
    this.sessions.set(sessionId, { session, model: selectedModel, createdAt: now });
    this.writeMeta(sessionId, { model: selectedModel, createdAt: now.toISOString() });

    return {
      id: sessionId,
      createdAt: now.toISOString(),
      model: selectedModel,
      messageCount: 0,
      active: true,
    };
  }

  async resumeSession(sessionId: string): Promise<SessionInfo> {
    if (!this.client) throw new Error("CopilotService not initialized");

    // Already active?
    if (this.sessions.has(sessionId)) {
      const managed = this.sessions.get(sessionId)!;
      return {
        id: sessionId,
        createdAt: managed.createdAt.toISOString(),
        model: managed.model,
        messageCount: 0,
        active: true,
      };
    }

    const meta = this.readMeta(sessionId);
    const model = meta?.model ?? this.config.azure.foundryModel;

    const session = await this.client.resumeSession(sessionId, {
      configDir: this.configDir,
      onPermissionRequest: approveAll,
      mcpServers: this.buildMcpServers(),
      provider: this.providerConfig,
      model,
    });

    const createdAt = meta?.createdAt ? new Date(meta.createdAt) : new Date();
    this.sessions.set(sessionId, { session, model, createdAt });

    return {
      id: sessionId,
      createdAt: createdAt.toISOString(),
      model,
      title: meta?.title,
      messageCount: 0,
      active: true,
    };
  }

  /** List all sessions: active in-memory + persisted on disk (merged, deduped) */
  async listSessions(): Promise<SessionInfo[]> {
    if (!this.client) return [];

    let persisted: SessionMetadata[] = [];
    try {
      persisted = await this.client.listSessions();
    } catch (err) {
      console.warn("[CopilotService] Failed to list persisted sessions:", err);
    }

    const seen = new Set<string>();
    const results: SessionInfo[] = [];

    // Start with persisted sessions from SDK
    for (const s of persisted) {
      seen.add(s.sessionId);
      const isActive = this.sessions.has(s.sessionId);
      const meta = this.readMeta(s.sessionId);
      results.push({
        id: s.sessionId,
        createdAt: s.startTime?.toISOString?.() ?? meta?.createdAt ?? new Date().toISOString(),
        modifiedAt: s.modifiedTime?.toISOString?.(),
        model: meta?.model ?? this.config.azure.foundryModel,
        title: meta?.title,
        summary: s.summary,
        messageCount: 0,
        active: isActive,
      });
    }

    // Add active in-memory sessions not yet persisted to disk
    for (const [id, managed] of this.sessions) {
      if (!seen.has(id)) {
        const meta = this.readMeta(id);
        results.push({
          id,
          createdAt: managed.createdAt.toISOString(),
          model: managed.model,
          title: meta?.title,
          messageCount: 0,
          active: true,
        });
      }
    }

    return results;
  }

  /** Get session messages — uses SDK getMessages() for full history from disk */
  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    const managed = this.sessions.get(sessionId);
    if (!managed) throw new Error(`Session ${sessionId} not active. Resume it first.`);

    try {
      const events = await managed.session.getMessages();
      const messages: ChatMessage[] = [];

      for (const evt of events) {
        const e = evt as { type: string; id?: string; timestamp?: string; data?: Record<string, unknown> };
        if (e.type === "user.message" && e.data?.content) {
          messages.push({
            id: e.id ?? uuidv4(),
            role: "user",
            content: e.data.content as string,
            timestamp: e.timestamp ?? new Date().toISOString(),
          });
        } else if (e.type === "assistant.message" && e.data?.content) {
          messages.push({
            id: e.id ?? uuidv4(),
            role: "assistant",
            content: e.data.content as string,
            timestamp: e.timestamp ?? new Date().toISOString(),
          });
        }
      }

      return messages;
    } catch (err) {
      console.warn(`[CopilotService] Failed to get messages for ${sessionId}:`, err);
      return [];
    }
  }

  /** Rename a session */
  updateSessionTitle(sessionId: string, title: string): void {
    const meta = this.readMeta(sessionId);
    if (meta) {
      meta.title = title;
      this.writeMeta(sessionId, meta);
    }
  }

  async *streamChat(
    sessionId: string,
    prompt: string
  ): AsyncGenerator<{ type: string; data: string }> {
    const managed = this.sessions.get(sessionId);
    if (!managed) throw new Error(`Session ${sessionId} not active. Resume it first.`);

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    yield { type: "user_message", data: JSON.stringify(userMsg) };

    const eventQueue: Array<{ type: string; data: string }> = [];
    let resolveWait: (() => void) | null = null;
    let isDone = false;
    let fullContent = "";
    const deltaChunks: string[] = [];

    const push = (evt: { type: string; data: string }) => {
      eventQueue.push(evt);
      resolveWait?.();
    };

    const handler = (event: { type: string; data?: Record<string, unknown> }) => {
      const t = event.type;
      const d = event.data ?? {};

      if (t === "tool.execution_start") {
        push({
          type: "tool_start",
          data: JSON.stringify({
            toolCallId: d.toolCallId,
            toolName: d.toolName,
            mcpServerName: d.mcpServerName,
            mcpToolName: d.mcpToolName,
          }),
        });
      } else if (t === "tool.execution_progress") {
        push({
          type: "tool_progress",
          data: JSON.stringify({
            toolCallId: d.toolCallId,
            message: d.progressMessage,
          }),
        });
      } else if (t === "tool.execution_complete") {
        const result = d.result as Record<string, unknown> | undefined;
        push({
          type: "tool_complete",
          data: JSON.stringify({
            toolCallId: d.toolCallId,
            success: d.success,
            content: typeof result?.content === "string"
              ? result.content.slice(0, 500)
              : undefined,
          }),
        });
      } else if (t === "assistant.intent") {
        push({
          type: "intent",
          data: JSON.stringify({ intent: d.intent }),
        });
      } else if (t === "assistant.reasoning_delta") {
        push({
          type: "reasoning_delta",
          data: JSON.stringify({ content: d.deltaContent }),
        });
      } else if (t === "assistant.message_delta") {
        const delta = (d.deltaContent as string) ?? "";
        if (delta) {
          deltaChunks.push(delta);
          push({
            type: "message_delta",
            data: JSON.stringify({ content: delta }),
          });
        }
      } else if (t === "assistant.message") {
        fullContent = (d.content as string) ?? deltaChunks.join("");
      } else if (t === "subagent.started") {
        push({
          type: "subagent_start",
          data: JSON.stringify({
            toolCallId: d.toolCallId,
            name: d.agentDisplayName ?? d.agentName,
          }),
        });
      } else if (t === "subagent.completed" || t === "subagent.failed") {
        push({
          type: "subagent_end",
          data: JSON.stringify({
            toolCallId: d.toolCallId,
            name: d.agentDisplayName ?? d.agentName,
            success: t === "subagent.completed",
          }),
        });
      } else if (t === "session.idle") {
        if (!fullContent && deltaChunks.length > 0) {
          fullContent = deltaChunks.join("");
        }
        isDone = true;
        resolveWait?.();
      }
    };

    managed.session.on(handler as SessionEventHandler);

    await managed.session.send({ prompt });

    const timeout = setTimeout(() => {
      isDone = true;
      resolveWait?.();
    }, 120_000);

    try {
      while (!isDone || eventQueue.length > 0) {
        if (eventQueue.length === 0 && !isDone) {
          await new Promise<void>((resolve) => {
            resolveWait = resolve;
          });
          resolveWait = null;
        }

        while (eventQueue.length > 0) {
          yield eventQueue.shift()!;
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    const assistantMsg: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: fullContent,
      timestamp: new Date().toISOString(),
    };

    yield {
      type: "assistant_message",
      data: JSON.stringify(assistantMsg),
    };
  }

  async sendAndWait(
    sessionId: string,
    prompt: string
  ): Promise<ChatMessage> {
    const managed = this.sessions.get(sessionId);
    if (!managed) throw new Error(`Session ${sessionId} not active. Resume it first.`);

    const response = await managed.session.sendAndWait({ prompt });
    const content = response?.data?.content ?? "";

    return {
      id: uuidv4(),
      role: "assistant",
      content,
      timestamp: new Date().toISOString(),
    };
  }

  /** Delete a session permanently (removes from disk) */
  async deleteSession(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (managed) {
      try {
        await managed.session.destroy();
      } catch {
        // Ignore destroy errors
      }
      this.sessions.delete(sessionId);
    }

    if (this.client) {
      try {
        await this.client.deleteSession(sessionId);
      } catch {
        // Session may not exist on disk
      }
    }

    // Clean up sidecar
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(this.metaPath(sessionId));
    } catch {
      // Sidecar may not exist
    }
  }

  /** Check if a session is currently active in memory */
  isSessionActive(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}
