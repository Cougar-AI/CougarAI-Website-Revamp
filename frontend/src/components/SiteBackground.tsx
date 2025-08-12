export default function SiteBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-black to-neutral-950" />
      <div
        className="
          absolute inset-0 blur-2xl opacity-70
          bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(244,63,94,.20),transparent),
              radial-gradient(1000px_500px_at_90%_10%,rgba(59,130,246,.15),transparent),
              radial-gradient(800px_400px_at_50%_120%,rgba(34,197,94,.12),transparent)]
        "
      />
      <div
        className="absolute inset-0
          bg-[linear-gradient(0deg,rgba(255,255,255,.06)_1px,transparent_1px),
              linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)]
          bg-[size:24px_24px]"
        style={{
          WebkitMaskImage:
            'radial-gradient(100% 60% at 50% 40%, black 60%, transparent 100%)',
          maskImage:
            'radial-gradient(100% 60% at 50% 40%, black 60%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-0 mix-blend-overlay opacity-20"
        style={{
          backgroundImage:
            'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAQACAYAAAB49x6RAAAAHUlEQVQImWP8z8Dwn4EIwDiqAqYVgkEJYB8ZIAEAzq0H6pY2xG0AAAAASUVORK5CYII=")',
        }}
      />
    </div>
  );
}
