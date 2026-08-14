"use client";

import { useEffect, useState } from "react";
import HelpPageShell from "@/components/HelpPageShell";
import { Card, FieldLabel } from "@/components/ui";
import { Send, Info, Ticket, Mail, Plus, ChevronLeft, AlertCircle, CheckCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  listBugReports,
  createBugReport,
  deleteBugReport,
} from "@/lib/bugReportsApi";
import { BugReportSummary } from "@/types/bugReports";

const AREAS = [
  "Gene Verification (Page 1)",
  "Mechanism Selection (Page 2)",
  "Candidate Design (Page 3)",
  "Upload Sequence",
  "Platform Assistant",
  "Notifications",
  "Something else",
];

type View = "list" | "create" | "detail";

export default function ReportBugPage() {
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<View>("list");
  const [tickets, setTickets] = useState<BugReportSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [area, setArea] = useState(AREAS[0]);
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

  async function loadTickets() {
    const data = await listBugReports();
    setTickets(data);
  }

  function resetForm() {
    setArea(AREAS[0]);
    setSummary("");
    setSteps("");
    setExpected("");
    setActual("");
    setSendEmail(false);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!summary.trim()) {
      setError("Summary is required");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createBugReport({
        area,
        summary,
        steps,
        expected,
        actual,
        page_url: typeof window !== "undefined" ? window.location.href : "",
        send_email: sendEmail,
      });
      if (result) {
        resetForm();
        await loadTickets();
        setView("list");
        if (result.email_result && !result.email_result.sent) {
          setError(result.email_result.message);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit bug report");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    await deleteBugReport(id);
    if (selectedId === id) {
      setSelectedId(null);
      setView("list");
    }
    await loadTickets();
  }

  function buildMailto() {
    const subject = encodeURIComponent(`[Bug] ${area}: ${summary || "Untitled"}`);
    const body = encodeURIComponent(
      `Area: ${area}\n\nSummary:\n${summary}\n\nSteps to reproduce:\n${steps}\n\nExpected behavior:\n${expected}\n\nActual behavior:\n${actual}\n\n---\nPage URL: ${
        typeof window !== "undefined" ? window.location.href : ""
      }`
    );
    return `mailto:mail@koshkey.com?subject=${subject}&body=${body}`;
  }

  const selectedTicket = tickets.find((t) => t.id === selectedId) || null;

  if (authLoading) {
    return (
      <HelpPageShell title="Report a Bug" subtitle="Loading...">
        <Card className="p-6 text-center text-[13px] text-slate-500">Loading...</Card>
      </HelpPageShell>
    );
  }

  if (!user) {
    return (
      <HelpPageShell
        title="Report a Bug"
        subtitle="Sign in to submit in-app bug reports, or use email below."
      >
        <Card className="p-5 bg-blue-50/50 border-blue-200">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <p className="text-[12.5px] text-blue-700">
              In-app ticketing requires an account. You can still report bugs via email without signing in.
            </p>
          </div>
        </Card>
        <Card className="p-5 space-y-4">
          <div>
            <FieldLabel>Area</FieldLabel>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              {AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Summary</FieldLabel>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One line describing the problem"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div>
            <FieldLabel>Steps to reproduce</FieldLabel>
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={3}
              placeholder="1. Go to...&#10;2. Enter...&#10;3. Click..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Expected behavior</FieldLabel>
              <textarea
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <FieldLabel>Actual behavior</FieldLabel>
              <textarea
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>
          <a
            href={buildMailto()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white hover:bg-brand-dark"
          >
            <Send className="h-4 w-4" />
            Open Email to Send Report
          </a>
        </Card>
      </HelpPageShell>
    );
  }

  if (view === "list") {
    return (
      <HelpPageShell
        title="Report a Bug"
        subtitle="Submit in-app tickets or email support directly."
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => { resetForm(); setView("create"); }}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-brand-dark"
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
          <a
            href={buildMailto()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[13.5px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <Mail className="h-4 w-4" />
            Email Support
          </a>
        </div>

        <Card className="p-0 overflow-hidden">
          {tickets.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-slate-500">
              No tickets yet. Submit your first bug report above.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedId(t.id); setView("detail"); }}
                  className="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="mt-0.5">
                    {t.status === "open" ? (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium text-slate-800 truncate">{t.summary || "Untitled"}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">{t.area} &middot; {new Date(t.created_at * 1000).toLocaleString()}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    t.status === "open"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {t.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </HelpPageShell>
    );
  }

  if (view === "detail" && selectedTicket) {
    return (
      <HelpPageShell
        title="Ticket Details"
        subtitle={`Ticket #{selectedTicket.id}`}
      >
        <button
          onClick={() => setView("list")}
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to tickets
        </button>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-slate-800">{selectedTicket.summary || "Untitled"}</h2>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              selectedTicket.status === "open"
                ? "bg-amber-50 text-amber-700"
                : "bg-emerald-50 text-emerald-700"
            }`}>
              {selectedTicket.status}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Area</FieldLabel>
              <p className="text-[13.5px] text-slate-700 mt-1">{selectedTicket.area}</p>
            </div>
            <div>
              <FieldLabel>Submitted</FieldLabel>
              <p className="text-[13.5px] text-slate-700 mt-1">{new Date(selectedTicket.created_at * 1000).toLocaleString()}</p>
            </div>
          </div>

          {selectedTicket.steps && (
            <div>
              <FieldLabel>Steps to reproduce</FieldLabel>
              <p className="text-[13.5px] text-slate-700 mt-1 whitespace-pre-wrap">{selectedTicket.steps}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Expected behavior</FieldLabel>
              <p className="text-[13.5px] text-slate-700 mt-1 whitespace-pre-wrap">{selectedTicket.expected}</p>
            </div>
            <div>
              <FieldLabel>Actual behavior</FieldLabel>
              <p className="text-[13.5px] text-slate-700 mt-1 whitespace-pre-wrap">{selectedTicket.actual}</p>
            </div>
          </div>

          {selectedTicket.page_url && (
            <div>
              <FieldLabel>Page URL</FieldLabel>
              <p className="text-[13.5px] text-slate-700 mt-1 break-all">{selectedTicket.page_url}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handleDelete(selectedTicket.id)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete Ticket
            </button>
          </div>
        </Card>
      </HelpPageShell>
    );
  }

  return (
    <HelpPageShell
      title="Report a Bug"
      subtitle="Submit an in-app ticket or email support directly."
    >
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-[12.5px] text-red-700">{error}</p>
        </Card>
      )}

      <Card className="p-5 bg-blue-50/50 border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
          <p className="text-[12.5px] text-blue-700">
            Submit an in-app ticket to track your report, or send it directly via email. Tickets are stored in your account and visible to the support team.
          </p>
        </div>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card className="p-5 space-y-4">
          <div>
            <FieldLabel>Area</FieldLabel>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              {AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Summary</FieldLabel>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One line describing the problem"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div>
            <FieldLabel>Steps to reproduce</FieldLabel>
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={3}
              placeholder="1. Go to...&#10;2. Enter...&#10;3. Click..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Expected behavior</FieldLabel>
              <textarea
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <FieldLabel>Actual behavior</FieldLabel>
              <textarea
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sendEmail"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <label htmlFor="sendEmail" className="text-[13px] text-slate-700 cursor-pointer select-none">
              Also send this report via email to support
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              <Ticket className="h-4 w-4" />
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
            <a
              href={buildMailto()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-[13.5px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Mail className="h-4 w-4" />
              Email Only
            </a>
          </div>
        </Card>
      </form>

      {tickets.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-[13px] font-semibold text-slate-700">Recent Tickets</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {tickets.slice(0, 5).map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedId(t.id); setView("detail"); }}
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="mt-0.5">
                  {t.status === "open" ? (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium text-slate-800 truncate">{t.summary || "Untitled"}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">{t.area} &middot; {new Date(t.created_at * 1000).toLocaleString()}</p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  t.status === "open"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}>
                  {t.status}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </HelpPageShell>
  );
}
