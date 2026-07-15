#!/usr/bin/env bash
# Build a single-file consolidated schema from the migrations tree.
#
# Output: supabase/schema.sql
#
# Concatenates every migration under supabase/migrations/ in filename
# order. Running the result against a fresh Postgres/Supabase project
# reproduces the app's final schema state (tables, RLS, triggers,
# functions, grants, seed reference data).
#
# Re-run this whenever a migration is added. To verify:
#   supabase db reset            # applies migrations locally
#   diff pg_dump against psql -f supabase/schema.sql on a scratch DB.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
OUT="$ROOT/supabase/schema.sql"

{
  cat <<'HDR'
-- =====================================================================
-- Tournament Guru — consolidated schema (auto-generated).
--
-- DO NOT EDIT DIRECTLY. This file is produced by scripts/build-schema.sh
-- from supabase/migrations/. It is the concatenation of every migration
-- in chronological order. Running it against a fresh Postgres/Supabase
-- project bootstraps the app's final schema (tables, RLS policies,
-- triggers, RPCs with SET search_path, grants, indexes, seed data).
--
-- To regenerate:  bash scripts/build-schema.sh
-- To verify:      diff pg_dump output vs psql -f schema.sql on a fresh DB.
-- =====================================================================

HDR

  for f in "$MIGRATIONS"/*.sql; do
    echo "-- ── $(basename "$f") ──────────────────────────────────────────"
    cat "$f"
    echo
  done
} > "$OUT"

echo "Wrote $OUT ($(wc -l < "$OUT") lines)"
