#!/usr/bin/env bash
# env-parity (R-2.5, из урока F-080): сравнение КЛЮЧЕЙ .env: example vs стенды.
set -u
OUT=""
for d in /opt/lovii-core /opt/lovii-core-staging /opt/lovii-app /opt/lovii-app-staging /opt/lovii-b2b /opt/lovii-b2b-staging /opt/lovii-admin /opt/lovii-admin-staging; do
  [[ -f "$d/.env" ]] || { OUT="$OUT\n$d/.env ОТСУТСТВУЕТ"; continue; }
  ex="$d/.env.example"
  if [[ -f "$ex" ]]; then
    miss=$(comm -23 <(grep -oE "^[A-Z0-9_]+" "$ex" | sort -u) <(grep -oE "^[A-Z0-9_]+" "$d/.env" | sort -u) | tr "\n" " ")
    [[ -n "$miss" ]] && OUT="$OUT\n$d: в .env нет ключей из example: $miss"
  fi
  pair="${d/-staging/}"
  [[ "$d" == *-staging && -f "$pair/.env" ]] && {
    diff_keys=$(comm -3 <(grep -oE "^[A-Z0-9_]+" "$pair/.env" | sort -u) <(grep -oE "^[A-Z0-9_]+" "$d/.env" | sort -u) | awk "{print \$1}" | sort -u | tr "\n" " ")
    [[ -n "$diff_keys" ]] && OUT="$OUT\n$d vs $pair: разные ключи: $diff_keys"
  }
done
if [[ -n "$OUT" ]]; then
  echo -e "$(date -u +%FT%TZ) ENV-PARITY:$OUT" >> "$HOME/backups/env-parity.log"
  exit 1
fi
echo "$(date -u +%FT%TZ) OK" >> "$HOME/backups/env-parity.log"
