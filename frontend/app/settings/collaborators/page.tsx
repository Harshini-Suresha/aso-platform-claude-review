"use client";

import { Users } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, SectionHeader } from "@/components/ui";

export default function CollaboratorsPage() {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-0 px-6 py-4">
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100"><Users className="h-4 w-4 text-slate-500" /></span>
            <div><p className="text-[12px] font-semibold text-slate-800">Collaborators</p><p className="text-[11px] text-slate-500">Team members and shared access</p></div>
          </Card>
          <Card>
            <SectionHeader title="Team Members" />
            <div className="px-5 pb-5">
              <p className="text-[12px] text-slate-400 py-4 text-center">Team collaboration features coming soon. Currently a single-user platform.</p>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
