# R-2.5 — классификация ключей env-parity (дельта к CLOSEOUT-2, 2026-10-05)

**Done-критерий арены:** классификация «обязательный / опциональный с
default / намеренно различный» + fixture-тест (sentinel детектится) + лог
без значений. Ниже — все три.

## 1. Fixture-тест (sentinel)

Тест выполнен на копии `.env` (live-файлы не менялись): из копии удалён
`APP_KEY` → env-parity детектирует его в списке отсутствующих — **ДА**
(полный вывод в EXECUTION-WAVE3-CLOSEOUT, B3). Live-прогон: exit 1,
находки в логе `~/backups/env-parity.log`. Крон 05:07 UTC ежедневно.

## 2. Классификация ключей (admin-стек, единственный с расхождениями)

Метод: для каждого «отсутствующего» ключа — поиск `env('KEY', default)` в
config/ и вхождений в docker-compose/Dockerfile.

### 2а. Опциональные с default в config — отсутствуют в обоих .env осознанно (11 шт.)

| Ключ | Default в config | Комментарий |
|---|---|---|
| APP_LOCALE | `en` | локаль задаётся переводами, не env |
| APP_FALLBACK_LOCALE | `en` | — |
| APP_FAKER_LOCALE | `en_US` | только для фабрик тестов |
| APP_MAINTENANCE_DRIVER | `file` | — |
| LOG_DEPRECATIONS_CHANNEL | `null` | — |
| MAIL_SCHEME | `null` | почта админки не используется |
| SESSION_PATH | `/` | — |
| SESSION_DOMAIN | `null` | сессии на голом домене админки |
| PHP_CLI_SERVER_WORKERS | — | не читается нигде (умерший ключ example) |
| APP_PORT | — | не читается (php-fpm, не `artisan serve`) |
| BROADCAST_CONNECTION | — | не читается нигде |

### 2б. Намеренно различающиеся prod/staging (2 шт.)

| Ключ | Prod | Staging | Использование |
|---|---|---|---|
| IMAGE_PREFIX | *(нет → default `lovii-admin`)* | `lovii-admin-staging` | имя образа compose — разводит контуры |
| CORE_NETWORK | *(нет → default `lovii-core_default`)* | `lovii-core-staging_default` | внешняя сеть к core — разводит контуры |

Это тот самый механизм изоляции контуров: staging-ключи указывают на
staging-сеть/образ. Отсутствие в prod-.env = использование дефолта.

### 2в. FILAMENT_PATH (1 шт.) — умерший ключ example

Присутствует в `.env.example`, не читается ни config, ни compose, ни
Dockerfile. Действие: удалить из `.env.example` при следующем касании
репо (не критично).

### Итог

- **Обязательных отсутствующих ключей: 0.** Ни один «missing» ключ не
  влияет на runtime прода/стейджа.
- Различия prod/staging — 2 ключа, оба = механизм изоляции контуров.
- Действие: почистить `.env.example` admin от 4 умерших ключей
  (APP_PORT, BROADCAST_CONNECTION, PHP_CLI_SERVER_WORKERS, FILAMENT_PATH)
  + добавить в него CORE_NETWORK/IMAGE_PREFIX с комментарием «задаётся
  на контурах» — чтобы env-parity впредь был тихим на осознанных
  различиях. Снизит шум крона до нуля на admin-стеках.

## 3. Остальные стеки

core/app/b2b (prod+staging): env-parity = расхождений нет (live exit 1
дали только admin-строки). GREEN.
