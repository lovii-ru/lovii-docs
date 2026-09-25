# 2026-09-25-sz077-transfer-design — дизайн-пакет экрана «Перевод»

Пакет постановки и проектирования для задачи
[`SZ-077`](../../canon/TASKS/SZ-077-transfer-screen-and-single-node.md) и блока «Кошелёк» в
`SZ-076`. Всё, что нужно, чтобы вернуться к решениям, а не искать их в переписке.

## Что в пакете

| Файл | Что это |
|---|---|
| `docs/domain-analysis.html` | Разбор домена переводов: матрица направлений, типы транзакций, путь через транзитный номинал, дизайн чарджбэк-аналога, решения владельца 25.09 |
| `docs/TZ-transfer-screen.md` / `.html` | ТЗ для кодера: паспорт, точные файлы, три проверки, инвариант транзита, детектор обхода, гейты, список обходных путей |
| `docs/TASK-template.md` + `docs/task-spec-rules.html` | Шаблон ТЗ под любой экран и правила его заполнения |
| `docs/screen-passport.html` | Паспорт экрана «Перевод» в витрине: состав, проверка, найденные дефекты |
| `docs/delivery-pipeline.html` | Конвейер: demo → локальный стенд → staging; кто что делает, поток на экран вперёд |
| `screens/transfer4-*.png` | Кадры эталона (витрина `#/transfer`) на 390 и 1280 |

## Как снято

Витрина `lovii-demo` (master + коммит эталона), локально через `python -m http.server`,
Chrome/Playwright, светлая тема. Кадры приложения и их сверка — в пакете исполнителя
`2026-09-25-sz077-deliverables/`.

## Ссылки

- Карточка задачи: `canon/TASKS/SZ-077-transfer-screen-and-single-node.md`
- Пакет отчёта исполнителя: `artifacts/2026-09-25-sz077-deliverables/`
- Session-доки репозиториев: `lovii-app/docs/sessions/131-*`, `lovii-core/docs/sessions/061-*`, `lovii-admin/docs/sessions/011-*`
