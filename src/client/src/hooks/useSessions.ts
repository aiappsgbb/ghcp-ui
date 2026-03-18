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
        const list: SessionInfo[] = Array.isArray(data) ? data : (data.sessions ?? []);
        // Sort: active first, then by modifiedAt/createdAt descending
        list.sort((a, b) => {
          if (a.active && !b.active) return -1;
          if (!a.active && b.active) return 1;
          const aTime = a.modifiedAt ?? a.createdAt;
          const bTime = b.modifiedAt ?? b.createdAt;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
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

  const resumeSession = useCallback(
    async (id: string): Promise<SessionInfo | null> => {
      try {
        const res = await fetch(`${API_BASE}/sessions/${id}/resume`, {
          method: "POST",
        });
        if (res.ok) {
          const session: SessionInfo = await res.json();
          // Update the session in our list to mark as active
          setSessions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, ...session, active: true } : s))
          );
          return session;
        }
      } catch {
        // Silently fail
      }
      return null;
    },
    []
  );

  const renameSession = useCallback(
    async (id: string, title: string) => {
      try {
        await fetch(`${API_BASE}/sessions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, title } : s))
        );
      } catch {
        // Silently fail
      }
    },
    []
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, isLoading, fetchSessions, deleteSession, resumeSession, renameSession };
}
