#!/usr/bin/env python3
"""
DEPRECATED — НЕ ИСПОЛЬЗОВАТЬ.

Этот скрипт устарел после ручной реорганизации репозитория (2026-08-29).
REGISTRY.md теперь ведётся вручную. Запуск скрипта перезапишет REGISTRY
устаревшим сгенерированным содержимым.

Если скрипт всё же нужен — сначала обнови его под актуальную структуру.

---
gen_registry.py — генератор REGISTRY.md для репозитория lovii_docs.

Обходит дерево репозитория и пересобирает единый реестр документов:
  - дерево верхнеуровневых папок с их описаниями;
  - для каждой папки — таблица файлов (имя, описание, формат).

Описания папок берутся из FOLDER_META (ниже). Описания файлов — из
README.txt внутри папки (если есть) либо из FILE_DESCRIPTIONS.
Всё остальное (формат, наличие подпапок) вычисляется из файловой системы,
поэтому реестр не «протухает» при добавлении/переименовании файлов.

Только стандартная библиотека Python 3. Запуск:
    python3 scripts/gen_registry.py
"""

from __future__ import annotations

import datetime
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# --- Конфигурация ---------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent

# Папки, которые не трогаем (системные / сгенерированные / бинарные копии)
EXCLUDE_DIRS = {
    ".git", ".opencode", ".omo", ".playwright-mcp", ".visual-qa",
    ".codegraph", "node_modules", "lovii_presentation_clone",
    ".DS_Store", "__pycache__",
}

# Файлы, которые не попадают в реестр
EXCLUDE_FILES = {
    ".DS_Store", "REGISTRY.md", "package.json", "package-lock.json",
    "tsconfig.json", "tsconfig.node.json", ".gitignore",
}

# Порядок и человекочитаемые описания верхнеуровневых папок
FOLDER_META: Dict[str, Tuple[str, str]] = {
    "tbank": (
        "Документы для Т-Банка",
        "Комплект для подключения эквайринга (МПС, мультирасчёты): анкета, "
        "презентация продукта, оферты, согласования, скриншоты приложения.",
    ),
    "soba": (
        "Презентации SOBA",
        "Презентации для инвесторов и поставщиков, шаблон партнёрского "
        "соглашения, QA-скриншоты.",
    ),
    "contracts": (
        "Оферты и контракты",
        "Публичные оферты, оферты присоединения, согласования, анкеты "
        "(Markdown + Pages).",
    ),
    "financial": (
        "Финансовая модель",
        "Финмодель (CSV, XLSX, DOCX), структура доходных статей, расчёты "
        "юнит-экономики.",
    ),
    "docs": (
        "Основная документация",
        "Архитектура, PRD, дизайн, финмодель (MD), PARAMS, контекст проекта, "
        "юридическая структура.",
    ),
    "assets": (
        "Ассеты",
        "OCR-тексты, картинки из PDF, скриншоты поставщиков, справочники "
        "Т-Банка, извлечённые медиа.",
    ),
    "archive": (
        "Архив",
        "Старые версии схем, черновики, неактуальные материалы (сохранены "
        "как историческая справка).",
    ),
    "presentations": (
        "Презентации (HTML)",
        "Исходники HTML-лендинга презентаций платформы.",
    ),
    "scripts": (
        "Скрипты",
        "Вспомогательные скрипты: генерация реестра, отладка API.",
    ),
    "chats": (
        "Экспорты чатов",
        "Выгрузки переписок и сводки обсуждений проекта.",
    ),
}

# Кураторские описания ключевых документов (relative path от ROOT)
FILE_DESCRIPTIONS: Dict[str, str] = {
    "docs/PARAMS.md": "Единый источник истины по параметрам проекта "
                      "(комиссии, сплит, роли, юнит-экономика).",
    "docs/FINANCIAL_MODEL.md": "Каноническая финмодель v2.1 — контур участников "
                             "и денежных потоков, юнит-экономика, год 1, годы 2–5, "
                             "финансирование, франшиза, история корректировок.",
    "docs/LOVII_Financial_Model_Parametric.xlsx": "Параметрическая финмодель (XLSX): "
                             "редактируемые синие ячейки вводов, юнит-экономика, "
                             "год 1 по месяцам, годы 2–5, точка безубыточности, "
                             "сетка чувствительности. Зеркало FINANCIAL_MODEL.md v2.2 (PRO исключён из прогноза; вернуть через ячейки pro_conv на листе Inputs).",
    "docs/PROJECT_CONTEXT.md": "Контекст проекта: модель доходов, сплит, роли.",
    "docs/money_flow_public.md": "Публичная схема движения средств.",
    "contracts/Публичная_оферта_LOVII.md": "Публичная оферта для Покупателей "
                                           "(физлиц).",
    "financial/доходные статьи.txt": "Полная структура доходных статей проекта.",
    "scripts/gen_registry.py": "Генератор данного реестра (REGISTRY.md).",
}

FOLDER_ORDER = list(FOLDER_META.keys())

# Читаемые названия форматов по расширению
FORMAT_LABELS = {
    ".md": "MD", ".txt": "TXT", ".pdf": "PDF", ".docx": "DOCX",
    ".doc": "DOC", ".pages": "Pages", ".csv": "CSV", ".xlsx": "XLSX",
    ".json": "JSON", ".ts": "TS", ".js": "JS", ".png": "PNG",
    ".jpg": "JPG", ".jpeg": "JPG", ".webp": "WEBP", ".svg": "SVG",
    ".html": "HTML", ".htm": "HTML", ".zip": "ZIP", ".pptx": "PPTX",
    ".key": "Keynote",
}


# --- Логика ---------------------------------------------------------------

