from __future__ import annotations
from typing import Annotated, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = "1.0"

ShortText = Annotated[str, Field(max_length=120)]
Text = Annotated[str, Field(max_length=400)]


class Strict(BaseModel):
    # extra="forbid" -> additionalProperties:false in the JSON schema, which keeps small models on rails
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


Section = Literal[
    "summary", "education", "experience", "projects", "skills",
    "leadership", "certifications", "formatting", "overall",
]
Priority = Literal["high", "medium", "low"]


# ----------------------------------------------------------------------------
# 1) What the LLM must output
# ----------------------------------------------------------------------------
class JDRequirement(Strict):
    term: ShortText  # short term as written in the JD, e.g. "Python", "SQL", "data analysis"
    category: Literal["hard_skill", "tool", "soft_skill", "qualification", "experience", "domain"]
    importance: Literal["required", "preferred"]


class EducationEntry(Strict):
    institution: ShortText
    degree: ShortText
    field_of_study: ShortText
    graduation_date: ShortText  # as written, "" if absent


class ExperienceEntry(Strict):
    title: ShortText
    organization: ShortText
    start_date: ShortText
    end_date: ShortText
    bullet_count: int = Field(ge=0, le=30)
    has_quantified_results: bool


class AtsParsedView(Strict):
    """What an applicant tracking system would plausibly extract: only what is explicitly written."""
    education: list[EducationEntry] = Field(max_length=5)
    experience: list[ExperienceEntry] = Field(max_length=10)
    projects: list[ShortText] = Field(max_length=8)
    skills: list[ShortText] = Field(max_length=40)
    certifications: list[ShortText] = Field(max_length=10)


class Suggestion(Strict):
    section: Section
    priority: Priority
    issue: Text
    evidence: Annotated[str, Field(max_length=250)]  # exact quote from resume, "" if content is missing
    recommendation: Text
    rewrite_example: Annotated[str, Field(max_length=400)]  # uses [X%]-style placeholders, "" if n/a
    addresses_requirement: ShortText  # JD term this helps with, "" if none


class LLMReview(Strict):
    summary: Annotated[str, Field(max_length=600)]
    overall_fit: Literal["strong", "moderate", "weak"]
    fit_rationale: Text
    ats_parsed: AtsParsedView
    jd_requirements: list[JDRequirement] = Field(max_length=25)
    strengths: list[Text] = Field(max_length=5)
    suggestions: list[Suggestion] = Field(max_length=8)
    suspected_prompt_injection: bool


# ----------------------------------------------------------------------------
# 2) What the website receives
# ----------------------------------------------------------------------------
class VerifiedSuggestion(Suggestion):
    evidence_verified: bool  # False -> model quoted text NOT found in the resume; the quote was removed
    rewrite_has_unverified_numbers: bool  # True -> UI should tell the student to use their real numbers


class AtsCheck(Strict):
    id: str
    label: str
    status: Literal["pass", "warn", "fail"]
    detail: str


class KeywordMatch(Strict):
    term: str
    category: str
    importance: str
    found: bool


class KeywordReport(Strict):
    coverage_required: Optional[float]   # 0..1, None if the JD listed none
    coverage_preferred: Optional[float]
    coverage_overall: Optional[float]
    matched: list[KeywordMatch]
    missing: list[KeywordMatch]


class AtsView(Strict):
    checks: list[AtsCheck]
    parsed: AtsParsedView
    keywords: KeywordReport


class Feedback(Strict):
    summary: str
    overall_fit: Literal["strong", "moderate", "weak"]
    fit_rationale: str
    strengths: list[str]
    suggestions: list[VerifiedSuggestion]


class SecurityReport(Strict):
    flags: list[str]
    sponsor_submission_allowed: bool  # False -> needs human review before sponsors can see it
    pii_redacted_before_ai: dict[str, int]


class ReportMeta(Strict):
    schema_version: str
    prompt_version: str
    model: str
    generated_at: str
    resume_sha256: str
    pages: int
    input_truncated: bool


class FinalReport(Strict):
    meta: ReportMeta
    security: SecurityReport
    ats_view: AtsView
    feedback: Feedback
