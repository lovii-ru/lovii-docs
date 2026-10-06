# Ревью: экраны заявок МСП (Обзор + Оплата)

Роль воркера: ревьюер заявок МСП (subagent_02). Режим — только чтение и замер, код приложения не менялся.
Стенд: `http://localhost:5175` (рабочая копия `/Users/best/LOVII/lovii-app-actual`), API `http://localhost/api/v1`.
Вход: `POST auth/send-code` → `GET /dev/otp/last-code` → `POST auth/confirm`, токен в `localStorage.loviAccessToken`. Тема — `localStorage.colorModeChoice` + `colorMode` = `light`/`dark`.
Ширина: 390 px (базовая) и 768 px (сетка). Обе темы.

Экраны:
- Экран 1 — `/cabinet/msp`, блок «Заявка на подключение точки» в Обзоре. Исходник: `src/modules/roles-module/msp/MspOverview.vue`.
- Экран 2 — `/cabinet/msp/payment`, раздел оплаты. Исходник: `src/modules/roles-module/msp/MspPayment.vue`.

**Важно про данные стенда.** У тестового профиля (+79119287478) на стенде **есть** заявка: `GET /business/applications/current` → `{id:34, status:"failed", rep_reject_reason:"еще раз 3"}`; `GET /msp/payment` → `{status:"failed", status_label:"Заявку отклонили", verification_code:"VER-815-Q3G1IK1TNA", amount:100}`. Поэтому **вживую** на обоих экранах виден отказ, а состояние оплаты «Заявки пока нет» вживую недостижимо (см. «Не удалось проверить»). Недостижимые вживую состояния воспроизведены перехватом сети в браузере (Playwright `route`) с пометкой «симулировано»; живые состояния сняты без моков.

---

## 1. Таблица находок

