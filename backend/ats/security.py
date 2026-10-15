"""
Security layer. Defence in depth, in pipeline order:

  1. validate_upload()      extension + magic bytes + size + structure (PDF actions/JS/attachments,
                            DOCX macros/OLE/embedded files/template injection, zip bombs)
  2. clamav_scan()          real antivirus engine (fail-closed by default)
  3. (extract.py)           parsing happens in a resource-limited subprocess
  4. sanitize_text()        strips invisible / bidi / Unicode-tag characters used to smuggle instructions
  5. scan_for_injection()   flags known prompt-injection phrasing (a signal, NOT a guarantee)
  6. redact_pii()           name/email/phone/URL never reach the model
  7. verify_*() / clean_*   model output is treated as untrusted too: quotes must exist in the resume,
                            URLs/HTML are stripped, invented numbers are flagged
"""
from __future__ import annotations

import difflib
import io
import os
import re
import unicodedata
import zipfile

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_PDF_PAGES = 4
MAX_PDF_OBJECTS = 20_000
MAX_DOCX_UNCOMPRESSED = 30 * 1024 * 1024
MAX_ZIP_ENTRIES = 300
MAX_ZIP_RATIO = 100
MAX_TEXT_CHARS = 20_000
ALLOWED_EXTENSIONS = {".pdf": "pdf", ".docx": "docx"}


class UploadRejected(Exception):
    """Message is safe to show directly to the student."""


