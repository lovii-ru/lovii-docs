# Жизненный цикл заявки: подтверждённый механизм дублей и лимита

Источник: `~/LOVII/lovii-core` (ветка рабочая, локальный стенд) + данные стенда.
Этот файл заполнен mainline-разбором: назначенный на это направление исполнитель
упал на входе, поэтому разбор сделан напрямую по коду и базе.

## Вердикт
Владелец прав по существу, с одним уточнением по механизму.

1. **Повторная подача с тем же ИНН создаёт НОВУЮ заявку и НОВОГО партнёра-черновика.**
   Это не побочный эффект, а заложенное поведение: в `PartnerApplicationStatus` финальные
   статусы помечены комментарием «повторная подача с тем же ИНН создаёт новую заявку»,
   а `RejectPartnerApplicationAction` пишет об этом же в своём docblock.
2. **Отказ не освобождает слот лимита.** Подтверждено и кодом, и данными.
3. Следствие: пять отклонений одной и той же точки = пять занятых слотов = блокировка
   пользователя. Именно это сейчас и наблюдается на стенде.

## Код: где рождается дубль

### Дедупликация есть, но только до верификации
`app/Domain/Business/Actions/CreatePartnerApplicationAction.php:70-80`
```php
$existing = PartnerApplication::query()
    ->where('user_id', $user->id)
    ->where('inn', $inn)
    ->get()
    ->first(fn (PartnerApplication $application): bool => $application->status->isPreVerification());

if ($existing instanceof PartnerApplication) {
    return new CreatePartnerApplicationResult($existing, created: false);
}
```
Ключ поиска — пара `user_id` + `inn`. Пока статус в наборе `isPreVerification()`
(Draft, Submitted, AwaitingRepApproval, InvoiceIssued, AwaitingPayment) — дубль не создаётся.

### Отказ выводит заявку из этого набора
`app/Domain/Business/Enums/PartnerApplicationStatus.php:67-71`
```php
/** Финальные статусы: повторная подача с тем же ИНН создаёт новую заявку. */
public function isFinal(): bool
{
    return in_array($this, [self::Verified, self::Failed, self::Expired], true);
}
```
`Failed` не входит в `isPreVerification()` → после отказа поиск существующей заявки её не находит
→ создаётся новая строка.

### Отказ меняет только статус
`app/Domain/Business/Actions/RejectPartnerApplicationAction.php:27-34`
```php
$application->forceFill([
    'status' => PartnerApplicationStatus::Failed,
    'rep_rejected_at' => now(),
    'rep_reject_reason' => $reason,
])->save();
```
Ни членство, ни черновик партнёра, ни лимит не затрагиваются.

### Материализация создаёт партнёра безусловно
`app/Domain/Business/Actions/CreatePartnerApplicationAction.php:406-420`
```php
$partner = Partner::query()->create([
    'name' => $displayName,
    'slug' => Str::slug($displayName).'-'.Str::lower(Str::random(6)),
    'status' => PartnerStatus::Active,
    'inn' => $application->inn,
    'dadata_party' => $application->dadata_party,
    'contact_phone' => $application->phone,
    'contact_email' => $application->email,
    'verified_at' => null,
]);

PartnerMembership::query()->firstOrCreate(
    ['partner_user_id' => $partnerUser->id, 'partner_id' => $partner->id],
    ['role' => PartnerRole::Owner, 'status' => 'active'],
);
```
Проверки «у пользователя уже есть неподтверждённый партнёр с таким же ИНН» нет.
Каждая подача добавляет строку в `partners` и **активное** членство владельца.

### Что именно считает лимит
`app/Models/B2b/PartnerUser.php:47,71-82`
```php
public const int MAX_UNVERIFIED_OWNED_PARTNERS = 5;

public function countUnverifiedOwnedPartners(): int
{
    return Partner::query()
        ->whereNull('verified_at')
        ->whereHas('memberships', fn ($query) => $query
            ->where('partner_user_id', $this->id)
            ->where('role', PartnerRole::Owner)
            ->where('status', 'active')
        )
        ->count();
}
```
Считаются **партнёры**, а не заявки и не точки. Порог — 5.
Проверка перед созданием: `assertUnverifiedPartnerCap()` (`CreatePartnerApplicationAction.php:355-361`),
ошибка `partner_application_cap_reached`, HTTP 422.

Уникальности на уровне БД нет: в миграции `2026_09_10_100001_create_partner_applications_table.php`
индексы есть только по `status`, `partner_id`, `user_id + created_at`.

## Данные стенда (user_id 51, владелец в b2b — partner_user 258)

Заявки с одним и тем же ИНН `7842216839`:

| id | статус | partner_id | создана |
|---|---|---|---|
| 6, 8, 9 | verified | 263 | 11, 20, 25 сентября |
| 28 | failed | 809 | 27.09 00:00 |
| 29 | failed | 810 | 27.09 01:08 |
| 31 | failed | 812 | 27.09 17:58 |
| 32 | failed | 813 | 27.09 18:33 |
| 33 | failed | 814 | 27.09 18:37 |
| 34 | failed | 815 | 27.09 18:38 |
| 35 | failed | 816 | 27.09 20:42:27 |
| 36 | failed | 817 | 27.09 20:42:35 |
| 37 | failed | 818 | 27.09 20:42:38 |
| 38 | failed | 819 | 27.09 20:42:39 |
| 39 | failed | 820 | 27.09 20:42:48 |

Один ИНН → 11 заявок и 11 отдельных партнёров.

Черновики — одна и та же организация под разными именами из DaData:
`Пекарня "Пышечная"`, `Пекарня "Пышка"` (×5), `ООО "АТМОСФЕРА"` (×4). Имена разные, ИНН один.

Состояние лимита на момент разбора:
```
partner_user 258: countUnverifiedOwnedPartners = 5 / MAX 5 → reached = true
```
Занятые слоты держат партнёры **816, 817, 818, 819, 820** — все `verified_at = NULL`,
у всех членство `role=owner, status=active`, и за каждым стоит заявка в статусе `failed`.
То есть пять отказов по одной и той же точке полностью выбрали лимит.

Отдельно: у партнёров 807–815 членство в статусе `revoked` — они слот не держат.
Причина снятия — не отказ (отказ членства не касается); это следы более ранних прогонов.
Для диагноза важен контраст: там, где членство осталось активным (816–820), слот занят;
сам отказ его не снимает.

## Что это значит для модели
- Отказ обязан освобождать место: это отмена, а не создание сущности.
- Повторная подача обязана править прежнюю заявку, а не плодить новую строку и нового партнёра.
- Лимит должен считать точки (по ключу идентичности), а не строки партнёров.
- Нужен уникальный индекс, иначе гонка и старые клиенты снова наплодят дублей.

## Не проверено
- Точное происхождение снятия членства у 807–815 (следы ручных прогонов, аудит не поднят).
- Как поведёт себя лимит, если заявку отклонить, а затем довести до `verified` (не воспроизводилось).
