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

## Версионность: что сейчас на стейджинге

Версия стенда = git SHA ветки `staging`. Одной командой (локально):

```sh
bash ~/LOVII/tools/staging-status.sh
```

Показывает по всем 4 репо: tip `staging` в GitHub, HEAD на сервере, совпадение
и возраст контейнеров. Нюансы:
- **Доки не деплоятся** (`paths-ignore: '**/*.md'`): сервер может быть позади
  GitHub на доковые коммиты — статус «✓ (доки)», это норма. «⚠ СЕРВЕР ПОЗАДИ» —
  разбираться.
- **Архив-ветки («для хранения») на GitHub НЕ деплоятся** — на стенд попадает
  только ветка `staging`. Это норма хранения, а не потеря изменений.
  Влить ветку на стенд — осознанный шаг владельца/агента (merge → пуш → CI).

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

## Оптимизированный режим CI — действует с 28.09.2026 (канон для всех агентов)

> Постановка владельца 28.09: «не может быть, чтобы при правке в пару символов
> гонялся полный прогон». Оптимизация сделана БЕЗ урезания тестов — весь набор
> по-прежнему гоняется на каждом пуше; убраны дубли и лишняя тяжесть.
> Замер до/после: checks core 6м37с → **~3м40с**; deploy-staging 1м53с → **15с**
> (когда образ не пересобирается). Полный цикл «пуш → стенд обновился»:
> ~8,5 мин → ~4 мин.

### Как работает пайплайн теперь (core; app — то же минус unit-нюансы)

| Шаг | Было | Стало | Правило |
|---|---|---|---|
| Build CI image | 59с | 59–82с | buildx-кэш локальный на раннере; НЕ трогать |
| composer/yarn install | 46с | **0с** при точном кэш-хите | `if: steps.*-cache.outputs.cache-hit != 'true'` — lock не менялся → кэш уже актуален |
| Lint (Pint+Rector) | 41с | 41с | без изменений |
| PHPStan | 28с | 28с | без изменений |
| Type coverage + Tests | 53с + 2м19с | **60с (один прогон)** | type-coverage считается В проходе тестов (`pest --parallel --type-coverage --min=70`); отдельный шаг удалён |
| Xdebug `--coverage` | в каждом прогоне | **убран из рутины** | замедлял прогон в 2-3 раза; полное покрытие — по требованию: локально `vendor/bin/pest --coverage` или ручной запуск workflow |
| deploy: docker compose build | всегда (~1м) | **только при изменении** `docker/`, `composer.lock`, `composer.json` | `git diff origin/<branch>^ origin/<branch> -- …`; иначе контейнеры пересоздаются из существующего образа |

### ⚠️ Критические правила (нарушение = сломанный деплой или потеря скорости)

1. **app: скипать `docker compose build` при деплое НЕЛЬЗЯ** — Vite-бандл
   собирается внутри образа при деплое (APP_VERSION build-arg, SZ-031). Правило
   «умного rebuild» действует только в `lovii-core`.
