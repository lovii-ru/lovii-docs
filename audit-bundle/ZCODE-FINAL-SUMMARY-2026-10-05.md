# ZCODE-FINAL-SUMMARY — итоговый статус Волн 1–3 для приёмки (2026-10-05, ночь)

**Исполнитель:** zcode. **Для аудитора:** это точка входа; ниже — одна строка
вердикта на каждый R и карта всех документов. Всё запушено в main
(коммиты 9f0c01e…26c2a1c), манифест sha256 перегенерирован финалом (актуальное число — MANIFEST-REDACTED, инвентарь сходится с деревом 1:1).

## Вердикты одной строкой

| R | Вердикт | Комментарий |
|---|---|---|
| R-0.1 gateway-экспорт | ⏳ | root-окно владельца (B-4 ждёт его же) |
| R-0.2 README | ✅ | «один compose на два контура» — в README и INFRA-CONTEXT |
| R-0.3 runner-json | ✅ | agentId=21 — реальность машинных файлов (транскрипт в RESPONSE-ACCEPTANCE) |
| R-0.4 манифест | ✅ | 41 файл, перегенерирован последним шагом, ghost-записи удалены |
| R-1.1…R-1.7 Волна 1 | ✅ принята вами 7/7 (ACCEPTANCE §2) | — |
| R-1.8 REF_RE | ⏳ root-файл (C3) | — |
| R-1.9 redis argv | ✅ staging / 🟡 prod — уйдёт с recreate (C2) | live-проверка staging в RESPONSE-ACCEPTANCE §3.1 |
| R-2.1 forced-command | ✅ staging ×4 живьём; prod — чек-лист C2 | lovii-deploy sha 3e6a968d = SRV (b69b7008 — предыдущая версия, заменена при дожимах RECHECK; актуальная сверена при сборке манифеста) |
| R-2.2 бэкап | ✅ локальный ночной дамп + off-site Яндекс.Диск (retention 14) + restore-тест; PITR/pgbackrest и ежемесячный restore на стенде — плановые улучшения | — |
| R-2.3 ключи | ✅ пары staging/production, restricted, environment secrets; approval — C4 | — |
| R-2.4 pre-migrate dump | ✅ ветка ABORT проверена (B2); прод — C2 | — |
| R-2.5 env-parity | ✅ sentinel + крон + классификация (R25-файл): 0 обязательных отсутствующих | — |
| R-3.1 изоляция | 🟡 сети+лимиты CPU/RAM ✅; открытые: privileged dind, TLS off (внутри изолированной сети), образы без digest-пинов, нет pids-limits/дисковой квоты — перечислено как residual risks | — |
| R-3.2 GHCR+откат | ✅ pull по SHA, деплой 15 сек, откат той же командой; strict allowlist маппинга (A4 v3) + тесты T1–T5 | — |
| R-3.3 continue-on-error | ✅ снят ×3 (lovii-admin: PHPStan, Type coverage, Tests; b2b Type coverage — advisory, вне критерия R-3.3): baseline 121; найдены и починены 3 скрытых дефекта CI (схема lovii_admin, core-schema импорт, CORE_API_URL в phpunit); PlatformOrderSettings зелёные (557 passed) | — |
| R-3.4 мок → extras | 🟡 частично: staging-extras работает и принят, но prod-compose на SRV ещё содержит профиль mock — уйдёт с прод-релизом (C2) | — |
| R-3.5 супервизор | ✅ restart: unless-stopped + месячная сводка | — |
| R-1.3 (дожим) | ✅ job-level concurrency checks/deploy разведены; workflow-level cancel удалён | — |
| A1 PAT | ✅ ротирован владельцем вне чата; старые ×2 отозваны | — |

## Порядок чтения документов

1. `EXECUTION-WAVE3-CLOSEOUT-2-2026-10-05.md` — финальная дельта (ответ на
   ZCODE-REVIEW-CLOSEOUT-2, все 6 замечаний ревью закрыты).
2. `AUDIT-RESPONSE-ACCEPTANCE-2026-10-05.md` (+ Errata) — ответ на ACCEPTANCE.
3. `ZCODE-RESPONSE-REVIEW-CLOSEOUT-2-2026-10-05.md` — про разошедшиеся по
   времени пуш-дожимы и ревью.
4. `EXECUTION-WAVE3-CLOSEOUT-2026-10-05.md`, `EXECUTION-WAVE2-…` — отчёты волн.
5. `R25-ENV-PARITY-CLASSIFICATION-2026-10-05.md` — классификация ключей (R-2.5).
6. Тесты: `tests/test-mapping.py` (T1×4 зелёные, T2–T5 красные — включая
   web=nginx:latest), `tests/RUN-EVIDENCE.md` (run ID ×4 → runner → SHA).
7. Артефакты: `infra/lovii-deploy.sh` (sha 3e6a968d… = SRV-версия с target-allowlist v3),
   `infra/runners-compose.yml` (4 сети), `infra/compose-core-staging-extras.yml`,
   `infra/crontab.txt` (после Волн 2–3), `workflows/*/ci.yml` (после Волн 1–3),
   `infra/compose-core-prod.yml` (честный старый срез SRV —prod-релиз C2).

## Открытое (всё — внешние зависимости)

- C1: ✅ закрыт (off-site Яндекс.Диск работает; attestation)
- C2: первый прод-релиз по чек-листу (владелец даёт «го») — закроет
  prod-части R-1.9/R-2.1/R-2.4/R-3.2
- C3: root-окно (R-0.1, R-1.8, удаление каталогов)
- C4: прод-апрув (422 на required reviewers) — владелец
- C5: судьба 4 shell-ключей — владелец
- C6: «CI вне прод-хоста» как цель — владелец
- Мелочи исполнителя: ephemeral login, дайджест-пины dind, чистка
  FILAMENT_PATH в .env.example admin (не блокируют приёмку)
