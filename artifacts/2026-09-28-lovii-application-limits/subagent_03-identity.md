# Модель идентичности заявки: «одна точка / один МСП = одна заявка»

Роль 3 · Раунд 1 · read-only расследование. Код не менялся, ничего не публиковалось.
Все цитаты — из `~/LOVII/lovii-core` и стенда `docker exec lovii-core-pgsql-1 psql -U sail -d laravel`.

---

## 0. Короткий ответ

| Уровень | Ключ идентичности | Почему так |
|---|---|---|
| **МСП (юрлицо/ИП)** | нормализованный **ИНН** (только цифры, 10 или 12 знаков) | ИНН присваивается государством и уникален для одного лица; длина 10 = ЮЛ, 12 = ИП, поэтому 10- и 12-значные никогда не сталкиваются |
| **Точка** | **ИНН + место** (нормализованный «ключ места») | одно юрлицо открывает много точек по разным адресам — ИНН один, а точки разные |
| **Ключ места** | `geo` (округлённые координаты) **или** `addr` (нормализованный город + дом/улица) | координаты точны там, где есть; адрес-строку нельзя брать «как есть» (регистр, «Россия,», опечатки, «к.»/«корп.») |

Итоговая формула одной заявки:

```
identity_key = {ИНН} | {ключ места}          — для заявки точки
identity_key = {ИНН} | no-point              — для заявки без адресуемой точки (МСП-уровня)
```

Ключ — **глобальный по идентичности**, `user_id` в него **не входит** (одну и ту же точку не должны заводить двумя людьми; второй податель должен прицепиться к существующей — это тот же приём, что уже реализован для «своего верифицированного юрлица» в SZ-050 Ф2).

**Не только ИНН** — доказано данными: в стенде под ИНН `7842216839` лежат минимум три *разные* точки (см. §4). Схлопывание по одному ИНН уничтожило бы две из трёх.

**Не адрес-строка** — доказано данными: та же точка может прийти как `«Россия, Санкт-Петербург, улица Белы Куна, 4к1»` и как `«белы куна 6»`, а в одном случае город вообще не пришёл (`city_name = NULL`). Сырая строка их не склеит там, где надо, и склеит там, где не надо.

**Для МСП нужен другой, более грубый ключ** (только ИНН), а не «тот же, что для точки»: у МСП места нет по определению.

---

## 1. Что реально приходит в заявку (вход)

`app/Http/Requests/Api/V1/CreatePartnerApplicationRequest.php` — полный набор полей и правила:

| Поле | Правило | Обязательность по факту |
|---|---|---|
| `name` | `required, string, max:255` | обязательный |
| `inn` | `required, string, new InnChecksum()` | обязательный, 10/12 цифр + контрольная сумма |
| `activity_type` | `sometimes, nullable, Rule::enum(PartnerActivityType::class)` | **необязательное** (SZ-076, вырезан из формы 2026-09-25) |
| `address_line` | `required, string, max:500` | **обязательный** |
| `city_name` | `nullable, string, max:255` | **необязательный** — может быть `NULL` |
| `lat` | `nullable, numeric, between:-90,90` | **необязательный** |
| `lon` | `nullable, numeric, between:-180,180` | **необязательный** |
| `phone` | `required, string, regex:/^\+[1-9]\d{7,14}$/` | обязательный, E.164 |
| `email` | `nullable, string, email:filter, max:255` | необязательный |
| `promo` | `nullable, string, size:6, alpha_num` | необязательный |
| `offer_accepted` | `accepted` | обязательный (иначе 422) |
| `pdn_accepted` | `accepted` | обязательный (иначе 422) |

Вывод для ключа: единственные **обязательные** «местные» поля — `address_line`; `city_name`, `lat`, `lon` могут отсутствовать. Значит ключ места обязан уметь работать **от одной строки адреса**, а координаты — предпочтительный, но не гарантированный вход.

Нормализация ИНН уже есть в коде — `CreatePartnerApplicationAction::execute()`:
```php
$inn = (string) preg_replace('/\D+/', '', (string) $data['inn']);
```
То есть «сырой» ИНН с пробелами/дефисами приводится к цифрам. Это надо переиспользовать как часть ключа.

