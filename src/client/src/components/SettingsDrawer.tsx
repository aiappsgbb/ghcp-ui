import { useState } from "react";
import { X, Server, Plus, Trash2, Globe } from "lucide-react";

export interface McpServerEntry {
  name: string;
  type: "http" | "sse";
  url: string;
  headers?: Record<string, string>;
  tools: string[];
}

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mcpServers: McpServerEntry[];
  onUpdateMcpServers: (servers: McpServerEntry[]) => void;
  currentModel: string;
  workspacePath: string | null;
}

export function SettingsDrawer({
  isOpen,
  onClose,
  mcpServers,
  onUpdateMcpServers,
  currentModel,
  workspacePath,
}: SettingsDrawerProps) {
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");

  if (!isOpen) return null;

  const handleAddServer = () => {
    if (!newServerName.trim() || !newServerUrl.trim()) return;
    onUpdateMcpServers([
      ...mcpServers,
      {
        name: newServerName.trim(),
        type: "http",
        url: newServerUrl.trim(),
        tools: ["*"],
      },
    ]);
    setNewServerName("");
    setNewServerUrl("");
  };

  const handleRemoveServer = (index: number) => {
    onUpdateMcpServers(mcpServers.filter((_, i) => i !== index));
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-6">
          {/* Current session info */}
          <section>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Current Session</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Model</span>
                <span className="text-zinc-200 font-mono">{currentModel || "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Workspace</span>
                <span className="text-zinc-200 font-mono text-xs truncate max-w-[200px]">
                  {workspacePath || "Default"}
                </span>
              </div>
            </div>
          </section>

          {/* MCP Servers */}
          <section>
            <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <Server className="w-4 h-4" />
              MCP Servers
            </h3>
            <p className="text-xs text-zinc-600 mb-3">
              Connect remote MCP servers to extend Copilot with external tools (databases, APIs, etc.)
            </p>

            {mcpServers.length > 0 && (
              <div className="space-y-2 mb-4">
                {mcpServers.map((server, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800"
                  >
                    <Globe className="w-4 h-4 text-brand-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{server.name}</p>
                      <p className="text-[10px] text-zinc-600 truncate">{server.url}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveServer(i)}
                      className="p-1.5 rounded hover:bg-zinc-700 text-zinc-600 hover:text-red-400 min-w-[32px] min-h-[32px] flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Server name"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-brand-500"
              />
              <input
                type="url"
                placeholder="https://mcp-server.example.com"
                value={newServerUrl}
                onChange={(e) => setNewServerUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-brand-500"
              />
              <button
                onClick={handleAddServer}
                disabled={!newServerName.trim() || !newServerUrl.trim()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-brand-500 text-sm text-zinc-400 hover:text-white disabled:opacity-50 disabled:hover:border-zinc-700 disabled:hover:text-zinc-400 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add MCP Server
              </button>
            </div>
          </section>

          {/* Workspace info */}
          <section>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Workspace</h3>
            <p className="text-xs text-zinc-600 mb-3">
              Your personal workspace is backed by Azure Blob Storage.
              Files uploaded here are available to Copilot during sessions.
            </p>
            <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-500">
              Storage integration coming soon — upload files to give Copilot context about your projects.
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
