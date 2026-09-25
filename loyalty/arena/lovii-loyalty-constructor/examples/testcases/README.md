# Golden-кейсы движка лояльности

Каждый файл — один сценарий: **вход** (кампании + контекст чека или список клиентов для планировщика) и **ожидаемый результат** референсного движка ([`/demo/app/loyalty-constructor/engine.js`](../../../../demo/app/loyalty-constructor/engine.js)). Любая реализация движка (TypeScript/Go/Python/Java) обязана давать тот же результат — это критерий готовности эпика E0 из [10-implementation-plan.md](../../10-implementation-plan.md).

```bash
cd docs/lovii-loyalty-constructor
node examples/run-golden.mjs            # все кейсы → «36 passed, 0 failed»
node examples/run-golden.mjs lm-04      # только кейсы, чьё имя содержит подстроку
node examples/run-golden.mjs --update   # перезаписать expected результатами референсного движка (только при осознанном изменении поведения!)
```

## Формат кейса

```jsonc
{
  "id": "lm-01-threshold-below",
  "title": "LM-01: чек 440 ₽ ниже порога 450 ₽ → подсказка …",
  "kind": "quote",                       // quote (по умолчанию) | scheduler
  "campaigns": [
    { "campaign_id": "cmp_threshold", "version": 1, "status": "active", "published_at": "2026-09-01T00:00:00+03:00",
      "spec_file": "../campaigns/lm-01-threshold.json",   // или "spec": {…} инлайном
      "spec_patch": { "audience": { "holdout_pct": 0 } }, // необязательный deep-merge поверх spec
      "budget_used_minor": 0, "uses_total": 0 }
  ],
  "settings": {},                        // переопределения DEFAULT_SETTINGS движка (03 §2.4)
  "context": { … },                      // тело POST /loyalty/quote (05 §3.1): merchant_id, order_id, now, customer|null, items, coupon_code, redeem_points, state, catalog
  "customers": [{ "customer": {…}, "state": {…} }], "now": "…",  // только для kind = scheduler
  "expected": { … }                      // канонический результат quote / список issued планировщика
}
```

Правила сравнения (см. `canonical()` в [run-golden.mjs](../run-golden.mjs)):

* JSON сравнивается с отсортированными ключами; `undefined`-поля отбрасываются;
* `quote_id` и `engine_version` игнорируются везде; `expires_at` игнорируется только на верхнем уровне (срок действия quote). `expires_at` лотов и купонов **сравнивается** — он детерминирован от `context.now`;
* деньги в копейках, баллы целые — никакой толерантности к округлению нет.

## Как добавить кейс

1. Возьмите ближайший файл как образец; уникальный `id` = имя файла без `.json`; в `title` — читаемая формула сценария с ожидаемыми числами.
2. Кампанию подключайте через `spec_file` из [`../campaigns/`](../campaigns/) (они генерируются `build-examples.mjs` из шаблонов прототипа). Локальные отличия — через `spec_patch`, а не копированием spec.
3. `context.now` — всегда ISO-строка с явным смещением (`+03:00`); `order_id` фиксированный (от него зависят `quote_id`, коды купонов и розыгрыш LM-16).
4. Запустите `node examples/run-golden.mjs --update <id>`, **прочитайте** получившийся `expected` и сверьте цифры вручную с [03-rules-engine.md](../../03-rules-engine.md). `--update` не доказывает правильность — только фиксирует поведение.
5. Кейс должен проверять одну идею (одну ветку конвейера). Для регрессий движка добавляйте новый файл, а не расширяйте старый.

## Состав (36 кейсов)

Демо-точка «Кофейня Daily» (`mrc_daily`, Europe/Moscow), «сегодня» — вторник 2026-09-22 09:40. Клиенты: `cus_1` Аня (PASS, 12 покупок, 4 штампа, лоты 1 050 базовых + 200 промо до 26.09), `cus_new` Дима (первая покупка), `cus_sleep` Игорь (47 дней без покупок), `cus_bday` Оля (VIP, ДР через 3 дня), `cus_staff` Марк (сотрудник), гость без LOVII.

