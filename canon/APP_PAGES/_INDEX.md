# APP_PAGES — карта страниц lovii-app (T-032)

> **Что это:** полная as-is инвентаризация страниц и модальных экранов lovii-app
> с постоянными ID (`APP-P-NNN` — страницы, `APP-M-NNN` — модалки/оверлеи).
> Любая задача ссылается на ID (`APP-P-014#subscription`), а не словами.
> Источник истины — код lovii-app на зафиксированном срезе.

## Срез

- Репо: `lovii-tech/lovii-app`, HEAD: **cf33ef2** (origin/staging, 2026-10-02)
- Роутер: `src/router/index.ts` (1061 строк), все маршруты разобраны (проход 1)

## Статистика (фаза A)

- Именованных записей роутера: **60** — все имеют карточку (1:1)
- Из них страниц-компонентов: 55; именованных redirect-записей: 4 (APP-P-011,
  APP-P-012, APP-P-025 + безымянная `/business/pending` — см. «Расхождения»);
  catch-all 404: 1 (APP-P-060)
- Модальные экраны `APP-M-NNN`: **0** — заводятся в фазе B (проход 2)
- Нумерация: сквозная, в порядке появления в конфиге роутера

## Оглавление

| APP-P-001 | Главный экран (витрина) | страница | `/ · HomeView` (index.ts:204) | [APP-P-001](APP-P-001-home.md) |
| APP-P-002 | Популярное | страница | `/popular · PopularView` (index.ts:213) | [APP-P-002](APP-P-002-popular.md) |
| APP-P-003 | Поиск заведений и товаров | страница | `/stores · StoresView` (index.ts:228) | [APP-P-003](APP-P-003-stores.md) |
| APP-P-004 | Заведение (точка) | страница | `/stores/:id · StoreView` (index.ts:239) | [APP-P-004](APP-P-004-store.md) |
| APP-P-005 | Товар | страница | `/stores/:id/product/:productId · ProductView` (index.ts:248) | [APP-P-005](APP-P-005-product.md) |
| APP-P-006 | Корзина | страница | `/cart · CartView` (index.ts:266) | [APP-P-006](APP-P-006-cart.md) |
| APP-P-007 | Оформление заказа | страница | `/cart/:id · CartOrderView` (index.ts:278) | [APP-P-007](APP-P-007-cart-order.md) |
| APP-P-008 | Профиль (хаб входа) | страница | `/profile · ProfileView` (index.ts:297) | [APP-P-008](APP-P-008-profile.md) |
| APP-P-009 | Счёт и операции | страница | `/profile/wallet · ProfileWalletView` (index.ts:310) | [APP-P-009](APP-P-009-wallet.md) |
| APP-P-010 | Перевод баллов | страница | `/profile/wallet/transfer · ProfileTransferView` (index.ts:328) | [APP-P-010](APP-P-010-transfer.md) |
| APP-P-011 | Редирект «Мои баллы» | страница | `/profile/balance · ProfileBalanceView` (index.ts:347) | [APP-P-011](APP-P-011-balance-redirect.md) |
| APP-P-012 | Редирект «Все операции» | страница | `/profile/operations · ProfileOperationsView` (index.ts:358) | [APP-P-012](APP-P-012-operations-redirect.md) |
| APP-P-013 | Редактирование профиля | страница | `/profile/edit · ProfileEditView` (index.ts:366) | [APP-P-013](APP-P-013-profile-edit.md) |
| APP-P-014 | Подтверждение e-mail | страница | `/profile/edit/email/verify · EmailVerifyView` (index.ts:383) | [APP-P-014](APP-P-014-email-verify.md) |
| APP-P-015 | История заказов | страница | `/profile/orders · OrdersView` (index.ts:410) | [APP-P-015](APP-P-015-orders.md) |
| APP-P-016 | Заказ | страница | `/profile/orders/:id · OrderView` (index.ts:418) | [APP-P-016](APP-P-016-order.md) |
| APP-P-017 | Мои адреса | страница | `/profile/addresses · AddressesView` (index.ts:439) | [APP-P-017](APP-P-017-addresses.md) |
| APP-P-018 | Добавление адреса | страница | `/profile/addresses/create · CreateAddressView` (index.ts:447) | [APP-P-018](APP-P-018-address-create.md) |
| APP-P-019 | Редактирование адреса | страница | `/profile/addresses/edit/:id · EditAddressView` (index.ts:457) | [APP-P-019](APP-P-019-address-edit.md) |
| APP-P-020 | Настройки | страница | `/settings · ProfileSettings` (index.ts:477) | [APP-P-020](APP-P-020-settings.md) |
| APP-P-021 | ЛОВИ Бизнес — подключение точки | страница | `/business · BusinessLandingView` (index.ts:502) | [APP-P-021](APP-P-021-business-landing.md) |
| APP-P-022 | Заявка на подключение точки | страница | `/business/apply · BusinessApplyView` (index.ts:510) | [APP-P-022](APP-P-022-business-apply.md) |
| APP-P-023 | Статус заявки | страница | `/business/status · BusinessStatusView` (index.ts:525) | [APP-P-023](APP-P-023-business-status.md) |
| APP-P-024 | Результат заявки | страница | `/business/result · BusinessResultView` (index.ts:533) | [APP-P-024](APP-P-024-business-result.md) |
| APP-P-025 | Редирект «Моя точка» | страница | `/business/point · MyPointView` (index.ts:547) | [APP-P-025](APP-P-025-mypoint.md) |
| APP-P-026 | Кабинет представителя — Обзор | страница | `/cabinet/representative · RepresentativeOverview` (index.ts:584) | [APP-P-026](APP-P-026-rep-overview.md) |
| APP-P-027 | Представитель — Мои точки | страница | `/cabinet/representative/points · RepresentativePoints` (index.ts:591) | [APP-P-027](APP-P-027-rep-points.md) |
| APP-P-028 | Представитель — Заявки | страница | `/cabinet/representative/approvals · RepresentativeApprovals` (index.ts:597) | [APP-P-028](APP-P-028-rep-approvals.md) |
| APP-P-029 | Представитель — Доход | страница | `/cabinet/representative/income · RepresentativeIncome` (index.ts:604) | [APP-P-029](APP-P-029-rep-income.md) |
| APP-P-030 | Представитель — Профиль | страница | `/cabinet/representative/profile · RepresentativeProfile` (index.ts:610) | [APP-P-030](APP-P-030-rep-profile.md) |
| APP-P-031 | Представитель — Чаты | страница | `/cabinet/representative/chats · RepresentativeChats` (index.ts:617) | [APP-P-031](APP-P-031-rep-chats.md) |
| APP-P-032 | Кабинет платформы (легаси-хаб) | страница | `/cabinet/platform · CabinetPlatform` (index.ts:625) | [APP-P-032](APP-P-032-platform.md) |
| APP-P-033 | Кабинет владельца — Обзор | страница | `/cabinet/owner · OwnerOverview` (index.ts:654) | [APP-P-033](APP-P-033-owner-overview.md) |
| APP-P-034 | Владелец — Финансы | страница | `/cabinet/owner/finance · OwnerFinance` (index.ts:660) | [APP-P-034](APP-P-034-owner-finance.md) |
| APP-P-035 | Владелец — Структура | страница | `/cabinet/owner/structure · OwnerStructure` (index.ts:666) | [APP-P-035](APP-P-035-owner-structure.md) |
| APP-P-036 | Кабинет инвестора — Рост | страница | `/cabinet/investor · InvestorGrowth` (index.ts:693) | [APP-P-036](APP-P-036-investor-growth.md) |
| APP-P-037 | Инвестор — Точки | страница | `/cabinet/investor/points · InvestorPoints` (index.ts:699) | [APP-P-037](APP-P-037-investor-points.md) |
| APP-P-038 | Инвестор — Доходность | страница | `/cabinet/investor/money · InvestorMoney` (index.ts:705) | [APP-P-038](APP-P-038-investor-money.md) |
| APP-P-039 | Кабинет амбассадора — Обзор | страница | `/cabinet/ambassador · AmbassadorOverview` (index.ts:735) | [APP-P-039](APP-P-039-amb-overview.md) |
| APP-P-040 | Амбассадор — Структура | страница | `/cabinet/ambassador/reps · AmbassadorReps` (index.ts:741) | [APP-P-040](APP-P-040-amb-reps.md) |
| APP-P-041 | Амбассадор — Обучение | страница | `/cabinet/ambassador/training · AmbassadorTraining` (index.ts:747) | [APP-P-041](APP-P-041-amb-training.md) |
| APP-P-042 | Амбассадор — Доход | страница | `/cabinet/ambassador/income · AmbassadorIncome` (index.ts:753) | [APP-P-042](APP-P-042-amb-income.md) |
| APP-P-043 | Амбассадор — Чаты | страница | `/cabinet/ambassador/chats · AmbassadorChats` (index.ts:759) | [APP-P-043](APP-P-043-amb-chats.md) |
| APP-P-044 | Кабинет МСП — Обзор («Мой магазин») | страница | `/cabinet/msp · MspOverview` (index.ts:831) | [APP-P-044](APP-P-044-msp-overview.md) |
| APP-P-045 | МСП — Счёт верификации | страница | `/cabinet/msp/payment · MspPayment` (index.ts:837) | [APP-P-045](APP-P-045-msp-payment.md) |
| APP-P-046 | МСП — Заказы | страница | `/cabinet/msp/orders · MspOrders` (index.ts:843) | [APP-P-046](APP-P-046-msp-orders.md) |
| APP-P-047 | МСП — Заказ точки | страница | `/cabinet/msp/orders/:id · MspOrderDetail` (index.ts:849) | [APP-P-047](APP-P-047-msp-order-detail.md) |
| APP-P-048 | МСП — Товары | страница | `/cabinet/msp/products · MspProducts` (index.ts:855) | [APP-P-048](APP-P-048-msp-products.md) |
| APP-P-049 | МСП — Промо | страница | `/cabinet/msp/loyalty · MspLoyalty` (index.ts:861) | [APP-P-049](APP-P-049-msp-loyalty.md) |
| APP-P-050 | МСП — Настройки точки | страница | `/cabinet/msp/settings · MspBranchSettings` (index.ts:867) | [APP-P-050](APP-P-050-msp-branch-settings.md) |
| APP-P-051 | МСП — Команда | страница | `/cabinet/msp/team · MspTeam` (index.ts:872) | [APP-P-051](APP-P-051-msp-team.md) |
| APP-P-052 | МСП — Запуск точки | страница | `/cabinet/msp/starter · MspStarter` (index.ts:880) | [APP-P-052](APP-P-052-msp-starter.md) |
| APP-P-053 | Кабинет команды — Заказы | страница | `/cabinet/team · TeamOrders` (index.ts:907) | [APP-P-053](APP-P-053-team-orders.md) |
| APP-P-054 | Команда — Заказ точки | страница | `/cabinet/team/orders/:id · TeamOrderDetail` (index.ts:913) | [APP-P-054](APP-P-054-team-order-detail.md) |
| APP-P-055 | Команда — Товары | страница | `/cabinet/team/products · TeamProducts` (index.ts:921) | [APP-P-055](APP-P-055-team-products.md) |
| APP-P-056 | Команда — Команда | страница | `/cabinet/team/team · TeamTeam` (index.ts:928) | [APP-P-056](APP-P-056-team-team.md) |
| APP-P-057 | Результат оплаты | страница | `/payment/result · PaymentResultView` (index.ts:941) | [APP-P-057](APP-P-057-payment-result.md) |
| APP-P-058 | Тестовый терминал (mock-банк) | страница | `/payment/fake · FakeTerminalView` (index.ts:963) | [APP-P-058](APP-P-058-fake-terminal.md) |
| APP-P-059 | Вход по magic link | страница | `/auth/by-binding · AuthByBindingView` (index.ts:992) | [APP-P-059](APP-P-059-auth-by-binding.md) |
| APP-P-060 | Страница не найдена | страница | `/:pathMatch(.*)* · NotFound` (index.ts:1001) | [APP-P-060](APP-P-060-not-found.md) |

