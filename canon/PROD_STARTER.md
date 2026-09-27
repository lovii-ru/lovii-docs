# Прод-стартер: каноническая стартовая сборка БД (v3, 2026-09-28)

> Состав выведен из канона и плана запуска, а не из тестовых данных:
> BRD v1.0 (Основатель, AAAAAA), FINANCIAL_CONTOUR v0.5 (оператор, номинальный счёт),
> RELEASE_READINESS §2.5/§2.6 + as-is/12. **Решение владельца 28.09:** кэшбэк по
> умолчанию = 0 (правил лояльности в стартере НЕТ); 5% — рекомендация МСП, каждую
> точку/мерчант настраивают свою акцию у себя в промо; ID стартовых сущностей —
> чистые, с 1. Артефакт: `deploy@89.19.223.16:~/backups/lovii-prod-starter_2026-09-27.dump.gz`
> (49 КБ, `pg_restore --list` ✓). Исходник — БД `lovii_core_light` в
> контейнере `lovii-core-staging-pgsql-1`.

## Состав (каждая строка — с источником)

| # | Что | Источник |
|---|---|---|
| 1 | Схема `public` — миграции на 27.09 включительно | RELEASE_READINESS §2.6 |
| 2 | Схема `lovii_b2b` (юрлица) — без данных | db-schema-analysis: юрлица живут в b2b-схеме |
| 3 | Справочник `cities` (46) | справочники прода |
| 4 | **Основатель**: `users.id=1`, `+79119287478`, Сергей BEST, verified, active, **`promo_code=AAAAAA`** | BRD v1.0: UDID `osnovatel`, Промокод `AAAAAA` — зарезервирован навсегда, неизменяем |
| 5 | **Амбассадор Основателя**: prefix `AA`, код **`AAAAAA`**, is_active («рабочий промокод для всех», подписка по нему 199₽) | BRD v1.0; DRAFT_REGISTRATION |
| 6 | **Оператор платформы**: `lovii_b2b.partners.id=1` ООО «АКСИОМА» (ИНН 7842223709, active) + b2b-юзер 1 (`osnovatel`, core_user_id=1) + membership owner | FINANCIAL_CONTOUR §2 (спец-счёт АКСИОМА, договор №МР-08.26/АКС_01) |
| 7 | **Счёт оператора** `accounts(partner, 1, 0)` | FINANCIAL_CONTOUR: пул 40/40/20 → Компания |
| 8 | **Транзитный счёт** `accounts(platform_nominal, 0, 0)` | SZ-077: «транзит по транзакции строго в ноль» (`AccountOwnerType::PlatformNominal`) |

## Чего НЕТ (намеренно)

- **Правил лояльности** (`loyalty_rules`/`promo_rules` пусты): кэшбэк по умолчанию
  = 0, пока точка/мерчант/МСП не настроит свою акцию в своих промо-настройках.
  5% — **рекомендованное** значение для МСП, не платформенный дефолт
  (решение владельца 28.09).
- **Канала Т-Банка** (`payment_settings` пусты): prod-канал с секретами заводится
  в админке при подключении; в дампе секретов быть не должно.
- Прочих юзеров, юрлиц, мерчантов, точек, товаров, заявок, заказов, кошельков.
- Кодов AA2222/AA2BTK — артефакты тестового стенда; канону Основателя отвечает AAAAAA.

## Чек-лист .env прода (RELEASE_READINESS §3.4, C-1; НЕ в дампе)

- `OPERATOR_PARTNER_ID=1` — оператор теперь id 1; иначе подписки/переводы падают RuntimeException
- `FOUNDER_REP_PROMO_CODE=AAAAAA` — резолвинг Основателя и фолбэк-промокод пула
  (`FounderQuery`, `DistributeOrderPoolAction`; дефолт конфига AA2222 надо перекрыть)
- `OTP_DEV_BYPASS=false` (блокер §3.4)
- `INTERNAL_ADMIN_SECRET` (C-1)
- Прод-ключ Яндекс.Карт, SMTP, ключи Т-Банк (prod-канал `bank-prod`)
- `PAYMENTS_SPLIT_REP_SUBSCRIPTION_GATE` — решить до включения подписок

## Супер-админка ( lovii-admin) — отдельный шаг запуска

Админка — отдельное приложение с СОБСТВЕННЫМ юзером (email+пароль, схема
`lovii_admin`, создаётся её деплоем). В дампе её нет и быть не должно.
После выкатки админки — создать юзера владельца (artisan tinker / SQL с
хэшем пароля). Механики «первый зарегистрированный = Основатель» в коде НЕТ:
`FounderQuery` определяет Основателя как владельца активного амбассадорского
кода `AAAAAA` (env `FOUNDER_REP_PROMO_CODE`) — поэтому сид Основателя в
стартере обязателен, на пустой БД платформа останется без Основателя
(инструменты платформы отдадут 403 всем).

## Применение на прод

```sh
gunzip -c lovii-prod-starter_2026-09-27.dump.gz | \
  docker exec -i <prod-pgsql-container> pg_restore -U <user> -d <prod-db> --no-owner
```

## Переснять (если канон изменится)

createdb `lovii_core_light` (владелец роли — `"lovii-core"`) →
`database/schema/pgsql_core-schema.sql` через psql-КОНТЕЙНЕР (в app-образе psql нет!)
→ `artisan migrate --force` (app-образ, env `DB_DATABASE=lovii_core_light`) →
DROP пустой `lovii_b2b` + schema-only `lovii_b2b` из staging → сид (файл
`/tmp/prod-starter-seed.sql` по образцу канона: users 1/AAAAAA, ambassadors 1,
partner_users 1, partners 1, membership 1, accounts operator+nominal, setval'ы
последовательностей) → cities из staging → pg_dump -Fc.
