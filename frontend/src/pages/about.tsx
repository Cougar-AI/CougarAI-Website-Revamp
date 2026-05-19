import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { GraduationCap, FlaskConical, Users, Crown, BookOpen, Megaphone, CalendarDays, Wrench, Globe, Briefcase, Camera, type LucideIcon } from "lucide-react";

const DEPT_ICON_MAP: Record<string, LucideIcon> = {
  "Executive Board":      Crown,
  "Advisors":             BookOpen,
  "Webmasters":           Globe,
  "Marketing":            Megaphone,
  "Corporate Relations":  Briefcase,
  "Events Directors":     CalendarDays,
  "Workshops / Projects": Wrench,
  "Historians":           Camera,
};

import { useQuery } from "@tanstack/react-query";
import { departments as staticDepartments } from "@/data/officers";
import Slideshow, { type SlideImage } from "@/components/Slideshow";

const AU_FALLBACK: SlideImage[] = [
  { src: '/au_nasav2.jpg',   objectPosition: 'top' },
  { src: '/au_officer.jpeg', objectPosition: 'center' },
  { src: '/au_nasav1.jpg',   objectPosition: 'center' },
  { src: '/au_hctra.jpg',    objectPosition: 'center' },
  { src: '/au_group.png',    objectPosition: 'top' },
];

interface SlideshowPhoto {
  photo_id: number;
  url: string;
  object_position: string;
  caption: string | null;
}

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

interface DBOfficer {
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  photo_object_position: string;
  linkedin_url: string | null;
  position_title: string | null;
  position_department: string | null;
  position_sort_order: number | null;
}

// Normalized shape used by OfficerCard and DeptCard
interface OfficerData {
  id: string;
  name: string;
  position: string;
  photoUrl: string | null;
  photoObjectPosition: string;
  linkedinUrl: string | null;
}

