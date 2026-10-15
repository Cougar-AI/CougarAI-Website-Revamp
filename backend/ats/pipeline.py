"""
End-to-end pipeline.

    from ats.pipeline import process_resume
    report = process_resume("resume.pdf", open("resume.pdf", "rb").read(), job_description_text)

Run from a background worker, not inside the web request (see HANDOFF.md). Returns a JSON-serializable dict
matching schemas.FinalReport. Raises security.UploadRejected with a student-safe message.

CLI test (from backend/):  python -m ats.pipeline resume.pdf [jd.txt]

Never log resume text or model output. Log only the resume hash, status, and timings.
"""
from __future__ import annotations

import hashlib
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import requests
from pydantic import ValidationError

from . import ats_checks
from .extract import ExtractionFailed, extract_sandboxed
from .prompts import PROMPT_VERSION, build_messages
from .schemas import (
    SCHEMA_VERSION, AtsView, FinalReport, Feedback, LLMReview, ReportMeta, SecurityReport, VerifiedSuggestion,
)
from .security import (
    UploadRejected, clamav_scan, clean_model_string, evidence_in_source, has_unverified_numbers, normalized,
    redact_pii, sanitize_text, scan_for_injection, suspicious_unicode, validate_upload,
)

# Ollama must listen on 127.0.0.1 only (OLLAMA_HOST), with no outbound network from that host/container.
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "1800"))  # seconds per attempt; CPU-only hosts need minutes
NUM_CTX = 8192
MAX_RESUME_CHARS = 12_000   # ~3k tokens
MAX_JD_CHARS = 6_000        # ~1.5k tokens; leaves room for prompt (~1k) and output (~2.5k) inside NUM_CTX
MIN_TEXT_CHARS = 200

_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def call_ollama(messages: list[dict], retries: int = 2) -> LLMReview:
    schema = LLMReview.model_json_schema()
    last_err = "unknown error"
    for _ in range(retries + 1):
        try:
            r = requests.post(
                OLLAMA_URL,
                json={
                    "model": MODEL, "messages": messages, "stream": False, "format": schema,
                    "keep_alive": "10m",
                    "options": {"temperature": 0, "seed": 42, "num_ctx": NUM_CTX, "num_predict": 2500},
                },
                timeout=OLLAMA_TIMEOUT,
            )
            r.raise_for_status()
            content = r.json()["message"]["content"]
        except (requests.RequestException, KeyError, ValueError) as exc:
            last_err = f"ollama request failed: {type(exc).__name__}"
            continue
        try:
            return LLMReview.model_validate_json(content)
        except ValidationError as exc:
            last_err = str(exc)[:600]
            # Ask for a fix; only our own error text + the model's previous (truncated) JSON go back in.
            messages = messages + [
                {"role": "assistant", "content": content[:2000]},
                {"role": "user", "content": f"That JSON failed validation: {last_err}\nReturn corrected JSON only."},
            ]
    raise RuntimeError(f"Model did not return valid output: {last_err}")


def _build_feedback(review: LLMReview, source_text: str) -> Feedback:
    src_norm = normalized(source_text)
    suggestions: list[VerifiedSuggestion] = []
    seen = set()
    for s in review.suggestions:
        d = s.model_dump()
        for k in ("issue", "evidence", "recommendation", "rewrite_example", "addresses_requirement"):
            d[k] = clean_model_string(d[k])
        key = normalized(d["issue"])[:80]
        if not d["issue"] or not d["recommendation"] or key in seen:
            continue
        seen.add(key)
        claimed = bool(d["evidence"])
        verified = (not claimed) or evidence_in_source(d["evidence"], src_norm)  # nothing claimed -> nothing to fail
        if claimed and not verified:
            d["evidence"] = ""  # never show the student a quote that isn't in their resume
        suggestions.append(VerifiedSuggestion(
            **d, evidence_verified=verified,
            rewrite_has_unverified_numbers=has_unverified_numbers(d["rewrite_example"], source_text),
        ))
    suggestions.sort(key=lambda x: _PRIORITY_ORDER[x.priority])
    return Feedback(
        summary=clean_model_string(review.summary),
        overall_fit=review.overall_fit,
        fit_rationale=clean_model_string(review.fit_rationale),
        strengths=[c for c in (clean_model_string(x) for x in review.strengths) if c],
        suggestions=suggestions,
    )


