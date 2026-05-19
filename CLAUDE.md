# CougarAI Website Revamp

Full-stack SPA for the CougarAI club website. React frontend + Flask backend.

## Stack

**Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui + React Router v7 + react-leaflet (map picker)  
**Backend:** Python + Flask + SQLAlchemy + PostgreSQL + Flask-JWT-Extended + Flask-APScheduler (notification jobs)  
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

### Testing

Two tiers — unit tests require no infrastructure; integration tests require Docker.

**Unit tests** (no Docker, runs in ~2s):
```bash
cd backend && source venv/bin/activate
pytest tests/unit/ -v
pytest tests/unit/ --cov=app --cov-report=term-missing   # with coverage
```

**Integration tests** (requires Docker):
```bash
cd backend && source venv/bin/activate
pytest tests/integration/ -v
```

**Full suite** (unit + integration):
```bash
pytest --cov=app --cov-report=term-missing
```

Coverage HTML report → `backend/htmlcov/index.html`

#### Test structure
```
backend/tests/
  conftest.py         # Shared: docker/app/client session fixtures; applies DB schema on startup
  docker-compose.yml  # PostgreSQL 17 for integration tests
  integration/        # Requires Docker; db_session autouse=True scoped here
    conftest.py       # db_session (autouse=True, function scope) — wraps each test in a transaction
    test_app.py       # App factory sanity checks
    test_auth.py      # /auth/* route integration tests (register, login, verify, refresh, logout)
  unit/               # Pure Python; no DB, no Docker
    conftest.py       # Minimal Flask+JWT fixture (no DB)
    test_passwords.py
    test_date_validation.py
    test_query_handler.py
    test_auth_decorators.py
```

#### Schema setup for integration tests
`tests/conftest.py::app` (session scope) applies the schema to the fresh Docker DB right after creating the Flask app. When new tables are needed for new integration tests, add the corresponding SQL files to the `schema_files` list in that fixture (follow the order in `run_migrations.sh`):
- `db-init/001_auth.sql` — users + refresh_tokens
- `migrations/add_users_dashboard_fields.sql` — role, onboarding_completed_at, etc.
- `migrations/add_non_member_default_role.sql` — sets role DEFAULT to 'non-member'

#### Adding new tests
- **New utility function** → add to corresponding `tests/unit/test_*.py`
- **New route or service** → add to `tests/integration/test_<blueprint>.py`
- **New integration test needs a new table** → add the migration SQL file to `schema_files` in `tests/conftest.py::app`

#### Test coverage rule
Every new backend route or service must ship with tests. No exceptions.
- New auth/utility logic → unit test in `tests/unit/`
- New Flask route (blueprint) → integration test in `tests/integration/`
- New service class method → integration test covering the happy path + at least one error case
- Run `pytest tests/unit/ -v` before committing; run the full suite (`pytest`) before merging to main

#### Known limitation (Phase 1)
`db_session` in `tests/integration/conftest.py` uses SQLAlchemy session nesting, but the app uses raw psycopg2 via `get_db()` — so service/route commits are NOT rolled back between tests. Tests must use unique data (e.g., uuid-suffix emails) to stay isolated. Phase 2 will replace this with psycopg2 savepoint isolation.

## Social Links

All four are wired in `frontend/src/components/Footer.tsx`. LinkedIn text link + icon button, Discord, Instagram, GitHub icon buttons are all live.

