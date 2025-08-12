export default function SiteBackground() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes background-pan { from { background-position: 0% center; } to { background-position: 200% center; } }
@keyframes float { 0%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-12px,0)} 100%{transform:translate3d(0,0,0)} }
`,
        }}
      />
      {/* fixed + overflow-hidden ensures no layout overflow */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Base vertical depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950" />

        {/* Vignette */}
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage:
              'radial-gradient(120% 70% at 50% 35%, black 60%, transparent 100%)',
            maskImage:
              'radial-gradient(120% 70% at 50% 35%, black 60%, transparent 100%)',
            background:
              'radial-gradient(120% 70% at 50% 35%, transparent 60%, rgba(0,0,0,.65) 100%)',
          }}
        />

        {/* Conic glow: use scale instead of -inset */}
        <div
          className="
            absolute inset-0 opacity-30 mix-blend-screen blur-3xl
            will-change-transform motion-safe:animate-[spin_90s_linear_infinite]
            scale-[1.35]
          "
          style={{
            transformOrigin: '50% 50%',
            background:
              'conic-gradient(from 0deg at 50% 50%, var(--accent) 0deg, transparent 90deg, var(--accent2) 180deg, transparent 270deg, var(--accent3) 360deg)',
          }}
        />

        {/* Soft blobs (also no negative inset) */}
        <div
          className="
            absolute inset-0 opacity-60 blur-2xl will-change-transform
            motion-safe:animate-[float_36s_ease-in-out_infinite]
          "
          style={{
            background:
              'radial-gradient(900px 420px at 8% -10%, rgba(225,29,72,.18), transparent 70%),' +
              'radial-gradient(800px 380px at 92% 0%, rgba(37,99,235,.16), transparent 70%),' +
              'radial-gradient(700px 360px at 50% 110%, rgba(34,197,94,.14), transparent 70%)',
          }}
        />

        {/* Fine grid (fades toward edges) */}
        <div
          className="
            absolute inset-0
            bg-[linear-gradient(0deg,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)]
            bg-[size:24px_24px]
          "
          style={{
            WebkitMaskImage:
              'radial-gradient(120% 70% at 50% 35%, black 55%, transparent 100%)',
            maskImage:
              'radial-gradient(120% 70% at 50% 35%, black 55%, transparent 100%)',
          }}
        />

        {/* Ultra-light shimmer */}
        <div
          className="
            absolute inset-0 opacity-10 mix-blend-screen
            motion-safe:animate-[background-pan_60s_linear_infinite]
          "
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent)',
            backgroundSize: '200% 100%',
          }}
        />

        {/* Film grain */}
        <div
          className="absolute inset-0 mix-blend-soft-light opacity-25"
          style={{
            backgroundImage:
              'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAQACAYAAAB49x6RAAAAHUlEQVQImWP8z8Dwn4EIwDiqAqYVgkEJYB8ZIAEAzq0H6pY2xG0AAAAASUVORK5CYII=")',
          }}
        />
      </div>
    </>
  );
}
