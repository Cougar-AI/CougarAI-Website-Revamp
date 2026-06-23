import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { pdfjs, Document, Page, } from "react-pdf"

const BACKEND = (import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001').replace(/\/$/, '');

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface Sponsor {
  sponsor_id: number;
  name: string;
  logo_url: string | null;
  website: string | null;
  tier: string;
  description: string | null;
}

interface SponsorsResponse { sponsors: Sponsor[] }

async function fetchSponsors(): Promise<SponsorsResponse> {
  const res = await fetch(`${BACKEND}/sponsors/`);
  if (!res.ok) throw new Error('Failed to load sponsors');
  return res.json();
}

function SponsorCard({ name, logo_url, website, description }: Sponsor) {
  const [hov, setHov] = useState(false);
  const letter = name.trim().charAt(0).toUpperCase();

  const logoSrc = logo_url
    ? logo_url.startsWith('/admin/uploads/') ? `${BACKEND}${logo_url}` : logo_url
    : null;

  const inner = (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        border: `1px solid rgba(185,28,28,${hov ? .45 : .18})`,
        background: 'rgba(255,255,255,.05)',
        backdropFilter: 'blur(8px)',
        boxShadow: hov ? '0 20px 56px rgba(185,28,28,.22),0 4px 20px rgba(0,0,0,.5)' : '0 4px 24px rgba(0,0,0,.4)',
        transform: hov ? 'translateY(-7px)' : 'translateY(0)',
        transition: 'all .25s ease',
        textDecoration: 'none',
        color: 'inherit',
        cursor: website ? 'pointer' : 'default',
      }}
    >
      {/* Logo / monogram header */}
      <div style={{
        width: '100%', aspectRatio: '16/9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,rgba(80,5,5,.7) 0%,rgba(185,28,28,.2) 100%)',
        borderBottom: '1px solid rgba(185,28,28,.15)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(185,28,28,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(185,28,28,.1) 1px,transparent 1px)',
          backgroundSize: '24px 24px', opacity: .6,
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 50% 60%,rgba(185,28,28,${hov ? .2 : .08}),transparent 65%)`,
          transition: 'all .3s',
        }} />
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={name}
            style={{ position: 'relative', zIndex: 1, maxHeight: '60%', maxWidth: '70%', objectFit: 'contain' }}
          />
        ) : (
          <span style={{
            fontFamily: 'Oxanium,sans-serif', fontWeight: 800, fontSize: 96,
            color: 'rgba(255,255,255,.8)', letterSpacing: '-.02em', lineHeight: 1,
            position: 'relative', zIndex: 1, textShadow: '0 0 40px rgba(185,28,28,.6)',
          }}>
            {letter}
          </span>
        )}
      </div>

      {/* Details row */}
      <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 16, color: 'rgba(255,255,255,.92)', marginBottom: description ? 4 : 0 }}>
            {name}
          </div>
          {description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.4 }}>{description}</div>}
        </div>
        {website && (
          <div style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: 8,
            background: `rgba(185,28,28,${hov ? .25 : .12})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .2s',
            border: `1px solid rgba(185,28,28,${hov ? .4 : .15})`,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: hov ? 'translate(1px,-1px)' : 'none', transition: 'transform .2s' }}>
              <path d="M2 12L12 2M12 2H5M12 2V9" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );

  if (website) {
    return (
      <a href={website} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
        {inner}
      </a>
    );
  }
  return <div>{inner}</div>;
}

