import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

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

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

// Match the Memberships page offerings
// Replace price_XXX with real Stripe Price IDs
// Replace dbPlanId with your membership_plans.plan_id values
const PLANS = [
  {
    id: "semester",
    name: "Semester",
    tagline: "Full member access for one semester.",
    priceLabel: "$15 / sem",
    priceId: "price_SEMESTER_XXXXXXXX", // TODO: your Stripe Price ID
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
    priceId: "price_YEARLY_XXXXXXXX", // TODO: your Stripe Price ID
    dbPlanId: 2, 
    features: [
      "Everything in Semester",
      "Priority for project teams",
      "Saves vs. two semesters",
    ],
  },
] as const;

type PlanId = typeof PLANS[number]["id"];

export default function JoinUs() {
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
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "success") setBanner("You're in! Thanks for joining CougarAI.");
    if (status === "canceled") setBanner("Checkout canceled. You can try again anytime.");
  }, []);

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
      const res = await fetch("/api/members/join", {
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

      const r2 = await fetch("/api/billing/create-checkout-session", {
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

  return (
    <div className="mx-auto max-w-4xl">
      {/* Heading */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-[--accent] via-[--accent2] to-[--accent3] bg-clip-text text-transparent">
            Join CougarAI
          </span>
        </h1>
        <p className="mt-4 text-white/80">
          Choose your plan, fill in your details, and complete checkout. Welcome aboard!
        </p>
      </header>

      {/* Banner */}
      {banner && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
          {banner}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
          {error}
        </div>
      )}

      {/* Plan picker */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlan(p.id)}
            className={`group relative rounded-2xl border p-5 text-left shadow-sm transition ${
              plan === p.id
                ? "border-[--accent] bg-white/10"
                : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-white/60">{p.name}</p>
                <p className="mt-1 text-2xl font-semibold">{p.priceLabel}</p>
                <p className="mt-1 text-sm text-white/70">{p.tagline}</p>
              </div>
              <div
                className={`size-5 rounded-full border ${
                  plan === p.id ? "border-[--accent] bg-[--accent]" : "border-white/30"
                }`}
                aria-hidden
              />
            </div>
            <ul className="mt-3 space-y-1 text-sm text-white/70">
              {p.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>

            {/* ambient accent glow */}
            {plan === p.id && (
              <div aria-hidden className="pointer-events-none absolute -inset-24 -z-10 opacity-30 blur-3xl">
                <div className="size-full bg-[conic-gradient(at_30%_40%,theme(colors.rose.700/.35),theme(colors.blue.600/.35),theme(colors.green.500/.35),transparent_60%)]" />
              </div>
            )}
          </button>
        ))}
      </section>

      {/* Join form */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/5">
        <h2 className="text-xl font-semibold">Member details</h2>
        <p className="mt-2 text-sm text-white/70">We use this only for club administration—no spam.</p>

        <form id="join-form" onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <div>
            <label htmlFor="first" className="mb-1 block text-sm text-white/80">First name</label>
            <input
              id="first"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="Ada"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-[--accent]"
              autoComplete="given-name"
              required
            />
          </div>

          <div>
            <label htmlFor="last" className="mb-1 block text-sm text-white/80">Last name</label>
            <input
              id="last"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              placeholder="Lovelace"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-[--accent]"
              autoComplete="family-name"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="email" className="mb-1 block text-sm text-white/80">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ada@example.com"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-[--accent]"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="student_id" className="mb-1 block text-sm text-white/80">UH Student ID <span className="text-white/50">(optional)</span></label>
            <input
              id="student_id"
              inputMode="numeric"
              maxLength={7}
              value={student_id}
              onChange={(e) => setStudent_id(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g., 1234567"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-[--accent]"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="gradLevel" className="mb-1 block text-sm text-white/80">Academic Level </label>
            <select
              id="gradLevel"
              value={gradLevel}
              onChange={(e) => setGradLevel(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-[--accent]">
              <option value="">Select your Academic Level</option>
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
            <label className="flex items-center gap-3 text-sm text-white/80">
              <input
                type="checkbox"
                className="size-4 rounded border-white/20 bg-black/30 text-[--accent] focus:ring-[--accent]"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span>
                I agree to the club Code of Conduct and understand refunds follow event policies.
              </span>
            </label>
          </div>

          <div className="sm:col-span-2 mt-2 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[--accent] to-[--accent2] px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:brightness-110 active:scale-[.98] disabled:opacity-60"
            >
              {submitting ? "Processing…" : `Continue to Checkout (${selectedPlan.name})`}
            </button>
            <p className="text-xs text-white/60">
              Selected plan: <span className="font-medium text-white/80">{selectedPlan.name}</span>
            </p>
          </div>
        </form>

        {/* ambient accent glow */}
        <div aria-hidden className="pointer-events-none absolute -inset-24 -z-10 opacity-30 blur-3xl">
          <div className="size-full bg-[conic-gradient(at_70%_40%,theme(colors.rose.700/.35),theme(colors.blue.600/.35),theme(colors.green.500/.35),transparent_60%)]" />
        </div>
      </section>

      {/* Helpful links */}
      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <a
          href="/sponsorships"
          className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-white/90 no-underline shadow-sm transition hover:bg-white/[0.08]"
        >
          <p className="text-sm uppercase tracking-wide text-white/60">Want to support us?</p>
          <p className="mt-1 text-lg font-semibold">Sponsorships</p>
          <p className="mt-2 text-sm text-white/70">Partner on events and projects.</p>
          <span className="mt-3 inline-block text-sm text-[--accent2] group-hover:translate-x-0.5">Learn more →</span>
        </a>
        <a
          href="/contact"
          className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-white/90 no-underline shadow-sm transition hover:bg-white/[0.08]"
        >
          <p className="text-sm uppercase tracking-wide text-white/60">Questions?</p>
          <p className="mt-1 text-lg font-semibold">Contact us</p>
          <p className="mt-2 text-sm text-white/70">We usually reply within a day.</p>
          <span className="mt-3 inline-block text-sm text-[--accent2] group-hover:translate-x-0.5">Reach out →</span>
        </a>
      </section>
    </div>
  );
}