2. **Rector запускать только с явными путями** (`rector process <файлы>`).
   Прогон по всему репо «зафиналил» `CoreModel` вне зоны задачи (поймано
   PHPStan'ом; откат в session 067).
3. **Тесты не резать ради скорости.** Экспирейшн-идеи вида «гонять только
   затронутые тесты» — только поверх полного прогона, никогда вместо.
4. **Локальный гейт перед пушем остаётся обязательным** (п. «Как работать
   агенту») — CI ускорен, но не стал необязательным.

### Экономика минут GitHub Actions: когда горит, когда нет

| Режим | Минуты GitHub | Как включён |
|---|---|---|
| **Self-hosted `gostiny-ci-*` (СЕЙЧАС, с 27.09)** | **0 — не расходуются вообще** | переменная репо `CI_RUNNER=self-hosted` (все 4 репо) |
| GitHub-hosted (возврат после сброса лимита) | списываются за КАЖДЫЙ прогон: core ~4 мин (после оптимизации; было ~7), app ~2 мин, b2b ~33 мин — см. грабли b2b | снять `CI_RUNNER` (пусто) → `runs-on: ubuntu-latest`; чек-лист возврата — ниже |

- Расход минут зависит от ЧИСЛА пушей: оптимизация снизила длительность
  прогона ~в 2 раза ⇒ при возврате на GitHub-hosted и тот же ритм пушей
  расход минут будет ~вдвое меньше, чем в сентябре.
- Docs-only пуши минуты не тратят никогда (`paths-ignore: **/*.md, docs/**,
  specs/** …` — было с самого начала).
- Сентябрьский расход (≈2000–3000 мин) был на GitHub-hosted до 26.09:
  несколько параллельных сессий × полный прогон ~7 мин на каждый пуш.
  Правильный фикс был сделан 27.09 — self-hosted; оптимизация 28.09 —
  вторая ступень (скорость фидбека, а не минуты).

### Чек-лист агента перед пушем (краткий)

1. Локальный гейт репо (tools/*-tests.sh / yarn test:unit && type-check && build-only).
2. Пуш в `staging` → `gh run watch` свежего id → healthz стенда.
3. Если правил `docker/`, `composer.lock`, `composer.json` (core) — деплой
   пересоберёт образ сам; иначе стенд обновится за ~15 с.
4. Ничего в деплой-джобах не менять без перечитывания этого раздела.

### Порядок релиза на прод (с оптимизациями) — что увидит агент

1. Убедиться, что staging принят владельцем; `git fetch` — `master` отстаёт от
   `staging` ровно на релизные коммиты.
2. Мерж `staging` → `master`, пуш `master` (CI прогонится на пуш), затем
   **ручной триггер**: `gh workflow run ci.yml --ref master`.
3. Прогон: checks ~3м40с → deploy-production: миграции + пересоздание
   контейнеров; rebuild образа ТОЛЬКО если в релизе менялись `docker/`,
   `composer.lock`, `composer.json` — иначе экономия та же (~1м).
4. Health-check в джобе обязателен; при фейле — джоба красная, стенд прода
   остаётся на предыдущей версии (деплой идемпотентен, откат — revert-коммит
   и повторный workflow_dispatch).

### Известные остатки (не блокируют)

- Build CI image ~1 мин: пересборка из-за `COPY .` исходников; можно уменьшить
  кэшированием vendor/node_modules в слоях — низкий приоритет.
- Полное покрытие тестами (--coverage) сейчас нигде не гонится автоматически:
  решить, добавить ли еженедельный schedule-прогон (вопрос владельцу).

---

## Волна 1 аудита CI/CD (05.10.2026, В ДЕЙСТВЕ во всех 4 репо)

Внешний аудит (arena/01a10967 lovii-docs) + вердикт zcode
(`audit-bundle/AUDIT-VERDICT-ZCODE-2026-10-05.md`). Исполнено и проверено
живым деплоем 05.10 (core/app/b2b/admin: CI ✅, деплоенный SHA = запушенный,
ключ со диска стёрт):

| Правка | Что изменилось в ci.yml |
|---|---|
| R-1.1 | `Cleanup SSH key` (if: always) после каждого Deploy — приватный ключ не оседает на диске раннера |
| R-1.2 | `permissions: contents: read` на workflow — GITHUB_TOKEN без прав |
| R-1.3 | deploy-job'ы имеют собственный `concurrency: deploy-<ref>, cancel-in-progress: false` — второй пуш не отменяет деплой посреди миграций (checks отменяются как раньше) |
| R-1.4 | деплоится ПРОВЕРЕННЫЙ `DEPLOY_SHA` (`git reset --hard "${DEPLOY_SHA:-origin/branch}"`), а не вершина ветки |
| R-1.5 | known_hosts из переменной `DEPLOY_HOST_KEY` (задана ×4), `StrictHostKeyChecking=yes`, ssh-keyscan убран |
| R-1.6 | actions запинены по SHA (checkout v5.1.0, cache v5.1.0, buildx v4.4.1, build-push v7.4.0) — обновлять осознанно, коммитом |
| R-1.7 | pull_request уходит на `ubuntu-latest` (сейчас = Queued, биллинг исчерпан — осознанный компромисс безопасности) |
| R-1.9 | redis healthcheck: пароль через `REDISCLI_AUTH` env, не в argv (lovii-core compose; применится при следующем recreate redis) |

**Что осталось (окна обслуживания / волна 2):** R-1.8 (REF_RE заперт leading `-`
в gostiny-deploy — файл root:root), R-2.1 (деплой на forced-command — главный
рефакторинг), R-2.2 (прод-бэкап off-site — P0), R-2.3 (ключи по окружениям +
required reviewers на прод), R-3.x (раннеры в контейнеры, GHCR по SHA).

**Правило для агентов:** при изменении `.github/workflows/ci.yml` правки
делаются в репо (ветка → гейт → пуш), НИКОГДА руками на сервере; серверный
compose (`docker-compose.prod.yml`) — тоже из репо. Секреты — только
GitHub Secrets; новые actions — только с SHA-пином.
