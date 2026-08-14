"use client";

import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";
import type { LucideIcon } from "lucide-react";

export default function PagePlaceholder({
  title,
  description,
  icon: Icon,
  sections,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  sections: { label: string; items: string[] }[];
}) {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100">
              <Icon className="h-4 w-4 text-slate-500" />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-slate-800">{title}</p>
              <p className="text-[11px] text-slate-500">{description}</p>
            </div>
          </Card>

          <Card>
            <SectionHeader title={title} />
            <div className="px-5 pb-5 space-y-4">
              {sections.map((section) => (
                <div key={section.label}>
                  <p className="text-[11.5px] font-semibold text-slate-700 mb-1.5">{section.label}</p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {section.items.map((item) => (
                      <div
                        key={item}
                        className="border border-dashed border-[#E5E7EB] bg-slate-50/50 px-3 py-2 text-[11px] text-slate-400"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <Icon className="mx-auto h-6 w-6 text-slate-300 mb-1.5" />
                <p className="text-[12px] font-medium text-slate-400">Coming soon</p>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  This section is under active development.
                </p>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
