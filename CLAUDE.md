# CougarAI Website Revamp

Full-stack SPA for the CougarAI club website. React frontend + Flask backend.

## Stack

**Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui + React Router v7  
**Backend:** Python + Flask + SQLAlchemy + PostgreSQL + Flask-JWT-Extended  
**Payments:** Stripe | **Icons:** Lucide React | **Carousel:** Swiper

## Running Dev Servers

Two terminals required — both must run simultaneously.

**Terminal 1 — Frontend** (http://localhost:5173):
```bash
cd frontend
npm install
npm run dev
```

**Terminal 2 — Backend** (http://localhost:5001):
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

> **macOS note:** macOS AirPlay Receiver occupies port 5000 by default. Flask runs on **port 5001**. Disable AirPlay Receiver in System Settings → General → AirDrop & Handoff if you want to use port 5000 instead.

## Build, Lint & Test

```bash
# Frontend
npm run build       # production build
npm run lint        # ESLint
npm run preview     # preview production build

# Backend
pytest              # run tests (some require Docker)
gunicorn wsgi:app   # production WSGI server
```

## Social Links

All four are wired in `frontend/src/components/Footer.tsx`. LinkedIn text link + icon button, Discord, Instagram, GitHub icon buttons are all live.

| Platform | URL |
|---|---|
| Discord | https://discord.com/invite/5Jhw67yQDH |
| Instagram | https://www.instagram.com/cougar_ai/ |
| GitHub | https://github.com/Cougar-AI |
| LinkedIn | https://www.linkedin.com/company/cougar-ai |
| Email | cougaraicontact@gmail.com |

## Environment Variables

Create a `.env` file in `backend/` (never commit it):

```
# Database
DB_NAME=
DB_USER=
DB_PASS=
DB_HOST=
DB_PORT=5432

# JWT secrets
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_EMAIL_SECRET=
JWT_RESET_SECRET=

# Google — Sheets (used by forms/points route)
GOOGLE_CREDS_PATH=google/cougarai-points-12e0075f283d.json

# Google — Calendar (used by /events/google route)
GOOGLE_CALENDAR_CREDS_PATH=google/cougarai-calendar-cbf6736bbb3e.json
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=

# Stripe
STRIPE_SECRET_KEY=             # live secret key
STRIPE_TEST_SECRET_KEY=        # test secret key
STRIPE_MODE=test               # "test" or "live" — controls which key is used
STRIPE_WEBHOOK_SECRET=         # whsec_... from Stripe Dashboard → Developers → Webhooks → your endpoint

# Other
FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173,http://127.0.0.1:5173,https://cougarai.org,https://www.cougarai.org
GOOGLE_OAUTH_CLIENT_ID=
```

SMTP variables are also supported — see `backend/config.py` for the full list.

Create a `.env` file in `frontend/` (or copy `.env.example`):

```
VITE_BACKEND_API_URL=                  # leave blank for same-origin
VITE_STRIPE_PUBLISHABLE_KEY=           # live publishable key
VITE_STRIPE_TEST_PUBLISHABLE_KEY=      # test publishable key
VITE_STRIPE_MODE=test                  # "test" or "live" — flip both files to switch modes
VITE_SHOW_AUTH_LINKS=false             # set true to show Login/Register in navbar
```

Service account JSON key files live in `backend/google/` — never commit them.

## Google Calendar Integration

The `/events/google` endpoint fetches events from the `cougaraicontact@gmail.com` Google Calendar using a service account.

**Requirements:**
- Google Calendar API must be enabled in the GCP project (`cougarai-calendar`)
- The calendar must be shared with the service account email (`cougarai-point-system@cougarai-calendar.iam.gserviceaccount.com`) — do this in Google Calendar → Settings & sharing → Share with specific people
- `GOOGLE_CALENDAR_CREDS_PATH` must point to the downloaded service account JSON key

**Event type inference** (in `Calendar.tsx`): title containing "workshop" → green, "meeting" → blue, anything else → red (club event).

## Project Structure

```
frontend/src/
  pages/          # Route-level page components
  components/     # Reusable components
    ui/           # shadcn/ui components (auto-generated — don't hand-edit)
  layouts/        # RootLayout (shared nav/footer)
  data/           # Static data files (officers.ts — update roster here)
  lib/            # Utility functions
  App.tsx         # Router definition
  main.tsx        # Entry point

backend/app/
  routes/         # Flask blueprints (auth, events, officers, payments, announcements, billing, ...)
  services/       # Business logic
  utils/          # Helpers
  imports/        # Aggregated imports (libraries.py, routes_import.py, utilities.py)
  __init__.py     # App factory — blueprint registration & CORS config lives here
  raw_db.py       # Raw DB connection utilities

backend/
  config.py       # Environment configs (Base/Dev/Test/Production)
  run.py          # Dev entry point (uses ProductionConfig)
  wsgi.py         # Gunicorn entry point
  openapi.yaml    # API documentation
  tests/          # pytest suite
  google/         # Service account key files (gitignored)
```

## User Roles

Five roles defined on the `users` table (in descending permission order). **`webmaster` has been eliminated** — all former webmaster users were migrated to `admin`.

| Role | Default? | Access |
|---|---|---|
| `admin` | No | Full access — user mgmt, all CRUD, unified dashboard (all tabs) |
| `officer` | No | Event management, officer tools in `/admin` |
| `partner` | No | Partner org member; set automatically when assigned to a partner org |
| `member` | No | Full member dashboard; set automatically when Stripe payment completes |
| `non-member` | **Yes** | Registered but hasn't purchased membership; limited dashboard |

**Key behaviors:**
- New registrations default to `non-member`
- Stripe `checkout.session.completed` webhook upgrades `non-member` → `member` (never downgrades officer/admin)
- `member` status in UI = role is `member` OR active payment in `payments` table (expires_at ≥ today)
- Admins can also manually grant membership via `PATCH /admin/users/<id>/membership` (creates a `payments` row with `is_manual=TRUE`)
- Expiry does not auto-downgrade role — membership *status* is checked separately from `payments.expires_at`
- Officer assignment (via `/admin` → Officers) updates both `officers` table AND `users.role`
- Removing an officer sets `end_date = today` and downgrades role back to `member`/`non-member`
- Partner assignment (via `/admin` → Partners) sets `users.role = 'partner'` if currently `member`/`non-member`; removing from all partner orgs reverts the role
- Migrations: `add_user_role.sql`, `add_non_member_default_role.sql`, `merge_webmaster_to_admin.sql`
- The `role` field is embedded in JWT access token claims; `POST /auth/refresh` returns updated role
- Login/Register navbar links are hidden by default (`VITE_SHOW_AUTH_LINKS=false`) — flip to `true` in frontend `.env` when the post-login flow is ready

## Visual Design System

All pages share a warm dark-red aesthetic. Follow these conventions when building or editing page components:

- **Base background:** `#050101` — set in `RootLayout.tsx` (`bg-[#050101]`) and rendered by `SiteBackground.tsx`
- **SiteBackground layers:** base gradient → animated neural-net canvas (red nodes/connections) → red hero glow → edge vignette → red grid (masked) → bottom fade. Defined once in `frontend/src/components/SiteBackground.tsx`, mounted in `RootLayout`.
- **Glass panel style:** `borderRadius:20, background:'rgba(255,255,255,.04)', border:'1px solid rgba(185,28,28,.22)', backdropFilter:'blur(10px)'` — used as the primary card/section container on all redesigned pages. Section containers use red border; auth cards (Login, Register) use `rgba(255,255,255,.1)` border with `boxShadow:'0 20px 60px rgba(0,0,0,.6)'`.
- **Auth card accent bar:** red gradient only — `from-red-700 via-red-600 to-red-700`. No fuchsia/purple in the accent bar.
- **Auth card logo:** include the CougarAI logo image centered above the heading with `border:'2px solid rgba(185,28,28,.4)'` and `boxShadow:'0 0 20px rgba(185,28,28,.3)'`.
- **CTA buttons:** primary = `bg-red-700 hover:bg-red-800` with `shadow-[0_0_20px_rgba(185,28,28,.35)]`; secondary = `bg-white/10 hover:bg-white/15` with `ring-1 ring-white/15`. Do not use `#d44040` or `bg-rose-700` for primary buttons.
- **Typography:** `fontFamily:'Oxanium,sans-serif'` (or Tailwind `font-['Oxanium']`) for headings and labels. Font loaded via Google Fonts in `frontend/index.html`.
- **Mixed style approach:** inline styles for complex/precise values (glassmorphism, shadows, gradients); Tailwind for layout, spacing, and simple color utilities.
- **Officer role text color:** `rgba(248,113,113,.9)` (rose-400) to contrast against the dark card background.

## Key Conventions

- **Frontend path alias:** `@/` resolves to `frontend/src/` — use it for all internal imports
- **Adding shadcn components:** `npx shadcn@latest add <component>` from `frontend/` — do not manually edit files in `components/ui/`
- **Backend blueprints:** register new blueprints in `backend/app/imports/routes_import.py`, then the factory in `__init__.py` picks them up automatically
- **Backend imports:** aggregate shared imports via `backend/app/imports/` rather than importing directly in each route file
- **Auth tokens:** access (15 min), refresh (7 days), email verify (24 hr), password reset (30 min) — configured in `config.py`
- **CORS:** allowed origin is `FRONTEND_URL` env var; enforced via flask-cors + an `after_request` hook in `__init__.py` that covers error responses too. New blueprints must explicitly handle `OPTIONS` in their routes (add `"OPTIONS"` to `methods` and return `"", 200`) — flask-cors 6.x + Flask 3.x does not auto-handle preflight for blueprint routes reliably
- **API calls from frontend:** use `const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:5001"` — do not use relative `/api/...` paths (no Vite proxy configured)
- **Officer roster:** edit `frontend/src/data/officers.ts` — add LinkedIn URLs and swap `/officer_photo_blank.png` for real photos when available
- **Sponsors:** managed via `/admin?tab=sponsors` (DB-driven). Public page at `/sponsors` fetches from `GET /sponsors/`. The old static `SPONSORS` array is gone.
- **Uploaded images:** stored in `backend/uploads/sponsors/` and `backend/uploads/partners/`. Served by `GET /admin/uploads/<category>/<filename>`. The `backend/uploads/` directory is gitignored (except `.gitkeep` files).

## Pages & Routes

| Path | Component | Notes |
|---|---|---|
| `/` | `Home` | |
| `/about` | `About` | Officer roster pulled from `data/officers.ts` |
| `/calendar` | `Calendar` | Fetches from `GET /events/google` |
| `/sponsors` | `Sponsors` | Ferguson Control Systems, HPE |
| `/sponsorships` | `Sponsorships` | Inquiry form → mailto |
| `/memberships` | `Memberships` | |
| `/join` | `Join` | Stripe checkout. Styled to match Memberships page. `?status=success` shows full success page; `?status=canceled` shows canceled page. Price IDs and keys controlled via `VITE_STRIPE_MODE` |
| `/contact` | `Contact` | |
| `/login` | `Login` | Google OAuth button wired; set `VITE_SHOW_AUTH_LINKS=true` in frontend `.env` to show in navbar |
| `/register` | `Registration` | Google OAuth button wired; set `VITE_SHOW_AUTH_LINKS=true` in frontend `.env` to show in navbar |
| `/dashboard` | `Dashboard` | Protected (JWT required + onboarding). Tabs: Profile, Membership, Check In, Points, Leaderboard. Pinned announcement banner shown at top if active. |
| `/onboarding` | `Onboarding` | Protected (JWT, skips onboarding check). 3-step first-login wizard |
| `/admin` | `AdminDashboard` | Protected (role: admin/officer). Unified dashboard with collapsible sidebar. Admin Tools: Overview (+ pinned announcements), Users, Officers (+ position titles), Sponsors, Partners, Event Types. Officer Tools: Events (+ location URL, live stats, QR download), Event Stats (date filter), Points (multi-user), Members, Progress Reports |
| `/checkin` | `CheckIn` | Protected (any role). Auto-submits check-in from QR code URL (`?code=`). |
| `/forgot-password` | `ForgotPassword` | Wired to `POST /auth/forgot-password` |
| `/verify-email` | `VerifyEmail` | Auto-triggers `POST /auth/verify-email` on mount with URL token |
| `/reset-password` | `ResetPassword` | Wired to `POST /auth/reset-password`; Login card style; redirects to `/login` on success |
| `/partner` | `PartnerDashboard` | Protected (partner/admin). Profile, Members, Events, Stats, Resources tabs |
| `/auth/success` | `AuthSuccess` | OAuth success landing; auto-redirects to home after 1.8s |
| `/terms` | `Terms` | Static content |
| `/privacy` | `Privacy` | Static content |
| `*` | `NotFound` | 404 catch-all |

## Stripe Integration

All Stripe code lives in two files: **`backend/app/routes/billing.py`** (backend) and **`frontend/src/pages/Join.tsx`** (frontend).

### Backend — `backend/app/routes/billing.py`

Two blueprints registered in `routes_import.py`: `members_bp` (`/members`) and `billing_bp` (`/billing`).

| Route | What it does |
|---|---|
| `POST /members/join` | Validates member fields; inserts into `profile` table if student_id provided; returns `{ user_id }` |
| `POST /billing/create-checkout-session` | Validates price_id against server-side allowlist (tamper protection), creates Stripe Checkout session, returns `{ url }` |
| `POST /billing/webhook` | Receives Stripe events; verifies signature with `STRIPE_WEBHOOK_SECRET`; on `checkout.session.completed` inserts a row into `payments` (student_id if numeric, email otherwise) |

**Webhook critical notes:**
- Uses `request.get_data()` (raw bytes) — never parse JSON first or signature verification will fail
- No CORS preflight needed — called by Stripe servers, not the browser
- Always returns 200; errors are logged, not surfaced (Stripe retries on non-2xx)
- `stripe.Webhook.construct_event()` raises `SignatureVerificationError` or `ValueError` — both are caught
- Production endpoint registered in Stripe Dashboard as `https://cougarai.org/billing/webhook`, listening to `checkout.session.completed`
- Local testing: `stripe listen --forward-to localhost:5001/billing/webhook` (Stripe CLI) — the CLI prints its own `whsec_...` secret; set that as `STRIPE_WEBHOOK_SECRET` while testing locally, then swap for the Dashboard secret in production

### Frontend — `frontend/src/pages/Join.tsx`

Flow: plan picker → member details form → `POST /members/join` → `POST /billing/create-checkout-session` → redirect to Stripe hosted checkout → return to `/join?status=success` or `/join?status=canceled`.

- Price IDs and publishable key are selected by `VITE_STRIPE_MODE` (`test` or `live`)
- `PRICE_IDS` map in `Join.tsx` must stay in sync with `_ALLOWED_PRICE_IDS` set in `billing.py`

### Price IDs

| Plan | Live | Test |
|---|---|---|
| Semester | `price_1S4sVLH2XIQuLIalBvif5rrs` | `price_1RPA0wQdq5f9y5dILdnU8jkY` |
| Yearly | `price_1S0ylVH2XIQuLIalbpMXxrV9` | `price_1RPA1MQdq5f9y5dIX6qzElLY` |

Both sets are in the backend allowlist. To add new prices, update `_ALLOWED_PRICE_IDS` in `billing.py` and `PRICE_IDS` in `Join.tsx`.

### Mode switching

| File | Variable | Values |
|---|---|---|
| `backend/.env` | `STRIPE_MODE` | `test` or `live` |
| `frontend/.env` | `VITE_STRIPE_MODE` | `test` or `live` |

Both must match. Restart the backend after changing. Frontend picks it up via Vite HMR.

### `payments` table schema

```
payment_id        SERIAL PRIMARY KEY
student_id        INTEGER      (nullable — null when member checked out with email only)
email             VARCHAR(255) (nullable — set when no student_id)
date              DATE
amount            NUMERIC
stripe_session_id VARCHAR(255)
plan_id           VARCHAR(50)  ('semester' or 'yearly')
expires_at        DATE         (academic-calendar-aligned — see get_membership_expiry())
```

Migrations: `add_payments_email.sql` (email + nullable student_id), `add_payments_membership_fields.sql` (stripe_session_id + plan_id + expires_at).

## Auth Routes

All auth code lives in `backend/app/routes/auth.py` (blueprint prefix `/auth`). Auth utility helpers for the frontend are in `frontend/src/lib/auth.ts` (`persistAuthSession`, `clearAuthSession`, `getStoredUser`, `hasAccessToken`, `subscribeToAuthChanges`, `setAuthNotice`, `consumeAuthNotice`).

| Route | Status | Notes |
|---|---|---|
| `POST /auth/register` | ✅ Full | Creates user, sends verification email |
| `POST /auth/verify-email` | ✅ Full | Verifies email with JWT token |
| `POST /auth/resend-verification` | ✅ Full | Resends verification email |
| `POST /auth/login` | ✅ Full | Returns access JWT + sets HttpOnly refresh cookie; includes `role` in response |
| `POST /auth/google` | ✅ Full | Verifies Google ID token; auto-creates user on first login; requires `GOOGLE_OAUTH_CLIENT_ID` in backend `.env` |
| `POST /auth/forgot-password` | ✅ Full | Sends reset email linking to `/reset-password?token=<jwt>` |
| `POST /auth/reset-password` | ✅ Full | Resets password; invalidates all refresh tokens (global sign-out) |
| `POST /auth/refresh` | ✅ Full | Rotating refresh token; reuse detection; returns new access JWT with updated role |
| `DELETE /auth/logout` | ✅ Full | Clears refresh token and cookie |

## Known TODOs

### In Progress / Short-term

- **Google OAuth frontend** — backend `POST /auth/google` fully implemented. Login/Register pages have the button wired; set `VITE_SHOW_AUTH_LINKS=true` and flip the button enabled once tested end-to-end. Requires `GOOGLE_OAUTH_CLIENT_ID` in backend `.env`.
- **Run DB migrations** — The following must be applied to production DB (in order). Use `bash backend/run_migrations.sh` — safe to re-run (all use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`):
  1. `add_users_dashboard_fields.sql`, `add_profile_dashboard_fields.sql`, `add_payments_membership_fields.sql`, `add_events_checkin_fields.sql` (dashboard system)
  2. `add_events_location_url.sql` (location URL column on events)
  3. `add_non_member_default_role.sql` (role default)
  4. `merge_webmaster_to_admin.sql` (role unification)
  5. `add_event_types_table.sql` (event types)
  6. `add_officer_positions_table.sql` (officer positions table + 16 default titles)
  7. `add_sponsors_table.sql` (sponsors)
  8. `add_partners_tables.sql` (partner orgs + members)
  9. `add_payments_manual_flag.sql` (manual membership grant)
  10. `add_points_admin_fields.sql` (reason + officer_user_id on points)
  11. `add_progress_reports_table.sql` (progress reports)
  12. `add_events_google_calendar_id.sql` (Google Calendar sync)
  13. `add_event_partners_table.sql` (event ↔ partner tagging)
  14. `add_partner_resource_links_table.sql` (partner resource links)
  15. `add_pinned_announcements_table.sql` (pinned announcement banner)
- **Enable Login/Register in navbar** — flip `VITE_SHOW_AUTH_LINKS=true` in frontend `.env` once Google OAuth is tested end-to-end.
- **Google Calendar service account scope** — The service account must have `calendar.events` scope (not just `calendar.readonly`) granted in GCP for write endpoints to work. Update the service account permissions in Google Cloud Console.
- **Pre-existing TypeScript build errors** — Several admin tab files have unused-import and type errors that existed before current work: `AdminEventTypesTab.tsx`, `AdminPartnersTab.tsx`, `AdminProgressTab.tsx`, `AdminSponsorsTab.tsx`, `AdminUsersTab.tsx`, `AdminDashboard.tsx`. These should be cleaned up before a production build.

### Completed (Admin Enhancements Round 2 — May 2026)

- ✅ **Officer Portal removed** — `/officer` route and `OfficerPortal.tsx` deleted. Officer navbar link removed. Officers manage check-ins exclusively through `/admin`.
- ✅ **Officer position titles** — `officer_positions` table with 16 pre-seeded titles across 8 departments (President, VP Internal/External, Secretary, Treasurer, Advisor, Historian, Marketing Director/Committee, Events Director, Technical Officer, Workshop Committee, Project Officer, Webmaster Director/Webmaster, Corporate Relations). Officers tab has grouped `<select optgroup>` by department in add/edit modals, plus a Position column in the table. Backend: `GET /admin/officer-positions`, `position_id` accepted on `POST/PATCH /admin/officers`. Migration: `add_officer_positions_table.sql`.
- ✅ **Event Types color picker fix** — Hidden `<input type="color">` (sr-only) triggered by a visible swatch `<div>`, plus constrained `w-24` hex text input instead of flex-1 overflow.
- ✅ **Location URL on events** — `location_url TEXT` column on events. Event modal has URL input; table location cell renders as a clickable `<a>` when set. Migration: `add_events_location_url.sql`.
- ✅ **QR code: split buttons + logo + download** — "Regenerate" (RefreshCw) and "Show QR" (QrCode) are separate table row buttons. `QRPresentModal` embeds CougarAI logo (`/logo.png`, `imageSettings.excavate: true`), Copy link / Download PNG (`canvas.toDataURL`) / Download SVG (`XMLSerializer`) actions.
- ✅ **Event stats time filter** — `GET /admin/events-stats` endpoint (officer+) accepts `start_date`, `end_date` (ISO), `limit`; JOINs `event_checkins` for real `attendance_count`. Event Stats tab has date range inputs that refetch via query key.
- ✅ **Multi-user points award** — `AwardForm` selects up to 20 users as removable chips. "Quick-load from Event" dropdown pre-fills users/points/reason from `GET /admin/events/{id}/attendance`. Submit uses `Promise.all`.
- ✅ **Attendance CSV export** — "Download CSV" button in `AttendanceDrawer` exports `Name, Student ID, Checked In At, Points Awarded` client-side.
- ✅ **Enhanced attendance drawer** — Fill-rate progress bar (green→amber→red), avg check-in time from event start, 5-minute bucket CSS bar chart timeline. Backend attendance endpoint now returns `starts_at`.
- ✅ **Pinned announcements** — `pinned_announcements` table. `GET/POST/DELETE /admin/pinned-announcement` (officer+); public `GET /announcements/pinned`. Admin Overview: card to post/remove with optional expiry. Dashboard: amber glassmorphism banner, dismissible per-session via `sessionStorage[ann-dismissed-{id}]`. Migration: `add_pinned_announcements_table.sql`.
- ✅ **Live event stats** — `LiveEventModal`: large check-in count, capacity bar, total points, 10 most-recent check-ins, polls every 5 s (`refetchInterval: 5000`). "Live" button (Radio icon) shown for `check_in_enabled` events. Bug fix: `POST /events/officer-checkin` now also inserts into `event_checkins`.

### Completed (Admin UX Improvements — May 2026)

- ✅ **Events tab action buttons redesigned** — Flat row of 10 tiny icon-only buttons replaced with labeled primary actions (Edit, Duplicate, Attendance, Delete) + a grouped check-in cluster (Toggle, Regen, Copy, QR, Live) separated by a divider. File: `AdminEventsTab.tsx`.
- ✅ **QR modal click-to-copy code** — The check-in code display in `QRPresentModal` is now a clickable button that copies the code to clipboard and shows green "Copied!" feedback.
- ✅ **Check-in expiry auto-prefill** — When creating a new event, setting the start time auto-fills "Check-in Expires At" to start + 4 hours. Manual edits lock the field from auto-updating (`expiryTouched` state).
- ✅ **Events tab date range filter** — Added "From" / "To" date inputs to the existing filter bar. Filters `starts_at` client-side.
- ✅ **Events tab date sort** — Events default to newest-first. Clicking the "Date" column header toggles ascending/descending with a ↑/↓ arrow indicator.
- ✅ **Styled ConfirmModal** — Replaced both browser `confirm()` dialogs (Delete event, Remove from Google Calendar) with a dark-glass in-UI modal component (`ConfirmModal`) matching the admin aesthetic.
- ✅ **Overview tab refresh button** — "Refresh" button next to the Stats heading invalidates `['admin-stats']` query on demand.
- ✅ **Pinned announcements wired up** — `add_pinned_announcements_table.sql` migration applied. `AnnouncementCard` in `AdminOverviewTab.tsx` now works end-to-end (was crashing with `UndefinedTable`).
- ✅ **DB migrations applied (local dev)** — `add_events_location_url.sql`, `add_officer_positions_table.sql`, `add_pinned_announcements_table.sql` applied to dev DB. `run_migrations.sh` updated to include all three in correct order.

### Post-implementation bug fixes (May 2026)

Three bugs were found and fixed after the initial implementation:

- **`partners.py` GROUP BY crash** — `get_partner_events` query was missing all non-aggregated columns from `GROUP BY`, which PostgreSQL rejects. Fixed: full column list added, `COUNT(DISTINCT ...)` used.
- **`GET /partners/` officer access** — The partner list endpoint was admin-only, silently breaking the partner-org chip picker in the admin event modal for officers (who can also create/edit events). Fixed: changed to `officer+` access.
- **`existingPartnersData?.partners?.map`** — Missing second `?.` before `map` in the event modal partner sync logic. Safe in practice (TypeScript types guarantee `partners` is always an array), but fixed for defensive correctness.

### Completed (Auth Pages + Google Calendar + Partner Dashboard — May 2026)

- ✅ **`/forgot-password`** — Wired to `POST /auth/forgot-password`. Shows success state regardless of account existence (prevents enumeration). Rate-limit error handled.
- ✅ **`/verify-email`** — Auto-triggers `POST /auth/verify-email` on mount with token from URL. States: loading → success | already_verified | error (invalid/expired).
- ✅ **`/reset-password`** — New React component (`ResetPassword.tsx`) matching Login card style. Reads `?token=` from URL, validates password match client-side, calls `POST /auth/reset-password`, redirects to `/login` with auth notice on success. Registered in `App.tsx`.
- ✅ **Google Calendar write** — Scope upgraded from `calendar.readonly` to `calendar.events`. New endpoints: `POST /events/<id>/sync-to-google` (create/patch), `DELETE /events/<id>/sync-to-google` (remove). Migration: `add_events_google_calendar_id.sql`. Admin event modal: "Sync to Google Calendar" toggle; synced events show a green calendar badge; "Remove from Calendar" action button. **Requires** service account `calendar.events` scope in GCP + migration applied.
- ✅ **Partner Dashboard** (`/partner`) — Protected (partner/admin). Tabs: Profile, Members, Events, Stats, Resources. Admins see all partner orgs via dropdown selector; partner users auto-load their org via `GET /partners/my`. New blueprint: `backend/app/routes/partners.py` at `/partners`. New migrations: `add_event_partners_table.sql`, `add_partner_resource_links_table.sql`. Navbar shows "Partner" link for partner/admin roles.
- ✅ **Event partner tagging** — `GET|POST|DELETE /events/<id>/partners`. Admin event modal shows "Partner Orgs" multi-select chip list; selections sync to DB on save.
- ✅ **Partner resource links** — `GET|POST|DELETE /partners/<id>/resource-links`. Admins add/remove links; all partner members can view.

### Completed (Admin Dashboard Phase 2 — May 2026)

- ✅ **Role unification** — `webmaster` eliminated; all webmaster users migrated to `admin`. Role hierarchy: `admin > officer > partner > member > non-member`. Migration: `merge_webmaster_to_admin.sql`. Navbar, ProtectedRoute, and all role checks updated.
- ✅ **Unified sidebar** — `AdminShell.tsx` redesigned with collapsible "Admin Tools" (above) and "Officer Tools" sections. Officers only see Officer Tools; admins see both. Mobile: horizontal scrollable tabs.
- ✅ **QR code check-in** — Per-event QR modal in Events tab encodes `${FRONTEND_URL}/checkin?code=<code>`. New `/checkin` page auto-submits. Uses `qrcode.react`.
- ✅ **Image upload** — `POST /admin/upload-image?category=sponsors|partners` (5MB max, JPEG/PNG/WebP). Files saved to `backend/uploads/<category>/`. Served via `GET /admin/uploads/<category>/<filename>`.
- ✅ **Event Types CRUD** — `event_types` table (name, default_points, color, is_active). Admin tab. Events tab now uses dynamic type dropdown. Migration: `add_event_types_table.sql`.
- ✅ **Sponsors CRUD** — `sponsors` table. Admin tab with logo upload, tier management (platinum/gold/silver/bronze/community), contact info. `GET /sponsors/` public endpoint. `Sponsors.tsx` is now DB-driven.
- ✅ **Partners CRUD** — `partners` and `partner_members` tables. Admin tab with member assignment drawer. Assigning a user sets their role to `partner`; removing from all partners reverts role. Migrations: `add_partners_tables.sql`.
- ✅ **Manual membership** — `PATCH /admin/users/<id>/membership` — admin grants access with expiry + note. Creates payment row with `is_manual=TRUE`. Shown with "Manual" badge in user detail modal. Migration: `add_payments_manual_flag.sql`.
- ✅ **Officer Tools tabs** — Events (CRUD + QR + Duplicate), Event Stats, Points, Member Directory, Progress Reports.
- ✅ **Point management** — `GET|POST /admin/points`, `GET /admin/points/summary`. Officers award/deduct points with reason. Migration: `add_points_admin_fields.sql` (adds `reason`, `officer_user_id` columns).
- ✅ **Member directory** — Read-only officer view of all users. Paginated, searchable, role/membership filters. Click row → read-only modal. CSV export.
- ✅ **Progress reports** — `progress_reports` table. Blueprint at `/progress-reports`. Officers submit weekly reports (upsert by user+week). "My Report" view with week navigation + auto-save draft to localStorage. "Team Reports" view shows submission status grid; click to expand any officer's report. Migration: `add_progress_reports_table.sql`.
- ✅ **Event Duplicate** — Per-event "Duplicate" button pre-fills the create modal with all event fields (id=0 sentinel for new).
- ✅ **Admin Dashboard** (`/admin`) — Phase 1 (original 4 tabs): Overview, Users, Officers, Events. All still present.

### Completed (Admin Dashboard Phase 1 — May 2026)

- ✅ **Admin Dashboard** (`/admin`) — Role-gated (admin/officer). Original four tabs:
  - **Overview** — Stats cards. `GET /admin/stats`
  - **Users** — Paginated table, search/filter, detail modal (profile, payments, points). `GET /admin/users`, `PATCH /admin/users/<id>`, `DELETE /admin/users/<id>` (soft delete)
  - **Events** — Full event CRUD with check-in management. `POST /admin/events/<id>/regenerate-code`
  - **Officers** — Officer list, add/edit/remove. `GET|POST|PATCH|DELETE /admin/officers`
- ✅ **Role hierarchy expanded** — `non-member` default, `partner` role. Migration: `add_non_member_default_role.sql`
- ✅ **Event CRUD role-protected** — `POST/PATCH /events/` require officer+ JWT; `DELETE /events/` requires admin
- ✅ **Billing webhook sets member role** — Upgrades `non-member` → `member` on `checkout.session.completed`
- ✅ **Admin navbar link** — Shown for admin/officer users

### Completed (Dashboard System — May 2026)

The full dashboard system has been implemented. See `.claude/plans/read-the-claude-md-here-warm-sunset.md` for the original spec.

- ✅ **User Dashboard** (`/dashboard`) — Profile editor, membership status, points history, leaderboard (points + streaks), event check-in tab
- ✅ **Onboarding wizard** (`/onboarding`) — 3-step first-login flow; `onboarding_completed_at` tracked in DB. Student ID is **required** (was previously optional). OAuth users get `preferred_email` auto-filled from their Google email.
- ✅ **Event self-check-in** — Members check in via `check_in_code` from the dashboard; `POST /events/checkin`. Check-In tab supports both manual code entry and **QR camera scan** (`html5-qrcode`). Google Sheets no longer needed as primary flow.
- ✅ **Officer check-in portal** (`/officer`) — Role-gated; manual walk-in check-in by student ID; `POST /events/officer-checkin` *(route and page later removed — officers now use `/admin`)*
- ✅ **Attendance streak** — Monthly streak tracking (`current_streak`, `max_streak`, `last_event_month` on profile). Updated on every check-in
- ✅ **Stripe webhook overhaul** — `stripe_customer_id` stored on users; `expires_at`/`plan_id`/`stripe_session_id` on payments; academic-calendar-aligned expiry
- ✅ **Rate limiting** — `flask-limiter` on auth, check-in, billing, and avatar endpoints
- ✅ **React Query** — All dashboard data fetches use `@tanstack/react-query`
- ✅ **Role-based UI gating** — `ProtectedRoute` checks `role`; officer portal restricted to officer/webmaster/admin
- ✅ **Leaderboard privacy** — `is_public` toggle on profile; non-public users hidden from leaderboard table (own rank always shown)
- ✅ **Points leaderboard enhancements** — streak column added (`current_streak 🔥`); column headers (Name, Streak, Points) are clickable to re-sort client-side. Fixed pre-existing key mismatch between backend (`leaderboard`/`my_rank`/`my_total`) and frontend (`entries`/`caller_rank`/`caller_total`).
- ✅ **Profile email display** — Account email shown read-only in Profile tab; only admins can change it via Admin → Users modal (`PATCH /admin/users/<id>` now accepts `email` field).

### Future / Deferred

- **Admin Audit Log** *(TODO)* — `audit_log` table: `action`, `actor_user_id`, `target_user_id`, `target_table`, `old_value JSON`, `new_value JSON`, `created_at`. Populated on every admin mutation. Frontend: searchable log tab in Admin Tools. Deferred — don't build now.
- **Officer Task Board** *(TODO)* — Admins create tasks, assign to officers, officers mark complete. Three columns: To Do / In Progress / Done. `officer_tasks` table. Replaces ad-hoc Discord tracking.
- **Meeting Notes** *(TODO)* — Similar to progress reports but per-meeting: title, date, attendees, agenda, action items. Visible to all officers. `meeting_notes` table with `note_items` junction.
- **About Us — Sponsors & Partners section** *(TODO)* — Small static section on `/about` linking to DB-driven sponsors/partners once those pages stabilize.
- **Point adjustment audit trail** *(TODO)* — Points already have `reason` + `officer_user_id`. Future: expose per-member immutable point history to all officers.
- **Duplicate event** *(already built)* — included as a "Duplicate" button in the Events tab.
- **Event RSVP** — Members mark "I'm going" on calendar events; officers see headcount; email reminder 24h before. Needs `event_rsvp` table `(user_id, event_id, created_at)`.
- **Geolocation check-in (TopHat-style)** — Per-event optional setting. Add `latitude`, `longitude`, `checkin_radius_m` (default 400m), `require_location BOOLEAN` to events table. `POST /events/checkin` accepts optional `{ lat, lon }` and validates proximity via Haversine formula. Requires HTTPS. 400m radius appropriate for UH campus buildings.
- **event_sponsors junction** — Tag a sponsor to a specific event. Needs `event_sponsors (event_id, sponsor_id)` table. (`event_partners` is now built — see Completed above.)
- **Microsoft / Outlook OAuth (CougarNet)** — UH students use `@cougarnet.uh.edu` (Microsoft). Add `POST /auth/microsoft` using `msal` Python library. Bonus: auto-verify `email_verified_at` for `@cougarnet.uh.edu` / `@uh.edu` domains.
- **Discord OAuth** — Model after `POST /auth/google`. Add Discord OAuth button to Login/Register/Profile tab.
- **Discord Webhook** — On event create/update, optionally POST to a Discord incoming webhook URL stored in a `club_settings` table.
- **Event Archive** — Searchable public archive of past events. Each entry: name, description, date, attendance count, attached resources.
- **Projects Archive** — Officer/member project showcase. Needs `projects` + `project_contributors` tables. Officers submit; admin approves. Public-facing page.
- **Club Resource Library** — Members-only workshop slides, code repos, notes linked to events. Add `resource_url` to events.
- **Weekly Email Digest** — Cron job (Sunday) sends each member: points earned this week, rank change, upcoming events.
- **PWA Support** — `manifest.json` + service worker in Vite build. Useful for QR check-in on mobile.
- **Achievement Badges** — Milestone badges from points/attendance queries (no new DB table). `GET /dashboard/badges`. Examples: First Check-in, Workshop Regular (5 workshops), Top 10, Semester Veteran.
- **Points Redemption / Merch Shop** — Spend points on merch. Needs inventory table + officer fulfillment flow.
- **Event Attendance Certificate** — Auto-generate PDF for attending milestone events.
- **Member Engagement Score** — Computed: check-in frequency + streak + points. Surface in member directory.
- **CougarAI Analytics Platform** — Nightly Postgres → DuckDB/BigQuery, dbt models, Metabase/Grafana for officers.

### Housekeeping

- **Officer photos** — Most officers in `officers.ts` reference real photos in `frontend/public/officerHeadshots/`. A few still fall back to `/officer_photo_blank.png`. LinkedIn URLs partially filled in; remaining ones use placeholder `https://linkedin.com`.
- **LinkedIn URL** — Confirm final LinkedIn URL; currently `https://www.linkedin.com/company/cougar-ai`.
