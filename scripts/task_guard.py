#!/usr/bin/env python3
"""Проверка структуры карточек задач и правил их размещения.

Проверяет только governance-структуру, а не содержание продуктовых требований:
- ID filename == ID первого H1;
- уникальность активных ID и отсутствие повторного использования архивных ID;
- допустимый статус и запрет финальных статусов в canon/TASKS;
- архивный баннер и финальный статус в archive/tasks;
- обязательные признаки отчёта/приёмки для архивной карточки;
- отсутствие живых Markdown-ссылок из активного корпуса на archive/.

Суффикс ``B`` поддерживается как часть ID (например, SZ-013B) для явной
нормализации коллизий. Скрипт использует только stdlib и запускается из любого
каталога внутри репозитория.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ACTIVE_DIR = ROOT / "canon" / "TASKS"
ARCHIVE_DIR = ROOT / "archive" / "tasks"

ID_PATTERN = r"(?:SZ|T)-\d{3}(?:B)?"
FILENAME_ID_RE = re.compile(rf"^(?P<id>{ID_PATTERN})(?=-|$)")
H1_RE = re.compile(rf"^#\s+(?P<id>{ID_PATTERN})(?=$|[\s—–:-])", re.MULTILINE)
STATUS_RE = re.compile(
    r"Статус\s*:\s*(?:\*\*)?"
    r"(?P<status>Открыта|В работе|На приёмке|Закрыта|Заменена|Отменена)"
    r"(?:\*\*)?",
    re.IGNORECASE,
)
OLD_STATUS_RE = re.compile(
    r"Статус\s*:\s*(?:\*\*)?"
    r"(?:Реализация выполнена|Рес[её]рч выполнен|Выдана|выдана|"
    r"Фаза\s+[^\n]*принята|жд[уё]т\s+при[её]мки)",
    re.IGNORECASE,
)
LINK_RE = re.compile(r"\]\(([^)]+)\)")
ALLOWED_STATUSES = {"Открыта", "В работе", "На приёмке", "Закрыта", "Заменена", "Отменена"}
FINAL_STATUSES = {"Закрыта", "Заменена", "Отменена"}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def filename_id(path: Path) -> str | None:
    match = FILENAME_ID_RE.match(path.name)
    return match.group("id") if match else None


def header_id(text: str) -> str | None:
    match = H1_RE.search(text)
    return match.group("id") if match else None


def status(text: str) -> str | None:
    match = STATUS_RE.search(text[:12000])
    return match.group("status").capitalize() if match else None


def has_report(text: str) -> bool:
    return bool(re.search(r"Отч[её]т|Факт-чек", text, re.IGNORECASE))


def has_acceptance(text: str) -> bool:
    return bool(
        re.search(
            r"При[её]мка|Вердикт\s*:\s*.?Достаточно|\bДостаточно\b|"
            r"закрыт[ао]?\s+решени[ея]м\s+владельц",
            text,
            re.IGNORECASE,
        )
    )


def check_task_file(path: Path, archive: bool, errors: list[str], warnings: list[str]) -> tuple[str | None, str | None]:
    try:
        text = read(path)
    except UnicodeDecodeError as exc:
        errors.append(f"{rel(path)}: UTF-8 read failed: {exc}")
        return None, None

    file_id = filename_id(path)
    h1_id = header_id(text)
    if not file_id:
        errors.append(f"{rel(path)}: filename does not start with a task ID")
    if not h1_id:
        errors.append(f"{rel(path)}: first task H1 with ID is missing")
    if file_id and h1_id and file_id != h1_id:
        errors.append(f"{rel(path)}: filename ID {file_id} != H1 ID {h1_id}")

    current_status = status(text)
    if not current_status:
        if OLD_STATUS_RE.search(text[:12000]):
            errors.append(f"{rel(path)}: legacy status wording; use one of {', '.join(sorted(ALLOWED_STATUSES))}")
        else:
            errors.append(f"{rel(path)}: canonical 'Статус:' is missing or invalid")
    elif current_status not in ALLOWED_STATUSES:
        errors.append(f"{rel(path)}: invalid status {current_status!r}")

    if archive:
        first_line = text.splitlines()[0] if text.splitlines() else ""
        if "АРХИВ" not in first_line.upper() or not re.search(r"не\s+.*(?:источник|авторитет)", first_line, re.IGNORECASE):
            errors.append(f"{rel(path)}: first line must be an archive warning")
        if current_status not in FINAL_STATUSES:
            errors.append(f"{rel(path)}: archive card must have final status, got {current_status!r}")
        if not has_report(text):
            warnings.append(f"{rel(path)}: archive card has no recognizable executor report heading")
        if not has_acceptance(text):
            warnings.append(f"{rel(path)}: archive card has no recognizable acceptance/verdict")
    else:
        if current_status in FINAL_STATUSES:
            errors.append(
                f"{rel(path)}: final status {current_status} is forbidden in canon/TASKS; "
                "move the card to archive/tasks/"
            )
        if OLD_STATUS_RE.search(text[:12000]):
            errors.append(f"{rel(path)}: legacy final wording remains in the status field")
        if current_status == "На приёмке" and not has_report(text):
            warnings.append(f"{rel(path)}: На приёмке without a recognizable executor report")

    return file_id, current_status


def check_archive_links(errors: list[str]) -> None:
    for path in ROOT.rglob("*.md"):
        if ".git" in path.parts or "archive" in path.parts:
            continue
        try:
            text = read(path)
        except UnicodeDecodeError:
            continue
        for match in LINK_RE.finditer(text):
            target = match.group(1).strip().split("#", 1)[0]
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            if "archive/" in target or target.startswith("archive"):
                line = text.count("\n", 0, match.start()) + 1
                errors.append(f"{rel(path)}:{line}: live Markdown link to archive is forbidden: {target}")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    active_ids: dict[str, Path] = {}
    archive_ids: dict[str, Path] = {}

    active_files = sorted(p for p in ACTIVE_DIR.glob("*.md") if p.name != "README.md") if ACTIVE_DIR.is_dir() else []
    archive_files = sorted(ARCHIVE_DIR.glob("*.md")) if ARCHIVE_DIR.is_dir() else []

    for path in active_files:
        task_id, _ = check_task_file(path, archive=False, errors=errors, warnings=warnings)
        if task_id:
            if task_id in active_ids:
                errors.append(f"duplicate active ID {task_id}: {rel(active_ids[task_id])} and {rel(path)}")
            else:
                active_ids[task_id] = path

    for path in archive_files:
        task_id, _ = check_task_file(path, archive=True, errors=errors, warnings=warnings)
        if task_id:
            if task_id in archive_ids:
                errors.append(f"duplicate archive ID {task_id}: {rel(archive_ids[task_id])} and {rel(path)}")
            else:
                archive_ids[task_id] = path

    for task_id in sorted(set(active_ids) & set(archive_ids)):
        errors.append(
            f"ID {task_id} is reused in active and archive cards: "
            f"{rel(active_ids[task_id])} / {rel(archive_ids[task_id])}"
        )

    check_archive_links(errors)

    for warning in warnings:
        print(f"⚠️  {warning}")
    for error in errors:
        print(f"❌ {error}")

    if errors:
        print(f"🔴 task-governance: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1

    print(
        f"🟢 task-governance: clean — active={len(active_files)}, "
        f"archive={len(archive_files)}, IDs={len(active_ids) + len(archive_ids)}"
    )
    if warnings:
        print(f"Warnings: {len(warnings)} (non-blocking; review before closing cards)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
