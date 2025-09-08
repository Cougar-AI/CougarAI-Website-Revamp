import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import Slideshow from '../components/Slideshow';

const features = [
  {
    title: 'Workshops',
    desc: 'Hands-on sessions on ML/AI topics.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path fill="currentColor" d="M3 5h18v2H3V5zm2 4h14v10H5V9zm2 2v6h10v-6H7z" />
      </svg>
    ),
  },
  {
    title: 'Research',
    desc: 'Group projects with real sponsors.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path fill="currentColor" d="M11 2v9H2v2h9v9h2v-9h9v-2h-9V2h-2z" />
      </svg>
    ),
  },
  {
    title: 'Community',
    desc: 'A welcoming place to learn together.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path fill="currentColor" d="M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a8 8 0 0116 0v1H4v-1z" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-center">
      {/* Hero */}
      <section className="mx-auto max-w-3xl">
        <img
          src={logo}
          alt="CougarAI logo"
          className="mx-auto mb-6 h-24 w-24 rounded-xl border-8 border-red-700 md:h-40 md:w-40 lg:h-48 lg:w-48"
          loading="lazy"
        />
        <h1 className="font-['Oxanium'] text-3xl font-extrabold tracking-tight md:text-5xl">
          Welcome to CougarAI
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-balance text-base text-white/80 md:text-lg">
          University of Houston’s hub for AI & ML—workshops, research, and a supportive community.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/Memberships"
            className="rounded-xl bg-red-700 px-5 py-3 font-semibold text-white shadow-sm ring-1 ring-black/5 transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label="Join CougarAI"
          >
            Join CougarAI
          </Link>
          <Link
            to="/Calendar"
            className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label="View calendar"
          >
            View calendar
          </Link>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto mt-10 max-w-5xl rounded-2xl bg-gradient-to-b from-red-700/90 to-red-700/70 p-6">
        <div className="grid grid-cols-1 gap-4 text-left text-black md:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="group rounded-xl bg-white p-5 shadow-md ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700">
                {f.icon}
                <span className="sr-only" aria-hidden="true">
                  {f.title} icon
                </span>
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-neutral-700">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Slideshow */}
      <section className="mx-auto mt-12 max-w-5xl text-left">
        <h2 className="mb-4 text-center font-['Oxanium'] text-2xl font-bold md:text-3xl">
          What we’ve been up to
        </h2>
        <div className="overflow-hidden rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
          <Slideshow />
        </div>
      </section>

      {/* Membership CTA */}
      <section className="mx-auto mt-12 max-w-3xl">
        <h3 className="font-['Oxanium'] text-xl font-bold">Ready to dive in?</h3>
        <p className="mx-auto mt-2 max-w-xl text-white/80">
          Members get access to exclusive workshops, research projects, and more.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/Memberships"
            className="rounded-xl bg-red-700 px-5 py-3 font-semibold text-white shadow-sm ring-1 ring-black/5 transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            Become a member
          </Link>
          <Link
            to="/Memberships"
            className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            Member login
          </Link>
        </div>
      </section>
    </main>
  );
}
