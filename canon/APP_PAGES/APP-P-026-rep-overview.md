# APP-P-026 — Кабинет представителя — Обзор
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/cabinet/representative` · name `RepresentativeOverview` (src/router/index.ts:584)
- Тип: вложенная (родитель: `/cabinet/representative` → CabinetLayout, вкладка «Обзор» таб-бара)
- Доступ: роль representative (`rolesGuard("representative")` на группе, по флагам из GET /profile)
- Назначение: Композиция по канону демо: KPI → следующий шаг → очередь на апрув → инструкция подключения → быстрые переходы. Акцент tiffany (`role-accent-vars(tiffany)`).
- Функциональные блоки:
  - #kpi — 4 KPI-карточки: «Заявки» (applications_count, accent), «Активные точки» (active_points_count), «Доход · месяц» — честный `formatMoney(0)` с подписью «финконтур ещё не подключён», «Уровень» — «—» (RepresentativeOverview.vue:122-149).
  - #next — Блок «следующий шаг»: ссылка на заявки; заголовок/описание зависят от очереди (N заявок ждут решения / очередь пуста) (RepresentativeOverview.vue:151-176).
  - #queue — «Очередь на модерации»: список заявок (название, статус-лейбл, деятельность · город) + пустое состояние-приглашение с CTA «Промокод и ссылка — в профиле»; ссылка «Открыть очередь заявок» (RepresentativeOverview.vue:178-225).
  - #steps — «Как подключать точки»: 4 шага по фактическому пути кода (промокод → заявка → апрув представителя → оплата счёта; «доля — 40% пула») (RepresentativeOverview.vue:82-103, 227-240).
  - #actions — Быстрые переходы 2×2: Мои точки, Заявки, Доход (честный 0 ₽), Профиль (RepresentativeOverview.vue:242-273).
- Состояния: loading — скелетон (4 KPI + next + блок, AppSkeleton); пусто — пустая очередь с приглашением; ошибка — текст из `roleLoadErrorText` (нужно привязать промокод / проблема с сетью) + «Повторить»; offline — вариант сетевого текста.
- Зависимости: API `GET api/v1/representative/profile` и `GET api/v1/representative/approvals` — параллельный `Promise.all` (api/roles-api.ts:576-597); хелперы `roles-module/money.ts` (formatMoney, plural), `role-errors.ts`; стили `roles-module/styles/cabinet-ui.scss`; `LvIcon`, `AppSkeleton`, `AppButton`.
- Переходы: → APP-P-028 (Заявки: next-блок, «Открыть очередь», плитка), → APP-P-027 (Мои точки), → APP-P-029 (Доход), → APP-P-030 (Профиль, в т.ч. из пустой очереди), ← таб-бар кабинета; вход в кабинет — из профиля/переключателя ролей.
- Дизайн/канон — проверить визуально: 3 состояния (скелетон/пусто/ошибка) — есть; честные цифры (демо-метрики GMV/дельта/«Мэр» удалены — совпадает с PRODUCT_QUALITY_BAR §1); токены ДС через cabinet-ui; a11y (`aria-hidden` на плитках, тап-таргеты 44px в `.rep-overview__more`); акцент tiffany.
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)
