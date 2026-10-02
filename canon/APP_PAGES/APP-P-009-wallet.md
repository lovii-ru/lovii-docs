# APP-P-009 — Счёт и операции
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/profile/wallet` · name `ProfileWalletView` (src/router/index.ts:310)
- Тип: вложенная (родитель: APP-P-008; child MainLayout, beforeEnter auth)
- Доступ: авторизован (beforeEnter, router/index.ts:315 — редирект на ProfileView без токена)
- Назначение: единый экран контуров «Деньги» и «Баллы» (сессия 109): селектор счёта каруселью карт, сводка баланса и динамика месяца, лента операций с серверной пагинацией.
- Функциональные блоки:
  - #account-switch — селектор счёта: горизонтальная карусель `PayCard.vue` + точки-индикаторы (role="tablist"); скролл карусели переключает счёт (`onCarouselScroll`, ProfileWallet.vue:459–480), скины карт от уровня pay/pass/vip (`skinFor`, :539–546)
  - #balance-summary — сводка счёта: баланс («Доступно баллов»/«Доступно на счёте», unit «б.»/«₽», :197–208) + динамика месяца `monthStats` над нормализованными строками; месяц считается отдельным запросом, чтобы не занижать цифру по первой странице ленты (:77–81)
  - #operations — лента: деньги — `apiGetBalanceEntries` (GET `api/v1/balance/entries`, per_page=24, серверные фильтры from/to и пагинация `page`), баллы — `apiGetWalletTransactions` (GET `api/v1/wallet/transactions`, серверных фильтров нет — фильтр по загруженным страницам); сегмент-фильтр направления (FEED_FILTERS, role="tab", testid `wallet-tab-*`, :735–750) и период (`helpers/feed-period.ts`); строки `TxRow.vue`, группы/цепочки по дням, `WalletHistoryList.vue` для баллов; кнопка «ещё» `AppPagination` (has_more)
  - #presets — query-пресеты: `?account=ID` — открыть конкретный счёт, `?tab=points` — личный счёт (баллы), `?tab=operations` — скролл к ленте (:424–437, :555–561, onMounted :556)
  - #tier — бейдж уровня владельца: VIP по обороту 300 000 ₽ (`wallet.turnover_kopecks`), PASS по подписке (active/grace), иначе PAY (`resolveTierId`, `helpers/pay-tier.ts`, :543–556); подписка грузится молча (`apiGetSubscription`, сбой не ломает экран)
  - #head — хедер участника: имя/телефон/аватар из profile-store, фолбэк инициалов «МС» (:103–136)
  - #copy — копирование номера карты в буфер с тостом (:448–457)
- Состояния: loading (скелетон/заглушки), failed при ошибке `apiGetBalanceAccounts` (:438), feedLoading/feedFailed для ленты, пусто (нет операций); отдельные флаги страницы pageLoading
- Зависимости: API GET `api/v1/balance`, `api/v1/balance/entries`, `api/v1/wallet`, `api/v1/wallet/transactions`, `api/v1/subscription` (modules/profile-balance/api/profile-balance-api.ts); helpers `feed.ts`, `feed-period.ts`, `pay-tier.ts`, `pay-privileges-match.ts`; компоненты `PayCard.vue`, `TxRow.vue`, `WalletHistoryList.vue`, `ProfileCollapse.vue`; store `modules/profile-module/store/profile.store.ts`
- Переходы: → APP-P-010 (кнопка «Перевести»); ← APP-P-008 (card-actions/wallet-entry), APP-P-011 и APP-P-012 (redirect `/balance` и `/operations` с query-пресетами)
- Дизайн/канон — проверить визуально: скрин-тест «премиальный банк» (карты, крупный баланс), честные цифры (месяц из отдельного запроса; в счётчике баллов «на экране», не итог сервера), tabular-nums для денег (:1237), токены lv-*, a11y: role="tablist"/aria-selected у фильтров и точек
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)
