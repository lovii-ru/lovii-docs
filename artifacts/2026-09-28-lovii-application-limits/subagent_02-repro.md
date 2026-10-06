# ЛОВИ · Лимиты заявок: воспроизведение гипотезы (subagent_02)

## ВЕРДИКТ: **ЧАСТИЧНО ПОДТВЕРЖДЕНА**

**Подтверждено (суть гипотезы):** отказ представителя **не освобождает слот лимита**.
Каждый цикл «подача → отказ» с одним и тем же ИНН создаёт **новый** неверифицированный
черновик партнёра с активным owner-membership, который **навсегда** занимает одно из 5
мест. Пять таких циклов исчерпывают потолок, после чего подача блокируется (422
`partner_application_cap_reached`). Число неверифицированных партнёров после отказа
**не уменьшается** (проверено: 0→1→2→3→4→5, откатов вниз нет).

**Опровергнуто (уточнение механизма):** сам `reject` **не создаёт новую заявку** — он
корректно меняет статус **той же** заявки на `failed` (`RejectPartnerApplicationAction`
трогает только `status`, `rep_rejected_at`, `rep_reject_reason`). Новую заявку и новый
черновик создаёт **следующая подача** с тем же ИНН, потому что `failed` — финальный
статус (`isFinal()`), идемпотентность на него не распространяется. Поэтому формулировка
«одна и та же заявка занимает место» неточна: слоты жгут **разные** заявки с **одним ИНН**,
но итог — тот же дефект (утечка слотов лимита).

---

## 0. Схема (уточнение к постановке)

В постановке — таблицы `partners` / `partner_memberships` «у user_id 51». Фактически
партнёрский контур живёт в **отдельной схеме `lovii_b2b`**, а лимит считается по
`lovii_b2b.partner_users`, где `core_user_id` — мост к `public.users.id`.

| Что | Где |
|---|---|
| Заявки | `public.partner_applications` (`user_id`, `inn`, `status`, `partner_id`, `representative_user_id`) |
| Партнёры | `lovii_b2b.partners` (`inn`, `verified_at`, `owner_user_id`) |
| Мост «core user → partner user» | `lovii_b2b.partner_users` (`core_user_id=51` → `id=258`) |
| Членства | `lovii_b2b.partner_memberships` (`partner_user_id=258`, `partner_id`, `role`, `status`) |

Код: `App\Models\B2b\PartnerUser::MAX_UNVERIFIED_OWNED_PARTNERS = 5`;
`countUnverifiedOwnedPartners()` = партнёры с `verified_at IS NULL` + активное owner-membership.
Проверка — `CreatePartnerApplicationAction::assertUnverifiedPartnerCap()` (вызывается
после идемпотентности и после ветки «свой верифицированный ИНН», до создания).
Отказ — `RejectPartnerApplicationAction` (только смена статуса заявки).

Эквивалентный SQL лимита (проверено):

```sql
SELECT count(*) FROM lovii_b2b.partners p
WHERE p.verified_at IS NULL
  AND EXISTS (SELECT 1 FROM lovii_b2b.partner_memberships m
              WHERE m.partner_id=p.id AND m.partner_user_id=258
                AND m.role='owner' AND m.status='active');
```

## 1. Снимок исходного состояния (до изменений)

Заявки user_id 51:

```
 id |     inn      |     status     | partner_id |     created_at
----+--------------+----------------+------------+---------------------
  3 | 970512345688 | invoice_issued |        268 | 2026-09-10 19:25:08
  6 | 7842216839   | verified       |        263 | 2026-09-11 20:21:30
  8 | 7842216839   | verified       |        263 | 2026-09-20 09:06:00
  9 | 7842216839   | verified       |        263 | 2026-09-25 00:10:28
 10 | 325370946307 | invoice_issued |        272 | 2026-09-25 00:42:31
 27 | 7801234567   | verified       |        806 | 2026-09-26 16:54:33
 28 | 7842216839   | failed         |        809 | 2026-09-27 00:00:05
 29 | 7842216839   | failed         |        810 | 2026-09-27 01:08:45
 31 | 7842216839   | failed         |        812 | 2026-09-27 17:58:43
 32 | 7842216839   | failed         |        813 | 2026-09-27 18:33:44
 33 | 7842216839   | failed         |        814 | 2026-09-27 18:37:32
 34 | 7842216839   | failed         |        815 | 2026-09-27 18:38:11
(12 rows)
```

