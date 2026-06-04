import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getStoredUser, persistAuthSession } from "@/lib/auth";

const API_BASE = import.meta.env?.VITE_BACKEND_API_URL ?? "";

type RefreshOk = { access_token: string };

export default function AuthSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storedUser = getStoredUser();
  const [error, setError] = useState<string | null>(null);

  const queryUser = useMemo(() => {
    const email = (searchParams.get("email") || "").trim();
    const userId = Number(searchParams.get("user_id") || 0);
    const role = (searchParams.get("role") || "").trim() || undefined;
    const onboardingCompleted = (searchParams.get("onboarding_completed") || "").trim() === "true";
    const provider = (searchParams.get("provider") || "").trim();
    return email && userId
      ? {
          email,
          user_id: userId,
          role,
          onboarding_completed: onboardingCompleted,
          provider: provider === "microsoft" || provider === "discord" ? provider : undefined,
        }
      : null;
  }, [searchParams]);

  const user = storedUser ?? queryUser;

  useEffect(() => {
    const provider = (searchParams.get("provider") || "").trim();
    const accessToken = (searchParams.get("access_token") || "").trim();

    const isOAuthRedirect = (provider === "microsoft" || provider === "discord") && !!queryUser && !storedUser;

    if (!isOAuthRedirect) {
      const timeout = window.setTimeout(() => {
        navigate("/", { replace: true });
      }, 1800);
      return () => window.clearTimeout(timeout);
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        let token = accessToken;
        if (!token) {
          const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: "POST",
            credentials: "include",
          });
          const data = (await res.json().catch(() => ({}))) as Partial<RefreshOk>;
          if (!res.ok || !data.access_token) {
            throw new Error(`We couldn't finish ${provider} sign-in.`);
          }
          token = data.access_token;
        }

        if (!cancelled) {
          persistAuthSession(token, queryUser, true);
          navigate("/", { replace: true });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || `We couldn't finish ${provider} sign-in.`);
        }
      }
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [navigate, queryUser, searchParams, storedUser]);

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-4xl items-center justify-center px-6 py-16 sm:py-20">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-neutral-900/75 p-8 text-center shadow-xl ring-1 ring-white/10 backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
          <svg aria-hidden viewBox="0 0 24 24" className="h-8 w-8 text-emerald-300">
            <path
              fill="currentColor"
              d="M9.55 18.2 4.8 13.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4Z"
            />
          </svg>
        </div>
        <h1 className="mt-6 font-['Oxanium'] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Login successful
        </h1>
        <p className="mt-3 text-sm text-neutral-300 sm:text-base">
          {user ? `You are signed in as ${user.email}.` : "Your account is ready to go."}
        </p>
        <p className="mt-2 text-sm text-white/50">{error ? error : "Taking you back to the site now."}</p>

        <div className="mt-8 flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-rose-400/30 transition hover:bg-red-600"
          >
            Continue to home
          </Link>
        </div>
      </div>
    </div>
  );
}
