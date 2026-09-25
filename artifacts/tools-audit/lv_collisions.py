#!/usr/bin/env python3
"""lv_collisions.py — фатальные let/const/class-коллизии между классическими скриптами lovii-demo.

Все js/*.js демо грузятся в один window-скоуп (классические <script> без модулей).
Дубликат let/const/class c одним именем в двух файлах = SyntaxError при загрузке
(страница мертва); дубликат function/var = тихое перекрытие (риск).

Выход: отчёт в stdout; exit 1 — если есть фатальные коллизии, 0 — иначе.
Использование: python3 lv_collisions.py /путь/к/lovii-demo
"""
import re
import sys
from pathlib import Path

# Только top-level декларации (колонка 0): в классических скриптах это глобальная
# область. let/const/class внутри функций — другая область, коллизией не является.
DECL_FATAL = re.compile(r"^(?:let|const|class)\s+([A-Za-z_$][\w$]*)", re.M)
DECL_SOFT = re.compile(r"^(?:var|function\*?)\s+([A-Za-z_$][\w$]*)", re.M)
DECL_SOFT_ASYNC = re.compile(r"^async\s+function\*?\s+([A-Za-z_$][\w$]*)", re.M)


def scan(root: Path):
    fatal, soft = {}, {}
    js_files = sorted(root.glob("js/*.js")) + [root / "sw.js"]
    for f in js_files:
        if not f.exists():
            continue
        text = f.read_text(encoding="utf-8", errors="replace")
        # вырезаем строковые литералы и комментарии, чтобы не ловить ложные
        text = re.sub(r"`(?:[^`\\]|\\.)*`", "``", text)
        text = re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", text)
        text = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', text)
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
        text = re.sub(r"//[^\n]*", "", text)
        rel = f.relative_to(root)
        for m in DECL_FATAL.finditer(text):
            fatal.setdefault(m.group(1), []).append(rel)
        for m in list(DECL_SOFT.finditer(text)) + list(DECL_SOFT_ASYNC.finditer(text)):
            soft.setdefault(m.group(1), []).append(rel)
    return fatal, soft


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    fatal, soft = scan(root)
    print(f"lv_collisions: скан {root.name} (классические скрипты в общем window-скоупе)")

    fat = {k: v for k, v in fatal.items() if len(v) > 1}
    sof = {k: v for k, v in soft.items() if len(v) > 1}

    if fat:
        print(f"\nФАТАЛЬНО (let/const/class дублируются между файлами): {len(fat)}")
        for name, files in sorted(fat.items()):
            print(f"  ✗ {name}: {', '.join(map(str, files))}")
    else:
        print("Фатальных коллизий (let/const/class): 0")

    if sof:
        print(f"\nПЕРЕКРЫТИЯ (function/var — перезапись, не падение): {len(sof)}")
        for name, files in sorted(sof.items()):
            print(f"  ⚠ {name}: {', '.join(map(str, files))}")
    else:
        print("Перекрытий function/var между файлами: 0")

    sys.exit(1 if fat else 0)


if __name__ == "__main__":
    main()
