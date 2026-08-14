"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderPlus,
  Folder,
  Crosshair,
  PenSquare,
  BarChart3,
  FlaskConical,
  FileText,
  BookOpen,
  Settings,
  Dna,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
  color?: string;
}

const PIPELINE_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "New Project", icon: FolderPlus, href: "/new-project" },
      { label: "Projects", icon: Folder, href: "/projects" },
      { label: "Mechanism Docs", icon: BookOpen, href: "/documentation" },
    ],
  },
  {
    section: "pipeline",
    items: [
      { label: "Target Discovery", icon: Crosshair, href: "/targets", color: "text-pipeline-discovery" },
      { label: "ASO Design", icon: PenSquare, href: "/designs", color: "text-pipeline-design" },
      { label: "RNA Engineering", icon: Dna, href: "/rna-engineering" },
      { label: "Computational Analysis", icon: BarChart3, href: "/analysis", color: "text-pipeline-analysis" },
      { label: "Experimental Validation", icon: FlaskConical, href: "/validation", color: "text-pipeline-validation" },
    ],
  },
  {
    section: "output",
    items: [
      { label: "Reports", icon: FileText, href: "/reports", color: "text-pipeline-reports" },
      { label: "Knowledge Base", icon: BookOpen, href: "/knowledge" },
    ],
  },
  {
    section: "quick links",
    items: [
      { label: "Settings", icon: Settings, href: "/settings" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(href);
  }

  const navItems = PIPELINE_NAV.flatMap((g) => g.items);

  useKeyboardShortcut("1", () => router.push("/new-project"), { alt: true });
  useKeyboardShortcut("2", () => router.push("/targets"), { alt: true });
  useKeyboardShortcut("3", () => router.push("/designs"), { alt: true });
  useKeyboardShortcut("4", () => router.push("/rna-engineering"), { alt: true });
  useKeyboardShortcut("5", () => router.push("/analysis"), { alt: true });
  useKeyboardShortcut("6", () => router.push("/validation"), { alt: true });
  useKeyboardShortcut("7", () => router.push("/reports"), { alt: true });
  useKeyboardShortcut("p", () => router.push("/projects"), { alt: true });
  useKeyboardShortcut("u", () => router.push("/upload-sequence"), { alt: true });
  useKeyboardShortcut("s", () => router.push("/settings"), { alt: true });

  return (
    <aside className="hidden lg:flex lg:w-56 shrink-0 flex-col bg-sidebar text-white h-screen sticky top-0">
      <div className="px-3 py-3 border-b border-white/[0.08]">
        <a href="/dashboard" className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-sidebar-hover transition-all duration-200 group">
          <Dna className="h-4 w-4 text-accent-biology shrink-0 transition-transform duration-200 group-hover:scale-110" strokeWidth={2} />
          <div className="leading-tight">
            <p className="text-[12px] font-semibold tracking-wide text-white">
              RNA THERAPEUTICS
            </p>
            <p className="text-[10px] text-white/70">Platform</p>
          </div>
        </a>
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-2.5 py-3">
        {PIPELINE_NAV.map((group, gi) => (
          <div key={group.section} className={gi > 0 ? "mt-3" : ""}>
            {gi > 0 && (
              <div className="mx-2 mb-1.5 border-t border-white/[0.08]" />
            )}
            <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
              {group.section === "overview"
                ? "Overview"
                : group.section === "pipeline"
                ? "Pipeline"
                : group.section === "output"
                ? "Output"
                : "Quick Links"}
            </p>
            <ul className="space-y-0">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-200 ${
                        active
                          ? "bg-sidebar-active text-white translate-x-0.5"
                          : "text-white/80 hover:bg-sidebar-hover hover:text-white hover:translate-x-0.5"
                      }`}
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-md transition-all duration-200 ${
                        active
                          ? "bg-white/15"
                          : "bg-white/5 group-hover:bg-white/10"
                      }`}>
                        <Icon
                          className={`h-3.5 w-3.5 shrink-0 transition-all duration-200 ${
                            active
                              ? item.color ?? "text-accent-biology"
                              : "text-white/70 group-hover:text-white"
                          }`}
                          strokeWidth={active ? 2.2 : 2}
                        />
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="rounded bg-brand/20 px-1 py-0.5 text-[8px] font-semibold text-white">
                          {item.badge}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 text-[11px] font-medium leading-relaxed border-t border-white/[0.08]">
        <span className="text-white/70">&copy; 2026, KoshKey Sciences Pvt Ltd</span>
        <br />
        <a href="mailto:mail@koshkey.com" className="text-white/70 hover:text-white transition-colors">
          mail@koshkey.com
        </a>
      </div>
    </aside>
  );
}
