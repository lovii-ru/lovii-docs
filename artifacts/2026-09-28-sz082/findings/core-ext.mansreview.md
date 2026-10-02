# SZ-082 мансревью — core-ext (все 92 строки механического скана)

> Исполнитель: Super Z · Дата: 2026-10-03 · Мансревью-срез: **lovii-core `659c5dc`**
> (origin/staging, 01.10) · Срез скана: `dd4d385` (28.09) — сдвиг среза учтён,
> каждый вердикт перепроверен на свежем клоне (урок Приёмки-1).
> Метод: механический репрогон всех строк (тулкит `scripts/sz082_core_ext_mansreview.py`,
> проходы 1–3: пофайловый, классовый, кросс-репо) + ручная верификация каждой
> неоднозначности. Кросс-репо: `lovii-b2b`, `lovii-admin` (staging, 03.10).
> Ни одного удаления не произведено.

## Сводка

| Вердикт | Строк | Что это |
|---|---|---|
| ЖИВОЙ — подтверждено | **57** | 21 класс + 31 enum-кейс + 5 blade |
| УДАЛЁН ранее (пакет 1) | **1** | `CartSummaryResource` (core `6568c09`) — строка закрыта |
| P3 — решение владельца | **34** | 4 класса + 30 кейсов (из них 23 — один кластер `FinancialTransactionType`) |

Главный вывод: **механика core-ext почти не нашла настоящего мёртвого кода** —
25 из 26 «классов» и все blade живые; шум AMBIGUOUS создан коллизиями имён
(«Earn» = `WalletTransactionType::Earn`, «Payout» = модель `Payout`, «Best» =
«Best practices», «Pro» = iPhone Pro) и сгенерированным `_ide_helper_models.php`.
Реальные кандидаты — кластер `FinancialTransactionType` (положен впрок под
T-023A, T-023 закрыта 30.09 не использовав его) и горстка словарных кейсов.

## А. PHP-классы (26 строк)

### А.1 Живые — подтверждено свидетельствами (21)

| Класс | Свидетельство (свежий срез) |
|---|---|
| `ActivateUserAfterConfirmAction` | инъекция: `ConfirmByBindingAction.php:31`, `ConfirmOtpAction.php:18` |
| `DispatchOrdersAction` | инъекция: `PlaceOrdersAction.php:28` |
| `CreatePartnerApplicationResult` | `new` ×4: `CreatePartnerApplicationAction.php:91,128,213,421` |
| `ApiResourceCollection` | базовая коллекция API: `ApiResource.php:11-13` (`newCollection`) |
| `CartItemResource` | `CartResource.php:71` |
| `MerchantSummaryResource` | `CartResource.php:31`, `OrderListResource.php:21`, `OrderDetailResource.php:23` |
| `NearbyBranchResource` | `HomeResource.php:39` |
| `OfferModifierGroupResource` | `MerchantOfferResource.php:43` |
| `OfferModifierResource` | `OfferModifierGroupResource.php:24` |
| `OrderItemResource` | `OrderDetailResource.php:25` |
| `OrderListItemResource` | `OrderListResource.php:23` |
| `ProductRequirementResource` | `MerchantOfferResource.php:42`, `StorefrontOfferCardResource.php:37` |
| `LogPromoApplied`, `LogPromoRulePublished`, `NotifyMerchantOnOrderPlacedViaMaxBot`, `NotifyMerchantOnOrderPlacedViaTelegramBot`, `NotifyMerchantOnOrderStatusChangedViaMaxBot`, `NotifyMerchantOnOrderStatusChangedViaTelegramBot`, `ReturnSpentPointsOnOrderCancellation` (7 листенеров) | автодисковери Laravel (`withEvents(discover: true)` — фиксация в шапке регресс-теста); канон подписок закреплён `tests/Feature/Events/ListenerRegistrationTest.php`: 5 подписок `OrderPlaced`, 7 — `OrderStatusChanged`. Ноль grep-ссылок — ожидаемое следствие дисковери, не мёртвость |
| `CoreModel` | `extends` ×49 (`Payment.php:37`, `IntegrationEntityMapping.php:26`, …) |
| `B2bModel` | `extends` ×7 (`PartnerInvitation.php:42`, `PartnerMembership.php:35`, `PartnerAuditLog.php:40`, …) |

### А.2 P3 — решение владельца (4)

