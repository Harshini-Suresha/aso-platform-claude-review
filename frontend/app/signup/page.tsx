"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dna, Loader2, AlertCircle, Mail } from "lucide-react";
import { signup as apiSignup } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [serverMessage, setServerMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await apiSignup(name, email, password);
      setEmailSent(result.email_sent);
      setServerMessage(result.message);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sidebar to-sidebar items-center justify-center">
          <div className="max-w-md px-8 text-center">
            <div className="flex items-center justify-center gap-2.5 mb-6">
              <Dna className="h-8 w-8 text-indigo-400" strokeWidth={2} />
              <div className="text-left">
                <p className="text-[18px] font-bold tracking-wide text-white">RNA THERAPEUTICS</p>
                <p className="text-[12px] text-slate-400">Platform</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm text-center space-y-4">
            {emailSent ? (
              <>
                <Mail className="h-12 w-12 text-indigo-500 mx-auto" />
                <h1 className="text-[22px] font-bold text-slate-900">Check your email</h1>
                <p className="text-[13px] text-slate-500">
                  We sent a verification link to <span className="font-medium text-slate-700">{email}</span>.
                  Click the link to activate your account.
                </p>
                <p className="text-[12px] text-slate-400">
                  Didn&apos;t get it? Check your spam folder or{" "}
                  <a href="/verify-email" className="font-medium text-indigo-600 hover:text-indigo-700">resend verification</a>.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
                <h1 className="text-[22px] font-bold text-slate-900">Account created</h1>
                <p className="text-[13px] text-slate-500">
                  Your account was created successfully, but the verification email could not be sent.
                  This usually means the email server is not configured.
                </p>
                <p className="text-[12px] text-slate-400">
                  Please contact support, or try again later. You can also visit the{" "}
                  <a href="/verify-email" className="font-medium text-indigo-600 hover:text-indigo-700">verify email page</a>{" "}
                  to attempt resending.
                </p>
              </>
            )}
            <div className="pt-4">
              <a href="/login" className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700">
                Back to sign in
              </a>
            </div>
          </div>
        </div>
      </div>
    );
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
            Create an account to save your ASO designs, favorite genes, and research interests.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Dna className="h-5 w-5 text-indigo-500" strokeWidth={2} />
            <p className="text-[14px] font-bold text-slate-800 dark:text-slate-200">RNA Therapeutics Platform</p>
          </div>

          <h1 className="text-[22px] font-bold text-slate-900 dark:text-slate-100">Create account</h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Get started with the platform.</p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-400">Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#E5E7EB] dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                placeholder="Jane Doe"
              />
            </div>
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
              Create account
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-slate-500 dark:text-slate-400">
            Already have an account?{" "}
            <a href="/login" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