## Правила сопровождения

1. Новая страница получает **следующий свободный номер** (после APP-P-060 — 061)
   в той же задаче, которая её добавляет; модалки — `APP-M-001…` в том же цикле.
2. ID **не переиспользуются никогда**. Удалённая страница: статус `removed` в
   карточке; запись-редирект в роутере = отдельная карточка со статусом
   `removed (имя сохранено)`.
3. Карточка страницы обновляется **тем же пуш-циклом**, что и правка страницы
   (файл, маршрут, блоки, состояния, зависимости).
4. Параметризованный маршрут = одна карточка-шаблон (раздел «Варианты
   параметров» в фазе B), не карточка на инстанс.
5. Вкладка = блок `#slug` внутри карточки; отдельный children-маршрут —
   отдельная карточка с «Родителем».
6. Описываем as-is по коду (guards/meta), не по ожиданиям.

## Сверка (проход 1 — роутер)

| Проверка | Результат |
|---|---|
| Записей роутера с `name` | 60 |
| Карточек APP-P | 60 (1:1) |
| Каждая карточка имеет подтверждённый вход | фаза B (проход 3) |
| Каждый видимый вход указывает на существующий ID | фаза B (проход 3) |

## Расхождения и особенности

- `/business/pending` — redirect-запись **без имени** (`src/router/index.ts:521`,
  → BusinessStatusView): карточки не имеет, зафиксирована здесь и в APP-P-023.
- `FakeTerminalView` (APP-P-058) присутствует в роутере **условно**
  (`VITE_APP_ENV !== "production"`, index.ts:959): в прод-сборке записи нет.
- Имена `ProfileBalanceView`/`ProfileOperationsView`/`MyPointView` сохранены
  намеренно для старых ссылок (комментарий index.ts:140, :540) — сами экраны
  удалены, карточки помечены `removed`.
- APP-P-031/APP-P-043 (чаты rep/амб) — заглушка ChatStub.vue, статус
  `эксперимент`.

## Статус задачи

- Фаза A (скелет): **выполнена** — 60 карточек, INDEX, 5 полных карточек-эталонов
  (APP-P-001, 008, 009, 044, 059) на приёмку формата владельцем.
- Фаза B (наполнение, проходы 2–3, APP-M-*, сверка) — после «го» владельца.
- Фаза C (расхождения → отдельные задачи) — после B.
