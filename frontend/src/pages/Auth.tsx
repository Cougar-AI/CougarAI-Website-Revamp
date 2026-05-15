import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import Login from "./Login";
import Registration from "./Registration";

type AuthMode = "login" | "register";

function SlidingAuthToggle({ mode }: { mode: AuthMode }) {
  const isLogin = mode === "login";

  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="relative grid h-12 grid-cols-2 rounded-full border border-red-500/20 bg-black/20 p-1 shadow-[0_16px_36px_rgba(0,0,0,0.32)] backdrop-blur">
        <div
          aria-hidden
          className={cn(
            "absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-r from-red-700 via-red-600 to-red-500 shadow-[0_10px_26px_rgba(185,28,28,0.45)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isLogin ? "translate-x-1" : "translate-x-[calc(100%+3px)]"
          )}
        />
        <Link
          to="/auth?mode=login"
          className={cn(
            "relative z-10 inline-flex items-center justify-center rounded-full px-4 text-sm font-semibold transition sm:text-base",
            isLogin ? "text-white" : "text-white/70 hover:text-white"
          )}
        >
          Login
        </Link>
        <Link
          to="/auth?mode=register"
          className={cn(
            "relative z-10 inline-flex items-center justify-center rounded-full px-4 text-sm font-semibold transition sm:text-base",
            isLogin ? "text-white/70 hover:text-white" : "text-white"
          )}
        >
          Signup
        </Link>
      </div>
    </div>
  );
}

function FooterHint({ mode }: { mode: AuthMode }) {
  const isLogin = mode === "login";

  return (
    <p className="mt-6 text-center text-sm text-neutral-300">
      {isLogin ? "First time here? " : "Already have access? "}
      <Link
        to={isLogin ? "/auth?mode=register" : "/auth?mode=login"}
        className="font-medium text-red-400 hover:text-red-300"
      >
        {isLogin ? "Create your account" : "Sign in instead"}
      </Link>
    </p>
  );
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const mode: AuthMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [displayMode, setDisplayMode] = useState<AuthMode>(mode);
  const [phase, setPhase] = useState<"enter" | "exit">("enter");

  useEffect(() => {
    if (mode === displayMode) {
      setPhase("enter");
      return;
    }

    setPhase("exit");
    const timeout = window.setTimeout(() => {
      setDisplayMode(mode);
      setPhase("enter");
    }, 170);

    return () => window.clearTimeout(timeout);
  }, [displayMode, mode]);

  const activeMode = displayMode;
  const toggle = <SlidingAuthToggle mode={mode} />;
  const activeFooter = <FooterHint mode={activeMode} />;

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl items-center justify-center px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl backdrop-blur"
        style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 20px 60px rgba(0,0,0,.6)" }}
      >
        <div className="h-[3px] bg-gradient-to-r from-red-800 via-red-600 to-red-700" />

        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          {toggle}
        </div>

        <div
          className={cn(
            "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            phase === "exit"
              ? "translate-y-2 scale-[0.985] opacity-0"
              : "translate-y-0 scale-100 opacity-100"
          )}
        >
          {activeMode === "login" ? (
            <Login embedded footerSlot={activeFooter} />
          ) : (
            <Registration embedded footerSlot={activeFooter} />
          )}
        </div>
      </div>
    </div>
  );
}
