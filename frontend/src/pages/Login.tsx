import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { persistAuthSession } from "@/lib/auth";
import logo from "../assets/logo.png";

export type LoginProps = {
  onSubmit?: (payload: { email: string; password: string; remember: boolean }) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
  embedded?: boolean;
  headerSlot?: React.ReactNode;
  /** Optional slot for an OAuth section (e.g., Google button) */
  oauthSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
};

type LoginOk = { access_token: string; user: { user_id: number; email: string; role?: string; onboarding_completed?: boolean } };
type ResendOk = { ok: boolean };
type GoogleLoginPayload = LoginOk;

const API_BASE = import.meta.env?.VITE_BACKEND_API_URL ?? ""; // leave "" for same-origin
const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? "";
const MICROSOFT_ENABLED = import.meta.env?.VITE_ENABLE_MICROSOFT_OAUTH === "true";
const DISCORD_ENABLED = import.meta.env?.VITE_ENABLE_DISCORD_OAUTH === "true";
const SOCIAL_BUTTON_CLASS =
  "relative inline-flex h-11 w-[320px] items-center justify-center rounded-full border border-[#dadce0] bg-white px-4 text-[14px] font-medium leading-none text-[#3c4043] shadow-[0_1px_2px_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] transition hover:bg-[#f8f9fa]";

function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]">
      <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.42-.22-2.04H12.24v3.71h6.43c-.13.92-.83 2.31-2.38 3.24l-.02.13 3.46 2.68.24.02c2.2-2.03 3.52-5.02 3.52-7.74Z" />
      <path fill="#34A853" d="M12.24 24c3.19 0 5.87-1.05 7.83-2.85l-3.73-2.89c-1 .65-2.34 1.1-4.1 1.1-3.13 0-5.78-2.03-6.73-4.85l-.12.01-3.65 2.82-.05.1C2.68 21.63 7.1 24 12.24 24Z" />
      <path fill="#FBBC05" d="M5.51 14.51a7.35 7.35 0 0 1-.39-2.35c0-.82.14-1.61.37-2.35l-.01-.16-3.7-2.87-.12.06A11.77 11.77 0 0 0 0 12.16c0 1.9.46 3.69 1.26 5.27l4.25-2.92Z" />
      <path fill="#EA4335" d="M12.24 4.75c2.22 0 3.71.95 4.56 1.73l3.33-3.25C18.09 1.2 15.42 0 12.24 0 7.1 0 2.68 2.37 1.26 6.89l4.24 2.93c.95-2.82 3.6-4.86 6.74-4.86Z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]">
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

