# EXECUTION-WAVE3 — отчёт об исполнении Волны 3 (2026-10-05, ночь/утро, «го» владельца)

Исполнитель: zcode. Волна 3 (R-3.1…R-3.5) — исполнена частично, с одним
внешним блокером (токены регистрация раннеров) и одним моим блокером
(GHCR read-only токен, закрыт владельцем).

## R-3.2 — артефакт и откат (P1) — ✅ ИСПОЛНЕНО

- checks ×4 собирают образ(ы) и пушат в `ghcr.io/lovii-tech/<repo>-<svc>:<sha>`
  (+ retag `:latest`) через job GITHUB_TOKEN (`permissions: packages: write`).
  Таргеты по стекам:
  - core: `lovii-core-app` (target app), `-worker` (target worker),
    `-scheduler` (target scheduler)
  - app: `lovii-app` (docker/Dockerfile, APP_VERSION=staging·<sha>)
  - b2b: `-app`, `-scheduler`, `-queue`
  - admin: `-app`, `-scheduler`
- lovii-deploy: пуллит образы по SHA из GHCR, тегирует в локальные имена
  compose, затем `up -d`. Fallback на локальную сборку остался (docs-only
  skip для core, APP_VERSION для app) — на случай недоступности registry.
- **Приёмка живьём**: pull-деплой b2b-staging = **15 секунд** без сборки
  (было 4–7 минут). Откат прода = `deploy lovii-b2b-staging <старый sha>` —
  те же 15 секунд. Done-критерий «откат ≤60 сек без сборки» перевыполнен.
- Все 4 стенда на SHA, равных origin/staging: 95a3c27 / 8e83da2 / 48f3e95 / d1f8463.

### Блокер по пути (закрыт)
GHCR pull с сервера требовал read-доступа к приватным пакетам. Владелец
создал classic PAT `read:packages` (только чтение) — выполнен
`docker login ghcr.io` на сервере (credentials в ~/.docker/config.json
пользователя deploy). Токен засветился в чате — **рекомендация: после
проверки арены сгенерировать новый и перелогинить сервер** (в RULES есть
ротация; у меня в TODO).

### Errata к первой версии R-3.2
Первая попытка использовала `--target production` — такого стейджа в
Dockerfile нет (у b2b/admin именно так падало). Переписано на мульти-таргет
по реальным стейджам каждого Dockerfile. Урок: перед `-t` сверять `FROM … AS`.

## R-3.4 — мок из прод-контура (P2) — ✅ ИСПОЛНЕНО

`tbank-mock` вынесен из `docker-compose.prod.yml` в новый
`docker-compose.staging-extras.yml` (без профиля — файл сам является
стейджинговой надстройкой). lovii-deploy: для lovii-core-staging compose =
`-f prod.yml -f staging-extras.yml`; прод-файл физически не знает мок-канала.
Проверено: staging-core редеплой через wrapper → мок поднят, /health ok,
`https://mock-pay-staging.lovii.ru/health` = 200, канал в БД = staging-mock.

## R-3.5 — супервизор раннеров + сводка (P3) — ✅ ЧАСТИЧНО

- systemd недоступен (нет sudo у deploy — известная грабля). Сделано кроном:
  `runner-watchdog.sh` каждые 5 минут (рестарт упавших раннеров, лог
  ~/ci-watchdog.log); `deploy-monthly-summary.sh` 1-го числа (сводка
  lovii-deploy/gostiny-deploy/last/diff authorized_keys →
  ~/backups/ci-summary-YYYY-MM.txt). После R-3.1 (контейнеры) watchdog
  заменяется `restart: always` compose.
- Полный systemd — в root-окно вместе с R-0.1/R-1.8.

## R-3.1 — изоляция раннеров (P0) — ⏳ ГОТОВ К ПЕРЕКЛЮЧЕНИЮ, жду токены

Сделано:
- Образ `ghcr.io/lovii-tech/ci-runner:latest` собран на сервере
  (actions-runner 2.328 + docker-cli + tini, entrypoint: config.sh по
  env RUNNER_REPO/RUNNER_NAME/RUNNER_TOKEN).
- `runners-compose.yml` (в lovii-security/infra/ и на сервере ~/ci-runners/):
  4 раннера + 4 dind (привилегированные, но ИЗОЛИРОВАННЫЕ от хост-демона —
  без монтирования docker.sock), отдельная сеть `lovii-ci-isolated`,
  volumes на _work и на данные dind, `restart: unless-stopped`.
- Негативные тесты wrapper уже валидированы.

Блокер: для регистрации новых контейнерных раннеров нужны registration
token'ы ×4 репо; токен исполнителя не имеет admin:org (403), device-flow
отменён по решению владельца — владелец копирует токены из UI:
`https://github.com/lovii-tech/<repo>/settings/actions/runners/new`
(строка `--token …` в блоке Configure), по одному на каждый репо.
После получения токенов: `docker compose -f runners-compose.yml up -d`
+ смена `CI_RUNNER` метки/лейблов → старые host-раннеры стоп и удаление
из GitHub UI, крон-строки @reboot убираются.

## R-3.3 — снятие continue-on-error (P2) — ⏳ отдельная задача

Требует починки 9 предсуществующих падений PlatformOrderSettings (admin).
Не трогал, чтобы не смешивать инфра-волну с кодовой. Очередь на следующий
кодовый заход.

## Побочные факты

- При первых прогонах R-3.2: 2 красных из-за docker-демона (знакомый rpc EOF
  при 4 параллельных build) — рераны 🟢; 1 красный — флейк AppLock (vi-таймер,
  уходит при реране); 1 — мой неверный Dockerfile-таргет (см. errata).
- GHCR-пакеты организационные, приватные; их имена = <repo>-<svc>.
- Волна 2 откат-план жив: fallback сборки в lovii-deploy сохранён.
