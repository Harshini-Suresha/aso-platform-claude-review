"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCustomShortcuts, type CustomShortcut } from "@/hooks/useCustomShortcuts";

export default function CustomShortcutManager() {
  const { shortcuts } = useCustomShortcuts();
  const router = useRouter();

  const executeAction = useCallback(
    (action: string) => {
      switch (action) {
        case "search":
          document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="Search"]')?.focus();
          break;
        case "help":
          document.querySelector<HTMLButtonElement>('[aria-label="Help & Documentation"]')?.click();
          break;
        case "notifications":
          document.querySelector<HTMLButtonElement>('[aria-label="Notifications"]')?.click();
          break;
        case "account":
          document.querySelector<HTMLButtonElement>('[aria-label="Account"]')?.click();
          break;
        case "assistant":
          document.querySelector<HTMLButtonElement>('[aria-label="Help & Documentation"]')?.click();
          setTimeout(() => {
            document.querySelector<HTMLButtonElement>('[aria-label="Ask the Platform Assistant"]')?.click();
          }, 100);
          break;
        case "projects":
          router.push("/projects");
          break;
        case "settings":
          router.push("/settings");
          break;
        case "new-project":
          router.push("/new-project");
          break;
        case "mechanisms":
          router.push("/mechanisms");
          break;
        case "upload-sequence":
          router.push("/upload-sequence");
          break;
        case "dashboard":
          router.push("/dashboard");
          break;
        case "targets":
          router.push("/targets");
          break;
        case "designs":
          router.push("/designs");
          break;
        case "rna-engineering":
          router.push("/rna-engineering");
          break;
        case "analysis":
          router.push("/analysis");
          break;
        case "validation":
          router.push("/validation");
          break;
        case "reports":
          router.push("/reports");
          break;
        default:
          break;
      }
    },
    [router]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const match = shortcuts.find((s: CustomShortcut) => {
        const modMatch =
          (s.ctrl && (e.ctrlKey || e.metaKey)) ||
          (!s.ctrl && !e.ctrlKey && !e.metaKey);
        if (!modMatch) return false;
        if (s.shift && !e.shiftKey) return false;
        if (s.alt && !e.altKey) return false;
        if (!s.shift && e.shiftKey) return false;
        if (!s.alt && e.altKey) return false;
        return e.key.toLowerCase() === s.key.toLowerCase();
      });

      if (match) {
        e.preventDefault();
        executeAction(match.action);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, executeAction]);

  return null;
}