interface DeptData {
  id: string;
  name: string;
  officers: OfficerData[];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function resolveOfficerPhoto(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/admin/uploads/")) return `${BACKEND}${url}`;
  return url;
}

function resolveLogoUrl(logo_url: string | null): string | null {
  if (!logo_url) return null;
  return logo_url.startsWith("/admin/uploads/") ? `${BACKEND}${logo_url}` : logo_url;
}

// Build DeptData[] from DB directory response, sorted by position sort_order
function buildDepsFromDB(officers: DBOfficer[]): DeptData[] {
  const deptMap = new Map<string, { officers: OfficerData[]; minSort: number }>();

  for (const o of officers) {
    const deptName = o.position_department ?? "Other";
    if (!deptMap.has(deptName)) {
      deptMap.set(deptName, { officers: [], minSort: o.position_sort_order ?? 999 });
    }
    const entry = deptMap.get(deptName)!;
    if ((o.position_sort_order ?? 999) < entry.minSort) {
      entry.minSort = o.position_sort_order ?? 999;
    }
    const fullName = [o.first_name, o.last_name].filter(Boolean).join(" ") || "Unknown";
    entry.officers.push({
      id: slugify(fullName),
      name: fullName,
      position: o.position_title ?? "",
      photoUrl: resolveOfficerPhoto(o.photo_url),
      photoObjectPosition: o.photo_object_position ?? "50% 50%",
      linkedinUrl: o.linkedin_url,
    });
  }

  return Array.from(deptMap.entries())
    .sort(([, a], [, b]) => a.minSort - b.minSort)
    .map(([name, { officers }]) => ({
      id: slugify(name),
      name,
      officers,
    }));
}

// Build DeptData[] from static officers.ts (fallback / supplement)
function buildDepsFromStatic(): DeptData[] {
  return [...staticDepartments]
    .sort((a, b) => deptSortKey(a.name) - deptSortKey(b.name))
    .map((d) => ({
      id: d.id,
      name: d.name,
      officers: d.officers.map((o) => ({
        id: o.id,
        name: o.name,
        position: o.position,
        photoUrl: o.photo !== "/officer_photo_blank.png" ? o.photo : null,
        photoObjectPosition: "50% 50%",
        linkedinUrl: o.linkedin !== "https://linkedin.com" ? o.linkedin : null,
      })),
    }));
}

const DEPT_ORDER: Record<string, number> = {
  "Executive Board":      1,
  "Advisors":             2,
  "Webmasters":           3,
  "Marketing":            4,
  "Corporate Relations":  5,
  "Events Directors":     6,
  "Workshops / Projects": 7,
  "Historians":           8,
};

function deptSortKey(name: string) {
  return DEPT_ORDER[name] ?? 999;
}

// Merge DB officers with static: DB data takes priority; static officers not
// matched by name in the DB are appended to their departments so all officers
// always appear even before they have accounts.
function buildDepsMerged(dbOfficers: DBOfficer[]): DeptData[] {
  const depts = buildDepsFromDB(dbOfficers);

  const dbNames = new Set(
    dbOfficers.map((o) =>
      [o.first_name, o.last_name].filter(Boolean).join(" ").toLowerCase()
    )
  );

  for (const staticDept of staticDepartments) {
    for (const o of staticDept.officers) {
      if (dbNames.has(o.name.toLowerCase())) continue;

      const officerData: OfficerData = {
        id: o.id,
        name: o.name,
        position: o.position,
        photoUrl: o.photo !== "/officer_photo_blank.png" ? o.photo : null,
        photoObjectPosition: "50% 50%",
        linkedinUrl: o.linkedin !== "https://linkedin.com" ? o.linkedin : null,
      };

      const existing = depts.find((d) => d.name === staticDept.name);
      if (existing) {
        existing.officers.push(officerData);
      } else {
        depts.push({ id: staticDept.id, name: staticDept.name, officers: [officerData] });
      }
    }
  }

  depts.sort((a, b) => deptSortKey(a.name) - deptSortKey(b.name));
  return depts;
}

const glass: React.CSSProperties = {
  borderRadius: 20,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(185,28,28,.2)",
  backdropFilter: "blur(10px)",
  padding: "24px",
};

function OfficerCard({ officer }: { officer: OfficerData }) {
  const initials = officer.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ borderRadius: 14, background: "rgba(255,255,255,.05)", border: "1px solid rgba(185,28,28,.18)", padding: "20px 18px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,rgba(100,8,8,.8),rgba(185,28,28,.4))", border: "2px solid rgba(185,28,28,.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
        {officer.photoUrl
          ? <img src={officer.photoUrl} alt={officer.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: officer.photoObjectPosition }} />
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
        {officer.linkedinUrl && (
          <a href={officer.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(220,38,38,.85)", fontWeight: 600, textDecoration: "none" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
            LinkedIn
          </a>
        )}
      </div>
    </div>
  );
}

function DeptCard({ dept, onClick }: { dept: DeptData; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const Icon = DEPT_ICON_MAP[dept.name];
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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {Icon && (
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `rgba(185,28,28,${hov ? .22 : .12})`, border: "1px solid rgba(185,28,28,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .2s" }}>
            <Icon size={16} color="rgba(248,113,113,.9)" />
          </div>
        )}
        <div>
          <div style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 5, color: "#fff" }}>{dept.name}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{dept.officers.length} officer{dept.officers.length !== 1 ? "s" : ""}</div>
        </div>
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

  const { data: slideshowData } = useQuery<{ photos: SlideshowPhoto[] }>({
    queryKey: ["slideshow-about"],
    queryFn: () => fetch(`${BACKEND}/admin/slideshow-photos?page=about`).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const { data: officerDirData } = useQuery<{ officers: DBOfficer[] }>({
    queryKey: ["officers-directory"],
    queryFn: () => fetch(`${BACKEND}/admin/officers/directory`).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

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

  const slideImages: SlideImage[] = slideshowData?.photos?.length
    ? slideshowData.photos.map((p) => ({
        src: p.url.startsWith("/admin/uploads/") ? `${BACKEND}${p.url}` : p.url,
        objectPosition: p.object_position,
        caption: p.caption ?? undefined,
      }))
    : AU_FALLBACK;

  const sponsors = sponsorsData?.sponsors ?? [];
  const partners = partnersData?.partners ?? [];

  // Merge DB + static: DB officers take priority by name, remaining static officers fill in the gaps
  const departments: DeptData[] = useMemo(() => {
    if (officerDirData?.officers?.length) {
      return buildDepsMerged(officerDirData.officers);
    }
    return buildDepsFromStatic();
  }, [officerDirData]);

  useEffect(() => {
    setSelectedDeptId(searchParams.get("dept"));
  }, [searchParams]);

  const selectedDept: DeptData | null = useMemo(
    () => departments.find((d) => d.id === selectedDeptId) ?? null,
    [selectedDeptId, departments],
  );

  const filteredOfficers = useMemo(() => {
    if (!selectedDept) return [];
    const q = query.trim().toLowerCase();
    if (!q) return selectedDept.officers;
    return selectedDept.officers.filter((o) =>
      o.name.toLowerCase().includes(q) || o.position.toLowerCase().includes(q),
    );
  }, [selectedDept, query]);

  const selectDept = (dept: DeptData) => {
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
          {/* Photo slideshow */}
          <div style={{ margin: "0 auto 28px", maxWidth: 800 }}>
            <div style={{ borderRadius: 20, border: "7px solid rgba(185,28,28,.85)", overflow: "hidden", boxShadow: "0 0 50px rgba(185,28,28,.25), 0 8px 40px rgba(0,0,0,.5)" }}>
              <Slideshow images={slideImages} />
            </div>
          </div>

          {/* Mission statement */}
          <section style={{ ...glass, marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center" }}>
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              <p style={{ fontFamily: "Oxanium,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(248,113,113,.7)", textTransform: "uppercase", marginBottom: 10 }}>Our Mission</p>
              <h2 style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 800, fontSize: 20, color: "#fff", marginBottom: 12 }}>Building the next generation of AI practitioners</h2>
              <p style={{ color: "rgba(255,255,255,.62)", fontSize: 14.5, lineHeight: 1.75 }}>
                CougarAI is the University of Houston's community for artificial intelligence and data science. We bring together students of all majors to learn, collaborate on real-world projects, and connect with industry partners — no experience required.
              </p>
            </div>
            <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "All Majors Welcome", icon: <GraduationCap size={16} color="rgba(248,113,113,.9)" /> },
                { label: "Workshops & Research", icon: <FlaskConical size={16} color="rgba(248,113,113,.9)" /> },
                { label: "Active Community", icon: <Users size={16} color="rgba(248,113,113,.9)" /> },
              ].map(({ label, icon }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 10, background: "rgba(185,28,28,.12)", border: "1px solid rgba(185,28,28,.28)", padding: "10px 16px" }}>
                  {icon}
                  <span style={{ fontFamily: "Oxanium,sans-serif", fontWeight: 600, fontSize: 13.5, color: "rgba(255,255,255,.85)" }}>{label}</span>
                </div>
              ))}
            </div>
          </section>

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
