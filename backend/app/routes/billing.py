import stripe
from datetime import date
from typing import Optional
from flask import Blueprint, current_app, request, jsonify
from app.raw_db import get_db
from app import limiter
from app.utils.auth_decorators import require_authenticated, caller_id

members_bp = Blueprint("members", __name__)
billing_bp = Blueprint("billing", __name__)

# Server-side allowlist — never trust price_id from the client
_ALLOWED_PRICE_IDS = {
    "price_1S4sVLH2XIQuLIalBvif5rrs",   # Semester (live)
    "price_1S0ylVH2XIQuLIalbpMXxrV9",   # Yearly   (live)
    "price_1RPA0wQdq5f9y5dILdnU8jkY",   # Semester (test)
    "price_1RPA1MQdq5f9y5dIX6qzElLY",   # Yearly   (test)
}


def _cors_preflight():
    """Return a 200 response for OPTIONS preflight; headers are added by app after_request hook."""
    return "", 200


@members_bp.route("/join", methods=["POST", "OPTIONS"])
@require_authenticated
def join_member():
    user_id = caller_id()
    data = request.get_json(silent=True) or {}
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    student_id = (data.get("student_id") or "").strip() or None
    grade_level = (data.get("grade_level") or "").strip() or None

    if not first_name or not last_name:
        current_app.logger.warning("members/join rejected: missing name user_id=%s", user_id)
        return jsonify({"error": "first_name and last_name are required"}), 400

    try:
        conn = get_db()
        with conn.cursor() as cur:
            current_app.logger.warning(
                "members/join start user_id=%s student_id=%s grade_level=%s",
                user_id,
                student_id,
                grade_level,
            )
            cur.execute("SELECT email FROM users WHERE user_id = %s", (user_id,))
            user_row = cur.fetchone()
            if not user_row:
                current_app.logger.warning("members/join user not found user_id=%s", user_id)
                return jsonify({"error": "User not found"}), 404

            cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (user_id,))
            own_profile = cur.fetchone()

            if not own_profile and not student_id:
                current_app.logger.warning("members/join missing student_id user_id=%s", user_id)
                return jsonify({"error": "student_id is required before purchasing membership"}), 400

            existing_student_profile = None
            if student_id:
                cur.execute("SELECT user_id FROM profile WHERE student_id = %s", (student_id,))
                existing_student_profile = cur.fetchone()
                if existing_student_profile and existing_student_profile["user_id"] not in (None, user_id):
                    current_app.logger.warning(
                        "members/join student_id conflict user_id=%s student_id=%s existing_user_id=%s",
                        user_id,
                        student_id,
                        existing_student_profile["user_id"],
                    )
                    return jsonify({"error": "This student ID is already linked to another account"}), 409

            if own_profile:
                current_app.logger.warning("members/join updating existing profile user_id=%s", user_id)
                cur.execute(
                    """
                    UPDATE profile
                    SET student_id = %s,
                        first_name = %s,
                        last_name = %s,
                        grade_level = %s
                    WHERE user_id = %s
                    """,
                    (student_id, first_name, last_name, grade_level, user_id),
                )
            elif student_id and existing_student_profile:
                current_app.logger.warning("members/join linking existing student profile user_id=%s student_id=%s", user_id, student_id)
                cur.execute(
                    """
                    UPDATE profile
                    SET user_id = %s,
                        first_name = %s,
                        last_name = %s,
                        grade_level = %s
                    WHERE student_id = %s
                    """,
                    (user_id, first_name, last_name, grade_level, student_id),
                )
            else:
                current_app.logger.warning("members/join inserting profile user_id=%s student_id=%s", user_id, student_id)
                cur.execute(
                    """
                    INSERT INTO profile (user_id, student_id, first_name, last_name, grade_level)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (user_id, student_id, first_name, last_name, grade_level),
                )
            conn.commit()
            current_app.logger.warning("members/join success user_id=%s email=%s", user_id, user_row["email"])
            return jsonify({"user_id": user_id, "email": user_row["email"]}), 200
    except Exception as e:
        current_app.logger.exception("members/join profile upsert error user_id=%s", user_id)
        return jsonify({"error": "Failed to save membership profile"}), 500


@billing_bp.route("/create-checkout-session", methods=["POST", "OPTIONS"])
@limiter.limit("10/minute")
@require_authenticated
def create_checkout_session():
    user_id = caller_id()
    data = request.get_json(silent=True) or {}
    price_id = data.get("price_id")
    plan_id = data.get("plan_id")
    success_url = data.get("success_url")
    cancel_url = data.get("cancel_url")

    if price_id not in _ALLOWED_PRICE_IDS:
        current_app.logger.warning("billing/create-checkout-session invalid price user_id=%s price_id=%s", user_id, price_id)
        return jsonify({"error": "Invalid price ID"}), 400

    if not all([success_url, cancel_url]):
        current_app.logger.warning("billing/create-checkout-session missing urls user_id=%s", user_id)
        return jsonify({"error": "success_url and cancel_url are required"}), 400

    stripe.api_key = current_app.config.get("STRIPE_SECRET_KEY")
    if not stripe.api_key:
        current_app.logger.error("billing/create-checkout-session stripe not configured user_id=%s", user_id)
        return jsonify({"error": "Stripe is not configured"}), 500

    # Look up existing Stripe customer ID so returning members skip re-entering payment details
    existing_customer_id = None
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT stripe_customer_id FROM users WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            existing_customer_id = row["stripe_customer_id"] if row else None
    except Exception:
        current_app.logger.exception("billing/create-checkout-session failed looking up customer user_id=%s", user_id)

    try:
        current_app.logger.warning(
            "billing/create-checkout-session start user_id=%s plan_id=%s price_id=%s existing_customer_id=%s",
            user_id,
            plan_id,
            price_id,
            bool(existing_customer_id),
        )
        session_kwargs = dict(
            mode="payment",
            line_items=[{"price": price_id, "quantity": 1}],
            metadata={"user_id": str(user_id), "plan_id": str(plan_id or "")},
            success_url=success_url,
            cancel_url=cancel_url,
        )
        if existing_customer_id:
            session_kwargs["customer"] = existing_customer_id
        session = stripe.checkout.Session.create(**session_kwargs)
        current_app.logger.warning(
            "billing/create-checkout-session success user_id=%s session_id=%s url=%s",
            user_id,
            session.id,
            session.url,
        )
    except stripe.StripeError as e:
        current_app.logger.exception("billing/create-checkout-session stripe error user_id=%s", user_id)
        return jsonify({"error": str(e)}), 502

    return jsonify({"url": session.url}), 200


def _get_membership_expiry(plan_id: str, purchase_date: date) -> date:
    """Return academic-calendar-aligned membership expiry date.

    Semester boundaries:
      Spring: Jan 20 – Aug 19  →  expires Aug 20 (same year)
      Fall:   Aug 20 – Jan 19  →  expires Jan 20 (next year)

    Yearly covers two consecutive semesters (current + next).
    """
    y, m, d = purchase_date.year, purchase_date.month, purchase_date.day
    in_spring = (m == 1 and d >= 20) or (2 <= m <= 7) or (m == 8 and d < 20)

    if in_spring:
        semester_end = date(y, 8, 20)
        next_semester_end = date(y + 1, 1, 20)
    else:
        # Fall semester
        semester_end = date(y + 1, 1, 20) if m >= 8 else date(y, 1, 20)
        next_semester_end = date(y + 1, 8, 20) if m >= 8 else date(y, 8, 20)

    return next_semester_end if plan_id == "yearly" else semester_end


def _stripe_value(obj, key, default=None):
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    try:
        return getattr(obj, key)
    except AttributeError:
        return default


def _finalize_completed_checkout(session: dict, source: str, expected_user_id: Optional[int] = None) -> dict:
    metadata = _stripe_value(session, "metadata", {}) or {}
    user_id_str = str(_stripe_value(metadata, "user_id", "")).strip()
    plan_id = str(_stripe_value(metadata, "plan_id", "")).strip()
    stripe_customer_id = _stripe_value(session, "customer")
    stripe_session_id = _stripe_value(session, "id")
    amount = round((_stripe_value(session, "amount_total", 0) or 0) / 100, 2)
    payment_status = str(_stripe_value(session, "payment_status", "")).strip().lower()
    session_status = str(_stripe_value(session, "status", "")).strip().lower()

    if not stripe_session_id:
        raise ValueError("Stripe session is missing an id")
    if payment_status != "paid":
        raise ValueError(f"Stripe session {stripe_session_id} is not paid (payment_status={payment_status!r})")
    if expected_user_id is not None and user_id_str != str(expected_user_id):
        raise ValueError("Stripe session does not belong to the authenticated user")

    today = date.today()
    expires_at = _get_membership_expiry(plan_id, today) if plan_id else None
    current_app.logger.warning(
        "billing/finalize-checkout source=%s user_id=%s plan_id=%s session_id=%s amount=%s status=%s payment_status=%s expires_at=%s",
        source,
        user_id_str,
        plan_id,
        stripe_session_id,
        amount,
        session_status,
        payment_status,
        expires_at,
    )

    conn = get_db()
    with conn.cursor() as cur:
        # Serialize finalization by Stripe session ID so webhook + success-return
        # cannot both insert the same payment row in parallel.
        cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (stripe_session_id,))

        cur.execute(
            """
            SELECT payment_id, expires_at
            FROM payments
            WHERE stripe_session_id = %s
            LIMIT 1
            """,
            (stripe_session_id,),
        )
        existing_payment = cur.fetchone()
        if existing_payment:
            current_app.logger.warning(
                "billing/finalize-checkout already processed source=%s user_id=%s session_id=%s payment_id=%s",
                source,
                user_id_str,
                stripe_session_id,
                existing_payment["payment_id"],
            )
            conn.commit()
            return {
                "processed": False,
                "already_processed": True,
                "stripe_session_id": stripe_session_id,
                "user_id": int(user_id_str) if user_id_str.isdigit() else None,
                "membership_expires_at": existing_payment["expires_at"].isoformat() if existing_payment.get("expires_at") else None,
            }

        if user_id_str and user_id_str.isdigit() and stripe_customer_id:
            cur.execute(
                "UPDATE users SET stripe_customer_id = %s WHERE user_id = %s",
                (stripe_customer_id, int(user_id_str)),
            )

        if user_id_str and user_id_str.isdigit() and expires_at:
            cur.execute(
                """
                SELECT payment_id FROM payments
                WHERE student_id = (SELECT student_id FROM profile WHERE user_id = %s)
                  AND expires_at >= CURRENT_DATE
                LIMIT 1
                """,
                (int(user_id_str),),
            )
            if cur.fetchone():
                current_app.logger.warning(
                    "Duplicate active membership detected source=%s user_id=%s plan=%s — inserting anyway",
                    source,
                    user_id_str,
                    plan_id,
                )

        student_id_val = None
        email_val = None
        if user_id_str and user_id_str.isdigit():
            cur.execute(
                "SELECT student_id, discord_id FROM profile WHERE user_id = %s",
                (int(user_id_str),),
            )
            profile_row = cur.fetchone()
            discord_id = profile_row.get("discord_id") if profile_row else None
            if profile_row:
                student_id_val = profile_row["student_id"]
            else:
                discord_id = None

            cur.execute(
                "SELECT email, role FROM users WHERE user_id = %s",
                (int(user_id_str),),
            )
            user_row = cur.fetchone()
            email_val = user_row["email"] if user_row else None
            prior_role = user_row["role"] if user_row else None
        else:
            customer_details = _stripe_value(session, "customer_details", {}) or {}
            email_val = _stripe_value(customer_details, "email") or user_id_str or None
            discord_id = None
            prior_role = None

        cur.execute(
            """
            INSERT INTO payments
                (student_id, email, date, amount, stripe_session_id, plan_id, expires_at)
            VALUES (%s, %s, CURRENT_DATE, %s, %s, %s, %s)
            """,
            (student_id_val, email_val, amount, stripe_session_id, plan_id or None, expires_at),
        )

        role_updated = False
        current_role = prior_role
        if user_id_str and user_id_str.isdigit():
            cur.execute(
                "UPDATE users SET role = 'member' WHERE user_id = %s AND role = 'non-member'",
                (int(user_id_str),),
            )
            role_updated = cur.rowcount > 0
            current_app.logger.warning(
                "billing/finalize-checkout role update source=%s user_id=%s rows=%s",
                source,
                user_id_str,
                cur.rowcount,
            )

            cur.execute("SELECT role FROM users WHERE user_id = %s", (int(user_id_str),))
            role_row = cur.fetchone()
            current_role = role_row["role"] if role_row else prior_role

            if discord_id:
                try:
                    from app.services.discord_service import assign_guild_role, get_guild_config
                    cfg = get_guild_config(conn)
                    bot_token = current_app.config.get("DISCORD_BOT_TOKEN", "")
                    if cfg and cfg.get("member_role") and cfg.get("guild_id") and bot_token:
                        assign_guild_role(
                            cfg["guild_id"],
                            discord_id,
                            cfg["member_role"],
                            bot_token,
                        )
                except Exception as _disc_err:
                    current_app.logger.warning("Discord member_role assignment failed: %s", _disc_err)

        conn.commit()
        current_app.logger.warning(
            "billing/finalize-checkout success source=%s user_id=%s session_id=%s role=%s",
            source,
            user_id_str,
            stripe_session_id,
            current_role,
        )
        return {
            "processed": True,
            "already_processed": False,
            "stripe_session_id": stripe_session_id,
            "user_id": int(user_id_str) if user_id_str.isdigit() else None,
            "role_updated": role_updated,
            "role": current_role,
            "membership_expires_at": expires_at.isoformat() if expires_at else None,
        }


@billing_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature", "")
    secret = current_app.config.get("STRIPE_WEBHOOK_SECRET", "")

    if not secret:
        current_app.logger.error("STRIPE_WEBHOOK_SECRET is not configured — rejecting all webhook requests")
        return jsonify({"error": "Webhook not configured"}), 500

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, secret)
        current_app.logger.warning("billing/webhook received event_type=%s", event.get("type"))
    except (stripe.errors.SignatureVerificationError, ValueError) as e:
        current_app.logger.warning("Stripe webhook rejected: %s", e)
        return jsonify({"error": "Invalid signature"}), 400

    if event["type"] == "checkout.session.completed":
        try:
            session = event["data"]["object"]
            _finalize_completed_checkout(session, source="webhook")
        except Exception as e:
            current_app.logger.exception("billing/webhook handler error")

    return jsonify({"received": True}), 200


@billing_bp.route("/checkout-session/confirm", methods=["POST", "OPTIONS"])
@limiter.limit("20/minute")
@require_authenticated
def confirm_checkout_session():
    user_id = caller_id()
    data = request.get_json(silent=True) or {}
    session_id = (data.get("session_id") or "").strip()

    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    stripe.api_key = current_app.config.get("STRIPE_SECRET_KEY")
    if not stripe.api_key:
        current_app.logger.error("billing/confirm-checkout stripe not configured user_id=%s", user_id)
        return jsonify({"error": "Stripe is not configured"}), 500

    try:
        session = stripe.checkout.Session.retrieve(session_id)
        result = _finalize_completed_checkout(session, source="success-return", expected_user_id=user_id)
        return jsonify(result), 200
    except stripe.StripeError:
        current_app.logger.exception("billing/confirm-checkout stripe error user_id=%s session_id=%s", user_id, session_id)
        return jsonify({"error": "Unable to verify checkout session"}), 502
    except ValueError as exc:
        current_app.logger.warning("billing/confirm-checkout rejected user_id=%s session_id=%s error=%s", user_id, session_id, exc)
        return jsonify({"error": str(exc)}), 409
    except Exception:
        current_app.logger.exception("billing/confirm-checkout unexpected error user_id=%s session_id=%s", user_id, session_id)
        return jsonify({"error": "Unable to finalize membership"}), 500
