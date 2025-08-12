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

const SponsorCard: React.FC<{ sponsor: Sponsor }> = ({ sponsor }) => {
  const { name, url, logoSrc } = sponsor;

  return (
    <div className="group flex flex-col items-center">
      <div
        className="
          w-[340px] h-[260px] rounded-[20px]
          bg-neutral-200/90 flex items-center justify-center
          text-base font-semibold text-neutral-800
          shadow-sm ring-1 ring-black/5
          transition-transform duration-200 group-hover:-translate-y-1
        "
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={`${name} logo`}
            className="max-h-[70%] max-w-[70%] object-contain"
            loading="lazy"
          />
        ) : (
          <span>Logo</span>
        )}
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="
          mt-5 text-center text-white text-base font-semibold
          hover:underline underline-offset-4
        "
        aria-label={`Visit ${name}`}
      >
        {name}
      </a>
    </div>
  );
};

const SponsorsPage: React.FC = () => {
  return (
    <main className="relative min-h-screen font-['Oxanium']">
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 md:pt-24">
        <h1 className="text-white text-5xl font-semibold leading-snug text-center">
          This page is dedicated to our sponsors who have helped our organization
          succeed and to continue on succeeding.
        </h1>

        <div className="mt-16 md:mt-24 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 place-items-center">
          {SPONSORS.map((s) => (
            <SponsorCard key={s.name} sponsor={s} />
          ))}
        </div>
      </section>
    </main>
  );
};

export default SponsorsPage;