| Файл | kind | Сценарий |
|---|---|---|
| `coupon-available-hint.json` | quote | Клиент с неиспользованным купоном, код не введён → подсказка coupon_available |
| `coupon-inline-redeem-at-partner.json` | quote | Купон партнёра (inline) в кошельке клиента → виртуальная кампания coupon:<code> даёт −15 % у mrc_sloyka |
| `guest-price-only.json` | quote | Гость без LOVII в счастливые часы: скидка применяется, наград и кэшбэка нет (guest) |
| `lm-01-free-item-reward.json` | quote | LM-01 с наградой-товаром: подарок добавляется в чек по цене 0 (add_if_missing) |
| `lm-01-holdout.json` | quote | LM-01: клиент из контрольной группы (hash % 100 < 10) — кампания не применяется и не подсказывает |
| `lm-01-limit-per-customer.json` | quote | LM-01: лимит 2 срабатывания в день исчерпан → limit_per_customer |
| `lm-01-threshold-below.json` | quote | LM-01: чек 440 ₽ ниже порога 450 ₽ → подсказка «добавьте Эспрессо», штамп 4→5, базовый кэшбэк 5 % (пример 05 §4.1) |
| `lm-01-threshold-reached.json` | quote | LM-01: чек 590 ₽ ≥ 450 ₽ → +60 промо-баллов на 14 дней + штамп + базовый кэшбэк |
| `lm-02-bundle-fixed-price.json` | quote | LM-02: латте 250 + круассан 164 → набор за 349 ₽ (скидка 65 ₽), окно 08:00–11:00 |
| `lm-02-bundle-missing-component.json` | quote | LM-02: только латте → подсказка «добавьте круассан — и набор станет дешевле» |
| `lm-03-addon-applied.json` | quote | LM-03: кофе + чизкейк → чизкейк по спеццене 199 ₽ (скидка 121 ₽), кэшбэк на оплаченное |
| `lm-03-addon-hint.json` | quote | LM-03: кофе в чеке, чизкейка нет → подсказка addon_offer 199 ₽ вместо 320 ₽ |
| `lm-04-by-category.json` | quote | LM-04 по категориям: десерт 10 % (32 б.) + кофе 3 % (6 б.) на eligible_amount |
| `lm-04-flat-cap-300.json` | quote | LM-04 плоский 5 %: крупный чек упирается в cap 300 баллов |
| `lm-04-flat-with-points-redeem.json` | quote | LM-04 плоский 5 % + списание 300 баллов: доля ≤ 50 %, лоты FIFO (промо точки → базовые), кэшбэк только на оплаченное деньгами |
| `lm-04-ladder-step-and-next-hint.json` | quote | LM-04 лестница: чек 660 ₽ → ступень 650 ₽ = 5 % (33 б.), подсказка до ступени 1000 ₽ (8 %) |
| `lm-05-happy-hours-in-window.json` | quote | LM-05: 19:30, выпечка −30 % (слойка 180 → 126, круассан 164 → 114,80) |
| `lm-05-happy-hours-outside-window.json` | quote | LM-05: 09:40 — вне окна → skipped window |
| `lm-06-stamps-complete.json` | quote | LM-06: 5-й штамп + покупка → карточка 6/6 завершена, награда в следующем чеке |
| `lm-06-stamps-min-interval.json` | quote | LM-06: предыдущий штамп 30 минут назад → stamp_interval (защита от дробления чека) |
| `lm-06-stamps-pending-reward-free-drink.json` | quote | LM-06: pending_reward → самый дешёвый напиток бесплатно (капучино 220 из капучино + латте), новая карточка получает штамп |
| `lm-08-subscription-unit.json` | quote | LM-08: активный абонемент (8 из 10) → капучино списан абонементом (0 ₽), латте оплачен деньгами |
| `lm-09-challenge-completed.json` | quote | LM-09: третий визит → цель достигнута, +300 баллов сразу |
| `lm-09-challenge-progress.json` | quote | LM-09: вторник 09:40 в окне будни 07–11 → прогресс визитов 1 → 2 из 3 |
| `lm-10-welcome-vs-threshold-stacking.json` | quote | LM-10 + LM-01: новый клиент, чек 604 ₽ → приветственные +100 (priority 120) побеждают в группе bonus, порог skipped stacking |
| `lm-12-cross-promo-issue.json` | quote | LM-12: чек 440 ₽ ≥ 300 ₽ → купон −15 % в «Слойку» (redeemer_merchant_id) на 5 дней |
| `lm-13-coupon-blocks-cashback.json` | quote | LM-13 с stacking.blocks=[cashback]: купон отменяет промо-кэшбэк точки, базовый кэшбэк LOVII остаётся |
| `lm-13-coupon-invalid.json` | quote | LM-13: неизвестный код → coupon.valid=false, кампания skipped coupon_invalid |
| `lm-13-coupon-public-with-cashback.json` | quote | LM-13: код DAILY15 −15 % на завтраки (сырники 340 → 289) + LM-04 кэшбэк stackable |
| `lm-16-instant-win-daily-limit.json` | quote | LM-16: дневной лимит выпавшего приза (эспрессо, 20/день) исчерпан → следующий по таблице («−20 % на следующий») |
| `lm-16-instant-win-deterministic.json` | quote | LM-16: чек 810 ₽ ≥ 700 ₽ → приз по u = sha256(order_id:campaign_id) (u≈0,69 → «Эспрессо в подарок» купоном на 7 дней); повторный quote даёт тот же приз |
| `lm-16-instant-win-jackpot.json` | quote | LM-16: u≈0,999 → главный приз «Чизкейк бесплатно» (вес 1 %, лимит 2/день) |
| `lm-17-gift-card-purchase.json` | quote | LM-17: покупка сертификата 2 000 ₽ + капучино → уведомление, кэшбэк только на капучино (сертификат исключён из базы наград) |
| `max-total-discount-cap.json` | quote | Потолок суммарной скидки 30 %: набор (−65 ₽) + купон −25 % на чек → купон урезан до потолка |
| `scheduler-winback-birthday.json` | scheduler | Планировщик: win-back для уснувшего (47 дней ≥ 45, ≥ 2 покупок) и подарок имениннице (3 дня до ДР); постоянный и новый — без выдачи |
| `staff-excluded.json` | quote | Сотрудник точки: все кампании с exclude_staff → staff_excluded; базовый кэшбэк платформы остаётся |

Порядок покрытия по конвейеру (03 §4): выбор кампаний (`schedule`/`window`/`audience`/`holdout`/`staff_excluded`/`limit_per_customer`) → ценовые действия и стекинг (`item_price` → `basket_discount`, потолок 30 %) → списание баллов (доля ≤ 50 %, FIFO лотов) → награды (`bonus` exclusive по приоритету, кэшбэки stackable, cap 300) → подсказки → explain.
