import {
  Plus,
  Trash2,
  MessageSquare,
  X,
  Circle,
  Pause,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SessionInfo } from "../types";

interface SidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  resumingId?: string | null;
}

function SessionLabel({ session }: { session: SessionInfo }) {
  const label = session.title || session.summary || session.model;
  const time = session.modifiedAt ?? session.createdAt;
  const dateStr = new Date(time).toLocaleDateString([], { month: "short", day: "numeric" });
  const timeStr = new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex-1 min-w-0">
      <p className="text-sm truncate">{label}</p>
      <div className="flex items-center gap-1 text-xs text-zinc-600">
        {session.active ? (
          <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500 shrink-0" />
        ) : (
          <Pause className="w-2.5 h-2.5 text-zinc-600 shrink-0" />
        )}
        <span className="truncate">
          {session.model} · {dateStr} {timeStr}
        </span>
      </div>
    </div>
  );
}

export function Sidebar({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  isOpen,
  onClose,
  resumingId,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleSelect = (id: string) => {
    onSelectSession(id);
    if (window.innerWidth < 768) onClose();
  };

  const handleNew = () => {
    onNewSession();
    if (window.innerWidth < 768) onClose();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      onDeleteSession(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        ref={sidebarRef}
        className={`
          fixed inset-y-0 left-0 z-40 w-72 border-r border-zinc-800 flex flex-col bg-zinc-950 transition-transform duration-200 ease-out
          md:relative md:z-0 md:w-64 md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-full md:hidden"}
        `}
      >
        <div className="flex items-center justify-between p-3 md:hidden">
          <span className="text-sm font-medium text-zinc-400">Chats</span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 pt-0 md:pt-3">
          <button
            onClick={handleNew}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-zinc-700 hover:border-brand-500 hover:bg-zinc-900 active:bg-zinc-800 transition-all text-sm text-zinc-300 hover:text-white"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-600">No conversations yet</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  activeSessionId === session.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 active:bg-zinc-800"
                } ${resumingId === session.id ? "opacity-60 pointer-events-none" : ""}`}
                onClick={() => handleSelect(session.id)}
              >
                {resumingId === session.id ? (
                  <div className="w-4 h-4 shrink-0 animate-spin border-2 border-brand-400 border-t-transparent rounded-full" />
                ) : (
                  <MessageSquare className="w-4 h-4 shrink-0" />
                )}
                <SessionLabel session={session} />
                <button
                  onClick={(e) => handleDelete(e, session.id)}
                  className={`p-1.5 rounded hover:bg-zinc-700 transition-all min-w-[28px] min-h-[28px] flex items-center justify-center ${
                    confirmDeleteId === session.id
                      ? "opacity-100 text-red-400 bg-red-950/30"
                      : "opacity-0 group-hover:opacity-100 group-active:opacity-100 text-zinc-500 hover:text-red-400"
                  }`}
                  title={confirmDeleteId === session.id ? "Click again to confirm" : "Delete session"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