| Класс | Факт | Вердикт-рекомендация |
|---|---|---|
| `OrderStatusSyncContract` | 0 код-ссылок на свежем срезе и в b2b/admin; только доки (`docs/responses/2026-04-13-three-requests-response.md:138` — «0 имплементаций», specs, gap-analysis) | Задел под статус-синк внешних систем (C-3): удалить или оставить осознанно — владелец |
| `AdminModel` (core-копия) | 0 код-ссылок (pint.json/rector.php — тулинг, `_ide_helper` — генерат); наследников нет нигде; зеркала в admin (`AdminModel.php` + `AdminUser.php`) и b2b — живые | Зеркальный примитив shared-model-sync. Удалить core-копию после подтверждения конвенции владельцем (admin/b2b имеют свои) |
| `PartnerUiPreference` (core-копия) | 0 код-ссылок в core **и** в b2b (двойник `b2b/app/Models/B2b/PartnerUiPreference.php` тоже без использований); таблица живая: `ReconcilePartnerInnDuplicates.php:370`, `DeletePartnerDraftAction.php:69` | Обе копии модели — кандидаты на удаление; **таблицу не трогать** (правило F-074). Владелец |
| `FinancialTransactionType` (enum целиком, 22 кейса) | 0 ссылок на класс и кейсы во всём кластере; словарь дублируется `WalletTransactionType` (Loyalty) и `LedgerEntryType` (Billing); T-023 закрыта 30.09, фазы A–D не использовали enum | Кандидат на удаление одним файлом (~113 строк); восстановление из истории — одна команда. Владелец |

## Б. Enum-кейсы (61 строка)

### Б.1 Живые — 31 (статика, API-контракт, панели b2b/admin)

| Кейсы | Механизм жизни |
|---|---|
| `ForceDeletableEntityType::{Merchant, MerchantBranch, CatalogProduct, CatalogCategory, OfferModifierGroup, OfferModifier}` (6) | контракт internal API: `Rule::enum(...::class)` `ForceDeleteCatalogEntityRequest.php:23` + `::from()` `:34` |
| `PromoRewardKind::CashbackFixed` | допустимое значение API: `cases()` → валидация `HasPromoRuleRules.php:117`; чтение из БД `PromoRule.php:120` (tryFrom) |
| `PromoStackMode::Best` | `HasPromoRuleRules.php:137-138`, `PromoRuleData.php:113` (fromValue) |
| `StorefrontDeliveryOption::{FreeDelivery, CityDelivery, RussiaDelivery, Pickup}` (4) | отдаются клиенту: `ShowStorefrontInfoController.php:118` (`cases()` → `delivery_options`) |
| `Gender::{Male, Female}` (2) | контракт профиля: `new Enum(Gender::class)` `UpdateProfileRequest.php:22` |
| `PartnerActivityType::{Goods, Services}` (2) | `Rule::enum` `CreatePartnerApplicationRequest.php:28` |
| `BranchStatus::Closed` | статика ×17 (тесты `BranchAvailabilityResolverTest.php:73,86`,…) |
| `MerchantType::Club` | фильтры панели b2b: `MerchantResource.php:86,176` (`cases()`) |
| `CatalogSource::{RetailApiImport, CrmSync, RestaurantPosSync, FileImport}` (4) | фильтр панели b2b: `PositionResource.php:431` (`cases()`) |
| `IntegrationStatus::{Inactive, Error}` (2) | дисплей-контракт admin: `EnumAppearance.php:82-83` |
| `OrderChannel::{CrmOrderApi, RestaurantPosApi, ManualProcessing}` (3) | `admin EnumAppearance.php:54-56,144+`; seeder b2b `DatabaseSeeder.php:202,497` |
| `OrderSubmissionStatus::{Failed, Retrying}` (2) | `admin EnumAppearance.php:45-46,134-135`; фильтры/бейджи b2b `OrderSubmissionResource.php:101-102` |
| `FulfillmentMode::Hybrid` | `admin EnumAppearance.php:63` |
| `MerchantTariff::Start` | дефолт колонки БД (`2026_09_11_110004_add_tariff_to_merchants_table.php:19` → cast читает) |

### Б.2 P3 — решение владельца — 30

