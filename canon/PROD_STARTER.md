# Прод-стартер: лайт-сборка БД (создана 27.09.2026)

> Готовый к запуску прода дамп: свежая схема + справочники + каноничная регистрация
> Основателя. Никакого другого контента. Артефакт на сервере gostiny-prod-01:
> `deploy@…:~/backups/lovii-prod-starter_2026-09-27.dump.gz` (43 КБ, проверен
> `pg_restore --list`). Исходник — БД `lovii-core-light` в контейнере
> `lovii-core-staging-pgsql-1` (можно переснять в любой момент).

## Состав

- Полная схема (миграции на 27.09 включительно, `category_branch_hidden` есть).
- Справочник `cities` (46 записей — как на staging).
- **Основатель:** `users.id=51`, `+79119287478`, Сергей BEST, phone_verified,
  status=active, `promo_code=AA2222`.
- `ambassadors`: prefix `AA`, код `AA2222`, is_active (платформенный код основателя).
- `representative_promo_codes`: `AA2222` (is_active=false — платформенный дубль)
  и **`AA2BTK` (is_active=true — личный код основателя)**.
- НЕТ: юрлиц, мерчантов, точек, товаров, заявок, заказов, кошельков, прочих юзеров.

## Как применить на прод (при старте)

```sh
# на прод-сервере, в прод-контейнер postgres (БД должна быть ПУСТАЯ по схеме):
gunzip -c lovii-prod-starter_2026-09-27.dump.gz | \
  docker exec -i <prod-pgsql-container> pg_restore -U <user> -d <prod-db> --no-owner
# затем: env прода (APP_KEY, ключи Т-Банк/MAX/DaData) отдельно в /opt/lovii-core/.env
```

Секреты в дампе НЕ содержатся (users без паролей — вход только по OTP).

## Переснять (если канон основателя изменится)

Скриптом повторить: createdb `lovii-core-light` → load `database/schema/pgsql_core-schema.sql`
через psql-КОНТЕЙНЕР (в app-образе psql нет!) → `artisan migrate --force` (app-образ,
env с `DB_DATABASE=lovii-core-light`) → скопировать cities/users/ambassadors/
representative_promo_codes со staging → pg_dump -Fc.
