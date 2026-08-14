"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { askAssistant } from "@/lib/platformApi";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

interface Message {
  role: "user" | "assistant" | "error";
  content: string;
}

const SUGGESTIONS = [
  "Explain exon skipping",
  "What is a gapmer?",
  "Why would an ASO score low on specificity?",
  "Walk me through the platform workflow",
];

export default function PlatformAssistant({
  open,
  onClose,
  context,
}: {
  open: boolean;
  onClose: () => void;
  context?: Record<string, string>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useKeyboardShortcut("p", onClose, { ctrl: true, shift: true });

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await askAssistant(text, context);
      if (res.reply) {
        setMessages((m) => [...m, { role: "assistant", content: res.reply as string }]);
      } else {
        setMessages((m) => [...m, { role: "error", content: res.error ?? "Something went wrong." }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "error", content: "Could not reach the assistant service." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <div>
              <p className="text-[13.5px] font-semibold text-slate-800">Ask the Platform</p>
              <p className="text-[11px] text-slate-400">Grounded in this platform's own workflow</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-[12.5px] text-slate-500">Try asking:</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              {m.role === "error" ? (
                <div className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600 max-w-[85%]">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {m.content}
                </div>
              ) : (
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-brand text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {m.content}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-[12.5px] text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking...
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[#E5E7EB] p-4">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Ask about ASO design, mechanisms, or the workflow..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-[13px] placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
