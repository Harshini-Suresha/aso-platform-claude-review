"use client";

import { useState } from "react";
import { LucideIcon } from "lucide-react";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-[#E5E7EB] dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  step,
  title,
  right,
}: {
  step?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-3">
      <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-200">
        {step ? `${step}. ${title}` : title}
      </h2>
      {right}
    </div>
  );
}

export function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
      {children}
      {hint && (
        <span className="relative inline-flex">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            onBlur={() => setOpen(false)}
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-300 text-[9px] text-slate-400 hover:border-slate-400 hover:text-slate-600"
          >
            ?
          </button>
          {open && (
            <span className="absolute left-5 top-0 z-20 mt-0 w-56 rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-600 shadow-md">
              {hint}
            </span>
          )}
        </span>
      )}
    </label>
  );
}

export function InfoField({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`mt-0.5 break-words text-[12.5px] font-medium leading-relaxed text-slate-800 ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

export function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "blue" | "purple" | "indigo" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function DataRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <span className="shrink-0 text-[11px] text-slate-500">{label}</span>
      <span className={`min-w-0 break-words text-right text-[11px] font-medium ${highlight ? "text-emerald-600" : "text-slate-700"}`}>
        {value}
      </span>
    </div>
  );
}

export function MiniCardHeader({
  icon: Icon,
  iconBg,
  iconColor,
  title,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-100">
      <span
        className="flex h-5 w-5 items-center justify-center rounded"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="h-3 w-3" style={{ color: iconColor }} />
      </span>
      <p className="text-[11.5px] font-semibold text-slate-700">{title}</p>
    </div>
  );
}
