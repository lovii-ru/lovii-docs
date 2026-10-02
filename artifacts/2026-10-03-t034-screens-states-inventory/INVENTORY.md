# INVENTORY — экраны-состояния, не попавшие в скрин-пакет T-032 (T-034)

Составлено 2026-10-03 по коду `lovii-app` (рабочее дерево staging) и манифесту
`screens-gallery/manifest.json` (57 карточек). Верхний уровень покрыт полностью:
из отсутствующих в галерее ID канона APP-P-011/012/025 два — guard-редиректы
(removed, скрин не требуется), APP-P-025 — тоже редирект. Реальный пробел —
**состояния внутри страниц**: формы, визарды, модалки, confirm-диалоги.

Правила: состояния существующих страниц снимаются как `extras` манифеста,
новых ID APP-P не заводим. Съёмка — локальный стенд :5174, профиль владельца
user 51 (АТМОСФЕРА, точка 1024 «На Белы Куна», 29 товаров, заказы в работе).
Формы только открываем и закрываем — **ничего не публикуем и не сохраняем**.

## P0 — коммерческий путь МСП

| # | Slug | Что снимаем | Где в коде | Приёмка-состояние |
|---|---|---|---|---|
| 01 | `APP-P-048#add-product` | Форма «Добавить товар» (переключатель Товар активен, все поля) | `MspProducts.vue:443-600` (`msp-products-add`, `msp-products-form`) | форма открыта, без отправки |
| 02 | `APP-P-048#edit-product` | Правка существующего товара (id вместо формы добавления) | `MspProducts.vue:68` | форма с данными товара |
| 03 | `APP-P-048#add-category` | Переключатель «Категория» + форма создания категории | `MspProducts.vue:452-460, 601+` (`msp-categories-add`, `msp-categories`) | режим категории |
| 04 | `APP-P-048#category-rename` | Переименование категории (строка → поле с сохранением/отменой) | `MspProducts.vue:622-665` (`msp-category-row`, `msp-category-save/cancel`) | поле активно, затем «Отмена» |
| 05 | `APP-P-049#wizard-step1` | Визард акции, шаг 1 — выбор механики (сетка `lv-mech`) | `LoyaltyRuleWizard.vue:90-92`, `MechanicPicker.vue` | шаг 1/3 |
| 06 | `APP-P-049#wizard-mech-threshold` | Шаг 1 с выбранной механикой «Сумма чека» | `mechanicOptions()` — `msp/loyalty.ts:157` | radio is-on |
| 07 | `APP-P-049#wizard-mech-combo` | то же, «Комбо» | `loyalty.ts:165` | |
| 08 | `APP-P-049#wizard-mech-stamps` | то же, «Штампы — N-й в подарок» | `loyalty.ts:172` | |
| 09 | `APP-P-049#wizard-mech-hours` | то же, «Счастливые часы» | `loyalty.ts:178` | |
| 10 | `APP-P-049#wizard-mech-cashback` | то же, «Группа товаров» | `loyalty.ts:184` | |
| 11 | `APP-P-049#wizard-step2-threshold` | Шаг 2 — редактор процента + порог | `LoyaltyRuleWizard.vue:94-152` | шаг 2/3, без публикации |
| 12 | `APP-P-049#wizard-step2-combo` | Шаг 2 комбо | там же | |
| 13 | `APP-P-049#wizard-step2-stamps` | Шаг 2 штампы — карта штампов (`StampCard`), N-й в подарок | `loyalty/StampCard.vue` | |
| 14 | `APP-P-049#wizard-step2-hours` | Шаг 2 часы — чипы дней (`DayChips`), поля времени (`TimeField`) | `loyalty/DayChips.vue`, `TimeField.vue` | |
| 15 | `APP-P-049#wizard-step2-cashback` | Шаг 2 группа товаров — редактор группы (`LoyaltyGroupEditor`) | `loyalty/LoyaltyGroupEditor.vue` | |
| 16 | `APP-P-049#wizard-step3-publish` | Шаг 3 — бюджет (`BudgetMeter`) + предпросмотр покупателя (`BuyerPreview`) + тумблер публикации. **Не публиковать** | `LoyaltyRuleWizard.vue` шаг 3, `BudgetMeter.vue`, `BuyerPreview.vue` | шаг 3/3, закрыть крестом |
| 17 | `APP-P-047#order-actions` | Деталь заказа МСП — кнопки перевода статуса (`msp-order-set-*`) | `MspOrderDetail.vue:370-385` | заказ в работе |
| 18 | `APP-P-047#cancel-confirm` | Подтверждение отмены заказа (причина) | `MspOrderDetail.vue:394-443` (`msp-order-cancel`, `msp-order-cancel-form`) | форма открыта, «Отмена» |
| 19 | `APP-P-050#delivery-zone` | Настройки точки — зона доставки (радиус, подсказки SZ-066) | `MspBranchSettings.vue:148-222` | секция видна |
| 20 | `APP-P-051#invite-form` | Форма приглашения: бренд → точки → роль → телефон (канон SZ-047) | `MspTeam.vue:309+` (`msp-team-brands/branches/phone`) | форма с выбором |
| 21 | `APP-P-044#branch-switcher` | Модалка смены точки (`BranchSwitcher`: юрлицо→мерчант→точка, SZ-076) | `roles-module/components/BranchSwitcher.vue` | модалка открыта, закрыть |

## P1 — остальные роли и витрина

| # | Slug | Что снимаем | Где в коде |
|---|---|---|---|
| 22 | `APP-P-003#search-empty` | Каталог: пустой результат поиска | `stores-catalog/StoresCatalog.vue` (empty-состояние) |
| 23 | `APP-P-015#orders-empty` | Пустая история заказов покупателя (`OrdersEmpty`) | `profile-orders/components/OrdersEmpty.vue` |
| 24 | `APP-P-028#approval-card` | Кабинет представителя — карточка заявки на модерации (если есть данные) | `representative/RepresentativeApprovals.vue` |
| 25 | `APP-P-055#team-products` | Товары у сотрудника (read-only вид) — при отличии от P-048 | `team/TeamProducts.vue` |

## Кандидаты без скрина (владельцу на решение, не снимаем)

- Дебаг/служебные экраны (`/payment/fake` терминал уже есть — APP-P-058).
- Состояния ошибок API (рисуются текстом в карточке; снимаются точечно при ревью).

## Итог съёмки

См. `README.md` пакета (заполняется после прогона).
