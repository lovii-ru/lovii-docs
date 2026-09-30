# Deploy — процедура выката и прод-чеклист

> Создан 30.09 (zcode) как исполнение Б-2 (as-is/00): прод-деплой ни разу не
> отработан — здесь чеклист env, порядок выката, смок и откат. Сам выкат —
> ТОЛЬКО по явному «го» владельца. Соседние каноны:
> [CI_RUNNERS_SELFHOSTED](canon/CI_RUNNERS_SELFHOSTED.md) (CI/CD, раннеры),
> [PROD_STARTER](canon/PROD_STARTER.md) (стартовая БД прода),
> [BACKUPS](canon/BACKUPS.md) (бэкапы/восстановление),
> [ENV_PAYMENTS_STANDS](canon/ENV_PAYMENTS_STANDS.md) (платёжные env стендов).

## Поток релиза

- Фича-ветка → `staging` (checks на gostiny-ci-* → автодеплой стенда) →
  приёмка → `master` → **прод только вручную**:
  `gh workflow run ci.yml --repo lovii-tech/<repo> --ref master`
  (4 репо: core → b2b → admin → app).
- Деплой-джоба: SSH deploy@gostiny-prod-01 → `git reset` на релизный коммит →
  `docker compose build/migrate/up`. Контейнеры прода: `lovii-core-app-1`,
  `lovii-b2b-app-1`, `lovii-admin-app-1`, `lovii-app-web-1` (+scheduler/horizon).
- «✓ Deploy» ≠ код на стенде — проверять фактом (урок F-075: healthz/версия).

## Чеклист prod-env (заполнить/проверить в /opt/lovii-core/.env и аналогах)

| # | Параметр | Значение/действие | Отметка |
|---|---|---|---|
| 1 | `OTP_DEV_BYPASS` | **false** (в config default true — риск тишины!) | ☐ |
| 2 | `OTP_MAX_TRANSPORT` | bot_api + боевые токены ботов «Лови»/orders/support, вебхуки MAX зарегистрированы на прод-домен | ☐ |
| 3 | Telegram-поллеры | боевые токены (orders/otp/support) | ☐ |
| 4 | `YANDEX_GEOCODER_API_KEY` + `YANDEX_GEOCODER_REFERER` | в `/opt/lovii-core/.env` (staging-значения не переиспользовать вслепую) | ☐ |
| 5 | `VITE_YANDEX_MAP_API_KEY` | запечён в сборку app (env при build) | ☐ |
| 6 | `TBANK_PROD_*` | боевой терминал 1788867330861, токен lowercase, IP прода в whitelist банка, CA Минцифры на сервере | ☐ |
| 7 | `INTERNAL_ADMIN_SECRET` | одинаков в core и admin | ☐ |
| 8 | `OPERATOR_PARTNER_ID` | 265 (АКСИОМА) | ☐ |
| 9 | `payments.split.rep_subscription_gate` | решить: включать на проде сразу (EC-11) | ☐ |
| 10 | VAPID-ключи | **прод-пара** (не staging), env core | ☐ |
| 11 | SMTP Яндекс | From noreply@lovii.ru, пароль | ☐ |
| 12 | Секреты | в git не класть; ключи Т-Банка/OTP — только env сервера | ☐ |

## Порядок первого выката

1. Бэкап-план прода включить ДО выката: cron pg_dump по образцу staging
   (`~/backups/lovii-core-*.dump.gz`, ротация) — см. canon/BACKUPS.md.
2. БД: чистая + прод-стартер **v3.2** (`canon/PROD_STARTER.md`, дамп
   `~/backups/lovii-prod-starter_2026-09-28.dump.gz`): Основатель/АКСИОМА/
   транзитный счёт/кошелёк 10 000 ₽/кэшбэк дефолт 0/ИНН-замок вшит.
   tinker в образе нет — сид SQL-зеркалом проводок; schema-load в psql-контейнере.
3. core → b2b → admin → app: `gh workflow run ci.yml --ref master` по очереди,
   каждый `gh run watch <id> --exit-status`.
4. Миграции в деплой-джобе; проверить: `php artisan migrate:status | tail`,
   `config:show database` (что env не закэширован).
5. Проверить замок ИНН INSERT-ом дубля → ожидаем duplicate key
   (инструкция PROD-STARTER-LOCAL-TEST.md).

## Смок-чеклист после выката

- Вход OTP **без байпаса** — реальный канал MAX (бот «Лови»).
- Витрина открывается, карта работает (Yandex JS API), поиск отвечает.
- Контрольный заказ + оплата боевой картой → вебхук Т-Банка → CONFIRMED →
  ledger-проводки (пул 40/40/20) → квитанция.
- Вход в админку (:8001-аналог прода), «Операции ledger» читает дерево.
- Пуши: тест-пуш на устройство владельца.
- Horizon: очередь обрабатывает, no failed jobs.

## Откат

- `git reset --hard <предыдущий релизный коммит>` + `docker compose up -d
  --build` в проблемном репо; БД откатывать только восстановлением из дампа
  (canon/BACKUPS.md) — миграции вниз не гонять.
- Канарейка для пилота: один мерчант/точка как «1% трафика» — проблемный
  сценарий наблюдать на нём, полный откат при регрессе.

## Открытое (не блокирует выкат, блокирует деньги)

- 54-ФЗ: чека нет — приём денег от населения только после решения Б-6
  (или зафиксированного «нефискального» пилота владельцем).
- Боевые выплаты (Б-5): репетиция на tbank-mock, затем боевой доступ банка.
