#!/usr/bin/env bash
# lovii-deploy — forced-command деплой LOVII (волны 2–3 аудита).
# A1 (закрыто 05.10): PAT ротирован владельцем (lovii-deploy-ghcr-read-2026-10,
# read:packages, 90 дней, истекает ~январь 2027). Персистентный login сохранён
# осознанно (README: credentials в ~/.docker/config.json deploy, права каталога
# 700; токен read-only). Ephemeral login (login перед pull + logout в trap) —
# под-итерация при следующем касании деплоя.
# Вызов из CI: ssh deploy@host "deploy <stack> <sha> [push-before]"
# Ключ CI заперт в authorized_keys:
#   command="/home/deploy/bin/lovii-deploy staging",restrict ssh-ed25519 ...
#   command="/home/deploy/bin/lovii-deploy production",restrict ssh-ed25519 ...
set -euo pipefail
LOG="$HOME/lovii-deploy.log"
SCOPE="${1:-}"
read -r action stack sha push_before _ <<< "${SSH_ORIGINAL_COMMAND:-}"
# read не интерпретирует кавычки — снимаем одинарные (приходят из CI-команды)
strip_q() { local v="${1:-}"; v="${v#\'}"; v="${v%\'}"; printf "%s" "$v"; }
action=$(strip_q "$action"); stack=$(strip_q "$stack")
sha=$(strip_q "${sha:-}"); push_before=$(strip_q "${push_before:-}")
log() { echo "$(date -u +%FT%TZ) [$SCOPE] $*" >> "$LOG" 2>/dev/null || true; }
deny() { echo "lovii-deploy: $1" >&2; log "DENY $1 :: cmd='${SSH_ORIGINAL_COMMAND:-}'"; exit 2; }

[[ "$SCOPE" == "staging" || "$SCOPE" == "production" ]] || deny "bad scope: $SCOPE"
[[ "$action" == "deploy" ]] || deny "usage: deploy <stack> <sha> [push-before]"

case "$stack" in
  lovii-core|lovii-app|lovii-b2b|lovii-admin)
    [[ "$SCOPE" == "production" ]] || deny "stack $stack вне scope $SCOPE" ;;
  lovii-core-staging|lovii-app-staging|lovii-b2b-staging|lovii-admin-staging)
    [[ "$SCOPE" == "staging" ]] || deny "stack $stack вне scope $SCOPE" ;;
  *) deny "unknown stack: $stack" ;;
esac

[[ -z "$sha" || "$sha" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || deny "invalid sha: $sha"
[[ -z "$push_before" || "$push_before" =~ ^[0-9a-f]{40}$ ]] || deny "invalid push-before: $push_before"

TYPE="${stack%-staging}"; TYPE="${TYPE#lovii-}"
DIR="/opt/$stack"
BRANCH=staging; ENV=staging
if [[ "$stack" != *-staging ]]; then BRANCH=master; ENV=production; fi

log "START stack=$stack sha=$sha pb=$push_before"
cd "$DIR"
DC="docker compose -f docker-compose.prod.yml"
# staging-core: мок живёт в staging-extras (R-3.4) — апдейтим оба файла одной командой
if [[ "$stack" == "lovii-core-staging" && -f docker-compose.staging-extras.yml ]]; then
  DC="docker compose -f docker-compose.prod.yml -f docker-compose.staging-extras.yml"
fi

git fetch origin "$BRANCH"
git reset --hard "${sha:-origin/$BRANCH}"

# --- R-3.2 (v3, по ревью арены): pull-only по умолчанию, строгий mapping ---
# Явная таблица: пакет → сервис(ы) стека, по ИМЕНИ СЕРВИСА из compose.
# Никакого order-based тегирования; никакой тихой сборки при провале pull:
# сборка разрешена ТОЛЬКО в staging; production — fail-closed.
declare -A PKG=() SVC=() TAGGED_ID=()
tag="${sha:-latest}"
case "$TYPE" in
  core)
    PKG[app]=lovii-core-app;        SVC[app]="app"
    PKG[worker]=lovii-core-worker;  SVC[worker]="horizon telegram-poller-orders telegram-poller-otp telegram-poller-support"
    PKG[scheduler]=lovii-core-scheduler; SVC[scheduler]="scheduler"
    ;;
  app)
    PKG[app]=lovii-app;             SVC[app]="web"
    ;;
  b2b)
    PKG[app]=lovii-b2b-app;         SVC[app]="app"
    PKG[scheduler]=lovii-b2b-scheduler; SVC[scheduler]="scheduler"
    PKG[queue]=lovii-b2b-queue;     SVC[queue]="queue"
    ;;
  admin)
    PKG[app]=lovii-admin-app;       SVC[app]="app"
    PKG[scheduler]=lovii-admin-scheduler; SVC[scheduler]="scheduler"
    ;;
