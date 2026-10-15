"""
Deterministic ATS-style checks. Plain code, no LLM: fast, free, and identical on every run.

Keyword coverage is computed HERE by searching the resume text for each job-description term the model
extracted. We never trust the model's own claim about what is "matched" or "missing".
"""
from __future__ import annotations

import re

from .schemas import AtsCheck, JDRequirement, KeywordMatch, KeywordReport

# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------
SECTION_PATTERNS = {
    "education": r"(education|academic background)",
    "experience": r"((work|professional|relevant|internship)\s+)?(experience|employment( history)?)",
    "projects": r"((selected|academic|personal|technical)\s+)?projects?",
    "skills": r"((technical|core)\s+)?(skills|competencies)(\s*(&|and)\s*tools)?|technologies",
    "summary": r"(professional\s+)?(summary|objective|profile)",
    "leadership": r"(leadership|activities|extracurricular activities|involvement|volunteer(ing)?( experience)?)",
    "certifications": r"(certifications?|licenses?|awards|honors)",
}


def detect_sections(text: str) -> list[str]:
    found = set()
    for line in text.splitlines():
        s = line.strip().rstrip(":")
        if not s or len(s) > 40:
            continue
        for name, pat in SECTION_PATTERNS.items():
            if re.fullmatch(pat, s, re.I):
                found.add(name)
    return sorted(found)


# ---------------------------------------------------------------------------
# Contact info (run on text BEFORE redaction)
# ---------------------------------------------------------------------------
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE = re.compile(r"(?<!\d)(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)")
_BULLET = re.compile(r"^\s*[•●▪■◦‣·\-–—*]\s*\S")

_DATE_STYLES = {
    "Mon YYYY": r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{4}\b",
    "MM/YYYY": r"\b\d{1,2}/\d{4}\b",
    "YYYY-YYYY": r"(?<![\d/])(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present|current)\b",
}


