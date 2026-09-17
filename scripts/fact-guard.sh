#!/usr/bin/env bash
# fact-guard.sh — обёртка обратной совместимости для scripts/fact_guard.py
# По DOCS_GUIDELINES.md §9.1
#
# Реализация перенесена в scripts/fact_guard.py (Python, без субпроцессов):
# shell-версия на массовых per-line `echo | grep -q` пайплайнах была
# недетерминированной в среде исполнения (разные счётчики violations на одном
# дереве, разовые пропуски file-level white-list, зависания) — а гейт
# блокирующий. Контракт сохранён:
#
# Exit codes:
#   0 — clean (нет violations)
#   1 — есть violations (коммит/CI блокируется)
#   2 — ошибка запуска (включая нестабильное чтение файла)
#
# Смоук-тест детерминизма: python3 scripts/fact_guard.py --determinism

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "${SCRIPT_DIR}/fact_guard.py" "$@"
