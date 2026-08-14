import {
  BugReportSummary,
  BugReportDetail,
  BugReportEmailResult,
} from "@/types/bugReports";
import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function bugReportFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export async function listBugReports(): Promise<BugReportSummary[]> {
  const res = await bugReportFetch("/api/bug-reports");
  if (!res.ok) return [];
  return res.json();
}

export async function getBugReport(id: number): Promise<BugReportDetail | null> {
  const res = await bugReportFetch(`/api/bug-reports/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createBugReport(data: {
  area: string;
  summary: string;
  steps?: string;
  expected?: string;
  actual?: string;
  page_url?: string;
  send_email?: boolean;
}): Promise<{ id: number; status: string; created_at: number; email_result: BugReportEmailResult | null } | null> {
  const res = await bugReportFetch("/api/bug-reports", {
    method: "POST",
    body: JSON.stringify({
      area: data.area,
      summary: data.summary,
      steps: data.steps || "",
      expected: data.expected || "",
      actual: data.actual || "",
      page_url: data.page_url || "",
      send_email: data.send_email || false,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to submit bug report" }));
    throw new Error(err.detail || "Failed to submit bug report");
  }
  return res.json();
}

export async function deleteBugReport(id: number): Promise<void> {
  await bugReportFetch(`/api/bug-reports/${id}`, { method: "DELETE" });
}
