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

export interface ApiError {
  error: {
    message: string;
    stack?: string;
  };
}
