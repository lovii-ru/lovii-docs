#!/usr/bin/env bash
# R-3.5/A-17: месячная сводка деплоев и доступов
M=$(date -u -d "last month" +%Y-%m 2>/dev/null || date -u -v-1m +%Y-%m)
OUT="$HOME/backups/ci-summary-$M.txt"
{
echo "=== Деплои за $M (lovii-deploy) ==="
grep "$M" ~/lovii-deploy.log 2>/dev/null | grep -E "OK|FAIL" | tail -50
echo "=== DENY (попытки обхода) ==="
grep "$M" ~/lovii-deploy.log 2>/dev/null | grep DENY | tail -20
echo "=== gostiny-deploy ==="
grep "$M" /var/log/gostiny-deploy.log 2>/dev/null | grep -E "OK|DENY" | tail -20
echo "=== Логины по ключам (last) ==="
last -s "$(date -d "31 days ago" +%Y-%m-%d 2>/dev/null || date -v-31d +%Y-%m-%d)" 2>/dev/null | head -30
echo "=== authorized_keys diff от 05.10 ==="
diff ~/backups/authorized_keys-snapshot ~/.ssh/authorized_keys 2>/dev/null || true
} > "$OUT" 2>&1
cp ~/.ssh/authorized_keys ~/backups/authorized_keys-snapshot
echo "$(date -u +%FT%TZ) summary=$OUT" >> ~/backups/ci-summary.log
