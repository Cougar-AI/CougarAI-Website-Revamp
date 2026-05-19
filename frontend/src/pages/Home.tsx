import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

// Place image files in frontend/public/
const HP_PHOTOS = [
  '/hp_intro.jpg',
  '/hp_gm.JPG',
  '/hp_nasa.jpg',
  '/hp_mlai.jpg',
];


const IMG_W = 480;
const IMG_H = 320;
const GAP   = 12;
const STRIP  = HP_PHOTOS.length * (IMG_W + GAP); // px for one full set
const DURATION = STRIP / 90;                       // seconds at 90 px/s

function HomePhotoCarousel() {
  return (
    <>
      <style>{`
        @keyframes hp-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-${STRIP}px); }
        }
      `}</style>
      {/* full-viewport-width breakout */}
      <div style={{ overflow: 'hidden', width: '100vw', position: 'relative', left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{ display: 'flex', gap: GAP, animation: `hp-marquee ${DURATION}s linear infinite`, width: 'max-content' }}>
          {/* doubled for seamless loop */}
          {[...HP_PHOTOS, ...HP_PHOTOS].map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              style={{ width: IMG_W, height: IMG_H, objectFit: 'cover', objectPosition: 'center', flexShrink: 0, display: 'block' }}
              draggable={false}
            />
          ))}
        </div>
      </div>
    </>
  );
}

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
    <main className="mx-auto max-w-6xl px-4 py-10 text-center" style={{ overflowX: 'hidden' }}>
      {/* Hero */}
      <section className="mx-auto max-w-3xl">
        <img
          src={logo}
          alt="CougarAI logo"
          className="mx-auto mb-6 h-24 w-24 rounded-xl border-[6px] border-red-700 md:h-40 md:w-40 lg:h-48 lg:w-48"
          style={{ boxShadow: '0 0 44px rgba(185,28,28,.58), 0 0 100px rgba(185,28,28,.18)', background: 'transparent', mixBlendMode: 'multiply' }}
          loading="lazy"
        />
        <h1 className="font-['Oxanium'] text-3xl font-extrabold tracking-tight md:text-5xl">
          Welcome to CougarAI
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-balance text-base text-white/80 md:text-lg" style={{ fontFamily: "Oxanium, sans-serif" }}>
          University of Houston&#39;s hub for AI &amp; ML workshops, research, and a supportive community.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/Memberships"
            className="rounded-xl bg-red-700 px-5 py-3 font-semibold text-white shadow-sm ring-1 ring-black/5 transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 font-['Oxanium']"
          >
            Become a member
          </Link>
          <Link
            to="/login"
            className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-red-400 font-['Oxanium']"
          >
            Member login
          </Link>
          {/* Social icon buttons */}
          <a
            href="https://www.instagram.com/cougar_ai/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
          </a>
          <a
            href="https://discord.com/invite/ndt27Rc9dm"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Discord"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </a>
        </div>
      </section>

      {/* Value props */}
      <section
        className="mx-auto mt-10 max-w-5xl rounded-2xl p-6"
        style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.2)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 48px rgba(0,0,0,.45)' }}
      >
        <div className="grid grid-cols-1 gap-4 text-left md:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="group transition hover:-translate-y-0.5"
              style={{ borderRadius: 14, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(185,28,28,.18)', padding: '20px 18px' }}
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg text-red-400"
                style={{ background: 'rgba(185,28,28,.15)' }}>
                {f.icon}
              </div>
              <h3 className="font-semibold font-['Oxanium'] text-white">{f.title}</h3>
              <p className="mt-2 text-sm font-['Oxanium']" style={{ color: 'rgba(255,255,255,.55)' }}>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Slideshow */}
      <section className="mx-auto mt-24 max-w-5xl text-left">
        <h2 className="mb-6 text-center text-2xl font-extrabold tracking-tight md:text-3xl" style={{ fontFamily: "Oxanium, sans-serif" }}>
          What we&#39;ve been up to
        </h2>
        <HomePhotoCarousel />
      </section>

      {/* Meet our officers */}
      <section className="mx-auto mt-24 max-w-3xl pb-2">
        <Link
          to="/about"
          className="block transition hover:-translate-y-1"
          style={{ borderRadius: 20, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.22)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 48px rgba(0,0,0,.45)', padding: '36px 28px', textDecoration: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(185,28,28,.18)', border: '1px solid rgba(185,28,28,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3 className="font-['Oxanium'] text-2xl font-extrabold tracking-tight text-white">Meet our officers</h3>
          </div>
          <p className="font-['Oxanium'] text-sm" style={{ color: 'rgba(255,255,255,.55)' }}>
            Get to know the team behind CougarAI!
          </p>
          <div className="mt-5 inline-flex items-center gap-2 font-['Oxanium'] text-sm font-semibold" style={{ color: 'rgba(248,113,113,.9)' }}>
            View the team
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </Link>
      </section>
    </main>
  );
}
