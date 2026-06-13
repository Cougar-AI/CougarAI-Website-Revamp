-- Prevent duplicate Stripe checkout records for the same session.
-- Run once against the database.

-- Keep only the newest row for each Stripe session ID before adding the index.
DELETE FROM payments p
USING payments newer
WHERE p.stripe_session_id IS NOT NULL
  AND newer.stripe_session_id = p.stripe_session_id
  AND newer.payment_id > p.payment_id;

CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_session_id_unique
ON payments (stripe_session_id)
WHERE stripe_session_id IS NOT NULL;
