#!/usr/bin/env bash
#
# sync-public.sh — автоматическая публикация публичных документов LOVII
#
# Источник правды : lovii_docs/            (этот репозиторий)
# Публичное зеркало: axiiom-ru/lovii        (GitHub Pages, генерит сайт + лендинг)
#
# ПРАВИЛО ВЕРСИЙ (req. пользователя):
#   • версия в источнике ВЫШЕ опубликованной → публикуем как есть, версию не трогаем
#   • версия в источнике РАВНА опубликованной → автор забыл бампнуть:
#       поднимаем версию на 1 уровень (major/minor/patch)
#       в зависимости от объёма изменений (либо принудительно через --level)
#   • версия в источнике НИЖЕ опубликованной  → отказ (защита от понижения версии)
#
# Использование:
#   ./sync-public.sh                  публикация, уровень бампа определяется автоматически
#   ./sync-public.sh --level minor    принудительный уровень бампа (major|minor|patch)
#   ./sync-public.sh --dry-run        только показать решения, без записи и публикации
#   ./sync-public.sh --no-commit      не коммитить бамп версии в lovii_docs
#   ./sync-public.sh --push           после коммита ещё сделать git push в lovii_docs
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_REPO="axiiom-ru/lovii"
LOG_FILE="$ROOT/scripts/sync-public.log"

# локальный_путь | путь_в_публичном_репо | есть_ли_строка_версии(1/0)
FILES=(
  "public/money_flow_public.md|docs/money_flow_public.md|1"
  "public/Публичная_оферта.md|docs/Публичная_оферта.md|1"
  "public/Оферта_присоединения.md|docs/Оферта_присоединения.md|1"
  "public/Политика_обработки_ПД.md|docs/Политика_обработки_ПД.md|1"
  "README.md|README.md|0"
)

DRY_RUN=0
FORCE_LEVEL=""
NO_COMMIT=0
PUSH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)   DRY_RUN=1; shift ;;
    --no-commit) NO_COMMIT=1; shift ;;
    --push)      PUSH=1; shift ;;
    --level)     FORCE_LEVEL="$2"; shift 2 ;;
    --level=*)   FORCE_LEVEL="${1#*=}"; shift ;;
    *) echo "Неизвестный аргумент: $1" >&2; exit 1 ;;
  esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ---------- работа с версиями ----------
ver_to_arr() {
  local IFS='.'
  local p=($1)
  echo "${p[0]:-0} ${p[1]:-0} ${p[2]:-0}"
}
ver_cmp() {
  local a=($(ver_to_arr "$1")) b=($(ver_to_arr "$2"))
  for i in 0 1 2; do
    if   (( ${a[i]:-0} > ${b[i]:-0} )); then echo 1;  return; fi
    if   (( ${a[i]:-0} < ${b[i]:-0} )); then echo -1; return; fi
  done
  echo 0
}
ver_bump() {
  local a=($(ver_to_arr "$1")) lvl="$2"
  local maj=${a[0]:-0} min=${a[1]:-0} pat=${a[2]:-0}
  case "$lvl" in
    major) maj=$((maj+1)); min=0; pat=0 ;;
    minor) min=$((min+1)); pat=0 ;;
    *)     pat=$((pat+1)) ;;
  esac
  echo "$maj.$min.$pat"
}
extract_version() {
  grep -oE '\|\s*\*\*Версия\*\*\s*\|\s*[0-9]+\.[0-9]+(\.[0-9]+)?\s*\|' \
    | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1 || true
}
strip_version_line() { grep -vE '\|\s*\*\*Версия\*\*\s*\|'; }

auto_level() {
  # уровень бампа по объёму изменений тела документа (строка версии исключена)
  local local_file="$1" pub_content="$2" changed
  changed=$(diff <(strip_version_line < "$local_file") <(echo "$pub_content" | strip_version_line) \
              | grep -cE '^[<>]' || true)
  if (( changed <= 5 )); then echo "patch"; else echo "minor"; fi
}

# ---------- публичный репо ----------
PUB_SHA=""; PUB_CONTENT=""
fetch_published() {
  local path="$1" b64
  PUB_SHA="$(gh api "repos/$PUBLIC_REPO/contents/$path" --jq '.sha' 2>/dev/null)" \
    || { echo "ERROR: не удалось загрузить $path (sha)" >&2; return 1; }
  b64="$(gh api "repos/$PUBLIC_REPO/contents/$path" --jq '.content' 2>/dev/null)" \
    || { echo "ERROR: не удалось загрузить $path (content)" >&2; return 1; }
  [[ -n "$b64" ]] || { echo "ERROR: пустой контент $path" >&2; return 1; }
  PUB_CONTENT="$(printf '%s' "$b64" | python3 -c 'import sys,base64;sys.stdout.buffer.write(base64.b64decode(sys.stdin.read().strip()))' 2>/dev/null)"
}

