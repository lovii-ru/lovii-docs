# APP-P-034 — Владелец · Финансы
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/cabinet/owner/finance` · name `OwnerFinance` (src/router/index.ts:660)
- Тип: вложенная (родитель: `/cabinet/owner`, CabinetLayout; вкладка «Финансы», icon wallet; accent gold)
- Доступ: роль founder (rolesGuard на родителе, src/router/index.ts:644)
- Назначение: Разбивка периода по ledger и сальдо платформы + справка GMV по месяцам. OPEX в системе не ведётся и в сальдо не входит — подписано честно на карточке (OwnerFinance.vue:2-6, :82-85).
- Функциональные блоки:
  - #period — PeriodChips (те же 5 периодов, по умолчанию 30 дней; :41).
  - #finance — «Финансы периода» (бейдж = период с ядра, testid `owner-finance-period`): строки GMV; Доля компании с заказов (is-in); Списания за подписку LOVII PASS (is-in); Списания со счёта компании (is-out, показывается как −platform_outflow); Прочие поступления (is-in; вычисляется на клиенте: platform_inflow − commission − pass, :73-75). Итог — «Сальдо платформы» (:78-81, testid `owner-finance-balance`). Ниже note про OPEX/банковский контур (:82-85, testid `owner-finance-rows` на блоке строк).
  - #gmv-months — «GMV по месяцам», «справка · 8 месяцев»: простые строки label→money (не MiniBars, в отличие от Обзора; :88-99).
- Состояния: loading — «Загружаем…»; ошибка — «Данные платформы недоступны — попробуйте ещё раз» + «Повторить» (:43-46); пустое состояние отдельного текста не имеет (строки всегда рендерятся из агрегатов, нули честные).
- Зависимости: API GET `api/v1/platform/owner?period=…` (src/modules/platform-module/api/platform-api.ts:136-145); PeriodChips; money/signedMoney (src/modules/platform-module/money.ts); dashboard.scss.
- Переходы: → APP-P-033 «Обзор», APP-P-035 «Структура» (нижний бар); ← APP-P-033 (таб-бар).
- Дизайн/канон — проверить визуально: 3 состояния, честные цифры (OPEX подписан, не «спрятан»), токены ДС, a11y, акцент owner gold (pdash--gold) по PRODUCT_QUALITY_BAR.
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)
