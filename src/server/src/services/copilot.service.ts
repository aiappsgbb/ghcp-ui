import { CopilotClient, approveAll, type CopilotSession, type MCPServerConfig, type SessionEventHandler } from "@github/copilot-sdk";
import { v4 as uuidv4 } from "uuid";
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
  model: string;
  messageCount: number;
}

interface ManagedSession {
  session: CopilotSession;
  model: string;
  createdAt: Date;
  messages: ChatMessage[];
}

export class CopilotService {
  private client: CopilotClient | null = null;
  private sessions = new Map<string, ManagedSession>();
  private config: AppConfig;
  private _ready = false;

  constructor(config: AppConfig) {
    this.config = config;
  }

  get isReady(): boolean {
    return this._ready && this.client !== null;
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
    } catch (err) {
      console.warn("[CopilotService] Failed to start Copilot CLI — chat unavailable");
      console.warn("[CopilotService]", (err as Error).message ?? err);
      this.client = null;
      this._ready = false;
    }
  }

  async shutdown(): Promise<void> {
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
    console.log("[CopilotService] Shut down");
  }

  async createSession(model?: string, workingDirectory?: string, mcpServers?: Record<string, { type: "http" | "sse"; url: string; headers?: Record<string, string>; tools: string[] }>): Promise<SessionInfo> {
    if (!this.client) throw new Error("CopilotService not initialized");

    const sessionId = uuidv4();
    const selectedModel = model ?? this.config.azure.foundryModel;

    const sessionConfig: {
      sessionId: string;
      model: string;
      onPermissionRequest: typeof approveAll;
      workingDirectory?: string;
      mcpServers?: Record<string, MCPServerConfig>;
      provider?: {
        type: "openai" | "azure" | "anthropic";
        baseUrl: string;
        wireApi: "responses" | "completions";
        apiKey: string;
      };
    } = {
      sessionId,
      model: selectedModel,
      onPermissionRequest: approveAll,
    };

    // Build merged MCP servers: global config + workspace FS + per-session
    const globalMcp = this.config.mcpServers;
    const mergedMcp: Record<string, MCPServerConfig> = { ...globalMcp };

    if (workingDirectory) {
      sessionConfig.workingDirectory = workingDirectory;
      mergedMcp.workspace = {
        type: "local" as const,
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", workingDirectory],
        tools: ["*"],
      };
    }

    if (mcpServers) {
      Object.assign(mergedMcp, mcpServers);
    }

    if (Object.keys(mergedMcp).length > 0) {
      sessionConfig.mcpServers = mergedMcp;
    }

    if (this.config.copilot.useByok) {
      sessionConfig.provider = {
        type: "openai",
        baseUrl: this.config.azure.foundryEndpoint,
        wireApi: "responses",
        apiKey: this.config.azure.foundryApiKey,
      };
    }

    const session = await this.client.createSession(sessionConfig);

    const managed: ManagedSession = {
      session,
      model: selectedModel,
      createdAt: new Date(),
      messages: [],
    };

    this.sessions.set(sessionId, managed);

    return {
      id: sessionId,
      createdAt: managed.createdAt.toISOString(),
      model: selectedModel,
      messageCount: 0,
    };
  }

  async *streamChat(
    sessionId: string,
    prompt: string
  ): AsyncGenerator<{ type: string; data: string }> {
    const managed = this.sessions.get(sessionId);
    if (!managed) throw new Error(`Session ${sessionId} not found`);

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    managed.messages.push(userMsg);

    yield { type: "user_message", data: JSON.stringify(userMsg) };

    // Collect events via a queue so we can yield them as SSE
    const eventQueue: Array<{ type: string; data: string }> = [];
    let resolveWait: (() => void) | null = null;
    let isDone = false;
    let fullContent = "";
    const deltaChunks: string[] = [];

    const push = (evt: { type: string; data: string }) => {
      eventQueue.push(evt);
      resolveWait?.();
    };

    // Subscribe to all events via catch-all handler
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

    // Send the prompt (non-blocking)
    await managed.session.send({ prompt });

    // Yield events as they arrive
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
    managed.messages.push(assistantMsg);

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
    if (!managed) throw new Error(`Session ${sessionId} not found`);

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    managed.messages.push(userMsg);

    const response = await managed.session.sendAndWait({ prompt });
    const content = response?.data?.content ?? "";

    const assistantMsg: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content,
      timestamp: new Date().toISOString(),
    };
    managed.messages.push(assistantMsg);

    return assistantMsg;
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.entries()).map(([id, managed]) => ({
      id,
      createdAt: managed.createdAt.toISOString(),
      model: managed.model,
      messageCount: managed.messages.length,
    }));
  }

  getSessionMessages(sessionId: string): ChatMessage[] {
    const managed = this.sessions.get(sessionId);
    if (!managed) throw new Error(`Session ${sessionId} not found`);
    return managed.messages;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (!managed) throw new Error(`Session ${sessionId} not found`);

    try {
      await managed.session.destroy();
    } catch {
      // Ignore errors during destroy
    }
    this.sessions.delete(sessionId);
  }
}
