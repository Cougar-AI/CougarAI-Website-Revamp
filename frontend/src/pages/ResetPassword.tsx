import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthNotice } from "@/lib/auth";
import logo from "../assets/logo.png";

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001";

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
    </svg>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const pwChecks = useMemo(() => ({
    len:   password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    num:   /[0-9]/.test(password),
    sym:   /[^A-Za-z0-9]/.test(password),
  }), [password]);
  const pwStrong = Object.values(pwChecks).every(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors([]);

    if (!token) {
      setError("No reset token found. Please use the link from your email.");
      return;
    }
    if (!pwStrong) {
      setError("Password must be at least 8 characters with uppercase, lowercase, a number, and a symbol.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({})) as {
        ok?: boolean;
        error?: string;
        field_errors?: { password?: string[] };
      };

      if (res.ok) {
        setAuthNotice("Password reset successfully. Please log in.");
        navigate("/login", { replace: true });
        return;
      }

      if (data?.field_errors?.password?.length) {
        setFieldErrors(data.field_errors.password);
        return;
      }

      const err = data?.error ?? "";
      if (err === "invalid_or_expired_token" || err === "invalid_token_type") {
        setError("This reset link has expired or is invalid. Please request a new one.");
      } else if (err === "token_required") {
        setError("No reset token found. Please use the link from your email.");
      } else if (err === "user_not_found") {
        setError("Account not found. Please request a new reset link.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // No token in URL at all — show a static error state
  if (!token) {
    return (
      <div className="relative mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl items-center justify-center px-6 py-16">
        <div
          className="relative w-full max-w-md overflow-hidden rounded-2xl backdrop-blur"
          style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 20px 60px rgba(0,0,0,.6)" }}
        >
          <div className="h-[3px] bg-gradient-to-r from-red-700 via-red-600 to-red-700" />
          <div className="p-6 sm:p-8 text-center font-['Oxanium']">
            <img
              src={logo}
              alt="CougarAI"
              className="mx-auto mb-4 h-12 w-12 rounded-[10px] object-contain"
              style={{ border: "2px solid rgba(185,28,28,.4)", boxShadow: "0 0 20px rgba(185,28,28,.3)" }}
            />
            <h1 className="text-2xl font-bold text-white mb-2">Invalid Link</h1>
            <p className="text-white/60 text-sm mb-6">
              This reset link is missing a token. Please use the link sent to your email.
            </p>
            <a
              href="/forgot-password"
              className="inline-block rounded-xl bg-red-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition"
              style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
            >
              Request New Link
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl items-center justify-center px-6 py-16 sm:py-20">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl backdrop-blur"
        style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 20px 60px rgba(0,0,0,.6)" }}
      >
        {/* Accent bar */}
        <div className="h-[3px] bg-gradient-to-r from-red-700 via-red-600 to-red-700" />

        <div className="p-6 sm:p-8 font-['Oxanium']">
          {/* Header */}
          <div className="text-center">
            <img
              src={logo}
              alt="CougarAI"
              className="mx-auto mb-3 h-12 w-12 rounded-[10px] object-contain"
              style={{ border: "2px solid rgba(185,28,28,.4)", boxShadow: "0 0 20px rgba(185,28,28,.3)" }}
            />
            <h1 className="text-3xl font-bold tracking-tight text-white">Reset Password</h1>
            <p className="mt-1.5 text-sm text-white/50">Enter your new password below.</p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="text-sm font-medium text-white">
                  New Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="text-xs text-neutral-300 hover:text-white"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full rounded-xl border-0 bg-white/5 px-3 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500/70"
                placeholder="••••••••"
              />
              {password && (
                <div className="mt-1.5 flex gap-1.5 flex-wrap">
                  {[
                    [pwChecks.len,   "8+ chars"],
                    [pwChecks.upper, "Uppercase"],
                    [pwChecks.lower, "Lowercase"],
                    [pwChecks.num,   "Number"],
                    [pwChecks.sym,   "Symbol"],
                  ].map(([ok, label]) => (
                    <span
                      key={String(label)}
                      className={`text-xs px-1.5 py-0.5 rounded-full ${ok ? "bg-emerald-900/50 text-emerald-300" : "bg-white/5 text-white/30"}`}
                    >
                      {String(label)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirm" className="text-sm font-medium text-white block mb-1">
                Confirm Password
              </label>
              <input
                id="confirm"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="block w-full rounded-xl border-0 bg-white/5 px-3 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500/70"
                placeholder="••••••••"
              />
            </div>

            {fieldErrors.length > 0 && (
              <div className="rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-500/20 space-y-1">
                {fieldErrors.map((msg, i) => <p key={i}>{msg}</p>)}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-500/20">
                {error}
                {(error.includes("expired") || error.includes("invalid")) && (
                  <div className="mt-2">
                    <a href="/forgot-password" className="text-xs underline decoration-rose-300/60 hover:text-rose-100">
                      Request a new reset link
                    </a>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-red-600/30 transition hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
            >
              {submitting ? <><Spinner /> Resetting…</> : "Reset Password"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-400">
            <a href="/login" className="hover:text-white transition">Back to Login</a>
          </p>
        </div>
      </div>
    </div>
  );
}
