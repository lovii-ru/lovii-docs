# RES-012 — SZ-084 ресёрч: состояние «тихого удаления» в коде (2026-09-30)

> Источник: агенты-ресёрчеры zcode, read-only, клоны lovii-core / lovii-app /
> lovii-b2b / lovii-admin. Ссылка из карточки
> `canon/TASKS/SZ-084-silent-deletion-tombstone.md`. Только факты (file:line),
> рекомендации — в конце, отдельно.

## 1. Что уже есть (сюрпризы)

- **SoftDeletes УЖЕ включён**: `Merchant` (app/Models/Core/Merchant.php:68) и
  `MerchantBranch` (app/Models/Core/MerchantBranch.php:49) + весь каталог
  (CatalogCategory/Product, MerchantOffer, OfferModifier/Group). Миграции
  `2026_04_19_000001..000008`. Есть дизайн-спека `specs/soft-deletes-feature/2026-04-19-soft-deletes-core-design.md`
  и internal-роут force-delete каталога
  (`routes/internal.php:17` → `ForceDeleteCatalogEntityAction`, 409
  `cannot_force_delete` при FK-конфликте) — готовый прецедент «tombstone +
  отдельная системная зачистка».
- **Прецедент retention-процесса для юзера**: `PurgeDeactivatedUsersCommand`
  (app/Console/Commands/PurgeDeactivatedUsersCommand.php) — анонимизация
  деактивированных >30 дней: avatar, addresses, tokens, `phone → deleted_{id}`,
  ПД-поля. Уже в schedule (`routes/console.php:8`, daily). Т.е. выбранная
  владельцем модель «сперва деактивация, потом системная зачистка по времени»
  для профиля УЖЕ наполовину реализована — без tombstone-строки и без журнала.
- **Прецедент high-access команды**: `business:reconcile-inn-duplicates`
  (ReconcilePartnerInnDuplicates.php) — dry-run по умолчанию, `--apply`,
  снимок, `--undo`, разнос зависимостей по 10 таблицам.
- **Аудит-инфраструктура**: `partner_audit_logs` (b2b, before/after jsonb) и
  `lovii_admin.activity_log` (spatie-подобная, в SQL-дампе). В core пакета
  activitylog нет; SZ-048 в коде не реализован.

## 2. Чего нет (дыры, подтвердившие постановку)

| Сущность | SoftDeletes | Кнопка удаления в UI | Комментарий |
|---|---|---|---|
| User | ❌ (есть `status=deactivated` + `deactivated_at`) | ❌ (app: только «Выход») | Покупатель удалить аккаунт не может вовсе |
| Partner (юрлицо) | ❌ (нет deleted_at в b2b-миграциях) | ❌ (b2b PartnerResource не существует; admin — view-only) | Удаление юрлица невозможно никак |
| Merchant | ✅ | ❌ (b2b EditMerchant actions=[]; admin — только смены статусов) | Tombstone есть, UI нет |
| MerchantBranch | ✅ | ❌ (b2b EditBranch actions=[]; admin — view) | Аналогично |