# ----------------------------------------------------------------------------
# 1) Upload validation
# ----------------------------------------------------------------------------
def validate_upload(filename: str, data: bytes) -> str:
    """Returns 'pdf' or 'docx', or raises UploadRejected."""
    kind = ALLOWED_EXTENSIONS.get(os.path.splitext((filename or "").lower())[1])
    if not kind:
        raise UploadRejected("Only PDF and DOCX files are accepted.")
    if not data:
        raise UploadRejected("The file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise UploadRejected(f"File is too large (limit {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).")

    # Trust magic bytes, never the extension or the browser-supplied Content-Type.
    if kind == "pdf":
        if not data.startswith(b"%PDF-"):
            raise UploadRejected("This doesn't look like a valid PDF.")
        _check_pdf(data)
    else:
        if not data.startswith(b"PK\x03\x04"):
            raise UploadRejected("This doesn't look like a valid DOCX file.")
        _check_docx(data)
    return kind


_PDF_ACTIVE = re.compile(
    r"/(JavaScript|JS|OpenAction|AA|Launch|EmbeddedFiles?|RichMedia|XFA|SubmitForm|ImportData)(?![A-Za-z])"
)
_PDF_HELP = "Re-export it as a plain PDF (for example, 'Print to PDF') and try again."


def _check_pdf(data: bytes) -> None:
    import pymupdf as fitz  # PyMuPDF

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception:
        raise UploadRejected("We couldn't read this PDF. " + _PDF_HELP)
    try:
        if doc.needs_pass or doc.is_encrypted:
            raise UploadRejected("Password-protected PDFs can't be reviewed. Remove the password and try again.")
        if doc.page_count > MAX_PDF_PAGES:
            raise UploadRejected(f"Resumes are limited to {MAX_PDF_PAGES} pages.")
        if doc.xref_length() > MAX_PDF_OBJECTS:
            raise UploadRejected("This PDF is too complex. " + _PDF_HELP)
        if doc.embfile_count() > 0:
            raise UploadRejected("PDFs with attached files can't be accepted. " + _PDF_HELP)
        # xref_object() returns object dictionaries (incl. those inside compressed object streams),
        # so this catches actions/JS that a raw byte-grep would miss, without false hits in binary streams.
        for xref in range(-1, doc.xref_length()):  # -1 = trailer
            try:
                obj = doc.xref_object(xref)
            except Exception:
                continue
            if _PDF_ACTIVE.search(obj):
                raise UploadRejected("This PDF contains scripts, actions, or attachments. " + _PDF_HELP)
        for page in doc:
            for link in page.get_links():
                if link.get("kind") in (fitz.LINK_LAUNCH, fitz.LINK_GOTOR):
                    raise UploadRejected("This PDF contains links that launch other files. " + _PDF_HELP)
    finally:
        doc.close()


_DANGEROUS_EXT = (".exe", ".dll", ".js", ".vbs", ".bat", ".cmd", ".ps1", ".scr", ".jar", ".lnk", ".sh")


def _check_docx(data: bytes) -> None:
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise UploadRejected("This DOCX file appears to be corrupted.")

    infos = zf.infolist()
    if len(infos) > MAX_ZIP_ENTRIES:
        raise UploadRejected("This document has an unusual structure and can't be accepted.")
    total = sum(i.file_size for i in infos)
    if total > MAX_DOCX_UNCOMPRESSED or total / max(len(data), 1) > MAX_ZIP_RATIO:
        raise UploadRejected("This document expands to an unsafe size and can't be accepted.")  # zip bomb

    names = [i.filename.lower() for i in infos]
    if "[content_types].xml" not in names or "word/document.xml" not in names:
        raise UploadRejected("This doesn't look like a valid Word document.")

    for n in names:
        if n.startswith("/") or ".." in n.split("/"):
            raise UploadRejected("This document has an unsafe structure.")  # zip-slip
        if (
            "vbaproject" in n
            or n.startswith(("word/embeddings/", "word/activex/"))
            or n.endswith(_DANGEROUS_EXT)
        ):
            raise UploadRejected("Documents with macros or embedded objects can't be accepted. Save a clean copy and try again.")

    if b"macroenabled" in zf.read("[Content_Types].xml").lower():
        raise UploadRejected("Macro-enabled documents can't be accepted. Save as a regular .docx.")

    for info in infos:
        if info.filename.lower().endswith(".rels"):
            rels = zf.read(info).decode("utf-8", "ignore").lower()
            # attachedTemplate = remote template injection; oleObject/frame = embedded or linked objects
            if any(t in rels for t in ("relationships/attachedtemplate", "relationships/oleobject", "relationships/frame")):
                raise UploadRejected("This document links to external templates or objects and can't be accepted.")


# ----------------------------------------------------------------------------
# 2) Antivirus
# ----------------------------------------------------------------------------
def clamav_scan(data: bytes) -> None:
    """Scans with a local clamd. FAIL-CLOSED unless REQUIRE_ANTIVIRUS=0 (dev only)."""
    required = os.getenv("REQUIRE_ANTIVIRUS", "1") == "1"
    try:
        import clamd

        cd = clamd.ClamdUnixSocket(path=os.getenv("CLAMD_SOCKET", "/var/run/clamav/clamd.ctl"))
        status, _sig = cd.instream(io.BytesIO(data))["stream"]
    except Exception as exc:
        if required:
            raise UploadRejected("Our security scan is temporarily unavailable. Please try again shortly.") from exc
        return
    if status == "FOUND":
        raise UploadRejected("This file was flagged by our virus scanner and can't be accepted.")


# ----------------------------------------------------------------------------
# 4) Text sanitization
# ----------------------------------------------------------------------------
_TAG_CHARS = re.compile("[\U000e0000-\U000e007f]")            # "ASCII smuggling" invisible tag block
_BIDI = re.compile("[\u202a-\u202e\u2066-\u2069]")             # direction overrides
_ZERO_WIDTH = re.compile("[\u200b-\u200f\u2060-\u2064\ufeff\u00ad]")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def suspicious_unicode(text: str) -> list[str]:
    flags = []
    if _TAG_CHARS.search(text):
        flags.append("unicode_tag_smuggling")
    if _BIDI.search(text):
        flags.append("bidi_override_characters")
    if len(re.findall("[\u200b-\u200d\u2060\ufeff]", text)) > 10:
        flags.append("many_zero_width_characters")
    return flags


def sanitize_text(text: str, max_chars: int = MAX_TEXT_CHARS) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    for rx in (_TAG_CHARS, _BIDI, _ZERO_WIDTH, _CONTROL):
        text = rx.sub("", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:max_chars]


# ----------------------------------------------------------------------------
# 5) Prompt-injection signals
# ----------------------------------------------------------------------------
_INJECTION = {
    "ignore_previous": r"(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+|your\s+)*(previous|prior|above|earlier|system)\s+(instructions?|prompts?|rules?|messages?)",
    "new_instructions": r"\bnew\s+(instructions?|rules?|task)\s*:",
    "fake_role_tags": r"</?\s*(system|assistant|user|instructions?)\s*>|\[/?INST\]|<\|im_(start|end)\|>|###\s*(system|instruction)",
    "score_manipulation": r"\b(rate|score|rank|grade|mark|evaluate)\s+(this|me|the|my)\s+(resume|candidate|application)?\s*(as\s+|a\s+|with\s+)?(10\s*/\s*10|10|perfect|highest|5\s+stars|excellent|strong)",
    "reveal_prompt": r"(reveal|show|print|repeat|output)\s+(your\s+|the\s+)?(system\s+)?(prompt|instructions)",
    "hide_from_reviewer": r"do\s+not\s+(mention|reveal|flag|tell)",
    "address_the_ai": r"\b(as an ai|dear (ai|assistant|language model)|note to (the )?(ai|llm|model|reviewer))\b",
    "recommend_candidate": r"(recommend|hire|shortlist|select)\s+this\s+candidate",
}
_INJECTION_RX = {k: re.compile(v, re.I) for k, v in _INJECTION.items()}


def scan_for_injection(text: str) -> list[str]:
    return [f"injection_phrase:{name}" for name, rx in _INJECTION_RX.items() if rx.search(text)]


# ----------------------------------------------------------------------------
# 6) PII redaction (before anything is sent to the model)
# ----------------------------------------------------------------------------
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_URL = re.compile(r"(?:https?://|www\.)\S+|\b(?:linkedin\.com|github\.com)/\S+", re.I)
_SSN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_PHONE = re.compile(r"(?<!\d)(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)")
_NAME_LINE = re.compile(r"^[A-Za-zÀ-ÿ'’.\-]+(?:\s+[A-Za-zÀ-ÿ'’.\-]+){0,3}$")


def redact_pii(text: str) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    for label, rx in (("EMAIL", _EMAIL), ("URL", _URL), ("SSN", _SSN), ("PHONE", _PHONE)):
        text, n = rx.subn(f"[{label}]", text)
        if n:
            counts[label] = n

    # Heuristic: a short, digit-free first line is almost always the student's name.
    headings = {"education", "experience", "skills", "projects", "summary", "resume", "objective", "profile"}
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        first = ln.strip()
        if first:
            if len(first) <= 40 and _NAME_LINE.match(first) and first.lower() not in headings:
                lines[i] = "[NAME]"
                counts["NAME"] = 1
            break
    return "\n".join(lines), counts


# ----------------------------------------------------------------------------
# 7) Treat model output as untrusted too
# ----------------------------------------------------------------------------
_URL_OR_HTML = re.compile(r"https?://\S+|www\.\S+|<[^>]{0,200}>")


def clean_model_string(s: str) -> str:
    """Strip URLs/HTML/invisible chars from model output. The frontend must STILL escape on render."""
    s = _URL_OR_HTML.sub("", s or "")
    for rx in (_TAG_CHARS, _BIDI, _ZERO_WIDTH, _CONTROL):
        s = rx.sub("", s)
    return s.strip()


def _norm(s: str) -> str:
    return re.sub(r"\W+", " ", unicodedata.normalize("NFKC", s or "").lower()).strip()


def normalized(s: str) -> str:
    return _norm(s)


def evidence_in_source(quote: str, source_norm: str) -> bool:
    """True if the quoted evidence really appears in the resume (tolerates minor model drift)."""
    q = _norm(quote)
    if len(q) < 8:
        return False
    if q in source_norm:
        return True
    m = difflib.SequenceMatcher(None, source_norm, q, autojunk=False).find_longest_match(
        0, len(source_norm), 0, len(q)
    )
    return m.size >= 0.85 * len(q)


def has_unverified_numbers(rewrite: str, source: str) -> bool:
    """True if a rewrite contains numbers (e.g. '40%') that never appear in the resume."""
    nums = {n.rstrip(".,") for n in re.findall(r"\d[\d,.]*%?", rewrite or "")}
    if not nums:
        return False
    src = {n.rstrip(".,") for n in re.findall(r"\d[\d,.]*%?", source or "")}
    return bool(nums - src)
