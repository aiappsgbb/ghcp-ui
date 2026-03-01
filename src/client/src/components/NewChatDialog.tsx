import { useState } from "react";
import { X, Sparkles } from "lucide-react";

const AVAILABLE_MODELS = [
  { id: "gpt-4.1", label: "GPT-4.1", description: "Fast and capable" },
  { id: "gpt-5", label: "GPT-5", description: "Most advanced" },
  { id: "claude-sonnet-4.5", label: "Claude Sonnet 4.5", description: "Balanced" },
  { id: "claude-opus-4.5", label: "Claude Opus 4.5", description: "Highest quality" },
];

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSession: (model: string) => void;
  defaultModel: string;
}

export function NewChatDialog({
  isOpen,
  onClose,
  onCreateSession,
  defaultModel,
}: NewChatDialogProps) {
  const [selectedModel, setSelectedModel] = useState(defaultModel);

  if (!isOpen) return null;

  const handleCreate = () => {
    onCreateSession(selectedModel);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-400" />
              <h2 className="text-base font-semibold">New Chat</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 min-w-[40px] min-h-[40px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4">
            <label className="text-sm font-medium text-zinc-400 block mb-3">
              Choose a model
            </label>
            <div className="space-y-1.5">
              {AVAILABLE_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                    selectedModel === model.id
                      ? "border-brand-500 bg-brand-600/10 text-white"
                      : "border-zinc-700 hover:border-zinc-600 text-zinc-300"
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                      selectedModel === model.id
                        ? "border-brand-500 bg-brand-500"
                        : "border-zinc-600"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium">{model.label}</p>
                    <p className="text-xs text-zinc-500">{model.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 py-4 border-t border-zinc-800 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-sm text-white font-medium transition-colors"
            >
              Start Chat
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
