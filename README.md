# CougarAI Website Revamp

Full-stack SPA for the CougarAI club website.

**Frontend:** React 19 · TypeScript · Vite · Tailwind CSS 4 · shadcn/ui · React Router v7 · react-leaflet  
**Backend:** Python · Flask · SQLAlchemy · PostgreSQL · Flask-JWT-Extended  
**Payments:** Stripe | **Icons:** Lucide React | **Carousel:** Swiper

---

## Running Dev Servers

Two terminals must run simultaneously.

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

> **macOS note:** AirPlay Receiver occupies port 5000 by default. Flask runs on **port 5001**.

---

## Build & Lint

```bash
# Frontend
npm run build       # production build
npm run lint        # ESLint
npm run preview     # preview production build

# Backend
pytest              # run tests (some require Docker)
gunicorn wsgi:app   # production WSGI server
```

---

## Environment Variables

### Backend — `backend/.env`

```
DB_NAME=
DB_USER=
DB_PASS=
DB_HOST=
DB_PORT=5432

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_EMAIL_SECRET=
JWT_RESET_SECRET=

GOOGLE_CREDS_PATH=google/cougarai-points-12e0075f283d.json
GOOGLE_CALENDAR_CREDS_PATH=google/cougarai-calendar-cbf6736bbb3e.json
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=

STRIPE_SECRET_KEY=
STRIPE_TEST_SECRET_KEY=
STRIPE_MODE=test
STRIPE_WEBHOOK_SECRET=

FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173,http://127.0.0.1:5173,https://cougarai.org,https://www.cougarai.org
GOOGLE_OAUTH_CLIENT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
# Optional override if your public backend URL differs from request.url_root
MICROSOFT_REDIRECT_URI=

# Outgoing mail (verification, password reset, receipts, admin bulk email)
MAILER_BACKEND=smtp          # "console" logs mail instead of sending (local dev)
SMTP_HOST=smtp.gmail.com     # unset or "localhost" = mail is skipped (bulk sends show "Not sent")
SMTP_PORT=587
SMTP_USER=                   # also used as the From address
SMTP_PASSWORD=               # for Gmail: an App Password, not the account password
SMTP_USE_TLS=true

# Discord bot service key: the bot sends `Authorization: Bot <key>` instead of logging
# in as a person. Same value in the bot's .env. Unset (or under 32 chars) = off.
# Also run migrations/add_discord_bot_user.sql (in run_migrations.sh) so its actions are attributed.
# Generate: python -c "import secrets;print(secrets.token_urlsafe(32))"
BOT_API_KEY=
```

**Discord bot key.** A valid `BOT_API_KEY` acts as the `admin` role, but only on the routes in
`BOT_ALLOWED_ROUTES` (`backend/app/utils/auth_decorators.py`), which are the calls the bot makes. On any
other route a valid key gets **403**. A wrong key, or no server key set, gets **401**. Routes that only
need a logged-in user (`require_authenticated`) never accept it. Actions it takes (pinned announcement,
awarded points, officer check-in) are attributed to the service user `discord-bot@cougarai.invalid`
(`migrations/add_discord_bot_user.sql`; inactive, no password, so nobody can log in as it). A key that is
set but too short is ignored, and the backend logs a warning at startup. To let the bot call a new route, add it to
`BOT_ALLOWED_ROUTES` **and** to `EXPECTED_BOT_ROUTES` in `tests/integration/test_bot_api_key.py`. The
test fails until both match. To rotate the key, set the new value on both hosts and restart both. The
key is URL-safe base64 (no `$`, quotes or `#`), so systemd and shells leave it alone.

**Mail limits.** Bulk email sends one message per recipient. Gmail caps sending at about
**500 recipients/day for a personal account and 2,000/day for Google Workspace**; past that, sends
fail until the window resets and the log row shows *Partial*. Attachments: PDF, PNG, JPG, WEBP, GIF,
DOCX, PPTX, up to 10 files, 10 MB each, 18 MB total (about 25.8 MB once encoded; some recipients'
mail servers refuse messages that large). Only one bulk send runs at a time; a send whose server process
died is marked *Interrupted* after 10 minutes and is never retried automatically (check the sent count
before re-sending).

### Frontend — `frontend/.env`

```
VITE_BACKEND_API_URL=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_TEST_PUBLISHABLE_KEY=
VITE_STRIPE_MODE=test
VITE_SHOW_AUTH_LINKS=false
VITE_ENABLE_MICROSOFT_OAUTH=false
```

Set `VITE_SHOW_AUTH_LINKS=true` once Google OAuth is tested end-to-end to show Login/Register in the navbar.