---

## 2. Что реально есть в БД (схема)

### `partner_applications` (фактическая, `\d` на стенде)
Значимые колонки: `id`, `user_id`, `name`, `inn`, `activity_type`(null), `address_line`(500, NOT NULL), `city_name`(null), `lat numeric(10,7)`(null), `lon numeric(10,7)`(null), `phone`, `email`, `status`(32), `dadata_party`, `verification_suffix`, `partner_id`, `merchant_id`, `branch_id`, `city_id`(null, FK `cities`), `promo_code`, `representative_user_id`, `rep_approved_at/rejected_at/reason`, `created_at`, `updated_at`.

Индексы на стенде (`pg_indexes`):
```
partner_applications_pkey                          UNIQUE (id)
partner_applications_user_id_created_at_index      (user_id, created_at)
partner_applications_status_index                  (status)
partner_applications_partner_id_index              (partner_id)
partner_applications_promo_code_index              (promo_code)
```
**Уникального ключа по точке/ИНН/адресу нет** — подтверждено. `inn` не индексирован вовсе.

### `merchants` (`create_merchants_table` + `2026_04_13_000001` + `2026_04_17_000001`)
`id, name, slug(unique), merchant_type, status, ..., phone, inn(null), ogrn, legal_name, legal_address, legal_form, kpp, dadata_raw, partner_id(null)`. Уникальности по `inn` нет (только `slug`).
Факт: под ИНН `7842216839` — 10 разных merchants.

### `merchant_branches` (`create_merchant_branches_table` + `add_location` + `add_partner_id` + soft deletes)
`id, merchant_id(NOT NULL), city_id(NOT NULL), name(null), status, address_line(NOT NULL), pickup/delivery, ..., timezone(null), location geography(POINT,4326), partner_id(null), deleted_at`.
**`lat`/`lon` как колонок нет** — координаты живут в `location geography`. Сравнение координат — через `ST_Y(location::geometry)`/`ST_X(...)` или `ST_DWithin`.
Факт: под точкой `Белы Куна, 4к1` — 6 разных branch (id 672–678), по одному на каждую дублевую заявку.

### `partners` (схема `lovii_b2b`, `lovii-b2b/database/migrations/0001_01_01_000002_create_partners_table.php`)
`id, name, slug(unique), status, owner_user_id, contact_email, contact_phone`. **Поля `inn` в миграции нет** — но экшен пишет `'inn' => $application->inn` при создании Partner, значит колонка добавлена позже отдельной миграцией (`dadata_party`, `verified_at`, `inn`). Уникальности по `inn` нет — дубли партнёров возможны (это и есть механизм «съедания слотов» из ролей 1–2).

### `cities`
`id, name, slug, region_name, country_code, timezone, is_active, sort_order, location geography`. На стенде всего 3 города: `3 Санкт-Петербург`, `4 Мурино`, `51 Томск`.

---

## 3. Как нормализуется сейчас (`CreatePartnerApplicationAction`)

- **ИНН**: `preg_replace('/\D+/', '', ...)` → только цифры.
- **Город**: `resolveCity()` и `resolveCityId()` используют `App\Domain\Geo\Services\CityNameNormalizer`:
  - `displayName()` — trim, снятие префикса `«г.»`, схлопывание пробелов;
  - `key()` — lowercase, `ё→е`, снятие `«г.»`, удаление всех не-алфанум. `«Санкт-Петербург»` и `«Санкт Петербург»` → `санктпетербург`.
- **Адрес**: нормализации **нет** — `address_line` пишется как пришёл (`'address_line' => (string) $data['address_line']`), в `merchant_branches.address_line` — тоже как есть.
- **Координаты**: пишутся как пришли; в branch — в `location` через `ST_SetSRID(ST_MakePoint(lon,lat),4326)`.
- **Дедупликация**: только 
  ```php
  ->where('user_id', $user->id)->where('inn', $inn) ... first(fn($a) => $a->status->isPreVerification())
  ```
  `isPreVerification()` = `Draft, Submitted, AwaitingRepApproval, InvoiceIssued, AwaitingPayment` (без `Verifying`!). После `Verified/Failed/Expired` (`isFinal()`) — новая строка. Комментарий в enum прямо это фиксирует: *«Финальные статусы: повторная подача с тем же ИНН создаёт новую заявку»*.