publish() {
  local local_path="$1" repo_path="$2" msg="$3"
  local content b64 tmp_body
  content="$(cat "$ROOT/$local_path")"
  b64="$(printf '%s' "$content" | base64 | tr -d '\n')"
  if (( DRY_RUN )); then
    log "[DRY] PUT $repo_path ($(wc -c <<<"$content") байт) :: $msg"
    return 0
  fi
  fetch_published "$repo_path"   # актуальный sha для PUT
  tmp_body="$(mktemp)"
  printf '{"message":"%s","content":"%s","sha":"%s"}' "$msg" "$b64" "$PUB_SHA" > "$tmp_body"
  gh api "repos/$PUBLIC_REPO/contents/$repo_path" --method PUT \
    --input "$tmp_body" >/dev/null
  rm -f "$tmp_body"
  log "ОПУБЛИКОВАНО $repo_path :: $msg"
}

# ---------- основной цикл ----------
log "=== старт синхронизации lovii_docs → $PUBLIC_REPO ==="
for entry in "${FILES[@]}"; do
  IFS='|' read -r local_path repo_path has_ver <<< "$entry"
  local_file="$ROOT/$local_path"
  [[ -f "$local_file" ]] || { log "ПРОПУСК (нет локально): $local_path"; continue; }
  fetch_published "$repo_path" || { log "ПРОПУСК (ошибка загрузки): $repo_path"; continue; }
  pub_sha="$PUB_SHA"; pub_content="$PUB_CONTENT"

  if [[ "$has_ver" == "1" ]]; then
    local_ver="$(cat "$local_file" | extract_version)"
    pub_ver="$(echo "$pub_content" | extract_version)"
    cmp=$(ver_cmp "$local_ver" "$pub_ver")

    if   (( cmp > 0 )); then
      log "$local_path: версия $local_ver > опубл.$pub_ver → публикуем как есть"
      publish "$local_path" "$repo_path" "docs: синхронизация $local_path ($local_ver) из lovii_docs"
      continue
    elif (( cmp < 0 )); then
      log "ПРОПУСК $local_path: версия источника $local_ver ниже опубликованной $pub_ver (защита от понижения)"
      continue
    fi

    # версии равны — проверяем, изменилось ли тело документа
    if diff -q <(strip_version_line < "$local_file") <(echo "$pub_content" | strip_version_line) >/dev/null; then
      log "БЕЗ ИЗМЕНЕНИЙ $local_path ($local_ver) — пропускаем"
      continue
    fi

    level="${FORCE_LEVEL:-$(auto_level "$local_file" "$pub_content")}"
    new_ver="$(ver_bump "$local_ver" "$level")"
    log "$local_path: версия $local_ver == опубл. → бамп [$level] → $new_ver"
    if (( DRY_RUN )); then
      log "[DRY] бамп $local_path $local_ver → $new_ver и публикация"
      continue
    fi
    sed -i.bak -E 's/(\| \*\*Версия\*\* \| )[0-9]+\.[0-9]+(\.[0-9]+)?( \|)/\1'"$new_ver"'\3/' "$local_file"
    rm -f "$local_file.bak"
    if (( ! NO_COMMIT )); then
      git -C "$ROOT" add "$local_path"
      git -C "$ROOT" -c user.name="Sisyphus" -c user.email="bestdeejay@gmail.com" \
        commit -m "docs: бамп версии $local_path $local_ver → $new_ver" >/dev/null 2>&1 \
        || log "WARN: коммит бампа не удался (возможно, уже закоммичено)"
      log "закоммичен бамп в lovii_docs: $local_path $local_ver → $new_ver"
    fi
    publish "$local_path" "$repo_path" "docs: $local_path $local_ver → $new_ver (авто-публикация из lovii_docs)"
  else
    # файл без версии (README) — синхронизируем, если изменился
    if diff -q "$local_file" <(echo "$pub_content") >/dev/null; then
      log "БЕЗ ИЗМЕНЕНИЙ $local_path — пропускаем"
      continue
    fi
    log "$local_path: изменился → публикуем"
    publish "$local_path" "$repo_path" "docs: синхронизация $local_path из lovii_docs"
  fi
done

if (( PUSH )); then
  git -C "$ROOT" push origin main 2>&1 | tail -3 || log "WARN: push не удался"
fi
log "=== синхронизация завершена ==="
