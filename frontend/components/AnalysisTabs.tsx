"use client";

import type { LucideIcon } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export default function AnalysisTabs({
  activeTab,
  onTabChange,
  tabs,
  children,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: Tab[];
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[#E5E7EB] bg-white rounded-t-2xl px-4 pt-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "text-brand border-b-2 border-brand"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-brand/10 px-1.5 py-0. text-[9px] font-semibold text-brand min-w-[16px]">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Tab content */}
      <div className="rounded-b-2xl bg-white border border-t-0 border-[#E5E7EB] shadow-card">
        {children}
      </div>
    </div>
  );
}