def run_checks(text: str, ex: dict) -> list[AtsCheck]:
    checks: list[AtsCheck] = []

    def add(id_, label, status, detail):
        checks.append(AtsCheck(id=id_, label=label, status=status, detail=detail))

    chars = len(text)
    words = len(text.split())
    low = text.lower()

    # --- Parseability
    if chars < 200:
        add("text_extractable", "Text can be read by an ATS", "fail",
            "Almost no text was found. The file may be a scan or image. Export a text-based PDF or DOCX.")
    else:
        add("text_extractable", "Text can be read by an ATS", "pass", "Text extracted cleanly.")

    if ex.get("hidden_removed", 0) > 0:
        add("hidden_text", "No hidden text", "fail",
            f"{ex['hidden_removed']} characters of white, tiny, or off-page text were found and ignored. "
            "ATS systems and recruiters penalize hidden text. Remove it.")
    else:
        add("hidden_text", "No hidden text", "pass", "No hidden text found.")

    # --- Contact info
    add("contact_email", "Email address present", "pass" if _EMAIL.search(text) else "fail",
        "Found." if _EMAIL.search(text) else "No email address detected in the main body of the resume.")
    add("contact_phone", "Phone number present", "pass" if _PHONE.search(text) else "warn",
        "Found." if _PHONE.search(text) else "No phone number detected.")
    has_li = "linkedin.com" in low
    add("contact_linkedin", "LinkedIn profile listed", "pass" if has_li else "warn",
        "Found." if has_li else "Adding a LinkedIn URL helps recruiters verify your profile.")
    if ex.get("header_footer_chars", 0) > 0:
        add("header_footer", "Key info not hidden in header/footer", "warn",
            "Some content is in the document header/footer. Many ATS skip those areas, so keep contact info in the body.")

    # --- Sections
    sections = detect_sections(text)
    missing = [s for s in ("education", "skills") if s not in sections]
    if "experience" not in sections and "projects" not in sections:
        missing.append("experience or projects")
    if missing:
        add("sections", "Standard section headings", "warn" if len(missing) < 3 else "fail",
            "Could not find standard headings for: " + ", ".join(missing) +
            ". Use conventional titles like 'Education', 'Experience', 'Projects', 'Skills'.")
    else:
        add("sections", "Standard section headings", "pass", "Found: " + ", ".join(sections) + ".")

    # --- Length
    pages = ex.get("pages", 1)
    if pages <= 1:
        add("length", "Length", "pass", "One page, which is ideal for students.")
    elif pages == 2:
        add("length", "Length", "warn", "Two pages. Most student resumes land better at one page.")
    else:
        add("length", "Length", "fail", f"{pages} pages is too long for an early-career resume.")
    if words < 150:
        add("word_count", "Enough content", "warn", f"Only {words} words. Add detail on projects and experience.")
    elif words > 800:
        add("word_count", "Concise content", "warn", f"{words} words. Trim to your strongest, most relevant points.")

    # --- Layout hazards
    layout = []
    if ex.get("multi_column"):
        layout.append("multiple columns")
    if ex.get("has_tables"):
        layout.append("tables")
    if ex.get("has_textboxes"):
        layout.append("text boxes")
    if ex.get("images", 0) > 0:
        layout.append("images or icons")
    if layout:
        add("layout", "ATS-friendly layout", "warn",
            "Detected " + ", ".join(layout) + ". These can scramble or hide text in an ATS. A single-column layout is safest.")
    else:
        add("layout", "ATS-friendly layout", "pass", "Simple single-column layout.")

    # --- Bullets and impact
    bullets = [ln for ln in text.splitlines() if _BULLET.match(ln)]
    if len(bullets) < 4:
        add("bullets", "Bullet-point achievements", "warn",
            "Few bullet points detected. Use short bullets that start with action verbs.")
    else:
        add("bullets", "Bullet-point achievements", "pass", f"{len(bullets)} bullet points found.")
        quantified = sum(1 for b in bullets if re.search(r"\d", b))
        ratio = quantified / len(bullets)
        add("quantified", "Quantified results", "pass" if ratio >= 0.25 else "warn",
            f"{quantified} of {len(bullets)} bullets include a number."
            + ("" if ratio >= 0.25 else " Aim for numbers (users, %, time saved, team size) in at least a third."))

    # --- Date consistency
    used = [name for name, pat in _DATE_STYLES.items() if re.search(pat, text, re.I)]
    if len(used) > 1:
        add("dates", "Consistent date format", "warn", "Mixed date styles (" + ", ".join(used) + "). Pick one, e.g. 'Aug 2024 - May 2025'.")
    elif used:
        add("dates", "Consistent date format", "pass", f"Dates use one style ({used[0]}).")
    return checks


# ---------------------------------------------------------------------------
# Keyword coverage
# ---------------------------------------------------------------------------
_ALIAS_PAIRS = [
    ("js", "javascript"), ("ts", "typescript"), ("ml", "machine learning"), ("ai", "artificial intelligence"),
    ("k8s", "kubernetes"), ("postgres", "postgresql"), ("nlp", "natural language processing"),
    ("node", "node.js"), ("nodejs", "node.js"), ("reactjs", "react"), ("ci/cd", "ci cd"),
    ("gcp", "google cloud"), ("aws", "amazon web services"), ("ux", "user experience"),
    ("oop", "object oriented programming"), ("dsa", "data structures and algorithms"),
]
_ALIASES: dict[str, set[str]] = {}
for _a, _b in _ALIAS_PAIRS:
    _ALIASES.setdefault(_a, set()).add(_b)
    _ALIASES.setdefault(_b, set()).add(_a)


def norm_kw(s: str) -> str:
    s = re.sub(r"[^a-z0-9+#.\s]", " ", (s or "").lower())
    s = re.sub(r"(?<!\w)\.|\.(?!\w)", " ", s)  # keep dots inside tokens (node.js), drop sentence dots
    return re.sub(r"\s+", " ", s).strip()


