import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const BACKEND = (import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001").replace(/\/$/, "");

type Status = "loading" | "success" | "already_verified" | "error";

export default function VerifyEmail() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      return;
    }

    fetch(`${BACKEND}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({})) as { error?: string };
        if (res.ok) {
          setStatus("success");
        } else if (data?.error === "already_verified") {
          setStatus("already_verified");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <main className="relative min-h-screen font-['Oxanium'] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/5 border border-white/10 p-8 backdrop-blur text-center">
        <h1 className="text-2xl font-semibold text-white mb-4">Verify Your Email</h1>
        <p className="mb-5 text-sm text-white/55">
          If you don't see the verification email, check your spam or promotions folder.
        </p>

        {status === "loading" && (
          <p className="text-white/60">Verifying your email…</p>
        )}

        {status === "success" && (
          <>
            <p className="text-emerald-400 font-semibold mb-4">
              Email verified! Your account is now active.
            </p>
            <Link
              to="/login"
              className="inline-block rounded-xl bg-red-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition"
              style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
            >
              Go to Login
            </Link>
          </>
        )}

        {status === "already_verified" && (
          <>
            <p className="text-white/70 mb-4">
              Your email is already verified. You can log in now.
            </p>
            <Link
              to="/login"
              className="inline-block rounded-xl bg-red-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition"
              style={{ boxShadow: "0 0 20px rgba(185,28,28,.35)" }}
            >
              Go to Login
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-rose-400 mb-4">
              This verification link is invalid or has expired. Please request a new one.
            </p>
            <Link
              to="/login"
              className="inline-block text-sm text-white/50 hover:text-white transition"
            >
              Back to Login
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
