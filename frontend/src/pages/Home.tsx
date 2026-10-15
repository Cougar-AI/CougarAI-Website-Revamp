import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import logo from '../assets/logo.png';
import Slideshow, { type SlideImage } from '../components/Slideshow';
import { useAuth } from '@/hooks/useAuth';
import { formatEventTimeRange, parseIso } from '@/lib/dates';
import { DISCORD_INVITE_URL, INSTAGRAM_URL } from '@/lib/links';

const BACKEND = (import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001').replace(/\/$/, '');

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

interface UpcomingEvent {
  event_id: number;
  name: string | null;
  event_type: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  type_color: string | null;
}

function resolveLogoUrl(logo_url: string | null): string | null {
  if (!logo_url) return null;
  return logo_url.startsWith('/admin/uploads/') ? `${BACKEND}${logo_url}` : logo_url;
}

function resolveSlideUrl(url: string): string {
  return url.startsWith('/admin/uploads/') ? `${BACKEND}${url}` : url;
}

// mm-dd-yyyy, the format GET /events/?starts_at= expects.
function todayFilter(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
}

// Hero buttons depend on who is visiting: guests are asked to join, signed-in
// non-members to get a membership, members and officers get shortcuts instead.
function heroActions(role: string | undefined): Array<{ to: string; label: string; primary?: boolean }> {
  if (!role) return [{ to: '/join', label: 'Become a member', primary: true }, { to: '/auth?mode=login', label: 'Member login' }];
  if (role === 'non-member') return [{ to: '/memberships', label: 'Get a membership', primary: true }, { to: '/dashboard', label: 'My dashboard' }];
  if (role === 'officer' || role === 'admin') return [{ to: '/dashboard', label: 'My dashboard', primary: true }, { to: '/admin', label: 'Admin panel' }];
  return [{ to: '/dashboard', label: 'My dashboard', primary: true }, { to: '/calendar', label: 'Upcoming events' }];
}

const features: Array<{ title: string; desc: string; to?: string; href?: string; icon: ReactNode }> = [
  {
    title: 'Workshops',
    desc: 'Hands-on works on ML/AI topics.',
    to: '/calendar',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path fill="currentColor" d="M3 5h18v2H3V5zm2 4h14v10H5V9zm2 2v6h10v-6H7z" />
      </svg>
    ),
  },
  {
    title: 'Research',
    desc: 'Group projects with real sponsors.',
    to: '/projects',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path fill="currentColor" d="M11 2v9H2v2h9v9h2v-9h9v-2h-9V2h-2z" />
      </svg>
    ),
  },
  {
    title: 'Community',
    desc: 'A welcoming place to learn together.',
    href: DISCORD_INVITE_URL,
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path fill="currentColor" d="M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a8 8 0 0116 0v1H4v-1z" />
      </svg>
    ),
  },
];

