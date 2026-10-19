# Handoff — Bulk email fix + attachments, private receipt uploads

_Last updated: 2026-10-19 · branch `fix/bulk-email-send-attachments` (worktree
`.claude/worktrees/fix-bulk-email-send-attachments`) · not merged, no PR._

**Why:** "Failed to fetch" on admin bulk email. `POST /admin/bulk-email/send` sent
synchronously, one SMTP connect+login per recipient with no timeout, so a members-sized
list blew gunicorn's 60 s `--timeout` and Cloudflare returned an error page without CORS
headers. CORS itself is fine.

**What changed**
- Send runs on a background thread over **one** SMTP session (`timeout=30`). The log
  row is written first as `sending` with `recipients_total`; the route returns
  `202 {log_id, recipients_total}`; the tab polls every 3 s.
- One send at a time across all gunicorn workers: partial unique index
  `bulk_email_logs_one_sending` → 409. A row whose heartbeat is >10 min old becomes
  `interrupted`; a job that finds its row interrupted stops. Nothing is retried
  automatically. A recipient whose connection dropped mid-send is logged as
  "delivery unknown" and **not** resent. SMTP unset → `skipped_unconfigured` ("Not sent").
- Attachments (multipart; JSON still accepted): PDF/PNG/JPG/WEBP/GIF/DOCX/PPTX, ≤10 files,
  ≤10 MB each, ≤18 MB total; extension + declared type + magic bytes. `MAX_CONTENT_LENGTH`
  20 MB with a JSON 413.
- HTML part only when the body has real HTML tags (`<jane@uh.edu>` stays plain text).
- Receipts: `receipts` is a private upload category (admin only). The public
  `/admin/uploads/...` route refuses it; images are served by the admin-only
  `GET /admin/receipts/image/<file>` and shown in the tab through an authenticated blob URL.

**Owner steps after merge (prod backend host)**
1. `psql … -f backend/migrations/add_bulk_email_logs.sql` then
   `add_bulk_email_attachments.sql` (or `bash backend/run_migrations.sh` — both are now in
   its list; all migrations are idempotent).
2. Set `SMTP_HOST/PORT/USER/PASSWORD/USE_TLS` in `backend/.env` (see README; Gmail needs an
   App Password; ~500/day personal, 2,000/day Workspace).
3. Restart gunicorn.

**Verification (2026-10-19)**
- Backend `pytest --cov=app`: all green (new: `tests/integration/test_bulk_email.py`,
  `test_receipt_uploads.py`, `tests/unit/test_mailer.py`). Frontend `npm run build` green.
- Mutation checks, each one made a test go red: per-file size, file count, total size, declared type,
  magic bytes, HTML-tag detection, admin role (officer refused), 409 index + handler, stale →
  interrupted, timed heartbeat, stop when claim lost, no resend after a drop, private-category
  refusal, receipt-image admin role, 413.
- Reviews: ponytail-review (fixed: `<address>` stripped as HTML; unknown declared types blocked
  valid DOCX/PPTX). Codex 4 rounds: r1 timed heartbeat, r2 clean, r3 no resend after an ambiguous
  drop, r4 clean (on 4615c4a; later commits are UI-only style fixes + .gitignore).
- UI: impeccable audit + Web Interface Guidelines pass (modal uses the shared admin modal shell,
  24px chip targets, tabular numbers). Local headless QA before (main) / after, desktop + phone,
  both colour-scheme emulations: all checks pass; round 2 found the overlay 24px gap (fixed, re-measured).