То есть сегодня «одна заявка» == «один `user_id` + один ИНН, пока не финализирована». Это ровно то, что описано в диагнозе: после 5 отказов — 5 строк.

---

## 4. Фактические данные (главное доказательство)

15 последних заявок (выборка): `total=15, distinct inn=6, lat IS NULL=5, city_name IS NULL=2, city_id IS NULL=5`.

Группа одного ИНН `7842216839` (10 строк!):

| id | name | address_line | city_name | lat | lon | phone | status |
|---|---|---|---|---|---|---|---|
| 6 | ООО "АТМОСФЕРА" | `белы куна 6` | Санкт-Петербург | — | — | (пусто) | verified |
| 8 | Пончики на завтрак | `Россия, Санкт-Петербург, улица Белы Куна, 6к1` | Санкт-Петербург | 59.870854 | 30.377493 | +79119287478 | verified |
| 9 | Академия | `Россия, Санкт-Петербург, улица Белы Куна, 16` | Санкт-Петербург | 59.873451 | 30.384014 | +79119287478 | verified |
| 12 | Тест T-018 | `Санкт-Петербург, тестовый адрес 1` | Санкт-Петербург | — | — | +79117018118 | invoice_issued |
| 28 | Пекарня "Пышечная" | `Россия, Санкт-Петербург, улица Белы Куна, 4к1` | Санкт-Петербург | 59.870493 | 30.375570 | +79119287478 | failed |
| 29 | Пекарня "Пышка" | `...Белы Куна, 4к1` | Санкт-Петербург | 59.870493 | 30.375570 | +79119287478 | failed |
| 31 | Пекарня "Пышка" | `...Белы Куна, 4к1` | Санкт-Петербург | 59.870493 | 30.375570 | +79119287478 | failed |
| 32 | Пекарня "Пышка" | `...Белы Куна, 4к1` | Санкт-Петербург | 59.870493 | 30.375570 | +79119287478 | failed |
| 33 | Пекарня "Пышка" | `...Белы Куна, 4к1` | Санкт-Петербург | 59.870493 | 30.375570 | +79119287478 | failed |
| 34 | Пекарня "Пышка" | `...Белы Куна, 4к1` | Санкт-Петербург | 59.870493 | 30.375570 | +79119287478 | failed |

Проверка группировкой:
```
SELECT inn, lat, lon, count(*) FROM partner_applications GROUP BY inn, lat, lon HAVING count(*)>1;
 7842216839 |            |            |  2   ← id 6, id 12 (без координат, разные адреса)
 7842216839 | 59.8704930 | 30.3755700 |  6   ← id 28,29,31,32,33,34 — ОДНА точка, шесть заявок
```
`user_id 51` — 12 заявок.

**Что это доказывает:**
1. **ИНН недостаточно.** id 8 (`6к1`, 59.870854/30.377493), id 9 (`16`, 59.873451/30.384014), id 28–34 (`4к1`, 59.870493/30.375570) — три **разных** физических точки одного юрлица. Ключ по одному ИНН их бы схлопнул — потеря данных.
2. **Адрес-строка недостаточно.** id 28–34 — «одна точка, шесть заявок» (это баг владельца). При этом id 6 (`белы куна 6`, без координат, другой регистр/формат) и id 8 (`…Белы Куна, 6к1`, с координатами) — формально разные дома (6 против 6к1), и branch'и у них тоже разные (1024: 59.871075/30.378705 против 1025: 59.870854/30.377493, ~250 м). То есть строку нельзя ни слепо склеивать, ни слепо различать.
3. **Координаты — самый надёжный якорь** там, где есть: у id 28–34 они совпадают до 7-го знака (одна и та же подсказка клиента/геокодер).
4. **5 из 15 заявок вообще без координат**, 2 — без `city_name`, 5 — без `city_id`. Ключ обязан работать и в этом режиме.

