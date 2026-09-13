# Verification report — 2026-09

Covers the four PRs (#100 RSVP, #101 QR scan, #102 classroom dropdown, #103 guest
check-in) and the RSVP follow-up. All runtime verification was done against an
**isolated local test database** (`cougarai_test` on `localhost`) — production was
never contacted. See `HANDOFF.md` for how to bring the environment up.

## Method

1. **Static correctness review** — each PR diff was independently reviewed for
   logic correctness (response-shape matching, state machine tracing, null-safety,
   regressions). This caught three real bugs that were then fixed:
   - #103: the `?code=` was dropped before `CheckIn` mounted (fixed in `ProtectedRoute`).
   - #101: a rapid close→reopen race could leave a permanently blank scanner (fixed with a session-counter re-trigger).
   - #102: editing the Room field after a building pick clobbered manual location/coord edits (fixed by only re-templating when the location still matches the picker's last output).
2. **Live E2E (Puppeteer, headless Chromium)** — drove the real UI against the local
   stack. Test scripts live under the session scratchpad; screenshots were captured
   at each step.
3. **Combined build** — a production build with all four PRs merged into a throwaway
   integration branch passes (only the pre-existing chunk-size warning).

## Results

| Task | Live result |
|---|---|
| A — Member RSVP | Button flips `RSVP → ✓ RSVPed · Cancel`, persists across reload. `GET /events/my-rsvps` → `200 {"rsvped_event_ids":[1]}`. |
| B — QR scan | Clicking "Scan QR Code" mounts `#qr-reader` with a **playing video** stream (fake camera), no blank box, no console errors. QR-URL fix (`window.location.origin`) confirmed by review. |
| C — Guest check-in | Logged-out `/checkin?code=TEST123` → `cougarai:pendingCheckinCode=TEST123` stored + redirect to `/auth`. After member login → lands back on `/checkin?code=TEST123` and auto-check-in fires. |
| D — Classroom dropdown | Search "PGH" → select → `location` = `Philip Guthrie Hoffman Hall (PGH)`; Room `232` → `Philip Guthrie Hoffman Hall (PGH) 232`. Coordinate wiring (`applyClassroomSelection` sets `form.latitude/longitude` + `setMapCenter`) confirmed by review. |

## Coordinate methodology (PR #102)

The original coordinates were hand-estimated and materially wrong (most main-campus
buildings 250 m–1 km off; a duplicated D/D3; a satellite off by ~5.7 km). They were
re-derived from **OpenStreetMap building-footprint centroids** via the Overpass API,
matched by building name within the UH main-campus bounding box, and cross-checked
against the official UH building-number list and Wikipedia infobox coordinates for
landmark buildings (PGH, TDECU Stadium, Mitchell Center, M.D. Anderson Library
matched their references to within ~10–55 m). The result is accurate to well within
~100 m — suitable for map-centering and geofenced check-in.

Exceptions / notes:
- **TU2** — no OSM feature carries the "Teaching Unit 2" name; its coordinate is a
  best-effort estimate at its known NE-corner location (commented in the data file).
- **Sugar Land (AMG/BH2/SAB1) and Katy (KAB1)** were intentionally removed — the club
  only meets on main campus. The list is 38 main-campus buildings.

## Known limitations

- Auto-filled classroom coordinates are only written to the DB when the event's
  "Require location check-in" toggle is on (pre-existing save gate; left as designed).
- The guest-check-in code survives only within the same browser session; a
  verification email opened in a different tab/browser loses the pending code
  (documented; account creation still works).
- No automated integration test for the RSVP role change yet — the integration
  harness applies only the auth schema and the events/RSVP base tables have no
  committed DDL (Phase-1 limitation).