Ни одного `->delete()` по этим сущностям в API/контроллерах core не найдено.
Shield-политики админки декларируют `delete/forceDelete`, но все возвращают
`false` (app/Policies/*Policy.php:34-59/45-70).

## 3. Уникальные индексы и «освобождение» данных после удаления

| Ключ | Тип | Что после soft-delete |
|---|---|---|
| `users.phone` | полный unique | занят НАВСЕГДА (поэтому purge-команда подменяет на `deleted_{id}`) |
| `partners.inn` | partial unique **WHERE verified_at IS NOT NULL** (b2b миграция 2026_04_17_120000:26-27) + обычный индекс | у неверифицированных ИНН освобождается; guard — `PartnerInnGuard` (advisory lock) |
| `merchants.slug` | partial `WHERE deleted_at IS NULL` (2026_04_19_000008) | эталонный паттерн: slug освобождается после tombstone |
| `merchant_offers.external_id` | partial (там же) | эталон |
| `representative_promo_codes.code`, `ambassadors.code/prefix/user_id` | полные unique | не освобождаются |
| `merchant_branches` | уникальных индексов нет | ограничений на пересоздание нет вообще |

⚠️ В карточке SZ-084 и памяти фигурировал `partners_inn_digits_unique` —
такого индекса в коде НЕТ (фактический — `partners_inn_verified_unique`,
проверка по дампу T-027 требуется отдельно: возможно, включался руками на
staging-БД, но в миграциях его нет → при развёртывании прода потеряется).

## 4. Зависимости (что снесёт/не снесёт удаление)

- **Финансовый контур — главная мина**: `accounts.owner_type/owner_id` —
  polymorphic-строка БЕЗ FK (unique(owner_type, owner_id)); `ledger_entries.account_id`
  → **cascadeOnDelete** — удаление счёта снесёт проводки. Физическое удаление
  user/partner счёт не трогает (нет FK) — сирота с уникальным ключом, что
  блокирует пересоздание. Вывод: физический DELETE строк user/partner в лоб
  недопустим; зачистка = анонимизация (как purge-команда), не DELETE.
- **orders**: FK на user/merchant/branch БЕЗ onDelete (RESTRICT) → force-delete
  сущности с заказами невозможен без разрыва истории (ещё один довод за
  анонимизацию).
- **User-каскады (cascadeOnDelete)**: push_subscriptions, personal verification,
  representative_promo_codes, ambassadors, communication_consents,
  subscriptions, external_payment_methods, payouts, pep_reports. nullOnDelete:
  cards, partner_applications.rep_user_id. Без действия: wallets, sessions.
- **Merchant**: branches (FK без действия), catalog_products, merchant_offers,
  merchant_categories+N:M, delivery_zones, integration_profiles, integrations,
  carts, ledger_entries.merchant_id (nullable, без FK). Loyalty-правила —
  глобальная таблица `loyalty_rules` БЕЗ merchant_id (PromoResolver 764 стр.) —
  привязки мерчанта в правилах искать по-другому (вопрос к фазе проектирования).
- **Branch**: category_branch_hidden (cascade), partner_applications
  (nullOnDelete), delivery_zones, ledger_entries.branch_id, orders (RESTRICT).
- **Каналы доступа**: app → только HTTP API (axios); **b2b и admin пишут в
  core-схему НАПРЯМУЮ** (`pgsql_core`, Eloquent + raw SQL; CoreApiClient —
  только auth/OTP). Значит сервис удаления живёт в core (модель/экшен), а
  b2b/admin могут вызывать его только через HTTP internal-API (прецедент:
  `routes/internal.php`) — иначе логика размножится на три репо.

## 5. Инфраструктура для retention-процесса

Schedule — `routes/console.php` (Laravel 11+ стиль); очереди — database +
Horizon (critical|default|low); прецеденты команд с dry-run/snapshot/undo есть.
Журнал зачистки: готового канонного места нет — `partner_audit_logs` (b2b) и
`lovii_admin.activity_log` (admin) не подходят для core-процесса; нужен свой
append-only журнал (простая таблица) или прецедент SZ-048 дожать.

## 6. Рекомендации ресёрча (не решения — развилки в карточке)

1. Не изобретать схему: взять канон каталога (SoftDeletes + partial unique
   `WHERE deleted_at IS NULL` + internal force-delete с 409) как эталон для
   user/partner.
2. Профиль: не вводить deleted_at у users, а доукомплектовать существующую
   пару `status=deactivated` + purge-команду (добавить журнал, ПИИ-обезличивание
   расширить, «высокий доступ» = `--apply` + подтверждение). Это дешевле и уже
   в проде по смыслу.
3. Телефон: полный unique — анти-фрод уже работает «навсегда»; решить
   (развилка №5), нужно ли обратное (освобождение по retention) — тогда
   конвертация в partial, как slug у мерчантов.
4. Удаление partner — самое тяжёлое (отдельная БД lovii_b2b, MERGE-прецедент
   `business:reconcile-inn-duplicates` = готовый механизм разноса зависимостей).
5. Всё удаление — через core-сервис; b2b/admin — internal HTTP, не прямые
   DELETE из Filament (Shield и так всё запрещает — оставить так до решения).

## 7. Доресёрч: индустриальные лучшие практики (веб-ресёрч 2026-09-30)

### 7.1 Двухступенчатая модель — консенсус индустрии

Стандарт де-факто совпадает с постановкой владельца: **немедленная
деактивация/tombstone (undo + аудит) → отложенная системная зачистка по
retention-расписанию из центральной таблицы запросов на удаление**. Soft-delete
сам по себе НЕ считается достаточным для стирания ПИИ — данные должны стать
нечитаемыми. Для finance-платформ работает трёхуровневая сортировка ответа на
запрос стирания: маркетинговые/профильные данные — удалять сразу;
записи под statutory retention (AML/KYC, бухгалтерия, 5–10 лет) — не
отказывать пользователю, а информировать о сроке удержания; всё удержанное —
псевдонимизировать. Легальная основа — GDPR Art. 17(3)(b) (исключение для
юридической обязанности хранения); истинная анонимизация выводит данные
из-под GDPR целиком (Recital 26). Вывод для LOVII: существующая пара
`deactivated_at + purge-команда` — правильный каркас, доукомплектовать, а не
менять.

### 7.2 Анонимизация вместо DELETE — подтверждено

Финансовые записи ломаются полным удалением (отчётность, audit trail) —
паттерн индустрии: **псевдонимизация/шифрование удержанных записей, ПИИ из
профиля — удалить**, не-PИИ каркас оставить. Продвинутый вариант — «удалить
ключ шифрования + tombstone» (криптографическая невосстановимость при
сохранении структуры), для нас избыточен, но пригодится, если появятся
шифрованные ПИИ-поля. Это независимо подтверждает вывод §6 ресёрча кода:
DELETE строк user/partner недопустим, зачистка = обезличивание.

### 7.3 Запрет пересоздания — реестр хэшей идентификаторов

Практика анти-фрода: хранить в блок-реестре **не сырые данные, а
нормализованные HMAC-хэши** идентификаторов (телефон в E.164, email — lower/trim)
— это одновременно anti-frod матчинг и совместимость с ПИИ-зачисткой
(сырой телефон удаляем по retention, хэш живёт в реестре со своим TTL).
Рекомендации: ре-бан при совпадении хэша (новый аккаунт наследует
ограничения/ревью), velocity-проверки, TTL по номерам (перевыпускаются другим
людям — стейл-записи дают false positives), осторожность с SMS как якорем
доверия (SIM swap, VoIP). Для LOVII это точный ответ на развилку №5 карточки:
**отдельный реестр хэшей, не tombstone-строка** — и retention-счётчик, и
совместимость с зачисткой.

### 7.4 Техника PostgreSQL/Laravel — подтверждён наш паттерн

Канон для «уникальность среди живых» — **partial unique index
`WHERE deleted_at IS NULL`** (именно так сделаны merchants.slug и
merchant_offers — §3). Тонкости из практики: Laravel Blueprint не выражает
WHERE — нужен raw `DB::statement` (или пакет tpetry/laravel-postgresql-enhanced);
schema-интроспекция Laravel partial unique не видит (проверять миграциями, не
дампом); `deleted_at` стоит держать под частичным индексом, иначе фильтр
soft-delete раздувает запросы на больших таблицах. Альтернатива при больших
объёмах удалений — **archive-таблица** (уносим строку целиком из живой таблицы:
уникальность живых тривиальна, индексы чистые), ценой сложности restore и FK.
Для наших объёмов archive-таблица не нужна, но годится как целевое состояние
после retention-зачистки каркаса.

### Источники

- [Reform: Best Practices for GDPR-Compliant Data Deletion](https://www.reform.app/blog/best-practices-gdpr-compliant-data-deletion)
- [Medium: Hard vs Soft delete user data](https://medium.com/@mtreacy002/hard-vs-soft-delete-user-data-forget-me-or-forget-me-not-e5b564363607)
- [HN: soft deletes discussion](https://news.ycombinator.com/item?id=16366050)
- [DBA StackExchange: tombstone table vs deleted flag](https://dba.stackexchange.com/questions/14402/)
- [koder.ai: soft deletes vs hard deletes](https://koder.ai/blog/soft-deletes-vs-hard-deletes)
- [Wikipedia: GDPR Article 17](https://en.wikipedia.org/wiki/General_Data_Protection_Regulation)
- [filerskeepers: practical data retention policy guide](https://filerskeepers.com)
- [tpetry/laravel-postgresql-enhanced — partial indexes](https://packagist.org/packages/tpetry/laravel-postgresql-enhanced)
- [GitHub: partial unique index introspection issue](https://github.com)
