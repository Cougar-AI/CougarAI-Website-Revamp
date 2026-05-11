import stripe
from flask import Blueprint, current_app, request, jsonify
from app.raw_db import connect

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

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price": price_id, "quantity": 1}],
            metadata={"user_id": str(user_id or ""), "plan_id": str(plan_id or "")},
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except stripe.StripeError as e:
        current_app.logger.error("Stripe error: %s", e)
        return jsonify({"error": str(e)}), 502

    return jsonify({"url": session.url}), 200


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
            user_id = metadata.get("user_id", "")
            amount = round((session.get("amount_total") or 0) / 100, 2)

            conn = connect()
            with conn.cursor() as cur:
                if user_id.isdigit():
                    cur.execute(
                        "INSERT INTO payments (student_id, date, amount)"
                        " VALUES (%s, CURRENT_DATE, %s)",
                        (int(user_id), amount),
                    )
                else:
                    cur.execute(
                        "INSERT INTO payments (email, date, amount)"
                        " VALUES (%s, CURRENT_DATE, %s)",
                        (user_id or None, amount),
                    )
                conn.commit()
        except Exception as e:
            current_app.logger.error("webhook handler error: %s", e)

    return jsonify({"received": True}), 200
