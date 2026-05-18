import { Link } from 'react-router-dom'
import React, { useState } from 'react'
import { hasAccessToken } from '@/lib/auth'

const JOIN_HREF = '/join'
const AUTH_HREF = '/register'

const Check: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
  >
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PerkCard: React.FC<{ text: string }> = ({ text }) => (
  <div
    className="rounded-2xl p-5 flex items-start gap-3 transition-colors"
    style={{
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(185,28,28,.18)',
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(185,28,28,.4)')}
    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(185,28,28,.18)')}
  >
    <span
      className="mt-0.5 flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-red-400"
      style={{ background: 'rgba(185,28,28,.18)', border: '1px solid rgba(185,28,28,.3)' }}
    >
      <Check className="h-3.5 w-3.5" />
    </span>
    <p className="text-sm leading-6 text-white/78">{text}</p>
  </div>
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
    className="relative flex flex-col rounded-2xl p-8"
    style={
      highlight
        ? {
            background: 'rgba(185,28,28,.1)',
            border: '1px solid rgba(185,28,28,.45)',
            boxShadow: '0 8px 40px rgba(185,28,28,.2), inset 0 1px 0 rgba(255,255,255,.06)',
          }
        : {
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.1)',
            boxShadow: '0 4px 20px rgba(0,0,0,.3)',
          }
    }
  >
    {highlight && (
      <div
        className="absolute -top-3 left-6 rounded-full px-3.5 py-1 text-[11px] font-bold tracking-widest text-white uppercase"
        style={{
          background: 'linear-gradient(90deg, #b91c1c, #dc2626)',
          boxShadow: '0 2px 10px rgba(185,28,28,.5)',
        }}
      >
        Most Popular
      </div>
    )}

    <h3 className="font-['Oxanium'] text-xl font-bold text-white mb-4">{title}</h3>
    <div className="flex items-end gap-1 mb-6">
      <span className="font-['Oxanium'] text-5xl font-extrabold leading-none text-white">{price}</span>
      <span className="pb-1.5 text-sm text-white/45">/{cadence}</span>
    </div>

    <ul className="space-y-3 mb-auto">
      {features.map((f) => (
        <li key={f} className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-red-400"
            style={{ background: 'rgba(185,28,28,.18)', border: '1px solid rgba(185,28,28,.3)' }}
          >
            <Check className="h-3 w-3" />
          </span>
          <span className="text-sm leading-6 text-white/75">{f}</span>
        </li>
      ))}
    </ul>

    <div className="mt-7">{cta}</div>
  </div>
)

const FAQItem: React.FC<{ q: string; a: string; open: boolean; onToggle: () => void }> = ({ q, a, open, onToggle }) => (
  <div style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-white gap-4 hover:bg-white/[0.02] transition-colors"
      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
    >
      <span>{q}</span>
      <span
        className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-white/60 transition-transform duration-200"
        style={{
          background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.12)',
          fontSize: 16,
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
      >
        +
      </span>
    </button>
    {open && (
      <div className="px-5 pb-4 text-sm leading-relaxed text-white/62">{a}</div>
    )}
  </div>
)

const Memberships: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const isLoggedIn = hasAccessToken()
  const joinHref = isLoggedIn ? JOIN_HREF : AUTH_HREF

  const btnPrimary = "inline-flex items-center justify-center rounded-xl bg-red-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-800"
  const btnSecondary = "inline-flex items-center justify-center rounded-xl bg-white/8 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15"

  return (
    <div className="relative min-h-[calc(100vh-96px)] text-white">
      <main className="mx-auto max-w-5xl px-6 py-16 lg:py-24">

        {/* Hero */}
        <section className="text-center max-w-[700px] mx-auto mb-0">
          <h1
            className="font-['Oxanium'] font-extrabold tracking-tight leading-none mb-4"
            style={{ fontSize: 'clamp(32px,5vw,56px)', letterSpacing: '-.025em' }}
          >
            Memberships
          </h1>
          <p className="text-lg leading-relaxed text-white/72 max-w-[560px] mx-auto mb-2">
            Gain access to exclusive workshops, research projects, and rewards with a membership at CougarAI.
          </p>
          <p className="text-[17px] leading-relaxed text-white/72 max-w-[560px] mx-auto mb-8">
            Open to <strong className="text-white">all majors</strong>. Build real projects, learn from peers, and level up your portfolio.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={joinHref} className={btnPrimary} style={{ boxShadow: '0 0 26px rgba(185,28,28,.38)' }}>
              Join now
            </Link>
            <a href="#pricing" className={btnSecondary}>
              See pricing
            </a>
          </div>
        </section>

        {/* Perks */}
        <section className="mt-16 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            'Weekly workshops & study sessions',
            'Hands-on research & build teams',
            'Resume + interview prep nights',
            'Speaker events with industry',
            'Exclusive project showcase slots',
            'Points, perks, and member rewards',
          ].map((perk) => (
            <PerkCard key={perk} text={perk} />
          ))}
        </section>

        {/* Pricing */}
        <section id="pricing" className="mt-20">
          <h2 className="font-['Oxanium'] text-[28px] font-bold text-center mb-2">Pricing</h2>
          <p className="text-center text-sm text-white/45 mb-10">
            Choose a semester pass or save with the yearly plan.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 max-w-[760px] mx-auto">
            <PriceCard
              title="Semester"
              price="$15"
              cadence="sem"
              highlight
              features={['Full member access', 'All workshops and events', 'Member rewards eligibility']}
              cta={
                <Link
                  to={isLoggedIn ? `${JOIN_HREF}?plan=semester` : AUTH_HREF}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-800"
                  style={{ boxShadow: '0 0 24px rgba(185,28,28,.35)' }}
                >
                  {isLoggedIn ? 'Get Semester' : 'Sign up to join'}
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
                  to={isLoggedIn ? `${JOIN_HREF}?plan=yearly` : AUTH_HREF}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
                >
                  {isLoggedIn ? 'Get Yearly' : 'Sign up to join'}
                </Link>
              }
            />
          </div>
          {!isLoggedIn && (
            <p className="mt-5 text-center text-sm text-white/55">
              You'll need an account before purchasing.{' '}
              <Link to={AUTH_HREF} className="text-red-400 hover:text-red-300 underline underline-offset-2">
                Create one for free
              </Link>
              {' '}or{' '}
              <Link to="/login" className="text-red-400 hover:text-red-300 underline underline-offset-2">
                log in
              </Link>.
            </p>
          )}
          <p className="mt-3 text-center text-xs text-white/35">
            Prices subject to change. Student org dues help fund venues, food, compute, and club resources.
          </p>
        </section>

        {/* How it works */}
        <section className="mt-20">
          <h2 className="font-['Oxanium'] text-[28px] font-bold text-center mb-9">How it works</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { step: '1', title: 'Join',     text: 'Fill out the short form and pick a plan.' },
              { step: '2', title: 'Activate', text: 'Get access on Discord & website within 24 hours.' },
              { step: '3', title: 'Build',    text: 'Attend workshops, join a team, and start shipping.' },
            ].map(({ step, title, text }) => (
              <div
                key={step}
                className="rounded-2xl p-6"
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="inline-flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full font-['Oxanium'] text-sm font-bold text-red-400"
                    style={{ background: 'rgba(185,28,28,.15)', border: '1px solid rgba(185,28,28,.35)' }}
                  >
                    {step}
                  </span>
                  <h3 className="font-['Oxanium'] text-base font-bold text-white">{title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-white/62">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-20 max-w-[720px] mx-auto">
          <h2 className="font-['Oxanium'] text-[28px] font-bold text-center mb-8">FAQ</h2>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)' }}
          >
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
            ].map((f, i) => (
              <FAQItem
                key={f.q}
                q={f.q}
                a={f.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mt-20 max-w-[540px] mx-auto text-center">
          <h2 className="font-['Oxanium'] text-[28px] font-bold mb-3">Ready to build with us?</h2>
          <p className="text-base leading-relaxed text-white/65 mb-7">
            Join the community, learn in public, and ship projects that make your resume pop.
          </p>
          <Link
            to={joinHref}
            className={btnPrimary}
            style={{ boxShadow: '0 0 26px rgba(185,28,28,.38)' }}
          >
            Become a member
          </Link>
        </section>

      </main>
    </div>
  )
}

export default Memberships
