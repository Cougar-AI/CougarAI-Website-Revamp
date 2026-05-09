import { useMemo, useState } from "react";

const EMAIL = "cougaraicontact@gmail.com";

export default function Sponsorships() {
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const subject = useMemo(
    () => `Sponsorship Inquiry — ${company || "(company)"}`.slice(0, 140),
    [company]
  );

  const body = useMemo(() => {
    const parts = [
      company && `Company: ${company}`,
      contact && `Contact name: ${contact}`,
      email && `Reply-to: ${email}`,
      "",
      message.trim() || "(no message)",
    ]
      .filter((l) => l !== undefined)
      .join("\n");
    return parts;
  }, [company, contact, email, message]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  return (
    <main className="relative min-h-screen font-['Oxanium']">
      <div className="mx-auto max-w-2xl px-4 pt-16 pb-24">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-semibold text-white">Become a Sponsor</h1>
          <p className="mt-3 text-white/70 text-base">
            Partner with CougarAI and help shape the next generation of AI talent at UH.
            Fill out the form below and we'll be in touch.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl bg-white/5 border border-white/10 p-8 backdrop-blur"
        >
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-1">
              Company / Organization <span className="text-rose-400">*</span>
            </label>
            <input
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Corp"
              className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white/80 mb-1">
              Your Name
            </label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Jane Smith"
              className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white/80 mb-1">
              Reply-to Email <span className="text-rose-400">*</span>
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@acme.com"
              className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white/80 mb-1">
              Message
            </label>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us about your company and how you'd like to partner with us…"
              className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-600 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-rose-700 py-3 font-semibold text-white shadow hover:brightness-110 transition"
          >
            Send Inquiry
          </button>
          <p className="text-center text-xs text-white/40">
            This opens your email client pre-filled for {EMAIL}
          </p>
        </form>
      </div>
    </main>
  );
}
