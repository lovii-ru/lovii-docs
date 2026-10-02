# APP-P-038 — Инвестор · Доходность
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/cabinet/investor/money` · name `InvestorMoney` (src/router/index.ts:705)
- Тип: вложенная (родитель: `/cabinet/investor`, CabinetLayout; вкладка «Доходность», icon banknote; accent tiffany)
- Доступ: роль founder (rolesGuard на родителе, src/router/index.ts:683)
- Назначение: Сальдо платформы за период и доля инвестора: дивиденды от положительного сальдо (доля — конфиг ядра, по умолчанию 15%). OPEX/CAPEX в системе не ведутся — подписано честно; отрицательное сальдо = дивиденды нулевые (InvestorMoney.vue:2-8, note :78-81).
- Функциональные блоки:
  - #period — PeriodChips (:42).
  - #money — «Доходность · период» (бейдж = период, testid `investor-money-period`): Поступления платформы (is-in), Списания платформы (is-out, −platform_outflow), Сальдо платформы, Доля инвестора · N% (процент на клиенте: Math.round(investor_share*100), :70) → signedMoney(dividends) (:56-73, testid `investor-money-rows`). Итог — «Дивиденды к выплате» (:74-77, testid `investor-dividends`).
- Состояния: loading — «Загружаем…»; ошибка — «Данные платформы недоступны — попробуйте ещё раз» + «Повторить» (:44-46); отдельного пустого состояния нет (нули честные, note объясняет модель).
- Зависимости: API GET `api/v1/platform/investor?period=…` (src/modules/platform-module/api/platform-api.ts:147-151; поля platform_inflow/outflow/balance, investor_share, dividends); PeriodChips; money/signedMoney; dashboard.scss.
- Переходы: → APP-P-036 «Рост», APP-P-037 «Точки» (нижний бар); ← APP-P-036 (таб-бар).
- Дизайн/канон — проверить визуально: 3 состояния, честные цифры (без OPEX — подписано), токены ДС, a11y, акцент investor tiffany по PRODUCT_QUALITY_BAR.
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)
