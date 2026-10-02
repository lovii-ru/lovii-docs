# APP-P-021 — ЛОВИ Бизнес — лендинг подключения точки
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/business` · name `BusinessLandingView` (src/router/index.ts:502)
- Тип: вложенная (родитель: `/business` → MainLayout, гард на группе)
- Доступ: авторизован (beforeEnter группы `/business`: нет `localStorage.loviAccessToken` → редирект на `ProfileView`)
- Назначение: Шаг 2 сценария «ЛОВИ Бизнес» (SZ-007): что даёт подключение, условия/тарифы из канона PARAMS §1.3, вход в форму заявки; при незавершённой заявке — тапабельная статус-строка.
- Функциональные блоки:
  - #hero — Хедер «ЛОВИ Бизнес»: иконка тарифа, заголовок, лид про витрину района (BusinessLanding.vue:55-62).
  - #status-row — Статус-строка заявки: видна только для ожидающей заявки (для `verified` скрыта — `hasVerifiedApplication`), вся строка — ссылка на статус-экран; заголовок из `businessStatusView()`, подпись из `BUSINESS_ROW_SUB` (BusinessLanding.vue:39-48, 64-77; package/business-status.ts:169).
  - #tariffs — «Условия»: три тарифа (СТАРТ 0%/0 ₽, БАЗОВЫЙ 10%, PRO 4–7% + 2 990 ₽/мес) одной картой со строками-разделителями; числа только из `BUSINESS_TARIFFS` (BusinessLanding.vue:83-102; package/const/business.ts:22).
  - #steps — «Как это работает»: 3 нумерованных шага из `BUSINESS_STEPS` («Заполнить заявку» → «Подтвердить точку» → «Начать продавать») (BusinessLanding.vue:104-112; package/const/business.ts:42).
  - #cta — Плавучая CTA «Добавить точку» (sticky, стекло `--lv-glass`) → `BusinessApplyView` (BusinessLanding.vue:114-122).
- Состояния: loading/пусто — явных нет: заявка грузится в mounted только если `loadState === 'idle'`, пока не готова — статус-строки просто нет; ошибка сети глотается стором (`errorHandler(error, false)`) — экран не падает, но и не сообщает. Offline-состояния нет.
- Зависимости: store `business.store.ts` (`loadCurrentApplication`, геттер `hasVerifiedApplication`); API `GET api/v1/business/applications/current` (business-api.ts:81); константы `package/const/business.ts`; `businessStatusView`/`BUSINESS_ROW_SUB` (package/business-status.ts).
- Переходы: → APP-P-022 (`BusinessApplyView`, CTA «Добавить точку»), → APP-P-023 (`BusinessStatusView`, статус-строка), ← APP-P-008 (ProfileView — back-to и точка входа), ← APP-P-033/052 (MspOverview/MspStarter — «добавить ещё точку»), ← CabinetLayout (MerchantSwitcher/BranchSwitcher «Добавить…», CabinetLayout.vue:224-228).
- Дизайн/канон — проверить визуально: 3 состояния (заявки нет / ждёт / verified), честные цифры тарифов из PARAMS (не хардкод в компоненте ✓), токены ДС (`--lv-bg`, `--background-normal-surface`, бренд-переменные ✓), a11y (статус-строка — RouterLink, dot `aria-hidden`); стекло CTA не должно перекрывать контент.
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)
