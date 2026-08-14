"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientSearchParams } from "@/utils/useClientSearchParams";
import { Dna, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { verifyEmail, resendVerification } from "@/lib/auth";

function VerifyContent() {
  const searchParams = useClientSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">("loading");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    if (!token) {
      setStatus("no-token");
      return;
    }
    verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, [token]);

  async function handleResend() {
    if (!resendEmail.trim()) return;
    setResendStatus("sending");
    await resendVerification(resendEmail);
    setResendStatus("sent");
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <Dna className="h-7 w-7 text-indigo-500" strokeWidth={2} />
          <p className="text-[16px] font-bold text-slate-800">RNA Therapeutics Platform</p>
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto" />
            <p className="text-[13px] text-slate-500">Verifying your email...</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
            <h1 className="text-[18px] font-bold text-slate-900">Email verified!</h1>
            <p className="text-[13px] text-slate-500">Your account is now active. You can start using the platform.</p>
            <button onClick={() => router.push("/login")} className="h-10 rounded-lg bg-indigo-600 px-6 text-[13px] font-semibold text-white hover:bg-indigo-700">
              Sign in
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h1 className="text-[18px] font-bold text-slate-900">Verification failed</h1>
            <p className="text-[13px] text-slate-500">{message}</p>
            <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 space-y-3">
              <p className="text-[12px] font-medium text-slate-600">Resend verification email</p>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="your@email.com"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[12px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
              <button
                onClick={handleResend}
                disabled={resendStatus === "sending" || !resendEmail.trim()}
                className="h-9 rounded-lg bg-indigo-600 px-4 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {resendStatus === "sending" ? "Sending..." : resendStatus === "sent" ? "Sent!" : "Resend"}
              </button>
            </div>
          </div>
        )}

        {status === "no-token" && (
          <div className="space-y-4">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
            <h1 className="text-[18px] font-bold text-slate-900">No verification link</h1>
            <p className="text-[13px] text-slate-500">Please use the verification link from your email.</p>
            <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 space-y-3">
              <p className="text-[12px] font-medium text-slate-600">Resend verification email</p>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="your@email.com"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[12px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
              <button
                onClick={handleResend}
                disabled={resendStatus === "sending" || !resendEmail.trim()}
                className="h-9 rounded-lg bg-indigo-600 px-4 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {resendStatus === "sending" ? "Sending..." : resendStatus === "sent" ? "Sent!" : "Resend"}
              </button>
            </div>
          </div>
        )}

        <p className="mt-8 text-[11px] text-slate-400">
          <a href="/login" className="hover:text-slate-600">Back to sign in</a>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <VerifyContent />;
}
