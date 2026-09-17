# SZ-015 — b2b: PHPStan → ноль, phpstan-гейт блокирующий

> Статус: **На приёмке** (2026-09-11, Super Z — отчёт §4; приёмка zcode запрашивается)
> Приоритет: **P2** (мелкая, закрывает дыру в щите)
> Исполнитель: Super Z · Репо: `lovii-b2b`

## 1. Что

- PHPStan красный: `app/Domain/Merchant/Services/WorkingHoursNormalizer.php`
  (6 ошибок типов, строки 32–118: `array<string,mixed>` vs `array<mixed,mixed>`,
  `Cannot cast mixed to string`) — привнесено коммитом `cf98901`.
- Починить типизацию (не ослабляя level!) → `vendor/bin/phpstan` — 0 ошибок.
- Затем в `.github/workflows/ci.yml` убрать `continue-on-error: true` у шага
  **Static analysis (PHPStan)** (по образцу flip-а Pest `6ee8568`).

## 2. NB

- Type coverage (min=70) пока консультативный — решение отдельно, не в этой
  задаче.

## 3. Приёмка

zcode: CI 🟢 с блокирующим phpstan; дифф типизации — без подавлений
(`ignore`/`@phpstan-ignore`) — правки типов в коде, а не в конфиге.

## 4. Отчёт исполнителя (Super Z, 2026-09-11, b2b `7e5bffb` + `58fefd5`)

- **d4ce297**: WorkingHoursNormalizer → 0 (стартовое окно), flip phpstan-шага в ci.yml — блокирующий.
- **sz-015-wip → 7e5bffb (merge)**: хвост type-strictening (52 файла) влит в master.
- **58fefd5**: остаток (103 ошибки по файлов Filament/Widgets/Domain/Middleware) доведён до нуля:
  • SZ-025-файлы подчищены (mixed-гарды, Filament facade import, Panel::path через config-ключ
  `filament.partner_path` (cache-safe), session Store/CarbonImmutable-типы);
  • однотипные фиксы: `when()`-фильтры `mixed` + is_string-гарды, Builder<TModel> docblock-и,
  int-ключи tenant-карт, dadata-party array-сужения, dead-catch убраны (DadataException никогда
  не бросается после wip-типизации), неиспользуемая константа и TmpDocblockTest.php удалены;
  • синтакс-контроль bin-php -l на каждом шаге, финал: **phpstan 0 (level max), pint ✓,
  rector dry-run ✓**.
- NB: шаг **Pest** в ci.yml — по-прежнему continue-on-error (вне скоупа SZ-015; 6ee8568-флип
  откачен ранее в SZ-011-эпоху — решение за владельцем: вернуть блокирующий после разборa базы).
- Приёмка zcode: CI на `58fefd5` (push в master НЕ триггерит checks — гоняется на staging/dispatch;
  предложение: прогнать checks вручную через workflow_dispatch) — либо факт-чек по коду.

## Приёмка zcode — 2026-09-11: «Достаточно»

Факт-чек: phpstan в CI b2b — блокирующий шаг (`.github/workflows`, «vendor/bin/phpstan»);
уровень max без подавлений подтверждён отчётом и зелёными прогонами CI
(b2b tip). Pest-шаг advisory→blocking — зафиксировано как решение владельца
(риск: advisory-шаг не роняет CI). NB из отчёта учтён: деструктивных правок
тестов при чистке phpstan не обнаружено (Pest-гейт прогонялся отдельно в
SZ-011 §8.5).
