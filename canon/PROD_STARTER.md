# Прод-стартер: каноническая стартовая сборка БД (v2, 2026-09-27 21:12)

> Состав выведен из канона и плана запуска, а не из тестовых данных:
> BRD v1.0 (Основатель, AAAAAA), FINANCIAL_CONTOUR v0.5 (оператор, номинальный счёт,
> верификация), RELEASE_READINESS §2.5/§2.6 + as-is/12 (правило кэшбэка, чек-лист env).
> Артефакт: `deploy@89.19.223.16:~/backups/lovii-prod-starter_2026-09-27.dump.gz`
> (50 КБ, `pg_restore --list` ✓). Исходник — БД `lovii_core_light` в
> контейнере `lovii-core-staging-pgsql-1` (переснять — см. конец файла).

## Состав (каждая строка — с источником)

| # | Что | Источник |
|---|---|---|
| 1 | Схема `public` — миграции на 27.09 включительно | RELEASE_READINESS §2.6 |
| 2 | Схема `lovii_b2b` (юрлица) — без данных | db-schema-analysis: юрлица живут в b2b-схеме |
| 3 | Справочник `cities` (46) | справочники прода |
| 4 | **Основатель**: `users.id=51`, `+79119287478`, Сергей BEST, verified, active, **`promo_code=AAAAAA`** | BRD v1.0 §«Основатель»: UDID `osnovatel`, Промокод `AAAAAA` — зарезервирован навсегда, неизменяем |
| 5 | **Амбассадор Основателя**: prefix `AA`, код **`AAAAAA`**, is_active («рабочий промокод для всех», подписка по нему 199₽) | BRD v1.0; DRAFT_REGISTRATION §45 |
| 6 | **Оператор платформы**: `lovii_b2b.partners.id=265` ООО «АКСИОМА» (ИНН 7842223709, active) + b2b-юзер 258 (`osnovatel`) + membership owner | FINANCIAL_CONTOUR §2 (спец-счёт АКСИОМА, договор №МР-08.26/АКС_01); код: `payments.split.operator_partner_id` |
| 7 | **Счёт оператора** `accounts(partner, 265, 0)` | FINANCIAL_CONTOUR: пул 40/40/20 → Компания |
| 8 | **Транзитный счёт** `accounts(platform_nominal, 0, 0)` | SZ-077: «транзит по транзакции строго в ноль» (`AccountOwnerType::PlatformNominal`) |
| 9 | **Правило кэшбэка 5%** (платформенное, активное, max_spend 100%) | as-is/12: «перед продом — в `loyalty_rules` должно быть активное правило», иначе кэшбэк = 0 |

Чего НЕТ (намеренно): прочих юзеров, юрлиц, мерчантов, точек, товаров, заявок,
заказов, кошельков, `payment_settings` (канал Т-Банка со секретами заводится в
админке при подключении; в дампе секретов быть не должно), кодов AA2222/AA2BTK
(артефакты тестового стенда — канону отвечает AAAAAA; вернуть AA2BTK можно одной
INSERT-строкой, если он нужен как действующий личный код).

## Чек-лист .env прода (RELEASE_READINESS §3.4, C-1; НЕ в дампе)

- `OPERATOR_PARTNER_ID=265` — иначе подписки/переводы падают RuntimeException
- `OTP_DEV_BYPASS=false` (блокер §3.4)
- `INTERNAL_ADMIN_SECRET` (C-1)
- Прод-ключ Яндекс.Карт, SMTP-доступа, ключи Т-Банк (prod-канал `bank-prod`)
- `PAYMENTS_SPLIT_REP_SUBSCRIPTION_GATE` — решить до включения подписок

## Применение на прод

```sh
gunzip -c lovii-prod-starter_2026-09-27.dump.gz | \
  docker exec -i <prod-pgsql-container> pg_restore -U <user> -d <prod-db> --no-owner
```

## Переснять (если канон изменится)

createdb `lovii_core_light` (владелец роли — `"lovii-core"`) →
`database/schema/pgsql_core-schema.sql` через psql-КОНТЕЙНЕР (в app-образе psql нет!)
→ `artisan migrate --force` (app-образ, env `DB_DATABASE=lovii_core_light`) →
schema-only `lovii_b2b` из staging (предварительно DROP пустую схему — её создаёт
ядровый дамп) → сид: founder 51/AAAAAA + ambassadors AAAAAA + partner_users 258 +
partners 265 + membership 268 + accounts(partner 265; platform_nominal 0) +
loyalty_rules «Кэшбэк 5%» → cities из staging → pg_dump -Fc.
