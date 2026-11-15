"""Private member resume reviews and sponsor-portal submissions.

The asynchronous worker owns parsing/LLM work.  This blueprint only validates
the upload, enforces ownership/consent, and serves completed private files.
"""
from __future__ import annotations

import io
import os
import re
from typing import Optional
from urllib.parse import urlparse

from psycopg2.extras import Json

from flask import Blueprint, jsonify, request, send_file
from app import limiter
from ats.security import UploadRejected, clamav_scan, validate_upload
from app.raw_db import get_db
from app.utils.auth_decorators import caller_id, caller_role, require_authenticated, require_officer

resume_review_bp = Blueprint("resume_review", __name__)
CONSENT_VERSION = "2026-11-01"


def _resume_download_name(first_name, last_name, ext: str) -> str:
    """Use the applicant name without allowing it to control a filesystem path."""
    display_name = " ".join(part for part in (first_name, last_name) if part).strip()
    stem = re.sub(r"[^A-Za-z0-9]+", "-", display_name).strip("-") or "cougarai-resume"
    return f"{stem}-resume-review.{ext}"


def _active_membership(cur, user_id: int) -> bool:
    cur.execute(
        """
        SELECT 1 FROM payments
        WHERE (student_id = (SELECT student_id FROM profile WHERE user_id = %s)
               OR email = (SELECT email FROM users WHERE user_id = %s))
          AND expires_at >= CURRENT_DATE
        LIMIT 1
        """,
        (user_id, user_id),
    )
    return cur.fetchone() is not None


def _submission_profile(data: dict) -> tuple[dict | None, str | None]:
    """Validate candidate-controlled fields before they reach a sponsor."""
    profile = data.get("recruiter_profile") or {}
    if not isinstance(profile, dict):
        return None, "recruiter_profile must be an object."

    def text(key: str, limit: int) -> str | None:
        value = profile.get(key)
        return str(value).strip()[:limit] or None if value is not None else None

    def url(key: str, label: str) -> tuple[str | None, str | None]:
        value = text(key, 500)
        if not value:
            return None, None
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return None, f"{label} must be a valid web address starting with http:// or https://."
        return value, None

    raw_skills = profile.get("top_skills") or []
    if not isinstance(raw_skills, list) or len(raw_skills) > 10:
        return None, "Choose up to 10 top skills."
    skills = []
    for item in raw_skills:
        skill = str(item).strip()
        if skill and len(skill) <= 60 and skill not in skills:
            skills.append(skill)
    portfolio_url, err = url("portfolio_url", "Portfolio link")
    if err:
        return None, err
    github_url, err = url("github_url", "GitHub link")
    if err:
        return None, err
    linkedin_url, err = url("linkedin_url", "LinkedIn link")
    if err:
        return None, err
    return {
        "candidate_major": text("major", 120), "graduation_date": text("graduation_date", 60),
        "top_skills": skills, "portfolio_url": portfolio_url, "github_url": github_url,
        "linkedin_url": linkedin_url,
        "seeking_roles": text("seeking_roles", 300), "availability": text("availability", 160),
        "contact_preference": text("contact_preference", 160),
    }, None


def _review_summary(row: dict, include_report: bool = False) -> dict:
    result = {
        "review_id": row["review_id"], "status": row["status"], "filename_ext": row["filename_ext"],
        "needs_review": row["needs_review"], "reviewed_by": row["reviewed_by"],
        "error_message": row["error_message"], "created_at": row["created_at"], "finished_at": row["finished_at"],
        "rejection_reason": row.get("rejection_reason"), "rejected_at": row.get("rejected_at"),
    }
    if row.get("display_filename"):
        result["display_filename"] = row["display_filename"]
    if include_report and row["status"] == "done":
        result["report"] = row["report"]
    if row.get("email"):
        name = " ".join(part for part in (row.get("first_name"), row.get("last_name")) if part).strip()
        result["applicant"] = {"name": name or row["email"], "email": row["email"]}
    return result


