# Staging без GitHub Actions (F-066): пути переживания для zcode

> **Дата:** 2026-09-27 · **Автор:** Super Z · **Заказчик:** владелец · **Адресат:** zcode
> **Статус:** рекомендации готовы к исполнению; выбор пути — за владельцем/zcode
> **Контекст:** F-066 — биллинг org `lovii-tech`: с ~16:22 26.09 все CI-джобы не стартуют
> (failure за 0 мин, без шагов). `deploy-staging` — джоба **внутри** CI-воркфлоу → деплои
> тоже заморожены: core-сервер на состоянии 25.09 20:21 (T-023B `132d30c` и TS-зеркало
> `9b98ae2` НЕ выкачены), app — на обеде 26.09, b2b — на 26.09 13:18.
> **Принцип владельца:** staging = тесты и пробы (не прод). Критерий успеха: свежий код
> на staging, проверка перед выкатом, быстрый откат, трассируемость. CI-минуты в этот
> период не тратим вообще.

## 0. Правило различения красного (пока F-066 активен)

- Красный прогон **за 0 минут, без шагов** = биллинг-блок, НЕ проблема кода. Не чинить,
  не перезапускать впустую.
- Красный прогон **с шагами** (до 26.09 16:22) = реальный результат тестов.
- Пуши в staging продолжаем вести как обычно — git-история остаётся источником правды;
  деплой становится **осознанным действием** (см. Путь 3), а не автоматикой.

## 1. Путь 1 — ручной деплой с машины zcode (ввести сегодня, ~15 минут)

Деплой-шаг CI реплицируется локально 1:1: тот же SSH, тот же `docker compose -f
docker-compose.prod.yml`, те же шаги. Скрипты — в Приложении A; положить в каждый репо
как `scripts/deploy-staging.sh` (в репо, не в канон).

**Предусловия:**
- SSH-доступ к staging-серверу: хост/юзер/путь совпадают с секретами
  `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_PATH` (владелец смотрит в Settings → Secrets →
  Actions каждого репо или берёт из session-доков `lovii-core/docs/sessions/001–002`);
  ключ — тот же, что в `DEPLOY_SSH_KEY` (или любой ключ с доступом к серверу).
- Локально нужны только `git` и `ssh` — docker не нужен, всё собирается на сервере.

**Гейты перед выкатом (урок F-061: локальный гейт ≠ CI-гейт):**
- `lovii-core`: `scripts/preflight.sh` (pint + rector + phpstan + pest) — полный
  эквивалент CI-джобы `checks`;
- `lovii-app`: `vitest` (944) + `vue-tsc` + `oxlint`/`eslint` + `vite build`;
- `lovii-b2b`: `composer test` (pest 5.1.2, см. F-064);
- `lovii-admin`: `composer test`.

**Протокол деплоя:**
1. Гейты локально зелёные → запускаешь скрипт из корня репо (ветка staging).
2. Скрипт сам: fetch/reset → build → migrate (Laravel-паттерн) → up -d → health-check
   с ретраями и дампом логов при провале.
3. После деплоя — якорь в session-док репо: одна строка (hash, время, кто выкатил).
   Факт-чеки Super Z опираются на эти якоря — без них приёмки теряют трассируемость.
4. Деплой **только из staging**. Никогда из master/фичевых веток.

**Откат:** `git reset --hard <prev-short-hash>` на сервере (или правкой скрипта —
параметр `DEPLOY_REF`) → повторный прогон скрипта. Образы закешированы — откат быстрый.

## 2. Путь 2 — self-hosted runner (структурный фикс, ~30–40 минут)

Восстанавливает **полный CI** (checks + deploy) бесплатно и навсегда закрывает F-066:
- Раннер уровня org: `github.com/organizations/lovii-tech/settings/actions/runners` →
  New self-hosted runner → Linux x64 → поставить как сервис (systemd).
  Лучшее место — сам staging-сервер: docker уже есть, SSH-шаг деплоя уходит в localhost,
  секреты `DEPLOY_*` остаются в workflow как есть (не мешают).
