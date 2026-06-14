import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const EMAIL = "cougaraicontact@gmail.com";

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 11,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(0,0,0,.35)",
  color: "#fff", fontSize: 14, outline: "none",
  transition: "border-color .15s, box-shadow .15s",
  fontFamily: "Oxanium,sans-serif",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, color: "rgba(255,255,255,.65)", marginBottom: 7, fontWeight: 500,
};
const glass: React.CSSProperties = {
  borderRadius: 18, background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(185,28,28,.18)",
  backdropFilter: "blur(10px)", padding: "24px 26px",
};

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const subject = useMemo(() => `CougarAI contact — ${name || "(no name)"}`.slice(0, 140), [name]);
  const body = useMemo(() => {
    const msg = message.trim() || "(no message)";
    const sig = ["\n\n— Sent from Contact page", name && `Name: ${name}`, email && `Reply-to: ${email}`]
      .filter(Boolean).join("\n");
    return `${msg}${sig}`;
  }, [name, email, message]);

  function onCopy() {
    navigator.clipboard.writeText(EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "52px 20px 90px" }}>

      {/* Header */}
      <header style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontFamily: "Oxanium,sans-serif", fontSize: "clamp(28px,4.5vw,48px)", fontWeight: 800, letterSpacing: "-.025em", margin: "0 0 14px", color: "#fff" }}>
          Contact CougarAI
        </h1>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: 16, lineHeight: 1.65, maxWidth: 480, margin: "0 auto" }}>
          Whether it's a sponsorship inquiry, workshop idea, or quick question — reach out. We read every message.
        </p>
      </header>

      {/* Direct email card */}
      <div style={{ ...glass, marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 120% at 20% 50%,rgba(185,28,28,.12),transparent 65%)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.38)", marginBottom: 6, fontFamily: "Oxanium,sans-serif" }}>Direct Email</div>
            <a href={`mailto:${EMAIL}`} style={{ fontSize: 18, fontWeight: 700, color: "#fff", textDecoration: "underline", textDecorationColor: "rgba(185,28,28,.5)", textUnderlineOffset: 4 }}>
              {EMAIL}
            </a>
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <a href={`mailto:${EMAIL}`} style={{ background: "#b91c1c", color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 0 18px rgba(185,28,28,.4)", textDecoration: "none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Email us
            </a>
            <button onClick={onCopy} style={{ background: "rgba(255,255,255,.08)", color: "#fff", padding: "10px 16px", borderRadius: 10, fontWeight: 600, fontSize: 13.5, border: "1px solid rgba(255,255,255,.13)", display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        {copied && <div style={{ position: "relative", zIndex: 1, marginTop: 10, fontSize: 13, color: "rgba(110,230,130,.85)", fontWeight: 500 }}>Email address copied to clipboard.</div>}
      </div>

      {/* Contact form */}
      <div style={{ ...glass, marginBottom: 16 }}>
        <h2 style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 700, fontSize: 18, margin: "0 0 6px", color: "#fff" }}>Send a message</h2>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 13.5, margin: "0 0 22px" }}>Opens a pre-filled draft in your email app — no account required.</p>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" style={fieldStyle} autoComplete="name" />
            </div>
            <div>
              <label style={labelStyle}>Email <span style={{ color: "rgba(255,255,255,.35)", fontSize: 12 }}>(so we can reply)</span></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ada@example.com" style={fieldStyle} required autoComplete="email" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us how we can help…" rows={6} style={{ ...fieldStyle, display: "block", resize: "vertical" }} required />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <button type="submit" style={{ background: "#b91c1c", color: "#fff", padding: "12px 26px", borderRadius: 11, fontWeight: 700, fontSize: 14.5, border: "none", boxShadow: "0 0 22px rgba(185,28,28,.4)", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Open in email app
            </button>
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.38)" }}>Sends to {EMAIL}</span>
          </div>

          {sent && <div style={{ fontSize: 13.5, color: "rgba(110,230,130,.85)", fontWeight: 500 }}>Your email client should be opening now.</div>}
        </form>
      </div>

      {/* Bottom cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "New here?", title: "Become a member", desc: "Join workshops, projects, and a friendly community.", to: "/join" },
          { label: "Partner with us", title: "Sponsorships", desc: "Collaborate on events, talks, and student projects.", to: "/sponsorships" },
        ].map((c) => (
          <Link
            key={c.title}
            to={c.to}
            style={{ ...glass, padding: "20px", display: "block", transition: "background .15s, border-color .15s", textDecoration: "none", color: "inherit" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.07)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(185,28,28,.35)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(185,28,28,.18)"; }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6, fontFamily: "Oxanium,sans-serif" }}>{c.label}</div>
            <div style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8, color: "#fff" }}>{c.title}</div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.55)", lineHeight: 1.55, marginBottom: 12 }}>{c.desc}</div>
            <span style={{ fontSize: 13, color: "rgba(220,38,38,.8)", fontWeight: 600 }}>Learn more →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
