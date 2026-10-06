-- Восстановление связей владельца: у партнёров, которые принадлежат
-- partner_user 258 (owner_user_id), не было строк членства, поэтому
-- МСП-кабинет их не видел, а профиль показывал (он читает owner_user_id).
-- Только для партнёров самого пользователя; повторный запуск безопасен.
BEGIN;
INSERT INTO lovii_b2b.partner_memberships (partner_user_id, partner_id, role, branch_ids, status, created_at, updated_at)
SELECT 258, p.id, 'owner', NULL, 'active', now(), now()
FROM lovii_b2b.partners p
WHERE p.owner_user_id = 258
  AND NOT EXISTS (
      SELECT 1 FROM lovii_b2b.partner_memberships m
      WHERE m.partner_user_id = 258 AND m.partner_id = p.id
  );
SELECT setval('lovii_b2b.partner_memberships_id_seq', (SELECT max(id) FROM lovii_b2b.partner_memberships));
COMMIT;
