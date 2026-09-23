/**
 * Central Time (America/Chicago) date formatting utilities.
 * All display-facing date/time formatting for CougarAI should go through these helpers
 * so times are always shown in CT (CST/CDT) regardless of the viewer's browser timezone.
 */

const CTZ = "America/Chicago";

/**
 * Parse a backend timestamp string into a Date, correctly as an absolute instant.
 *
 * PostgreSQL TIMESTAMP (naive) columns come back with no timezone suffix, but
 * they're always UTC under the hood (see toUtcIso() on the write side) — so a
 * bare string here is explicitly marked UTC before parsing. Without this,
 * `new Date(...)` treats an unsuffixed string as the *browser's* local time,
 * which only coincidentally matches Central Time for a Central-Time viewer
 * and is wrong everywhere else. TIMESTAMPTZ columns already include an
 * offset/Z suffix and are left as-is.
 */
export function parseIso(s: string | null | undefined): Date | null {
  if (!s) return null;
  const iso = s.replace(" ", "T");
  const hasZone = /[Zz]|[+-]\d{2}:\d{2}$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * "Jan 15, 2026"
 */
export function formatDate(d: Date | string | null | undefined): string {
  const date = typeof d === "string" ? parseIso(d) : (d ?? null);
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: CTZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * "January 15, 2026" (long month)
 */
export function formatDateLong(d: Date | string | null | undefined): string {
  const date = typeof d === "string" ? parseIso(d) : (d ?? null);
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: CTZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * "Friday, January 15, 2026" (weekday + long)
 */
export function formatDateFull(d: Date | string | null | undefined): string {
  const date = typeof d === "string" ? parseIso(d) : (d ?? null);
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: CTZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * "6:00 PM"
 */
export function formatTime(d: Date | string | null | undefined): string {
  const date = typeof d === "string" ? parseIso(d) : (d ?? null);
  if (!date) return "";
  return date.toLocaleTimeString("en-US", {
    timeZone: CTZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * "Jan 15, 2026 · 6:00 PM" or "Jan 15, 2026 · 6:00 – 8:00 PM"
 */
export function formatDateTime(d: Date | string | null | undefined): string {
  const date = typeof d === "string" ? parseIso(d) : (d ?? null);
  if (!date) return "";
  const dateStr = formatDate(date);
  const timeStr = formatTime(date);
  return `${dateStr} · ${timeStr}`;
}

/**
 * Full event time range: "Friday, January 15, 2026 · 6:00 PM – 8:00 PM CT"
 * Falls back to date-only when no time is available.
 */
export function formatEventTimeRange(
  startDt: string | null | undefined,
  endDt: string | null | undefined,
  dateKey?: string,
): string {
  if (startDt) {
    const start = parseIso(startDt);
    if (!start) return dateKey ? formatDateFromKey(dateKey) : "";
    const dateStr = formatDateFull(start);
    const timeStr = formatTime(start);
    if (endDt) {
      const end = parseIso(endDt);
      const endStr = end ? formatTime(end) : "";
      return endStr ? `${dateStr} · ${timeStr} – ${endStr} CT` : `${dateStr} · ${timeStr} CT`;
    }
    return `${dateStr} · ${timeStr} CT`;
  }
  if (dateKey) return formatDateFromKey(dateKey);
  return "";
}

/**
 * Short agenda time: "6:00 PM" or "6:00 PM – 8:00 PM"
 */
export function formatTimeRange(
  startDt: string | null | undefined,
  endDt: string | null | undefined,
): string {
  if (!startDt) return "";
  const start = parseIso(startDt);
  if (!start) return "";
  const startStr = formatTime(start);
  if (endDt) {
    const end = parseIso(endDt);
    const endStr = end ? formatTime(end) : "";
    return endStr ? `${startStr} – ${endStr}` : startStr;
  }
  return startStr;
}

/**
 * Weekday abbreviation in CT: "Fri"
 */
export function formatWeekdayShort(d: Date | string | null | undefined): string {
  const date = typeof d === "string" ? parseIso(d) : (d ?? null);
  if (!date) return "";
  return date.toLocaleDateString("en-US", { timeZone: CTZ, weekday: "short" });
}

/**
 * Convert a "YYYY-MM-DD" dateKey to a formatted date string.
 */
export function formatDateFromKey(dateKey: string): string {
  // Use noon CT to avoid off-by-one from DST
  const d = new Date(`${dateKey}T12:00:00`);
  if (isNaN(d.getTime())) return dateKey;
  return formatDateFull(d);
}

/**
 * Today's date key "YYYY-MM-DD" in Central Time.
 */
export function todayKeyCT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: CTZ }); // en-CA gives YYYY-MM-DD
}

/**
 * Convert a naive backend timestamp (stored as UTC, no timezone suffix, e.g.
 * PostgreSQL's "2026-09-15T00:30:00") into a "YYYY-MM-DD" calendar-day key in
 * Central Time. Without this, an evening CT event whose UTC date rolls over
 * to the next day gets placed under the wrong day on the calendar grid.
 */
export function dateKeyFromUtc(s: string | null | undefined): string {
  const d = parseIso(s);
  if (!d) return s ? s.slice(0, 10) : "";
  return d.toLocaleDateString("en-CA", { timeZone: CTZ });
}

/**
 * "Jan 15, 2026, 6:00 PM" — used for full datetime display in admin tables, logs, etc.
 */
export function formatDateTimeFull(d: Date | string | null | undefined): string {
  const date = typeof d === "string" ? parseIso(d) : (d ?? null);
  if (!date) return "";
  return date.toLocaleString("en-US", {
    timeZone: CTZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