| Platform | URL |
|---|---|
| Discord | https://discord.gg/ucd5ZnDDnf |
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
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_REDIRECT_URI=         # optional; defaults to {backend_url}/auth/discord/callback
```

SMTP variables are also supported — see `backend/config.py` for the full list.

Create a `.env` file in `frontend/` (or copy `.env.example`):

```
VITE_BACKEND_API_URL=                  # leave blank for same-origin
VITE_STRIPE_PUBLISHABLE_KEY=           # live publishable key
VITE_STRIPE_TEST_PUBLISHABLE_KEY=      # test publishable key
VITE_STRIPE_MODE=test                  # "test" or "live" — flip both files to switch modes
VITE_SHOW_AUTH_LINKS=false             # set true to show Login/Register in navbar
VITE_ENABLE_DISCORD_OAUTH=false        # set true to show Discord button on Login/Register
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
  routes/         # Flask blueprints — thin route handlers only; no business logic
    admin/        # admin_bp package: users, events, officers, sponsors, partners, points, misc
    events/       # events_bp package: crud, checkin, rsvp, integrations
    auth/         # auth_bp package: credentials, oauth, _helpers
    partners/     # partners_bp package: dashboard, members, resources
    (other single-file blueprints: billing, dashboard, forms, notifications, officers, payments, points, profiles, receipts, progress_reports, sponsors, announcements, discord)
  services/       # Business logic — OOP service classes (BaseService pattern)
    base_service.py           # BaseService(conn) base class
    user_service.py           # UserService
    event_admin_service.py    # EventAdminService
    officer_service.py        # OfficerService
    partner_admin_service.py  # PartnerAdminService
    points_service.py         # PointsService (admin)
    sponsor_service.py        # SponsorService
    dashboard_service.py      # DashboardService
    receipt_service.py        # ReceiptService
    notification_service.py   # NotificationService
    progress_report_service.py # ProgressReportService
    mailer.py                 # send_email utility
    notification_scheduler.py # APScheduler jobs
  utils/          # Helpers (auth_decorators, date_validation, query_handler, passwords)
  imports/        # Aggregated imports (libraries.py, routes_import.py, utilities.py)
  __init__.py     # App factory — blueprint registration & CORS config lives here
  raw_db.py       # Raw DB connection utilities — get_db() returns g-scoped psycopg2 RealDictCursor conn

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
- **Backend imports:** use explicit imports in route files — do NOT use `from app.imports import *`; that module is legacy and only used by the app factory
- **Backend service pattern:** business logic lives in `app/services/` as `XxxService(BaseService)` classes instantiated per-request: `svc = XxxService(get_db())`. Route handlers validate input, call the service, and return `jsonify(...)`. No direct DB access in route handlers except for one-liner edge cases
- **Backend auth decorators:** use `@require_admin`, `@require_officer`, `@require_authenticated` from `app.utils.auth_decorators` — never use `@jwt_required()` directly. OPTIONS is handled automatically by these decorators
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
| `/checkin` | `CheckIn` | Protected (any role). Auto-submits check-in from QR code URL (`?code=`). Shows "Acquiring location…" phase; includes lat/lon if available. |
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

## Tracking

> **Instruction for Claude:** After finishing any task in this project, update this section — move completed items to **Done** and add new items to **Todo**. Keep entries as single bullet lines. No summaries, no paragraphs, no date headers.

### Todo

- **Run DB migrations on prod** — `bash backend/run_migrations.sh`; includes `add_officers_display_name.sql` and `reorder_officer_departments.sql`; safe to re-run (all use `IF NOT EXISTS` or idempotent UPDATEs)
- **Google OAuth frontend** — backend done; navbar auth link already visible; needs `GOOGLE_OAUTH_CLIENT_ID` in backend `.env` for full end-to-end test.
- **Google Calendar service account** — must have `calendar.events` scope (not `calendar.readonly`) in GCP for write endpoints
- **Pre-existing TypeScript build errors** — `AdminEventTypesTab.tsx`, `AdminPartnersTab.tsx`, `AdminProgressTab.tsx`, `AdminSponsorsTab.tsx`, `AdminUsersTab.tsx`, `AdminDashboard.tsx` have unused-import/type errors; clean up before production build
- **Officer photos** — a few officers still use `/officer_photo_blank.png`; swap in real headshots when available
- **Event RSVP enhancements** — email reminder 24h before (wire through notification scheduler), RSVP list drawer in admin Events tab
- **Admin Audit Log** — `audit_log` table; searchable log tab in Admin Tools
- **Officer Task Board** — To Do / In Progress / Done kanban; `officer_tasks` table
- **Meeting Notes** — per-meeting notes (title, date, attendees, agenda, action items); `meeting_notes` table
- **Microsoft / Outlook OAuth** — `POST /auth/microsoft` via `msal`; auto-verify `@cougarnet.uh.edu` / `@uh.edu`
- **Discord OAuth follow-up** — integration tests for `/auth/discord/callback` (login + connect intents)
- **Discord Webhook** — on event create/update, post to Discord incoming webhook; use `discord_config.announcement_channel`
- **Discord Event Sync** — create Discord Guild Scheduled Events via API when admin creates/updates an event
- **Event Archive** — searchable public page of past events
- **Projects Archive** — officer/member project showcase; `projects` + `project_contributors` tables
- **Club Resource Library** — members-only slides/repos linked to events via `resource_url`
- **Weekly Email Digest** — Sunday cron; points earned, rank change, upcoming events per member
- **PWA Support** — `manifest.json` + service worker; useful for mobile QR check-in
- **Achievement Badges** — `GET /dashboard/badges`; milestone badges from points/attendance queries
- **Points Redemption / Merch Shop** — spend points on merch; inventory table + officer fulfillment
- **Member Engagement Score** — check-in frequency + streak + points; surface in member directory
- **Email Notification improvements** — HTML templates, unsubscribe links, per-member opt-out (`notification_prefs` table)
- **Bulk Email Composer** — one-off blast from admin panel; logs to `notification_logs`
- **Receipt Book improvements** — CSV/PDF export, multi-year fiscal views, approval workflow

