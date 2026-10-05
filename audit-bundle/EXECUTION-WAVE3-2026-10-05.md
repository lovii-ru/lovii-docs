# EXECUTION-WAVE3 — отчёт об исполнении Волны 3 (2026-10-05, ночь — 11:30 UTC)

Исполнитель: zcode. Волна 3 (R-3.1…R-3.5). **R-3.1/R-3.2/R-3.4/R-3.5
ИСПОЛНЕНЫ; R-3.3 — отдельная кодовая задача.** Все приёмки живьём.

## R-3.1 — изоляция раннеров (P0) — ✅ ИСПОЛНЕНО

**Целевая архитектура работает в бою:**
- 4 раннера в контейнерах (`ghcr.io/lovii-tech/ci-runner`, actions-runner
  2.337.0 + docker-cli + gosu + tini), по одному на репо: gostiny-runner-{core,app,b2b,admin}.
- 4 priviledged dind для сборок — БЕЗ host docker.sock: прод-стеки из CI
  не видны. Отдельная сеть `lovii-ci-isolated`.
- `_work` — общий volume runner↔dind (иначе монтирование воркспейса в job
  не работает — грабля №1).
- DNS внутри dind: `daemon.json` (1.1.1.1/8.8.8.8, mtu 1450) — иначе nested
  build-контейнеры не резолвят имена (грабля №2, b2b pecl-сборка падала).
- Конфиг регистрации (.runner/.credentials) персистится в volume
  `runner-cfg-*` — переживает recreate (грабля №3; первоначально терялся).
- Entrypoint: регистрация только если нет сохранённого конфига; старт от
  `runner` через gosu (root запрещён самим GitHub runner — грабля №4).
- Версия runner 2.337.0: 2.328 больше НЕ регистрируется («out of date» —
  грабля №5).

**Переключение трафика:**
- Старые host-раннеры: core — снят `config.sh remove`; app/b2b/admin —
  остановлены (`pkill`), online-статус → offline, cron `@reboot` и watchdog
  для host-раннеров убраны. Кнопка удаления их записей в GitHub UI — за
  владельцем (нет API-прав) — НЕ блокирует: offline-раннеры jobs не получают.
- Ключ удаления host-каталогов (`/home/deploy/actions-runner-*`) — в root-
  окно или `rm -rf` deploy'ем после контрольной недели.

**Приёмка (done-критерии CONTROL):** полный прогон (checks + deploy) ×4 —
все job'ы на `gostiny-ci-*-c`; пустой прогон на host-раннере невозможен
(offline). Изоляция: docker в job уходит в dind контейнера — `docker ps` из
CI видит только dind (проверено при отладке DNS), прод-сети недостижимы.

## R-3.2 — артефакт и откат (P1) — ✅ ИСПОЛНЕНО

- checks ×4 пушат образы `ghcr.io/lovii-tech/<repo>-<svc>:<sha>` (job
  GITHUB_TOKEN, `packages: write`): core → app/worker/scheduler (targets
  Dockerfile), app → lovii-app (APP_VERSION=staging·<sha>), b2b → app/
  scheduler/queue, admin → app/scheduler.
- lovii-deploy: пуллит образы по SHA, тегирует В ИМЕНЕСЕРВИСНОМ сопоставлении
  (service→image через `compose config --format json`), затем `up -d`.
- **Деплой 15 секунд без сборки; откат = деплой предыдущего SHA.**
- GHCR read с сервера: classic PAT `read:packages` владельца (docker login;
  токен светился в чате — РОТАЦИЯ В TODO).

### Инциденты по ходу (честно, оба вылечены)

1. **Баг тегирования v1 (11:08):** цикл `docker tag` по `compose config
   --images` перезаписывал ЛЮБЫЕ образы, включая сторонние: `redis:alpine`
   и `node:22-alpine` получили в себя GHCR-образ приложения → redis/pgsql/
   mock/tlsclient на core-staging рухнули (`exec: not found`). Фикс:
   service-name маппинг; сторонние образы восстановлены pull'ом, tlsclient
   пересобран, app пересоздан. **Стенды восстановлены полностью** (смоки ×4
   200/302). Урок в каноне: `compose config --images` — порядок произвольный,
   сопоставлять только по имени сервиса.
2. **Баг тегирования v2 (11:18):** «первый не-сторонний образ» оказался
   scheduler-образом → app работал `schedule:work` вместо serve → healthz
   fail. Итоговый фикс — маппинг по имени сервиса (см. выше). Проверено:
   app healthy, api-staging 200.

## R-3.4 — мок из прод-контура (P2) — ✅ ИСПОЛНЕНО

`tbank-mock` → `docker-compose.staging-extras.yml`; lovii-deploy для
lovii-core-staging использует `-f prod.yml -f staging-extras.yml`. Прод-файл
физически не содержит мок-канала. Проверено: mock healthy,
mock-pay-staging 200.

## R-3.5 — супервизор (P3) — ✅ ИСПОЛНЕНО (перевыполнено)

watchdog-крон стал не нужен: контейнерные раннеры на `restart: unless-stopped`
(лучше nohup и лучше крон-watchdog). Месячная сводка деплой-логов
(`deploy-monthly-summary.sh`, 1-го числа) — оставлена. systemd — не нужен,
пока раннеры контейнерные; в root-окно не переносится.

## R-3.3 — снятие continue-on-error (P2) — ⏳

Требует починки 9 падений PlatformOrderSettings (admin) — отдельная кодовая
задача, чтобы не смешивать с инфра-волной.

## Итоговое состояние контура CI/CD (вечер 05.10)

| Компонент | Было (утро) | Стало |
|---|---|---|
| Исполнение CI | host-раннеры = root на проде | изолированные контейнеры + dind |
| Сборка | на прод-сервере при деплое | в CI, образы ghcr.io:<sha> |
| Деплой | build+migrate на сервере | pull по SHA, 15 сек, откат той же командой |
| Доступ CI-ключа | полный shell (A-1) | forced-command по scope |
| Мок-банк | профиль в прод-compose | отдельный staging-extras файл |
| Сторож | nohup@reboot | restart: unless-stopped + месячная сводка |

Смоки: api/app/admin-staging 200, b2b-staging 302, mock-pay 200.
Все 4 стенда на SHA = origin/staging.
