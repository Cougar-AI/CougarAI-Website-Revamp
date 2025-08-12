import { useMemo, useState } from "react";

const EMAIL = "cougaraicontact@gmail.com";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const subject = useMemo(() => `CougarAI contact — ${name || "(no name)"}`.slice(0, 140), [name]);
  const body = useMemo(() => {
    const parts = [message.trim() || "(no message)"]; 
    const sig = [`\n\n— Sent from Contact page`, name && `Name: ${name}`, email && `Email: ${email}`]
      .filter(Boolean)
      .join("\n");
    return `${parts.join("\n")}\n${sig}`;
  }, [message, name, email]);

  function onCopy() {
    navigator.clipboard.writeText(EMAIL).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Use location assign so mobile email clients open reliably
    window.location.href = href;
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Heading */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-[--accent] via-[--accent2] to-[--accent3] bg-clip-text text-transparent">
            Contact CougarAI
          </span>
        </h1>
        <p className="mt-4 text-white/80">
          Whether it’s a sponsorship inquiry, workshop idea, or quick question—reach out. We read every message.
        </p>
      </header>

      {/* Quick email card */}
      <section
        aria-label="Email us"
        className="relative mb-10 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/5"
      >
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-white/60">Direct email</p>
            <a
              href={`mailto:${EMAIL}`}
              className="mt-1 inline-block text-xl font-semibold underline decoration-[--accent] decoration-2 underline-offset-4 hover:decoration-[--accent2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            >
              {EMAIL}
            </a>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`mailto:${EMAIL}`}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-white/15 transition active:scale-[.98] md:min-w-28 bg-gradient-to-r from-[--accent] to-[--accent2] text-white hover:brightness-110"
            >
              ✉️ Email us
            </a>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-white/90 ring-1 ring-white/15 hover:bg-white/10 active:scale-[.98]"
            >
              📋 Copy
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm text-emerald-400/90" aria-live="polite" role="status">
          {copied ? "Email address copied to clipboard." : " "}
        </p>

        {/* ambient accent glow */}
        <div aria-hidden className="pointer-events-none absolute -inset-24 -z-10 opacity-30 blur-3xl">
          <div className="size-full bg-[conic-gradient(at_30%_40%,theme(colors.rose.700/.35),theme(colors.blue.600/.35),theme(colors.green.500/.35),transparent_60%)]" />
        </div>
      </section>

      {/* Mailto form (client-side) */}
      <section aria-label="Contact form" className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/5">
        <h2 className="text-xl font-semibold">Send a message</h2>
        <p className="mt-2 text-sm text-white/70">
          This uses your default email app—no account required.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="mb-1 block text-sm text-white/80">
              Name
            </label>
            <input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none ring-0 focus:border-[--accent]"
              autoComplete="name"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-white/80">
              Email <span className="text-white/50">(so we can reply)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="ada@example.com"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none ring-0 focus:border-[--accent]"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="message" className="mb-1 block text-sm text-white/80">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              placeholder="Tell us how we can help…"
              className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none ring-0 focus:border-[--accent]"
            />
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[--accent] to-[--accent2] px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 active:scale-[.98]"
            >
              Open in email app
            </button>
            <p className="text-xs text-white/60">
              Submitting opens a pre-filled email to {EMAIL}.
            </p>
          </div>
        </form>
      </section>

      {/* Extra contact avenues (optional links) */}
      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <a
          href="/membership"
          className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-white/90 no-underline shadow-sm transition hover:bg-white/[0.08]"
        >
          <p className="text-sm uppercase tracking-wide text-white/60">New here?</p>
          <p className="mt-1 text-lg font-semibold">Become a member</p>
          <p className="mt-2 text-sm text-white/70">Join workshops, projects, and a friendly community.</p>
          <span className="mt-3 inline-block text-sm text-[--accent2] group-hover:translate-x-0.5">Learn more →</span>
        </a>
        <a
          href="/sponsorships"
          className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-white/90 no-underline shadow-sm transition hover:bg-white/[0.08]"
        >
          <p className="text-sm uppercase tracking-wide text-white/60">Partner with us</p>
          <p className="mt-1 text-lg font-semibold">Sponsorships</p>
          <p className="mt-2 text-sm text-white/70">Collaborate on events, talks, and student projects.</p>
          <span className="mt-3 inline-block text-sm text-[--accent2] group-hover:translate-x-0.5">View details →</span>
        </a>
      </section>
    </div>
  );
}