@resume_review_bp.route("/", methods=["POST", "OPTIONS"])
@require_authenticated
@limiter.limit("3/hour;10/day")
def create_review():
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "A PDF or DOCX resume is required."}), 400
    data = file.read()
    try:
        ext = validate_upload(file.filename, data)
        clamav_scan(data)
    except UploadRejected as exc:
        return jsonify({"error": str(exc)}), 400
    jd = (request.form.get("job_description") or "").strip()
    if len(jd) > 6000:
        return jsonify({"error": "Job description must be 6,000 characters or fewer."}), 400

    uid = caller_id()
    display_filename = os.path.basename(file.filename.replace("\\", "/")).strip()
    display_filename = "".join(ch for ch in display_filename if ch.isprintable())[:255]
    conn = get_db()
    with conn.cursor() as cur:
        if not _active_membership(cur, uid):
            return jsonify({"error": "An active paid membership is required to use resume review."}), 403
        cur.execute("SELECT 1 FROM resume_reviews WHERE user_id = %s AND status IN ('queued', 'processing')", (uid,))
        if cur.fetchone():
            return jsonify({"error": "You already have a resume review in progress."}), 409
        cur.execute(
            "INSERT INTO resume_reviews (user_id, filename_ext, display_filename, upload, job_description) VALUES (%s, %s, %s, %s, %s) RETURNING review_id",
            (uid, ext, display_filename, data, jd),
        )
        review_id = cur.fetchone()["review_id"]
        conn.commit()
    return jsonify({"review_id": review_id, "status": "queued"}), 202


@resume_review_bp.route("/", methods=["GET", "OPTIONS"])
@require_authenticated
def list_reviews():
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM resume_reviews WHERE user_id = %s ORDER BY created_at DESC", (caller_id(),))
        rows = cur.fetchall()
    return jsonify({"reviews": [_review_summary(r) for r in rows]})


@resume_review_bp.route("/<int:review_id>", methods=["DELETE", "OPTIONS"])
@require_authenticated
def cancel_queued_review(review_id: int):
    """Let a member remove an unshared resume review from their private portal."""
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            """DELETE FROM resume_reviews rr
               WHERE rr.review_id = %s AND rr.user_id = %s
                 AND rr.status IN ('queued', 'done', 'failed', 'rejected')
                 AND NOT EXISTS (SELECT 1 FROM resume_submissions rs WHERE rs.review_id = rr.review_id)
               RETURNING rr.review_id""",
            (review_id, caller_id()),
        )
        row = cur.fetchone()
        conn.commit()
    if not row:
        return jsonify({"error": "This review cannot be cancelled after processing starts or after it has been submitted to a sponsor."}), 409
    return jsonify({"ok": True})


@resume_review_bp.route("/<int:review_id>", methods=["GET", "OPTIONS"])
@require_authenticated
def get_review(review_id: int):
    conn = get_db()
    with conn.cursor() as cur:
        if caller_role() in {"admin", "officer"}:
            cur.execute("""SELECT rr.*, u.email, pr.first_name, pr.last_name FROM resume_reviews rr
                           JOIN users u ON u.user_id = rr.user_id LEFT JOIN profile pr ON pr.user_id = rr.user_id
                           WHERE rr.review_id = %s""", (review_id,))
        else:
            cur.execute("""SELECT rr.*, u.email, pr.first_name, pr.last_name FROM resume_reviews rr
                           JOIN users u ON u.user_id = rr.user_id LEFT JOIN profile pr ON pr.user_id = rr.user_id
                           WHERE rr.review_id = %s AND rr.user_id = %s""", (review_id, caller_id()))
        row = cur.fetchone()
    if not row:
        return jsonify({"error": "Review not found."}), 404
    return jsonify(_review_summary(row, include_report=True))


@resume_review_bp.route("/flagged", methods=["GET", "OPTIONS"])
@require_officer
def flagged_reviews():
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("""SELECT rr.*, u.email, pr.first_name, pr.last_name FROM resume_reviews rr
                       JOIN users u ON u.user_id = rr.user_id LEFT JOIN profile pr ON pr.user_id = rr.user_id
                       WHERE rr.status = 'done' AND rr.needs_review = TRUE AND rr.reviewed_by IS NULL ORDER BY rr.created_at""")
        rows = cur.fetchall()
    # Never include raw security flags or upload bytes in a general staff list.
    return jsonify({"reviews": [_review_summary(r) for r in rows]})


@resume_review_bp.route("/<int:review_id>/clear", methods=["POST", "OPTIONS"])
@require_officer
def clear_review(review_id: int):
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE resume_reviews SET reviewed_by = %s WHERE review_id = %s AND status = 'done' AND needs_review = TRUE AND reviewed_by IS NULL RETURNING review_id",
            (caller_id(), review_id),
        )
        row = cur.fetchone()
        conn.commit()
    if not row:
        return jsonify({"error": "Flagged completed review not found."}), 404
    return jsonify({"ok": True})


