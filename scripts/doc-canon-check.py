#!/usr/bin/env python3
"""
doc-canon-check.py — цикл проверки документации LOVII на нестыковки с каноном.

Канон (источник истины): canon/PARAMS.md -> доступный владельцу договор
Т-Банк в workspace/tbank/05_Мультирасчёты... (в свежем клоне может отсутствовать).

Что проверяет:
  1. STALE — устаревшие/неверные числа (НДС 20% вместо 22%, старая эфф. ставка 3,108%,
     старый пул 6,892%, старая модель 3,5%/2,50%).
  2. VERSION — дрейф метки версии money_flow_public (ожидается v2.0.3).
  3. LINKS — битые относительные ссылки на .md внутри репозитория.

Использование:
  python3 scripts/doc-canon-check.py            # скан репозитория
  python3 scripts/doc-canon-check.py --strict   # exit 1 при любой находке

Выход: человекочитаемый отчёт; код возврата 0 если чисто, 1 если есть находки.
Только stdlib, офлайн.
"""
import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # repo root

# Директории для сканирования (относительно корня репозитория)
SCAN_DIRS = ["workspace/docs", "docs", "."]
EXCLUDE_DIRS = {".git", "node_modules", "archive", "__pycache__"}

# 1) Устаревшие/неверные числовые паттерны (канон из PARAMS.md v1.6)
STALE_PATTERNS = [
    ("OLD_CARD_VAT20", r"3[.,]108\s*%", "старая эфф. ставка карты с НДС 20% (канон: 3,16% с НДС 22%)", "high"),
    ("OLD_POOL_VAT20", r"6[.,]892\s*%", "старый пул LOVII с НДС 20% (канон: 6,84%)", "high"),
    ("OLD_VAT20", r"НДС[\s:]*20\s*%", "НДС указан 20% (канон: 22% с 01.01.2026, ФЗ №425-ФЗ)", "high"),
    ("OLD_MODEL_35", r"3[.,]5\s*%", "возможно старая модель 3,5% (проверить контекст; канон иначе)", "low"),
    ("OLD_MODEL_250", r"2[.,]50\s*%", "возможно старая модель 2,50% (проверить контекст)", "low"),
]

# 2) Дрейф версии money_flow_public (канон: v2.0.3)
VERSION_EXPECTED = "2.0.3"
VERSION_RE = re.compile(r"money_flow_public[^\n]{0,120}?v(\d+\.\d+(?:\.\d+)?)", re.IGNORECASE)
VERSION_RE_LOOSE = re.compile(r"v(\d+\.\d+(?:\.\d+)?)", re.IGNORECASE)

# 3) Битые относительные ссылки
LINK_RE = re.compile(r"\]\(([^)]+)\)")
MD_EXT_RE = re.compile(r"\.md(?:#.*)?$", re.IGNORECASE)


def iter_md_files():
    seen = set()
    for base in SCAN_DIRS:
        abs_base = ROOT if base == "." else os.path.join(ROOT, base)
        if not os.path.isdir(abs_base):
            continue
        for dirpath, dirnames, filenames in os.walk(abs_base):
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
            for fn in filenames:
                if fn.lower().endswith(".md"):
                    full = os.path.join(dirpath, fn)
                    if full not in seen:
                        seen.add(full)
                        yield full


def scan_stale(path, text):
    hits = []
    lines = text.splitlines()
    for pid, pat, desc, sev in STALE_PATTERNS:
        for m in re.finditer(pat, text):
            line = text.count("\n", 0, m.start()) + 1
            # Historical audit rows and explicitly documented variants may
            # mention an old value without asserting it as current canon.
            if 0 < line <= len(lines) and "doc-canon: historical" in lines[line - 1]:
                continue
            hits.append((pid, sev, line, m.group(0).strip(), desc))
    return hits


def scan_versions(path, text):
    hits = []
    for m in VERSION_RE.finditer(text):
        ver = m.group(1)
        line = text.count("\n", 0, m.start()) + 1
        hits.append((line, ver))
    return hits


def scan_links(path, text):
    broken = []
    base_dir = os.path.dirname(path)
    for m in LINK_RE.finditer(text):
        target = m.group(1).strip()
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        if not MD_EXT_RE.search(target):
            continue
        # убираем якорь
        clean = target.split("#")[0]
        if not clean:
            continue
        if os.path.isabs(clean):
            resolved = clean
        else:
            resolved = os.path.normpath(os.path.join(base_dir, clean))
        if not os.path.exists(resolved):
            line = text.count("\n", 0, m.start()) + 1
            broken.append((line, target))
    return broken


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="exit 1 при находках")
    args = ap.parse_args()

    total_stale = total_ver = total_links = 0
    all_findings = []
    files_checked = 0

    print("=" * 78)
    print("LOVII DOC CONSISTENCY CHECK — канон: canon/PARAMS.md / Договор Т-Банк")
    print("=" * 78)

    for path in sorted(iter_md_files()):
        files_checked += 1
        rel = os.path.relpath(path, ROOT)
        text = ""
        try:
            with open(path, encoding="utf-8") as f:
                text = f.read()
        except Exception as e:
            print(f"[skip] {rel}: {e}")
            continue

        stale = scan_stale(path, text)
        vers = scan_versions(path, text)
        links = scan_links(path, text)

        if not (stale or vers or links):
            continue

        print(f"\n### {rel}")
        for pid, sev, line, match, desc in stale:
            total_stale += 1
            all_findings.append((rel, "STALE", sev, line, f"{match} — {desc}"))
            print(f"  [STALE/{sev}] L{line}: {match} — {desc}")
        for line, ver in vers:
            if ver != VERSION_EXPECTED:
                total_ver += 1
                all_findings.append((rel, "VERSION", "med", line,
                                      f"money_flow_public указана как v{ver} (канон: v{VERSION_EXPECTED})"))
                print(f"  [VERSION/med] L{line}: money_flow_public v{ver} (канон v{VERSION_EXPECTED})")
        for line, target in links:
            total_links += 1
            all_findings.append((rel, "LINK", "med", line, f"битая ссылка: {target}"))
            print(f"  [LINK/med] L{line}: битая ссылка: {target}")

    print("\n" + "=" * 78)
    print(f"ИТОГО: STALE={total_stale}  VERSION_DRIFT={total_ver}  BROKEN_LINKS={total_links}")
    print(f"Проверено файлов: {files_checked}")
    print("=" * 78)

    if args.strict and (total_stale or total_ver or total_links):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
