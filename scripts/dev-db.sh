#!/usr/bin/env bash
# Local PostgreSQL 16 for development and tests, without Docker.
#
#   scripts/dev-db.sh start    # init on first run, start, create databases
#   scripts/dev-db.sh stop
#   scripts/dev-db.sh status
#
# Data lives in .pgdata/ (gitignored). Listens on localhost:$PGPORT only, with
# trust auth, so it is for local use only. Creates `placebook` (dev) and
# `placebook_test` (unit + E2E tests).
set -euo pipefail

cd "$(dirname "$0")/.."

PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PGPORT="${PGPORT:-54329}"
ROOT="$PWD/.pgdata"
DATA="$ROOT/data"
LOG="$ROOT/postgres.log"
DATABASES=(placebook placebook_test)

if [[ ! -x "$PG_BIN/pg_ctl" ]]; then
  echo "PostgreSQL binaries not found in $PG_BIN (set PG_BIN)." >&2
  exit 1
fi

# initdb/postgres refuse to run as root; use the postgres system user then.
as_pg() {
  if [[ "$(id -u)" == "0" ]]; then
    runuser -u postgres -- "$@"
  else
    "$@"
  fi
}

pg_ctl() { as_pg "$PG_BIN/pg_ctl" -D "$DATA" "$@"; }

is_running() { pg_ctl status >/dev/null 2>&1; }

init() {
  mkdir -p "$ROOT"
  if [[ "$(id -u)" == "0" ]]; then chown postgres:postgres "$ROOT"; fi
  as_pg "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust \
    --encoding=UTF8 --locale=C.UTF-8 >/dev/null
  echo "Initialized $DATA"
}

start() {
  [[ -f "$DATA/PG_VERSION" ]] || init
  if is_running; then
    echo "Already running on port $PGPORT"
  else
    pg_ctl -l "$LOG" -w -o "-p $PGPORT -k /tmp -c listen_addresses=localhost" start >/dev/null
    echo "Started on localhost:$PGPORT (log: .pgdata/postgres.log)"
  fi
  for db in "${DATABASES[@]}"; do
    if ! "$PG_BIN/psql" -h localhost -p "$PGPORT" -U postgres -tAc \
      "select 1 from pg_database where datname = '$db'" | grep -q 1; then
      "$PG_BIN/createdb" -h localhost -p "$PGPORT" -U postgres "$db"
      echo "Created database $db"
    fi
  done
  echo "DATABASE_URL=postgres://postgres@localhost:$PGPORT/placebook"
}

stop() {
  if is_running; then
    pg_ctl -w stop -m fast >/dev/null
    echo "Stopped"
  else
    echo "Not running"
  fi
}

status() {
  if is_running; then echo "Running on port $PGPORT"; else echo "Not running"; fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *)
    echo "usage: $0 {start|stop|status}" >&2
    exit 2
    ;;
esac
