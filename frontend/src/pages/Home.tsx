import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import logo from '../assets/logo.png';
import Slideshow, { type SlideImage } from '../components/Slideshow';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

const HP_FALLBACK: SlideImage[] = [
  { src: '/hp_gm.JPG',    objectPosition: 'center' },
  { src: '/hp_nasa.jpg',  objectPosition: 'center' },
  { src: '/hp_intro.jpg', objectPosition: 'center' },
  { src: '/hp_mlai.jpg',  objectPosition: 'center' },
];

interface PublicSponsor {
  sponsor_id: number;
  name: string;
  logo_url: string | null;
  website: string | null;
  tier: string;
}

interface PublicPartner {
  partner_id: number;
  name: string;
  type: string;
  logo_url: string | null;
  website: string | null;
}

interface SlideshowPhoto {
  photo_id: number;
  url: string;
  object_position: string;
  caption: string | null;
}

function resolveLogoUrl(logo_url: string | null): string | null {
  if (!logo_url) return null;
  return logo_url.startsWith('/admin/uploads/') ? `${BACKEND}${logo_url}` : logo_url;
}

function resolveSlideUrl(url: string): string {
  return url.startsWith('/admin/uploads/') ? `${BACKEND}${url}` : url;
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

function LogoPill({ name, logo_url, website }: { name: string; logo_url: string | null; website: string | null }) {
  const logo = resolveLogoUrl(logo_url);
  const letter = name.trim().charAt(0).toUpperCase();
  const inner = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(185,28,28,.2)', padding: '10px 14px' }}>
      {logo
        ? <img src={logo} alt={name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6, background: 'rgba(255,255,255,.06)', flexShrink: 0 }} />
        : <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(185,28,28,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Oxanium,sans-serif', fontWeight: 800, fontSize: 14, color: 'rgba(248,113,113,.9)' }}>{letter}</div>
      }
      <span style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 13, color: '#fff', whiteSpace: 'nowrap' }}>{name}</span>
    </div>
  );
  return website
    ? <a href={website} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</a>
    : inner;
}

export default function Home() {
  const { data: sponsorsData } = useQuery<{ sponsors: PublicSponsor[] }>({
    queryKey: ['public-sponsors'],
    queryFn: () => fetch(`${BACKEND}/sponsors/`).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const { data: partnersData } = useQuery<{ partners: PublicPartner[] }>({
    queryKey: ['public-partners'],
    queryFn: () => fetch(`${BACKEND}/partners/public`).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const { data: slideshowData } = useQuery<{ photos: SlideshowPhoto[] }>({
    queryKey: ['slideshow-home'],
    queryFn: () => fetch(`${BACKEND}/admin/slideshow-photos?page=home`).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const sponsors = sponsorsData?.sponsors ?? [];
  const partners = partnersData?.partners ?? [];
  const hasCommunity = sponsors.length > 0 || partners.length > 0;

  const slideImages: SlideImage[] = slideshowData?.photos?.length
    ? slideshowData.photos.map((p) => ({
        src: resolveSlideUrl(p.url),
        objectPosition: p.object_position,
        caption: p.caption ?? undefined,
      }))
    : HP_FALLBACK;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-center">
      {/* Hero */}
      <section className="mx-auto max-w-3xl">
        <img
          src={logo}
          alt="CougarAI logo"
          className="mx-auto mb-6 h-24 w-24 rounded-xl border-[6px] border-red-700 md:h-40 md:w-40 lg:h-48 lg:w-48"
          style={{ boxShadow: '0 0 44px rgba(185,28,28,.58), 0 0 100px rgba(185,28,28,.18)', background: 'rgba(255,255,255,.03)' }}
          loading="lazy"
        />
        <h1 className="font-['Oxanium'] text-3xl font-extrabold tracking-tight md:text-5xl">
          Welcome to CougarAI
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-balance text-base text-white/80 md:text-lg">
          University of Houston's hub for AI & ML—workshops, research, and a supportive community.
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
      <section
        className="mx-auto mt-10 max-w-5xl rounded-2xl p-6"
        style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.22)', boxShadow: '0 10px 48px rgba(0,0,0,.45)' }}
      >
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

      {/* Partners & Sponsors strip */}
      {hasCommunity && (
        <section className="mx-auto mt-8 max-w-5xl">
          <p style={{ fontFamily: 'Oxanium,sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(248,113,113,.6)', textTransform: 'uppercase', marginBottom: 12 }}>
            Supported by
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {sponsors.map((s) => (
              <LogoPill key={`s-${s.sponsor_id}`} name={s.name} logo_url={s.logo_url} website={s.website} />
            ))}
            {partners.map((p) => (
              <LogoPill key={`p-${p.partner_id}`} name={p.name} logo_url={p.logo_url} website={p.website} />
            ))}
          </div>
        </section>
      )}

      {/* Slideshow */}
      <section className="mx-auto mt-12 max-w-5xl text-left">
        <h2 className="mb-4 text-center font-['Oxanium'] text-2xl font-bold md:text-3xl">
          What we've been up to
        </h2>
        <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 8px 40px rgba(0,0,0,.5)' }}>
          <Slideshow images={slideImages} />
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
