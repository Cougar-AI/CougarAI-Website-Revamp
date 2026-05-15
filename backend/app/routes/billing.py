import stripe
from datetime import date
from flask import Blueprint, current_app, request, jsonify
from app.raw_db import connect
from app import limiter

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
def join_member():
    if request.method == "OPTIONS":
        return _cors_preflight()

    data = request.get_json(silent=True) or {}
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    email = (data.get("email") or "").strip()
    student_id = (data.get("student_id") or "").strip() or None
    grade_level = (data.get("grade_level") or "").strip() or None

    if not first_name or not last_name or not email:
        return jsonify({"error": "first_name, last_name, and email are required"}), 400

    if student_id:
        try:
            conn = connect()
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM profile WHERE student_id = %s", (student_id,))
                if not cur.fetchone():
                    cur.execute(
                        "INSERT INTO profile (student_id, first_name, last_name, grade_level)"
                        " VALUES (%s, %s, %s, %s)",
                        (student_id, first_name, last_name, grade_level),
                    )
                    conn.commit()
        except Exception as e:
            current_app.logger.error("profile insert error: %s", e)

    user_id = student_id if student_id else email
    return jsonify({"user_id": user_id}), 200


@billing_bp.route("/create-checkout-session", methods=["POST", "OPTIONS"])
@limiter.limit("10/minute")
def create_checkout_session():
    if request.method == "OPTIONS":
        return _cors_preflight()

    data = request.get_json(silent=True) or {}
    price_id = data.get("price_id")
    user_id = data.get("user_id")
    plan_id = data.get("plan_id")
    success_url = data.get("success_url")
    cancel_url = data.get("cancel_url")

    if price_id not in _ALLOWED_PRICE_IDS:
        return jsonify({"error": "Invalid price ID"}), 400

    if not all([success_url, cancel_url]):
        return jsonify({"error": "success_url and cancel_url are required"}), 400

    stripe.api_key = current_app.config.get("STRIPE_SECRET_KEY")
    if not stripe.api_key:
        return jsonify({"error": "Stripe is not configured"}), 500

    # Look up existing Stripe customer ID so returning members skip re-entering payment details
    existing_customer_id = None
    if user_id and str(user_id).isdigit():
        try:
            conn = connect()
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT stripe_customer_id FROM users WHERE user_id = %s",
                    (int(user_id),),
                )
                row = cur.fetchone()
                existing_customer_id = row["stripe_customer_id"] if row else None
        except Exception:
            pass

    try:
        session_kwargs = dict(
            mode="payment",
            line_items=[{"price": price_id, "quantity": 1}],
            metadata={"user_id": str(user_id or ""), "plan_id": str(plan_id or "")},
            success_url=success_url,
            cancel_url=cancel_url,
        )
        if existing_customer_id:
            session_kwargs["customer"] = existing_customer_id
        session = stripe.checkout.Session.create(**session_kwargs)
    except stripe.StripeError as e:
        current_app.logger.error("Stripe error: %s", e)
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


@billing_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature", "")
    secret = current_app.config.get("STRIPE_WEBHOOK_SECRET", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, secret)
    except (stripe.errors.SignatureVerificationError, ValueError) as e:
        current_app.logger.warning("Stripe webhook rejected: %s", e)
        return jsonify({"error": "Invalid signature"}), 400

    if event["type"] == "checkout.session.completed":
        try:
            session = event["data"]["object"]
            metadata = session.get("metadata", {})
            user_id_str = metadata.get("user_id", "")
            plan_id = metadata.get("plan_id", "")
            stripe_customer_id = session.get("customer")
            stripe_session_id = session.get("id")
            amount = round((session.get("amount_total") or 0) / 100, 2)

            today = date.today()
            expires_at = _get_membership_expiry(plan_id, today) if plan_id else None

            conn = connect()
            with conn.cursor() as cur:
                # Persist Stripe customer ID on the users row
                if user_id_str and user_id_str.isdigit() and stripe_customer_id:
                    cur.execute(
                        "UPDATE users SET stripe_customer_id = %s WHERE user_id = %s",
                        (stripe_customer_id, int(user_id_str)),
                    )

                # Duplicate-payment guard: warn but don't block
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
                            "Duplicate payment detected for user_id=%s plan=%s — inserting anyway",
                            user_id_str, plan_id,
                        )

                # Determine student_id for the payments row
                student_id_val = None
                email_val = None
                if user_id_str and user_id_str.isdigit():
                    cur.execute(
                        "SELECT student_id FROM profile WHERE user_id = %s",
                        (int(user_id_str),),
                    )
                    row = cur.fetchone()
                    if row:
                        student_id_val = row["student_id"]
                    else:
                        cur.execute(
                            "SELECT email FROM users WHERE user_id = %s",
                            (int(user_id_str),),
                        )
                        urow = cur.fetchone()
                        email_val = urow["email"] if urow else None
                else:
                    email_val = user_id_str or None

                cur.execute(
                    """
                    INSERT INTO payments
                        (student_id, email, date, amount, stripe_session_id, plan_id, expires_at)
                    VALUES (%s, %s, CURRENT_DATE, %s, %s, %s, %s)
                    """,
                    (student_id_val, email_val, amount, stripe_session_id, plan_id or None, expires_at),
                )
                conn.commit()
        except Exception as e:
            current_app.logger.error("webhook handler error: %s", e)

    return jsonify({"received": True}), 200
