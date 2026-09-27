# CI/CD на self-hosted раннерах (действует с 27.09.2026)

> **Статус:** ДЕЙСТВУЕТ, пока лимит GitHub Actions не сбросится и владелец не
> скажет переключаться обратно. Это единственный канонический документ по теме;
> operational-разбор — `lovii-core/docs/sessions/063-ci-self-hosted-runners.md`.

## Суть

GitHub Actions (GitHub-hosted) не работает — лимит биллинга исчерпан (владелец:
биллинг не проверяем, ждём сброса). По решению владельца весь CI/CD переведён на
**self-hosted раннеры на том же прод-сервере** `gostiny-prod-01` (89.19.223.16).
Self-hosted минуты GitHub не расходуют — пайплайн полноценный.

## Что где стоит

| Что | Где |
|---|---|
| Раннеры | `~/actions-runner-{core,app,b2b,admin}` под юзером `deploy`, имена `gostiny-ci-*`, лейблы `self-hosted,lovii` |
| Автостарт | crontab deploy: 4 строки `@reboot … run.sh` (systemd нельзя — нет беспарольного sudo) |
| Переключатель | переменная репо `CI_RUNNER` (Settings → Secrets and variables → Actions → Variables), сейчас `self-hosted`, во всех 4 репо |
| ci.yml | `runs-on: ${{ vars.CI_RUNNER || 'ubuntu-latest' }}` — 3 джобы: checks, deploy-staging, deploy-production |

## Как работать агенту

1. **Перед пушем — локальный гейт** (`tools/*-tests.sh` / `yarn test:unit && …`),
   как и раньше. Он первая линия; CI — вторая.
2. Пуш в `staging` → проверки на `gostiny-ci-*` → **автодеплой стенда** (тот же
   SSH-скрипт, что был у Actions: git reset + build + migrate + up + health-check).
3. Смотреть прогон: `gh run watch <id> --exit-status` (id брать свежим:
   `gh run list --branch staging --limit 1` — пуш создаёт НОВЫЙ прогон, старый id
   не переиспользовать). Проверить стенд: с сервера
   `curl -s https://api-staging.lovii.ru/healthz` (с машины владельца внешний
   curl может таймаутить — сетевые подвохы Мака).
4. Прод — как и было, **только вручную**: `gh workflow run ci.yml --ref master`
   (тоже идёт на нашем раннере, лимит не мешает).
5. Если раннер offline/завис — приёмка по-старинке: локальный гейт + ручной
   деплой по SSH (см. `lovii-app/DEPLOY.md`, `docs/DEPLOY.md`).

## Откат стейджа

Штатный GitHub Revert плохого коммита → пуш в `staging` → стенд сам откатывается.
Аварийно, мимо CI: на сервере в `/opt/lovii-<repo>-staging` —
`git fetch origin && git reset --hard origin/staging@{1} && docker compose -f docker-compose.prod.yml build && up -d`.

## Возврат к GitHub-hosted (после сброса лимита биллинга)

1. `gh api -X PATCH repos/lovii-tech/<repo>/actions/variables/CI_RUNNER -f value=ubuntu-latest`
   — для lovii-core, lovii-app, lovii-b2b, lovii-admin. Всё, код править не нужно.
2. Погасить раннеры на сервере: из crontab deploy убрать 4 строки `@reboot …
   run.sh`, затем `pkill -f 'actions-runner.*/run.sh'`.
3. Первые прогоны на hosted будут холодными (gha-кэш пуст) — это нормально.

## Грабли (пойманы на живых прогонах 27.09)

- **`--network-alias pgsql-testing` обязателен** у тестовой Postgres в ci.yml:
  имя контейнера суффиксируется (`pgsql-testing-$RUN_TAG`), а `DB_HOST` в
  phpunit.xml — нет. Без алиаса все DB-тесты падают «could not translate host
  name». Фикс уже во всех workflow — не выкидывать.
- **pecl с РФ-сервера ставится «через раз»** (xdebug/redis/imagick = REMOTE
  MODULE): IPv6 хостинга мёртв, docker-бриджи v4-only, CDN pecl (bunny) отдаёт
  AAAA раньше A и половина A-узлов недостижима. Лечится в Dockerfile:
  `/etc/gai.conf` с `precedence ::ffff:0:0/96 100` (musl читает) + 5 ретраев
  `install-php-extensions`. Фикс в base+ci стейдже core/b2b/admin — не выкидывать.
  Первый холодный прогон 15–25 мин — норма (рулетка pecl + сборка).
- Параллельные прогоны разных репо на одном docker-хосте безопасны благодаря
  `RUN_TAG: run-${{ github.run_id }}` в именах контейнеров/сетей.
- Копирование каталога раннера ломает регистрацию (`.runner_migrated` переезжает)
  — при переезде чистить `.runner*`, `.credentials*`, `_diag`, `_work`.

## Обслуживание раннеров

- Логи: `~/actions-runner-*/_diag/` и `/tmp/runner-<repo>.log` на сервере.
- Онлайн-статус: `gh api repos/lovii-tech/lovii-<repo>/actions/runners`.
- Перезапуск (если завис): на сервере `pkill -f 'actions-runner-core'` и в
  `~/actions-runner-core` — `nohup ./run.sh >/tmp/runner-core.log 2>&1 &`
  (аналогично для app/b2b/admin). После ребута сервера поднимутся сами.
