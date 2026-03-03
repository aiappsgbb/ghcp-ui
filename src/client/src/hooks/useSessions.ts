import { useState, useCallback, useEffect } from "react";
import type { SessionInfo } from "../types";

const API_BASE = "/api";

export function useSessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      if (res.ok) {
        const data = await res.json();
        // Handle both { sessions: [...] } and plain array formats
        const list: SessionInfo[] = Array.isArray(data) ? data : (data.sessions ?? []);
        setSessions(list);
      }
    } catch {
      // Silently fail — server may still be starting
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`${API_BASE}/sessions/${id}`, { method: "DELETE" });
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } catch {
        // Silently fail
      }
    },
    []
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, isLoading, fetchSessions, deleteSession };
}
