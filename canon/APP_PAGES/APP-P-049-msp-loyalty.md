# APP-P-049 — МСП — Промо (лояльность)
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/cabinet/msp/loyalty` · name `MspLoyalty` (src/router/index.ts:861)
- Тип: вложенная (родитель: группа /cabinet/msp, каркас CabinetLayout)
- Доступ: роль msp; таб «Промо» по ability `merchant.update_profile` (index.ts:814–819, право PromoAccess бэкенда)
- Назначение: конструктор акций точки на сервисе лояльности core (SZ-073/074): кэшбэк по умолчанию со степпером, группы товаров со своим процентом, акции (комбо, порог чека, штампы, счастливые часы) и итог по точке.
- Функциональные блоки:
  - #cashback — «Кэшбэк по умолчанию»: hero-процент, role=switch, степпер ±1 (0…100), сохранение создаёт/обновляет правило `cashback` c trigger {kind:"item"} и storefront-карточкой «N% на всё» (выключенный — снимается с витрины; MspLoyalty.vue:115–151); платформенный ориентир, если правило платформы есть
  - #groups — «Группы товаров»: медальон процента («10%» или честный «—»), свод groupSummary, тумблер группы, редактор LoyaltyGroupEditor (выбор товаров из loyalty/catalog) → создание кэшбэк-правила группы с карточкой витрины «Кэшбэк: имя»; удаление группы сначала снимает её правило (ядро запрещает удалять связанную; MspLoyalty.vue:206–275)
  - #promos — «Акции»: строки правил с type_label / «На витрине» / «Стоп по бюджету» (loyaltyStatus), тумблер is_active, визард LoyaltyRuleWizard (создание/правка/удаление; MspLoyalty.vue:173–181, 277–307)
  - #summary — «Итог по точке»: 4 KPI (кэшбэк по умолчанию, группы, активные акции, на витрине) + честная строка про выплаты из доли точки (+ комиссия LOVII 25%) и «оценка без прогноза оборота» (MspLoyalty.vue:544–570)
  - #helpers — проценты/подписи из msp/loyalty.ts (defaultCashbackRule, pointSummary, ruleSubtitle…); компоненты msp/loyalty/*.vue (BudgetMeter, BuyerPreview, StampCard…) — порт демо lovii-demo/css/loyalty.css
- Состояния: loading (скелетон) / пусто — «Точки пока нет» (isPartnerWithoutBranches), «Групп пока нет», «Акций пока нет» с приглашением / ошибки — загрузка с «Повторить», actionError на каждое действие («Кэшбэк не сохранился», «Группа не удалилась»…), catalogError «Товары не загрузились — состав групп можно задать позже»
- Зависимости: API `api/v1/loyalty/rules` GET/POST/PATCH/DELETE (roles-api.ts:985–1003), `api/v1/loyalty/groups` (:1007–1037), `api/v1/loyalty/catalog` (:1042), `api/v1/msp/products` (для подписей оферов); стор store/msp.store.ts (activeBranchId, isPartnerWithoutBranches)
- Переходы: → нет (визард/редактор — инлайн на этом же экране); ← APP-P-044, нижний бар кабинета
- Дизайн/канон — проверить визуально: 3 состояния, честные цифры («—» вместо невыставленного процента, комиссия 25% названа), токены ДС (lv-* классы демо + mixin-язык кабинета), a11y (role=switch c aria-checked и aria-label); акцент tiffany; десктоп — две колонки 40/60 (MspLoyalty.vue:633–642)
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)
