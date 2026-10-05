# ZCODE-FINAL-SUMMARY — итоговый статус Волн 1–3 для приёмки (2026-10-05, ночь)

**Исполнитель:** zcode. **Для аудитора:** это точка входа; ниже — одна строка
вердикта на каждый R и карта всех документов. Всё запушено в main
(коммиты 9f0c01e…26c2a1c), манифест sha256 перегенерирован финалом (актуальное число — MANIFEST-REDACTED, инвентарь сходится с деревом 1:1).

## Вердикты одной строкой

| R | Вердикт | Комментарий |
|---|---|---|
| R-0.1 gateway-экспорт | ✅ ЗАКРЫТ 06.10 (root-сессия владельца): compose-gateway.yml в пакете; B-4 закрыт — socket-proxy read-only (POST:0, docker.sock ro, internal-only сеть), EXEC/BUILD/VOLUMES не включены |
| R-1.8 REF_RE | ✅ ЗАКРЫТ 06.10 (root-патч gostiny-deploy, бэкап .bak-20261006 — attestation): `-b x` → invalid git ref; пакетная копия 06.10 приведена к тому же правилу (`^[A-Za-z0-9._/][A-Za-z0-9._/-]*$`, ведущий `-` отвергнут — проверено regex-тестом). Live-root-состояние аудитором не проверялось |
| Каталоги host-раннеров | ✅ удалены root'ом; offline-записи из GitHub UI удалены через API (3/4, core был уже online-контейнерным) |
| R-0.2 README | ✅ | «один compose на два контура» — в README и INFRA-CONTEXT |
| R-0.3 runner-json | ✅ | agentId=21 — реальность машинных файлов (транскрипт в RESPONSE-ACCEPTANCE) |
| R-0.4 манифест | ✅ | 51 файл без манифеста (06.10: +2 ранее пропущенных документа, response RECHECK-3, predicate перенесён в infra/), перегенерирован последним шагом коммита, инвентарь сходится с деревом 1:1 |
| R-1.1…R-1.7 Волна 1 | ✅ принята вами 7/7 (ACCEPTANCE §2) | — |
| R-1.8 REF_RE (дубль строки — снят 06.10) | ✅ см. строку 12 выше; прежняя «⏳ root-файл» устарела после root-патча C3 | — |
| R-1.9 redis argv | ✅ staging / 🟡 prod — уйдёт с recreate (C2) | live-проверка staging в RESPONSE-ACCEPTANCE §3.1 |
| R-2.1 forced-command | ✅ staging ×4 живьём; prod — чек-лист C2 | 06.10: wrapper unified — lovii-deploy source-ит infra/a4-predicate.sh (fail-closed), inline-копии нет; пакетный SHA теперь 478b9572…, СИНХРОНИЗАЦИЯ SRV (lovii-deploy.sh + a4-predicate.sh парой) — при следующем деплой-касании; ae717c18 = прежний срез SRV |
| R-2.2 бэкап | ✅ локальный ночной дамп + off-site Яндекс.Диск (retention 14) + restore-тест (attestation исполнителя: SRV/Диск аудитором не проверялись); PITR/pgbackrest и ежемесячный restore на стенде — плановые улучшения | — |
| R-2.3 ключи | ✅ пары staging/production, restricted, environment secrets; approval — C4 | — |
| R-2.4 pre-migrate dump | ✅ ветка ABORT проверена (B2); прод — C2 | — |
| R-2.5 env-parity | ✅ sentinel + крон + классификация (R25-файл): 0 обязательных отсутствующих | — |
| R-3.1 изоляция | 🟡 сети+лимиты CPU/RAM dind ✅; принятые владельцем residuals (memo C6): privileged dind ×4, TLS off (внутри изолированной сети пары), mutable tags без digest-пинов. НЕ принятые, открытые: нет runner-лимитов CPU/RAM/pids, нет дисковой квоты/cleanup dind-data, host bind mount daemon.json — нужно отдельное решение владельца или remediation | — |
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
7. Артефакты: `infra/lovii-deploy.sh` (06.10 unified: source a4-predicate.sh, fail-closed; пакетный sha 478b9572…, SRV-синк — при следующем деплой-касании) + `infra/a4-predicate.sh` (общий источник с тестом),
   `infra/runners-compose.yml` (4 сети), `infra/compose-core-staging-extras.yml`,
   `infra/crontab.txt` (после Волн 2–3), `workflows/*/ci.yml` (после Волн 1–3),
   `infra/compose-core-prod.yml` (честный старый срез SRV —prod-релиз C2).

## Открытое (всё — внешние зависимости)

- C1: ✅ закрыт (off-site Яндекс.Диск работает; attestation)
- C2: первый прод-релиз по чек-листу (владелец даёт «го») — закроет
  prod-части R-1.9/R-2.1/R-2.4/R-3.2
- C3: ✅ ЗАКРЫТ 06.10 (root-сессия: gateway экспортирован, R-1.8 пропатчен, каталоги удалены)
- C4: ✅ риск принят владельцем письменно (OWNER-DECISIONS-C4C5C6): прод-деплой только вручную под его аккаунтом; required reviewers недоступны на плане Team (HTTP 422, подтверждено 05.10 и 06.10); переоткрыть, если GitHub включит reviewers для Team
- C5: ✅ принято владельцем письменно: все 4 shell-ключа остаются (разные машины/сервисы, согласовано с ведущим разработчиком)
- C6: ✅ цель «CI вне прод-хоста» принята владельцем, отложена ~на 2 месяца; до переезда действуют компенсации (контейнерные раннеры, isolated сети, limits dind, forced-command)
  - ⚠️ из residuals R-3.1 memo C6 принимает ЯВНО только: privileged dind, TLS off (внутри изолированной пары), mutable tags. Оставшиеся — runner-лимиты CPU/RAM/pids, дисковая квота/cleanup dind-data, host bind mount daemon.json — отдельного письменного решения НЕТ: считаются открытыми до решения владельца или remediation
- 🔴 Ротация SOCKS5 upstream (GOST_UPSTREAM): литерал был в git с 5092d7d,
  убран из среза 06.10 — учётные данные считать раскрытыми, ротирует владелец
- Мелочи исполнителя: ephemeral login, дайджест-пины dind, чистка
  FILAMENT_PATH в .env.example admin (не блокируют приёмку)
