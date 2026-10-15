# Handoff: Resume Review (ATS + local LLM)

_Last updated: 2026-10-15_

`backend/ats/` is a self-contained Python package. It takes a student's resume (PDF/DOCX) and an optional
job description, and returns a JSON report with ATS-style checks, keyword coverage, and AI feedback. The AI
runs **locally through Ollama**: resumes never leave our infrastructure, and personal info is redacted
before the model sees anything.

**Status:** the pipeline and security layer are done and tested. **It is not wired into the website yet**;
the plan is in [Integrating with the website](#integrating-with-the-website).

---

## How it works

`pipeline.process_resume(filename, data, job_description) -> dict` runs these steps in order:

| # | Step | Where | What it does |
|---|---|---|---|
| 1 | Validate upload | `security.validate_upload` | Extension + magic bytes + 5 MB cap. PDF: no JS/actions/attachments/launch links/encryption, ≤4 pages. DOCX: no macros/OLE/ActiveX/remote templates/zip-slip/zip bombs. |
| 2 | Antivirus | `security.clamav_scan` | Streams bytes to local `clamd`. **Fails closed**: if clamd is down, uploads are rejected. |
| 3 | Parse (sandboxed) | `extract.extract_sandboxed` | Runs the parser in a subprocess with memory/CPU limits, a timeout and no inherited env vars. Drops hidden text (white, <3pt, off-page) and counts it. |
| 4 | Sanitize | `security.sanitize_text` | Strips Unicode tag characters, bidi overrides, zero-width and control characters. |
| 5 | Injection signals | `security.scan_for_injection` | Regex flags for known prompt-injection phrasing in the resume and JD. A signal, not a guarantee. |
| — | ATS checks | `ats_checks.run_checks` | Deterministic checks (sections, contact info, length, tables/columns…). No LLM. Keyword coverage (`ats_checks.keyword_report`) is also computed here from the model's JD terms. |
| 6 | Redact PII | `security.redact_pii` | Name (first line), email, phone, URLs, SSN → `[NAME]`, `[EMAIL]`… before the model call. |
| 7 | LLM review | `pipeline.call_ollama` | Prompt in `prompts.py`; output is forced to the `schemas.LLMReview` JSON schema; retries on invalid JSON. |
| 8 | Verify output | `pipeline._build_feedback` | Model output is untrusted: URLs/HTML stripped, quotes checked against the resume (fake ones blanked), invented numbers flagged, skills not in the resume dropped. Keyword coverage is computed by code, not taken from the model. |

**Errors:** `security.UploadRejected` has a message that is safe to show the student as-is. Anything else
(e.g. `RuntimeError` from the model) is an internal error: show a generic message.

**Sponsor gate:** `report["security"]["sponsor_submission_allowed"]` is `False` whenever *any* flag is
raised (hidden text, injection phrasing, odd Unicode, model-suspected injection). Those resumes need an
officer to look before sponsors can see them.

### Files

| File | Purpose |
|---|---|
| `pipeline.py` | Entry point, Ollama call, output verification, CLI |
| `security.py` | Upload validation, AV, sanitizing, injection signals, PII redaction, output cleaning |
| `extract.py` | PDF/DOCX text extraction + sandboxed subprocess runner |
| `ats_checks.py` | Deterministic ATS checks and keyword coverage |
| `prompts.py` | System prompt + message builder (`PROMPT_VERSION`) |
| `schemas.py` | Pydantic models for model output and the final report (`SCHEMA_VERSION`) |
| `make_fixtures.py` / `run_security_tests.py` | Inert attack fixtures + a runner that checks each one end to end |

---

## Models

### Current default: `qwen2.5:3b`

Set in `pipeline.py` (`MODEL`), overridable with `OLLAMA_MODEL`. Changed from `qwen2.5:7b` because none of
our current hardware can run 7B at a usable speed (see below).

Settings sent with every request: `temperature=0`, `seed=42` (repeatable output), `num_ctx=8192`,
`num_predict=2500`, and `format=<LLMReview JSON schema>` so Ollama constrains the output to valid JSON.

| Model | Size | Notes |
|---|---|---|
| `qwen2.5:1.5b` | ~1 GB | Fits fully on a 2 GB GPU (Quadro K620). Fastest, weakest reviews, more JSON retries. |
| **`qwen2.5:3b`** | ~2 GB | **Default.** Mostly fits a 2 GB GPU at 8k context. Reasonable reviews. |
| `qwen2.5:7b` | ~5 GB | Best reviews. Needs a ≥6–8 GB GPU (GTX 1060 6GB / any RTX). Too slow on CPU. |

**Measured on the dev laptop (4-core Tiger Lake, no usable GPU):** `qwen2.5:7b` ran ~14 tok/s reading the
prompt and ~3.4 tok/s writing, so one review took 10–17 minutes and timed out.
`qwen2.5:3b` on the same laptop finished a full review in **~5–7 min** (fixture `00_clean_control.pdf` +
a backend-intern JD, ClamAV on). It works end to end, but **its written feedback is noticeably weaker**
(see Known gaps).

### Changing the model

1. `ollama pull <model>` on the Ollama host.
2. Set `OLLAMA_MODEL=<model>` (or change the default in `pipeline.py`).
3. Run `python ats/run_security_tests.py --live` and read the "live model" lines: it shows whether the
   new model flags injections and how it rates injected resumes. Smaller models are easier to fool.
4. Spot-check a few real reports for invented facts and JSON failures.

If you change `prompts.py` or `schemas.py`, bump `PROMPT_VERSION` / `SCHEMA_VERSION`. Both are stored in
every report's `meta`, so stored reports stay interpretable.

### Hardware

Ollama needs an NVIDIA GPU with CUDA compute capability ≥5.0 (Maxwell or newer). The club's Proxmox
server (`cai`) has a **Quadro K620** (Maxwell, 2 GB): usable for `1.5b`/`3b`, not `7b`. GPU passthrough
to a VM is in progress: IOMMU is on in GRUB and the card is blacklisted from the host; **VT-d still has to
be enabled in the HP BIOS** before `vfio-pci` will bind. Kernel is pinned to `6.17.13-9-pve` because the
7.0 kernels caused problems. NVIDIA driver series 580 is the last to support Maxwell.

---

## Running it

From `backend/` (the package must be imported as `ats`, so don't run from inside `ats/`):

```bash
pip install -r requirements.txt          # pymupdf, python-docx, pydantic, requests, clamd
python -m ats.pipeline resume.pdf [jd.txt]   # prints the JSON report
```

Services it needs:
- **Ollama** with the model pulled (`ollama pull qwen2.5:3b`).
- **ClamAV**: `sudo apt install clamav-daemon clamav-freshclam`, run `sudo freshclam` once, then
  `sudo systemctl enable --now clamav-freshclam clamav-daemon`. Uses ~1–1.5 GB RAM.

| Env var | Default | Purpose |
|---|---|---|
| `OLLAMA_URL` | `http://127.0.0.1:11434/api/chat` | Ollama endpoint. Keep it on a private network. |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Model tag |
| `OLLAMA_TIMEOUT` | `1800` | Seconds per attempt (3 attempts). Lower it once on a GPU (~120). |
| `REQUIRE_ANTIVIRUS` | `1` | `0` skips AV if clamd is unreachable. **Dev only.** |
| `CLAMD_SOCKET` | `/var/run/clamav/clamd.ctl` | clamd socket path |

## Testing

```bash
# Unit tests: no Ollama needed, ~3 s. ClamAV test auto-skips if clamd isn't running.
python -m pytest tests/unit/test_ats_security.py -v

# Fixture runner: generates inert attack files, runs each through the real pipeline
python ats/make_fixtures.py
python ats/run_security_tests.py             # mocked model
python ats/run_security_tests.py --with-av   # also requires clamd to catch EICAR
python ats/run_security_tests.py --live      # real model: shows how it reacts to injections
```

Both are wired to the real code; disabling a check makes tests fail (verified by temporarily breaking PDF
script detection, email redaction and the AV verdict).

The EICAR fixture is a raw file passed straight to `clamav_scan`: ClamAV only matches EICAR at the start
of a file, and a PDF must start with `%PDF-`, so it can't be tested through `process_resume`.

`backend/ats/resume.pdf`, `jd.txt` and `fixtures/` are gitignored. **Never commit a real resume**; use
`make_fixtures.py` output for examples.

---

## Integrating with the website

Nothing below exists yet. This is the recommended design, following the patterns already in the backend.

### 1. Don't run it inside the request

A review takes seconds on a good GPU and minutes on CPU, and Ollama handles one request at a time per
GPU. The route should **queue** the job and return immediately; a worker processes it.

**Recommended: a separate worker process that polls the database.** The repo has no Redis/Celery, so use
Postgres as the queue:

```sql
-- migrations/add_resume_reviews.sql
CREATE TABLE IF NOT EXISTS resume_reviews (
    review_id         SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status            TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'processing', 'done', 'rejected', 'failed')),
    filename_ext      TEXT NOT NULL,          -- 'pdf' | 'docx'; never store the user's filename
    upload            BYTEA,                  -- set to NULL as soon as processing finishes
    job_description   TEXT NOT NULL DEFAULT '',
    report            JSONB,                  -- FinalReport
    error_message     TEXT,                   -- UploadRejected message (student-safe) or generic text
    needs_review      BOOLEAN NOT NULL DEFAULT FALSE,  -- NOT report.security.sponsor_submission_allowed
    reviewed_by       INTEGER REFERENCES users(user_id) ON DELETE SET NULL,  -- officer who cleared it
    resume_sha256     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS resume_reviews_queue ON resume_reviews (created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS resume_reviews_user  ON resume_reviews (user_id, created_at DESC);
```

Worker loop (`backend/ats_worker.py`, run as its own systemd service or container, **one per GPU**):

```python
from ats.pipeline import process_resume
from ats.security import UploadRejected

while True:
    with conn:  # one transaction
        cur.execute("""
            UPDATE resume_reviews SET status = 'processing'
            WHERE review_id = (SELECT review_id FROM resume_reviews WHERE status = 'queued'
                               ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
            RETURNING review_id, filename_ext, upload, job_description""")
        row = cur.fetchone()
    if not row:
        time.sleep(2); continue
    rid, ext, data, jd = row
    try:
        report = process_resume(f"upload.{ext}", bytes(data), jd)
        update(rid, status="done", report=report, needs_review=not report["security"]["sponsor_submission_allowed"],
               resume_sha256=report["meta"]["resume_sha256"])
    except UploadRejected as e:
        update(rid, status="rejected", error_message=str(e))
    except Exception:
        log.exception("resume review %s failed", rid)          # no resume text in logs
        update(rid, status="failed", error_message="Something went wrong. Please try again later.")
    finally:
        clear_upload(rid)                                       # UPDATE ... SET upload = NULL
```

On startup, reset rows stuck in `processing` (from a crash) back to `queued`.

_Simpler alternative:_ a `ThreadPoolExecutor(max_workers=1)` inside Flask. Less setup, but jobs are lost
on restart and each gunicorn worker gets its own pool, so several reviews would hit the GPU at once. Fine
for a demo, not for production.

### 2. Routes

New blueprint `app/routes/resume_review.py`, registered in `app/imports/routes_import.py` as
`resume_review_bp: '/resume-review'`. Use the existing helpers: `require_authenticated`, `caller_id`,
`caller_role` from `app.utils.auth_decorators`, `get_db` from `app.raw_db`, and `limiter` from `app`.

| Method & path | Auth | Behaviour |
|---|---|---|
| `POST /resume-review` | `@require_authenticated`, `@limiter.limit("3/hour;10/day")` | Multipart `file` + optional `job_description`. Run `validate_upload` and `clamav_scan` **synchronously** (fast) so bad files get an immediate 400 with the `UploadRejected` message. Insert a `queued` row, return `202 {"review_id": …}`. Reject if the user already has a `queued`/`processing` review. |
| `GET /resume-review/<id>` | owner, or officer | `{status, report, error_message, created_at}`. Return 404 (not 403) for other users' reviews. |
| `GET /resume-review` | `@require_authenticated` | The caller's reviews, newest first, without the full report. |
| `GET /resume-review/flagged` | `@require_officer` | Reviews with `needs_review = TRUE AND reviewed_by IS NULL`. |
| `POST /resume-review/<id>/clear` | `@require_officer` | Sets `reviewed_by`; only then can the resume go to sponsors. |

Read `request.files["file"].read()` once, check the length against `security.MAX_UPLOAD_BYTES`, and pass
the bytes to the pipeline. Don't save to `uploads/` and don't trust `mimetype` (the pipeline checks magic
bytes).

### 3. Frontend

- Upload page: file input (`.pdf,.docx`), optional job-description textarea, then poll
  `GET /resume-review/<id>` every ~5 s while `status` is `queued`/`processing`.
- **Render every model string as plain text.** React escapes by default; never use
  `dangerouslySetInnerHTML` on report fields. The backend strips HTML, but escaping is the real defence.
- Show `evidence` as a quote only when `evidence_verified` is true.
- When `rewrite_has_unverified_numbers` is true, show "replace the numbers with your real results".
- Show `ats_view.checks` (pass/warn/fail) and `ats_view.keywords` (matched/missing, coverage %).
- Don't show students the raw `security.flags`; if a report is flagged, say an officer will review it
  before it's shared with sponsors.

### 4. Keeping users' data separate

**The pipeline itself is safe for many users.** `process_resume` keeps nothing between calls: no globals,
no caches. Each call gets a new temp folder (deleted afterwards, and the user's filename is never used), a
new parser subprocess with a clean environment, and a new random tag ID in the prompt. Ollama's
`/api/chat` is stateless: each request carries its full message list, and `keep_alive` only keeps the
model weights loaded, not past conversations.

Leaks would come from the website code around it. When integrating:

1. **Check ownership on every read.** Query `WHERE review_id = %s AND user_id = %s` with `caller_id()`,
   and return 404 (not 403) if there's no row, so users can't probe other people's IDs.
2. **Take the user ID from the JWT, never from the request** (body, query string or form field).
3. **Pass bytes, not paths.** Don't save uploads to the shared `uploads/` folder or under the user's
   filename; the pipeline makes its own private temp file.
4. **Don't keep reports in Python memory.** No module-level dicts or caches in Flask or the worker:
   gunicorn workers serve many users. The database row is the only place a report lives.
5. **Don't add conversation memory to `call_ollama`.** Build `messages` fresh for each job (as
   `build_messages` does now), and never use `/api/generate` with its `context` field, which carries tokens
   from the previous request.
6. **Clear the upload** (`upload = NULL`) as soon as the job finishes, whatever the outcome.
7. **Logs:** `review_id`, `resume_sha256`, status and timings only. Never resume text, JD text or model
   output.
8. **Frontend:** keep the report in component state, not `localStorage`. Clear it on logout so the next
   person on a shared computer doesn't see it. Poll using the `review_id` the server returned.
9. **Sponsor views** read only reports that are `done`, belong to students who opted in, and are either
   unflagged or cleared by an officer (`reviewed_by IS NOT NULL`).

### 5. Deployment

- **Ollama** on the GPU VM. Set `OLLAMA_HOST` to the VM's private address only, firewall port 11434 to
  the backend host, and give the VM no outbound internet once the model is pulled. Point the worker at it
  with `OLLAMA_URL=http://<vm-ip>:11434/api/chat`.
- **ClamAV** on the host running the backend and worker (or a `clamav/clamav` container with
  `CLAMD_SOCKET` pointing at its socket). Keep `REQUIRE_ANTIVIRUS=1` in production.
- The parser subprocess sets `RLIMIT_AS`/`RLIMIT_CPU` (POSIX only); the worker must run on Linux.
- **Privacy:** never log resume text, job descriptions, or model output; log `review_id`, `resume_sha256`,
  status and timings. Decide on retention (e.g. delete reports after N months) before launch.

---

## Known gaps / open items

- **`qwen2.5:3b` misreads resumes in its written feedback.** On the test resume (which lists Python and
  SQL) its `fit_rationale` claimed both were missing. Keyword coverage is computed by code and is correct
  (Python/SQL/REST/Git matched, Docker/AWS missing), so the UI should lead with `ats_view.keywords`, not
  the model's prose. The real fix is `qwen2.5:7b` on a ≥6–8 GB GPU.
- **Small models return whole JD bullets as terms** ("Working knowledge of SQL and relational databases").
  Handled in code: `ats_checks.split_jd_term` strips filler ("experience with", "proficiency in"),
  parentheticals and leading gerunds, splits "A and B" into separate keywords, treats "A, B, or C" as
  alternatives, and drops bullets over 10 words (e.g. degree + graduation window). Limiting the schema's
  `maxLength` was tried and made it worse: the model kept copying bullets and they got cut off mid-word.

- **Paraphrased injections** ("the strongest application reviewers have seen…") get past the regex
  list. The defences are the tagged prompt, the schema, output verification, the model's own
  `suspected_prompt_injection` flag, and human review. Check how `qwen2.5:3b` handles them with
  `run_security_tests.py --live`.
- **Text hidden under a white rectangle** is still extracted (fixture 30). Fixing it needs a
  render-and-OCR comparison.
- **Scanned PDFs** are rejected ("couldn't find readable text"). OCR fallback is a TODO in `pipeline.py`.
- **Name redaction** only catches a name on the first line. Names elsewhere reach the model.
- **DOCX page count** is estimated (500 words/page).