- В 5 репо (core/app/b2b/admin/pay) в `.github/workflows/ci.yml`:
  `runs-on: ubuntu-latest` → `runs-on: [self-hosted, staging]`.
- Секретность: самораннер допустим **только в приватных репо** (у lovii-tech все
  приватные — ок; в public-репо самораннер запрещён политикой безопасности).
- Нюансы: сборки едят CPU/диск сервера (следить за местом под docker-кеш); джобы
  очередятся по одному раннеру — для темпа «обкатки» этого достаточно.

## 3. Путь 3 — «деплой по требованию» как стиль работы (0 настройки)

Пока идёт обкатка и настройка, автоматический деплой на каждый пуш не нужен — и даже
мешает: приёмки владельца должны смотреть **подготовленное** состояние, а не последний
коммит. Стиль:
- пуши в staging — фиксация работы (история + PR staging→master по-прежнему вручную
  мержатся; красный 0-мин CI при мерже игнорируем по правилу §0);
- деплой — перед каждой приёмкой/демонстрацией владельцу: Путь 1 (скрипт) +
  чеклист Приложения B;
- для приёмок на 5174 (T-025 срез 3, SZ-080 OTP) ничего не меняется — dev-сервер
  zcode от Actions не зависит.

## 4. Что НЕ делать

- Не переводить репо в public ради бесплатных минут — канон/код утекут.
- Не возвращаться на GitLab и не поднимать Gitea/Woodpecker в период обкатки — churn
  без пользы (миграция с GitLab уже была, session 001).
- Не отключать checks совсем: приёмки T-018/T-023 и вердикты опираются на зелёные
  тесты (F-061), а demo-эффект «у меня локально всё зелёное» не проверяем.
- Не закрывать F-066, пока раннер/биллинг не восстановлен фактически.

## 5. Матрица выбора

| Путь | Когда | Цена внедрения | Остаточный риск |
|---|---|---|---|
| 1 — ручной деплой | сегодня | ~15 мин (скрипты) | человеческий фактор → гейты §1 + session-якорь |
| 2 — self-hosted runner | на этой неделе | 30–40 мин | сборки нагружают сервер; диск под кеш |
| 3 — деплой по требованию | сейчас, стиль | 0 | забыть выкатить перед приёмкой → чеклист B |

**Рекомендация Super Z:** Путь 3 как стиль + Путь 1 как инструмент — немедленно;
Путь 2 — как только будет полчаса (после него минуты не нужны даже при ожившем
биллинге). Когда владелец починит биллинг — просто продолжаем на раннере; re-run
зависших прогонов не нужен, если деплой уже сделан Путём 1.

---

## Приложение A. Скрипты деплоя (реплики деплой-шага CI)

### A.1 Laravel-паттерн — `lovii-core`, `lovii-b2b`, `lovii-admin` → `scripts/deploy-staging.sh`

```bash
#!/usr/bin/env bash
# Реплика deploy-staging из .github/workflows/ci.yml (F-066 период).
# Использование: DEPLOY_HOST=... DEPLOY_USER=... DEPLOY_PATH=... ./scripts/deploy-staging.sh [ref]
set -euo pipefail
: "${DEPLOY_HOST:?}"; : "${DEPLOY_USER:?}"; : "${DEPLOY_PATH:?}"
REF="${1:-staging}"   # обычно staging; откат — короткий hash предыдущего состояния
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" DEPLOY_PATH="${DEPLOY_PATH}" DEPLOY_BRANCH="${REF}" bash -s <<'ENDSSH'
set -e
DC="docker compose -f docker-compose.prod.yml"
cd "$DEPLOY_PATH"
# NB: каждая compose run/exec/up получает `< /dev/null` — иначе
# `docker compose run -T` съедает остаток heredoc как stdin контейнера
# и команды после неё (up -d, health-check) не выполнятся (копия комментария CI).
echo "==> Fetching latest ${DEPLOY_BRANCH}..."
git fetch origin
git reset --hard "origin/${DEPLOY_BRANCH}"
echo "==> Building images..."
$DC build --pull < /dev/null
echo "==> Running migrations..."
$DC run --rm -T app php artisan migrate --force < /dev/null
echo "==> Terminating Horizon workers (if any)..."
$DC exec -T horizon php artisan horizon:terminate < /dev/null 2>/dev/null || true
echo "==> Recreating containers..."
$DC up -d --remove-orphans -t 5 < /dev/null
echo "==> Health check..."
for i in 1 2 3 4 5; do
  sleep 3
  if $DC exec -T app curl -sf http://127.0.0.1:8080/healthz < /dev/null > /dev/null; then
    echo "Health check passed (attempt $i)"; break
  fi
  if [ "$i" -eq 5 ]; then
    echo "Health check failed after 5 attempts!"; $DC logs --tail=50 app; exit 1
  fi
  echo "Health check attempt $i failed, retrying..."
done
echo "==> Deploy complete! ($(git rev-parse --short HEAD))"
ENDSSH
```

