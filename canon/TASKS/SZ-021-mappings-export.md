# SZ-021 — C-5: Экспорт/импорт integration_entity_mappings для production

> Статус: **На приёмке** (2026-09-11, core `5e1225c` — приёмка zcode запрашивается). Постановка (2026-09-10, из BACKLOG Трек C-5)
> Приоритет: **P3** — готовит чистый прод-деплой: прод-база пустая, а
> сопоставления internal_id внешних систем (Kuper) сидят в staging-данных
> и нужны на проде для будущих импортов
> Исполнитель: Super Z · Репо: `lovii-core` · Гейт: composer test

## 1. Что

1. Консольная команда экспорта `integration_entity_mappings` в файл
   (CSV/JSON: сущность, internal_id, external_id, метаданные);
2. Команда импорта на целевом окружении: идемпотентно (upsert по ключу),
   с отчётом (добавлено/обновлено/пропущено);
3. NB из первоисточника: «наполнение production-базы независимо от этапа
   парсинга, привязка internal_id на другом сервере» — идентификаторы
   staging ≠ прод, если есть автоинкрементные внутренние ссылки —
   использовать стабильные ключи (external_id), НЕ внутренние id.

## 2. Приёмка

- Прогон на staging → staging (круговой тест): экспорт → очистка mappings →
  импорт → соответствие 1:1, заказы/поиск не задеты.
- zcode: приёмка кода; проверка идемпотентности повторным импортом.

## 3. Отчёт исполнителя (Super Z, 2026-09-11, core `5e1225c`)

- `mappings:export {--file=}`: JSON v1 (exported_at, integrations {provider+kind},
  mappings [{integration, entity_type, external_id, internal_id (информационно),
  payload_hash, last_seen_at, payload}]) — stdout или файл.
- `mappings:import {file} {--with-internal-ids} {--dry-run}`: upsert по стабильному
  ключу (integration provider+kind → id, entity_type, external_id = unique-индекс);
  отчёт added/updated/skipped/failed; интеграция не найдена → строка skipped с warn
  (не создаём интеграцию вслепую); internal_id переносится ТОЛЬКО с флагом
  кругового теста same-env (§1.3 NB — staging ≠ prod).
- Тесты Pest ×4: round-trip export→wipe→import 1:1 (без internal ids), идемпотентность
  повторного импорта, флаг --with-internal-ids, «заказы/поиск не задеты».
- Гейт: composer test — за zcode (локально ext-imagick/docker).

## Приёмка zcode — 2026-09-11: «Достаточно»

Факт-чек: `mappings:export` (JSON, стабильные ключи) и
`mappings:import` (идемпотентный upsert) в app/Console/Commands; тесты
round-trip/идемпотентности ×4; internal_id за флагом --with-internal-ids
(безопасный дефолт). CI core 🟢.