Членства `partner_user_id=258` (user 51):

```
 m.id | partner_id | role  | status  |    inn     |     verified_at
------+------------+-------+---------+------------+---------------------
  836 |        806 | owner | active  | 7801234567 | 2026-09-26 22:07:06+00
  837 |        807 | owner | active  | 7809876543 |
  838 |        808 | owner | active  | 7812345678 |
  839 |        809 | owner | revoked | 7842216839 |
  840 |        810 | owner | revoked | 7842216839 |
  842 |        812 | owner | revoked | 7842216839 |
  843 |        813 | owner | active  | 7842216839 |
  844 |        814 | owner | active  | 7842216839 |
  845 |        815 | owner | active  | 7842216839 |
(9 rows)
```

Счётчик лимита на старте = **5** (партнёры 807, 808, 813, 814, 815).

**След утечки уже в исходных данных:** один ИНН `7842216839` фигурирует в **6 отклонённых
заявках** (28, 29, 31, 32, 33, 34), которым соответствуют **6 отдельных черновиков**
партнёра (809, 810, 812, 813, 814, 815). Ни один не удалён; 809/810/812 позже вручную
переведены в `revoked`, а 813/814/815 остались `active` и держали слоты.

Отдельно: у ИНН `7842216839` есть **верифицированный** партнёр `id=263`
(`verified_at=2026-09-09`, `owner_user_id=258`), но **без строки membership**. Правило
`findOwnedVerifiedPartnerByInn` (требует активное membership) потому НЕ срабатывает, и
заявка идёт обычным путём, а не «прикреплением к верифицированному юрлицу».

### Контрольный прогон на исходном состоянии → лимит уже исчерпан

`POST /api/v1/business/applications`:

```http
HTTP_STATUS=422
{"error":{"code":"partner_application_cap_reached",
          "message":"Достигнут лимит неподтверждённых точек на пользователя."}}
```

Слоты были заняты (5/5). Для чистого воспроизведения цикла запас создан в п.3
(шаг «сброс») и полностью залогирован.

## 2. Тестовый ИНН и авторизация

- ИНН цикла = `7842216839` (из заявки id 34). Чексумма проходит (заявки с ним создаются).
- Пользователь `+79119287478` = `users.id=51`, `lovii_b2b.partner_users.id=258`.
- user 51 — **активный представитель**: промокод `AA2BTK` (`representative_promo_codes.id=5`,
  `is_active=t`). Поэтому `role.representative` пройден и `reject` по API доступен его же токеном.
- Промокод профиля `users.promo_code='AA2222'` — **неактивен** (`is_active=f`). Но
  `ProfilePromoResolver` всё равно вернул активный реп-код `AA2BTK`: подача без явного `promo`
  сразу создаёт заявку в статусе `awaiting_rep_approval` (не `submitted`).

## 3. Циклы подачи и отказа

Порядок каждого круга: `POST /business/applications` (ИНН 7842216839) → фиксация нового
`id` и `partner_id` → `UPDATE ... SET status='awaiting_rep_approval', representative_user_id=51`
(идемпотентный no-op: заявка уже была в этом статусе) → `POST
/representative/approvals/{id}/reject {"reason":"repro limit cycle"}`.

**Шаг «сброс» (для создания запаса, залогирован в п.5):** переведены в `revoked` членства
`837,838,843,844,845` → счётчик лимита **5 → 0**.

### Таблица «круг → новые заявки → новые партнёры → слотов занято из 5»

