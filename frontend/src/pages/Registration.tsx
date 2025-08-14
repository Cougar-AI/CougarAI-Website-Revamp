import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

export type RegistrationPayload = {
  email: string;
  password: string;
  marketing: boolean;
  acceptTerms: boolean;
};

export type RegistrationProps = {
  onSubmit?: (payload: RegistrationPayload) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
  /** Optional slot for an OAuth section (e.g., Google button) */
  oauthSlot?: React.ReactNode;
};

export default function Registration({
  onSubmit,
  loading: loadingProp,
  error: errorProp,
  oauthSlot,
}: RegistrationProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketing, setMarketing] = useState(true);

  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Local submit state if parent doesn't pass loading/error
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);

  const loading = loadingProp ?? submitting;
  const error = errorProp ?? localError;

  const emailError = useMemo(() => {
    if (!email) return null;
    const ok = /\S+@\S+\.\S+/.test(email);
    return ok ? null : "Enter a valid email";
  }, [email]);

  // Password checks: must be 8+ and include upper, lower, number, symbol (all 4).
  const pwChecks = useMemo(() => {
    const len = password.length >= 8;
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const num = /[0-9]/.test(password);
    const sym = /[^A-Za-z0-9]/.test(password);
    const typesCount = [upper, lower, num, sym].filter(Boolean).length;

    // Strength (0–4) based on character types only; length is a gate.
    const score = len ? typesCount : 0;
    const label = !len
      ? "Too short"
      : typesCount <= 1
      ? "Very weak"
      : typesCount === 2
      ? "Weak"
      : typesCount === 3
      ? "Medium"
      : "Strong";

    return { len, upper, lower, num, sym, typesCount, score, label };
  }, [password]);

  const pwError = useMemo(() => {
    if (!password) return null;
    if (!pwChecks.len) return "Password must be at least 8 characters";
    if (!(pwChecks.upper && pwChecks.lower && pwChecks.num && pwChecks.sym)) {
      return "Include an uppercase letter, a lowercase letter, a number, and a symbol";
    }
    return null;
  }, [password, pwChecks]);

  const confirmError = useMemo(() => {
    if (!confirm) return null;
    return confirm === password ? null : "Passwords do not match";
  }, [confirm, password]);

  const termsError = triedSubmit && !acceptTerms ? "You must accept the Terms to continue" : null;

  const strengthPct = pwChecks.len ? Math.min(100, (pwChecks.typesCount / 4) * 100) : 0;
  const strengthBarClass =
    !pwChecks.len ? "bg-rose-600" :
    pwChecks.typesCount <= 1 ? "bg-rose-600" :
    pwChecks.typesCount === 2 ? "bg-orange-500" :
    pwChecks.typesCount === 3 ? "bg-yellow-500" : "bg-emerald-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setTriedSubmit(true);

    const problems = [
      email ? null : "Email is required",
      password ? null : "Password is required",
      confirm ? null : "Confirm your password",
      acceptTerms ? null : "You must accept the Terms to continue",
      emailError,
      pwError,
      confirmError,
    ].filter(Boolean) as string[];

    if (problems.length) {
      setLocalError(problems[0]!);
      return;
    }

    const payload: RegistrationPayload = {
      email: email.trim(),
      password,
      marketing,
      acceptTerms,
    };

    if (onSubmit) {
      try {
        setSubmitting(true);
        await onSubmit(payload);
      } catch (err: any) {
        setLocalError(err?.message || "Registration failed");
      } finally {
        setSubmitting(false);
      }
    } else {
      // Demo submit; replace with real API call
      try {
        setSubmitting(true);
        await new Promise((r) => setTimeout(r, 700));
        // eslint-disable-next-line no-console
        console.log("Registration submitted", payload);
      } catch {
        setLocalError("Registration failed");
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
              Create your account
            </h1>
            <p className="mt-2 text-sm text-neutral-300">
              Join to access member features and events.
            </p>
          </div>

          {/* OAuth (optional) */}
          {oauthSlot ? (
            <div className="mt-6">{oauthSlot}</div>
          ) : (
            <div className="mt-6">
              <button
                type="button"
                disabled
                title="Wire this up to your OAuth route"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white text-black px-4 py-2.5 text-sm font-semibold ring-1 ring-black/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 block w-full rounded-xl border-0 bg-white/5 px-3 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500/70"
                placeholder="Create a strong password"
                aria-invalid={!!pwError}
                aria-describedby={pwError ? "password-error password-help" : "password-help"}
              />
              {/* Strength meter */}
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div
                  className={`h-full transition-all ${strengthBarClass}`}
                  style={{ width: `${strengthPct}%` }}
                />
              </div>
              <p id="password-help" className="mt-1 text-xs text-neutral-400">
                {pwChecks.label}. Use at least 8 characters and include upper, lower, number, and symbol.
              </p>
              {pwError && (
                <p id="password-error" className="mt-1 text-xs text-rose-300">
                  {pwError}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="confirm" className="text-sm font-medium text-white">
                  Confirm password
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((s) => !s)}
                  className="text-xs text-neutral-300 hover:text-white"
                  aria-pressed={showConfirmPw}
                  aria-controls="confirm"
                >
                  {showConfirmPw ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="confirm"
                type={showConfirmPw ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-2 block w-full rounded-xl border-0 bg-white/5 px-3 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500/70"
                placeholder="Re-enter your password"
                aria-invalid={!!confirmError}
                aria-describedby={confirmError ? "confirm-error" : undefined}
              />
              {confirmError && (
                <p id="confirm-error" className="mt-1 text-xs text-rose-300">
                  {confirmError}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="inline-flex select-none items-start gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-white/20 bg-transparent text-rose-600 focus:ring-rose-600"
                  aria-invalid={!!termsError}
                  aria-describedby={termsError ? "terms-error" : undefined}
                />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" className="font-medium text-rose-300 hover:text-rose-200">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="font-medium text-rose-300 hover:text-rose-200">
                    Privacy Policy
                  </Link>.
                </span>
              </label>
              {termsError && (
                <p id="terms-error" className="text-xs text-rose-300">
                  {termsError}
                </p>
              )}

              <label className="inline-flex select-none items-start gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-white/20 bg-transparent text-rose-600 focus:ring-rose-600"
                />
                <span>Send me occasional updates and event announcements</span>
              </label>
            </div>

            {error && (
              <div
                className="rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-500/20"
                aria-live="polite"
              >
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
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-neutral-300">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-rose-300 hover:text-rose-200">
              Sign in
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
