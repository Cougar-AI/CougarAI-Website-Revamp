import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

export type LoginProps = {
  onSubmit?: (payload: { email: string; password: string; remember: boolean }) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
  /** Optional slot for an OAuth section (e.g., Google button) */
  oauthSlot?: React.ReactNode;
};

export default function Login({ onSubmit, loading: loadingProp, error: errorProp, oauthSlot }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);

  // Local submit state only if parent didn't pass loading
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const loading = loadingProp ?? submitting;
  const error = errorProp ?? localError;

  const emailError = useMemo(() => {
    if (!email) return null;
    // Simple RFC5322-ish check; adjust to your needs
    const ok = /\S+@\S+\.\S+/.test(email);
    return ok ? null : "Enter a valid email";
  }, [email]);

  const pwError = useMemo(() => {
    if (!password) return null;
    return password.length >= 6 ? null : "Password must be at least 6 characters";
  }, [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    // Basic validation
    const problems = [email ? null : "Email is required", password ? null : "Password is required", emailError, pwError].filter(
      Boolean
    ) as string[];

    if (problems.length) {
      setLocalError(problems[0]!);
      return;
    }

    if (onSubmit) {
      try {
        setSubmitting(true);
        await onSubmit({ email, password, remember });
      } catch (err: any) {
        setLocalError(err?.message || "Sign in failed");
      } finally {
        setSubmitting(false);
      }
    } else {
      // Fallback demo submit: remove or replace with real API call
      try {
        setSubmitting(true);
        await new Promise((r) => setTimeout(r, 700));
        // eslint-disable-next-line no-console
        console.log("Login submitted", { email, remember });
      } catch (err: any) {
        setLocalError("Sign in failed");
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl items-center justify-center px-6 py-16 sm:py-20">
      {/* Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-neutral-900/70 shadow-xl ring-1 ring-white/10 backdrop-blur">
        {/* Accent bar */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-600 via-fuchsia-600 to-rose-600" />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="font-['Oxanium'] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-neutral-300">Sign in to access member features and events.</p>
          </div>

          {/* OAuth (optional) */}
          {oauthSlot ? (
            <div className="mt-6">{oauthSlot}</div>
          ) : (
            <div className="mt-6">
              {/* Example Google button (disabled by default). Replace href with your provider route. */}
              <button
                type="button"
                disabled
                title="Wire this up to your OAuth route"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white text-black px-4 py-2.5 text-sm font-semibold ring-1 ring-black/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {/* Google G icon */}
                <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
                  <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.42-.22-2.04H12.24v3.71h6.43c-.13.92-.83 2.31-2.38 3.24l-.02.13 3.46 2.68.24.02c2.2-2.03 3.52-5.02 3.52-7.74Z" />
                  <path fill="#34A853" d="M12.24 24c3.19 0 5.87-1.05 7.83-2.85l-3.73-2.89c-1 .65-2.34 1.1-4.1 1.1-3.13 0-5.78-2.03-6.73-4.85l-.12.01-3.65 2.82-.05.1C2.68 21.63 7.1 24 12.24 24Z" />
                  <path fill="#FBBC05" d="M5.51 14.51a7.35 7.35 0 0 1-.39-2.35c0-.82.14-1.61.37-2.35l-.01-.16-3.7-2.87-.12.06A11.77 11.77 0 0 0 0 12.16c0 1.9.46 3.69 1.26 5.27l4.25-2.92Z" />
                  <path fill="#EA4335" d="M12.24 4.75c2.22 0 3.71.95 4.56 1.73l3.33-3.25C18.09 1.2 15.42 0 12.24 0 7.1 0 2.68 2.37 1.26 6.89l4.24 2.93c.95-2.82 3.6-4.86 6.74-4.86Z" />
                </svg>
                Continue with Google
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-neutral-400">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Form */}
          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="email" className="text-sm font-medium text-white">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 block w-full rounded-xl border-0 bg-white/5 px-3 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500/70"
                placeholder="you@uh.edu"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "email-error" : undefined}
              />
              {emailError && (
                <p id="email-error" className="mt-1 text-xs text-rose-300">
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-white">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="text-xs text-neutral-300 hover:text-white"
                  aria-pressed={showPw}
                  aria-controls="password"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 block w-full rounded-xl border-0 bg-white/5 px-3 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500/70"
                placeholder="••••••••"
                aria-invalid={!!pwError}
                aria-describedby={pwError ? "password-error" : undefined}
              />
              {pwError && (
                <p id="password-error" className="mt-1 text-xs text-rose-300">
                  {pwError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex select-none items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="size-4 rounded border-white/20 bg-transparent text-rose-600 focus:ring-rose-600"
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-rose-300 hover:text-rose-200"
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-500/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-rose-400/30 transition hover:bg-rose-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Spinner />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-neutral-300">
            Don\'t have an account?{" "}
            <Link to="/join" className="font-medium text-rose-300 hover:text-rose-200">
              Join now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
    </svg>
  );
}
