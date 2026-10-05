#!/usr/bin/env bash
# Тест A4 target-allowlist. Проверяет РЕАЛЬНУЮ связку wrapper↔predicate:
#   1) lovii-deploy.sh source-ит a4-predicate.sh и вызывает a4_target_allowed
#      (fail-closed при отсутствии predicate);
#   2) в wrapper не осталось inline-копии boundary-логики (единый источник);
#   3) 8 кейсов PASS/DENY через сам predicate.
# Запуск: bash tests/test-wrapper-guard.bash → exit 0 = зелёный.
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREDICATE="$SCRIPT_DIR/../infra/a4-predicate.sh"
WRAPPER="$SCRIPT_DIR/../infra/lovii-deploy.sh"
[[ -f "$PREDICATE" ]] || { echo "predicate не найден"; exit 2; }
[[ -f "$WRAPPER" ]] || { echo "wrapper не найден"; exit 2; }

fails=0
ck() { local name="$1" expect="$2" got="$3"
  if [[ "$got" == "$expect" ]]; then echo "PASS $name"; else echo "FAIL $name: ожидался $expect, получен $got"; fails=$((fails+1)); fi
}

# 1. Структурная связка: wrapper обязан source-ить predicate (fail-closed) и
#    вызывать a4_target_allowed; inline-копии boundary-паттернов быть не должно.
grep -q 'source "$PREDICATE"' "$WRAPPER" \
  && grep -q 'a4-predicate.sh не найден' "$WRAPPER" \
  && grep -q 'a4_target_allowed' "$WRAPPER"
ck "wrapper source-ит predicate (fail-closed)" 0 $?

if grep -qE '\$\{sp\}|"Разделители обязательны"' "$WRAPPER"; then
  echo "FAIL в wrapper осталась inline-копия A4-логики"; fails=$((fails+1))
else
  echo "PASS inline-копии A4-логики в wrapper нет"
fi

# 2. Поведение predicate: 8 кейсов через единственный источник.
source "$PREDICATE"
t() {
  local name="$1" expect="$2"; shift 2
  if a4_target_allowed "$@"; then got=PASS; else got=DENY; fi
  ck "predicate: $name" "$expect" "$got"
}
t "valid core app"        PASS core lovii-core-staging app "lovii-core-staging/app" lovii-core-app 2c1128c
t "valid core horizon"    PASS core lovii-core-staging horizon "lovii-core-staging/worker" lovii-core-worker 2c1128c
t "valid app web"         PASS app lovii-app-staging web "lovii-frontend-staging:latest" lovii-app 5b61afe
t "valid b2b queue"       PASS b2b lovii-b2b-staging queue "lovii-b2b-staging/queue" lovii-b2b-queue abc123
t "bypass app-evil"       DENY core lovii-core-staging app "lovii-core-staging/app-evil" lovii-core-app 2c1128c
t "bypass prefixevil"     DENY app lovii-app-staging web "lovii-frontend-stagingevil:latest" lovii-app 5b61afe
t "bypass stagingevil"    DENY core lovii-core-staging app "lovii-core-stagingevil/app" lovii-core-app 2c1128c
t "bypass nginx"          DENY app lovii-app-staging web "nginx:latest" lovii-app 5b61afe

[[ $fails -eq 0 ]] && { echo "ИТОГ: ЗЕЛЁНЫЙ (wrapper исполняет общий predicate)"; exit 0; } || { echo "ИТОГ: КРАСНЫЙ ($fails)"; exit 1; }
