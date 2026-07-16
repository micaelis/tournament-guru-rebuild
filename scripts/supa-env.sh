#!/usr/bin/env bash
# Switch .env.local between local and hosted Supabase.
# Usage:  ./scripts/supa-env.sh local
#         ./scripts/supa-env.sh hosted

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
LOCAL_BACKUP=".env.local.hosted"

case "${1:-}" in
  local)
    STATUS=$(supabase status -o env 2>/dev/null) || {
      echo "Local Supabase isn't running. Start it with: supabase start"
      exit 1
    }
    URL=$(echo "$STATUS" | grep '^API_URL=' | cut -d= -f2- | tr -d '"')
    ANON=$(echo "$STATUS" | grep '^ANON_KEY=' | cut -d= -f2- | tr -d '"')
    if [ -z "$URL" ] || [ -z "$ANON" ]; then
      echo "Could not parse local Supabase credentials."
      exit 1
    fi
    # Back up current hosted values (only if not already local)
    if grep -q "supabase.co" "$ENV_FILE" 2>/dev/null; then
      cp "$ENV_FILE" "$LOCAL_BACKUP"
      echo "Backed up hosted .env.local → $LOCAL_BACKUP"
    fi
    # Swap the first two lines
    sed -i '' "s|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=${URL}|" "$ENV_FILE"
    sed -i '' "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}|" "$ENV_FILE"
    echo "Switched to LOCAL Supabase (${URL})"
    echo "Restart your dev server to pick up the change."
    ;;
  hosted)
    if [ ! -f "$LOCAL_BACKUP" ]; then
      echo "No hosted backup found ($LOCAL_BACKUP). Already on hosted, or never switched."
      exit 1
    fi
    cp "$LOCAL_BACKUP" "$ENV_FILE"
    echo "Restored HOSTED .env.local from backup."
    echo "Restart your dev server to pick up the change."
    ;;
  *)
    echo "Usage: $0 <local|hosted>"
    exit 1
    ;;
esac