| # | Элемент | Замер | Критичность | Доказательство |
|---|---------|-------|-------------|----------------|
| 1 | Тёмная тема. Ссылка-CTA пустого/готового состояния `role-empty__cta` («Открыть заказы», «Проверить товары») на Обзоре | Контраст **3.22** при норме ≥4.5 (мелкий текст). Цвет текста `--lv-pink-dark` #c92a6a на фоне карточки #211b26. Токен бренда в тёмной теме не переопределяется (`lovii-tokens.scss`: комментарий «Брендовые pink/tiffany/gold НЕ меняются») | **заметно** (AA-fail) | `msp-overview-live-dark-390.png`, `msp-overview-live-dark-768.png`; структура — `cabinet-ui.scss` `@mixin role-empty-cta` (`color: var(--lv-pink-dark)`) |
| 2 | Светлая тема. Статус-чип заявки в тоне «ожидание» (`role-status[data-tone="pending"]`): «Заявка отправлена», «Счёт готов к оплате», «Банк подтверждает платёж», «Счёт выдан», «Проверяем точку» | Контраст **4.17** (на подложке `main` #f8f5f0) и **4.49** (на карточке #fff) при норме ≥4.5. Цвет `--lv-gold-text` #8a6a25 на soft-gold поверх фона | **заметно** (AA-fail, на грани) | `msp-overview-submitted-light-390.png`, `msp-overview-invoice-light-390.png`, `msp-overview-verifying-light-390.png`, `msp-payment-invoice-light-390.png`, `msp-payment-verifying-light-390.png`; `cabinet-ui.scss` `@mixin role-status` (`[data-tone="pending"]{color:var(--lv-gold-text)}`) |
| 3 | Оплата, терминальное состояние «Заявку отклонили» (`failed`/`expired`): под карточкой отказа всё равно показаны «Сумма 1 ₽», «Код назначения платежа VER-…» с копированием и блок «Как оплатить» с инструкцией платить | Рендер текста на живом экране: «…Платёж не подтвердился…» + ниже «Сумма 1 ₽ / Код назначения платежа / VER-815-Q3G1IK1TNA / Нажмите на код, чтобы скопировать / Как оплатить / Оплатите счёт…». Условия в разметке `MspPayment.vue:316` (`v-if="payment.verification_code && !isDone"`) и `:343` (`v-if="!isDone && !isVerifying"`) не исключают `failed`/`expired` | **заметно** (смысловая нестыковка: отклонённый счёт приглашает платить) | `msp-payment-live-light-390.png`, `msp-payment-live-dark-390.png`; тело экрана (bodyText) зафиксировано |
| 4 | Оплата, состояние комплаенса. Кнопка «Проверить статус» (`AppButton size="m"`) | Бокс **328×40**, псевдоэлемент `::after` отсутствует (`content:"none"`) → реальная тап-зона **40 < 44** по высоте | **заметно** (тап-зона) | `msp-payment-verifying-light-390.png`, `msp-payment-verifying-dark-390.png`; замер DOM в обоих состояниях |
| 5 | Литералы `px` вместо токенов в отступах/гэпах/типографике scoped-стилей целевых файлов | `MspPayment.vue`: `gap:18px`(392), `gap/padding 8/14px`(417–418,467–468), `gap 10px`(474,520), `gap 8px`(528,566), `padding 8px 14px`(530), `margin 6px 0 0`(567), `font-size 30px`(511), `15px`(535). `MspOverview.vue`: `gap:18px`(776), `padding:14px`(875), `gap 10px`(989), `padding 12px 14px`(990), `gap 6px`(1070), `gap 8px`(1091), `gap 4px`(1096), `padding 6px 10px`(1098) и др. Плюс подключаемые общие миксины `cabinet-ui.scss` (gap 24, padding 16, margin 4, font-size 37 литералов) | **мелочь** (осознанный долг: эти числа уже в бейзлайне храповика `design-system.baseline.json`; цель канона — вести к нулю) | `src/__tests__/design-system.baseline.json` (ключи `.../MspOverview.vue|gap-literal:5`, `MspPayment.vue|gap-literal:7` и т.п.), правило — `src/__tests__/design-system.guard.test.ts` |
| 6 | Формулировки: «точка/точки» без уточнения в видимом тексте (норма — только «торговая точка») | В разметке/текстах: `MspPayment.vue:217` «подключение точки», `:264` «точка станет активной», `:286` «Ваша точка на витрине», `:287` «настройте точку», `:289` «Настроить точку»; `MspOverview.vue:358` «откроются точки», `:380` «Добавить точку», `:391–392` «торговой точки… Пока точки нет», `:394` «Подать заявку на точку», `:408` «Товары точки», `:651–652` «Добавить точку»/«Следующая точка сети»; `business-status.ts:22` «заявку вашей точки», `:40` «Точка на витрине», `:107` «Ваша точка на витрине!», `:108` «„Точка“ теперь в каталоге», `:114` «подключение точки» | **мелочь** (единый контент-долг; глубже — зона воркера канона) | Рендер на скриншотах: `msp-payment-missing-light-390.png` («Счёт выставляется по заявке на подключение точки»), `msp-payment-verified-light-390.png`, `msp-overview-submitted-light-390.png`, `msp-overview-live-light-390.png` |
| 7 | Опечатка «Инсталяционный» (должно — «инсталляционный») | `business-status.ts:30` (веха «Инсталяционный платёж»), `:90`, `:96` | **мелочь** | Видно в вехах таймлайна: `msp-overview-submitted-light-390.png`, `msp-overview-invoice-light-390.png` |
| 8 | Типографика имени заявки: в ветках таймлайна — прямые кавычки «Пекарня "Пышка"», в карточке отказа — «Пекарня «Пышка»» | `MspOverview.vue` `typoRu()` применяется только в карточке отказа (`:456`), в мете таймлайна `:534` выводится `application.name` как есть | **мелочь** | `msp-overview-submitted-light-390.png` (прямые кавычки) vs `msp-overview-live-light-390.png` («ёлочки»); bodyText обоих |
| 9 | Нет семантического `<h1>` ни в шапке, ни в контенте | `document.querySelectorAll('h1').length === 0` на обоих экранах в обеих темах. Шапка кабинета МСП — `CabinetLayout.vue:204` `<header class="cabinet__subhead">` (ветка со свитчером юрлица), в ней `<h1>` нет вообще. Заголовок «Мой магазин» живёт только в `document.title` и в подписи-свитчере | **мелочь** (требование «в контенте `<h1>` нет» формально выполнено; но заголовка-`<h1>` на странице нет — по решению владельца от 2026-09-25 ролевая шапка со снята) | DOM-замер `h1 total/inMain = 0/0` на всех снимках; `CabinetLayout.vue:183` (ветка с `h1`) не активна, т.к. `meta.cabinetPartnerSwitcher=true` |
| 10 | Обзор: у профиля с отклонённой заявкой экран одновременно показывает «Витрина настроена» (всё готово) и карточку «Заявку отклонили» | Блок `msp-overview__ready` (ветка `v-else` при `nextStep===null`) + карточка отказа ниже | **наблюдение** (не дефект: заявка относится к другому юрлицу/бренду — мультибренд; риск путаницы для владельца) | `msp-overview-live-light-390.png` |
| 11 | Консоль: `[Vue Router warn]: The `next()` callback in navigation guards is deprecated…` | 1 warning на каждый переход на обоих экранах | **мелочь** (общесистемное, не относится к этим экранам) | console job-JSON всех живых прогонов |

Блокеров не найдено.

## 2. Ложные находки (помечены по определению из плана)

- **`.app-header__address` («Выбрать адрес») — бокс 109×36** и **`.app-header__icon` — бокс 36×36**: `::after` (content `""`, `position:absolute`, `inset:-4px`) расширяет зону до **≥44 px** (у адреса высота 44, у иконки 44×44). Это **ложная находка** — реальная зона нажатия ≥44.
- **`app-button` с брендовой заливкой** (белый текст на градиенте): автозамер контраста даёт 1.0–1.09, но фон градиентный и метод не применим — помечено «N/A», не дефект (белый на брендовом градиенте — канон).
- Литералы цвета в `MspOverview.vue` из бейзлайна (`color-literal:2`) — оба вхождения **внутри CSS-комментария** (`#e8f7f7` как пояснение замера), не реальные нарушения.

## 3. Проверено и в порядке

**Заголовок/каркас**
- `<main class="cabinet__body container">` существует, шапка (`<header class="cabinet__subhead">` + `AppHeader`) — **вне** `<main>`. `<h1>` в контенте **нет** (0/0) в обеих темах и на обеих ширинах.

**Тап-зоны (контент, 390 px и 768 px)**
- Кнопки `AppButton` `size="l"`/`"xl"` (CTA заявки, «Исправить и отправить заново», «Написать в поддержку», «Счёт на 1 ₽», «Я оплатил, проверьте») — высота **44–52**.
- Кнопка копирования кода `.msp-payment__code` — **248×44** (есть `min-height:44px`).
- Ссылки `role-empty__cta` («Открыть заказы», «Проверить товары») — **44** по высоте.
- Плитки быстрых действий `role-action`, ссылки нижней навигации — **≥44**.
- Единственная настоящая находка по тап-зонам — п.4 таблицы.

**Контраст (WCAG AA, обе темы)**
- Тёмная тема: весь текст, кроме п.1, ≥ 5.3. Чипы статусов в тёмной теме: pending **7.0**, failed **5.37**, verifying/invoice **6.25** — ок.
- Светлая тема: весь текст, кроме gold-чипа (п.2), ≥ 4.7. Чипы: failed **4.72**, active/verified («Точка активна») **5.16** — ок. KPI, подписи, `role-kv`, `role-note__text`, `role-field__label/hint`, `role-empty__title/text`, денежные значения — ок.
- Кнопки на брендовом градиенте — канон, замер не применим.

**Состояния заявки (обзорный блок и таймлайн)**
- **рассматривается** (`submitted`) — «Заявка №34» + вехи, текущая «Модерация» с честным текстом без сроков. ✔ (симулировано)
- **счёт готов / ожидание оплаты** (`invoice_issued`/`awaiting_payment`) — CTA «Счёт на 1 ₽ — перейти к оплате». ✔ (симулировано)
- **проверка платежа** (`verifying`) — пульс «Идёт комплаенс — банк подтверждает платёж», без обещания срока. ✔ (симулировано)
- **отказ** (`failed`) — **терминальное состояние, «счастливого» таймлайна нет**: рендерится одна карточка (статус, причина, действия, метаданные), список вех в этой ветке не выводится. ✔ (живые данные)
- **нет данных** (заявки нет) — на Обзоре блок заявки просто отсутствует (после `applications/current → data:null`); на Оплате — карточка «Заявки пока нет» с CTA. ✔ (симулировано)
- **загрузка** — скелетоны отрисованы (Оплата: холодная загрузка; Обзор: повторный вход в раздел). ✔ (симулировано, см. §4)
- **ошибка сети** — «Обзор недоступен — проблема с сетью» / «Счёт недоступен — проблема с сетью» + «Повторить». ✔ (симулировано)

**Тексты/данные**
- Внутренних ссылок вида «FINANCIAL_CONTOUR §…», «SZ-…», «TASK…», «P0-…» в отрендеренном тексте **нет** (скан bodyText всех состояний).
- Данные реальные: «Заявка №34 · ИНН 7842216839 · подана 27 сентября 2026 г.», название «Пекарня «Пышка»», код «VER-815-Q3G1IK1TNA», сумма «1 ₽» (amount=100 коп.). Реквизиты получателя (`payee`) приходят пустыми (env не настроен) — блок «Реквизиты» корректно скрывается (`msp-payment-nopayee-light-390.png`).
- Живые API-запросы без ошибок (все 200): `/api/v1/msp/overview?branch_id=671`, `/api/v1/msp/orders?scope=active&branch_id=671`, `/api/v1/msp/branch/settings?branch_id=671`, `/api/v1/business/applications/current`, `/api/v1/msp/payment`. Консольных ошибок нет (только warning по `next()`).

**Сетка**
- 390 px — KPI 2 колонки (`174px 174px`, gap 10px); 768 px — 4 колонки (`176.5px ×4`, gap 10px). Переключение по `@media (min-width:768px)` в `@mixin role-kpi-grid`. Оверлеев/обрезаний нет.

## 4. Не удалось проверить

| Что | Причина |
|-----|---------|
| Состояние оплаты «Заявки пока нет» **вживую** | У тестового профиля есть заявка (`applications/current → id:34, failed`), поэтому живой `/msp/payment` показывает отказ, а не «нет». Состояние воспроизведено только перехватом сети (`data:null`): `msp-payment-missing-light-390.png`, `msp-payment-missing-dark-390.png` |
| «одобрена» (`verified`) как **блок заявки на Обзоре** | При `verified` `pendingApplication=false` → блок скрывается по разметке (`MspOverview.vue:462`). Как отдельного состояния блока не существует; на Оплате `verified` показан: `msp-payment-verified-light-390.png` |
| Скелетон **Обзора** при холодной загрузке | Роут-гард (`beforeEnter → ensureRole()`) ждёт тот же `GET /msp/overview`, поэтому компонент не монтируется, пока данные не пришли — на холодной загрузке виден общеэкранный splash, не скелетон; скелетон снят при повторном входе в раздел (`msp-overview-loading-light-390.png`, реальный `.msp-overview__skeleton`) |
| Контраст **выключенных** кнопок («Я оплатил, проверьте» при `sending`, «Проверить статус» при `checking`) | Не удалось удержать состояние `disabled` в кадре; замер не проводился |
| `payee` (реквизиты) с реально заполненными значениями | На стенде env `MSP_VERIFICATION_PAYEE_*` не настроен — приходит `{name:null,inn:null,account:null,bank:null}`. Заполненный вид показан на симуляции: `msp-payment-invoice-light/dark-390.png` |
| Состояние `expired` (истёк срок) отдельно | Достижимо только как `failed`-ветка по разметке (`isFailed` включает `expired`), отдельного рендера нет |

## 5. Скриншоты (`.cluster/lovii-rep-msp-screens/shots/`, префикс `msp-`)

Живые (без моков):
- `msp-overview-live-light-390.png`, `msp-overview-live-dark-390.png`, `msp-overview-live-light-768.png`, `msp-overview-live-dark-768.png`
- `msp-payment-live-light-390.png`, `msp-payment-live-dark-390.png`, `msp-payment-live-light-768.png`, `msp-payment-live-dark-768.png`

Симулированные (перехват сети, помечены):
- Обзор: `msp-overview-submitted-light-390.png`, `msp-overview-submitted-dark-390.png`, `msp-overview-invoice-light-390.png`, `msp-overview-verifying-light-390.png`, `msp-overview-noapp-light-390.png`, `msp-overview-loading-light-390.png`, `msp-overview-error-light-390.png`
- Оплата: `msp-payment-missing-light-390.png`, `msp-payment-missing-dark-390.png`, `msp-payment-invoice-light-390.png`, `msp-payment-invoice-dark-390.png`, `msp-payment-verifying-light-390.png`, `msp-payment-verifying-dark-390.png`, `msp-payment-verified-light-390.png`, `msp-payment-nopayee-light-390.png`, `msp-payment-loading-light-390.png`, `msp-payment-loading-dark-390.png`, `msp-payment-error-light-390.png`

Обе темы присутствуют для живых состояний и для ключевых симулированных (рассматривается, «Заявки пока нет», счёт, комплаенс, загрузка).

## 6. Точные URL/коды ответов (п.6 задания)

- Живые экраны: ошибок сети нет. Все вызовы `/api/v1/...` → **200** (перечень в §3).
- Симуляция ошибки Обзора: `GET http://localhost/api/v1/msp/overview?branch_id=671` → **500** (3 запроса — повтор из-за гарда/watch), консоль: `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`.
- Симуляция ошибки Оплаты: `GET http://localhost/api/v1/msp/payment` → **500**, консоль та же.
