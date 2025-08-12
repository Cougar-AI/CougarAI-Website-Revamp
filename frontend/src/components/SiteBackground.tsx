import { useEffect, useRef } from 'react';

export default function SiteBackground() {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes slow-spin { to { transform: rotate(360deg); } }
@keyframes float-a { 
  0%{ transform: translate3d(-6px,-4px,0) } 
  50%{ transform: translate3d(6px,6px,0) } 
  100%{ transform: translate3d(-6px,-4px,0) } 
}
@keyframes float-b { 
  0%{ transform: translate3d(4px,-6px,0) } 
  50%{ transform: translate3d(-8px,4px,0) } 
  100%{ transform: translate3d(4px,-6px,0) } 
}
`,
        }}
      />

      <div
        ref={ref}
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden isolate"
        style={
          {
            ['--spot-x' as any]: '50%',
            ['--spot-y' as any]: '45%',
            ['--parallax-x' as any]: '0px',
            ['--parallax-y' as any]: '0px',
          } as React.CSSProperties
        }
        aria-hidden
      >
        {/* 1) Base depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950" />

        {/* 2) Soft vignette to quiet edges (no visible “ring”) */}
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage:
              'radial-gradient(120% 90% at 50% 40%, black 58%, transparent 100%)',
            maskImage:
              'radial-gradient(120% 90% at 50% 40%, black 58%, transparent 100%)',
            background:
              'radial-gradient(120% 90% at 50% 40%, transparent 60%, rgba(0,0,0,.65) 100%)',
          }}
        />

        {/* 3) Subtle conic glow — ultra low opacity, very slow */}
        <div
          className="
            absolute inset-0 opacity-20 mix-blend-screen blur-3xl will-change-transform
            motion-safe:[animation:slow-spin_120s_linear_infinite]
          "
          style={{
            transformOrigin: '50% 50%',
            transform:
              'translate3d(var(--parallax-x), var(--parallax-y), 0) scale(1.2)',
            background:
              'conic-gradient(from 0deg at 50% 50%, var(--accent) 0deg, transparent 120deg, var(--accent2) 180deg, transparent 300deg, var(--accent3) 360deg)',
          }}
        />

        {/* 4) Aurora wash — no lines, just color drift via large gradients */}
        <div
          className="
            absolute inset-0 opacity-30 mix-blend-screen blur-2xl will-change-transform
          "
          style={{
            background:
              // Three large overlapping bands with very low alpha
              'radial-gradient(60% 40% at 20% 10%, rgba(225,29,72,.18), transparent 70%),' +
              'radial-gradient(70% 45% at 80% 15%, rgba(37,99,235,.16), transparent 72%),' +
              'radial-gradient(80% 55% at 50% 110%, rgba(34,197,94,.14), transparent 75%)',
            transform:
              'translate3d(calc(var(--parallax-x) * .45), calc(var(--parallax-y) * .45), 0)',
          }}
        />

        {/* 5) Bokeh blobs — large, soft, *not* repetitive */}
        <div className="absolute inset-0 will-change-transform">
          <div
            className="absolute size-[60vw] -left-[10vw] -top-[15vh] rounded-full blur-3xl opacity-15 mix-blend-screen motion-safe:animate-[float-a_40s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle at 40% 40%, rgba(255,255,255,.12), transparent 60%)' }}
          />
          <div
            className="absolute size-[50vw] -right-[8vw] top-[5vh] rounded-full blur-3xl opacity-12 mix-blend-screen motion-safe:animate-[float-b_46s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle at 60% 30%, rgba(255,255,255,.10), transparent 60%)' }}
          />
          <div
            className="absolute size-[55vw] left-[10vw] bottom-[-15vh] rounded-full blur-3xl opacity-10 mix-blend-screen motion-safe:animate-[float-a_52s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,.08), transparent 60%)' }}
          />
        </div>

        {/* 6) Cursor spotlight (soft, no hard edges) */}
        <div
          className="absolute inset-0 mix-blend-screen opacity-30"
          style={{
            background:
              'radial-gradient(38vw 28vw at var(--spot-x) var(--spot-y), rgba(255,255,255,.12), transparent 60%)',
            filter: 'blur(10px)',
          }}
        />

        {/* 7) Ultra-fine grain to avoid color banding */}
        <div
          className="absolute inset-0 mix-blend-soft-light opacity-20"
          style={{
            backgroundImage:
              // 4x4 dither noise — tiny and tileable
              'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAQAAADZfx7TAAAAD0lEQVQImWP4//8/AxTAAR0QbXgH3HqXAAAAAElFTkSuQmCC")',
          }}
        />
      </div>
    </>
  );
}
