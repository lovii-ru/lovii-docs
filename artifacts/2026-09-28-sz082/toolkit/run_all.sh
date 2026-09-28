#!/usr/bin/env bash
# SZ-082 Phase A orchestrator (READ-ONLY).
# Expects: SZ082_ROOT=<dir with cloned repos: core app b2b admin demo...>
# Optional: SZ082_OUT (default /home/z/my-project/download/sz082), SZ082_ICONS_DICT, SZ082_EXCLUDE
# Rule: only FRESH staging clones are valid sources (fuse from the card).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="${SZ082_ROOT:?set SZ082_ROOT to dir containing cloned repos}"
OUT="${SZ082_OUT:-/home/z/my-project/download/sz082}"
EXCL="${SZ082_EXCLUDE:-}"
CLIENTS="${SZ082_CLIENTS:-}"

echo "== SZ-082 Phase A mechanical pass =="
echo "root=$ROOT out=$OUT"
echo "-- fuse check: every repo must be on staging --"
for r in core app b2b admin demo; do
  d="$ROOT/$r"
  [ -d "$d" ] || { echo "  [skip] $d (no dir)"; continue; }
  br="$(git -C "$d" rev-parse --abbrev-ref HEAD)"
  echo "  $r: $br @ $(git -C "$d" rev-parse --short HEAD)"
  case "$br" in *staging*) ;; *) echo "    !! NOT staging — fuse violated, fix clone first" ;; esac
done

run() { # name script dir extra...
  local name="$1" script="$2" dir="$3"; shift 3
  [ -d "$dir" ] || { echo "[skip] $name ($dir)"; return; }
  echo "-- $name --"
  (cd "$HERE" && python3 "$script" "$dir" "$OUT" "$@")
}

run core audit_core.py   "$ROOT/core"   ${CLIENTS:+--clients "$ROOT/$CLIENTS"}
run app  audit_app.py    "$ROOT/app"    --exclude-glob "${SZ082_APP_EXCLUDE:-$EXCL}"
run b2b  audit_filament.py "$ROOT/b2b" --repo-name b2b
run admin audit_filament.py "$ROOT/admin" --repo-name admin
run demo audit_demo.py   "$ROOT/demo"   ${SZ082_ROUTE_MAP:+--route-map "$SZ082_ROUTE_MAP"}

echo "done. findings: $OUT/*.findings.{json,md}"
