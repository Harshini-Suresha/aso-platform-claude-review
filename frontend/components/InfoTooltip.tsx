"use client";

import { useState, useRef } from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  content: string;
  title?: string;
  className?: string;
  side?: "left" | "right" | "auto";
}

export default function InfoTooltip({ content, title, className = "", side = "auto" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const getPosition = () => {
    const btn = ref.current;
    if (!btn) return { left: 0, top: 0 };
    const rect = btn.getBoundingClientRect();
    const tooltipWidth = 270;

    if (side === "left") {
      return {
        left: rect.left - tooltipWidth + 8,
        top: rect.top + rect.height / 2 - 10,
      };
    }

    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;

    if (side === "auto" && spaceRight < tooltipWidth && spaceLeft > tooltipWidth) {
      return {
        left: rect.left - tooltipWidth + 8,
        top: rect.top + rect.height / 2 - 10,
      };
    }

    return {
      left: rect.right + 8,
      top: rect.top + rect.height / 2 - 10,
    };
  };

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={ref}
        type="button"
        className={`flex h-4 w-4 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-[7px] font-bold text-amber-700 opacity-80 transition-all hover:border-amber-400 hover:bg-amber-200 hover:text-amber-800 ${className}`}
        aria-label={title ?? content}
      >
        <Info className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div
          className="pointer-events-none fixed z-50 max-w-[260px] rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-[10.5px] text-amber-900 shadow-lg"
          style={getPosition()}
        >
          {title && <p className="mb-0.5 font-semibold">{title}</p>}
          <p className="leading-snug">{content}</p>
        </div>
      )}
    </span>
  );
}
