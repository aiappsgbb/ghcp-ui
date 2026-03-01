import { useState, useEffect, useCallback, useRef } from "react";
import {
  FolderOpen,
  Upload,
  Trash2,
  Download,
  File,
  X,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

interface WorkspaceFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
}

interface WorkspacePanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
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
}: WorkspacePanelProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = "default";

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/workspace/${userId}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) fetchFiles();
  }, [isOpen, fetchFiles]);

  const handleUpload = useCallback(
    async (fileList: FileList) => {
      setUploading(true);
      try {
        for (const file of Array.from(fileList)) {
          const form = new FormData();
          form.append("file", file);
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
    [userId, fetchFiles]
  );

  const handleDelete = useCallback(
    async (path: string) => {
      try {
        await fetch(`${API_BASE}/workspace/${userId}/files/${path}`, {
          method: "DELETE",
        });
        setFiles((prev) => prev.filter((f) => f.path !== path));
      } catch {
        // silent
      }
    },
    [userId]
  );

  const handleDownload = useCallback(
    (path: string) => {
      window.open(`${API_BASE}/workspace/${userId}/files/${path}`, "_blank");
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
            <span className="font-semibold text-sm">Workspace Files</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchFiles}
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
              : "Drop files here or tap to upload"}
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
              Workspace is mounted in current session. AI can read/write these
              files.
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
              {files.map((f) => (
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
