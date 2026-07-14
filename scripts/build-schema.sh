#!/usr/bin/env bash
# Build a single-file consolidated schema from the migrations tree.
#
# Output: supabase/schema.sql
#
# Includes every migration in order EXCEPT the two demo-only seeds
# (000010_refresh_event_dates_for_demo, 000015_seed_bubble_recent_reviews).
# The result is safe to run against a fresh Postgres/Supabase instance
# via `psql -f schema.sql` — it produces the same DDL state as running
# all migrations except the demo seeds.
#
# Re-run this whenever a migration is added or edited. To verify:
#   supabase db reset --local    # applies migrations
#   ...compare pg_dump output to psql -f schema.sql on a fresh DB.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
OUT="$ROOT/supabase/schema.sql"

# Migrations to skip: demo-only seeds that reorder / reseed content and
# would be destructive on a populated DB. Their content is deliberately
# NOT part of the consolidated bootstrap schema.
SKIP_PATTERNS=(
  "20240101000010_refresh_event_dates_for_demo.sql"
  "20240101000015_seed_bubble_recent_reviews.sql"
)

should_skip() {
  local base
  base="$(basename "$1")"
  for skip in "${SKIP_PATTERNS[@]}"; do
    if [[ "$base" == "$skip" ]]; then return 0; fi
  done
  return 1
}

{
  cat <<'HDR'
-- =====================================================================
-- Tournament Guru — consolidated schema (auto-generated).
--
-- DO NOT EDIT DIRECTLY. This file is produced by scripts/build-schema.sh
-- from supabase/migrations/. It is the concatenation of every migration
-- in chronological order, minus the demo-only seed migrations. Running
-- it against a fresh Postgres/Supabase project bootstraps the app's
-- final schema state (tables, RLS + policies, triggers, RPCs with
-- SET search_path, grants, indexes, and the small lookup seeds).
--
-- To regenerate:  bash scripts/build-schema.sh
-- To verify:      diff against `supabase db reset --local`'s pg_dump.
-- =====================================================================

HDR

  for f in "$MIGRATIONS"/*.sql; do
    if should_skip "$f"; then
      echo "-- (skipped demo seed: $(basename "$f"))"
      echo
      continue
    fi
    echo "-- ── $(basename "$f") ──────────────────────────────────────────"
    cat "$f"
    echo
  done
} > "$OUT"

echo "Wrote $OUT ($(wc -l < "$OUT") lines)"