def process_resume(filename: str, data: bytes, job_description: str = "") -> dict:
    # 1-2: validate + antivirus (cheap, before any parsing)
    kind = validate_upload(filename, data)
    clamav_scan(data)

    # 3: parse in a resource-limited subprocess, in a private temp dir
    with tempfile.TemporaryDirectory(prefix="rv_") as td:
        path = Path(td) / f"upload.{kind}"  # never reuse the user's filename
        path.write_bytes(data)
        path.chmod(0o600)
        try:
            ex = extract_sandboxed(path, kind)
        except ExtractionFailed:
            raise UploadRejected("We couldn't read this file. Try exporting it again as a plain PDF or DOCX.")

    raw = ex["text"]
    flags: list[str] = suspicious_unicode(raw)
    if ex["hidden_removed"]:
        flags.append("hidden_text_removed")

    # 4: sanitize
    text = sanitize_text(raw)
    jd = sanitize_text(job_description)[:MAX_JD_CHARS]
    if len(text) < MIN_TEXT_CHARS:
        # TODO: OCR fallback (ocrmypdf/tesseract) for scanned PDFs, run inside the same sandbox
        raise UploadRejected("We couldn't find readable text. If this is a scan, export a text-based PDF or DOCX.")

    # 5: injection signals on both untrusted inputs
    flags += [f"resume_{f}" for f in scan_for_injection(text)]
    flags += [f"jd_{f}" for f in scan_for_injection(jd)]

    # Deterministic ATS checks run on the sanitized text BEFORE redaction (they need the email/phone)
    checks = ats_checks.run_checks(text, ex)

    # 6: redact PII, then cap length (never silently: we report truncation)
    redacted, pii_counts = redact_pii(text)
    truncated = len(redacted) > MAX_RESUME_CHARS
    redacted = redacted[:MAX_RESUME_CHARS]

    # LLM call with schema-enforced output
    messages, _nonce = build_messages(redacted, jd)
    review = call_ollama(messages)
    if review.suspected_prompt_injection and not any("injection" in f for f in flags):
        flags.append("model_suspected_injection")

    # 7: verify and merge
    review.ats_parsed.skills = [s for s in review.ats_parsed.skills if ats_checks.term_in_text(s, ats_checks.norm_kw(redacted))]
    keywords = ats_checks.keyword_report(review.jd_requirements, redacted)
    feedback = _build_feedback(review, redacted)

    report = FinalReport(
        meta=ReportMeta(
            schema_version=SCHEMA_VERSION, prompt_version=PROMPT_VERSION, model=MODEL,
            generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            resume_sha256=hashlib.sha256(data).hexdigest(), pages=ex["pages"], input_truncated=truncated,
        ),
        security=SecurityReport(
            flags=sorted(set(flags)),
            sponsor_submission_allowed=not flags,   # any flag -> human review before sponsors see it
            pii_redacted_before_ai=pii_counts,
        ),
        ats_view=AtsView(checks=checks, parsed=review.ats_parsed, keywords=keywords),
        feedback=feedback,
    )
    return report.model_dump(mode="json")


if __name__ == "__main__":
    import json

    if len(sys.argv) < 2:
        sys.exit("usage: python -m ats.pipeline resume.(pdf|docx) [job_description.txt]")
    p = Path(sys.argv[1])
    jd_text = Path(sys.argv[2]).read_text() if len(sys.argv) > 2 else ""
    print(json.dumps(process_resume(p.name, p.read_bytes(), jd_text), indent=2))
