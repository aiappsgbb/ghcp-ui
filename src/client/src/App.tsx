import { useState, useCallback } from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { ChatContainer } from "./components/ChatContainer";
import { InputBar } from "./components/InputBar";
import { useChat } from "./hooks/useChat";
import { useSessions } from "./hooks/useSessions";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const {
    messages,
    isLoading,
    error,
    currentSession,
    createSession,
    sendMessage,
    stopGeneration,
    setError,
  } = useChat();
  const {
    sessions,
    fetchSessions,
    deleteSession: removeSession,
  } = useSessions();

  const handleNewSession = useCallback(async () => {
    try {
      await createSession();
      await fetchSessions();
    } catch {
      // Error handled in hook
    }
  }, [createSession, fetchSessions]);

  const handleSelectSession = useCallback(
    (_id: string) => {
      // For now, just fetch sessions - full session switching would need message loading
      fetchSessions();
    },
    [fetchSessions]
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await removeSession(id);
    },
    [removeSession]
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        sessionModel={currentSession?.model ?? null}
        isConnected={currentSession !== null}
      />

      {error && (
        <div className="px-4 py-2 bg-red-950/50 border-b border-red-900/50 flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-500 hover:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          sessions={sessions}
          activeSessionId={currentSession?.id ?? null}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          isOpen={sidebarOpen}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute top-14 left-2 z-10 p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </button>

          <ChatContainer
            messages={messages}
            isLoading={isLoading}
            hasSession={currentSession !== null}
            onNewSession={handleNewSession}
          />

          <InputBar
            onSend={sendMessage}
            onStop={stopGeneration}
            isLoading={isLoading}
            disabled={currentSession === null}
          />
        </div>
      </div>
    </div>
  );
}