| Шаг | Новая заявка (id) | Новый партнёр (id) | cap после (из 5) | Отказ уменьшил cap? |
|---|---|---|---|---|
| старт (после сброса) | — | — | 0 | — |
| Круг 1 (submit→reject) | 35 | 816 | 1 | нет (1→1) |
| Круг 2 | 36 | 817 | 2 | нет (2→2) |
| Круг 3 | 37 | 818 | 3 | нет (3→3) |
| Круг 4 | 38 | 819 | 4 | нет (4→4) |
| Идемпотент-тест (п.4) | 39 (повтор → тот же 39) | 820 | 5 | — |
| 6-я подача (без отказа 39) | — (вернулась 39) | — | 5 | — |

Каждый круг: **+1 заявка, +1 партнёр, +1 слот**, отказ слот не освобождает.

Сырые статусы по ИНН `7842216839` после кругов (фрагмент):

```
 id |     status            | partner_id | representative_user_id
----+-----------------------+------------+------------------------
 34 | failed                |        815 |                     51
 35 | failed                |        816 |                     51
 36 | failed                |        817 |                     51
 37 | failed                |        818 |                     51
 38 | failed                |        819 |                     51
 39 | failed                |        820 |                     51
```

Ответ `reject` (круг 1, HTTP 200):

```json
{"data":{"id":35,"status":"failed","status_label":"Заявку отклонили",
 "inn":"7842216839","promo_code":"AA2BTK","rep_approved_at":null,
 "rep_rejected_at":"2026-09-27T20:42:29+00:00"}}
```

## 4. Идемпотентность до верификации (шаг 5)

Две подачи подряд одним ИНН `7842216839` **без отказа** между ними:

```
submit #1: HTTP_STATUS=201  id=39 status=awaiting_rep_approval  partner_id=
submit #2: HTTP_STATUS=200  id=39 status=awaiting_rep_approval  partner_id=
id вырос? NO
```

**Идемпотентность работает**: вторая подача вернула ту же заявку id 39 (HTTP 200, без
нового черновика). Важный нюанс: проверка идемпотентности идёт **раньше** проверки лимита,
поэтому при наличии pre-verification заявки с этим ИНН последующая подача вернёт её даже
при полном лимите (это и показала 6-я подача — вернула id 39 при cap=5, без 422).

## 5. Откат (шаг 6)

**Ожидание по коду подтвердилось: число неверифицированных партнёров после отказа НЕ
уменьшается.** Динамика счётчика: `0 →1 →2 →3 →4 →5`; ни один отказ не привёл к снижению.
Причина: `RejectPartnerApplicationAction` не трогает ни `lovii_b2b.partners.verified_at`,
ни `lovii_b2b.partner_memberships.status`.

## 6. Журнал изменений (таблица → id → было → стало)

### UPDATE (мои правки существующих строк; все — по user 51 / его заявкам)

| Таблица | id | Поле | Было | Стало | Когда |
|---|---|---|---|---|---|
| `lovii_b2b.partner_memberships` | 837 | status | active | revoked | сброс (начало) |
| `lovii_b2b.partner_memberships` | 838 | status | active | revoked | сброс (начало) |
| `lovii_b2b.partner_memberships` | 843 | status | active | revoked | сброс (начало) |
| `lovii_b2b.partner_memberships` | 844 | status | active | revoked | сброс (начало) |
| `lovii_b2b.partner_memberships` | 845 | status | active | revoked | сброс (начало) |
| `partner_applications` | 35 | status | awaiting_rep_approval | failed | круг 1 |
| `partner_applications` | 36 | status | awaiting_rep_approval | failed | круг 2 |
| `partner_applications` | 37 | status | awaiting_rep_approval | failed | круг 3 |
| `partner_applications` | 38 | status | awaiting_rep_approval | failed | круг 4 |
| `partner_applications` | 39 | awaiting_rep_approval | failed | закрытие |
| `lovii_b2b.partner_memberships` | 846–850 | status | active | revoked | очистка |
| `lovii_b2b.partner_memberships` | 837,838,843,844,845 | status | revoked | **active** | **восстановление базового состояния** |

Итоговый счётчик лимита после восстановления = **5** (как в исходном состоянии).

### CREATE (новые строки, «откат» = DELETE с WHERE; выполнять только по подтверждению владельца)