Отличие `lovii-b2b`/`lovii-admin` от core: сверить compose-сервис/порт health-чекa по
их `ci.yml` (у b2b/admin джоба идентична core — `app:8080/healthz`) и наличие сервиса
`horizon` (если нет — шаг `|| true` уже прощает).

### A.2 Vue-паттерн — `lovii-app` → `scripts/deploy-staging.sh`

```bash
#!/usr/bin/env bash
# Реплика deploy-staging из lovii-app/.github/workflows/ci.yml (F-066 период).
set -euo pipefail
: "${DEPLOY_HOST:?}"; : "${DEPLOY_USER:?}"; : "${DEPLOY_PATH:?}"
REF="${1:-staging}"
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" DEPLOY_PATH="${DEPLOY_PATH}" DEPLOY_BRANCH="${REF}" bash -s <<'ENDSSH'
set -e
DC="docker compose -f docker-compose.prod.yml"
cd "$DEPLOY_PATH"
echo "==> Fetching latest ${DEPLOY_BRANCH}..."
git fetch origin
git reset --hard "origin/${DEPLOY_BRANCH}"
echo "==> Building images..."
# SZ-031: .git в билд-контекст не попадает — версию сборки передаём
# build-arg'ом из git на сервере (vite инлайнит её в бандл).
export APP_VERSION="${DEPLOY_BRANCH}·$(git rev-parse --short HEAD)"
$DC build --pull < /dev/null
echo "==> Recreating containers..."
$DC up -d --remove-orphans -t 5 < /dev/null
echo "==> Health check..."
for i in 1 2 3 4 5; do
  sleep 3
  if $DC exec -T web curl -sf http://127.0.0.1:9000/health < /dev/null > /dev/null; then
    echo "Health check passed (attempt $i)"; break
  fi
  if [ "$i" -eq 5 ]; then
    echo "Health check failed after 5 attempts!"; $DC logs --tail=50 web; exit 1
  fi
  echo "Health check attempt $i failed, retrying..."
done
echo "==> Deploy complete! ($(git rev-parse --short HEAD))"
ENDSSH
```

`lovii-pay`: активная разработка не ведётся (последний пуш 18.09) — деплоить по мере
необходимости тем же скриптом после сверки его `ci.yml`.

### A.3 Откат

```bash
# на сервере (или параметром скрипта):
cd "$DEPLOY_PATH" && git reset --hard <prev-short-hash>
# затем повторить сборку/подъём из скрипта (build закеширован — откат быстрый);
# миграции назад НЕ катим без необходимости: staging, но решение об обратной
# миграции фиксируем в session-доке.
```

## Приложение B. Чеклист перед приёмкой владельца (после любого деплоя)

1. Гейты §1 зелёные локально (вывод приложить/зафиксировать хеш и результат).
2. Скрипт §A отработал: health-check passed, hash в выводе.
3. Session-док репо: строка «деплой staging `<hash>` <дата-время> — zcode, F-066 период».
4. Проверка глазами: соответствующий URL из `environment.url` в `ci.yml` открывает
   свежую версию (app: `https://app-staging.lovii.ru`; core: `https://api-staging.lovii.ru`;
   b2b/admin — по аналогии из их ci.yml).
5. Если приёмка по конкретной задаче (T-023B демонстрация №9, T-025 срез 3, SZ-080) —
   прогон целевого сценария до показа владельцу.
