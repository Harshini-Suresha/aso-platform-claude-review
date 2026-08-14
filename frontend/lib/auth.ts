const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  institution: string;
  department: string;
  bio: string;
  initials: string;
  verified: boolean;
  token: string;
}

export interface ProfileData extends AuthUser {
  interests: { id: number; topic: string; description: string }[];
  savedDesigns: { id: number; name: string; geneSymbol: string; ensemblId: string; disease: string; sequence: string; notes: string; createdAt: number }[];
  favorites: { id: number; geneSymbol: string; ensemblId: string; note: string; createdAt: number }[];
  activity: { id: number; action: string; detail: string; timestamp: number }[];
  storage: { designs: number; favorites: number; interests: number };
}

const TOKEN_KEY = "aso:auth_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export interface SignupResult extends AuthUser {
  email_sent: boolean;
  message: string;
}

export async function signup(name: string, email: string, password: string): Promise<SignupResult> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Signup failed" }));
    throw new Error(err.detail || "Signup failed");
  }
  const data: SignupResult = await res.json();
  setToken(data.token);
  return data;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }
  const data: AuthUser = await res.json();
  setToken(data.token);
  return data;
}

export async function getMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await authFetch("/api/auth/me");
    if (!res.ok) { clearToken(); return null; }
    return await res.json();
  } catch {
    clearToken();
    return null;
  }
}

export async function getProfile(): Promise<ProfileData | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await authFetch("/api/profile");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function updateProfile(data: { name?: string; email?: string; role?: string; institution?: string; department?: string; bio?: string }): Promise<{ ok: boolean; initials: string }> {
  const res = await authFetch("/api/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Update failed" }));
    throw new Error(err.detail || "Update failed");
  }
  return res.json();
}

export async function addInterest(topic: string, description: string): Promise<{ id: number; topic: string; description: string }> {
  const res = await authFetch("/api/profile/interests", {
    method: "POST",
    body: JSON.stringify({ topic, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed" }));
    throw new Error(err.detail || "Failed");
  }
  return res.json();
}

export async function deleteInterest(id: number): Promise<void> {
  await authFetch(`/api/profile/interests/${id}`, { method: "DELETE" });
}

export async function addDesign(data: { name: string; geneSymbol?: string; ensemblId?: string; disease?: string; sequence?: string; notes?: string }): Promise<{ id: number; name: string }> {
  const res = await authFetch("/api/profile/saved-designs", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed" }));
    throw new Error(err.detail || "Failed");
  }
  return res.json();
}

export async function deleteDesign(id: number): Promise<void> {
  await authFetch(`/api/profile/saved-designs/${id}`, { method: "DELETE" });
}

export async function addFavorite(geneSymbol: string, ensemblId?: string, note?: string): Promise<{ id: number; geneSymbol: string }> {
  const res = await authFetch("/api/profile/favorites", {
    method: "POST",
    body: JSON.stringify({ geneSymbol, ensemblId: ensemblId ?? "", note: note ?? "" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed" }));
    throw new Error(err.detail || "Failed");
  }
  return res.json();
}

export async function deleteFavorite(id: number): Promise<void> {
  await authFetch(`/api/profile/favorites/${id}`, { method: "DELETE" });
}

export async function getActivity(): Promise<{ id: number; action: string; detail: string; timestamp: number }[]> {
  const res = await authFetch("/api/profile/activity");
  if (!res.ok) return [];
  return res.json();
}

export function logout() {
  clearToken();
}

export async function verifyEmail(token: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Verification failed");
  return data;
}

export async function resendVerification(email: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: email }),
  });
  return res.json();
}

// ── Reports ─────────────────────────────────────────────────────────────────

export interface ReportSummary {
  id: number;
  step: string;
  title: string;
  geneSymbol: string;
  disease: string;
  summary: string;
  createdAt: number;
}

export interface ReportDetail extends ReportSummary {
  data: Record<string, unknown>;
}

export async function listReports(): Promise<ReportSummary[]> {
  const res = await authFetch("/api/reports");
  if (!res.ok) return [];
  return res.json();
}

export async function getReport(id: number): Promise<ReportDetail | null> {
  const res = await authFetch(`/api/reports/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function saveReport(report: {
  step: string;
  title: string;
  geneSymbol?: string;
  disease?: string;
  summary?: string;
  data?: Record<string, unknown>;
}): Promise<{ id: number; createdAt: number } | null> {
  const res = await authFetch("/api/reports", {
    method: "POST",
    body: JSON.stringify(report),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteReport(id: number): Promise<void> {
  await authFetch(`/api/reports/${id}`, { method: "DELETE" });
}

// ── Projects ────────────────────────────────────────────────────────────────

export interface ProjectSummary {
  id: number;
  name: string;
  description: string;
  organism: string;
  disease: string;
  geneSymbol: string;
  therapeuticGoal: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectDetail extends ProjectSummary {
  ensemblId: string;
  targetTissue: string;
  cellLine: string;
  notes: string;
}

export async function listProjects(search?: string): Promise<ProjectSummary[]> {
  const url = search ? `/api/projects?search=${encodeURIComponent(search)}` : "/api/projects";
  const res = await authFetch(url);
  if (!res.ok) return [];
  return res.json();
}

export async function getProject(id: number): Promise<ProjectDetail | null> {
  const res = await authFetch(`/api/projects/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createProject(project: {
  name: string;
  description?: string;
  organism?: string;
  disease?: string;
  geneSymbol?: string;
  ensemblId?: string;
  therapeuticGoal?: string;
  targetTissue?: string;
  cellLine?: string;
  notes?: string;
}): Promise<ProjectDetail | null> {
  const res = await authFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify(project),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateProject(
  id: number,
  data: Partial<{
    name: string;
    description: string;
    organism: string;
    disease: string;
    geneSymbol: string;
    ensemblId: string;
    therapeuticGoal: string;
    targetTissue: string;
    cellLine: string;
    notes: string;
    status: string;
  }>
): Promise<ProjectDetail | null> {
  const res = await authFetch(`/api/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteProject(id: number): Promise<void> {
  await authFetch(`/api/projects/${id}`, { method: "DELETE" });
}