esac

# сервис→образ текущего compose (по имени сервиса; сторонние не участвуют)
declare -A SVC_IMG=()
while IFS="=" read -r svc img; do SVC_IMG[$svc]="$img"; done < <($DC config --format json 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
for name,svc in sorted(d.get('services',{}).items()):
    img=svc.get('image')
    if img: print(f'{name}={img}')")

# A4 strict allowlist таргета: только образы сервисов из таблицы SVC
allowed_targets=" ${SVC[*]} "
target_allowed() {
  local svc="$1"
  case " $allowed_targets " in *" $svc "*) return 0;; *) return 1;; esac
}

# Пулл всех образов пакета; при провале — staging: fallback-сборка, production: ABORT
pull_ok=1
for pkgkey in "${!PKG[@]}"; do
  if ! docker pull "ghcr.io/lovii-tech/${PKG[$pkgkey]}:${tag}" < /dev/null; then
    echo "==> WARN: pull ghcr.io/lovii-tech/${PKG[$pkgkey]}:${tag} не удался"
    pull_ok=0
    break
  fi
done
if [[ "$pull_ok" != 1 ]]; then
  if [[ "$ENV" == "production" ]]; then
    echo "ABORT: production pull-only — сборка на прод-хосте запрещена (A4/ревью)."
    log "ABORT pull-failed production"
    exit 1
  fi
  echo "==> staging fallback: локальная сборка"
  build=1
  if [[ "$TYPE" == "core" && -n "$push_before" && "$push_before" != "0000000000000000000000000000000000000000" ]] \
     && git cat-file -e "${push_before}^{commit}" 2>/dev/null \
     && git diff --quiet "$push_before" HEAD -- . ":(exclude)*.md" ":(exclude)docs/" 2>/dev/null; then
    echo "==> Docs-only push — skipping image build."
    build=0
  fi
  if [[ "$build" == 1 ]]; then
    if [[ "$TYPE" == "app" ]]; then export APP_VERSION="${BRANCH}·$(git rev-parse --short HEAD)"; fi
    $DC build --pull < /dev/null
  fi
fi

