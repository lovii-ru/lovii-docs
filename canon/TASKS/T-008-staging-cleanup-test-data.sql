-- T-008: чистка тестового мусора на staging-БД lovii-core (PostgreSQL)
-- Карточка: canon/TASKS/T-008-staging-test-data-cleanup.md
-- Подготовил: Super Z, 2026-09-13. Схема сверена с миграциями lovii-core (2d99f38):
--   users(id, name nullable, phone unique)                          0001_01_01_000000
--   user_addresses(id, user_id, city_id, label nullable, address_line,
--     street, house nullable, is_default, created_at, updated_at)   0004 + 2026_03_26
--   orders(id, user_id, status, cancel_reason c 2026-09-13,
--     delivery_address_snapshot jsonb)                              0017 + 2026_09_13
--   wallets(user_id unique) · wallet_transactions(order_id nullable, FK→orders)
--   ledger_entries(order_id nullable, index, c 2026-09-11)
--   Soft-deletes на user_addresses/orders НЕТ; inbound FK на user_addresses НЕТ
--   (заказы хранят адрес jsonb-снапшотом) → мусорные адреса можно удалять физически.
-- ⚠️ ТОЛЬКО staging. ⚠️ СНАЧАЛА блок 0 + сверка актуальности с карточкой
--    (таблица ожиданий, требование владельца), ПОТОМ блоки 1–3.
--    Расхождение = СТОП, не импровизация.

-- ============================================================
-- БЛОК 0. ПРЕ-ФЛАЙТ (read-only, ничего не меняет; результаты записать)
-- ============================================================

-- 0.1 Тестовый юзер (ожидание: существует, phone = +79000000001)
SELECT id, name, phone, created_at, updated_at FROM users WHERE id = 57;

-- 0.2 Связи юзера (ожидание: заказы = тестовые #147/#148 и их прогоны)
SELECT
  (SELECT COUNT(*) FROM orders         WHERE user_id = 57) AS orders_of_user_57,
  (SELECT COUNT(*) FROM wallets        WHERE user_id = 57) AS wallets_of_user_57,
  (SELECT COUNT(*) FROM user_addresses WHERE user_id = 57) AS addresses_of_user_57;

-- 0.3 Заказы #147/#148 + проводки (ожидание: оба на user_id = 57,
--     не в живом исполнении; числа ledger_legs/wallet_txs ЗАПИСАТЬ)
SELECT o.id, o.user_id, o.status, o.cancel_reason, o.created_at,
       (SELECT COUNT(*) FROM ledger_entries      le WHERE le.order_id = o.id) AS ledger_legs,
       (SELECT COUNT(*) FROM wallet_transactions wt WHERE wt.order_id = o.id) AS wallet_txs
FROM orders o
WHERE o.id IN (147, 148)
ORDER BY o.id;

-- 0.4 Мусорные гео-адреса: label пустой/NULL или house='-'
--     (след бага адресного ввода до фикса SZ-046, app 0da6a82 2026-09-09)
SELECT a.id, a.user_id, a.label, a.house, a.address_line, a.city_id,
       a.is_default, a.created_at,
       (SELECT COUNT(*) FROM orders o WHERE o.user_id = a.user_id) AS orders_of_owner
FROM user_addresses a
WHERE COALESCE(a.label, '') = '' OR a.house = '-'
ORDER BY a.created_at DESC
LIMIT 100;

-- 0.5 Контрольный срез бухгалтерии (инвариант: после чистки НЕ меняется)
SELECT 'ledger_entries_total'      AS k, COUNT(*) AS v FROM ledger_entries
UNION ALL
SELECT 'wallet_transactions_total',      COUNT(*)      FROM wallet_transactions;

-- ============================================================
-- БЛОК 1. ЮЗЕР 57 — ПОМЕТКА (удаление запрещено: FK orders/wallets/addresses)
-- ============================================================
-- Пометка в имени — без смены схемы; видна в админке и выгрузках.
UPDATE users
SET name = '[TEST] ' || COALESCE(name, '')
WHERE id = 57
  AND COALESCE(name, '') NOT LIKE '[TEST]%';

-- ============================================================
-- БЛОК 2. ЗАКАЗЫ #147/#148 — ТОЛЬКО ПОМЕТКА (удаление запрещено)
-- ============================================================
-- Почему нельзя удалять: append-only ledger (FINANCIAL_CONTOUR §2.3),
-- инвариант сверок «сумма проводок = чек − fee» (§5.4, SZ-040),
-- FK wallet_transactions.order_id → orders (без cascade).
-- Пометка через существующую колонку cancel_reason (миграция 2026_09_13_100001).
UPDATE orders
SET cancel_reason = COALESCE(cancel_reason, 'test-order-cleanup-2026-09-13')
WHERE id IN (147, 148)
  AND cancel_reason IS NULL;

-- ============================================================
-- БЛОК 3. АДРЕСА-МУСОР — физическое удаление (FK-безопасно)
-- ============================================================
-- inbound FK на user_addresses нет (заказы — jsonb-снапшот); soft-delete нет.
-- Критерий тот же, что в 0.4: пустой label ИЛИ house='-'.
BEGIN;

-- 3.1 Сухой прогон: что именно уйдёт (состав = 0.4; счётчик тоже)
SELECT id, user_id, label, house, is_default, created_at
FROM user_addresses
WHERE COALESCE(label, '') = '' OR house = '-'
ORDER BY created_at DESC;

-- 3.2 Удаление по критерию
WITH deleted AS (
  DELETE FROM user_addresses
  WHERE COALESCE(label, '') = '' OR house = '-'
  RETURNING id
)
SELECT COUNT(*) AS deleted_by_criterion FROM deleted;

-- 3.3 Остатки тестового юзера 57 (адреса с корректным label/house — тоже тест)
DELETE FROM user_addresses WHERE user_id = 57;

-- 3.4 Сверка: deleted_by_criterion + остатки должны соответствовать 0.4/0.2.
--     Не сошлось → ROLLBACK и разбор. Сошлось → COMMIT:
COMMIT;

-- ============================================================
-- БЛОК 4. ПОСТ-ПРОВЕРКА (сверить с 0.3/0.5)
-- ============================================================
SELECT 'ledger_entries_total'       AS k, COUNT(*) AS v FROM ledger_entries
UNION ALL SELECT 'wallet_transactions_total', COUNT(*)     FROM wallet_transactions
UNION ALL SELECT 'garbage_addresses_left',    COUNT(*)     FROM user_addresses WHERE COALESCE(label,'') = '' OR house = '-'
UNION ALL SELECT 'user_57_marked',            COUNT(*)     FROM users WHERE id = 57 AND COALESCE(name,'') LIKE '[TEST]%'
UNION ALL SELECT 'orders_147_148_marked',     COUNT(*)     FROM orders WHERE id IN (147, 148) AND cancel_reason = 'test-order-cleanup-2026-09-13';

-- Ожидания:
--   ledger_entries_total / wallet_transactions_total == значения 0.5 (ни на 1 не изменились);
--   garbage_addresses_left = 0;
--   user_57_marked = 1;
--   orders_147_148_marked = 2 (если оба были без cancel_reason — см. 0.3).
-- Итог сверки и выводы блоков 0 и 4 — в карточку T-008, раздел «Отчёт исполнителя».
