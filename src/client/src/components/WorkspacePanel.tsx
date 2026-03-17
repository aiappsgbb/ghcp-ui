import { useState, useEffect, useCallback, useRef } from "react";
import {
  FolderOpen,
  FolderPlus,
  Upload,
  Trash2,
  Download,
  File,
  Folder,
  X,
  RefreshCw,
  ChevronRight,
  Check,
} from "lucide-react";

interface WorkspaceFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  isDirectory?: boolean;
}

interface WorkspacePanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  activeFolder: string;
  onFolderChange: (folder: string) => void;
}

const API_BASE = "/api";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function WorkspacePanel({
  isOpen,
  onClose,
  sessionId,
  activeFolder,
  onFolderChange,
}: WorkspacePanelProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newFolderRef = useRef<HTMLInputElement>(null);

  const userId = "default";

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/workspace/${userId}/folders`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders ?? []);
      }
    } catch {
      // silent
    }
  }, [userId]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const dirPath = activeFolder ? activeFolder : "";
      const res = await fetch(
        `${API_BASE}/workspace/${userId}/files?path=${encodeURIComponent(dirPath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId, activeFolder]);

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      fetchFiles();
    }
  }, [isOpen, fetchFolders, fetchFiles]);

  useEffect(() => {
    if (showNewFolder) newFolderRef.current?.focus();
  }, [showNewFolder]);

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await fetch(`${API_BASE}/workspace/${userId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setNewFolderName("");
      setShowNewFolder(false);
      await fetchFolders();
      onFolderChange(name);
    } catch {
      // silent
    }
  }, [userId, newFolderName, fetchFolders, onFolderChange]);

  const handleDeleteFolder = useCallback(
    async (folderName: string) => {
      if (!confirm(`Delete folder "${folderName}" and all its contents?`)) return;
      try {
        await fetch(`${API_BASE}/workspace/${userId}/folders/${encodeURIComponent(folderName)}`, {
          method: "DELETE",
        });
        if (activeFolder === folderName) onFolderChange("");
        await fetchFolders();
        await fetchFiles();
      } catch {
        // silent
      }
    },
    [userId, activeFolder, onFolderChange, fetchFolders, fetchFiles]
  );

  const handleUpload = useCallback(
    async (fileList: FileList) => {
      setUploading(true);
      try {
        for (const file of Array.from(fileList)) {
          const form = new FormData();
          form.append("file", file);
          const targetPath = activeFolder
            ? `${activeFolder}/${file.name}`
            : file.name;
          form.append("path", targetPath);
          await fetch(`${API_BASE}/workspace/${userId}/files`, {
            method: "POST",
            body: form,
          });
        }
        await fetchFiles();
      } catch {
        // silent
      } finally {
        setUploading(false);
      }
    },
    [userId, activeFolder, fetchFiles]
  );

  const handleDelete = useCallback(
    async (filePath: string) => {
      try {
        await fetch(
          `${API_BASE}/workspace/${userId}/files/${encodeURIComponent(filePath)}`,
          { method: "DELETE" }
        );
        setFiles((prev) => prev.filter((f) => f.path !== filePath));
      } catch {
        // silent
      }
    },
    [userId]
  );

  const handleDownload = useCallback(
    (filePath: string) => {
      window.open(
        `${API_BASE}/workspace/${userId}/files/${encodeURIComponent(filePath)}`,
        "_blank"
      );
    },
    [userId]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
    },
    [handleUpload]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-80 sm:w-96 h-full bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)] flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
            <FolderOpen size={18} />
            <span className="font-semibold text-sm">Workspace</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewFolder(true)}
              className="p-2 rounded-lg hover:bg-white/5 text-[var(--color-text-secondary)] min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="New folder"
            >
              <FolderPlus size={16} />
            </button>
            <button
              onClick={() => { fetchFolders(); fetchFiles(); }}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-white/5 text-[var(--color-text-secondary)] min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-[var(--color-text-secondary)] min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Folder switcher */}
        <div className="px-3 pt-3">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 px-1">
            Folders
          </p>

          {/* New folder input */}
          {showNewFolder && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <input
                ref={newFolderRef}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") {
                    setShowNewFolder(false);
                    setNewFolderName("");
                  }
                }}
                placeholder="Folder name…"
                className="flex-1 bg-white/5 border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)]"
                style={{ fontSize: "16px" }}
              />
              <button
                onClick={handleCreateFolder}
                className="p-1.5 rounded hover:bg-white/10 text-green-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
                className="p-1.5 rounded hover:bg-white/10 text-[var(--color-text-secondary)] min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Root folder option */}
          <button
            onClick={() => onFolderChange("")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeFolder === ""
                ? "bg-[var(--color-brand)]/15 text-[var(--color-brand)]"
                : "text-[var(--color-text-secondary)] hover:bg-white/5"
            }`}
          >
            <FolderOpen size={14} />
            <span className="truncate">Root</span>
          </button>

          {/* User folders */}
          {folders.map((f) => (
            <div
              key={f}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                activeFolder === f
                  ? "bg-[var(--color-brand)]/15 text-[var(--color-brand)]"
                  : "text-[var(--color-text-secondary)] hover:bg-white/5"
              }`}
              onClick={() => onFolderChange(f)}
            >
              <Folder size={14} className="shrink-0" />
              <span className="flex-1 truncate">{f}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(f);
                }}
                className="p-1 rounded hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity"
                title="Delete folder"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <hr className="mx-3 mt-2 border-[var(--color-border)]" />

        {/* Upload zone */}
        <div
          className={`mx-3 mt-3 border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
            dragOver
              ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10"
              : "border-[var(--color-border)] hover:border-[var(--color-text-secondary)]"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload
            size={20}
            className="mx-auto mb-1 text-[var(--color-text-secondary)]"
          />
          <p className="text-xs text-[var(--color-text-secondary)]">
            {uploading
              ? "Uploading…"
              : `Drop files here${activeFolder ? ` → ${activeFolder}` : ""}`}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Session context */}
        {sessionId && (
          <div className="mx-3 mt-2 px-3 py-2 bg-white/5 rounded-lg flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <ChevronRight size={12} />
            <span>
              {activeFolder
                ? `Folder "${activeFolder}" is mounted in the current session.`
                : "Root workspace is mounted in the current session."}
            </span>
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto mt-2 px-3 pb-3">
          {loading && files.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)] text-sm">
              Loading…
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)] text-sm">
              No files yet. Upload files to give the AI access to your
              workspace.
            </div>
          ) : (
            <ul className="space-y-1">
              {files
                .filter((f) => !f.isDirectory)
                .map((f) => (
                <li
                  key={f.path}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <File
                    size={14}
                    className="shrink-0 text-[var(--color-text-secondary)]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text-primary)] truncate">
                      {f.name}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">
                      {formatBytes(f.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownload(f.path)}
                    className="p-1.5 rounded hover:bg-white/10 text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Download"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(f.path)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
