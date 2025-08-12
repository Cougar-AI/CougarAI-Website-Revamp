import React from "react";

type Sponsor = {
  name: string;
  url: string;
  logoSrc?: string;
};

const SPONSORS: Sponsor[] = [
  { name: "Company One", url: "https://example.com" },
  { name: "Company Two", url: "https://example.com" },
  { name: "Company Three", url: "https://example.com" },
];

function Monogram({ name }: { name: string }) {
  const letter = name?.trim()?.charAt(0)?.toUpperCase() ?? "?";
  return (
    <div className="flex size-full items-center justify-center rounded-2xl bg-neutral-200/90 text-neutral-800">
      <span className="text-3xl font-bold">{letter}</span>
    </div>
  );
}

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const { name, url, logoSrc } = sponsor;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="
        group relative w-full max-w-[360px] focus:outline-none
        focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black
      "
      aria-label={`Visit ${name}`}
    >
      <figure
        className="
          rounded-2xl ring-1 ring-white/10 bg-white/5 backdrop-blur
          shadow-[0_8px_30px_rgb(0,0,0,0.25)]
          transition-transform duration-200 motion-safe:group-hover:-translate-y-1
        "
      >
        <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={`${name} logo`}
              className="h-full w-full object-contain p-8"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <Monogram name={name} />
          )}
        </div>

        <figcaption className="px-4 pb-4 pt-3 text-center">
          <span
            className="
              text-white text-base font-semibold
              underline-offset-4 group-hover:underline
            "
          >
            {name}
          </span>
          <span className="sr-only"> (opens in a new tab)</span>
        </figcaption>
      </figure>

      {/* subtle glow on hover */}
      <div
        className="
          pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-0 blur-2xl
          transition-opacity duration-200 group-hover:opacity-40
          bg-gradient-to-br from-rose-500/40 via-fuchsia-500/30 to-purple-500/30
        "
        aria-hidden="true"
      />
    </a>
  );
}

export default function SponsorPage() {
  return (
    <main className="relative min-h-screen font-['Oxanium'] overflow-hidden">

      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 md:pt-24">
        <header className="mx-auto max-w-4xl text-center">
          <h1 className="text-white text-4xl font-semibold leading-snug">
            This page is dedicated to our sponsors who have helped our
            organization succeed and continue to succeed.
          </h1>
          <p className="mt-4 text-white/70 text-lg">
            Interested in partnering with us? We’d love to chat.
          </p>

          <div className="mt-6">
            <a
              href="/sponsorships"
              className="
                inline-flex items-center rounded-xl bg-rose-700 px-5 py-3 text-white
                font-semibold shadow ring-1 ring-white/10
                transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]
                focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black
              "
            >
              Become a Sponsor
            </a>
          </div>
        </header>

        <div
          className="
            mt-12 md:mt-16 grid place-items-center
            grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 md:gap-10
          "
        >
          {SPONSORS.map((s) => (
            <SponsorCard key={s.name} sponsor={s} />
          ))}
        </div>

        {/* optional fine print */}
        <p className="mt-12 text-center text-xs text-white/40">
          Logos are for identification only and remain the property of their respective owners.
        </p>
      </section>
    </main>
  );
}
