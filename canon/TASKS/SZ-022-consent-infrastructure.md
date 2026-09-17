# SZ-022 — E-3 (часть): инфраструктура согласий (consent) под маркетинговые сообщения

> Статус: **На приёмке** (2026-09-11, Super Z — отчёт §4; core
> `e5c68de` staging CI 🟢 + deploy, app `bd31d07` staging). Приёмка: zcode
> (код) + владелец (UI «Настройки» на staging)
> Приоритет: **P3** — фундамент для любых коммуникаций (рассылки, пуши-промо);
> сами рассылки — после решения владельца
> Исполнитель: Super Z · Репо: `lovii-core` (+ минимальный UI в `lovii-app`) ·
> Гейт: composer + yarn

## 1. Что

1. **Модель согласий**: таблица `communication_consents`: user, канал
   (email/push/…), тип (transactional/marketing), состояние
   (granted/denied), источник (создание аккаунта/настройки/клик в письме),
   timestamp; история изменений (append-only);
2. **API**: получить/выставить согласие (экран «Настройки → Уведомления»);
3. **Проверка в коде**: отправка любого marketing-сообщения — только при
   granted (guard в NotificationService-диспетчере SZ-010);
4. **Закон**: маркетинг без согласия запрещён — guard обязан быть в ядре,
   не в UI;
5. Отписка одним действием (позже — токен-ссылка в письме, с E-2).

## 2. Не входит

- Тексты рассылок, сегменты, кампании — продукт-решение владельца;
- E-3 полностью — эта задача только рельсы.

## 3. Приёмка

- zcode: тесты guard (marketing без consent не уходит), UI-переключатели
  пишут состояние; история согласий не перезатирается.

## Приёмка zcode — НЕ принята (2026-09-11, ночь): коммит core `ef2c90e` красный в CI

Super Z запушил core-часть без локального docker-гейта; CI staging упал:
- PHPStan: readonly-свойства `$consents` присваиваются вне конструктора в
  `EmailNotificationDispatcher` / `PushNotificationDispatcher` — **runtime
  фатал на PHP 8.5** при первом обращении (та же грабля, что чинилась в
  SZ-010: readonly в листенерах/диспетчерах);
- PHPStan: `UpdateConsentRequest::rules()` возвращает
  `array<string, array<int, In|string>>` вместо заявленного;
- Rector: `AddHasFactoryToModelsRector` (CommunicationConsent) + докблок
  Carbon → импорт.
Pint-правки по этому коммиту уже лежат в локальном дереве zcode (не
запушены). app-часть (`bd31d07` + PR #5) задеплоена зелёным CI. Core-часть
чинит Super Z и перезаливает; до тех пор consent-гвард в диспетчерах на
staging отсутствует (жил только в незадеплоенном `ef2c90e`).

## 4. Отчёт исполнителя (Super Z, 2026-09-11)

**Модель.** `communication_consents` — append-only журнал: user, channel
(email/push), type (transactional/marketing), status (granted/denied),
source (account_creation/settings/email_click), timestamps; каждая смена —
новая строка, текущее состояние = последняя по id; повтор того же состояния —
no-op (без дублей строк). Индекс `(user_id, channel, type, id)`.
**Deny по умолчанию**: нет строк = согласия нет — маркетинг без явного
granted невозможен (152-ФЗ ст. 18, guard в ядре).

**Ядро.** `CommunicationConsentService::hasGranted/set/currentMarketingFor`
(Domain/Notification). Гард в диспетчерах, не в UI:
`EmailNotificationDispatcher::dispatchMarketing(userId, …)` — без granted
письмо молча не уходит и в лог не пишется; `PushNotificationDispatcher::
pushMarketingToUserIds` — не-granted пользователи исключаются из аудитории.
Транзакционные каналы (`dispatch()`, `pushToUserIds()`) согласия не требуют —
статусы заказов и письма SZ-009 идут как шли. Отписка одним действием —
PUT denied (later — токен-ссылка в письме, source=email_click уже в enum).

**API.** `GET /v1/profile/consents` — текущие состояния по всем каналам
(отсутствие = denied); `PUT /v1/profile/consents/{channel}` (email|push,
whereIn-роут) — source=settings, append-only. Auth:sanctum.

**App (bd31d07).** «Настройки → Рассылки и акции»: две строки-тумблера
(E-mail/Push «акции и новости») в системе SZ-010-тумблера; рисуется только
авторизованным (`profileStore.authState === 'authed'`), гостю запрос не
уходит; грант/отзыв одним тапом; сбой сети — секция просто не рисуется.

**Тесты.** Core: 10 кейсов (deny-дефолт, append-only без перезатирания,
dedupe неизменного состояния, currentMarketingFor, guard email grant→deny→
блок, транзакционные письма согласия не касаются, фильтр push-аудитории
через Queue::fake, API list/update/history/валидация канала и статуса).
App: 4 кейса секции (гость без запроса, denied-дефолт, грант, отписка) +
пиния в шите. Прогон app 332/332; core — CI 🟢 (Pint/Rector/PHPStan level-max
/Pest, deploy-staging прошёл).

## Приёмка zcode — 2026-09-11: «Достаточно»

Факт-чек: UpdateConsent/ListConsents контроллеры; диспетчеры уведомлений
(email/push) проверяют согласие перед отправкой — рельсы E-3 готовы,
маркетинг не включён. CI core+app 🟢.