- **Not done:** push / Vercel preview QA / PR — pushing to Cougar-AI is blocked (403: the org
  forbids the box's fine-grained token, lifetime > 366 days). PR text is ready in the worktree's
  `PR_DESCRIPTION.md` (untracked).

**Resume**
```bash
cd .claude/worktrees/fix-bulk-email-send-attachments/backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/pytest --cov=app        # needs Docker (pytest-docker → postgres:17.5-alpine)
cd ../frontend && npm ci && npm run build
```

**Open questions / known gaps**
- `npm run lint` is broken on `main` too: `eslint.config.js` passes react-hooks v7's legacy
  `configs['recommended-latest']` to flat config. With the flat preset, lint reports 80
  pre-existing errors in files this branch does not touch; the three changed files lint clean.
- 18 MB of attachments is ~25.8 MB once base64-encoded — inside Gmail's SMTP limit, but
  some recipient servers refuse that size. Lower the cap if failures show up.
- The message is rebuilt per recipient (fine at club scale; build once if lists get large).
- The site has no light theme toggle (dark only), so "both themes" was checked by emulating
  `prefers-color-scheme`.
- `AdminReceiptsTab` still uses its own `apiFetch` for the JSON calls (reads only
  `localStorage`, no 401 refresh) — only the upload and image loading moved to `@/lib/api`.

---

# Handoff — RSVP fix, QR scan fix, Guest QR check-in, Classroom dropdown

_Last updated: 2026-09-13_

This document summarizes a batch of work delivered across four (+ follow-up) pull
requests, how each was verified, and what remains open. See
`docs/verification-2026-09.md` for the full verification report and the coordinate
methodology.

## What shipped

| Area | PR | Branch | Summary |
|---|---|---|---|
| Member RSVP bug | #100 | `fix/rsvp-member-state` | Dashboard read RSVP state from the **officer-only** `GET /events/<id>/rsvp` (403 for members) so the button never reflected a successful RSVP. Switched to the authenticated bulk endpoint `GET /events/my-rsvps`; Calendar `toggleRsvp` now surfaces errors instead of swallowing them. **Follow-up:** `non-member` role is now allowed to RSVP (new registrations default to `non-member`, so they were previously blocked entirely). |
| QR scan camera | #101 | `fix/qr-scan-camera` | "Scan QR Code" showed a blank box. Hardened the `html5-qrcode` effect (double-init guard, ordered start/stop, session-counter re-trigger to survive a rapid close→reopen race) and added explicit permission / insecure-context / no-camera errors with a manual-entry fallback. Generated QR URLs now use `window.location.origin` instead of a hardcoded `localhost:5173`. |
| Guest QR check-in | #103 | `feat/guest-qr-checkin-signup` | A logged-out person who scans an event QR is routed through register → verify email → login → onboarding and auto-checked-in using the preserved code. The `?code=` is captured in `ProtectedRoute` (before the auth redirect) into sessionStorage (`cougarai:pendingCheckinCode`) and consumed on the way back to `/checkin`; the code is cleared in a `finally` so a failed check-in can't hijack a later login. |
| Classroom location dropdown | #102 | `feat/uh-classroom-location` | Admin event modal has a searchable UH **main-campus** building picker (`frontend/src/data/uhClassrooms.ts`, 38 buildings) + optional Room field. Selecting a building sets the free-text `location` (`"<Name> (<CODE>) <room>"`) and auto-fills `latitude`/`longitude` + recenters the Leaflet pin. The geofence toggle (`require_location`) stays manual. |

All four PRs are frontend changes (plus the small RSVP backend allowlist tweak in the follow-up). None were merged — they are open for review.

## Verification

Verified end-to-end in a headless browser (Puppeteer) against an **isolated local
test database** — production was never touched. Live-confirmed: member RSVP flip +
persistence + `GET /events/my-rsvps` payload; QR scanner opens a live camera feed
(no blank box); logged-out scan captures the code, redirects to auth, and
auto-checks-in after login; classroom picker sets the location string + room.
Each PR also passed an independent static correctness review (which is what caught
the guest-checkin capture bug, the scanner rapid-toggle race, and the classroom
room-edit clobber — all fixed before this handoff). Combined production build of all
four passes. Details + screenshots in `docs/verification-2026-09.md`.

## Running the local test environment

`backend/.env` points at **production** and `run.py` uses `ProductionConfig`, so do
NOT run write flows against it. For safe local testing use the isolated test DB:

- Test DB: `cougarai_test` on `localhost:5432` (schema reconstructed in
  `backend/tests/local_base_schema.sql`; the base `events`/`profile`/`points`/
  `payments`/`officers` tables have no committed DDL and exist only in prod).
- Backend env: `backend/.env.test` (localhost DB + test JWT secrets).
- Start backend: `cd backend && source venv/bin/activate && set -a && source .env.test && set +a && python run.py` (port 5001).
- Start frontend: `cd frontend && npm run dev` with `VITE_BACKEND_API_URL=http://localhost:5001` (see `frontend/.env.local`).
- Seed users (pw `Password123!`): `admin@test.local` (admin), `member@test.local` (member). Seed event code: `TEST123`.

`backend/tests/local_base_schema.sql` and `backend/.env.test` are local test helpers
(not for production).

## Open items / decisions

- **Classroom coordinates** are OSM-footprint-derived (<100 m accuracy) for the 38
  main-campus buildings. `TU2` has no OSM feature under that name — its coordinate
  is a best-effort estimate (flagged in the data file). Sugar Land / Katy were
  intentionally excluded (club uses main campus only).
- **Auto-filled coordinates persist only when "Require location check-in" is enabled**
  (pre-existing save behavior — lat/lon are only sent to the backend when
  `require_location` is true). Picking a building pre-fills the pin; enabling the
  geofence toggle before saving persists it. Left as designed.
- **Integration test for the RSVP role change is deferred** — the integration
  harness only applies the auth schema, and the events/RSVP base tables lack
  committed DDL (a known Phase-1 limitation). The change itself is a single role
  added to a server-side allowlist.
- **Guest check-in cross-tab limit:** if the email-verification link opens in a
  different browser/tab, sessionStorage won't carry the pending code, so auto-check-in
  won't fire (account creation still works). Same-browser flow works.
