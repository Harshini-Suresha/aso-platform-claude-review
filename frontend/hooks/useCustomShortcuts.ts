"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface CustomShortcut {
  id: string;
  label: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: string;
}

const STORAGE_KEY = "aso:custom-shortcuts";

const BUILT_IN_ACTIONS = [
  { id: "search", label: "Focus search" },
  { id: "help", label: "Toggle Help menu" },
  { id: "notifications", label: "Toggle Notifications" },
  { id: "account", label: "Toggle Account menu" },
  { id: "assistant", label: "Toggle Platform Assistant" },
  { id: "projects", label: "Go to Projects" },
  { id: "settings", label: "Go to Settings" },
  { id: "new-project", label: "Go to New Project" },
  { id: "mechanisms", label: "Go to Mechanisms" },
  { id: "upload-sequence", label: "Go to Upload Sequence" },
  { id: "dashboard", label: "Go to Dashboard" },
  { id: "targets", label: "Go to Target Discovery" },
  { id: "designs", label: "Go to ASO Design" },
  { id: "rna-engineering", label: "Go to RNA Engineering" },
  { id: "analysis", label: "Go to Computational Analysis" },
  { id: "validation", label: "Go to Experimental Validation" },
  { id: "reports", label: "Go to Reports" },
];

export function getBuiltInActions() {
  return BUILT_IN_ACTIONS;
}

function loadShortcuts(): CustomShortcut[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function saveShortcuts(shortcuts: CustomShortcut[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
}

export function useCustomShortcuts() {
  const [shortcuts, setShortcuts] = useState<CustomShortcut[]>(loadShortcuts);
  const [recording, setRecording] = useState<string | null>(null);
  const recordingRef = useRef<string | null>(null);

  useEffect(() => {
    saveShortcuts(shortcuts);
  }, [shortcuts]);

  const addShortcut = useCallback((shortcut: Omit<CustomShortcut, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    setShortcuts((s) => [...s, { ...shortcut, id }]);
  }, []);

  const removeShortcut = useCallback((id: string) => {
    setShortcuts((s) => s.filter((x) => x.id !== id));
  }, []);

  const startRecording = useCallback((id: string) => {
    setRecording(id);
    recordingRef.current = id;
  }, []);

  const stopRecording = useCallback(() => {
    setRecording(null);
    recordingRef.current = null;
  }, []);

  const recordKey = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      if (!["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      }

      if (parts.length === 0) return;

      const combo = parts.join(" + ");

      setShortcuts((s) =>
        s.map((x) =>
          x.id === recordingRef.current
            ? {
                ...x,
                key: e.key.length === 1 ? e.key.toUpperCase() : e.key,
                ctrl: e.ctrlKey || e.metaKey,
                shift: e.shiftKey,
                alt: e.altKey,
              }
            : x
        )
      );

      stopRecording();
    },
    [stopRecording]
  );

  useEffect(() => {
    if (!recording) return;
    window.addEventListener("keydown", recordKey, true);
    return () => window.removeEventListener("keydown", recordKey, true);
  }, [recording, recordKey]);

  return {
    shortcuts,
    addShortcut,
    removeShortcut,
    recording,
    startRecording,
    stopRecording,
  };
}
