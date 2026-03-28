import { useState, useEffect, useCallback } from "react";
import { X, Server, Plus, Trash2, Globe, Shield, Save, Loader2, ChevronDown } from "lucide-react";

export interface McpServerEntry {
  name: string;
  type: "http" | "sse";
  url: string;
  headers?: Record<string, string>;
  tools: string[];
}

interface GlobalMcpServer {
  name: string;
  type: string;
  url?: string;
}

interface UserMcpServer {
  name: string;
  type: string;
  url?: string;
  headers?: Record<string, string>;
  tools?: string[];
}

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mcpServers: McpServerEntry[];
  onUpdateMcpServers: (servers: McpServerEntry[]) => void;
  currentModel: string;
  onChangeModel: (model: string) => void;
  workspacePath: string | null;
}

export function SettingsDrawer({
  isOpen,
  onClose,
  currentModel,
  onChangeModel,
}: SettingsDrawerProps) {
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [newServerHeaderKey, setNewServerHeaderKey] = useState("");
  const [newServerHeaderVal, setNewServerHeaderVal] = useState("");
  const [globalServers, setGlobalServers] = useState<GlobalMcpServer[]>([]);
  const [userServers, setUserServers] = useState<UserMcpServer[]>([]);
  const [saving, setSaving] = useState(false);
  const [availableModels, setAvailableModels] = useState<{ id: string; label: string }[]>([]);

  const fetchServers = useCallback(() => {
    if (!isOpen) return;
    fetch("/api/mcp-servers")
      .then((r) => r.json())
      .then((data) => setGlobalServers(data.servers ?? []))
      .catch(() => {});
    fetch("/api/mcp-servers/user")
      .then((r) => r.json())
      .then((data) => setUserServers(data.servers ?? []))
      .catch(() => {});
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => setAvailableModels(data.models ?? []))
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  if (!isOpen) return null;

  const handleAddServer = async () => {
    if (!newServerName.trim() || !newServerUrl.trim()) return;
    setSaving(true);

    const headers: Record<string, string> = {};
    if (newServerHeaderKey.trim() && newServerHeaderVal.trim()) {
      headers[newServerHeaderKey.trim()] = newServerHeaderVal.trim();
    }

    // Build the full server config to save
    const currentServers = userServers.reduce<Record<string, unknown>>((acc, s) => {
      acc[s.name] = { type: s.type || "http", url: s.url, headers: s.headers, tools: s.tools || ["*"] };
      return acc;
    }, {});

    currentServers[newServerName.trim()] = {
      type: "http",
      url: newServerUrl.trim(),
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      tools: ["*"],
    };

    try {
      await fetch("/api/mcp-servers/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servers: currentServers }),
      });
      setNewServerName("");
      setNewServerUrl("");
      setNewServerHeaderKey("");
      setNewServerHeaderVal("");
      fetchServers();
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveServer = async (name: string) => {
    setSaving(true);
    try {
      await fetch(`/api/mcp-servers/user/${encodeURIComponent(name)}`, { method: "DELETE" });
      fetchServers();
    } finally {
      setSaving(false);
    }
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
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Model</h3>
            <div className="space-y-2">
              <div className="relative">
                <select
                  value={currentModel || ""}
                  onChange={(e) => onChangeModel(e.target.value)}
                  className="w-full appearance-none px-3 py-2.5 pr-8 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 font-mono outline-none focus:border-brand-500 cursor-pointer"
                >
                  {!currentModel && <option value="">No session</option>}
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                  {currentModel && !availableModels.find((m) => m.id === currentModel) && (
                    <option value={currentModel}>{currentModel}</option>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-xs text-zinc-600">
                Changing model starts a new chat session.
              </p>
            </div>
          </section>

          {/* MCP Servers */}
          <section>
            <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <Server className="w-4 h-4" />
              MCP Servers
            </h3>

            {/* Global servers (admin) */}
            {globalServers.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Admin (read-only)
                </p>
                <div className="space-y-2">
                  {globalServers.map((server) => (
                    <div
                      key={server.name}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-950/30 border border-brand-900/40"
                    >
                      <Globe className="w-4 h-4 text-brand-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 truncate">{server.name}</p>
                        <p className="text-[10px] text-zinc-600 truncate">
                          {server.type}{server.url ? ` • ${server.url}` : " • local"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User servers (persistent per-user) */}
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Save className="w-3 h-3" />
              Your Servers (persisted)
            </p>
            <p className="text-xs text-zinc-600 mb-3">
              These MCP servers are saved to your profile and used in all your sessions.
            </p>

            {userServers.length > 0 && (
              <div className="space-y-2 mb-4">
                {userServers.map((server) => (
                  <div
                    key={server.name}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800"
                  >
                    <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{server.name}</p>
                      <p className="text-[10px] text-zinc-600 truncate">
                        {server.type}{server.url ? ` • ${server.url}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveServer(server.name)}
                      disabled={saving}
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
                placeholder="Server name (e.g. tavily)"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-brand-500"
              />
              <input
                type="url"
                placeholder="URL (e.g. https://mcp.tavily.com/mcp)"
                value={newServerUrl}
                onChange={(e) => setNewServerUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-brand-500"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Header key (optional)"
                  value={newServerHeaderKey}
                  onChange={(e) => setNewServerHeaderKey(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-brand-500"
                />
                <input
                  type="password"
                  placeholder="Header value"
                  value={newServerHeaderVal}
                  onChange={(e) => setNewServerHeaderVal(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-brand-500"
                />
              </div>
              <button
                onClick={handleAddServer}
                disabled={!newServerName.trim() || !newServerUrl.trim() || saving}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-brand-500 text-sm text-zinc-400 hover:text-white disabled:opacity-50 disabled:hover:border-zinc-700 disabled:hover:text-zinc-400 transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add MCP Server
              </button>
            </div>
          </section>

          {/* Workspace info */}
          <section>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Workspace</h3>
            <p className="text-xs text-zinc-600 mb-3">
              Your personal workspace is backed by Azure Files.
              Files uploaded here are available to Copilot during sessions.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
