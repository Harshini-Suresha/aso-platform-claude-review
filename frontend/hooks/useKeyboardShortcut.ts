"use client";

import { useEffect, useCallback } from "react";

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options?: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean; preventDefault?: boolean; enabled?: boolean }
) {
  const { ctrl = false, shift = false, alt = false, meta = false, preventDefault = true, enabled = true } = options ?? {};

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;

      const modMatch =
        (ctrl && (e.ctrlKey || e.metaKey)) ||
        (!ctrl && meta && e.metaKey) ||
        (!ctrl && !meta && !e.ctrlKey && !e.metaKey);
      if (!modMatch) return;

      if (shift && !e.shiftKey) return;
      if (alt && !e.altKey) return;

      if (preventDefault) e.preventDefault();
      callback();
    },
    [key, callback, ctrl, shift, alt, meta, preventDefault, enabled]
  );

  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);
}
