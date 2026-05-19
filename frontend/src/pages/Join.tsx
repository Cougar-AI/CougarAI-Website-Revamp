import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { hasAccessToken } from "@/lib/auth";

/**
 * JoinUs page (aligned with Memberships page)
 * - Two paid plans: Semester ($15) and Yearly ($25)
 * - Preselects plan via query (?plan=semester|yearly)
 * - Captures member details
 * - Creates/updates member in your DB
 * - Starts Stripe Checkout for the chosen plan
 *
 * Required backend endpoints (adjust paths):
 * 1) POST /api/members/join
 *    Body: {
 *      first_name, last_name, email,
 *      student_id?, graduation_year?,
 *      plan_id
 *    }
 *    Returns: { user_id }
 *
 * 2) POST /api/billing/create-checkout-session
 *    Body: { price_id, user_id, plan_id, success_url, cancel_url }
 *    Returns: { sessionId } OR { url }
 *
 * ENV:
 * - VITE_STRIPE_PUBLISHABLE_KEY (public)
 */

const _stripeMode = (import.meta.env.VITE_STRIPE_MODE ?? "test") as "test" | "live";
const PUBLISHABLE_KEY = (
  _stripeMode === "test"
    ? import.meta.env.VITE_STRIPE_TEST_PUBLISHABLE_KEY
    : import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
) as string | undefined;
const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001";

const PRICE_IDS = {
  semester: { live: "price_1S4sVLH2XIQuLIalBvif5rrs", test: "price_1RPA0wQdq5f9y5dILdnU8jkY" },
  yearly:   { live: "price_1S0ylVH2XIQuLIalbpMXxrV9", test: "price_1RPA1MQdq5f9y5dIX6qzElLY" },
};

const PLANS = [
  {
    id: "semester",
    name: "Semester",
    tagline: "Full member access for one semester.",
    priceLabel: "$15 / sem",
    priceId: PRICE_IDS.semester[_stripeMode],
    dbPlanId: 1,
    features: [
      "All workshops & events",
      "Member rewards eligibility",
      "Great for trying us out",
    ],
  },
  {
    id: "yearly",
    name: "Yearly",
    tagline: "Best value for active members.",
    priceLabel: "$25 / year",
    priceId: PRICE_IDS.yearly[_stripeMode],
    dbPlanId: 2,
    features: [
      "Everything in Semester",
      "Priority for project teams",
      "Saves vs. two semesters",
    ],
  },
] as const;

type PlanId = typeof PLANS[number]["id"];

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NEXT_STEPS = [
  { step: "1", title: "Check your email", text: "Your payment receipt from Stripe is on its way." },
  { step: "2", title: "Join our Discord", text: "Head to our Discord and grab your member role to unlock all channels.", link: { label: "Open Discord →", href: "https://discord.gg/ucd5ZnDDnf" } },
  { step: "3", title: "Attend an event", text: "Check the calendar for upcoming workshops, build nights, and speaker events.", link: { label: "View calendar →", href: "/calendar" } },
];

