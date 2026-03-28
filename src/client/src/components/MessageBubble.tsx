import { User, Bot, Copy, Check } from "lucide-react";
import { useState, useCallback, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../types";

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-md hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all min-w-[32px] min-h-[32px] flex items-center justify-center ${className}`}
      title="Copy"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function CodeBlock({ children, className }: { children?: ReactNode; className?: string }) {
  const codeText = extractText(children);
  const lang = className?.replace("language-", "") ?? "";

  return (
    <div className="relative group/code my-3">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800 rounded-t-lg border border-b-0 border-zinc-700">
        <span className="text-[10px] font-mono text-zinc-500 uppercase">{lang || "code"}</span>
        <CopyButton text={codeText} className="opacity-60 group-hover/code:opacity-100" />
      </div>
      <pre className="!mt-0 !rounded-t-none">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`group flex gap-3 px-3 sm:px-4 py-4 ${
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

        <div className="prose-chat text-sm leading-relaxed text-zinc-200 break-words">
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a({ href, children }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
                    >
                      {children}
                    </a>
                  );
                },
                code({ className, children, node, ...props }) {
                  // Detect block code: has language class OR parent is <pre>
                  const isBlock = className?.startsWith("language-") ||
                    node?.position?.start.line !== node?.position?.end.line;
                  if (isBlock) {
                    return <CodeBlock className={className}>{children}</CodeBlock>;
                  }
                  return <code className={className} {...props}>{children}</code>;
                },
                pre({ children }) {
                  // Let CodeBlock handle the wrapping
                  return <>{children}</>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>

      <CopyButton
        text={message.content}
        className="opacity-0 group-hover:opacity-100 group-active:opacity-100 self-start mt-1"
      />
    </div>
  );
}
