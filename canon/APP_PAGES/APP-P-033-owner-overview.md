# APP-P-033 — Владелец · Обзор
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/cabinet/owner` · name `OwnerOverview` (src/router/index.ts:654)
- Тип: вложенная (родитель: `/cabinet/owner`, CabinetLayout; вкладка «Обзор», icon bar-chart; кабинет: title «Владелец», note «Платформа целиком · LOVII», icon crown, accent gold, hideNavBar)
- Доступ: роль founder (rolesGuard на родителе, src/router/index.ts:644)
- Назначение: KPI платформы за период, GMV по месяцам и юрлица — реальные агрегаты ядра (GET /platform/owner); период по умолчанию 30 дней.
- Функциональные блоки:
  - #period — PeriodChips: неделя / 30 дней / месяц / квартал / весь период; смена перезагружает агрегаты (OwnerOverview.vue:42; src/modules/platform-module/ui/PeriodChips.vue — role="tablist", testid `period-<id>`).
  - #kpi — 4 карточки role-kpi: GMV периода (accent-карточка), Комиссия платформы («доля компании с заказов»), LOVII PASS («списания за подписку»), Сальдо платформы («поступления минус списания») (:51-72, testid `owner-kpi`).
  - #gmv-chart — «GMV по месяцам», подпись «справка · 8 месяцев»: MiniBars, акцент var(--lv-pink), формат moneyShort (:74-84; src/modules/platform-module/ui/MiniBars.vue — ноль рисуется минимальной риской 2%, не притворяется значением).
  - #legals — «Юрлица · выручка за период», счётчик: имя, точек, ИНН, verified-тег, GMV (:86-106, testid `owner-legals`).
- Состояния: loading — «Загружаем…» до первого ответа; ошибка — «Данные платформы недоступны — попробуйте ещё раз» + «Повторить» (:44-47, testid `owner-error`); пусто — «Юрлиц с точками пока нет» (:91). Загрузка при смене периода — по уже показанным данным (v-else-if="data").
- Зависимости: API GET `api/v1/platform/owner?period=…` (src/modules/platform-module/api/platform-api.ts:136-145); PeriodChips, MiniBars, money/moneyShort (src/modules/platform-module/money.ts); стили src/modules/platform-module/styles/dashboard.scss + role-kpi из src/modules/roles-module/styles/cabinet-ui.scss.
- Переходы: → APP-P-034 «Финансы», APP-P-035 «Структура» (нижний бар CabinetLayout); ← APP-P-008 (строка «Владелец» в ProfileCabinets, route OwnerOverview, flag founder). Из APP-P-032 ссылок нет.
- Дизайн/канон — проверить визуально: 3 состояния, честные цифры (OPEX не выводится), токены ДС, a11y (aria-label столбцов MiniBars, tablist периодов), акцент кабинета owner gold (pdash--gold, role-kpi--accent) по PRODUCT_QUALITY_BAR.
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)
