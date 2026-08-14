"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dna, Loader2, AlertCircle } from "lucide-react";
import { login as apiLogin } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiLogin(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-[#0f172a]">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sidebar to-sidebar items-center justify-center">
        <div className="max-w-md px-8 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <Dna className="h-8 w-8 text-indigo-400" strokeWidth={2} />
            <div className="text-left">
              <p className="text-[18px] font-bold tracking-wide text-white">RNA THERAPEUTICS</p>
              <p className="text-[12px] text-slate-400">Platform</p>
            </div>
          </div>
          <p className="text-[14px] leading-relaxed text-slate-300">
            ASO design platform with gene retrieval, mechanism selection, and candidate design.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Dna className="h-5 w-5 text-indigo-500" strokeWidth={2} />
            <p className="text-[14px] font-bold text-slate-800 dark:text-slate-200">RNA Therapeutics Platform</p>
          </div>

          <h1 className="text-[22px] font-bold text-slate-900 dark:text-slate-100">Sign in</h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Welcome back. Enter your credentials.</p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-400">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#E5E7EB] dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-400">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#E5E7EB] dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                placeholder="At least 6 characters"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">Sign up</a>
          </p>
        </div>
      </div>
    </div>
  );
}
