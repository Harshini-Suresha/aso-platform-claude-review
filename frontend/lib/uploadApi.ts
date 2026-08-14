import { ValidateResponse, AnalyzeResponse, Modality } from "@/types/upload-types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function validateSequence(
  sequence: string,
  filename?: string | null
): Promise<ValidateResponse> {
  const res = await fetch(`${API_BASE}/api/upload/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sequence, filename: filename ?? null }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not validate sequence.");
  }
  return res.json();
}

export async function analyzeSequence(
  sequence: string,
  modality: Modality
): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/upload/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sequence, modality }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not analyze sequence.");
  }
  return res.json();
}
