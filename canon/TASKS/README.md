# `canon/TASKS/` — активные task-specs

`canon/TASKS/` — рабочий слой постановок и отчётов. Карточки здесь не являются
источником продуктовых фактов: факты берутся из файла-дома по
`DOCS_GUIDELINES.md` §4. Правила выполнения и передачи — в
[`canon/WORK_PROTOCOL.md`](../WORK_PROTOCOL.md), общий маршрут — в корневом
[`AGENTS.md`](../../AGENTS.md).

## Правила каталога

- В активном каталоге находятся только незакрытые карточки со статусом
  `Открыта`, `В работе` или `На приёмке`.
- `Закрыта` не оставляется в `canon/TASKS/`: после обязательных отчёта и
  приёмок карточка переносится через `git mv` в `archive/tasks/` и получает
  архивный баннер.
- ID из имени файла, первого H1 и внутренних ссылок должен совпадать.
  Суффикс `B` — часть ID и применяется для явной нормализации коллизий.
- Исторические упоминания архивных задач пишутся обычным текстом или
  inline-кодом; живые Markdown-ссылки на `archive/` запрещены.
- Перед изменением каталога запускай `python3 scripts/task_guard.py`.

## Текущий активный срез

### На приёмке

| Карточка | Тема |
|---|---|
| [`SZ-003`](SZ-003-media-upload-verification-optimizer.md) | Загрузка и оптимизация изображений в b2b |
| [`SZ-004`](SZ-004-storefront-visibility-geo-cities.md) | Видимость витрины, гео и города |
| [`SZ-005`](SZ-005-taxonomy-id-collision-research.md) | Таксономия и коллизия идентификаторов |
| [`SZ-010`](SZ-010-pwa-push-notifications-service.md) | PWA push-сервис |
| [`SZ-011`](SZ-011-b2b-cabinet-full-sweep.md) | Ревизия b2b-кабинета |
| [`SZ-012`](SZ-012-clean-device-channels-otp-copy.md) | Чистое устройство и тексты OTP |
| [`SZ-013`](SZ-013-b2b-position-branch-binding.md) | Привязка позиций к филиалу |
| [`SZ-013B`](SZ-013B-storefront-search-section.md) | Раздел поиска на витрине; нормализованный ID после коллизии |
| [`SZ-014`](SZ-014-mini-apps-vk-max-telegram-research.md) | Ресёрч мини-приложений |
| [`SZ-015`](SZ-015-b2b-phpstan-gate.md) | PHPStan-гейт b2b |
| [`SZ-016`](SZ-016-restricted-products-filter.md) | Фильтр запрещённых товаров |
| [`SZ-017`](SZ-017-order-receipt.md) | Информационная квитанция заказа |
| [`SZ-018`](SZ-018-secrets-rotation-plan.md) | План ротации секретов |
| [`SZ-019`](SZ-019-sms-sender-audit.md) | Аудит SMS-отправителя |
| [`SZ-020`](SZ-020-cities-by-id-and-nearest.md) | Города по ID и ближайшие города |
| [`SZ-021`](SZ-021-mappings-export.md) | Экспорт/импорт mappings |
| [`SZ-022`](SZ-022-consent-infrastructure.md) | Инфраструктура согласий |
| [`SZ-023`](SZ-023-reconciliation-performance.md) | Производительность reconciliation |
| [`SZ-024`](SZ-024-store-info-card.md) | Инфо-карточка точки |
| [`SZ-025`](SZ-025-device-trust-passkeys.md) | Доверенные устройства и passkeys |
| [`SZ-030`](SZ-030-reduced-motion-setting.md) | Настройка уменьшения анимаций |
| [`SZ-031`](SZ-031-app-version-in-settings.md) | Версия сборки в настройках |
| [`SZ-032`](SZ-032-clear-cache-setting.md) | Очистка PWA-кэша |
| [`SZ-033`](SZ-033-push-notifications-research.md) | Подготовительная спека push |
| [`SZ-035`](SZ-035-storefront-teaser-gate.md) | Гейт витрины hidden/teaser/active |
| [`SZ-036`](SZ-036-checkout-delivery-not-supported-ux.md) | UX неподдерживаемой доставки |
| [`SZ-037`](SZ-037-b2b-order-events-bridge.md) | Мост событий b2b → core |
| [`SZ-041B`](SZ-041B-bank-wallet-redesign.md) | Банковский редизайн кошелька; нормализованный ID после коллизии |
| [`SZ-043`](SZ-043-nominal-account-founder.md) | Номинальный счёт и полный цикл ledger |
| [`SZ-044`](SZ-044-accounts-premium-card-design.md) | Премиальные карточки счетов |
| [`SZ-046`](SZ-046-address-contour-consolidation.md) | Консолидация адресного контура — **выполнена** (хирургия + комплекс, 6 атомов) |

