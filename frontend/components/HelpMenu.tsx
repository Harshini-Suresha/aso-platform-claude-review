"use client";

import { useEffect, useRef, useState } from "react";
import {
  HelpCircle,
  Search,
  Sparkles,
  Rocket,
  BookOpen,
  FlaskConical,
  Beaker,
  HelpCircle as FaqIcon,
  Keyboard,
  Bug,
  Mail,
  Ticket,
  ChevronRight,
} from "lucide-react";
import PlatformAssistant from "./PlatformAssistant";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

const LEARNING_CENTER = [
  { label: "Getting Started", icon: Rocket, href: "/help/tutorial" },
  { label: "RNA Therapeutics Guide", icon: BookOpen, href: "/help/rna-therapeutics-guide" },
  { label: "ASO Design Guidelines", icon: FlaskConical, href: "/help/aso-design-guidelines" },
  { label: "Supported Databases", icon: Beaker, href: "/help/supported-databases" },
  { label: "Experimental Protocols", icon: FlaskConical, href: "/help/experimental-protocols" },
  { label: "FAQ", icon: FaqIcon, href: "/help/faq" },
  { label: "Keyboard Shortcuts", icon: Keyboard, href: "/help/shortcuts" },
];

const RESOURCES = [
  { label: "Report a Bug", icon: Bug, href: "/help/report-bug" },
  { label: "My Tickets", icon: Ticket, href: "/help/report-bug" },
  { label: "Contact Support", icon: Mail, href: "mailto:mail@koshkey.com" },
];

export default function HelpMenu() {
  const [open, setOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useKeyboardShortcut("escape", () => setOpen(false), { enabled: open });
  useKeyboardShortcut("h", () => setOpen((o) => !o), { ctrl: true, shift: true });
  useKeyboardShortcut("p", () => setAssistantOpen((o) => !o), { ctrl: true, shift: true });

  const filteredLearning = searchQuery
    ? LEARNING_CENTER.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : LEARNING_CENTER;

  const filteredResources = searchQuery
    ? RESOURCES.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : RESOURCES;

  const hasResults =
    filteredLearning.length > 0 || filteredResources.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Help & Documentation"
        className="flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <HelpCircle className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 border border-[#E5E7EB] bg-white shadow-lg">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-[13px] font-semibold text-slate-800">Help Center</p>
          </div>

          {/* Search */}
          <div className="px-3 py-2.5 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation..."
                className="w-full rounded-lg border border-[#E5E7EB] bg-slate-50 py-1.5 pl-8 pr-3 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand/20"
              />
            </div>
          </div>

          <div className="p-1.5 max-h-[420px] overflow-y-auto">
            {/* Ask the Platform Assistant */}
            <button
              onClick={() => {
                setAssistantOpen(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 px-3 py-2.5 text-left text-[12px] font-medium text-slate-800 hover:from-indigo-100 hover:to-blue-100 transition-colors"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[12px]">Ask the Platform Assistant</p>
                <p className="text-[10.5px] text-slate-500 font-normal mt-0.5">Research assistant</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </button>

            {!hasResults && searchQuery && (
              <div className="px-3 py-6 text-center">
                <p className="text-[12px] text-slate-400">No results for &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}

            {/* Learning Center */}
            {filteredLearning.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Learning Center
                </p>
                {filteredLearning.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      className="flex items-center gap-2.5 rounded px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                    >
                      <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {item.label}
                    </a>
                  );
                })}
              </>
            )}

            {/* Resources */}
            {filteredResources.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Resources
                </p>
                {filteredResources.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      className="flex items-center gap-2.5 rounded px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                    >
                      <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {item.label}
                    </a>
                  );
                })}
              </>
            )}

          </div>
        </div>
      )}

      <PlatformAssistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
