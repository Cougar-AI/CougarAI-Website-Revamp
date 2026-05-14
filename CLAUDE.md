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

Four roles are defined on the `users` table: `member` (default), `officer`, `webmaster`, `admin`.

- Migration: `backend/migrations/add_user_role.sql` — run once against the DB to add the `role` column
- The `role` field is returned by `POST /auth/login` in the `user` object and embedded in the access JWT claims
- `POST /auth/refresh` also includes the updated role in the new access token
- Admin → full access; Webmaster → most things; Officer → some things; Member → public access
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
- **Sponsors:** edit the `SPONSORS` array in `frontend/src/pages/Sponsors.tsx`

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
| `/login` | `Login` | Google OAuth button present but disabled |
| `/register` | `Registration` | Google OAuth button present but disabled |
| `/forgot-password` | `ForgotPassword` | Stub — needs `POST /auth/forgot-password` backend |
| `/verify-email` | `VerifyEmail` | Stub — needs `POST /auth/verify-email` backend |
| `/terms` | `Terms` | Static content |
| `/privacy` | `Privacy` | Static content |

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
payment_id  SERIAL PRIMARY KEY
student_id  INTEGER  (nullable — null when member checked out with email only)
email       VARCHAR(255) (nullable — set when no student_id)
date        DATE
amount      NUMERIC
```

Migration that added `email` and made `student_id` nullable: `backend/migrations/add_payments_email.sql`.

## Known TODOs

- **Google OAuth** — Login and Registration pages have a disabled OAuth button; needs a `/auth/google` backend route
- **Forgot password / verify email frontend pages** — backend routes are fully implemented (`POST /auth/forgot-password`, `POST /auth/verify-email`); frontend page components are stubs only
- **Officer photos & LinkedIn URLs** — all currently using blank placeholder in `frontend/src/data/officers.ts`
- **Post-login flow** — after login there is no dashboard or redirect target yet; Login/Register are hidden in the navbar (`VITE_SHOW_AUTH_LINKS=false`) until this is built
- **Role-based UI gating** — role is now stored in DB and returned in JWT, but no frontend guards exist yet (protected routes, admin panel, etc.)
- **LinkedIn URL** — confirm final LinkedIn URL; currently `https://www.linkedin.com/company/cougar-ai`
