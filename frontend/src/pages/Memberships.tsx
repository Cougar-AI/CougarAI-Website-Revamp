import { Link } from 'react-router-dom'
import React from 'react'

// Replace with your real sign-up link or route
const JOIN_HREF = '/join' // e.g. external: 'https://forms.gle/your-form-id'

const Check: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
  >
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-3">
    <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-700/20 text-rose-400 ring-1 ring-inset ring-rose-500/20">
      <Check className="h-3.5 w-3.5" />
    </span>
    <span className="text-sm leading-6 text-neutral-300">{children}</span>
  </li>
)

const PriceCard: React.FC<{
  title: string
  price: string
  cadence: string
  cta: React.ReactNode
  highlight?: boolean
  features: string[]
}> = ({ title, price, cadence, cta, highlight, features }) => (
  <div
    className={[
      'relative flex flex-col rounded-2xl p-6 shadow-lg ring-1 transition',
      highlight
        ? 'bg-neutral-900/80 ring-rose-500/40 shadow-rose-900/30'
        : 'bg-neutral-900/60 ring-white/10 hover:ring-white/20',
    ].join(' ')}
  >
    {highlight && (
      <div className="absolute -top-3 left-6 select-none rounded-full bg-gradient-to-r from-rose-600 to-fuchsia-600 px-3 py-1 text-[11px] font-semibold tracking-wide text-white shadow">
        MOST POPULAR
      </div>
    )}

    <h3 className="text-xl font-semibold text-white">{title}</h3>
    <div className="mt-4 flex items-end gap-1">
      <span className="text-4xl font-bold tracking-tight text-white">{price}</span>
      <span className="pb-1 text-sm text-neutral-400">/{cadence}</span>
    </div>

    <ul className="mt-6 space-y-3">
      {features.map((f) => (
        <Bullet key={f}>{f}</Bullet>
      ))}
    </ul>

    <div className="mt-8">{cta}</div>
  </div>
)

const Memberships: React.FC = () => {
  return (
    <div className="relative min-h-[calc(100vh-96px)] text-white">

      <main className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        {/* Hero */}
        <section className="text-center">
          <h1 className="font-['Oxanium'] text-4xl font-semibold tracking-tight sm:text-5xl">
            Memberships
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-neutral-300 sm:text-lg">
            Gain access to exclusive workshops, research projects, and rewards with a membership at CougarAI.
          </p>
          <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-neutral-300 sm:text-lg">
            Open to <span className="font-semibold text-white">all majors</span>. Build real projects, learn from peers, and level up your portfolio.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {/* Internal route example */}
            <Link
              to={JOIN_HREF}
              className="inline-flex items-center justify-center rounded-xl bg-rose-700 px-5 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-rose-400/30 transition hover:bg-rose-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
            >
              Join now
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/10"
            >
              See pricing
            </a>
          </div>
        </section>

        {/* Perks */}
        <section className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            'Weekly workshops & study sessions',
            'Hands-on research & build teams',
            'Resume + interview prep nights',
            'Speaker events with industry',
            'Exclusive project showcase slots',
            'Points, perks, and member rewards',
          ].map((perk) => (
            <div
              key={perk}
              className="rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10 transition hover:ring-white/20"
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-grid h-6 w-6 place-items-center rounded-full bg-rose-700/25 text-rose-400 ring-1 ring-inset ring-rose-500/30">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm leading-6 text-neutral-300">{perk}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Pricing */}
        <section id="pricing" className="mt-20">
          <h2 className="text-center text-2xl font-semibold">Pricing</h2>
          <p className="mt-2 text-center text-sm text-neutral-400">
            Choose a semester pass or save with the yearly plan.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <PriceCard
              title="Semester"
              price="$15"
              cadence="sem"
              highlight
              features={['Full member access', 'All workshops and events', 'Member rewards eligibility']}
              cta={
                <Link
                  to={JOIN_HREF}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-rose-400/30 transition hover:bg-rose-600"
                >
                  Get Semester
                </Link>
              }
            />

            <PriceCard
              title="Yearly"
              price="$25"
              cadence="year"
              features={['All semester benefits', 'Priority for project teams', 'Best value for active members']}
              cta={
                <Link
                  to={JOIN_HREF}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20"
                >
                  Get Yearly
                </Link>
              }
            />
          </div>

          <p className="mt-4 text-center text-xs text-neutral-400">
            Prices subject to change. Student org dues help fund venues, food, compute, and club resources.
          </p>
        </section>

        {/* How it works */}
        <section className="mt-20">
          <h2 className="text-center text-2xl font-semibold">How it works</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Join',
                text: 'Fill out the short form and pick a plan.',
              },
              {
                step: '2',
                title: 'Activate',
                text: 'Get access on Discord & website within 24 hours.',
              },
              {
                step: '3',
                title: 'Build',
                text: 'Attend workshops, join a team, and start shipping.',
              },
            ].map(({ step, title, text }) => (
              <div key={step} className="rounded-2xl bg-neutral-900/60 p-6 ring-1 ring-white/10">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-sm font-semibold text-white ring-1 ring-inset ring-white/15">
                    {step}
                  </span>
                  <h3 className="text-base font-semibold">{title}</h3>
                </div>
                <p className="mt-3 text-sm text-neutral-300">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-20">
          <h2 className="text-center text-2xl font-semibold">FAQ</h2>
          <div className="mx-auto mt-6 max-w-3xl divide-y divide-white/10 overflow-hidden rounded-2xl ring-1 ring-white/10">
            {[
              {
                q: 'Do I need prior experience to join?',
                a: 'No. Our events are beginner-friendly and we have advanced tracks for experienced members.',
              },
              {
                q: 'Is it open to non-CS majors?',
                a: 'Yes! We welcome all majors interested in AI, data, and building cool things.',
              },
              {
                q: 'How do I get member rewards?',
                a: 'Attend events, contribute to projects, and earn points. We announce rewards each semester.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between bg-neutral-900/50 px-5 py-4 text-left text-sm font-medium text-white hover:bg-neutral-900/70">
                  {q}
                  <span className="ml-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white ring-1 ring-inset ring-white/10 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="bg-neutral-950/60 px-5 py-4 text-sm text-neutral-300">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mt-20 text-center">
          <h2 className="font-['Oxanium'] text-2xl font-semibold tracking-tight">
            Ready to build with us?
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-neutral-300">
            Join the community, learn in public, and ship projects that make your resume pop.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to={JOIN_HREF}
              className="inline-flex items-center justify-center rounded-xl bg-rose-700 px-6 py-3 text-sm font-semibold text-white ring-1 ring-rose-400/30 transition hover:bg-rose-600"
            >
              Become a member
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Memberships