@resume_review_bp.route("/<int:review_id>/reject", methods=["POST", "OPTIONS"])
@require_officer
def reject_review(review_id: int):
    """Reject a flagged resume and give the member actionable next steps."""
    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason") or "").strip()
    if not reason:
        return jsonify({"error": "Please include a reason for rejecting this resume."}), 400
    if len(reason) > 1200:
        return jsonify({"error": "The rejection reason must be 1,200 characters or fewer."}), 400

    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE resume_reviews
               SET status = 'rejected', reviewed_by = %s, rejection_reason = %s, rejected_at = NOW()
               WHERE review_id = %s AND status = 'done' AND needs_review = TRUE AND reviewed_by IS NULL
               RETURNING review_id""",
            (caller_id(), reason, review_id),
        )
        row = cur.fetchone()
        conn.commit()
    if not row:
        return jsonify({"error": "Flagged completed review not found."}), 404
    return jsonify({"ok": True})


@resume_review_bp.route("/<int:review_id>/resume", methods=["GET", "OPTIONS"])
@require_officer
def download_review_resume(review_id: int):
    """Officer-only private download for manual security review."""
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            """SELECT rr.filename_ext, rr.resume_blob, pr.first_name, pr.last_name
               FROM resume_reviews rr LEFT JOIN profile pr ON pr.user_id = rr.user_id
               WHERE rr.review_id = %s AND rr.status = 'done'""",
            (review_id,),
        )
        row = cur.fetchone()
    if not row or not row["resume_blob"]:
        return jsonify({"error": "Completed resume not found."}), 404
    ext = row["filename_ext"]
    mime = "application/pdf" if ext == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return send_file(io.BytesIO(bytes(row["resume_blob"])), mimetype=mime, as_attachment=True,
                     download_name=_resume_download_name(row["first_name"], row["last_name"], ext))


@resume_review_bp.route("/<int:review_id>/submissions", methods=["POST", "OPTIONS"])
@require_authenticated
def submit_to_sponsor(review_id: int):
    data = request.get_json(silent=True) or {}
    sponsor_id = data.get("sponsor_id")
    if not isinstance(sponsor_id, int):
        return jsonify({"error": "sponsor_id is required."}), 400
    if data.get("consent") is not True:
        return jsonify({"error": "Explicit consent is required before sharing your resume."}), 400
    profile, profile_error = _submission_profile(data)
    if profile_error:
        return jsonify({"error": profile_error}), 400

    uid = caller_id()
    conn = get_db()
    with conn.cursor() as cur:
        if not _active_membership(cur, uid):
            return jsonify({"error": "An active paid membership is required to submit to a sponsor."}), 403
        cur.execute("SELECT * FROM resume_reviews WHERE review_id = %s AND user_id = %s", (review_id, uid))
        review = cur.fetchone()
        if not review:
            return jsonify({"error": "Review not found."}), 404
        if review["status"] != "done" or not review["resume_blob"]:
            return jsonify({"error": "Only completed reviews with an available resume can be submitted."}), 409
        if review["needs_review"] and not review["reviewed_by"]:
            return jsonify({"error": "An officer must review this resume before it can be shared."}), 409
        cur.execute("SELECT sponsor_id FROM sponsors WHERE sponsor_id = %s AND is_active = TRUE AND portal_partner_id IS NOT NULL", (sponsor_id,))
        if not cur.fetchone():
            return jsonify({"error": "That sponsor is not accepting portal submissions."}), 404
        cur.execute(
            """INSERT INTO resume_submissions
               (review_id, user_id, sponsor_id, consent_version, candidate_major, graduation_date, top_skills,
                portfolio_url, github_url, linkedin_url, seeking_roles, availability, contact_preference)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (review_id, sponsor_id) DO UPDATE SET withdrawn_at = NULL, submitted_at = NOW(),
                 consent_version = EXCLUDED.consent_version, candidate_major = EXCLUDED.candidate_major,
                 graduation_date = EXCLUDED.graduation_date, top_skills = EXCLUDED.top_skills,
                 portfolio_url = EXCLUDED.portfolio_url, github_url = EXCLUDED.github_url,
                 linkedin_url = EXCLUDED.linkedin_url,
                 seeking_roles = EXCLUDED.seeking_roles, availability = EXCLUDED.availability,
                 contact_preference = EXCLUDED.contact_preference
               RETURNING submission_id, submitted_at""",
            (review_id, uid, sponsor_id, CONSENT_VERSION, profile["candidate_major"], profile["graduation_date"],
             Json(profile["top_skills"]), profile["portfolio_url"], profile["github_url"], profile["linkedin_url"], profile["seeking_roles"],
             profile["availability"], profile["contact_preference"]),
        )
        row = cur.fetchone()
        conn.commit()
    return jsonify({"submission_id": row["submission_id"], "submitted_at": row["submitted_at"]}), 201


@resume_review_bp.route("/submissions", methods=["GET", "OPTIONS"])
@require_authenticated
def my_submissions():
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            """SELECT rs.submission_id, rs.review_id, rs.submitted_at, rs.withdrawn_at, rs.first_viewed_at,
                      s.sponsor_id, s.name AS sponsor_name
               FROM resume_submissions rs JOIN sponsors s ON s.sponsor_id = rs.sponsor_id
               WHERE rs.user_id = %s ORDER BY rs.submitted_at DESC""",
            (caller_id(),),
        )
        rows = cur.fetchall()
    return jsonify({"submissions": [dict(r) for r in rows]})


@resume_review_bp.route("/submissions/<int:submission_id>", methods=["DELETE", "OPTIONS"])
@require_authenticated
def withdraw_submission(submission_id: int):
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("UPDATE resume_submissions SET withdrawn_at = NOW() WHERE submission_id = %s AND user_id = %s AND withdrawn_at IS NULL RETURNING submission_id", (submission_id, caller_id()))
        row = cur.fetchone()
        conn.commit()
    if not row:
        return jsonify({"error": "Active submission not found."}), 404
    return jsonify({"ok": True})


def _partner_submission(cur, partner_id: int, submission_id: Optional[int] = None):
    sql = """SELECT rs.*, rr.filename_ext, rr.resume_blob, u.email, pr.first_name, pr.last_name
             FROM resume_submissions rs
             JOIN sponsors s ON s.sponsor_id = rs.sponsor_id AND s.portal_partner_id = %s AND s.is_active = TRUE
             JOIN resume_reviews rr ON rr.review_id = rs.review_id
             JOIN users u ON u.user_id = rs.user_id
             LEFT JOIN profile pr ON pr.user_id = rs.user_id
             WHERE rs.withdrawn_at IS NULL"""
    params = [partner_id]
    if submission_id is not None:
        sql += " AND rs.submission_id = %s"
        params.append(submission_id)
    cur.execute(sql + " ORDER BY rs.submitted_at DESC", params)
    return cur.fetchall()


@resume_review_bp.route("/partner/<int:partner_id>/submissions", methods=["GET", "OPTIONS"])
@require_authenticated
def sponsor_submissions(partner_id: int):
    uid = caller_id()
    conn = get_db()
    with conn.cursor() as cur:
        if caller_role() != "admin":
            cur.execute("SELECT 1 FROM partner_members WHERE partner_id = %s AND user_id = %s", (partner_id, uid))
            if not cur.fetchone():
                return jsonify({"error": "Access denied."}), 403
        rows = _partner_submission(cur, partner_id)
        ids = [r["submission_id"] for r in rows]
        if ids:
            cur.execute("UPDATE resume_submissions SET first_viewed_at = COALESCE(first_viewed_at, NOW()), last_viewed_at = NOW(), last_viewed_by = %s WHERE submission_id = ANY(%s)", (uid, ids))
            conn.commit()
    keys = ("submission_id", "review_id", "submitted_at", "first_viewed_at", "email", "first_name", "last_name",
            "candidate_major", "graduation_date", "top_skills", "portfolio_url", "github_url", "linkedin_url", "seeking_roles", "availability", "contact_preference")
    return jsonify({"submissions": [{k: r[k] for k in keys} for r in rows]})


@resume_review_bp.route("/partner/<int:partner_id>/submissions/<int:submission_id>/resume", methods=["GET", "OPTIONS"])
@require_authenticated
def download_submitted_resume(partner_id: int, submission_id: int):
    uid = caller_id()
    conn = get_db()
    with conn.cursor() as cur:
        if caller_role() != "admin":
            cur.execute("SELECT 1 FROM partner_members WHERE partner_id = %s AND user_id = %s", (partner_id, uid))
            if not cur.fetchone():
                return jsonify({"error": "Access denied."}), 403
        rows = _partner_submission(cur, partner_id, submission_id)
        row = rows[0] if rows else None
        if row and row["resume_blob"]:
            cur.execute("UPDATE resume_submissions SET first_viewed_at = COALESCE(first_viewed_at, NOW()), last_viewed_at = NOW(), last_viewed_by = %s WHERE submission_id = %s", (uid, submission_id))
            conn.commit()
    if not row or not row["resume_blob"]:
        return jsonify({"error": "Submission not found."}), 404
    ext = row["filename_ext"]
    mime = "application/pdf" if ext == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return send_file(io.BytesIO(bytes(row["resume_blob"])), mimetype=mime, as_attachment=True,
                     download_name=_resume_download_name(row["first_name"], row["last_name"], ext))