const cardStyle = { borderRadius: 14, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(185,28,28,.18)', padding: '20px 18px' } as const;

function FeatureCard({ title, desc, to, href, icon }: (typeof features)[number]) {
  const body = (
    <>
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg text-red-400" style={{ background: 'rgba(185,28,28,.15)' }}>
        {icon}
      </div>
      <h3 className="flex items-center gap-1.5 font-semibold font-['Oxanium'] text-white">
        {title}
        <ArrowRight size={14} className="text-red-400/70 transition-transform group-hover:translate-x-0.5" />
      </h3>
      <p className="mt-2 text-sm font-['Oxanium']" style={{ color: 'rgba(255,255,255,.55)' }}>{desc}</p>
    </>
  );
  const className = 'group block transition hover:-translate-y-0.5 hover:border-red-700/50';
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={cardStyle}>{body}</a>
    : <Link to={to ?? '/'} className={className} style={cardStyle}>{body}</Link>;
}

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

const heroButton = "rounded-xl px-5 py-3 text-center font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-red-400 font-['Oxanium']";
const iconButton = 'inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20';

export default function Home() {
  const { user } = useAuth();

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

  // Next few events for the "Coming up" strip; the endpoint 404s when there are none.
  const { data: upcomingEvents = [] } = useQuery<UpcomingEvent[]>({
    queryKey: ['home-upcoming-events'],
    queryFn: async () => {
      const res = await fetch(`${BACKEND}/events/?starts_at=${todayFilter()}`);
      if (!res.ok) return [];
      const rows: unknown = await res.json();
      const now = Date.now();
      return (Array.isArray(rows) ? (rows as UpcomingEvent[]) : [])
        .filter((e) => (parseIso(e.ends_at ?? e.starts_at)?.getTime() ?? 0) >= now)
        .sort((a, b) => (parseIso(a.starts_at)?.getTime() ?? 0) - (parseIso(b.starts_at)?.getTime() ?? 0))
        .slice(0, 3);
    },
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
    <div className="mx-auto max-w-6xl py-2 text-center sm:px-4 md:py-6" style={{ overflowX: 'hidden' }}>
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
          University of Houston&#39;s Club for AI &amp; ML workshops, research, and community.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <div className="grid w-full max-w-xs grid-cols-1 gap-3 sm:flex sm:w-auto sm:max-w-none">
            {heroActions(user?.role).map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={`${heroButton} ${action.primary ? 'bg-red-700 shadow-sm ring-1 ring-black/5 hover:bg-red-800' : 'bg-white/10 ring-1 ring-white/20 backdrop-blur hover:bg-white/15'}`}
              >
                {action.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-3">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={iconButton}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" aria-label="Discord" className={iconButton}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section
        className="mx-auto mt-10 max-w-5xl rounded-2xl p-4 sm:p-6"
        style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.2)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 48px rgba(0,0,0,.45)' }}
      >
        <div className="grid grid-cols-1 gap-4 text-left md:grid-cols-3">
          {features.map((f) => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* Coming up */}
      {upcomingEvents.length > 0 && (
        <section className="mx-auto mt-10 max-w-5xl text-left">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="font-['Oxanium'] text-xl font-extrabold tracking-tight md:text-2xl">Coming up</h2>
            <Link to="/calendar" className="inline-flex items-center gap-1 font-['Oxanium'] text-sm font-semibold text-red-300 hover:text-red-200">
              All events <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {upcomingEvents.map((event) => (
              <Link
                key={event.event_id}
                to="/calendar"
                className="group block rounded-2xl p-4 transition hover:-translate-y-0.5"
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.2)' }}
              >
                {event.event_type && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                    <span className="h-2 w-2 rounded-full" style={{ background: event.type_color ?? 'rgba(248,113,113,.9)' }} />
                    {event.event_type}
                  </span>
                )}
                <div className="mt-1.5 font-['Oxanium'] font-bold text-white leading-snug">{event.name ?? 'Untitled event'}</div>
                <div className="mt-2 flex items-start gap-1.5 text-xs text-white/60"><CalendarDays size={13} className="mt-0.5 shrink-0" />{formatEventTimeRange(event.starts_at, event.ends_at)}</div>
                {event.location && <div className="mt-1 flex items-start gap-1.5 text-xs text-white/45"><MapPin size={13} className="mt-0.5 shrink-0" />{event.location}</div>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Partners & Sponsors strip */}
      {hasCommunity && (
        <section className="mx-auto mt-10 max-w-5xl">
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
      <section className="mx-auto mt-16 max-w-5xl text-left">
        <h2 className="mb-6 text-center text-2xl font-extrabold tracking-tight md:text-3xl" style={{ fontFamily: "Oxanium, sans-serif" }}>
          What we&#39;ve been up to
        </h2>
        {/* Taller frame on phones so the photos aren't a thin strip */}
        <div className="max-sm:[&>div]:aspect-[4/3]">
          <Slideshow images={slideImages} />
        </div>
      </section>

      {/* Meet our officers */}
      <section className="mx-auto mt-16 max-w-3xl">
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
    </div>
  );
}
