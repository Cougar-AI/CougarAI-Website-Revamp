import { useEffect, useState } from "react";

export default function VerifyEmail() {
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    // TODO: wire to POST /auth/verify-email with token
    // For now, mark as pending until backend is wired
    setStatus("pending");
  }, []);

  return (
    <main className="relative min-h-screen font-['Oxanium'] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/5 border border-white/10 p-8 backdrop-blur text-center">
        <h1 className="text-2xl font-semibold text-white mb-4">Verify Your Email</h1>

        {status === "pending" && (
          <p className="text-white/60">
            We sent a verification link to your email address. Click the link to activate your account.
          </p>
        )}
        {status === "success" && (
          <p className="text-emerald-400 font-semibold">
            Email verified! You can now log in.
          </p>
        )}
        {status === "error" && (
          <p className="text-rose-400">
            Invalid or missing verification token. Please request a new link.
          </p>
        )}

        <div className="mt-6">
          <a href="/login" className="text-sm text-white/50 hover:text-white transition">
            Go to Login
          </a>
        </div>
      </div>
    </main>
  );
}