| Таблица | Новые id |
|---|---|
| `partner_applications` | 35, 36, 37, 38, 39 |
| `lovii_b2b.partners` | 816, 817, 818, 819, 820 |
| `lovii_b2b.partner_memberships` | 846, 847, 848, 849, 850 (переведены в revoked) |
| `partner_offer_acceptances` | 19, 20, 21, 22, 23 |
| `merchants` | 1377, 1378, 1379, 1380, 1381 (`pending_moderation`) |
| `merchant_branches` | 679, 680, 681, 682, 683 |

Rollback SQL (только по явному подтверждению владельца, ничего не удалено без WHERE):

```sql
-- вернуть базлайн (уже выполнено в конце задачи):
UPDATE lovii_b2b.partner_memberships SET status='active'
 WHERE id IN (837,838,843,844,845) AND partner_user_id=258;
UPDATE lovii_b2b.partner_memberships SET status='revoked'
 WHERE id BETWEEN 846 AND 850 AND partner_user_id=258;
-- при желании убрать артефакты (DELETE с WHERE, требует подтверждения):
DELETE FROM partner_offer_acceptances WHERE partner_application_id BETWEEN 35 AND 39;
DELETE FROM merchant_branches WHERE merchant_id BETWEEN 1377 AND 1381;
DELETE FROM merchants WHERE id BETWEEN 1377 AND 1381;
DELETE FROM lovii_b2b.partner_memberships WHERE id BETWEEN 846 AND 850;
DELETE FROM partner_applications WHERE id BETWEEN 35 AND 39 AND user_id=51;
DELETE FROM lovii_b2b.partners WHERE id BETWEEN 816 AND 820;
```

В git ничего не публиковалось. Никаких `TRUNCATE`/`DROP`/`DELETE` без WHERE не выполнялось.

---

## НЕ ПРОВЕРЕНО / ограничения

1. **Не воспроизведён 422 «на живом лимите» после 5 кругов с одним ИНН без идемпотентной
   заявки**: после кругов осталась pre-verification заявка (39), и 6-я подача вернула её
   (идемпотентность раньше лимита). На исходном состоянии 422 получен, но при уже
   исчерпанном лимите с ДРУГИМИ финальными заявками. Точный сценарий «5 циклов, затем 6-я
   подача → 422 при отсутствии открытой заявки» логически следует из кода и наблюдений, но
   отдельным прогоном с 5 последовательными отказами без идемпотентной заявки не оформлен.
2. **Поведение при другом ИНН**: цикл гонялся только на `7842216839`. Для других ИНН/других
   пользователей не проверялось (у user 51 на старте уже были посторонние черновики 807/808
   с чужими ИНН `7809876543`/`7812345678`, без соответствующих заявок — их происхождение
   не установлено).
3. **Поведение ветки «свой верифицированный ИНН»** (`attachBrandToVerifiedPartner`):
   партнёр 263 верифицирован по тому же ИНН без membership, поэтому ветка не срабатывала.
   Сценарий «есть активное membership к verified-партнёру» не воспроизводился.
4. **Влияние промокода**: все подачи шли с неявным промокодом профиля (`AA2BTK`), из-за
   чего статус сразу `awaiting_rep_approval`. Путь `submitted` (без представителя) не гонялся.
5. **Аудит-логи** (`lovii_b2b.partner_audit_logs`) и события уведомлений по этим циклам не
   исследовались.
6. **Причина расхождения `users.promo_code='AA2222'` (неактивен) vs фактически
   задействованный `AA2BTK`** — не разбиралась детально.

## Итог для владельца (кратко)

- Дефект: **отклонённая заявка не освобождает слот лимита** — её неверифицированный
  черновик партнёра и активное owner-membership остаются; повторные подачи с тем же ИНН
  множат черновики и жгут лимит 5. Зафиксирован «залипший» кейс: ИНН `7842216839` — 14
  заявок, 7+ черновиков-партнёров по одному ИНН.
- Ожидаемое поведение (для сверки со спекой): при отклонении заявки черновик партнёра
  должен либо освобождать слот (revoke/удаление membership), либо переиспользоваться
  повторной подачей (сейчас переиспользования нет из-за `failed` = финальный статус).
