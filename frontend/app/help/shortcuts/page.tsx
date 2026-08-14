"use client";

import { useState, useCallback } from "react";
import { Trash2, Plus, Keyboard } from "lucide-react";
import HelpPageShell from "@/components/HelpPageShell";
import { Card } from "@/components/ui";
import { useCustomShortcuts, getBuiltInActions } from "@/hooks/useCustomShortcuts";

const PREDEFINED_ACTIONS = getBuiltInActions();

interface ShortcutItem {
  keys: string;
  context?: string;
  action: string;
}

interface ShortcutGroup {
  section: string;
  items: ShortcutItem[];
}

function formatCombo(s: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }) {
  const parts: string[] = [];
  if (s.ctrl) parts.push("Ctrl");
  if (s.shift) parts.push("Shift");
  if (s.alt) parts.push("Alt");
  if (s.meta) parts.push("Cmd");
  parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key);
  return parts.join(" + ");
}

export default function ShortcutsPage() {
  const { shortcuts, addShortcut, removeShortcut, startRecording, stopRecording } = useCustomShortcuts();
  const [newLabel, setNewLabel] = useState("");
  const [newAction, setNewAction] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newCtrl, setNewCtrl] = useState(false);
  const [newShift, setNewShift] = useState(false);
  const [newAlt, setNewAlt] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const handleRecord = useCallback(() => {
    if (isRecording) {
      stopRecording();
      setIsRecording(false);
    } else {
      startRecording("__new__");
      setIsRecording(true);
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleAdd = useCallback(() => {
    if (!newLabel.trim() || !newAction || !newKey.trim()) return;
    addShortcut({
      label: newLabel.trim(),
      action: newAction,
      key: newKey.trim(),
      ctrl: newCtrl,
      shift: newShift,
      alt: newAlt,
    });
    setNewLabel("");
    setNewAction("");
    setNewKey("");
    setNewCtrl(false);
    setNewShift(false);
    setNewAlt(false);
  }, [newLabel, newAction, newKey, newCtrl, newShift, newAlt, addShortcut]);

  const BUILT_IN: ShortcutGroup[] = [
    {
      section: "Global",
      items: [
        { keys: "Ctrl + K", action: "Focus search input" },
        { keys: "Ctrl + Shift + H", action: "Toggle Help menu" },
        { keys: "Ctrl + Shift + N", action: "Toggle Notifications panel" },
        { keys: "Ctrl + Shift + A", action: "Toggle Account menu" },
        { keys: "Ctrl + Shift + P", action: "Toggle Platform Assistant" },
      ],
    },
    {
      section: "Navigation",
      items: [
        { keys: "Alt + 1", action: "Go to New Project" },
        { keys: "Alt + 2", action: "Go to Target Discovery" },
        { keys: "Alt + 3", action: "Go to ASO Design" },
        { keys: "Alt + 4", action: "Go to RNA Engineering" },
        { keys: "Alt + 5", action: "Go to Computational Analysis" },
        { keys: "Alt + 6", action: "Go to Experimental Validation" },
        { keys: "Alt + 7", action: "Go to Reports" },
        { keys: "Alt + P", action: "Go to Projects" },
        { keys: "Alt + U", action: "Go to Upload Sequence" },
        { keys: "Alt + S", action: "Go to Settings" },
      ],
    },
    {
      section: "Forms & Inputs",
      items: [
        { keys: "Enter", context: "Gene Symbol field", action: "Submit and load the gene" },
        { keys: "Enter", context: "Disease Search field", action: "Submit disease search" },
        { keys: "Enter", context: "Platform Assistant input", action: "Send message" },
        { keys: "Enter", context: "Help Assistant input", action: "Ask question" },
        { keys: "Ctrl + Enter", context: "Mechanisms page", action: "Rank mechanisms" },
        { keys: "Ctrl + S", context: "Settings page", action: "Save profile changes" },
      ],
    },
    {
      section: "Wizards & Steps",
      items: [
        { keys: "Alt + →", context: "New Project wizard", action: "Next step" },
        { keys: "Alt + ←", context: "New Project wizard", action: "Previous step" },
      ],
    },
    {
      section: "Mechanisms",
      items: [
        { keys: "1 – 9", context: "Therapeutic Goal selection", action: "Select goal by number" },
      ],
    },
    {
      section: "Close / Back",
      items: [
        { keys: "Esc", context: "Platform Assistant panel", action: "Close the panel" },
        { keys: "Esc", context: "Notifications panel", action: "Close the panel" },
        { keys: "Esc", context: "Help menu", action: "Close the menu" },
        { keys: "Esc", context: "Account menu", action: "Close the menu" },
        { keys: "Esc", context: "Help Assistant panel", action: "Close the panel" },
        { keys: "Esc", context: "Export menu", action: "Close the menu" },
        { keys: "Esc", context: "Candidate inspector modal", action: "Close the modal" },
        { keys: "Esc", context: "ASO Design Pipeline", action: "Go back" },
      ],
    },
  ];

  return (
    <HelpPageShell title="Keyboard Shortcuts">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Keyboard className="h-4 w-4 text-brand shrink-0" />
          <p className="text-[13px] font-semibold text-slate-800">Custom Shortcuts</p>
        </div>
        <p className="text-[12px] text-slate-500 mb-4">
          Add your own keyboard shortcuts. Choose an action, then press the key combination you want to assign.
        </p>

        <div className="space-y-3 mb-6">
          {shortcuts.length === 0 && (
            <p className="text-[12px] text-slate-400 italic">No custom shortcuts yet.</p>
          )}
          {shortcuts.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-slate-700 truncate">{s.label}</p>
                <p className="text-[11px] text-slate-400">{s.action}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-[11px] font-medium text-slate-700 shadow-sm">
                  {formatCombo(s)}
                </span>
                <button
                  onClick={() => removeShortcut(s.id)}
                  className="rounded p-1 text-slate-400 hover:text-red-600 transition-colors"
                  aria-label="Remove shortcut"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[12px] font-semibold text-slate-700 mb-3">Add new shortcut</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Shortcut name"
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <select
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">Select action</option>
              {PREDEFINED_ACTIONS.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRecord}
                className={`h-9 rounded-lg border px-3 text-[12px] font-medium transition-colors ${
                  isRecording ? "border-red-300 bg-red-50 text-red-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {isRecording ? "Press keys..." : "Record key"}
              </button>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Key"
                readOnly={isRecording}
                className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <input type="checkbox" checked={newCtrl} onChange={(e) => setNewCtrl(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand" />
                Ctrl
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <input type="checkbox" checked={newShift} onChange={(e) => setNewShift(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand" />
                Shift
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <input type="checkbox" checked={newAlt} onChange={(e) => setNewAlt(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand" />
                Alt
              </label>
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!newLabel.trim() || !newAction || !newKey.trim()}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[12px] font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add shortcut
          </button>
        </div>
      </Card>

      <Card className="p-5 mt-5">
        <div className="space-y-5">
          {BUILT_IN.map((group) => (
            <div key={group.section}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">{group.section}</p>
              <div className="space-y-0">
                {group.items.map((s, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-[13px] font-medium text-slate-700">{s.action}</p>
                      {s.context && <p className="text-[12px] text-slate-400">{s.context}</p>}
                    </div>
                    <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-[12px] font-medium text-slate-700 shadow-sm">{s.keys}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </HelpPageShell>
  );
}
