export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolEvents?: ToolEvent[];
  reasoning?: string;
}

export interface ToolEvent {
  toolCallId?: string;
  type: "start" | "progress" | "complete" | "subagent_start" | "subagent_end";
  toolName?: string;
  mcpServerName?: string;
  message?: string;
  success?: boolean;
  content?: string;
  error?: string;
  agentName?: string;
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
  active?: boolean;
}

export interface ApiError {
  error: {
    message: string;
    stack?: string;
  };
}
