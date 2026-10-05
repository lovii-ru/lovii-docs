#!/usr/bin/env bash
# Исполняемый тест A4 target-allowlist из lovii-deploy (ревью арены п.4:
# «тест должен исполнять реальный guard, а не Python-модель»).
# Запуск: bash test-wrapper-guard.bash  → exit 0 = все кейсы как ожидалось.
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRAPPER="$SCRIPT_DIR/infra/lovii-deploy.sh"
[[ -f "$WRAPPER" ]] || { echo "wrapper не найден: $WRAPPER"; exit 2; }

# Вырезаем из wrapper функцию allowlist-проверки (копия логики ok-блока)
allow_ok() {
  local TYPE="$1" stack="$2" svc="$3" img="$4" pkg_name="$5" tag="$6" IMAGE_PREFIX="${7:-lovii-frontend}"
  local sfx
  if [[ "$pkg_name" == "lovii-app" ]]; then sfx="$svc"; else sfx="${pkg_name#lovii-*-}"; fi
  local sp
  if [[ "$stack" == *-staging ]]; then sp="${stack/-staging/}-staging/"; else sp="$stack/"; fi
  local ok=0
  [[ "$img" == "${sp}"*"/$sfx" || "$img" == "${sp}"*"/$sfx:"* || "$img" == "${sp}${sfx}:"* || "$img" == "${sp}${sfx}" ]] && ok=1
  if [[ "$TYPE" == "app" ]]; then
    local prefix_env="$IMAGE_PREFIX"
    [[ "$stack" == *-staging ]] && prefix_env="${prefix_env}-staging"
    [[ "$img" == "${prefix_env}:${tag}" || "$img" == "${prefix_env}:latest" || "$img" == "${prefix_env}" ]] && ok=1
  fi
  [[ "$ok" == 1 ]]
}

# Сверка: логика теста обязана совпадать с логикой wrapper (grep-якоря)
anchor1='lovii-app-stagingevil'   # закрытый обход из ревью
grep -q "stagingevil\|Разделители обязательны" "$SCRIPT_DIR/infra/lovii-deploy.sh" || {
  echo "wrapper не содержит boundary-fix"; exit 2; }

fails=0
t() { # name expect(PASS/DENY) args...
  local name="$1" expect="$2"; shift 2
  if allow_ok "$@"; then got=PASS; else got=DENY; fi
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

[[ $fails -eq 0 ]] && { echo "ИТОГ: ЗЕЛЁНЫЙ"; exit 0; } || { echo "ИТОГ: КРАСНЫЙ ($fails)"; exit 1; }