### Microsoft OAuth Setup

The repo already contains a Microsoft OAuth flow:

- Backend start endpoint: `GET /auth/microsoft/start?intent=login|register`
- Backend callback: `GET /auth/microsoft/callback`
- Frontend buttons: `src/pages/Login.tsx` and `src/pages/Registration.tsx`

In Azure App Registration:

- Add a Web redirect URI for local dev:
  `http://127.0.0.1:5001/auth/microsoft/callback`
- Add a Web redirect URI for production that matches your backend origin:
  `https://<your-backend-origin>/auth/microsoft/callback`
- Create a client secret and place it in `MICROSOFT_CLIENT_SECRET`
- Use `common` as the tenant for multi-tenant/member accounts, or set a specific tenant ID if you want to restrict sign-in
- Grant the delegated Microsoft Graph permission `User.Read`

Then enable the frontend button by setting:

```bash
VITE_ENABLE_MICROSOFT_OAUTH=true
```

---

## Project Structure

```
frontend/src/
  pages/          # Route-level page components
  components/     # Reusable components
    ui/           # shadcn/ui components (auto-generated — don't hand-edit)
  layouts/        # RootLayout (shared nav/footer)
  data/           # Static data files (officers.ts)
  lib/            # Utility functions
  App.tsx         # Router definition
  main.tsx        # Entry point

backend/app/
  routes/         # Flask blueprints
  services/       # Business logic
  utils/          # Helpers
  imports/        # Aggregated imports
  __init__.py     # App factory — blueprint registration & CORS config
  raw_db.py       # Raw DB connection utilities

backend/
  config.py       # Environment configs (Base/Dev/Test/Production)
  run.py          # Dev entry point
  wsgi.py         # Gunicorn entry point
  openapi.yaml    # API documentation
  tests/          # pytest suite
  migrations/     # SQL migration files
  google/         # Service account key files (gitignored)
```

---

## Adding shadcn/ui Components

Run from the `frontend/` directory:

```bash
npx shadcn@latest add <component-name>
```

Do not manually edit files in `components/ui/`.

---

## Database Migrations

Apply migrations in order using the migration script (safe to re-run — all use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`):

```bash
bash backend/run_migrations.sh
```

---

## User Roles

| Role | Default? | Access |
|---|---|---|
| `admin` | No | Full access — user mgmt, all CRUD, unified dashboard |
| `officer` | No | Event management, officer tools in `/admin` |
| `partner` | No | Partner org member; set automatically on org assignment |
| `member` | No | Full member dashboard; set automatically on Stripe payment |
| `non-member` | **Yes** | Registered but hasn't purchased membership |

---

## Pages

| Path | Notes |
|---|---|
| `/` | Home |
| `/about` | Officer roster from `data/officers.ts` |
| `/calendar` | Fetches from Google Calendar via `GET /events/google` |
| `/sponsors` | DB-driven sponsor list |
| `/memberships` | Membership info |
| `/join` | Stripe checkout |
| `/dashboard` | Protected — Profile, Membership, Check In, Points, Leaderboard |
| `/onboarding` | 3-step first-login wizard |
| `/admin` | Protected (admin/officer) — unified dashboard with collapsible sidebar |
| `/checkin` | Protected — auto-submits check-in from QR code URL (`?code=`) |
| `/partner` | Protected (partner/admin) — Partner Dashboard |
| `/login` | Google OAuth wired |
| `/register` | Google OAuth wired |

---

## Stripe Integration

- Mode controlled by `VITE_STRIPE_MODE` / `STRIPE_MODE` (both must match)
- Webhook endpoint: `POST /billing/webhook` — verify with `STRIPE_WEBHOOK_SECRET`
- Local testing: `stripe listen --forward-to localhost:5001/billing/webhook`

| Plan | Live Price ID | Test Price ID |
|---|---|---|
| Semester | `price_1S4sVLH2XIQuLIalBvif5rrs` | `price_1RPA0wQdq5f9y5dILdnU8jkY` |
| Yearly | `price_1S0ylVH2XIQuLIalbpMXxrV9` | `price_1RPA1MQdq5f9y5dIX6qzElLY` |

---

## Social Links

| Platform | Link |
|---|---|
| Discord | https://discord.gg/ucd5ZnDDnf |
| Instagram | https://www.instagram.com/cougar_ai/ |
| GitHub | https://github.com/Cougar-AI |
| LinkedIn | https://www.linkedin.com/company/cougar-ai |
| Email | cougaraicontact@gmail.com |
