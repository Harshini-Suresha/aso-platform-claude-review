"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Folder,
  FolderPlus,
  Search,
  Loader2,
  MoreVertical,
  Trash2,
  ExternalLink,
  Clock,
  Dna,
} from "lucide-react";
import { Card } from "@/components/ui";
import { listProjects, deleteProject, ProjectSummary } from "@/lib/auth";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  archived: "bg-slate-100 text-slate-500 border-[#E5E7EB]",
};

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(ts);
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  const fetchProjects = async (q?: string) => {
    setLoading(true);
    const data = await listProjects(q);
    setProjects(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects(search || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this project?")) return;
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setActiveMenu(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
            <Folder className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Projects</h1>
            <p className="text-[12px] text-slate-500">
              All your therapeutic projects in one place
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/new-project")}
          className="flex items-center gap-1.5 rounded bg-brand px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-dark"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          New Project
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects by name, disease, or gene..."
          className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-4 text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          <span className="ml-2 text-[12.5px] text-slate-500">Loading projects...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
            <Folder className="h-7 w-7 text-slate-400" />
          </div>
          <h2 className="text-[14px] font-semibold text-slate-700 mb-1">
            {search ? "No projects found" : "No projects yet"}
          </h2>
          <p className="text-[12px] text-slate-500 mb-4 max-w-xs">
            {search
              ? "Try a different search term."
              : "Create your first therapeutic project to get started."}
          </p>
          {!search && (
            <button
              onClick={() => router.push("/new-project")}
              className="flex items-center gap-1.5 rounded bg-brand px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-dark"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              New Project
            </button>
          )}
        </div>
      )}

      {/* Project cards */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="relative group"
            >
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[13px] font-semibold text-slate-800 truncate">
                        {p.name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          STATUS_STYLES[p.status] || STATUS_STYLES.active
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    {p.description && (
                      <p className="text-[11.5px] text-slate-500 line-clamp-1">
                        {p.description}
                      </p>
                    )}
                  </div>

                  {/* Menu button */}
                  <div className="relative ml-2">
                    <button
                      onClick={() =>
                        setActiveMenu(activeMenu === p.id ? null : p.id)
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                    {activeMenu === p.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setActiveMenu(null)}
                        />
                        <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Metadata row */}
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-3">
                  {p.geneSymbol && (
                    <span className="flex items-center gap-1">
                      <Dna className="h-3 w-3" />
                      {p.geneSymbol}
                    </span>
                  )}
                  {p.disease && (
                    <span className="truncate max-w-[140px]">{p.disease}</span>
                  )}
                  <span className="ml-auto flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(p.updatedAt)}
                  </span>
                </div>

                {p.therapeuticGoal && (
                  <div className="mt-2">
                    <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {p.therapeuticGoal}
                    </span>
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
