import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { ArrowLeft } from "lucide-react";

export default function HelpPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-3xl">
            <a
              href="/"
              className="mb-4 flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to platform
            </a>
            <h1 className="text-[22px] font-semibold text-slate-800">{title}</h1>
            {subtitle && <p className="mt-1.5 text-[14px] text-slate-500">{subtitle}</p>}
            <div className="mt-6 space-y-5">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