| Кейсы | Факт | Рекомендация |
|---|---|---|
| `FinancialTransactionType::*` (22) | следуют вердикту класса (А.2) | удалить кластером одним файлом |
| `MerchantTariff::{Basic, Pro}` (2) | 0 записей/отображений во всём кластере; в БД дефолт `start`; тулкит b2b/admin не содержит класс | Задел тарифных уровней (контекст SZ-058 VIP): **оставить** или удалить — владелец |
| `ConsentSource::AccountCreation` (1) | пишется только `ConsentSource::Settings` (`UpdateConsentController.php:37`); account_creation нигде не создаётся | DB-сверка `communication_consents.source` → удалить |
| `ConsentType::Transactional` (1) | везде `Marketing` (`PushNotificationDispatcher.php:81`, `EmailNotificationDispatcher.php:65`, дефолт `CommunicationConsentService.php:41`) | DB-сверка `communication_consents.type` → удалить |
| `PartnerUserStatus::Invited` (1) | поток приглашений создаёт строку сразу с `'active'` (`AcceptMspInvitationController.php:47-55`) | DB-сверка `partner_users.status` → удалить |
| `BadgeColor::{White, Tertiary}` (2) | словарь бейджей: используются Secondary/Blue/Brand/Orange/Lime/Accent/Red (`OrderStatus.php:50-59`, `OrderBadges.php`) | Не хранится в БД (уходит в API-ответы): решение по словарю ДС — удалить или оставить как палитру |
| `PartnerApplicationStatus::Draft` (1) | кодом не пишется (создание: `Submitted`/`AwaitingRepApproval` `CreatePartnerApplicationAction.php:169-171`; дефолт БД `submitted`); админ рендерит через `tryFrom(...)?->getLabel() ?? raw` (`PartnerInfoSchema.php:68`) — удаление безопасно с fallback | DB-сверка `partner_applications.status` → удалить |

## В. Blade-шаблоны (5 строк) — все живые

| Шаблон | Ссылка |
|---|---|
| `docs.blade.php` | `routes/web.php:18` (`view('docs')`) |
| `emails/email-verification` | `EmailVerificationMail.php:39` (`view:`) |
| `emails/new-device-login` | `NewDeviceLoginMail.php:38` |
| `emails/order-created` | `OrderCreatedMail.php:47` |
| `emails/order-status-changed` | `OrderStatusChangedMail.php:42` |

## Г. Реклассификации против отчёта Фазы A (для честности метода)

- **P3 → ЖИВОЙ (7):** `Gender::Male`, `StorefrontDeliveryOption::{CityDelivery, FreeDelivery, RussiaDelivery}`, `PromoRewardKind::CashbackFixed` — оказались API-контрактом (`Rule::enum`/`cases()`); причина ложного P3: скан ядра не видел потребителя в API-слое.
- **P3 → ЖИВОЙ (11, кросс-репо):** `IntegrationStatus::{Inactive, Error}`, `OrderChannel::{CrmOrderApi, RestaurantPosApi, ManualProcessing}`, `OrderSubmissionStatus::{Failed, Retrying}`, `FulfillmentMode::Hybrid`, `MerchantType::Club`, `CatalogSource` ×4 — потребители в панелях b2b/admin (EnumAppearance, фильтры Filament). Урок: **вердикт по core-эale невозможен без кросс-репо прохода** — панели b2b/admin являются потребителями словаря core.
- **P3 остаётся/расширяется:** `ConsentSource::AccountCreation`, `BadgeColor::Tertiary`, 4 кейса FTT (расширены до всего класса — 22 кейса). Новые P3: `BadgeColor::White`, `MerchantTariff::{Basic, Pro}`, `PartnerApplicationStatus::Draft`.

## Д. Кандидаты в пакет 2 Фазы B (после «го» владельца)

1. **Кластер FTT** (1 файл, ~113 строк): `FinancialTransactionType` целиком.
2. **Словарные кейсы** (по одному удалению кейса, после DB-сверки): `ConsentSource::AccountCreation`, `ConsentType::Transactional`, `PartnerUserStatus::Invited`, `PartnerApplicationStatus::Draft`, `BadgeColor::{White, Tertiary}`.
3. **Классы-двойники/примитивы** (после подтверждения mirror-конвенции): `AdminModel` (core-копия), `PartnerUiPreference` (обе копии; таблицу не трогать).
4. **Порядок:** замер «до» → удаления → полный гейт core (PHPStan/pest/CI) → кросс-репо CI (b2b/admin) → деплой staging → healthz. DB-сверки выполняет zcode на staging-БД перед пунктом 2.

## Е. Попутные наблюдения (без правок)

- `rector.php:50` core перечисляет несуществующий `app/Models/Core/AdminModel.php` — мусорная строка тулинга, почистить при случае.
- Статусы сабмита пишутся сырыми строками (`SubmitOrderJob.php:48,59`: `'submitted'`, `'pending'`), мимо enum — типобезопасность просядет; кандидат в микрозадачу (не в SZ-082).
- `_ide_helper_models.php` закоммичен и шумит все сканы — добавить в исключения тулкита (правка тулкита уже запланирована Приёмкой-1).
