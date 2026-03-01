import {
  Plus,
  Trash2,
  MessageSquare,
  Clock,
} from "lucide-react";
import type { SessionInfo } from "../types";

interface SidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  isOpen,
}: SidebarProps) {
  if (!isOpen) return null;

  return (
    <aside className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950 shrink-0">
      <div className="p-3">
        <button
          onClick={onNewSession}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-zinc-700 hover:border-brand-500 hover:bg-zinc-900 transition-all text-sm text-zinc-300 hover:text-white"
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
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                activeSessionId === session.id
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
              onClick={() => onSelectSession(session.id)}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {session.model}
                </p>
                <div className="flex items-center gap-1 text-xs text-zinc-600">
                  <Clock className="w-3 h-3" />
                  {new Date(session.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  <span className="ml-1">
                    · {session.messageCount} msgs
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
