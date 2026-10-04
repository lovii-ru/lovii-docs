#!/usr/bin/env bash
# Ansible managed
# Forced-command deploy wrapper. Владелец root:root, mode 0755 — deploy ТОЛЬКО исполняет.
# Вызов из CI:  echo "$GHCR_TOKEN" | ssh deploy@host 'deploy <stack> [git-ref]'
# Ключ deploy заперт в authorized_keys на этот скрипт (command=...,restrict) — shell недоступен.
set -euo pipefail

APPS_ROOT="/opt"
REGISTRY="ghcr.io"
REGISTRY_USER="gostiny-ci"
LOG="/var/log/gostiny-deploy.log"
NAME_RE='^[a-z][a-z0-9-]{1,30}$'
REF_RE='^[A-Za-z0-9._/-]+$'
WHO="$(id -un)"

log()  { echo "$(date -u +%FT%TZ) [$WHO] $*" >> "$LOG" 2>/dev/null || true; }
deny() { echo "deploy: $1" >&2; log "DENY $1 :: cmd='${SSH_ORIGINAL_COMMAND:-}'"; exit "${2:-2}"; }

# Команду берём из SSH_ORIGINAL_COMMAND, не из argv — forced-command подменяет её.
read -r action stack ref _ <<< "${SSH_ORIGINAL_COMMAND:-}"

[[ "$action" == "deploy" ]]                    || deny "usage: deploy <stack> [git-ref]" 2
[[ "$stack" =~ $NAME_RE ]]                      || deny "invalid stack name" 2
[[ -z "${ref:-}" || "$ref" =~ $REF_RE ]]       || deny "invalid git ref" 2
dir="$APPS_ROOT/$stack"
[[ -f "$dir/docker-compose.yml" ]]             || deny "unknown stack: $stack" 3
[[ ! -t 0 ]]                                   || deny "registry token required on stdin" 4

log "START stack=$stack ref=${ref:-none}"

# Логин в registry эфемерным токеном по stdin — на диск не пишется.
docker login "$REGISTRY" -u "$REGISTRY_USER" --password-stdin >/dev/null

cd "$dir"
# Если стек версионируется в git и передан ref — фиксируем именно его (детерминизм + откат).
if [[ -n "${ref:-}" && -d .git ]]; then
  git fetch --quiet --all
  git checkout --quiet --force "$ref"
fi

docker compose pull --quiet
docker compose up -d --remove-orphans
docker logout "$REGISTRY" >/dev/null 2>&1 || true

log "OK stack=$stack ref=${ref:-none}"
echo "deployed: $stack ${ref:-}"
