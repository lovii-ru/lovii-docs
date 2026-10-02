# APP-P-045 — МСП — Счёт верификации
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/cabinet/msp/payment` · name `MspPayment` (src/router/index.ts:837)
- Тип: вложенная (родитель: группа /cabinet/msp, каркас CabinetLayout)
- Доступ: роль msp (rolesGuard("msp") + ensureRole() + teamToOwnCabinet())
- Назначение: проверочный счёт 1 ₽ на верификацию расчётного счёта МСП: код назначения платежа, реквизиты, инструкция, кнопка «Я оплатил» и опрос статуса банка.
- Функциональные блоки:
  - #head — карточка «Счёт верификации» со статус-чипом `payment.status_label` и пояснением про 1 ₽ (MspPayment.vue:241–256)
  - #amount-code — сумма (formatPrice + ₽), код назначения VER-* кнопкой-копированием в буфер (toast при неудаче; copied-подпись), реквизиты payee (Получатель/ИНН/Счёт/Банк) — рисуются только заполненные (env `MSP_VERIFICATION_PAYEE_*`; MspPayment.vue:80–93, 336–364)
  - #instruction — секция «Как оплатить» с текстом `payment.instruction` (MspPayment.vue:366–373)
  - #confirm — «Я оплатил, проверьте» → `POST msp/payment/sent` (передаёт платёжку в банк; без него статус висел бы навсегда) → режим комплаенса с опросом `GET msp/payment` каждые 5 с (POLL_INTERVAL_MS=5000; MspPayment.vue:44–132)
  - #compliance — пульс «Идёт комплаенс» без обещания срока + ручная «Проверить статус» с честным «статус ещё не пришёл» (notYet) + строка «Связь пропала — продолжаем проверять» при сбое опроса (MspPayment.vue:258–282, 237)
  - #done/#failed — `verified`: «Точка на витрине» → MspBranchSettings / MspOverview; `failed`/`expired`: разные тексты, «Отправить заявку заново» → BusinessApplyView + support mailto (MspPayment.vue:284–334)
- Состояния: loading (скелетон) / пусто — «Заявки пока нет» (data:null при 200 или 404 → CTA «Оформить заявку») / ошибки — «network» при полном отсутствии платежа (с «Повторить»), ошибка отправки платёжки (sendError, кнопка остаётся), сбой опроса (не выбрасывает с экрана — MspPayment.vue:105–110)
- Зависимости: API `api/v1/msp/payment` (roles-api.ts:677), `api/v1/msp/payment/sent` (roles-api.ts:670); helpers clipboard.ts, toast.ts, price-helpers.ts, BUSINESS_SUPPORT_EMAIL; таймер чистится в onBeforeUnmount (MspPayment.vue:178–182)
- Переходы: → APP-P-050 (done → «Настроить точку»), APP-P-044 (done → «Перейти в магазин»), BusinessLandingView/BusinessApplyView; ← APP-P-044 (CTA «Счёт на 1 ₽» при paymentReady), нижний бар кабинета
- Дизайн/канон — проверить визуально: 3 состояния, честные цифры («1 ₽», без обещаний «до 2 минут»), токены ДС (dashed-капсула кода по паттерну .promo-code, focus-visible pink), a11y; акцент tiffany
- Сверка: роутер ✓ / код ✓ (батч 3: AppButton импортирован — раньше кнопки не рендерились вовсе) / UI ✗ (скрины — параллельный агент)