export default function SponsorPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<SponsorsResponse>({
    queryKey: ['public-sponsors'],
    queryFn: fetchSponsors,
    staleTime: 5 * 60_000,
  });

  const sponsors = data?.sponsors ?? [];

  const [brochureUrl, setBrochureUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showBrochure, setShowBrochure] = useState(false);
  const brochureRef = useRef<HTMLDivElement | null>(null);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfLoading, SetPdfLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/sponsors/brochure`);
        if (!res.ok) return;
        const j = await res.json();
        if (mounted) {
          setBrochureUrl(j.url ?? null);
          if (j.url) {
            setShowBrochure(true);
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function handleBrochureUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${BACKEND}/admin/upload-file?category=sponsors`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setBrochureUrl(json.url);
      setShowBrochure(true);
    } catch (e: any) {
      alert('Upload failed: ' + (e?.message ?? ''));
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="relative font-['Oxanium']" style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px 90px', textAlign: 'center' }}>

      {/* Header */}
      <header style={{ maxWidth: 580, margin: '0 auto 64px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18,
          padding: '5px 14px', borderRadius: 99,
          background: 'rgba(185,28,28,.12)', border: '1px solid rgba(185,28,28,.3)',
          color: 'rgba(220,38,38,.9)', fontSize: 11.5, fontWeight: 700,
          letterSpacing: '.12em', textTransform: 'uppercase',
        }}>
          Partners &amp; Supporters
        </div>
        <h1 style={{ fontFamily: 'Oxanium,sans-serif', fontSize: 'clamp(28px,4.5vw,48px)', fontWeight: 800, letterSpacing: '-.025em', margin: '0 0 18px', lineHeight: 1.1 }}>
          Our Sponsors
        </h1>
        <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 16.5, lineHeight: 1.72, maxWidth: 500, margin: '0 auto 32px' }}>
          Dedicated to the organizations who believe in our mission and help CougarAI continue to grow and succeed.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/contact"
            style={{ background: '#b91c1c', color: '#fff', padding: '13px 26px', borderRadius: 12, fontWeight: 600, fontSize: 14.5, boxShadow: '0 0 24px rgba(185,28,28,.4)', display: 'inline-block', textDecoration: 'none' }}
          >
            Become a Sponsor
          </Link>
          <button
            onClick={() => {
              setShowBrochure((true));
              setTimeout(() => {
                brochureRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
              },120);
            }}
            style={{ background: 'rgba(255,255,255,.08)', color: '#fff', padding: '13px 26px', borderRadius: 12, fontWeight: 600, fontSize: 14.5, border: '1px solid rgba(255,255,255,.14)', backdropFilter: 'blur(6px)', display: 'inline-block', cursor: 'pointer' }}
          >
            Sponsorship Info
          </button>
        </div>
      </header>

      {/* Sponsor cards */}
      {isLoading ? (
        <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 14, marginBottom: 64 }}>Loading sponsors…</div>
      ) : sponsors.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 14, marginBottom: 64 }}>No sponsors yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20, maxWidth: 720, margin: '0 auto 64px' }}>
          {sponsors.map((s) => <SponsorCard key={s.sponsor_id} {...s} />)}
        </div>
      )}

      {/* Brochure drop-down panel (visible to all; upload controls for admins) */}
      {showBrochure && (
        <div ref={brochureRef} style={{ maxWidth: 720, margin: '0 auto 24px', padding: 18, borderRadius: 12, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>Sponsorship Information</div>
            {user && user.role === 'admin' && (
              <div>
                <label style={{ display: 'inline-block', marginRight: 8 }} className="rounded px-3 py-2" >
                  <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBrochureUpload(f); }} />
                  <button className="rounded px-3 py-1 text-sm" style={{ background: 'rgba(185,28,28,.6)', color: '#fff' }}>{uploading ? 'Uploading…' : 'Upload PDF'}</button>
                </label>
              </div>
            )}
          </div>

          {brochureUrl ? (
            <div>
              <div style={{ marginBottom: 8 }}>
                <a href={`${BACKEND}${brochureUrl}`} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,.9)' }}>Open brochure in new tab</a>
              </div>
              <div style={{ width: '100%', minHeight: 600, overflow: 'auto', padding: 12 }}>
                <Document
                  file={`${BACKEND}${brochureUrl}`}
                  onLoadSuccess={({ numPages }) => {
                    setNumPages(numPages);
                    SetPdfLoading(false);
                  }}
                  onLoadError={(error) => {
                    console.log('PDF load error: ', error)
                  }}
                  loading={pdfLoading &&
                    <div style={{ color: 'rgba(255,255,255,.5)', marginBottom: 10 }}>
                      Loading PDF…
                    </div>
                  }
                >
                  
                  {numPages && 
                    Array.from(new Array(numPages), (_, i) => (
                    <Page
                      key={i}
                      pageNumber={i + 1}
                      width={700}
                    />
                  ))}
                </Document>
              </div>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,.45)' }}>No brochure uploaded yet.</div>
          )}
        </div>
      )}

      {/* CTA strip */}
      <div style={{
        maxWidth: 640, margin: '0 auto', padding: '32px 36px', borderRadius: 20,
        background: 'rgba(185,28,28,.08)', border: '1px solid rgba(185,28,28,.2)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', textAlign: 'left',
      }}>
        <div>
          <div style={{ fontFamily: 'Oxanium,sans-serif', fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Interested in partnering with us?</div>
          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 14, lineHeight: 1.5 }}>We'd love to chat about how we can work together.</div>
        </div>
        <Link
          to="/contact"
          style={{ background: '#b91c1c', color: '#fff', padding: '11px 22px', borderRadius: 10, fontWeight: 600, fontSize: 14, boxShadow: '0 0 18px rgba(185,28,28,.35)', flexShrink: 0, display: 'inline-block', textDecoration: 'none' }}
        >
          Get in Touch
        </Link>
      </div>

      <p style={{ marginTop: 40, color: 'rgba(255,255,255,.25)', fontSize: 12 }}>
        Logos are for identification only and remain the property of their respective owners.
      </p>
    </main>
  );
}
