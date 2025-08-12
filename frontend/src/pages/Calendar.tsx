import React, { useState } from "react";

const TYPES = ["Club events", "Meetings", "Workshops", "Due Dates"] as const;
const YEARS = ["2025", "2024", "2023", "2022"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "Etc."] as const;

function FilterSection({
  title,
  items,
  value,
  onChange,
}: {
  title: string;
  items: readonly string[];
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-black text-sm font-semibold font-['Oxanium']">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => {
          const active = value === item;
          return (
            <li key={item}>
              <button
                type="button"
                onClick={() => onChange?.(item)}
                className={[
                  "w-full text-left text-sm px-2 py-1 rounded-md transition font-['Oxanium']",
                  active
                    ? "bg-rose-700 text-white"
                    : "text-black hover:text-rose-700 hover:bg-gray-100",
                ].join(" ")}
              >
                {item}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Calendar() {
  const [type, setType] = useState<string>();
  const [year, setYear] = useState<string>();
  const [month, setMonth] = useState<string>();

  return (
    <main className="min-h-screen w-full">
      {/* Title */}
      <header className="px-4 pt-8">
        <h1 className="text-center text-white text-5xl font-semibold tracking-wide font-['Oxanium']">
          CougarAI Calendar
        </h1>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
          {/* Left Filter Card */}
          <aside className="border-[12px] border-rose-700 rounded-3xl p-3">
            <div className="rounded-2xl bg-zinc-300 p-5">
              <div className="space-y-6">
                <FilterSection
                  title="Sort by:"
                  items={TYPES}
                  value={type}
                  onChange={setType}
                />
                <FilterSection
                  title="Year:"
                  items={YEARS}
                  value={year}
                  onChange={setYear}
                />
                <FilterSection
                  title="Month:"
                  items={MONTHS}
                  value={month}
                  onChange={setMonth}
                />
              </div>
            </div>
          </aside>

          {/* Main Calendar Frame */}
          <section className="border-[12px] border-rose-700 rounded-3xl p-4">
            <div className="rounded-2xl bg-zinc-300 min-h-[520px] md:min-h-[640px] flex items-start justify-center">
              <p className="mt-6 text-center text-black text-xl font-semibold font-['Oxanium']">
                Area of which the actual calendar would be
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