---

## 5. Предлагаемая модель

### 5.1. Поля ключа и нормализация

Новый сервис `App\Domain\Business\Services\PartnerApplicationIdentity` (создать; переиспользуется экшеном и миграцией бэкфилла):

```
inn        = preg_replace('/\D+/','', inn)                     // 10 или 12 цифр
placeKey   :
  если lat !== null && lon !== null:
      'geo|' + round(lat, 4) + '|' + round(lon, 4)              // 4 знака ≈ 11 м
  иначе:
      'addr|' + cityKey + '|' + addressKey
        cityKey    = CityNameNormalizer::key(city_name ?? '')   // как уже принято в проекте
        addressKey = normalizeAddress(address_line)
identityKey = inn + '|' + placeKey
```
где `normalizeAddress()` — новая детерминированная функция:
```
mb_strtolower → ё→е
удалить «россия», «российская федерация», префиксы «г», «город»
удалить слова: ул, улица, проспект, пр-т, пр-кт, переулок, пер, шоссе, ш,
               д, дом, к, корп, корпус, строение, стр, литера, кв, квартира,
               помещение, пом, офис, этаж, подъезд
оставить только буквы/цифры, схлопнуть пробелы → trim
```
Округление координат до 4 знаков — компромисс: гасит джиттер геокодера (десятки сантиметров), но не склеивает соседние дома.

Если место определить нельзя совсем (теоретически: `address_line` пуст — но он NOT NULL/`required`, так что не бывает), ключ деградирует до `inn + '|no-point'`.

### 5.2. Где хранить

Отдельная материализованная колонка `partner_applications.identity_key varchar(160)`, заполняемая **приложением** (в `CreatePartnerApplicationAction`), а **не** генерируемая в SQL. Причина: нормализация требует `mb_*`/`Ё`/кириллицы, которые в Postgres как IMMUTABLE-выражение хрупки и collation-зависимы; один и тот же PHP-класс должен считать ключ и в рантайме, и в бэкфилле. Наличие колонки позволяет сделать обычный (btree) уникальный индекс и читаемые запросы.

### 5.3. Скоуп уникальности — глобальный, с сохранением истории

Владелец: «это одна заявка, а не пять». Значит целевая семантика — **одна каноническая заявка на точку**, а повторные подачи/отказы — это её состояния. Чтобы не потерять историю и не ломать уже накопленные строки, вводим:
- `identity_key` — ключ;
- `merged_into_application_id bigint NULL` (self-FK) — пометка «дубль, слит в канон»;
- уникальный **partial**-индекс `UNIQUE (identity_key) WHERE merged_into_application_id IS NULL`.

Так: одна живая заявка на ключ (индекс), а старые дубли остаются в БД со ссылкой на канон (аудит), но в лимитах/выдачах не участвуют.

> Союзное изменение в коде (вне этого артефакта, «код не правь»): `CreatePartnerApplicationAction` сейчас делает `PartnerApplication::query()->create(...)`. После наката индекса повторная подача обязана **находить** строку по `identity_key` и делать `update` (сброс статуса в `submitted`, обновление полей), иначе будет `SQLSTATE 23505`. Это и есть реализация просьбы «менять статус прежней, а не создавать новую». Индекс — страховочная сетка от гонок и старых клиентов, а не замена правки экшена.

---

## 6. Миграция (готова к применению)

Порядок: добавить колонки → бэкфилл `identity_key` PHP-нормалайзером → слить дубли → создать partial unique index.

### 6.1. Laravel-миграция (конвенция проекта)

`database/migrations/2026_09_28_100001_add_identity_key_to_partner_applications.php`