function SuccessView() {
  return (
    <div className="mx-auto max-w-3xl text-white">
      <div className="text-center mb-10">
        <div
          className="inline-flex h-20 w-20 items-center justify-center rounded-full mb-6 text-red-400"
          style={{ background: "rgba(185,28,28,.15)", border: "1px solid rgba(185,28,28,.4)", boxShadow: "0 0 40px rgba(185,28,28,.25)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 36, height: 36 }}>
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="font-['Oxanium'] text-4xl font-extrabold tracking-tight mb-3">You're in!</h1>
        <p className="text-lg text-white/70 max-w-md mx-auto">
          Your membership is confirmed. Welcome to CougarAI — let's build something great.
        </p>
      </div>

      <div
        className="rounded-2xl p-8 mb-6"
        style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(185,28,28,.2)", backdropFilter: "blur(10px)" }}
      >
        <h2 className="font-['Oxanium'] text-xl font-bold mb-6">What's next?</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {NEXT_STEPS.map(({ step, title, text, link }) => (
            <div
              key={step}
              className="rounded-xl p-5"
              style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-['Oxanium'] text-sm font-bold text-red-400"
                  style={{ background: "rgba(185,28,28,.15)", border: "1px solid rgba(185,28,28,.35)" }}
                >
                  {step}
                </span>
                <h3 className="font-['Oxanium'] text-sm font-bold text-white">{title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-white/60 mb-2">{text}</p>
              {link && (
                <a
                  href={link.href}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  {link.label}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href="https://discord.gg/ucd5ZnDDnf"
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          style={{ background: "#b91c1c", boxShadow: "0 0 24px rgba(185,28,28,.4)" }}
        >
          Join Discord
        </a>
        <Link
          to="/"
          className="flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/10"
          style={{ background: "rgba(255,255,255,.06)" }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

function CanceledView() {
  return (
    <div className="mx-auto max-w-lg text-center text-white">
      <div
        className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-6 text-white/40"
        style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" }}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 28, height: 28 }}>
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="font-['Oxanium'] text-3xl font-extrabold mb-3">Checkout canceled</h1>
      <p className="text-white/60 mb-8">No worries — your spot is still here whenever you're ready.</p>
      <Link
        to="/join"
        className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
        style={{ background: "#b91c1c", boxShadow: "0 0 24px rgba(185,28,28,.4)" }}
      >
        Try again
      </Link>
    </div>
  );
}

function NotLoggedInView() {
  return (
    <div className="mx-auto max-w-lg text-center text-white py-12">
      <div
        className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-6 text-red-400"
        style={{ background: "rgba(185,28,28,.15)", border: "1px solid rgba(185,28,28,.4)" }}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 28, height: 28 }}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h1 className="font-['Oxanium'] text-3xl font-extrabold mb-3">Account required</h1>
      <p className="text-white/60 mb-8">
        You'll need a CougarAI account before purchasing a membership. Create one — it's free and only takes a minute.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/auth?mode=register"
          state={{ from: "/join" }}
          className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          style={{ background: "#b91c1c", boxShadow: "0 0 24px rgba(185,28,28,.4)" }}
        >
          Create account
        </Link>
        <Link
          to="/auth?mode=login"
          state={{ from: "/join" }}
          className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/10"
          style={{ background: "rgba(255,255,255,.06)" }}
        >
          Log in
        </Link>
      </div>
    </div>
  );
}

export default function JoinUs() {
  const urlStatus = new URLSearchParams(window.location.search).get("status");

  if (urlStatus === "success") return <SuccessView />;
  if (urlStatus === "canceled") return <CanceledView />;
  if (!hasAccessToken()) return <NotLoggedInView />;

  // Read ?plan= from URL, fallback to "semester"
  const initialPlan = ((): PlanId => {
    const p = new URLSearchParams(window.location.search).get("plan")?.toLowerCase();
    return (p === "yearly" ? "yearly" : "semester") as PlanId;
  })();

  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [student_id, setStudent_id] = useState("");
  const [gradLevel, setGradLevel] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = useMemo(() => PLANS.find((p) => p.id === plan)!, [plan]);

  async function ensureStripe() {
    if (!PUBLISHABLE_KEY) throw new Error("Missing VITE_STRIPE_PUBLISHABLE_KEY");
    const stripe = await loadStripe(PUBLISHABLE_KEY);
    if (!stripe) throw new Error("Stripe failed to load");
    return stripe;
  }

  function validate(): string | null {
    if (!first.trim()) return "Please enter your first name.";
    if (!last.trim()) return "Please enter your last name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Please enter a valid email.";
    if (!agree) return "Please agree to the Code of Conduct.";
    if (!gradLevel) return "Please select your academic level.";
    if (student_id && !/^\d{6,}$/.test(student_id)) return "Student ID looks off—use numbers only.";
    if (!selectedPlan.priceId) return "Missing Stripe price for selected plan."; // safety
    return null;
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setSubmitting(true);
    try {
      // 1) Create/attach member on backend
      const res = await fetch(`${BACKEND}/members/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first.trim(),
          last_name: last.trim(),
          email: email.trim(),
          student_id: student_id || undefined,
          grade_level: gradLevel || undefined,
          plan_id: selectedPlan.dbPlanId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Join failed (${res.status})`);
      }
      const { user_id } = await res.json();

      // 2) Start Stripe Checkout
      const success = new URL(window.location.href);
      success.searchParams.set("status", "success");
      const cancel = new URL(window.location.href);
      cancel.searchParams.set("status", "canceled");

      const r2 = await fetch(`${BACKEND}/billing/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_id: selectedPlan.priceId,
          user_id,
          plan_id: selectedPlan.dbPlanId,
          success_url: success.toString(),
          cancel_url: cancel.toString(),
        }),
      });
      if (!r2.ok) {
        const t = await r2.text();
        throw new Error(t || `Stripe session failed (${r2.status})`);
      }
      const data = await r2.json();

      if (data.sessionId) {
        const stripe = await ensureStripe();
        const { error: stripeErr } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (stripeErr) throw stripeErr;
      } else if (data.url) {
        window.location.assign(data.url as string);
      } else {
        throw new Error("No sessionId or url returned from checkout endpoint.");
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = { background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.1)' };
  const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = 'rgba(185,28,28,.6)');
  const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = 'rgba(255,255,255,.1)');
  const inputCls = "w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition";
  const labelCls = "block text-xs font-medium uppercase tracking-wide text-white/55 mb-1.5";

  return (
    <div className="relative min-h-[calc(100vh-96px)] text-white">
      <main className="mx-auto max-w-3xl px-6 py-12 lg:py-20">

        {/* Hero */}
        <section className="text-center mb-10">
          <h1
            className="font-['Oxanium'] font-extrabold tracking-tight mb-3"
            style={{ fontSize: 'clamp(28px,4vw,48px)' }}
          >
            Join CougarAI
          </h1>
          <p className="text-lg text-white/65 max-w-md mx-auto">
            Choose your plan, fill in your details, and complete checkout.
          </p>
        </section>

        {/* Error */}
        {error && (
          <div
            className="mb-6 rounded-xl p-4 text-sm text-red-300"
            style={{ background: 'rgba(185,28,28,.12)', border: '1px solid rgba(185,28,28,.4)' }}
          >
            {error}
          </div>
        )}

        {/* Plan picker */}
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PLANS.map((p) => {
            const selected = plan === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                className="relative flex flex-col rounded-2xl p-6 text-left transition"
                style={
                  selected
                    ? { background: 'rgba(185,28,28,.1)', border: '1px solid rgba(185,28,28,.5)', boxShadow: '0 8px 40px rgba(185,28,28,.2), inset 0 1px 0 rgba(255,255,255,.06)' }
                    : { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 4px 20px rgba(0,0,0,.3)' }
                }
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-['Oxanium'] text-xs uppercase tracking-widest text-white/45 mb-1">{p.name}</p>
                    <p className="font-['Oxanium'] text-4xl font-extrabold leading-none text-white">
                      {p.priceLabel.split(' /')[0]}
                    </p>
                    <p className="text-sm text-white/40 mt-1">/{p.priceLabel.split('/ ')[1]}</p>
                  </div>
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-full mt-1"
                    style={
                      selected
                        ? { width: 22, height: 22, background: '#b91c1c', border: '1px solid rgba(185,28,28,.8)' }
                        : { width: 22, height: 22, background: 'transparent', border: '1px solid rgba(255,255,255,.25)' }
                    }
                    aria-hidden
                  >
                    {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                </div>
                <ul className="space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center rounded-full text-red-400"
                        style={{ width: 20, height: 20, background: 'rgba(185,28,28,.18)', border: '1px solid rgba(185,28,28,.3)' }}
                      >
                        <Check />
                      </span>
                      <span className="text-sm text-white/70">{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </section>

        {/* Form */}
        <section
          className="rounded-2xl p-8 mb-6"
          style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.2)', backdropFilter: 'blur(10px)' }}
        >
          <h2 className="font-['Oxanium'] text-xl font-bold mb-1">Member details</h2>
          <p className="text-sm text-white/50 mb-6">Used for club administration only — no spam.</p>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
            <div>
              <label htmlFor="first" className={labelCls}>First name</label>
              <input id="first" value={first} onChange={(e) => setFirst(e.target.value)}
                placeholder="Ada" autoComplete="given-name" required
                className={inputCls} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            </div>

            <div>
              <label htmlFor="last" className={labelCls}>Last name</label>
              <input id="last" value={last} onChange={(e) => setLast(e.target.value)}
                placeholder="Lovelace" autoComplete="family-name" required
                className={inputCls} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="email" className={labelCls}>Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ada@cougarai.com" autoComplete="email" required
                className={inputCls} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            </div>

            <div>
              <label htmlFor="student_id" className={labelCls}>
                UH Student ID <span className="normal-case text-white/35 font-normal">(optional)</span>
              </label>
              <input id="student_id" inputMode="numeric" maxLength={7}
                value={student_id} onChange={(e) => setStudent_id(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="1234567" autoComplete="off"
                className={inputCls} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            </div>

            <div>
              <label htmlFor="gradLevel" className={labelCls}>Academic level</label>
              <select id="gradLevel" value={gradLevel} onChange={(e) => setGradLevel(e.target.value)}
                className={inputCls} style={{ ...inputStyle, background: 'rgba(0,0,0,.5)' }}
                onFocus={inputFocus} onBlur={inputBlur}>
                <option value="">Select level…</option>
                <option value="Freshman">Freshman</option>
                <option value="Sophomore">Sophomore</option>
                <option value="Junior">Junior</option>
                <option value="Senior">Senior</option>
                <option value="Graduate">Graduate</option>
                <option value="Alumni">Alumni</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 size-4 flex-shrink-0 rounded accent-red-700" />
                <span className="text-sm text-white/60 leading-relaxed">
                  I agree to the club Code of Conduct and understand refunds follow event policies.
                </span>
              </label>
            </div>

            <div className="sm:col-span-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[.98] disabled:opacity-60"
                style={{ background: '#b91c1c', boxShadow: '0 0 24px rgba(185,28,28,.4)' }}
              >
                {submitting ? "Processing…" : `Continue to Checkout — ${selectedPlan.name} (${selectedPlan.priceLabel})`}
              </button>
            </div>
          </form>
        </section>

        {/* Bottom links */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { href: '/sponsorships', eyebrow: 'Want to support us?', title: 'Sponsorships', body: 'Partner on events and projects.', cta: 'Learn more →' },
            { href: '/contact',      eyebrow: 'Questions?',          title: 'Contact us',    body: 'We usually reply within a day.', cta: 'Reach out →' },
          ].map(({ href, eyebrow, title, body, cta }) => (
            <a
              key={href}
              href={href}
              className="rounded-2xl p-5 no-underline transition"
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(185,28,28,.35)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)')}
            >
              <p className="text-xs uppercase tracking-wide text-white/40 mb-1">{eyebrow}</p>
              <p className="font-['Oxanium'] text-base font-bold text-white mb-1">{title}</p>
              <p className="text-sm text-white/55 mb-3">{body}</p>
              <span className="text-sm text-red-400">{cta}</span>
            </a>
          ))}
        </section>

      </main>
    </div>
  );
}
