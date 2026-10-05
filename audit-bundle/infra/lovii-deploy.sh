#!/usr/bin/env bash
# lovii-deploy — forced-command деплой LOVII (волны 2–3 аудита).
# A1/P0 (план ротации): docker login в GHCR — эфемерный: login перед pull,
# docker logout после (паттерн gostiny-deploy). До выпуска нового PAT
# действует персистентный login (старый токен, read:packages, ротация —
# см. canon/SECRETS_ROTATION.md).
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

# --- R-3.2: деплой ПУЛЛОМ образов по SHA из GHCR (сборка не на проде) ---
# имена пакетов = lovii-tech/<repo>-<svc>, по одному образу на compose-сервис
declare -A IMGS=()
case "$TYPE" in
  core)   IMGS[core-app]=lovii-core-app; IMGS[core-worker]=lovii-core-worker; IMGS[core-scheduler]=lovii-core-scheduler ;;
  app)    IMGS[app]=lovii-app ;;
  b2b)    IMGS[b2b-app]=lovii-b2b-app; IMGS[b2b-scheduler]=lovii-b2b-scheduler; IMGS[b2b-queue]=lovii-b2b-queue ;;
  admin)  IMGS[admin-app]=lovii-admin-app; IMGS[admin-scheduler]=lovii-admin-scheduler ;;
esac
tag="${sha:-latest}"
declare -A SVC_TAG=()
pull_ok=1
for pkg in "${IMGS[@]}"; do
  :
done
for pkgkey in "${!IMGS[@]}"; do
  if docker pull "ghcr.io/lovii-tech/${IMGS[$pkgkey]}:${tag}" < /dev/null; then
    :
  else
    echo "==> WARN: ghcr.io/lovii-tech/${IMGS[$pkgkey]}:${tag} недоступен — fallback на локальную сборку"
    pull_ok=0
    break
  fi
done
if [[ "$pull_ok" == 1 ]]; then
  # тегируем запулленные образы в локальные имена compose (<IMAGE_PREFIX>-staging/<svc>)
  # Сопоставление сервис→образ ПО ИМЕНИ сервиса (не по порядку!). GHCR-пакет
  # <pkg> тегируется в image сервиса с тем же суффиксом. Баги 11:08/11:18
  # (redis и app перезаписаны не теми образами) были из-за order-based тегов.
  declare -A SVC_IMG
  while IFS="=" read -r svc img; do
    SVC_IMG[$svc]="$img"
  done < <($DC config --format json 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
for name,svc in sorted(d.get('services',{}).items()):
    img=svc.get('image')
    if img: print(f'{name}={img}')")
  tag_one() {
    local pkg="$1" svc="$2"
    local img="${SVC_IMG[$svc]:-}"
    # A4 allowlist: источник — только ghcr.io/lovii-tech/<pkg из IMGS>;
    # таргет — только image сервиса текущего стека (из compose config).
    if [[ -n "$img" && -n "${IMGS[$pkg]:-}" ]]; then
      # защита: таргет не должен быть сторонним образом (redis/postgis/...)
      if echo "$img" | grep -qE "^(redis:|imresamu/|getmeili/|node:|alpine:|docker:|library/)"; then
        echo "A4 ABORT: попытка тегировать сторонний образ $img"; log "A4 DENY сторонний $img"; exit 1
      fi
      docker tag "ghcr.io/lovii-tech/${IMGS[$pkg]}:${tag}" "$img" && echo "Tagged ${IMGS[$pkg]} -> $img ($svc)"
    fi
  }
  # core: app/worker/scheduler; poller-ы используют worker-образ (обслуживаются через worker pkg)
  case "$TYPE" in
    core)  tag_one core-app app; tag_one core-scheduler scheduler; tag_one core-worker horizon ;;
    app)   tag_one app app ;;
    b2b)   tag_one b2b-app app; tag_one b2b-scheduler scheduler; tag_one b2b-queue queue ;;
    admin) tag_one admin-app app; tag_one admin-scheduler scheduler ;;
  esac
  echo "==> Tagged GHCR images into local compose names."
else
  build=1
  if [[ "$TYPE" == "core" && -n "$push_before" && "$push_before" != "0000000000000000000000000000000000000000" ]] \
     && git cat-file -e "${push_before}^{commit}" 2>/dev/null \
     && git diff --quiet "$push_before" HEAD -- . ":(exclude)*.md" ":(exclude)docs/" 2>/dev/null; then
    echo "==> Docs-only push — skipping image build."
    build=0
  fi
  if [[ "$build" == 1 ]]; then
    if [[ "$TYPE" == "app" ]]; then
      export APP_VERSION="${BRANCH}·$(git rev-parse --short HEAD)"
    fi
    $DC build --pull < /dev/null
  fi
fi

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

# --- A4: проверка ДО up — образ каждого app-сервиса = ожидаемый GHCR по SHA
if [[ "$pull_ok" == 1 ]]; then
  expect_fail=0
  for pkgkey in "${!IMGS[@]}"; do
    :
  done
  while IFS="=" read -r svc img; do
    cur=$(docker image inspect "$img" --format "{{index .RepoTags 0}}" 2>/dev/null | head -1)
    # ожидаем, что cur ссылается на GHCR-образ нужного SHA (по RepoTags после tag_one это локальное имя; проверяем идентичность ID с ghcr-образом)
    expected="ghcr.io/lovii-tech/"
    :
  done < <($DC config --format json 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
for name,svc in sorted(d.get('services',{}).items()):
    img=svc.get('image')
    if img and not img.split(':')[0].split('/')[0] in ('redis','docker.io','imresamu') and 'alpine' not in img and 'postgis' not in img and 'meilisearch' not in img:
        print(f'{name}={img}')")
  # строгая проверка: ID локального образа каждого app-сервиса == ID GHCR-образа SHA
  for pkgkey in "${!IMGS[@]}"; do
    ghcr_ref="ghcr.io/lovii-tech/${IMGS[$pkgkey]}:${tag}"
    ghcr_id=$(docker image inspect "$ghcr_ref" --format "{{.Id}}" 2>/dev/null) || { echo "A4 ABORT: $ghcr_ref отсутствует"; log "A4 ABORT no-image $ghcr_ref"; exit 1; }
    # найти локальный тег с этим ID среди образов compose
    match=0
    for ln in $($DC config --images 2>/dev/null); do
      lid=$(docker image inspect "$ln" --format "{{.Id}}" 2>/dev/null) || continue
      [[ "$lid" == "$ghcr_id" ]] && { match=1; break; }
    done
    if [[ "$match" != 1 ]]; then
      echo "A4 ABORT: ни один образ compose не совпадает с $ghcr_ref"
      log "A4 ABORT mismatch $ghcr_ref"
      exit 1
    fi
  done
  echo "==> A4 pre-up check OK: все app-образы соответствуют SHA."
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
