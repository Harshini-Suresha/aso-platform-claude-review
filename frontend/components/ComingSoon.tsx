"use client";

import { useState } from "react";
import {
  Bell,
  CheckCircle,
  Clock,
  Layers,
  Loader2,
  Send,
  type LucideIcon,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export interface RoadmapStage {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  status: "live" | "in-progress" | "planned";
}

export interface FeatureItem {
  title: string;
  icon: LucideIcon;
  note?: string;
}

interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  roadmap: RoadmapStage[];
  features: FeatureItem[];
}

const STATUS_LABELS: Record<string, string> = {
  live: "Live",
  "in-progress": "In progress",
  planned: "Planned",
};

const STATUS_COLORS: Record<string, string> = {
  live: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  "in-progress":
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  planned:
    "bg-slate-100 text-slate-600 border-[#E5E7EB] dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export default function ComingSoon({
  title,
  description,
  icon: Icon,
  badge,
  roadmap,
  features,
}: ComingSoonProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleNotify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError("");
    setTimeout(() => {
      try {
        const stored = JSON.parse(
          localStorage.getItem("aso:comingSoonSubs") || "[]",
        );
        stored.push({ email: trimmed, page: title, ts: Date.now() });
        localStorage.setItem("aso:comingSoonSubs", JSON.stringify(stored));
      } catch {}
      setSubmitting(false);
      setSubmitted(true);
    }, 700);
  }

  const currentStep = roadmap.findIndex((s) => s.status === "in-progress");
  const activeIndex = currentStep >= 0 ? currentStep : 0;
  const progress = ((activeIndex + 1) / roadmap.length) * 100;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-[#0f172a]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1">
          <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
            {/* Hero */}
            <section className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/10 ring-1 ring-brand/20">
                <Icon className="h-9 w-9 text-brand" />
              </div>

              {badge && (
                <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  {badge}
                </div>
              )}

              <h1 className="text-[28px] font-extrabold tracking-tight text-[#0F172A] dark:text-slate-100 sm:text-[34px]">
                {title}
              </h1>
              <p className="mx-auto mt-2.5 max-w-2xl text-[13px] leading-relaxed text-[#64748B] dark:text-slate-400">
                {description}
              </p>
            </section>

            {/* Roadmap progress */}
            <section className="mt-10">
              <ul className="relative flex justify-between">
                <div className="absolute left-0 right-0 top-5 h-1.5 -translate-y-1/2 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div
                  className="absolute left-0 top-5 h-1.5 -translate-y-1/2 rounded-full bg-brand"
                  style={{ width: `${progress}%` }}
                />
                {roadmap.map((stage, idx) => {
                  const StageIcon = stage.icon;
                  const isActive = idx === activeIndex;
                  const isDone = idx < activeIndex;
                  const isCurrent = stage.status === "in-progress";
                  const activeCls = isDone
                    ? "bg-emerald-100 ring-2 ring-emerald-200 border-emerald-300 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-800"
                    : isActive
                      ? "bg-brand ring-2 ring-brand/30 border-brand text-white"
                      : "bg-white dark:bg-slate-800 border-[#E5E7EB] text-slate-400";
                  return (
                    <li key={stage.id} className="flex flex-col items-center">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${activeCls}`}
                      >
                        {isDone ? (
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <StageIcon className="h-5 w-5" />
                        )}
                      </div>
                      <span
                        className={`mt-2 max-w-[110px] text-center text-[11px] font-medium ${
                          isCurrent
                            ? "text-brand"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {stage.title}
                      </span>
                      {isActive && (
                        <span className="mt-1 rounded bg-amber-50 px-1.5 py-0.25 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {STATUS_LABELS[stage.status]}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Roadmap detail cards */}
            <section className="mt-12 space-y-3">
              {roadmap.map((stage) => {
                const StageIcon = stage.icon;
                const isCurrent = stage.status === "in-progress";
                return (
                  <div
                    key={stage.id}
                    className={`flex items-start gap-4 rounded-xl border bg-white dark:bg-slate-800 p-5 shadow-sm ${
                      isCurrent
                        ? "border-brand/30 ring-1 ring-brand/10"
                        : "border-[#E5E7EB] dark:border-slate-700"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isCurrent
                          ? "bg-brand/10 text-brand"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      <StageIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                          {stage.title}
                        </p>
                        <span
                          className={`rounded border px-1.5 py-0.25 text-[10px] font-semibold ${STATUS_COLORS[stage.status]}`}
                        >
                          {STATUS_LABELS[stage.status]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                        {stage.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Feature preview */}
            <section className="mt-10">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-4 w-4 text-brand" />
                <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                  Capabilities being assembled
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {features.map((feature) => {
                  const FIcon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white dark:border-slate-700 dark:bg-slate-800 p-4"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500">
                        <FIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">
                          {feature.title}
                        </p>
                        {feature.note && (
                          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                            {feature.note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Notify me */}
            <section className="mt-12">
              <div className="rounded-xl border border-[#E5E7EB] bg-white dark:border-slate-700 dark:bg-slate-800 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      Get notified when it launches
                    </p>
                    <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                      Leave your email and we'll ping you as soon as the ASO
                      Design Studio is available.
                    </p>

                    {submitted ? (
                      <div className="mt-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-[12px] font-medium">
                          You're on the list. Thanks for the interest!
                        </span>
                      </div>
                    ) : (
                      <>
                        <form
                          onSubmit={handleNotify}
                          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
                        >
                          <div className="flex-1">
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="you@research.org"
                              className="w-full rounded-md border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-[12px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center justify-center gap-1.5 rounded-md bg-brand px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {submitting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Notify me
                          </button>
                        </form>
                        {error && (
                          <p className="mt-1 text-[10.5px] text-red-600">
                            {error}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