def term_in_text(term: str, text_norm: str) -> bool:
    t = norm_kw(term)
    if not t:
        return False
    variants = {t} | {norm_kw(a) for a in _ALIASES.get(t, set())}
    if t.endswith("s") and len(t) > 3:
        variants.add(t[:-1])  # "REST APIs" should match "REST API endpoints"
    for variant in variants:
        pat = r"(?<![a-z0-9+#])" + re.escape(variant) + r"(?:s|es|ing|ed)?(?![a-z0-9+#])"
        if re.search(pat, text_norm):
            return True
    return False


_JD_FILLER = re.compile(
    r"^(?:(?:strong|solid|good|excellent|basic|demonstrated|hands[- ]on|working|proven)\s+)*"
    r"(?:proficiency|experience|familiarity|knowledge|exposure|understanding|expertise|fluency|comfort)"
    r"(?:\s+(?:in|with|of|to|using))?\s+",
    re.I,
)
# "building or consuming REST APIs" -> "REST APIs", but keep "working on a team" (gerund + preposition)
_LEADING_GERUNDS = re.compile(r"^(?:[a-z]+ing\s+(?:or|and)\s+)?[a-z]+ing\s+(?!(?:on|in|with|at|for|as|to)\b)", re.I)
_MAX_KEYWORD_WORDS = 4
_MAX_REQUIREMENT_WORDS = 10  # longer bullets (e.g. degree + graduation window) can't be keyword-matched


def split_jd_term(term: str, category: str = "") -> list[list[str]]:
    """
    Turn a JD requirement into keywords that can be searched for in a resume.

    Small models often return whole JD bullets ("Working knowledge of SQL and relational databases"),
    which never appear verbatim in a resume. Returns a list of keyword groups; a resume matches a group if
    it contains ANY term in it ("Flask, FastAPI, or Django" is one group of alternatives, while
    "SQL and relational databases" is two separate groups). Phrases too long to match reliably are dropped.
    """
    t = re.sub(r"\([^)]*\)?", " ", term or "")  # "(EC2, S3, or Lambda)", also an unclosed "(..."
    t = re.sub(r"\s+", " ", t).strip(" ,.;:")
    if category == "soft_skill":
        return [[t]] if t else []  # rarely written literally; keep the model's wording, don't split
    if len(t.split()) > _MAX_REQUIREMENT_WORDS:
        return []
    t = _LEADING_GERUNDS.sub("", _JD_FILLER.sub("", t)) or t
    if len(t.split()) < _MAX_KEYWORD_WORDS:
        groups = [[t]]
    elif re.search(r"\bor\b", t):
        groups = [[p for p in re.split(r",|\bor\b", t)]]
    else:
        groups = [[p] for p in re.split(r",|\band\b|&", t)]
    out = []
    for g in groups:
        kept = [p.strip(" ,.;:") for p in g if p.strip(" ,.;:")]
        kept = [p for p in kept if len(p.split()) <= _MAX_KEYWORD_WORDS and p.lower() not in {"similar", "a related field"}]
        if kept:
            out.append(kept)
    return out


def keyword_report(requirements: list[JDRequirement], resume_text: str) -> KeywordReport:
    text_norm = norm_kw(resume_text)
    seen, matched, missing = set(), [], []
    for req in requirements:
        for group in split_jd_term(req.term, req.category):
            key = "|".join(sorted(norm_kw(g) for g in group))
            if not key or key in seen:
                continue
            seen.add(key)
            found = any(term_in_text(g, text_norm) for g in group)
            item = KeywordMatch(term=" / ".join(group), category=req.category, importance=req.importance, found=found)
            (matched if found else missing).append(item)

    def cov(importance: str | None):
        pool = [m for m in matched + missing if importance is None or m.importance == importance]
        return round(sum(m.found for m in pool) / len(pool), 2) if pool else None

    return KeywordReport(
        coverage_required=cov("required"), coverage_preferred=cov("preferred"), coverage_overall=cov(None),
        matched=matched, missing=missing,
    )