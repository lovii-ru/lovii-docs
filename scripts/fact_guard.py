#!/usr/bin/env python3
"""fact_guard.py — детерминированная проверка дублирования числовых параметров.

Порт scripts/fact-guard.sh на Python (DOCS_GUIDELINES.md §9.1). Причина порта:
shell-версия на массовых per-line ``echo | grep -q`` пайплайнах вёл себя
недетерминированно в среде исполнения (разные счётчики violations на одном
дереве, разовые пропуски file-level white-list, зависания), при этом гейт
является блокирующим. Python-версия не порождает субпроцессов, читает каждый
файл с повторной верификацией и обходит дерево в отсортированном порядке.

Логика (паритет с shell-версией):
- сканируются ``*.md`` в ``canon/`` (кроме ``canon/TASKS/`` — их проверяет
  ``scripts/task_guard.py``) и в корне репозитория;
- пропускаются канон-домены (по имени файла): PARAMS.md, FINANCIAL_MODEL.md,
  money_flow_public.md;
- пропускаются пути, содержащие ``archive/``, ``.lra/``;
- file-level white-list: ``fact-guard: allow`` в первых 10 строках файла;
- line-level white-list: строки, содержащие ``fact-guard: allow``;
- пропускаются пустые строки и markdown-заголовки (``#{1,6} ``).

Exit codes:
  0 — clean (нет violations)
  1 — есть violations (коммит/CI блокируется)
  2 — ошибка запуска (включая нестабильное чтение файла)

Режим ``--determinism`` прогоняет скан дважды и требует идентичного результата
(смоук-тест среды; exit 2 при расхождении прогонов).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Канон-домены (иммунизированные файлы — числа здесь разрешены), по имени файла
CANON_DOMAINS = {"PARAMS.md", "FINANCIAL_MODEL.md", "money_flow_public.md"}

ALLOW_MARK = "fact-guard: allow"
HEADING_RE = re.compile(r"^#{1,6} ")
NUMBER_RE = re.compile(
    "|".join(
        [
            r"[0-9]+[,.]?[0-9]*%",      # проценты (10%, 3,16%, 4-7%)
            r"[0-9]+ [0-9]* ₽",          # рубли с пробелом (2 990 ₽)
            r"[0-9]+ ₽",                 # рубли без пробела (599 ₽)
            r"[0-9]+ млн ₽",             # миллионы (15 млн ₽)
            r"[0-9]+ млрд ₽",            # миллиарды
            r"[0-9]+[,.]?[0-9]* мес",    # абонентка (2 990 ₽/мес)
        ]
    )
)


def read_verified(path: Path, attempts: int = 3) -> bytes:
    """Читает файл с повторной верификацией (защита от флака страниц памяти).

    Дважды читает байты и сравнивает; при расхождении — повторяет до attempts
    раз; если согласованное чтение не получено — IOError (exit 2 у вызывающего).
    """
    data = path.read_bytes()
    for _ in range(attempts - 1):
        again = path.read_bytes()
        if again == data:
            return data
        data = again
    if path.read_bytes() != data:
        raise IOError(f"нестабильное чтение файла: {path}")
    return data


def iter_targets() -> list[Path]:
    """Все *.md к сканированию: canon/ (кроме TASKS/) + корень; отсортировано."""
    files: list[Path] = []
    canon = ROOT / "canon"
    if canon.is_dir():
        files.extend(p for p in canon.rglob("*.md") if p.is_file())
    files.extend(p for p in ROOT.glob("*.md") if p.is_file())

    targets: list[Path] = []
    for path in sorted(set(files)):
        rel = path.relative_to(ROOT).as_posix()
        if "archive/" in rel or ".lra/" in rel:
            continue
        if "canon/TASKS/" in rel:
            continue  # рабочий класс W — структура проверяет scripts/task_guard.py
        if path.name in CANON_DOMAINS:
            continue
        if "fact-guard.sh" in rel or ".gitignore" in rel:
            continue
        targets.append(path)
    return targets


def scan_file(path: Path) -> list[tuple[str, int, str]]:
    rel = path.relative_to(ROOT).as_posix()
    lines = read_verified(path).decode("utf-8", errors="replace").splitlines()

    # File-level white-list: якорь в первых 10 строках — файл пропущен целиком
    if any(ALLOW_MARK in line for line in lines[:10]):
        return []

    violations: list[tuple[str, int, str]] = []
    for lineno, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        if ALLOW_MARK in line:
            continue
        if HEADING_RE.match(line):
            continue
        if NUMBER_RE.search(line):
            text = line.strip()
            if len(text) > 120:
                text = text[:120]
            violations.append((rel, lineno, text))
    return violations


def run_scan() -> list[tuple[str, int, str]]:
    all_violations: list[tuple[str, int, str]] = []
    for path in iter_targets():
        all_violations.extend(scan_file(path))
    return all_violations


def print_report(violations: list[tuple[str, int, str]]) -> None:
    if not violations:
        print("🟢 fact-guard: clean — no violations found")
        return
    print(f"🔴 fact-guard: {len(violations)} potential violation(s) found")
    print()
    print("Красный список (коммит блокируется до классификации и исправления):")
    print("---")
    for rel, lineno, text in violations:
        print(f"  • {rel}:{lineno}: {text}")
    print("---")
    print()
    print("Как читать:")
    print("  • Строка с числом в не-канонном файле — проверь, не дублирует ли она PARAMS.md")
    print("  • Если это white-list копия (README.md) — добавь <!-- fact-guard: allow -->")
    print("  • Если это производный документ — замени число ссылкой на PARAMS.md §...")
    print()
    print("❌ Красный список блокирует коммит: исправь копию, добавь узкое обоснованное исключение или зафиксируй находку.")


def main() -> int:
    try:
        if "--determinism" in sys.argv[1:]:
            first = run_scan()
            second = run_scan()
            if first != second:
                print(f"❌ fact-guard determinism: прогоны различаются ({len(first)} vs {len(second)}) — среда нестабильна")
                return 2
            print(f"🟢 fact-guard determinism: два прогона идентичны (violations: {len(first)})")
            return 0
        violations = run_scan()
        print_report(violations)
        return 1 if violations else 0
    except Exception as exc:  # ошибка запуска
        print(f"❌ fact-guard: ошибка запуска: {exc}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