```php
<?php

declare(strict_types=1);

use App\Domain\Business\Services\PartnerApplicationIdentity;
use App\Models\Core\PartnerApplication;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ключ идентичности заявки: одна точка / один МСП = одна заявка.
 * identity_key = {норм. ИНН} | {geo|4-dec-координаты  ИЛИ  addr|город|адрес}.
 * Уникальность — частичная, по «живым» (не слитым) строкам; старые дубли
 * помечаются merged_into_application_id и остаются как история.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('partner_applications', function (Blueprint $table): void {
            $table->string('identity_key', 160)->nullable()->after('inn');
            $table->unsignedBigInteger('merged_into_application_id')->nullable()->after('branch_id');
            $table->index('identity_key');
            $table->foreign('merged_into_application_id')
                ->references('id')->on('partner_applications')->nullOnDelete();
        });

        // 1) Бэкфилл ключа тем же PHP-нормалайзером, что и рантайм.
        PartnerApplication::query()->orderBy('id')->chunkById(200, function ($applications): void {
            foreach ($applications as $application) {
                $key = PartnerApplicationIdentity::key([
                    'inn' => (string) $application->inn,
                    'city_name' => $application->city_name,
                    'address_line' => (string) $application->address_line,
                    'lat' => $application->lat,
                    'lon' => $application->lon,
                ]);

                DB::table('partner_applications')
                    ->where('id', $application->id)
                    ->update(['identity_key' => $key]);
            }
        });

        // 2) Слить уже существующие дубли: канон — verified, иначе самый ранний.
        DB::statement(<<<'SQL'
            WITH ranked AS (
                SELECT id,
                       first_value(id) OVER (
                           PARTITION BY identity_key
                           ORDER BY (status = 'verified') DESC, id ASC
                       ) AS canonical_id
                FROM public.partner_applications
                WHERE identity_key IS NOT NULL
            )
            UPDATE public.partner_applications a
            SET merged_into_application_id = r.canonical_id
            FROM ranked r
            WHERE a.id = r.id
              AND r.canonical_id <> a.id
        SQL);

        // 3) Уникальность по «живым» строкам.
        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX partner_applications_identity_key_unique
                ON public.partner_applications (identity_key)
                WHERE merged_into_application_id IS NULL
                  AND identity_key IS NOT NULL
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS public.partner_applications_identity_key_unique');

        Schema::table('partner_applications', function (Blueprint $table): void {
            $table->dropForeign(['merged_into_application_id']);
            $table->dropIndex(['identity_key']);
            $table->dropColumn(['identity_key', 'merged_into_application_id']);
        });
    }
};
```

### 6.2. Голый SQL (эквивалент шагов 1–3, если накатывать вручную)

```sql
BEGIN;

ALTER TABLE public.partner_applications
    ADD COLUMN identity_key varchar(160) NULL,
    ADD COLUMN merged_into_application_id bigint NULL;

ALTER TABLE public.partner_applications
    ADD CONSTRAINT partner_applications_merged_into_fk
    FOREIGN KEY (merged_into_application_id)
    REFERENCES public.partner_applications(id) ON DELETE SET NULL;

CREATE INDEX partner_applications_identity_key_index
    ON public.partner_applications (identity_key);

-- 1) Бэкфилл ключа. Здесь — SQL-приближение тех же правил;
--    для полной идентичности с рантаймом предпочтителен PHP-шаг из 6.1.
UPDATE public.partner_applications
SET identity_key =
      regexp_replace(inn, '\D', '', 'g')
      || '|' ||
      CASE
        WHEN lat IS NOT NULL AND lon IS NOT NULL
          THEN 'geo|' || to_char(round(lat, 4), 'FM990.0000') || '|'
                     || to_char(round(lon, 4), 'FM990.0000')
        ELSE 'addr|'
             || regexp_replace(
                  regexp_replace(
                    regexp_replace(lower(coalesce(city_name, '')), 'ё', 'е', 'g'),
                    '[^a-z0-9а-я]', '', 'g'),
                  'россия|город', '', 'g')
             || '|'
             || regexp_replace(
                  regexp_replace(lower(address_line), 'ё', 'е', 'g'),
                  '[^a-z0-9а-я]', '', 'g')
      END;

-- 2) Слияние существующих дублей (канон — verified, иначе минимальный id).
WITH ranked AS (
    SELECT id,
           first_value(id) OVER (
               PARTITION BY identity_key
               ORDER BY (status = 'verified') DESC, id ASC
           ) AS canonical_id
    FROM public.partner_applications
    WHERE identity_key IS NOT NULL
)
UPDATE public.partner_applications a
SET merged_into_application_id = r.canonical_id
FROM ranked r
WHERE a.id = r.id
  AND r.canonical_id <> a.id;

-- 3) Уникальность «живых» строк.
CREATE UNIQUE INDEX partner_applications_identity_key_unique
    ON public.partner_applications (identity_key)
    WHERE merged_into_application_id IS NULL
      AND identity_key IS NOT NULL;

COMMIT;
```

