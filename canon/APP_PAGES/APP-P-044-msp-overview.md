# APP-P-044 — Кабинет МСП — Обзор («Мой магазин»)
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/cabinet/msp` · name `MspOverview` (src/router/index.ts:831)
- Тип: вложенная (родитель: группа /cabinet/msp, index.ts:766; корень группы — path "")
- Доступ: роль msp — rolesGuard("msp") + ensureRole() + teamToOwnCabinet() (роль команды уходит в APP-P-053)
- Назначение: главный экран кабинета точки: KPI точки, следующий шаг запуска, состояние заявки на подключение, последние заказы, быстрые действия и вход в b2b; кабинет живёт в контексте одного юрлица (свитчер в шапке, SZ-050).
- Функциональные блоки:
  - #kpi — 4 плитки: «Товары точки» (offers_count, акцентная), «Заказы в работе» (`/msp/orders?scope=active`, подпись «показаны первые 50» на пороге ядра — MspOverview.vue:233), «Расписание» и «Мин. заказ» (`/msp/branch/settings`, честная подпись «твой минимум» / «рекомендованный минимальный чек» — MspOverview.vue:188)
  - #next-step — «До запуска осталось N шагов» по readiness.ts (readinessSteps/readinessProgress), ведёт на шаг или MspStarter; при готовности — карточка «Витрина настроена» (MspOverview.vue:215, 451)
  - #application — блок заявки из business.store (BUSINESS_MILESTONES): вехи подключения, при отказе — причина + «Исправить и отправить заново» (BusinessApplyView) + support mailto; при invoice_issued/awaiting_payment и готовом счёте — CTA «Счёт на 1 ₽» → APP-P-045 (MspOverview.vue:460–598)
  - #latest-orders — overview.latest_orders (ядро отдаёт 10) → APP-P-047; пусто — приглашение «Проверить товары»; «Все заказы» → APP-P-046 (MspOverview.vue:600–646)
  - #actions — 5 плиток: Начать (→ APP-P-052), Заказы (→ APP-P-046), Товары (→ APP-P-048), Настройки точки (→ APP-P-050), Добавить точку (→ BusinessLandingView) (MspOverview.vue:648–680)
  - #b2b — кнопка «Большой кабинет» на `VITE_B2B_URL`; без env — честный текст вместо обещания (MspOverview.vue:255, 682–696)
  - #partner-context — выбор рабочей точки: фильтр мерчантов по activePartnerId/activeMerchantId стора, авто-выбор первой точки (MspOverview.vue:107–178, 290–293); валидация branch_id из localStorage ДО запроса (не свой — сброс, MspOverview.vue:268)
- Состояния: loading (скелетон KPI/next/block, держится при handoff-перезагрузке) / пусто — четыре разных: «Брендов пока нет» (partnerEmpty), «Точек пока нет» (partnerNoBranches), «Точки пока нет» (noPoint: 404/403 или пустой merchants, ядро канона отдаёт 200 с пустыми данными) / ошибка «network» с «Повторить» (404/403 отделены от сети — MspOverview.vue:294–298)
- Зависимости: API `api/v1/msp/overview` (roles-api.ts:658), `api/v1/msp/orders?scope=active` (:688), `api/v1/msp/branch/settings` (:790), `api/v1/msp/payment` (:677); сторы store/msp.store.ts (setPartners, setActiveBranch, activePartnerId), business-module/store/business.store.ts; helpers msp/readiness.ts, msp/order-status.ts, money.ts; стили styles/cabinet-ui.scss (role-accent-vars(tiffany))
- Переходы: → APP-P-045 (CTA «Счёт на 1 ₽»), APP-P-046/047/048/050/052, BusinessLandingView/BusinessApplyView; ← APP-P-008 (плитка роли), APP-P-025 (легаси-редирект «Моя точка»), свитчер юрлиц в каркасе CabinetLayout
- Дизайн/канон — проверить визуально: 3 состояния (4 пустоты различимы!), честные цифры (без выручки/среднего чека — их нет в ядре), токены ДС (mixin-язык кабинетов, ₽ через formatPrice), a11y (aria-hidden на глифах); специфичное: акцент msp tiffany, свитчер юрлиц в шапке по PRODUCT_QUALITY_BAR
- Сверка: роутер ✓ / код ✓ (MspOverview.vue:278–282 — три параллельных запроса; KPI — только данные ядра) / UI ✗ (скрины — параллельный агент)
