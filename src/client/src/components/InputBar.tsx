import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Send, Square, Loader2, Mic, MicOff } from "lucide-react";
import { useSpeechToText } from "../hooks/useSpeechToText";

interface InputBarProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export function InputBar({ onSend, onStop, isLoading, disabled }: InputBarProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSttResult = useCallback((transcript: string) => {
    setInput(transcript);
  }, []);

  const {
    isListening,
    interimTranscript,
    isSupported: sttSupported,
    toggleListening,
    stopListening,
    error: sttError,
  } = useSpeechToText({ onResult: handleSttResult });

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
  }, [input, interimTranscript]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;
    stopListening();
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

  const displayValue = interimTranscript
    ? `${input}${input ? " " : ""}${interimTranscript}`
    : input;

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 px-3 sm:px-4 py-3 safe-bottom">
      <div className="max-w-3xl mx-auto">
        {/* STT error banner */}
        {sttError && (
          <p className="text-xs text-red-400 mb-1.5 px-1">{sttError}</p>
        )}

        <div
          className={`flex items-end gap-2 rounded-xl border bg-zinc-900 px-3 sm:px-4 py-2 transition-colors ${
            isListening
              ? "border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
              : "border-zinc-700 focus-within:border-brand-500"
          }`}
        >
          <textarea
            ref={textareaRef}
            value={displayValue}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "Create a new chat to get started…"
                : isListening
                  ? "Listening… speak now"
                  : "Message Copilot…"
            }
            disabled={disabled || isLoading}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm sm:text-base text-zinc-100 placeholder-zinc-600 outline-none py-1.5 max-h-[200px]"
          />

          {/* Mic button — only shown if browser supports Web Speech API */}
          {sttSupported && !isLoading && (
            <button
              onClick={toggleListening}
              disabled={disabled}
              className={`p-2.5 rounded-lg transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center ${
                isListening
                  ? "bg-red-600/20 text-red-400 hover:bg-red-600/30 animate-pulse"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:text-zinc-700"
              }`}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}

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
