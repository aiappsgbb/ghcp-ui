import { useState, useCallback, useRef } from "react";
import type { ChatMessage, SessionInfo } from "../types";

const API_BASE = "/api";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(
    null
  );
  const abortRef = useRef<AbortController | null>(null);

  const createSession = useCallback(async (model?: string, mcpServers?: Array<{ name: string; type: "http" | "sse"; url: string; headers?: Record<string, string>; tools: string[] }>, workspacePath?: string) => {
    try {
      setError(null);
      // Convert array of MCP servers to the Record format the API expects
      const mcpRecord = mcpServers?.reduce((acc, s) => {
        acc[s.name] = { type: s.type, url: s.url, headers: s.headers, tools: s.tools };
        return acc;
      }, {} as Record<string, { type: "http" | "sse"; url: string; headers?: Record<string, string>; tools: string[] }>);

      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          ...(mcpRecord && Object.keys(mcpRecord).length > 0 ? { mcpServers: mcpRecord } : {}),
          ...(workspacePath ? { workspacePath } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
      const session: SessionInfo = await res.json();
      setCurrentSession(session);
      setMessages([]);
      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create session";
      setError(msg);
      throw err;
    }
  }, []);

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
      if (res.ok) {
        const msgs: ChatMessage[] = await res.json();
        setMessages(msgs);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!currentSession) {
        setError("No active session");
        return;
      }

      setIsLoading(true);
      setError(null);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      abortRef.current = new AbortController();

      try {
        const res = await fetch(
          `${API_BASE}/chat/${currentSession.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
            signal: abortRef.current.signal,
          }
        );

        if (!res.ok) throw new Error(`Chat failed: ${res.status}`);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No response body");

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events: "event: <type>\ndata: <json>\n\n"
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const lines = event.split("\n");
            let eventType = "message";
            let dataStr = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                dataStr = line.slice(6);
              }
            }

            if (eventType === "done" || !dataStr) continue;
            if (eventType === "error") {
              try {
                const errData = JSON.parse(dataStr);
                setError(errData.message);
              } catch {
                setError("Unknown error");
              }
              continue;
            }

            try {
              const data = JSON.parse(dataStr) as ChatMessage;
              if (data.role === "assistant" && data.content) {
                setMessages((prev) => [...prev, data]);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Failed to send message";
        setError(msg);
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [currentSession]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    error,
    currentSession,
    createSession,
    sendMessage,
    stopGeneration,
    clearMessages,
    setError,
    loadSessionMessages,
    setCurrentSession,
  };
}
