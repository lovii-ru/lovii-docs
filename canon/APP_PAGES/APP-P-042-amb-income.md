# APP-P-042 — Амбассадор · Доход
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/cabinet/ambassador/income` · name `AmbassadorIncome` (src/router/index.ts:753)
- Тип: вложенная (родитель: `/cabinet/ambassador`, CabinetLayout; вкладка «Доход», icon wallet; accent gold)
- Доступ: роль ambassador (rolesGuard на родителе, src/router/index.ts:723)
- Назначение: Факт дохода + модель + история выплат. До ledger-фазы 3 core отдаёт честный ноль и пустую историю (сплит 20% пула ветки, FIN_BALANCE_REFERRAL_BRIEF); вместо графиков демо — факт + модель + пустая история с пояснением (AmbassadorIncome.vue:9-15).
- Функциональные блоки:
  - #month — «Доход · месяц»: крупное значение income_month (34px, testid `amb-income-month-value`); подпись: если income_total > 0 — «За всё время — …», иначе честное «Начисления начнутся с первыми распределениями пула платформы.» (:56-68, testid `amb-income-month`).
  - #model — «Модель дохода»: иконка percent; текст: доля амбассадора — 20% в сплите 40/40/20 (пул ветки делится между точкой, представителем и амбассадором); учёт включится с выплатами платформы, до этого — честный ноль (:70-80, testid `amb-income-model`).
  - #history — «История выплат»: список записей (amount + comment/created_at, :85-92); пусто — карточка «Выплат пока нет» («История появится после первых начислений — когда включим выплаты платформы») + CTA «Моя ветка» → AmbassadorReps (:94-101, testid `amb-income-empty`).
- Состояния: loading — скелетоны (месяц + модель + история); ошибка — roleLoadErrorText («…после назначения ветки.» / «Доход недоступен — проблема с сетью…») + «Повторить» (:44-47, testid `amb-income-error`); пусто — см. #history. Отдельного «экрана пусто» нет — экран всегда показывает факт (ноль) + модель.
- Зависимости: API GET `api/v1/ambassador/income` (rolesApi.ambassadorIncome — src/modules/roles-module/api/roles-api.ts:618-621; поля income_month, income_total, history: amount/comment/created_at); formatMoney (ambassador/money.ts); AppButton, AppSkeleton, LvIcon; roleLoadErrorText.
- Переходы: → APP-P-040 (CTA «Моя ветка»); ← APP-P-039 (действие «Доход»), таб-бар.
- Дизайн/канон — проверить визуально: 3 состояния, честные цифры (ноль без фейковых графиков), токены ДС (--lv-soft-gold карточка месяца), a11y (aria-hidden декоративных глифов), акцент amb gold по PRODUCT_QUALITY_BAR.
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)