### В работе

| Карточка | Тема |
|---|---|
| [`SZ-007`](SZ-007-lovi-business-connect-point.md) | «ЛОВИ Бизнес», фаза 1 и вынесенное продолжение |
| [`SZ-034`](SZ-034-representative-cabinet.md) | Спека кабинета представителя |
| [`SZ-038`](SZ-038-roles-rep-amb-msp.md) | Роли представителя, амбассадора и МСП |
| [`SZ-047`](SZ-047-team-cabinet.md) | Отдельный кабинет сотрудника / администратора точки (P1, исполнитель zcode) |
| [`SZ-067`](SZ-067-is24h-branch-closed-fix-and-data-repair.md) | Круглосуточная точка (is_24h) считается закрытой + ремонт данных точки |

### Открыта

| Карточка | Тема |
|---|---|
| [`T-008`](T-008-staging-test-data-cleanup.md) | Чистка тестового мусора staging-БД (постановка Super Z → zcode) |
| [`SZ-039`](SZ-039-points-accrual-mvp.md) | MVP баллового контура |
| [`SZ-040`](SZ-040-billing-ledger-pool.md) | Рублёвый ledger и пул 40/40/20 |
| [`SZ-041`](SZ-041-balances-personal-company.md) | Личные и корпоративные балансы |
| [`SZ-042`](SZ-042-rep-subscription-gate.md) | Гейт подписки представителя |
| [`SZ-063`](SZ-063-branch-on-off-temporary-close.md) | Точка «включена/выключена» + временное закрытие (30 мин / 1 час) из приложения |
| [`SZ-064`](SZ-064-merchant-points-products-per-point.md) | Бренд → несколько точек → отключение товара на конкретной точке |
| [`SZ-065`](SZ-065-product-sales-channels-pickup-delivery.md) | Каналы продаж товара: самовывоз / доставка (два свитчера товара) |
| [`SZ-066`](SZ-066-branch-delivery-radius-app.md) | Зона доставки точки из приложения: радиус 300 м … 1 км |
| [`SZ-068`](SZ-068-point-basic-settings-in-app.md) | Базовый набор настроек точки в приложении: «точка запускается с телефона» |

## Исторический срез

Карточки `T-005`, `T-006` и `T-007` закрыты по протоколу и находятся в
`archive/tasks/`. Ранее закрытые `T-001`–`T-004`, `SZ-001`, `SZ-002`,
`SZ-006`, `SZ-008`, `SZ-009` и `SZ-029` также находятся там (последняя —
ресёрч КБЖУ закрыт 2026-09-13: спека принята владельцем, реализация
отложена до первых действующих партнёров). Архивные файлы не используются
для постановки новой работы и не переиспользуют свои ID.

Полный текущий статус корпуса — [`canon/STATUS.md`](../STATUS.md); журнал
расхождений — [`canon/FINDINGS.md`](../FINDINGS.md); очередь владельца —
[`canon/BACKLOG.md`](../BACKLOG.md). Если список в историческом тексте
`STATUS` расходится с шапкой карточки, актуальным считается текущий заголовок
карточки и результат task-governance-гейта.
