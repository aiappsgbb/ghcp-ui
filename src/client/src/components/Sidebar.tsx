import {
  Plus,
  Trash2,
  MessageSquare,
  Clock,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { SessionInfo } from "../types";

interface SidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  isOpen,
  onClose,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleSelect = (id: string) => {
    onSelectSession(id);
    // Auto-close on mobile
    if (window.innerWidth < 768) onClose();
  };

  const handleNew = () => {
    onNewSession();
    if (window.innerWidth < 768) onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          fixed inset-y-0 left-0 z-40 w-72 border-r border-zinc-800 flex flex-col bg-zinc-950 transition-transform duration-200 ease-out
          md:relative md:z-0 md:w-64 md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-full md:hidden"}
        `}
      >
        {/* Mobile close button */}
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
                }`}
                onClick={() => handleSelect(session.id)}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
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
                  className="opacity-0 group-hover:opacity-100 group-active:opacity-100 p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-all min-w-[28px] min-h-[28px] flex items-center justify-center"
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
