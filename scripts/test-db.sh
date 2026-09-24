#!/usr/bin/env bash
# Apply all migrations to a throwaway Postgres (Docker) and run the access
# rule tests. Nothing touches the real Supabase project.
#
#   npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."

name=map-app-db-test
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e POSTGRES_PASSWORD=test postgres:17 >/dev/null
trap 'docker rm -f "$name" >/dev/null' EXIT

# The image's init step runs a temporary server first; wait for the real one (TCP)
until docker exec "$name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do sleep 1; done

run() { docker exec -i "$name" psql -U postgres -v ON_ERROR_STOP=1 -q -X; }

run < supabase/tests/stub_supabase.sql
for f in supabase/migrations/*.sql; do
  echo "Applying $f"
  run < "$f"
done
run < supabase/tests/helpers.sql
for f in supabase/tests/*.test.sql; do
  echo "Running $f"
  run < "$f" 2>&1 >/dev/null | sed -E "s/^(psql:<stdin>:[0-9]+: )?(NOTICE|ERROR): +//"
done

echo "All database tests passed."
