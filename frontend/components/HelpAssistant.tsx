"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  BookOpen,
  Play,
  FileText,
  Code,
  Tag,
  Bug,
  MessageCircle,
  Sparkles,
  X,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

const DOC_ITEMS = [
  { label: "Getting Started", icon: BookOpen, href: "#" },
  { label: "Platform Tutorial", icon: BookOpen, href: "#" },
  { label: "RNA Therapeutics Guide", icon: BookOpen, href: "#" },
  { label: "ASO Design Guidelines", icon: BookOpen, href: "#" },
  { label: "Supported Databases", icon: BookOpen, href: "#" },
  { label: "Experimental Protocols", icon: BookOpen, href: "#" },
  { label: "FAQ", icon: MessageCircle, href: "#" },
  { label: "Keyboard Shortcuts", icon: BookOpen, href: "#" },
];

const QUICK_LINKS = [
  { label: "Video Tutorials", icon: Play, href: "#" },
  { label: "Documentation", icon: FileText, href: "#" },
  { label: "API Documentation", icon: Code, href: "#" },
  { label: "Release Notes", icon: Tag, href: "#" },
  { label: "Report a Bug", icon: Bug, href: "#" },
  { label: "Contact Support", icon: MessageCircle, href: "#" },
];

const ASSISTANT_SUGGESTIONS = [
  "Explain exon skipping",
  "What is a gapmer?",
  "Why is my ASO score low?",
  "Show the workflow",
];

export default function HelpAssistant({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [assistantQuery, setAssistantQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useKeyboardShortcut("escape", onClose);

  const filteredDocs = DOC_ITEMS.filter((item) => {
    return item.label.toLowerCase().includes(search.toLowerCase());
  });

  function handleAsk() {
    if (!assistantQuery.trim()) return;
    setAiLoading(true);
    setAiResponse(null);
    setTimeout(() => {
      setAiResponse(
        `Based on your question about "${assistantQuery}": This is a placeholder response. The platform assistant will provide detailed explanations about RNA therapeutics, ASO design, and platform usage when connected to a backend.`
      );
      setAiLoading(false);
    }, 1200);
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[420px] max-h-[80vh] rounded-xl border border-[#E5E7EB] bg-white shadow-xl z-50 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-[13px] font-semibold text-slate-800">Research Assistant</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documentation..."
            className="w-full rounded-lg border border-[#E5E7EB] bg-slate-50 pl-8 pr-3 py-2 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Help Center docs */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Help Center</p>
          <div className="space-y-0.5">
            {filteredDocs.map((item, i) => {
              const Icon = item.icon;
              return (
                <a
                  key={i}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Resources</p>
        <div className="grid grid-cols-2 gap-1">
          {QUICK_LINKS.map((item, i) => {
            const Icon = item.icon;
            return (
              <a
                key={i}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                <Icon className="h-3 w-3 text-slate-400 shrink-0" />
                <span>{item.label}</span>
                <ExternalLink className="h-2.5 w-2.5 text-slate-300 ml-auto" />
              </a>
            );
          })}
        </div>
      </div>

      {/* Assistant */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-brand" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ask the Platform Assistant</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={assistantQuery}
            onChange={(e) => setAssistantQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask anything about RNA therapeutics..."
            className="flex-1 rounded-lg border border-[#E5E7EB] bg-slate-50 px-3 py-2 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
          />
          <button
            onClick={handleAsk}
            disabled={aiLoading || !assistantQuery.trim()}
            className="rounded-lg bg-brand px-3 py-2 text-[11px] font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition-colors"
          >
            {aiLoading ? "..." : "Ask"}
          </button>
        </div>

        {/* Assistant suggestions */}
        {!aiResponse && !aiLoading && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ASSISTANT_SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => setAssistantQuery(s)}
                className="rounded-full border border-[#E5E7EB] bg-slate-50 px-2.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Assistant response */}
        {aiLoading && (
          <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <div className="h-3 w-3 rounded-full border-2 border-brand border-t-transparent animate-spin" />
              Thinking...
            </div>
          </div>
        )}
        {aiResponse && (
          <div className="mt-2 rounded-lg bg-brand/5 border border-brand/20 px-3 py-2.5">
            <p className="text-[11px] text-slate-600 leading-relaxed">{aiResponse}</p>
            <button
              onClick={() => { setAiResponse(null); setAssistantQuery(""); }}
              className="mt-1.5 text-[10px] font-medium text-brand hover:underline"
            >
              Ask another question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
