import { User, Bot, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  return (
    <div
      className={`group flex gap-3 px-4 py-4 ${
        isUser ? "bg-transparent" : "bg-zinc-900/50"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
          isUser
            ? "bg-zinc-800 text-zinc-400"
            : "bg-brand-600/20 text-brand-400"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-zinc-500">
            {isUser ? "You" : "Copilot"}
          </span>
          <span className="text-xs text-zinc-700">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="prose-chat text-sm leading-relaxed text-zinc-200">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 self-start mt-1 p-1.5 rounded-md hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400 transition-all"
        title="Copy message"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
