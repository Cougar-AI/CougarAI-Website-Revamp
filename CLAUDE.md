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

# Other
STRIPE_SECRET_KEY=
FRONTEND_URL=http://localhost:5173
```

SMTP variables are also supported — see `backend/config.py` for the full list.

Create a `.env` file in `frontend/` (or copy `.env.example`):

```
VITE_BACKEND_API_URL=          # leave blank for same-origin
VITE_STRIPE_PUBLISHABLE_KEY=   # required for /join
VITE_SHOW_AUTH_LINKS=false     # set true to show Login/Register in navbar
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
  routes/         # Flask blueprints (auth, events, officers, payments, announcements, ...)
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

## Key Conventions

- **Frontend path alias:** `@/` resolves to `frontend/src/` — use it for all internal imports
- **Adding shadcn components:** `npx shadcn@latest add <component>` from `frontend/` — do not manually edit files in `components/ui/`
- **Backend blueprints:** register new blueprints in `backend/app/imports/routes_import.py`, then the factory in `__init__.py` picks them up automatically
- **Backend imports:** aggregate shared imports via `backend/app/imports/` rather than importing directly in each route file
- **Auth tokens:** access (15 min), refresh (7 days), email verify (24 hr), password reset (30 min) — configured in `config.py`
- **CORS:** allowed origin is `FRONTEND_URL` env var; enforced via flask-cors + an `after_request` hook in `__init__.py` that covers error responses too
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
| `/join` | `Join` | Stripe checkout — update price IDs before launch |
| `/contact` | `Contact` | |
| `/login` | `Login` | Google OAuth button present but disabled |
| `/register` | `Registration` | Google OAuth button present but disabled |
| `/forgot-password` | `ForgotPassword` | Stub — needs `POST /auth/forgot-password` backend |
| `/verify-email` | `VerifyEmail` | Stub — needs `POST /auth/verify-email` backend |
| `/terms` | `Terms` | Static content |
| `/privacy` | `Privacy` | Static content |

## Known TODOs

- **Stripe price IDs** — `Join.tsx` has placeholder `price_SEMESTER_XXXXXXXX` / `price_YEARLY_XXXXXXXX`; swap with real IDs before launch
- **Google OAuth** — Login and Registration pages have a disabled OAuth button; needs a `/auth/google` backend route
- **Forgot password / verify email frontend pages** — backend routes are fully implemented (`POST /auth/forgot-password`, `POST /auth/verify-email`); frontend page components are stubs only
- **Officer photos & LinkedIn URLs** — all currently using blank placeholder in `frontend/src/data/officers.ts`
- **Post-login flow** — after login there is no dashboard or redirect target yet; Login/Register are hidden in the navbar (`VITE_SHOW_AUTH_LINKS=false`) until this is built
- **Role-based UI gating** — role is now stored in DB and returned in JWT, but no frontend guards exist yet (protected routes, admin panel, etc.)
- **LinkedIn URL** — confirm final LinkedIn URL; currently `https://www.linkedin.com/company/cougar-ai`
