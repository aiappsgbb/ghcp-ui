import { MessageSquare, Github } from "lucide-react";

interface HeaderProps {
  sessionModel: string | null;
  isConnected: boolean;
}

export function Header({ sessionModel, isConnected }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            GHCP
            <span className="text-brand-400 ml-1">UI</span>
          </h1>
        </div>
        <span className="text-xs text-zinc-500 hidden sm:inline">
          GitHub Copilot • Web
        </span>
      </div>

      <div className="flex items-center gap-4">
        {sessionModel && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {sessionModel}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-emerald-500" : "bg-zinc-600"
            }`}
          />
          <span className="text-xs text-zinc-500">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Github className="w-5 h-5" />
        </a>
      </div>
    </header>
  );
}