export default function Login({
  onSubmit,
  loading: loadingProp,
  error: errorProp,
  embedded = false,
  headerSlot,
  oauthSlot,
  footerSlot,
}: LoginProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);

  // Local submit state only if parent didn't pass loading
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Resend verification flow state
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const loading = loadingProp ?? submitting;
  const error = errorProp ?? localError;

  const emailError = useMemo(() => {
    if (!email) return null;
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    return ok ? null : "Enter a valid email";
  }, [email]);

  const pwError = useMemo(() => {
    if (!password) return null;
    return password.length >= 6 ? null : "Password must be at least 6 characters";
  }, [password]);

  function handleMicrosoftLogin() {
    window.location.href = `${API_BASE}/auth/microsoft/start?intent=login`;
  }

  function handleDiscordLogin() {
    window.location.href = `${API_BASE}/auth/discord/start?intent=login`;
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
        setResent(false);

        const data = await postJSON<GoogleLoginPayload>(
          "/auth/google",
          { credential },
          { credentials: "include" }
        );

        persistAuthSession(data.access_token, { ...data.user, provider: "google" }, remember);
        const from = (location.state as any)?.from as string | undefined;
        navigate(from && from !== "/login" ? from : "/", { replace: true });
      } catch (err: any) {
        const status = err?.status as number | undefined;
        if (status === 401) {
          setLocalError("Google sign-in was rejected. Please try again or use your password.");
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
  }, [oauthSlot, remember]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setResent(false);

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
      return;
    }

    // Built-in backend integration
    try {
      setSubmitting(true);
      const data = await postJSON<LoginOk>(
        "/auth/login",
        { email: email.trim(), password },
        { credentials: "include" } // crucial for the HttpOnly refresh cookie
      );
      persistAuthSession(data.access_token, { ...data.user, provider: "credentials" }, remember);
      setLocalError(null);
      const from = (location.state as any)?.from as string | undefined;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (err: any) {
      const status = err?.status as number | undefined;
      if (status === 401) {
        // Backend intentionally hides reason (unverified, inactive, or wrong creds)
        setLocalError(
          "Invalid email or password. If you just created your account, please verify your email first."
        );
      } else {
        setLocalError(err?.message || "Sign in failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!email || emailError) {
      setLocalError("Enter your email above, then tap Resend.");
      return;
    }
    setResending(true);
    setLocalError(null);
    try {
      await postJSON<ResendOk>("/auth/resend-verification", { email: email.trim() });
      setResent(true);
    } catch (err: any) {
      // Endpoint always returns 200, but handle just in case.
      setLocalError(err?.message || "Could not resend verification email");
    } finally {
      setResending(false);
    }
  }

  const content = (
    <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center">
            <img
              src={logo}
              alt="CougarAI"
              className="mx-auto mb-3 h-12 w-12 rounded-[10px] object-contain"
              style={{ border: '2px solid rgba(185,28,28,.4)', boxShadow: '0 0 20px rgba(185,28,28,.3)' }}
            />
            <h1 className="font-['Oxanium'] text-3xl font-bold tracking-tight text-white">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-white/50">Sign in to access member features and events.</p>
          </div>

          {headerSlot ? <div className="mt-6">{headerSlot}</div> : null}

          {/* OAuth (optional) */}
          {oauthSlot ? (
            <div className="mt-6">{oauthSlot}</div>
          ) : GOOGLE_CLIENT_ID ? (
            <div className="mt-6">
              <div className="flex justify-center">
                <div className="relative h-11 w-[320px]">
                  <div
                    className={`${SOCIAL_BUTTON_CLASS} pointer-events-none w-full`}
                    style={{ fontFamily: "Roboto, Arial, sans-serif" }}
                  >
                    <span className="absolute left-[21px] top-1/2 -translate-y-1/2">
                      <GoogleLogo />
                    </span>
                    Continue with Google
                  </div>
                  <div
                    ref={googleButtonRef}
                    className="absolute inset-0 overflow-hidden rounded-full opacity-0"
                    aria-hidden="true"
                  />
                </div>
              </div>
              {MICROSOFT_ENABLED ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={handleMicrosoftLogin}
                    className={SOCIAL_BUTTON_CLASS}
                    style={{ fontFamily: "Roboto, Arial, sans-serif" }}
                  >
                    <span className="absolute left-[21px] top-1/2 -translate-y-1/2">
                      <MicrosoftLogo />
                    </span>
                    Continue with Microsoft
                  </button>
                </div>
              ) : null}
              {DISCORD_ENABLED ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={handleDiscordLogin}
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
              {/* Example Google button (disabled by default). Replace href with your provider route. */}
              <button
                type="button"
                disabled
                title="Wire this up to your OAuth route"
                className={`${SOCIAL_BUTTON_CLASS} w-full disabled:cursor-not-allowed disabled:opacity-60`}
                style={{ fontFamily: "Roboto, Arial, sans-serif" }}
              >
                <span className="absolute left-[21px] top-1/2 -translate-y-1/2">
                  <GoogleLogo />
                </span>
                Continue with Google
              </button>
              {MICROSOFT_ENABLED ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={handleMicrosoftLogin}
                    className={SOCIAL_BUTTON_CLASS}
                    style={{ fontFamily: "Roboto, Arial, sans-serif" }}
                  >
                    <span className="absolute left-[21px] top-1/2 -translate-y-1/2">
                      <MicrosoftLogo />
                    </span>
                    Continue with Microsoft
                  </button>
                </div>
              ) : null}
              {DISCORD_ENABLED ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={handleDiscordLogin}
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
                className="text-sm font-medium text-red-400 hover:text-red-300"
              >
                Forgot password?
              </Link>
            </div>

            {localError && (
              <div className="rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-500/20">
                {localError}
                {/* Offer resend option on generic invalid creds scenario */}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="text-xs underline decoration-rose-300/60 hover:text-rose-100 disabled:opacity-60"
                  >
                    {resending ? "Resending…" : "Resend verification email"}
                  </button>
                  {resent && <span className="text-xs text-emerald-300">Sent!</span>}
                </div>
              </div>
            )}

            {!localError && error && (
              <div className="rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-500/20">
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
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Footer */}
          {footerSlot ?? (
            <p className="mt-6 text-center text-sm text-neutral-300">
              Need an account?{" "}
              <Link to="/auth?mode=register" className="font-medium text-red-400 hover:text-red-300">
                Create one
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