### Done

- ✅ Phase 1 testing foundation — `tests/unit/` (104 tests, no Docker); `tests/integration/` (db_session autouse scoped to integration only); `.coveragerc`; pytest markers; passlib replaced with direct `bcrypt` in `passwords.py` (passlib 1.7.4 + bcrypt 5.x incompatibility fix); utils coverage: passwords 100%, date_validation 100%, query_handler 99%, auth_decorators 94%
- ✅ Backend OOP refactor — all route files use explicit imports (no `from app.imports import *`); large blueprints split into sub-packages (`admin/`, `events/`, `auth/`, `partners/`); 11 service classes extracted (`BaseService` pattern); `@jwt_required()` replaced with `@require_authenticated`; `get_db()` returns g-scoped connection (no leaks)
- ✅ User Dashboard (`/dashboard`) — Profile, Membership, Points, Leaderboard, Check-In tabs
- ✅ Onboarding wizard (`/onboarding`) — 3-step first-login flow; student ID required
- ✅ Event self-check-in — code entry + QR camera scan (`html5-qrcode`); `POST /events/checkin`
- ✅ Attendance streak — monthly streak tracking on profile; updated on every check-in
- ✅ Stripe webhook overhaul — `expires_at`/`plan_id`/`stripe_session_id` on payments; academic-calendar expiry
- ✅ Rate limiting — `flask-limiter` on auth, check-in, billing, avatar endpoints
- ✅ React Query — all dashboard fetches use `@tanstack/react-query`
- ✅ Leaderboard privacy — `is_public` toggle; non-public users hidden from table
- ✅ Admin Dashboard (`/admin`) — Overview, Users, Officers, Events tabs; role-gated (admin/officer)
- ✅ Role hierarchy — `admin > officer > partner > member > non-member`; `webmaster` merged into `admin`
- ✅ Event CRUD — officer+ can create/edit; admin can delete; `POST /admin/events/<id>/regenerate-code`
- ✅ Billing webhook sets member role — upgrades `non-member` → `member` on `checkout.session.completed`
- ✅ Officer position titles — 16 pre-seeded titles; grouped `<select optgroup>` in officer modals
- ✅ Event Types CRUD — `event_types` table (name, points, color); admin tab; events use dynamic dropdown
- ✅ Sponsors CRUD — `sponsors` table; logo upload; tier management; `GET /sponsors/` public
- ✅ Partners CRUD — `partners` + `partner_members`; role set to `partner` on assignment
- ✅ Manual membership — admin grants via `PATCH /admin/users/<id>/membership`; `is_manual=TRUE` payment row
- ✅ Point management — award/deduct with reason; `GET|POST /admin/points`; `GET /admin/points/summary`
- ✅ Member directory — officer read-only view; paginated + searchable; CSV export
- ✅ Progress reports — weekly officer reports; "My Report" + "Team Reports" views; auto-save draft
- ✅ Event Duplicate — pre-fills create modal from existing event
- ✅ QR code check-in — modal with CougarAI logo; copy/download PNG/SVG; `/checkin` page auto-submits
- ✅ Image upload — `POST /admin/upload-image`; saved to `backend/uploads/`; served via `GET /admin/uploads/`
- ✅ Navbar avatar dropdown — role-gated links; bell icon with unread count; initials fallback
- ✅ In-app notifications — `user_notifications` table; bell dropdown; polls every 60s
- ✅ Notification scheduler — Flask-APScheduler; Progress Report Reminder + Event Reminder; in-app + email channels
- ✅ Geolocation check-in — per-event location gate; Haversine validation on backend; map pin picker in modal
- ✅ Pinned announcements — `pinned_announcements` table; admin post/remove; dashboard amber banner
- ✅ Live event stats — `LiveEventModal` polls every 5s; check-in count, capacity bar, recent check-ins
- ✅ Receipt Book — admins log receipts with category/photo/fund; stats by category + monthly totals
- ✅ Club Budget Tracker — `budget_funds` table; spending limits; utilization progress bars
- ✅ Event RSVP — `rsvp_enabled` per event; `POST/DELETE /events/<id>/rsvp`; count shown to officers
- ✅ Event partner/sponsor tagging — junction tables; multi-select dropdowns in event modal
- ✅ Recurring events — weekly/monthly frequency picker; generates all occurrences on save
- ✅ Partner Dashboard (`/partner`) — Profile, Members, Events, Stats, Resources tabs
- ✅ Partner resource links — `GET|POST|DELETE /partners/<id>/resource-links`
- ✅ Auth pages — `/forgot-password`, `/verify-email`, `/reset-password` all wired end-to-end
- ✅ Google Calendar write — sync/remove events; `POST/DELETE /events/<id>/sync-to-google`
- ✅ Events tab UX — labeled primary actions + icon check-in cluster; date range filter; sort by date; ConfirmModal
- ✅ Check-in expiry auto-prefill — start + 4h default; locks on manual edit
- ✅ Security hardening — JWT secrets required in prod; SQL injection guard in query_handler; all blueprints auth-protected; webhook secret guard; timing attack fix on forgot-password
- ✅ Calendar page overhaul — dynamic event types from admin panel; RSVP in event modal; "My RSVPs" filter; NaN fix; points badge on tiles; past event dimming; CT timezone display; auto-generates check-in code when enabling check-in with no code; `GET /events/event-types` + `GET /events/my-rsvps` endpoints
- ✅ Calendar UX polish — Legend removed (redundant with Event Type filter); NaN day-number fix in list view (`Number(dateKey.slice(8,10))`); officer/admin "Edit Event" button in event modal (navigates to `/admin?tab=events`); event type colors updated to CougarAI red palette via `update_event_type_colors.sql` migration + frontend `TYPE_BRAND_COLORS` fallback
- ✅ Calendar event type colors fix — events in both month and list view now use DB color from `event_types`; `normalize_event_type_names.sql` migration corrects legacy singular names (`Social`→`Socials`, `Workshop`→`Workshops`); fuzzy prefix fallback added to `getTypeColor` for future stragglers; AgendaView now passes `ev.typeColor` override
- ✅ Calendar list view RSVP badge — replaced plain red text with a colored pill badge (dot + label) that uses the event's type color; shows count for officers/admins
- ✅ Central Time (CT) — `frontend/src/lib/dates.ts` utility; all date display across frontend uses `America/Chicago`
- ✅ Registration inline validation — validation errors now show inline under each field instead of a global banner; server errors still use the banner
- ✅ Membership auth gate — Memberships pricing CTAs redirect unauthenticated users to `/register`; Join page shows "account required" view when not logged in
- ✅ Post-auth redirect to `/join` — NotLoggedInView links use `state={{ from: '/join' }}` so Login/Registration redirect back after auth
- ✅ Registration resend email UX — "Resend email" button on success screen with 60-second cooldown countdown
- ✅ Login/Register in navbar — already live; `VITE_SHOW_AUTH_LINKS` was never implemented; navbar shows auth link when logged out automatically
- ✅ Discord OAuth — `GET /auth/discord/start`, `POST /auth/discord/connect-start`, `GET /auth/discord/callback`; login/register buttons on Login + Registration pages (gated by `VITE_ENABLE_DISCORD_OAUTH=true`); Profile tab shows connect/connected/disconnect UI; `discord_username` column added to `profile`; `auto_role` assigned on connect; `member_role` assigned in Discord when Stripe payment completes; `discord_config` extended with `officer_role`/`auto_role` columns + pre-seeded with CougarAI server IDs; requires `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` in backend `.env`
- ✅ Discord OAuth account linking fix — callback looks up existing user by `discord_id` only (username excluded — usernames can change); falls back to email provisioning for new accounts
- ✅ Discord button layout — icon pinned left via `absolute left-4`, text centered; full-width on Login + Registration pages matching Google button style
- ✅ Change / Set Password — Profile tab Security section; credential users enter current + new password; OAuth users (no password) can set one for the first time; 30-min email confirmation link required to apply; `GET /auth/password-status`, `POST /auth/change-password/request`, `POST /auth/change-password/confirm` routes in `credentials.py`
- ✅ Integration test schema setup — `tests/conftest.py::app` now applies `db-init/001_auth.sql` + auth migrations to the fresh Docker DB; `db_session` fixture no longer calls `create_all()` (was a no-op); login route fixed to SELECT and return actual `role` + `onboarding_completed_at`; `_build_auth_response` returns HTTP 200 (was 201); `tests/integration/test_auth.py` covers register, login, verify-email, refresh, logout, resend-verification, forgot-password
- ✅ Admin-managed slideshows — `slideshow_photos` table (`page`, `url`, `object_position`, `caption`, `is_active`, `display_order`); 5 admin routes at `/admin/slideshow-photos` (GET public, POST/PATCH/DELETE/reorder @require_admin); `AdminSlideshowTab` with drag-to-reorder grid (live preview), click-to-reposition crop mode (click anywhere on image to set focal point, white dot indicator, saves as `X% Y%`), active toggle, inline captions, file upload, "Seed from defaults" button; Home + About pages fetch from DB with hardcoded fallback arrays; Swiper pagination dots added; `add_slideshow_photos.sql` in `run_migrations.sh` and `tests/conftest.py` schema_files; 12 integration tests in `test_slideshow.py`
- ✅ Officers without accounts — `add_officers_display_name.sql` adds `first_name`/`last_name` to `officers` table; `add_officer_by_name()` creates placeholder `student_id` (`officer_<hex>`) for name-only entries; `link_officer_account()` swaps placeholder for real student_id when user signs up; `list_active_officers_public` uses `COALESCE(profile.first_name, officers.first_name)`; admin "Add Officer" modal has "Name Only" toggle; Edit modal shows "Link Account" user-search for unlinked officers; unlinked rows show yellow `no account` badge
- ✅ About page officer merge — `buildDepsMerged()` in `about.tsx` shows all static officers even when only some have DB accounts; DB officer data takes priority by full-name match; static fills gaps; both paths sorted by `DEPT_ORDER` priority map so order is always consistent regardless of DB state
- ✅ Department order — About page order locked to: Executive Board → Advisors → Webmasters → Marketing → Corporate Relations → Events Directors → Workshops / Projects → Historians → Other (last); enforced via `DEPT_ORDER` map in `about.tsx` and `reorder_officer_departments.sql` migration for DB `sort_order`; `officers.ts` array also reordered to match
- ✅ Department icons fixed — `DEPT_ICON_MAP` keys corrected to exact DB department names (`"Events Directors"`, `"Workshops / Projects"`); Historians gets Camera icon; all 8 departments now have icons
- ✅ Officer position CRUD — `POST/PATCH/DELETE /admin/officer-positions` routes (`@require_admin`); `create_position`, `update_position`, `delete_position` service methods; delete blocked if any active officer uses the position; collapsible "Position Titles" panel in AdminOfficersTab with inline add form, per-row edit (hover-reveal pencil), and delete; positions grouped by department