# --- A4 strict: тегирование по каждому сервису + проверка coverage ---
declare -A TAGGED_ID
missing=0
for pkgkey in "${!PKG[@]}"; do
  ghcr_ref="ghcr.io/lovii-tech/${PKG[$pkgkey]}:${tag}"
  [[ "$pull_ok" != 1 ]] && ghcr_ref="${PKG[$pkgkey]}:${tag}"  # fallback: локальный билд-тег
  ghcr_id=$(docker image inspect "$ghcr_ref" --format "{{.Id}}" 2>/dev/null) || {
    echo "A4 ABORT: образ $ghcr_ref недоступен локально"; log "A4 ABORT no-image $ghcr_ref"; exit 1; }
  TAGGED_ID[$pkgkey]="$ghcr_id"
  for svc in ${SVC[$pkgkey]}; do
    img="${SVC_IMG[$svc]:-}"
    if [[ -z "$img" ]]; then
      echo "A4 ABORT: сервис $svc из таблицы отсутствует в compose"; log "A4 ABORT no-svc $svc"; exit 1
    fi
    case "$img" in redis:*|imresamu/*|getmeili/*|node:*|alpine:*|docker:*|postgres:*|mysql:*|library/*)
      echo "A4 ABORT: сторонний таргет $img для $svc"; log "A4 DENY сторонний $img"; exit 1;;
    esac
    docker tag "$ghcr_ref" "$img" && echo "Tagged ${PKG[$pkgkey]} -> $img ($svc)"
  done
done
# reverse-coverage: каждый НЕ-сторонний образ compose обязан был получить тег
for svc in "${!SVC_IMG[@]}"; do
  img="${SVC_IMG[$svc]}"
  case "$img" in redis:*|imresamu/*|getmeili/*|node:*|alpine:*|docker:*) continue;; esac
  covered=0
  for pkgkey in "${!PKG[@]}"; do
    for s in ${SVC[$pkgkey]}; do [[ "$s" == "$svc" ]] && covered=1; done
  done
  if [[ "$covered" != 1 ]]; then
    echo "A4 ABORT: образ compose $img (сервис $svc) не покрыт таблицей пакетов"
    log "A4 ABORT uncovered $svc"; exit 1
  fi
done

# --- A4 pre-up: ID образа КАЖДОГО сервиса == ID его GHCR-пакета (ДО migrate) ---
for pkgkey in "${!PKG[@]}"; do
  for svc in ${SVC[$pkgkey]}; do
    img="${SVC_IMG[$svc]}"
    img_id=$(docker image inspect "$img" --format "{{.Id}}" 2>/dev/null) || { echo "A4 ABORT: $img отсутствует"; exit 1; }
    [[ "$img_id" == "${TAGGED_ID[$pkgkey]}" ]] || {
      echo "A4 ABORT: $svc ($img) != ${PKG[$pkgkey]}:${tag}"; log "A4 ABORT mismatch $svc"; exit 1; }
  done
done
echo "==> A4 pre-up strict OK: mapping и ID всех сервисов соответствуют ${tag}."

# --- pre-migrate dump на production (R-2.4) ---
if [[ "$ENV" == "production" && "$TYPE" != "app" ]]; then
  mkdir -p "$HOME/backups/pre-migrate"
  echo "==> Pre-migrate dump..."
  docker exec lovii-core-pgsql-1 pg_dump -Fc -U lovii-core lovii-core \
    > "$HOME/backups/pre-migrate/pre-migrate-$stack-$(date -u +%Y%m%dT%H%M%SZ).dump" \
    || { echo "pre-migrate dump FAILED — abort"; log "ABORT pre-migrate-dump"; exit 1; }
fi

# --- migrate + horizon (Laravel-стеки) ---
if [[ "$TYPE" != "app" ]]; then
  echo "==> Running migrations..."
  $DC run --rm -T app php artisan migrate --force < /dev/null
  echo "==> Terminating Horizon workers (if any)..."
  $DC exec -T horizon php artisan horizon:terminate < /dev/null 2>/dev/null || true
fi

echo "==> Recreating containers..."
$DC up -d --remove-orphans -t 5 < /dev/null

# --- health check ---
svc=app; port=8080; path=healthz
if [[ "$TYPE" == "app" ]]; then svc=web; port=9000; path=health; fi
for i in 1 2 3 4 5; do
  sleep 3
  if $DC exec -T "$svc" curl -sf "http://127.0.0.1:$port/$path" < /dev/null > /dev/null; then
    echo "Health check passed (attempt $i)"
    break
  fi
  if [ "$i" -eq 5 ]; then
    echo "Health check failed after 5 attempts!"
    $DC logs --tail=50 "$svc"
    log "FAIL stack=$stack health"
    exit 1
  fi
  echo "Health check attempt $i failed, retrying..."
done

echo "==> Deploy complete!"
log "OK stack=$stack sha=$(git rev-parse --short HEAD)"
