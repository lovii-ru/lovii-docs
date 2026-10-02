# APP-P-010 — Перевод баллов
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/profile/wallet/transfer` · name `ProfileTransferView` (src/router/index.ts:328)
- Тип: вложенная (родитель: APP-P-009; child MainLayout, beforeEnter auth)
- Доступ: авторизован (beforeEnter, router/index.ts:333)
- Назначение: P2P-переводы PAY-баллов и денег (SZ-077, «Переводы 2.0», BACKLOG A8): адресат одним полем (телефон/промокод/карта) с авто-определением типа, live-предрасчёт комиссии, источник одним селектом, экран успеха.
- Функциональные блоки:
  - #destination — одно поле адресата с резолвом: `apiResolveTransferDestination` (GET `api/v1/account/transfer/resolve`, ProfileTransfer.vue:58–64); kind=user/company (SZ-081: карта партнёра = счёт юрлица), resolvedName/phone маской
  - #source — источник: PAY или счёт компании (список `apiGetBalanceAccounts`, :70); без счёта компании селектор скрыт, режим всегда «по реквизиту» (activeMode, :118); «свой Business → свой PAY» — 0%
  - #amount — сумма с лимитами сервера: мин. 100 ₽, макс. 3 000 ₽, неснижаемый остаток 100 ₽ (`TRANSFER_LIMITS` helpers/transfer-form.ts); сумму не подменяем — сообщение + блокировка кнопки
  - #quote — live-предрасчёт комиссии `apiQuoteTransfer` (GET `api/v1/account/transfer/quote`, :66–71; обязателен по A8), локальная сетка ступеней 0,5–3,5% — мгновенная оценка до ответа
  - #submit — перевод `apiTransferPoints` (POST `api/v1/account/transfer`, :73+) с `idempotency_key` (uuid на попытку, защита от двойного тапа/ретрая); карта ошибок ERROR_TEXTS (:60–73: transfer_too_small/large, insufficient_reserve, recipient_not_found, transfer_to_self, account_not_accessible, idempotency_conflict…)
  - #done — экран успеха: title/details/total вместо молчаливого возврата (done ref, :78); кнопка на главную `router.push({name:'HomeView'})` (:406)
- Состояния: resolveLoading/quoteLoading/submitting (дизли­нг кнопки), recipientFound=false (адресат не найден), failedMessage (серверные ошибки картой текстов), done (успех), пусто (нет компаний — селектор скрыт)
- Зависимости: API GET `api/v1/account/transfer/quote`, `api/v1/account/transfer/resolve`, POST `api/v1/account/transfer`, GET `api/v1/balance`, `api/v1/wallet` (modules/profile-balance/api/profile-balance-api.ts); helpers `transfer-form.ts`; компоненты AppButton/AppInput/AppBottomSheet/AppPageHeader
- Переходы: → HomeView (после успеха/закрытия); ← APP-P-008 (карточка «Перевести»), APP-P-009
- Дизайн/канон — проверить визуально: эталон `lovii-demo/js/transfer.js` (сборка 126), скрин-тест «премиальный банк», честные цифры (комиссия из quote сервера, не «примерно»), токены lv-*, a11y (тап-таргеты, подписи полей), три состояния (загрузка quote/ошибка/успех)
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)
