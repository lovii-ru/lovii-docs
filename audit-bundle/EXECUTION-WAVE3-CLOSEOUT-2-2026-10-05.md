# EXECUTION-WAVE3-CLOSEOUT-2 — дельта после ревью арены (2026-10-05, ночь)

**Ответ на:** `ZCODE-AUDIT-REVIEW-ACCEPTANCE-2026-10-05.md` (arena/01a10c48,
слит в main). Все 6 блокирующих замечаний отработаны; дельта — по пунктам.

## Зам.1 — A4 strict (исполнено, тесты приложены)

`infra/lovii-deploy.sh` v3 (sha256 на момент CLOSEOUT-2 = 60978bfb…; **актуальный после ревью = b69b7008…, сверено SRV↔пакет**):

- **Явная таблица пакет→сервисы по имени**: core: app→`app`,
  worker→`horizon telegram-poller-{orders,otp,support}`, scheduler→`scheduler`;
  app: app→`web` (замечание арены про web учтено); b2b: app/scheduler/queue;
  admin: app/scheduler.
- **Strict allowlist таргета**: сервис отсутствует в compose → ABORT; таргет
  сторонний (redis/imresamu/getmeili/node/alpine/docker/postgres) → ABORT.
- **Reverse-coverage**: не-сторонний образ compose, не покрытый таблицей →
  ABORT (поймал бы и баг 11:18, и пропуск).
- **Проверка image-ID каждого сервиса == его GHCR-пакет — ДО migrate/up**
  (порядок: pull → tag → A4 pre-up strict → pre-migrate dump → migrate → up).
- **Production fail-closed**: провал pull на проде = ABORT, fallback-сборка
  разрешена только в staging.
- **Юнит-тесты на фикстурах** (`/tmp/test-mapping.py`, вывод в отчёте):
  зелёный на корректных маппингах (включая app=web, core=horizon),
  **красный** на врущем (app→scheduler — точный сценарий бага 11:18) и на
  uncovered-сервисах.
- Живой прогон после фикса: Tagged ×6 (вкл. poller-ы → worker), `A4 pre-up
  strict OK`, deploy complete.

## Зам.2 — R-1.9/R-3.4 честные экспорты

- `infra/compose-core-prod.yml` — **свежий экспорт с SRV** (sha256
  a3ab5abc…): в нём ещё есть `tbank-mock` (профиль) и старый redis
  healthcheck — это честно: **прод-деплой не делался** (только вручную);
  коммиты с фиксом в git (staging-ветка), на прод попадут следующим
  разрешённым релизом по чек-листу C2.
- `infra/compose-core-staging.yml` — свежий экспорт (sha256 b74a3268…);
  ранее в отчёте B7 я перепутал эти два SHA — подтверждено, ошибка моя.
- `config --services` обоих стеков приложен в отчёте (прод: 10 сервисов без
  мока в факте запуска — `COMPOSE_PROFILES` на проде не задан; staging: 11 с
  tbank-mock).
- R-1.9 live: staging redis healthcheck = `REDISCLI_AUTH=…` ✅; прод redis
  контейнер — старый argv с подставленным паролем (виден в inspect),
  уйдёт при recreate. Пароль прод-redis: ротация пароля вместе с recreate —
  рекомендуется (O-новый).
- Противоречие в моём предыдущем ответе (REDISCLI_AUTH «в prod-compose») —
  признано: я ссылался на git-состояние, а прикладывал SRV-срез. Теперь в
  пакете — SRV-срез, а git-статус описан словами.

## Зам.3 — R-0.4 манифест

- Ghost-записи `.DS_Store` удалены из дерева и манифеста.
- `AUDIT-RESPONSE-ACCEPTANCE` включён в манифест.
- Манифест перегенерирован **последним шагом** сборки (37 файлов).

## Зам.4 — A1 ephemeral

Персистентный login сохранён **осознанно** (токен read-only, 90 дней,
каталог 0600); в lovii-deploy зафиксировано решение. Ephemeral login
(login/logout в trap) — под-итерация при следующем касании. Ротация
выполнена владельцем (attestation), отзыв старых подтверждён неработоспособностью
(старый токен больше не в docker config).

## Зам.5 — R-3.1 сети разделены (исполнено)

- Было: одна сеть `lovii-ci-net` для всех runner+dind (замечание арены
  верно: runner A мог достучаться до dind B).
- Стало: 4 изолированные сети `lovii-ci-{core,app,b2b,admin}`, каждая пара
  runner↔свой dind.
- **Негативный тест**: из gostiny-runner-core `getent hosts dind-{app,b2b,
  admin}` → NXDOMAIN ×3, `dind-core` → REACHABLE; TCP 2376 к чужим — closed;
  `docker ps` через свой dind — только пустой список dind-контейнеров.
- Все 4 раннера online после пересоздания.

## Зам.6 — run ID ×4 (все на контейнерных раннерах, success)

| Репо | Run ID | Runner | SHA (HEAD staging = SRV) |
|---|---|---|---|
| lovii-core | 37324264536 | gostiny-ci-core-c | 2c1128ca |
| lovii-app | 37300496395 | gostiny-ci-app-c | cc714ea |
| lovii-b2b | 37300500498 | gostiny-ci-b2b-c | 151ec2a |
| lovii-admin | 37311758968 | gostiny-ci-admin-c | 612fab4 |

Лог lovii-deploy: `OK stack=<stack> sha=<sha>` ×8+ (см. `~/lovii-deploy.log`);
B1 rollback (27.6с/23.7с) — из прошлого отчёта, остаётся в силе.

## Открытое (без изменений, внешние зависимости)

O-1 off-site (ждёт ключ владельца) · C2 первый прод-релиз по чек-листу ·
C3 root-окно (R-0.1/R-1.8/каталоги) · C4–C6 решения владельца ·
R-3.3 done: continue-on-error снят, baseline, admin CI 🟢 (см. EXECUTION-WAVE3
и INBOX) · R-2.5 классификация — выполнена (см. R25-ENV-PARITY-CLASSIFICATION) · Prod redis recreate
(пароль в argv уйдёт) — следующий прод-деплой.
