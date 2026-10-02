# APP-P-036 — Инвестор · Рост
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/cabinet/investor` · name `InvestorGrowth` (src/router/index.ts:693)
- Тип: вложенная (родитель: `/cabinet/investor`, CabinetLayout; вкладка «Рост», icon trending-up; кабинет: title «Инвестор», note «Рост и доходность платформы», icon trending-up, accent tiffany, hideNavBar)
- Доступ: роль founder (rolesGuard на родителе, src/router/index.ts:683)
- Назначение: Метрики роста платформы: GMV, пользователи, точки, средний чек + динамика новых пользователей по месяцам — реальные агрегаты ядра (GET /platform/investor).
- Функциональные блоки:
  - #period — PeriodChips (по умолчанию 30 дней; InvestorGrowth.vue:42).
  - #kpi — 4 карточки: GMV периода (accent), Пользователи (users_total, «всего на платформе», ru-локаль), Точки (branches_active «активных из branches_total»), Средний чек (подпись «заказов за период: N») (:51-72, testid `investor-kpi`).
  - #users-chart — «Пользователи по месяцам», подпись «новые · 8 месяцев»: MiniBars c акцентом var(--lv-pink), без format (значение = число) (:74-83).
- Состояния: loading — «Загружаем…»; ошибка — «Данные платформы недоступны — попробуйте ещё раз» + «Повторить» (:44-47, testid `investor-error`); пустых блоков нет — KPI/график всегда рендерятся из агрегатов (нули честные, MiniBars ноль = минимальная риска).
- Зависимости: API GET `api/v1/platform/investor?period=…` (src/modules/platform-module/api/platform-api.ts:147-151); PeriodChips, MiniBars; money; dashboard.scss + cabinet-ui.scss (role-kpi).
- Переходы: → APP-P-037 «Точки», APP-P-038 «Доходность» (нижний бар); ← APP-P-008 (строка «Инвестор» в ProfileCabinets, route InvestorGrowth, flag founder).
- Дизайн/канон — проверить визуально: 3 состояния, честные цифры, токены ДС, a11y, акцент кабинета investor tiffany (pdash--tiffany, role-kpi--accent) по PRODUCT_QUALITY_BAR.
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)
