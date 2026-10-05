#!/usr/bin/env bash
# Исполняемый тест A4 target-allowlist: ИСПОЛЬЗУЕТ ЕДИНУЮ ЛОГИКУ из
# a4-predicate.sh (общий источник с lovii-deploy) — 8 кейсов PASS/DENY.
# Запуск: bash tests/test-wrapper-guard.bash → exit 0 = зелёный.
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREDICATE="$SCRIPT_DIR/a4-predicate.sh"
WRAPPER="$SCRIPT_DIR/infra/lovii-deploy.sh"
[[ -f "$WRAPPER" ]] || WRAPPER="$(dirname "$SCRIPT_DIR")/infra/lovii-deploy.sh"
[[ -f "$PREDICATE" ]] || { echo "predicate не найден"; exit 2; }
[[ -f "$WRAPPER" ]] || { echo "wrapper не найден"; exit 2; }
source "$PREDICATE"

# Якорь: wrapper обязан содержать boundary-fix (та же логика/разделители)
grep -q "Разделители обязательны\|stagingevil\|\${sp}\${sfx}" "$WRAPPER" || {
  echo "wrapper не содержит boundary-fix (allowlist с разделителями)"; exit 2; }

fails=0
t() {
  local name="$1" expect="$2"; shift 2
  if a4_target_allowed "$@"; then got=PASS; else got=DENY; fi
  [[ "$got" == "$expect" ]] && echo "PASS $name" || { echo "FAIL $name: ожидался $expect, получен $got"; fails=$((fails+1)); }
}
t "valid core app"        PASS core lovii-core-staging app "lovii-core-staging/app" lovii-core-app 2c1128c
t "valid core horizon"    PASS core lovii-core-staging horizon "lovii-core-staging/worker" lovii-core-worker 2c1128c
t "valid app web"         PASS app lovii-app-staging web "lovii-frontend-staging:latest" lovii-app 5b61afe
t "valid b2b queue"       PASS b2b lovii-b2b-staging queue "lovii-b2b-staging/queue" lovii-b2b-queue abc123
t "bypass app-evil"       DENY core lovii-core-staging app "lovii-core-staging/app-evil" lovii-core-app 2c1128c
t "bypass prefixevil"     DENY app lovii-app-staging web "lovii-frontend-stagingevil:latest" lovii-app 5b61afe
t "bypass stagingevil"    DENY core lovii-core-staging app "lovii-core-stagingevil/app" lovii-core-app 2c1128c
t "bypass nginx"          DENY app lovii-app-staging web "nginx:latest" lovii-app 5b61afe

[[ $fails -eq 0 ]] && { echo "ИТОГ: ЗЕЛЁНЫЙ (единая логика wrapper↔тест)"; exit 0; } || { echo "ИТОГ: КРАСНЫЙ ($fails)"; exit 1; }
