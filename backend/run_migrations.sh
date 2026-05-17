#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env safely (no shell expansion — handles special chars like $ in passwords)
_env_file="$SCRIPT_DIR/.env"
if [[ ! -f "$_env_file" ]]; then
  echo "ERROR: $_env_file not found" >&2
  exit 1
fi

_get_env() {
  # Read value for a key literally (no variable expansion)
  local key="$1"
  grep -m1 "^${key}=" "$_env_file" | cut -d= -f2-
}

DB_NAME="$(_get_env DB_NAME)"
DB_USER="$(_get_env DB_USER)"
DB_PASS="$(_get_env DB_PASS)"
[[ -z "$DB_PASS" ]] && DB_PASS="$(_get_env DB_PASSWORD)"
DB_HOST="$(_get_env DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="$(_get_env DB_PORT)"; DB_PORT="${DB_PORT:-5432}"

[[ -z "$DB_NAME" ]] && { echo "ERROR: DB_NAME not set in .env" >&2; exit 1; }
[[ -z "$DB_USER" ]] && { echo "ERROR: DB_USER not set in .env" >&2; exit 1; }
[[ -z "$DB_PASS" ]] && { echo "ERROR: DB_PASS/DB_PASSWORD not set in .env" >&2; exit 1; }

export PGPASSWORD="$DB_PASS"

MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

# Ordered list — respects FK dependencies
MIGRATIONS=(
  add_users_dashboard_fields.sql
  add_profile_dashboard_fields.sql
  add_payments_email.sql
  add_payments_membership_fields.sql
  add_payments_manual_flag.sql
  add_events_checkin_fields.sql
  add_events_location_url.sql
  add_non_member_default_role.sql
  merge_webmaster_to_admin.sql
  add_event_types_table.sql
  add_officer_positions_table.sql
  add_sponsors_table.sql
  add_sponsors_unique_name.sql
  add_partners_tables.sql
  add_points_admin_fields.sql
  add_points_unique_constraint.sql
  add_progress_reports_table.sql
  add_events_google_calendar_id.sql
  add_event_partners_table.sql
  add_partner_resource_links_table.sql
  add_pinned_announcements_table.sql
  add_events_geolocation.sql
  add_event_sponsors_table.sql
  add_receipts_table.sql
  add_events_rsvp.sql
  add_notifications_tables.sql
  fix_events_event_name_nullable.sql
  add_user_notifications_table.sql
)

FAILED=0

for migration in "${MIGRATIONS[@]}"; do
  file="$MIGRATIONS_DIR/$migration"
  if [[ ! -f "$file" ]]; then
    echo "MISSING  $migration"
    FAILED=$((FAILED + 1))
    continue
  fi
  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file" -v ON_ERROR_STOP=1 -q 2>&1; then
    echo "OK       $migration"
  else
    echo "FAILED   $migration"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
if [[ $FAILED -eq 0 ]]; then
  echo "All ${#MIGRATIONS[@]} migrations applied successfully."
else
  echo "$FAILED migration(s) failed." >&2
  exit 1
fi