### 6.3. Что произойдёт на текущем стенде при накате

- Группа `7842216839 | geo|59.8705|30.3756` (id 28,29,31,32,33,34) — 6 строк станут 1 каноном (id 28, `failed`) + 5 слитых. Индекс соберётся без конфликта.
- Остальные заявки уникальны по ключу → не трогаются.
- Порядок шагов специально такой: **сначала пометить дубли, потом создавать UNIQUE-индекс** — иначе `CREATE UNIQUE INDEX` упадёт на существующих дублях.
- Если в другой среде найдутся дубли среди уже «слитых» групп — слияние идемпотентно (повторный прогон ничего не меняет).

---

## 7. Нужен ли МСП отдельный ключ — да, более грубый

| | МСП | Точка |
|---|---|---|
| Ключ | `inn` | `inn` + `placeKey` |
| Одна запись = | одно юрлицо/ИП | одна физическая точка |
| Сколько строк у ИНН `7842216839` | 1 | ≥3 (id 8, id 9, id 28-группа) |
| Заявка без точки (нет координат/адреса) | `inn\|no-point` | — |

Практический смысл двухуровневости: заявка без координат (5 из 15 на стенде) физически создаёт `Partner`+`Merchant`, но **не** создаёт `MerchantBranch` (`materializeBranchDraft()` возвращает `null`, если `lat === null || lon === null` или город не резолвится). Такая заявка — «МСП-уровня». Её ключ `inn|no-point` не должен конфликтовать с ключом реальной точки `inn|geo|...` того же юрлица, и наоборот. Поэтому ключи и разделены префиксом места.

Дополнительно: правило SZ-050 Ф2 уже трактует «тот же ИНН своего верифицированного юрлица» как **новый бренд, а не новое МСП** (`findOwnedVerifiedPartnerByInn()` + `attachBrandToVerifiedPartner()`). Это подтверждает: идентичность МСП = ИНН, а «бренд/точка» живёт на уровень ниже.

---

## 8. Риски

1. **Ложная склейка двух разных МСП.** ИНН уникален по закону, но ввод — ручной. Ошибка в цифре ИНН (даже с валидной контрольной суммой) заведёт точку под чужое юрлицо. Митигация: ИНН-ключ уже проверяется `InnChecksum` и сверяется с DaData (`dadata_party`); при расхождении `dadata.shortName` и `name` — не сливать, а помечать на ручной разбор. 10- и 12-значные ИНН не коллизируют (разная длина).
2. **Ложная склейка разных точек при адресном ключе (без координат).** Классика: торговый центр, в котором два разных арендатора с **одним ИНН** (или две точки одной сети в одном здании). Тогда `addr|город|адрес` совпадёт → ложное слияние. Митигация: (а) такие строки идут без `geo` только когда клиент не дал координаты — их 5/15; (б) для `addr`-ветки можно ввести «мягкий» режим: не блокировать жёстко, а возвращать существующую заявку с пометкой «на проверку»; (в) в идеале — добиться, чтобы мобильный клиент всегда присылал координаты (тогда `addr`-ветка почти не используется).
3. **Старые клиенты без координат.** 5 из 15 строк на стенде. Их ключ всегда `addr`-ветка. Если у части таких строк `city_name = NULL` и адрес без города — ключ места слабый (только улица/дом). Риск ложного слияния точек-тёзок в разных городах. Митигация: при `city_name = NULL` **не** выкидывать город из строки адреса, а парсить его из `address_line` (`«г Москва, …»` → `москва`); если и это не удалось — ключ помечать как `addr-weak` и не применять жёсткий unique (только «мягкая» дедупликация).
4. **`city_name = NULL` при заполненном `address_line`.** Зафиксирован факт: id 3 `city_name=NULL`, id 7 `city_name=''`, но адрес содержит город (`«г Москва, ул Большая Садовая, д 14»`). Если ключ считает город только из `city_name`, то две точки одного ИНН в разных городах (например, Москва и Питер) при `city_name=NULL` схлопнутся по адресу-без-города только если улицы/дома совпадут — маловероятно, но необходимость парсить город из `address_line` остаётся.
5. **Координатный джиттер / разные геокодеры.** Округление до 4 знаков (~11 м) гасит джиттер. Но если один клиент прислал координаты по центроиду здания, а другой — по входу, разница может превысить 11 м → одна точка станет двумя. Митигация: сравнение не только по равенству, но и по близости (`ST_DWithin(location, point, 25)`); в уникальный индекс близость не зашить — поэтому рекомендуется «мягкий» добор существующей заявки по расстоянию до вставки.
6. **Слияние стирает материализованные черновики.** На стенде у id 28–34 — **шесть** разных `merchant` (1370–1376) и **шесть** `branch` (672–678). Пометка `merged_into` не удаляет эти сущности; они продолжат занимать лимит неверифицированных партнёров (проблема ролей 1–2). Слияние заявок должно сопровождаться отдельной реконсиляцией/`trash` лишних Partner/Merchant/Branch — вне этого артефакта.
7. **Гонка на вставке.** Unique-индекс — последний барьер: две одновременные подачи одной точки дадут `23505` на второй. Экшен должен ловить это и возвращать существующую (как сейчас `created: false`), а не 500.

