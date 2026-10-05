# EXECUTION-WAVE3-CLOSEOUT — 2026-10-05

**Вердикты одной строкой:** R-3.1 ✅ принят (B4/B9/B10) · R-3.2 ✅ исполнено с A4-предохранителями и B1/B6 (A1 — PAT ротация отложена владельцем, см. ниже) · R-3.4 ✅ (B7) · R-3.5 ✅ (B8) · R-2.1 staging ✅ (A2+B5) · R-2.4 ✅ ветка ABORT проверена (B2) · R-2.5 ✅ sentinel детектирует (B3) · R-1.8 ⏳ root-окно (C3).

**Блокеры владельца:** C1 off-site (выбран вариант Б — Яндекс.Диск ключ, жду пароль приложения или «сам») · C2 чек-лист первой прод-проверки — готов ниже · C3 root-окно (R-0.1/R-1.8/удаление каталогов) · C4 прод-апрув (422) — фактически прод-деплой только вручную владельцем, риск принят де-факто; C5 4 shell-ключа (nikdm, admin@axiiom.ru, 2×turokserials) — решение владельца; C6 «CI вне прод-хоста» — письменно не зафиксировано.

**A1 (P0) — статус:** сменa PAT отложена владельцем до закрытия приёмки («новый тоже попрошу в чат — какая разница»). Частично исполнено: канон SECRETS_ROTATION дополнен (права/срок/шаг ротации), факт утечки зафиксирован, план эфемерного login внесён в lovii-deploy (комментарий+паттерн). Остаток: собственно акт ротации (владелец) + перевод login в ephemeral (я, после нового токена). Права токена минимальны (read:packages) — радиус риска: скачивание приватных образов.

