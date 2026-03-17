import { useState, useCallback } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { ChatContainer } from "./components/ChatContainer";
import { InputBar } from "./components/InputBar";
import { SettingsDrawer, type McpServerEntry } from "./components/SettingsDrawer";
import { NewChatDialog } from "./components/NewChatDialog";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { useChat } from "./hooks/useChat";
import { useSessions } from "./hooks/useSessions";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServerEntry[]>([]);
  const [activeFolder, setActiveFolder] = useState("");

  const {
    messages,
    isLoading,
    error,
    currentSession,
    createSession,
    sendMessage,
    stopGeneration,
    setError,
    loadSessionMessages,
    setCurrentSession,
  } = useChat();
  const {
    sessions,
    fetchSessions,
    deleteSession: removeSession,
  } = useSessions();

  const handleNewSession = useCallback(async (model?: string) => {
    try {
      // Build workspace path from active folder
      const wsPath = activeFolder || undefined;
      await createSession(model, mcpServers.length > 0 ? mcpServers : undefined, wsPath);
      await fetchSessions();
    } catch {
      // Error handled in hook
    }
  }, [createSession, fetchSessions, mcpServers, activeFolder]);

  const handleNewChatClick = useCallback(() => {
    setNewChatOpen(true);
  }, []);

  const handleSelectSession = useCallback(
    async (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        setCurrentSession(session);
        await loadSessionMessages(id);
      }
    },
    [sessions, setCurrentSession, loadSessionMessages]
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await removeSession(id);
      if (currentSession?.id === id) {
        setCurrentSession(null);
      }
    },
    [removeSession, currentSession, setCurrentSession]
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Header
        sessionModel={currentSession?.model ?? null}
        isConnected={currentSession !== null}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenWorkspace={() => setWorkspaceOpen(true)}
      />

      {error && (
        <div className="px-3 sm:px-4 py-2 bg-red-950/50 border-b border-red-900/50 flex items-center justify-between">
          <p className="text-sm text-red-400 flex-1 min-w-0 truncate">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-500 hover:text-red-400 ml-2 shrink-0 p-1"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          sessions={sessions}
          activeSessionId={currentSession?.id ?? null}
          onNewSession={handleNewChatClick}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <ChatContainer
            messages={messages}
            isLoading={isLoading}
            hasSession={currentSession !== null}
            onNewSession={handleNewChatClick}
          />

          <InputBar
            onSend={sendMessage}
            onStop={stopGeneration}
            isLoading={isLoading}
            disabled={currentSession === null}
          />
        </div>
      </div>

      <NewChatDialog
        isOpen={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onCreateSession={(model) => handleNewSession(model)}
        defaultModel="gpt-4.1"
      />

      <SettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mcpServers={mcpServers}
        onUpdateMcpServers={setMcpServers}
        currentModel={currentSession?.model ?? ""}
        workspacePath={null}
      />

      <WorkspacePanel
        isOpen={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        sessionId={currentSession?.id ?? null}
        activeFolder={activeFolder}
        onFolderChange={setActiveFolder}
      />
    </div>
  );
}