---

## 9. Не проверено (и почему)

- **Прод vs стенд.** Наблюдения — только по dev-стенду `lovii-core-pgsql-1`. Есть ли те же 6× дубли в проде — не проверял (доступа/данных нет).
- **Мобильный клиент.** Не смотрел репозиторий приложения: делает ли кнопка «Исправить и отправить заново» новый POST (→ новая строка) или нет; присылает ли она `lat`/`lon` всегда. Это влияет на реальную частоту `addr`-ветки.
- **Прочие входы в `partner_applications`.** Есть ли пути создания заявок помимо `CreatePartnerApplicationController` (админка `lovii-admin`, b2b-кабинет) — не проверил; если есть, они тоже должны писать `identity_key`.
- **`Verifying` в скоупе.** `isPreVerification()` не включает `Verifying`, хотя статус явно не финальный. Влияет на выбор partial-условия, если решим скоупить индекс по статусам вместо «всех живых строк» (я выбрал «все живые» — см. §5.3 — что снимает вопрос).
- **Полнота миграций `partners`.** Колонки `inn/dadata_party/verified_at` в `lovii_b2b.partners` добавлены вне прочитанной миграции — точный файл не нашёл; на выводы не влияет.
- **Юридическая уникальность ИНН.** Опираюсь на общее знание (ИНН уникален), не проверял по реестру ФНС; в коде это не зашито.
- **Мультитенантные здания.** Реальных кейсов «две точки одного ИНН в одном здании» в 15 строках не увидел; риск §8.2 — теоретический для прода.
- **Слабо детерминированный `normalizeAddress()`.** Точный список стоп-слов («к», «стр», «литера», номера помещений) нужно утвердить; от него зависит, склеит ли ключ «4» и «4к1» (сейчас — нет, и это правильно) и склеит ли «д. 6» и «6» (сейчас — да).

---

## 10. Итог одной строкой

Ключ идентичности: `{норм. ИНН} | {geo-округлённые-координаты ИЛИ норм. город+адрес}` — глобальный, без `user_id`; для МСП-уровня (без точки) — `{норм. ИНН} | no-point`. Закрепить материализованной колонкой `identity_key` + частичным уникальным индексом `WHERE merged_into_application_id IS NULL`; существующие дубли (6× «Пышка 4к1») при накате пометить `merged_into_application_id`, а не удалять. Индекс — страховка; просьба владельца («менять статус прежней, а не создавать новую») реализуется правкой `CreatePartnerApplicationAction` на upsert по `identity_key`.