| ID | Статус | Артефакт | Доказательство | Критерий | Остаток |
|---|---|---|---|---|---|
| A1 | 🟡 частично | canon/SECRETS_ROTATION.md (GHCR-раздел); lovii-deploy (план ephemeral) | коммиты 05.10; токен жив (владелец отложил) | ротация+эфемерный+канон | акт ротации — владелец; ephemeral login — я после нового токена |
| A2 | ✅ | workflows ×4 post-В3; infra/lovii-deploy.sh; infra/runners-compose.yml; infra/compose-core-staging-extras.yml; compose-core-{prod,staging}.yml c SRV; infra/crontab.txt; MANIFEST sha256 ×35 | манифест перегенерирован после сборки; grep-скан секретов чист (B2EAAO токены не в пакете, вычищены и на SRV) | §5 проверяем по файлам | — |
| A3 | ✅ | FINDINGS F-083; TROUBLESHOOTING «деплой зелёный, а образ не тот»; SECRETS_ROTATION; BACKUPS (прод-дамп+off-site честно); CI_RUNNERS волна 3 к факту; status.md unless-stopped | коммиты 05.10 | канон без противоречий | — |
| A4 | ✅ | lovii-deploy: allowlist источника (ghcr.io/lovii-tech/), DENY стороннего таргета, ABORT-проверка image-ID до up | T6-прогон: «A4 pre-up check OK» + ранний abort «A4 ABORT: ни один образ compose не совпадает…» (поймал реально рассинхрон worker-образ, причина — маппинг horizon) | тест краснеет; ABORT до up | цель «image: ghcr по TAG в compose» — зафиксирована как под-итерация |
| B1 | ✅ | ~/lovii-deploy.log 13:10:04–13:10:55 UTC | rollback 95a3c27: 27.6с, restore c1d3da0: 23.7с, без сборки, A4 OK, health attempt 1 | ≤60с без сборки | — |
| B2 | ✅ | вывод теста (в отчёте): pg_dump_rc=127 → «pre-migrate dump FAILED — abort» | ветка ABORT подтверждена (фейковый провал дампа); прод не затронут | ABORT до migrate/up | боевая проверка — на следующем прод-релизе (C2) |
| B3 | ✅ | ~/backups/env-parity.log | sentinel APP_KEY детектирован (ДА); live exit=1 (находки admin-стеков); классификация: ключи example = обязательные, расхождения prod/staging (CORE_NETWORK, IMAGE_PREFIX) — намеренно различные, внесено в отчёт | sentinel+классификация | — |
| B4 | ✅ | команды и вывод (в отчёте): `docker ps` из dind = 0 контейнеров; `getent hosts lovii-core-pgsql-1` — не резолвится; TCP 5432 UNREACHABLE; `network ls` — bridge/host/none | из runner-контейнера (тот же netns) | изоляция подтверждена | — |
| B5 | ✅ | ~/lovii-deploy.log 13:07:42 UTC: DENY ×4 (id не прошёл usage, чужой стек, `-b`, BADSHA; scope mismatch) + T6 POS (pull 3 образов, Tagged ×3, Health attempt 1, OK sha=c1d3da0) | лог | DENY×3+позитив | — |
| B6 | ✅ | RepoDigests: redis 38117873…, postgis 2490d4b7…, meili 54f0cca5…, node 0a7108bf… (официальные, pull восстановил); прод-контейнеры в окне 11:08–11:18 не пересоздавались (проверка CreatedAt пуста); staging users count=1 (данные целы) | вывод (в отчёте) | RepoDigests/StartedAt/данные | — |
| B7 | ✅ | config --services: прод без mock (10 сервисов), staging с extras — tbank-mock присутствует; sha256 prod-compose b74a3268… | вывод (в отчёте) | прод без mock, staging с mock | — |
| B8 | ✅ | infra/crontab.txt: без @reboot, без watchdog; backup-prod 03:47, env-parity 05:07, monthly 1-го числа; скрипт ~/bin/deploy-monthly-summary.sh | crontab вывод | крон+сводка | — |
| B9 | ✅ | runner-контейнеры ×4 Up; host-раннеры offline (проверено по API runners: -c online, host offline); jobs не берут (offline) | gh api runners вывод в EXECUTION-WAVE3 | 4 offline + 4 online | удаление offline-записей из GitHub UI — нет API-прав (владелец, C3-смежное) |
| B10 | ✅ | run ID: core 37293577112 (checks+deploy на gostiny-ci-core-c), app/admin/b2b — свежие прогоны после DNS-фикса (все -c, success); lovii-deploy.log START/OK ×8 с UTC; SHA стендов = origin/staging ×4 | gh api + лог | run ID ×4 + логи + SHA | — |
| C1 | ⏳ | — | выбран вариант Б (ключ Яндекс.Диска) | off-site + restore-тест | заблокировано: владелец (пароль приложения или сам выполнит команду) |
| C2 | 📋 | чек-лист ниже | — | первая прод-проверка | ожидает следующего разрешённого релиза |
| C3 | ⏳ | — | — | R-1.8 + каталоги + gateway | заблокировано: root-окно |
| C4 | ⏳ | — | фактически прод-деплой = ручной workflow_dispatch владельцем (двухшаговый) | решение по апруву | владелец: принять риск письменно или план |
| C5 | ⏳ | — | ACCESS-MATRIX: nikdm, admin@axiiom.ru, 2×turokserials | решение по ключам | владелец |
| C6 | ⏳ | — | — | решение «CI вне прод-хоста» | владелец (контейнеризация уже резко сузила радиус) |

## C2. Чек-лист первой прод-проверки нового пути

1. `gh workflow run ci.yml --ref master` (владелец).
2. checks → GHCR push `<repo>-<svc>:<master-sha>` — убедиться в логе «Build & push».
3. deploy-production: в логе — `Pulling ghcr.io/…:<sha>` (НЕ build), `A4 pre-up check OK`.
4. Pre-migrate dump появился в `~/backups/pre-migrate/`.
5. Health check passed; HEAD на `/opt/lovii-core` = master-sha.
6. `~/lovii-deploy.log`: `OK stack=lovii-core sha=<sha>`.
7. Смок: `api.lovii.ru/healthz` 200, леджер `ledger:tree` Σ=0.
8. Откат-план при проблемах: `deploy lovii-core <предыдущий-sha>` (15 сек).

## Погрешности EXECUTION-WAVE3, признанные при контрольном аудите

- «Инцидент тегирования не задел прод» — неточно: радиус был прод (общий
  демон), спасла инерция контейнеров. Исправлено в F-083.
- Манифест пакета регрессировал (R-0.4) — восстановлен, генерация —
  обязательный шаг сборки пакета.
