import { useState } from "react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: wire to POST /auth/forgot-password
    setSubmitted(true);
  }

  return (
    <main className="relative min-h-screen font-['Oxanium'] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/5 border border-white/10 p-8 backdrop-blur">
        <h1 className="text-2xl font-semibold text-white text-center mb-2">Forgot Password</h1>
        <p className="text-white/60 text-sm text-center mb-6">
          Enter your email and we'll send you a reset link.
        </p>

        {submitted ? (
          <p className="text-center text-emerald-400 font-semibold">
            If that email is registered, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-600"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-rose-700 py-3 font-semibold text-white shadow hover:brightness-110 transition"
            >
              Send Reset Link
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <a href="/login" className="text-sm text-white/50 hover:text-white transition">
            Back to Login
          </a>
        </div>
      </div>
    </main>
  );
}
