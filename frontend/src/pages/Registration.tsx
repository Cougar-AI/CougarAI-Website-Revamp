import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { persistAuthSession } from "@/lib/auth";
import logo from "../assets/logo.png";

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
  embedded?: boolean;
  headerSlot?: React.ReactNode;
  /** Optional slot for an OAuth section (e.g., Google button) */
  oauthSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
};

type RegisterOk = { ok: true };
type FieldErrors = { field_errors?: { email?: string[]; password?: string[] } };
type GoogleAuthOk = { access_token: string; user: { user_id: number; email: string; role?: string; onboarding_completed?: boolean } };

const API_BASE = import.meta.env?.VITE_BACKEND_API_URL ?? ""; // leave "" for same-origin
const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? "";
const MICROSOFT_ENABLED = import.meta.env?.VITE_ENABLE_MICROSOFT_OAUTH === "true";
const DISCORD_ENABLED = import.meta.env?.VITE_ENABLE_DISCORD_OAUTH === "true";

function MicrosoftLogo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#f25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7fba00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00a4ef" d="M2 12.5h9.5V22H2z" />
      <path fill="#ffb900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

function DiscordLogo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="white">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.014.043.03.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void;
        };
      };
    };
  }
}

async function postJSON<T>(path: string, body: any, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
    body: JSON.stringify(body),
    ...opts,
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `Request failed (${res.status})`) as Error & {
      status?: number;
      data?: any;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export default function Registration({
  onSubmit,
  loading: loadingProp,
  error: errorProp,
  embedded = false,
  headerSlot,
  oauthSlot,
  footerSlot,
}: RegistrationProps) {
  const navigate = useNavigate();
  const location = useLocation();
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

  // Server-side field errors
  const [serverEmailErrors, setServerEmailErrors] = useState<string[] | null>(null);
  const [serverPwErrors, setServerPwErrors] = useState<string[] | null>(null);

  // Success state
  const [verifySent, setVerifySent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const loading = loadingProp ?? submitting;
  const error = errorProp ?? localError;

  const emailError = useMemo(() => {
    if (!email) return triedSubmit ? "Email is required" : null;
    const ok = /\S+@\S+\.\S+/.test(email);
    return ok ? null : "Enter a valid email";
  }, [email, triedSubmit]);

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
    if (!password) return triedSubmit ? "Password is required" : null;
    if (!pwChecks.len) return "Password must be at least 8 characters";
    if (!(pwChecks.upper && pwChecks.lower && pwChecks.num && pwChecks.sym)) {
      return "Include an uppercase letter, a lowercase letter, a number, and a symbol";
    }
    return null;
  }, [password, pwChecks, triedSubmit]);

  const confirmError = useMemo(() => {
    if (!confirm) return triedSubmit ? "Please confirm your password" : null;
    return confirm === password ? null : "Passwords do not match";
  }, [confirm, password, triedSubmit]);

  const termsError = triedSubmit && !acceptTerms ? "You must accept the Terms to continue" : null;

  const strengthPct = pwChecks.len ? Math.min(100, (pwChecks.typesCount / 4) * 100) : 0;
  const strengthBarClass =
    !pwChecks.len ? "bg-rose-600" :
    pwChecks.typesCount <= 1 ? "bg-rose-600" :
    pwChecks.typesCount === 2 ? "bg-orange-500" :
    pwChecks.typesCount === 3 ? "bg-yellow-500" : "bg-emerald-500";

  function handleMicrosoftRegister() {
    window.location.href = `${API_BASE}/auth/microsoft/start?intent=register`;
  }

  function handleDiscordRegister() {
    window.location.href = `${API_BASE}/auth/discord/start?intent=register`;
  }

  useEffect(() => {
    if (oauthSlot || !GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

    let cancelled = false;
    let appendedScript: HTMLScriptElement | null = null;

    const handleGoogleCredential = async (response: { credential?: string }) => {
      const credential = response.credential?.trim();
      if (!credential) {
        setLocalError("Google sign-in did not return a credential.");
        return;
      }

      try {
        setSubmitting(true);
        setLocalError(null);
        setServerEmailErrors(null);
        setServerPwErrors(null);
        setVerifySent(false);

        const data = await postJSON<GoogleAuthOk>(
          "/auth/google",
          { credential },
          { credentials: "include" }
        );

        persistAuthSession(data.access_token, data.user, true);
        const from = (location.state as any)?.from as string | undefined;
        navigate(from && from !== "/register" ? from : "/", { replace: true });
      } catch (err: any) {
        const status = err?.status as number | undefined;
        if (status === 401) {
          setLocalError("Google sign-in was rejected. Please try again or use email registration.");
        } else if (status === 503) {
          setLocalError("Google sign-in is not configured on the backend yet.");
        } else {
          setLocalError(err?.message || "Google sign-in failed");
        }
      } finally {
        setSubmitting(false);
      }
    };

    const renderGoogleButton = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return;

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: "320",
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector('script[data-google-identity="true"]') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", renderGoogleButton, { once: true });
      return () => {
        cancelled = true;
        existingScript.removeEventListener("load", renderGoogleButton);
      };
    }

    appendedScript = document.createElement("script");
    appendedScript.src = "https://accounts.google.com/gsi/client";
    appendedScript.async = true;
    appendedScript.defer = true;
    appendedScript.dataset.googleIdentity = "true";
    appendedScript.addEventListener("load", renderGoogleButton, { once: true });
    document.head.appendChild(appendedScript);

    return () => {
      cancelled = true;
      appendedScript?.removeEventListener("load", renderGoogleButton);
    };
  }, [oauthSlot]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  async function handleResend() {
    setResendLoading(true);
    await postJSON("/auth/resend-verification", { email: email.trim() }).catch(() => {});
    setResendSent(true);
    setResendLoading(false);
    setResendCooldown(60);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setServerEmailErrors(null);
    setServerPwErrors(null);
    setVerifySent(false);
    setTriedSubmit(true);

    const problems = [
      email ? null : true,
      password ? null : true,
      confirm ? null : true,
      acceptTerms ? null : true,
      emailError,
      pwError,
      confirmError,
    ].filter(Boolean);

    if (problems.length) {
      // Inline errors already show at each field; no global banner needed
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
      return;
    }

    // Built-in backend integration
    try {
      setSubmitting(true);
      // Backend only needs email & password; extra fields are ignored server-side.
      await postJSON<RegisterOk>("/auth/register", {
        email: payload.email,
        password: payload.password,
      });
      setVerifySent(true);
    } catch (err: any) {
      const status = err?.status as number | undefined;
      const data = (err?.data ?? {}) as FieldErrors;

      if (status === 422 && data.field_errors) {
        if (data.field_errors.email?.length) setServerEmailErrors(data.field_errors.email);
        if (data.field_errors.password?.length) setServerPwErrors(data.field_errors.password);
        // Field errors shown inline; no global banner needed
      } else {
        setLocalError(err?.message || "Registration failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const content = (
    <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center">
            <img
              src={logo}
              alt="CougarAI"
              className="mx-auto mb-3 h-11 w-11 rounded-[9px] object-contain"
              style={{ border: '2px solid rgba(185,28,28,.4)', boxShadow: '0 0 18px rgba(185,28,28,.28)' }}
            />
            <h1 className="font-['Oxanium'] text-2xl font-bold tracking-tight text-white">
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-white/50">
              Join to access member features and events.
            </p>
          </div>

          {headerSlot ? <div className="mt-6">{headerSlot}</div> : null}

          {/* Success notice */}
          {verifySent && (
            <div className="mt-6 rounded-lg bg-emerald-900/30 px-4 py-3 text-sm text-emerald-200 ring-1 ring-inset ring-emerald-500/20">
              <p>Verification email sent to <span className="font-medium">{email.trim()}</span>. Please check your inbox.</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <Link to="/verify-email" className="underline decoration-emerald-300/60 hover:text-emerald-100">
                  Enter verification token
                </Link>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading || resendCooldown > 0}
                  className="underline decoration-emerald-300/40 hover:text-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading
                    ? "Sending…"
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend email"}
                </button>
              </div>
            </div>
          )}

          {/* OAuth (optional) */}
          {oauthSlot ? (
            <div className="mt-6">{oauthSlot}</div>
          ) : GOOGLE_CLIENT_ID ? (
            <div className="mt-6">
              <div ref={googleButtonRef} className="flex min-h-11 items-center justify-center" />
              {MICROSOFT_ENABLED ? (
                <button
                  type="button"
                  onClick={handleMicrosoftRegister}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white px-6 text-[15px] font-medium text-[#3c4043] shadow-[0_1px_2px_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] transition hover:bg-[#f8f9fa]"
                >
                  <MicrosoftLogo />
                  Continue with Microsoft
                </button>
              ) : null}
              {DISCORD_ENABLED ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={handleDiscordRegister}
                    className="relative inline-flex h-11 w-[320px] items-center justify-center rounded-full border border-[#5865F2]/40 bg-[#5865F2] px-4 text-[15px] font-medium text-white transition hover:bg-[#4752c4]"
                  >
                    <span className="absolute left-4"><DiscordLogo /></span>
                    Continue with Discord
                  </button>
                </div>
              ) : null}
            </div>
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
              {MICROSOFT_ENABLED ? (
                <button
                  type="button"
                  onClick={handleMicrosoftRegister}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white px-6 text-[15px] font-medium text-[#3c4043] shadow-[0_1px_2px_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] transition hover:bg-[#f8f9fa]"
                >
                  <MicrosoftLogo />
                  Continue with Microsoft
                </button>
              ) : null}
              {DISCORD_ENABLED ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={handleDiscordRegister}
                    className="relative inline-flex h-11 w-[320px] items-center justify-center rounded-full border border-[#5865F2]/40 bg-[#5865F2] px-4 text-[15px] font-medium text-white transition hover:bg-[#4752c4]"
                  >
                    <span className="absolute left-4"><DiscordLogo /></span>
                    Continue with Discord
                  </button>
                </div>
              ) : null}
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
                aria-invalid={!!(emailError || serverEmailErrors?.length)}
                aria-describedby={emailError || serverEmailErrors?.length ? "email-error" : undefined}
              />
              {emailError && (
                <p id="email-error" className="mt-1 text-xs text-rose-300">
                  {emailError}
                </p>
              )}
              {!emailError && serverEmailErrors?.length ? (
                <p id="email-error" className="mt-1 text-xs text-rose-300">
                  {serverEmailErrors[0]}
                </p>
              ) : null}
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
                aria-invalid={!!(pwError || serverPwErrors?.length)}
                aria-describedby={pwError || serverPwErrors?.length ? "password-error password-help" : "password-help"}
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
              {!pwError && serverPwErrors?.length ? (
                <p id="password-error" className="mt-1 text-xs text-rose-300">
                  {serverPwErrors[0]}
                </p>
              ) : null}
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
                  <Link to="/terms" className="font-medium text-red-400 hover:text-red-300">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="font-medium text-red-400 hover:text-red-300">
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-red-600/30 transition hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 0 20px rgba(185,28,28,.35)' }}
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
          {footerSlot ?? (
            <p className="mt-6 text-center text-sm text-neutral-300">
              Already have an account?{" "}
              <Link to="/auth?mode=login" className="font-medium text-red-400 hover:text-red-300">
                Sign in
              </Link>
            </p>
          )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl items-center justify-center px-6 py-16 sm:py-20">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl backdrop-blur"
        style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}
      >
        <div className="h-[3px] bg-gradient-to-r from-red-700 via-red-600 to-red-700" />
        {content}
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
