import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { departments, type Department, type Officer } from "@/data/officers";

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001";

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

function resolveLogoUrl(logo_url: string | null): string | null {
  if (!logo_url) return null;
  return logo_url.startsWith("/admin/uploads/") ? `${BACKEND}${logo_url}` : logo_url;
}

const glass: React.CSSProperties = {
  borderRadius: 20,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(185,28,28,.2)",
  backdropFilter: "blur(10px)",
  padding: "24px",
};

function OfficerCard({ officer }: { officer: Officer }) {
  const initials = officer.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const hasPhoto = officer.photo && officer.photo !== '/officer_photo_blank.png';
  return (
    <div style={{ borderRadius: 14, background: "rgba(255,255,255,.05)", border: "1px solid rgba(185,28,28,.18)", padding: "20px 18px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,rgba(100,8,8,.8),rgba(185,28,28,.4))", border: "2px solid rgba(185,28,28,.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
        {hasPhoto
          ? <img src={officer.photo} alt={officer.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 800, fontSize: 18, color: "rgba(255,255,255,.85)" }}>{initials}</span>
        }
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#fff" }}>
          {officer.name}
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(248,113,113,.9)", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
          {officer.position}
        </div>
        <a href={officer.linkedin} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(220,38,38,.85)", fontWeight: 600, textDecoration: "none" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
          LinkedIn
        </a>
      </div>
    </div>
  );
}

function DeptCard({ dept, onClick }: { dept: Department; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", textAlign: "left", borderRadius: 14,
        background: hov ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.05)",
        border: `1px solid rgba(185,28,28,${hov ? .4 : .18})`,
        padding: "18px 20px", transition: "all .2s",
        boxShadow: hov ? "0 8px 28px rgba(185,28,28,.15)" : "none",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        cursor: "pointer",
      }}
    >
      <div>
        <div style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 5, color: "#fff" }}>{dept.name}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{dept.officers.length} officer{dept.officers.length !== 1 ? "s" : ""}</div>
      </div>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `rgba(185,28,28,${hov ? .25 : .1})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .2s" }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </button>
  );
}

export default function About() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDept = searchParams.get("dept");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(initialDept);
  const [query, setQuery] = useState("");

  const { data: sponsorsData } = useQuery<{ sponsors: PublicSponsor[] }>({
    queryKey: ["public-sponsors"],
    queryFn: () => fetch(`${BACKEND}/sponsors/`).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const { data: partnersData } = useQuery<{ partners: PublicPartner[] }>({
    queryKey: ["public-partners"],
    queryFn: () => fetch(`${BACKEND}/partners/public`).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const sponsors = sponsorsData?.sponsors ?? [];
  const partners = partnersData?.partners ?? [];

  useEffect(() => {
    setSelectedDeptId(searchParams.get("dept"));
  }, [searchParams]);

  const selectedDept: Department | null = useMemo(
    () => departments.find((d) => d.id === selectedDeptId) ?? null,
    [selectedDeptId],
  );

  const filteredOfficers = useMemo(() => {
    if (!selectedDept) return [];
    const q = query.trim().toLowerCase();
    if (!q) return selectedDept.officers;
    return selectedDept.officers.filter((o) =>
      o.name.toLowerCase().includes(q) || o.position.toLowerCase().includes(q),
    );
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
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 20px 90px" }}>

      {/* Header */}
      <header style={{ textAlign: "center", marginBottom: selectedDept ? 28 : 36 }}>
        <h1 style={{ fontFamily: "Oxanium,sans-serif", fontSize: "clamp(28px,4.5vw,48px)", fontWeight: 800, letterSpacing: "-.025em", margin: "0 0 12px", color: "#fff" }}>About Us</h1>
        {!selectedDept && (
          <p style={{ color: "rgba(255,255,255,.62)", fontSize: 16, lineHeight: 1.7, maxWidth: 560, margin: "0 auto" }}>
            University of Houston's community for AI & Data Science. All majors welcome — learn, build, and ship projects with us.
          </p>
        )}
      </header>

      {/* Landing state */}
      {!selectedDept && (
        <>
          {/* Group photo */}
          <div style={{ margin: "0 auto 40px", maxWidth: 800 }}>
            <div style={{ borderRadius: 20, border: "7px solid rgba(185,28,28,.85)", overflow: "hidden", boxShadow: "0 0 50px rgba(185,28,28,.25), 0 8px 40px rgba(0,0,0,.5)" }}>
              <img src="/mockAboutPhoto.webp" alt="CougarAI team" style={{ width: "100%", height: "auto", display: "block" }} loading="lazy" />
            </div>
          </div>

          {/* Departments grid */}
          <section style={glass}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 800, fontSize: 22, margin: 0, color: "#fff" }}>Our Officers</h2>
              <Link to="/memberships" style={{ background: "#b91c1c", color: "#fff", padding: "9px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13.5, boxShadow: "0 0 16px rgba(185,28,28,.4)", display: "inline-block", textDecoration: "none" }}>
                Join CougarAI
              </Link>
            </div>
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: 13.5, marginBottom: 20 }}>Select a department to meet the team.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
              {departments.map((d) => <DeptCard key={d.id} dept={d} onClick={() => selectDept(d)} />)}
            </div>
          </section>

          {/* Sponsors & Partners */}
          {(sponsors.length > 0 || partners.length > 0) && (
            <section style={{ ...glass, marginTop: 16 }}>
              <h2 style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 800, fontSize: 22, margin: "0 0 6px", color: "#fff" }}>Our Community</h2>
              <p style={{ color: "rgba(255,255,255,.45)", fontSize: 13.5, marginBottom: 24 }}>The companies and organizations that support CougarAI.</p>

              {sponsors.length > 0 && (
                <div style={{ marginBottom: partners.length > 0 ? 28 : 0 }}>
                  <p style={{ fontFamily: "Oxanium,sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(248,113,113,.7)", textTransform: "uppercase", marginBottom: 14 }}>Sponsors</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {sponsors.map((s) => {
                      const logo = resolveLogoUrl(s.logo_url);
                      const letter = s.name.trim().charAt(0).toUpperCase();
                      const card = (
                        <div
                          key={s.sponsor_id}
                          style={{ borderRadius: 14, background: "rgba(255,255,255,.05)", border: "1px solid rgba(185,28,28,.2)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, minWidth: 160, transition: "border-color .2s" }}
                        >
                          {logo
                            ? <img src={logo} alt={s.name} style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,.06)", flexShrink: 0 }} />
                            : <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(185,28,28,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "Oxanium,sans-serif", fontWeight: 800, fontSize: 16, color: "rgba(248,113,113,.9)" }}>{letter}</div>
                          }
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 700, fontSize: 13.5, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: "rgba(248,113,113,.65)", textTransform: "capitalize", marginTop: 2 }}>{s.tier}</div>
                          </div>
                        </div>
                      );
                      return s.website
                        ? <a key={s.sponsor_id} href={s.website} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>{card}</a>
                        : <React.Fragment key={s.sponsor_id}>{card}</React.Fragment>;
                    })}
                  </div>
                </div>
              )}

              {partners.length > 0 && (
                <div>
                  <p style={{ fontFamily: "Oxanium,sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(248,113,113,.7)", textTransform: "uppercase", marginBottom: 14 }}>Partner Organizations</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {partners.map((p) => {
                      const logo = resolveLogoUrl(p.logo_url);
                      const letter = p.name.trim().charAt(0).toUpperCase();
                      const typeLabel: Record<string, string> = { company: "Company", university_org: "University Org", nonprofit: "Nonprofit", other: "Other" };
                      const card = (
                        <div
                          key={p.partner_id}
                          style={{ borderRadius: 14, background: "rgba(255,255,255,.05)", border: "1px solid rgba(185,28,28,.2)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, minWidth: 160 }}
                        >
                          {logo
                            ? <img src={logo} alt={p.name} style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,.06)", flexShrink: 0 }} />
                            : <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(185,28,28,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "Oxanium,sans-serif", fontWeight: 800, fontSize: 16, color: "rgba(248,113,113,.9)" }}>{letter}</div>
                          }
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 700, fontSize: 13.5, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: "rgba(248,113,113,.65)", marginTop: 2 }}>{typeLabel[p.type] ?? p.type}</div>
                          </div>
                        </div>
                      );
                      return p.website
                        ? <a key={p.partner_id} href={p.website} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>{card}</a>
                        : <React.Fragment key={p.partner_id}>{card}</React.Fragment>;
                    })}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Department detail */}
      {selectedDept && (
        <section style={glass}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={resetDept}
                style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", padding: "8px 14px", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                ← Back
              </button>
              <h2 style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 800, fontSize: 20, margin: 0, color: "#fff" }}>{selectedDept.name}</h2>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or role…"
              style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "rgba(0,0,0,.35)", color: "#fff", fontSize: 13.5, width: 260, outline: "none" }}
            />
          </div>

          {filteredOfficers.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
              {filteredOfficers.map((o) => <OfficerCard key={o.id} officer={o} />)}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", borderRadius: 12, background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.45)", fontSize: 14, fontFamily: "Oxanium,sans-serif" }}>
              {query ? `No officers matched "${query}". Try a different search.` : "No officers to show yet. Check back soon!"}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
