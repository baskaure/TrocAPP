#!/bin/bash
# Banc de test des migrations : Postgres 17 en Docker, schéma Supabase reconstitué, migrations, scénarios métier.
# Usage : ./supabase/tests/run.sh   (nécessite docker)
set -e
cd "$(dirname "$0")/../.."
docker inspect bontroc-pg >/dev/null 2>&1 || {
  docker run -d --name bontroc-pg -e POSTGRES_PASSWORD=pg -p 127.0.0.1:5544:5432 postgres:17 >/dev/null
  for i in $(seq 1 30); do docker exec bontroc-pg pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
}
PSQL="docker exec -i bontroc-pg psql -U postgres"
$PSQL -q -c "DROP DATABASE IF EXISTS bontroc_test;" -c "CREATE DATABASE bontroc_test;" >/dev/null
$PSQL -d bontroc_test -v ON_ERROR_STOP=1 -q < supabase/tests/00_stub_supabase.sql
# Toutes les migrations horodatées sauf celles qui dépendent de pg_cron / vault.
for f in $(ls supabase/migrations/*.sql | sort); do
  case "$f" in *review_reminders*) continue ;; esac
  # 20260917099000 ajoute une valeur d'enum : elle doit être validée avant d'être utilisée,
  # d'où une exécution isolée (c'est aussi la consigne de DEPLOIEMENT.md).
  printf "%-70s" "$(basename "$f")"
  if $PSQL -d bontroc_test -v ON_ERROR_STOP=1 -q < "$f" > /tmp/bontroc_mig.log 2>&1; then echo OK; else echo "ÉCHEC"; tail -5 /tmp/bontroc_mig.log; exit 1; fi
done
echo "--- scénarios ---"
$PSQL -d bontroc_test < supabase/tests/10_scenarios.sql 2>&1 | grep -E "PASS|FAIL|ERROR|ASSERTION|EXPECTED|TERMINÉS" | sed 's/^psql:.*NOTICE:  //'
