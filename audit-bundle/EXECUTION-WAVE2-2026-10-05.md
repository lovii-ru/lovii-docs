# EXECUTION-WAVE2 — отчёт об исполнении Волны 2 (2026-10-05, ночь, «го» владельца)

Исполнитель: zcode. Волна 2 аудита CI/CD (R-2.1…R-2.5) — исполнена.

## R-2.1 — деплой только через forced-command (закрывает A-1, P0)

- `/home/deploy/bin/lovii-deploy` — единый версионируемый скрипт вместо
  8 копий heredoc: fetch → reset на SHA → build (core: docs-only skip,
  app: APP_VERSION) → [prod: pre-migrate dump] → migrate → horizon → up →
  health-check (core/b2b/admin: app:8080/healthz; app: web:9000/health).
- Whitelist стеков + scope ключа (staging/production), ref-regex без ведущего
  `-` (закрывает и A-18 для нового пути), push-before валидируется `^[0-9a-f]{40}$`.
- Workflows ×4: Deploy-шаг = `ssh … "deploy <stack> <sha> <push-before>"` —
  110 строк произвольного bash из репо исчезли.
- Негативные тесты: `id` → DENY; staging-ключ → prod-стек → DENY вне scope;
  `-b` как ref → DENY. Позитивные: деплои ×4 через ключ-в-wrapper, SHA =
  запушенному, лог `~/lovii-deploy.log` (START/OK/FAIL/DENY).

## R-2.3 — отдельные ключи по окружениям

- Пары `lovii-ci-deploy-staging` / `lovii-ci-deploy-production` (приватные
  ключи вне git, у исполнителя в lovii-security/keys-local/, каталог
  .gitignore-нут).
- authorized_keys: оба ключа `command="…/lovii-deploy <scope>",restrict` —
  staging-ключ физически не может деплоить прод.
- GitHub: environment secrets DEPLOY_SSH_KEY (staging/production) ×4 репо;
  repo-level DEPLOY_SSH_KEY удалены.
- **Старые 4 неограниченных CI-ключа (lovii-api/b2b/app/admin) удалены из
  authorized_keys.** Бэкапы authorized_keys: `.bak-20261005-wave2`,
  `.bak-20261005-postwave2`.

## R-2.2 — бэкап прод-БД (локальная часть)

- `~/bin/backup-prod-db.sh`, крон 03:47 UTC, `pg_dump -Fc`, retention 7 копий,
  первый дамп снят (393K, lovii-core-20261005T012322Z.dump).
- ⏳ off-site (S3 + object lock + write-only ключ) — ждёт bucket от владельца.
  До того это не полный R-2.2, честно помечено в ARENA-INBOX.

## R-2.4 — pre-migrate dump

В lovii-deploy: на production перед миграциями `pg_dump -Fc` в
`~/backups/pre-migrate/`; провал дампа = ABORT деплоя до миграций.

## R-2.5 — env-parity (из F-080)

`~/bin/env-parity-check.sh` + крон 05:07 UTC, лог `~/backups/env-parity.log`.
Первый прогон уже дал находки: в admin-стеках .env нет 12–16 ключей из
example (в т.ч. APP_PORT, SESSION_DOMAIN), prod/staging admin различаются
CORE_NETWORK/IMAGE_PREFIX. Не блокеры (ключи опциональные), но включены в
наблюдение; сравнение ключей prod↔staging по всем парам — в скрипте.

## Инциденты по ходу (для честности)

1. Первая версия wrapper'а: `read` не снимает кавычки → sha с кавычками
   отклонён, деплои 01:29 DENY. Фикс: strip_q + переперезапись скрипта
   (первая попытка патча через ssh-heredoc была испорчена локальной
   подстановкой `$(…)` — урок: серверные скрипты править scp-файлом, не
   heredoc-in-ssh).
2. 4 одновременных build'а уронили docker-демон (rpc EOF, «graceful_stop») —
   знакомый транзиент (был 05.10 днём); перезапуск job'ов по очереди → 🟢.
3. Пилотный деплой wrapper'ом на битый SHA (`deadbeef123`) упал на
   `git reset --hard` ДО каких-либо docker-действий — стенд не пострадал,
   поведение подтверждено.

## Приёмка

- CI ×4 🟢, деплои ×4 через forced-command, HEAD = запушенным SHA.
- `authorized_keys`: 7 ключей, из них 3 заперты forced-command'ом,
  2 — решение владельца (turokserials, как есть), 2 интерактивных (nikdm,
  admin@axiiom.ru — владелец подтверждает принадлежность).
- Канон обновлён: `canon/CI_RUNNERS_SELFHOSTED.md`, RULES lovii-tech/security.
