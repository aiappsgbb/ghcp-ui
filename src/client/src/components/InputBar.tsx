import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Send, Square, Loader2 } from "lucide-react";

interface InputBarProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export function InputBar({ onSend, onStop, isLoading, disabled }: InputBarProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 px-3 sm:px-4 py-3 safe-bottom">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 sm:px-4 py-2 focus-within:border-brand-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "Create a new chat to get started…"
                : "Message Copilot…"
            }
            disabled={disabled || isLoading}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm sm:text-base text-zinc-100 placeholder-zinc-600 outline-none py-1.5 max-h-[200px]"
          />

          {isLoading ? (
            <button
              onClick={onStop}
              className="p-2.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Stop generating"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || disabled}
              className="p-2.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500 disabled:bg-zinc-800 disabled:text-zinc-600 transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Send message"
            >
              {disabled ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        <p className="text-[10px] text-zinc-700 text-center mt-2">
          Powered by GitHub Copilot SDK • Azure AI Foundry
        </p>
      </div>
    </div>
  );
}