def fmt_label(path: Path) -> str:
    if path.is_dir():
        return "DIR"
    return FORMAT_LABELS.get(path.suffix.lower(), path.suffix.lstrip(".").upper() or "—")


def parse_readme(folder: Path) -> Dict[str, str]:
    """Извлечь описания файлов из README.txt внутри папки.

    Поддерживаемый формат (как в tbank/README.txt):
        `имя_файла.ext`            — заголовок
          — описание (отступ)      — продолжение
    либо `имя_файла.ext — описание` в одну строку.
    """
    readme = folder / "README.txt"
    if not readme.is_file():
        return {}
    try:
        lines = readme.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return {}

    result: Dict[str, str] = {}
    cur_key: Optional[str] = None
    cur_desc: List[str] = []

    def flush():
        if cur_key is not None:
            result[cur_key] = " ".join(x.strip() for x in cur_desc if x.strip())

    # Файл с расширением ИЛИ директория (имя, заканчивающееся на /)
    fname_re = re.compile(
        r"^\s*("
        r"[\w\-. а-яА-ЯёЁ]+?\.(?:pdf|docx|doc|md|txt|csv|xlsx|png|json|ts|pages|webp|jpg|jpeg|html|zip|pptx|key)"
        r"|"
        r"[\w\-. а-яА-ЯёЁ]+?/"
        r")",
        re.IGNORECASE,
    )
    for line in lines:
        m = fname_re.match(line)
        if m:
            flush()
            cur_key = m.group(1).strip()
            # текст после имени в той же строке (после — или :)
            rest = line[m.end():]
            rest = re.sub(r"^[\s]*[—:–-]\s*", "", rest).strip()
            cur_desc = [rest] if rest else []
        elif cur_key is not None and line.startswith((" ", "\t")):
            txt = re.sub(r"^[\s]*[—:–-]\s*", "", line).strip()
            if txt:
                cur_desc.append(txt)
        else:
            # не относится к текущему файлу
            flush()
            cur_key = None
            cur_desc = []
    flush()
    return result


def describe_file(rel_path: Path, readme_map: Dict[str, str]) -> str:
    key = str(rel_path).replace("\\", "/")
    for k, v in FILE_DESCRIPTIONS.items():
        if k.lower() == key.lower():
            return v
    # поиск по имени файла в README.txt папки
    name = rel_path.name
    if name in readme_map:
        return readme_map[name]
    # поиск по базовому имени (без расширения) — для 'Скриншоты_приложения/'
    base = rel_path.stem
    for k, v in readme_map.items():
        if k.rstrip("/").lower() == base.lower():
            return v
    return ""


def list_folder(folder: Path) -> List[Path]:
    items: List[Path] = []
    for p in sorted(folder.iterdir(), key=lambda x: (x.is_file(), x.name.lower())):
        if p.name in EXCLUDE_FILES or p.name in EXCLUDE_DIRS:
            continue
        if p.name.startswith("."):
            continue
        items.append(p)
    return items


def render_tree() -> str:
    lines = ["lovii_docs/"]
    n = len(FOLDER_ORDER)
    for i, name in enumerate(FOLDER_ORDER):
        if not (ROOT / name).is_dir():
            continue
        branch = "├──" if i < n - 1 else "└──"
        desc = FOLDER_META.get(name, ("", ""))[1]
        # обрезаем описание до короткой строки для дерева
        short = desc.split(". ")[0].rstrip(".") + ("." if "." not in desc.split(". ")[0] else "")
        lines.append(f"{branch} {name}/".ljust(20) + f"— {short}")
    return "\n".join(lines)


def render_folder_section(name: str) -> str:
    folder = ROOT / name
    title, desc = FOLDER_META.get(name, (name, ""))
    out: List[str] = []
    out.append(f"## {name}/ — {title}\n")
    if desc:
        out.append(f"{desc}\n")
    out.append("| Файл | Описание | Формат |")
    out.append("|:---|:---|:---|")

    readme_map = parse_readme(folder)
    items = list_folder(folder)
    if not items:
        out.append("| _(пусто)_ | — | — |")
    for p in items:
        rel = p.relative_to(ROOT)
        label = fmt_label(p)
        if p.is_dir():
            count = sum(1 for _ in p.rglob("*") if _.is_file())
            desc_text = describe_file(rel, readme_map) or f"Подпапка ({count} файлов)"
            out.append(f"| `{p.name}/` | {desc_text} | DIR ({count}) |")
        else:
            desc_text = describe_file(rel, readme_map) or ""
            out.append(f"| `{p.name}` | {desc_text} | {label} |")
    out.append("")
    return "\n".join(out)


def main() -> None:
    today = datetime.date.today().strftime("%Y-%m-%d")
    parts: List[str] = []
    parts.append("# Реестр документов LOVII\n")
    parts.append(
        f"> Сгенерировано автоматически {today}. Единый источник истины "
        "по расположению файлов.\n"
        "> Перегенерация: `python3 scripts/gen_registry.py`\n"
    )
    parts.append("---\n")
    parts.append("## Структура репозитория\n")
    parts.append("```")
    parts.append(render_tree())
    parts.append("```\n")
    parts.append("---\n")

    for name in FOLDER_ORDER:
        if not (ROOT / name).is_dir():
            continue
        parts.append(render_folder_section(name))
        parts.append("---\n")

    # убираем последний лишний разделитель
    text = "".join(parts).rstrip() + "\n"

    out_path = ROOT / "REGISTRY.md"
    out_path.write_text(text, encoding="utf-8")
    print(f"REGISTRY.md обновлён: {out_path}")
    print(f"Папок в реестре: {sum(1 for n in FOLDER_ORDER if (ROOT/n).is_dir())}")


if __name__ == "__main__":
    main()
