import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { departments, type Department } from "@/data/officers";
import OfficerCard from "@/components/OfficerCard";

export default function About() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDept = searchParams.get("dept");

  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(initialDept);
  const [query, setQuery] = useState("");

  // Keep state in sync when URL changes (e.g., user shares link)
  useEffect(() => {
    const id = searchParams.get("dept");
    setSelectedDeptId(id);
  }, [searchParams]);

  const selectedDept: Department | null = useMemo(() => {
    return (departments.find((d) => d.id === selectedDeptId) as Department | undefined) ?? null;
  }, [selectedDeptId]);

  const filteredOfficers = useMemo(() => {
    if (!selectedDept) return [];
    const q = query.trim().toLowerCase();
    if (!q) return selectedDept.officers;
    return selectedDept.officers.filter((o) => {
      const name = (o as any).name?.toLowerCase?.() ?? "";
      const role = (o as any).role?.toLowerCase?.() ?? "";
      return name.includes(q) || role.includes(q);
    });
  }, [selectedDept, query]);

  const selectDept = (dept: Department) => {
    setSelectedDeptId(dept.id);
    setQuery("");
    setSearchParams({ dept: dept.id });
  };

  const resetDept = () => {
    setSelectedDeptId(null);
    setQuery("");
    setSearchParams({});
  };

  return (
    <div className="relative min-h-screen ">
      {/* Background image + overlay (kept subtle for readability) */}
      <div className="" />

      <main className="mx-auto max-w-5xl px-4 py-14 text-white">
        {/* Header */}
        <header className="mb-10 text-center">
          <h1 className="font-['Oxanium'] text-4xl font-bold tracking-tight sm:text-5xl">About Us</h1>
          {!selectedDept && (
            <p className="mx-auto mt-4 max-w-2xl text-base/7 text-zinc-200 sm:text-lg">
              We are the University of Houston’s community for students exploring AI & Data Science. All majors welcome—
              learn, build, and ship projects with us.
            </p>
          )}
        </header>

        {/* Hero image (only on landing state) */}
        {!selectedDept && (
          <div className="mx-auto mb-12 w-full max-w-4xl">
            <div className="rounded-2xl border-8 border-rose-700/90 bg-black/30 p-2 shadow-lg">
              <img
                src="/mockAboutPhoto.webp"
                alt="CougarAI team group photo"
                className="h-auto w-full rounded-xl"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* Departments grid (landing state) */}
        {!selectedDept && (
          <section aria-labelledby="officers-heading" className="mx-auto max-w-4xl">
            <div className="rounded-2xl bg-rose-700/90 px-6 py-8 shadow-lg ring-1 ring-black/10">
              <div className="mb-6 flex items-center justify-between gap-3">
                <h2 id="officers-heading" className="font-['Oxanium'] text-2xl font-bold text-white">
                  Our Officers
                </h2>
                <Link
                  to="/Memberships"
                  className="inline-flex items-center rounded-xl bg-white/95 px-4 py-2 text-sm font-semibold text-black shadow hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  Join CougarAI
                </Link>
              </div>

              <p className="mb-6 text-sm text-white/90">
                Pick a department to meet the team and see what they do.
              </p>

              <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {departments.map((dept) => (
                  <li key={dept.id}>
                    <button
                      type="button"
                      onClick={() => selectDept(dept)}
                      className="group block w-full rounded-xl bg-white/95 p-5 text-left text-black shadow transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      aria-label={`Open ${dept.name} department`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{dept.name}</p>
                          <p className="mt-1 text-xs text-neutral-600">
                            {(dept as any).officers?.length ?? 0} officer
                            {((dept as any).officers?.length ?? 0) === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span
                          className="mt-1 inline-flex size-8 items-center justify-center rounded-lg bg-black/5 transition group-hover:translate-x-0.5"
                          aria-hidden
                        >
                          →
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Department detail */}
        {selectedDept && (
          <section className="mx-auto max-w-4xl">
            <div className="rounded-2xl bg-rose-700/90 p-6 shadow-lg ring-1 ring-black/10">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-white">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={resetDept}
                    className="inline-flex items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    aria-label="Back to departments"
                  >
                    ← Back
                  </button>
                  <h2 className="font-['Oxanium'] text-2xl font-bold">{selectedDept.name}</h2>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search officers by name or role"
                    className="w-72 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/70 focus:border-white/40 focus:outline-none"
                  />
                </div>
              </div>

              {filteredOfficers.length === 0 ? (
                <EmptyState query={query} />
              ) : (
                <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {filteredOfficers.map((officer: any) => (
                    <li key={officer.id} className="">
                      <OfficerCard officer={officer} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-black/10 px-6 py-12 text-center text-white">
      <div className="mb-2 text-3xl">🧐</div>
      <p className="text-sm/6 text-white/90">
        {query ? (
          <>
            No officers matched <span className="font-semibold">“{query}”</span>.
          </>
        ) : (
          <>No officers to show yet. Check back soon!</>
        )}
      </p>
    </div>
  );
}
