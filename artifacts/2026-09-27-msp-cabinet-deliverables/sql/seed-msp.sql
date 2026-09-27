\set ON_ERROR_STOP on
BEGIN;

-- Клонирование строки-образца с подменой части колонок (без id).
CREATE OR REPLACE FUNCTION pg_temp.clone_row(p_schema text, p_table text, p_src bigint, p_over jsonb)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE cols text; sel text; newid bigint;
BEGIN
  SELECT string_agg(quote_ident(column_name), ',') INTO cols
    FROM information_schema.columns
    WHERE table_schema=p_schema AND table_name=p_table AND column_name<>'id';

  SELECT string_agg(
      CASE WHEN p_over ? column_name
        THEN CASE WHEN p_over->>column_name IS NULL THEN 'NULL'
                  ELSE quote_literal(p_over->>column_name) END
        ELSE quote_ident(column_name) END, ',') INTO sel
    FROM information_schema.columns
    WHERE table_schema=p_schema AND table_name=p_table AND column_name<>'id';

  EXECUTE format('INSERT INTO %I.%I (%s) SELECT %s FROM %I.%I WHERE id=$1 RETURNING id',
                 p_schema, p_table, cols, sel, p_schema, p_table)
    USING p_src INTO newid;
  RETURN newid;
END $$;

DO $$
DECLARE p1 bigint; p2 bigint; p3 bigint; m1 bigint; b1 bigint; b2 bigint; a1 bigint;
BEGIN
  -- 3 юрлица (партнёры), владелец — partner_user 258 (core user 51, +79119287478)
  p1 := pg_temp.clone_row('lovii_b2b','partners',263, jsonb_build_object(
        'name','ООО «Ромашка»','slug','sz077-romashka','inn','7801234567',
        'owner_user_id',258,'status','active','verified_at',NULL,'representative_approved_at',NULL));
  p2 := pg_temp.clone_row('lovii_b2b','partners',263, jsonb_build_object(
        'name','ООО «Василёк»','slug','sz077-vasilek','inn','7809876543',
        'owner_user_id',258,'status','active','verified_at',NULL,'representative_approved_at',NULL));
  p3 := pg_temp.clone_row('lovii_b2b','partners',263, jsonb_build_object(
        'name','ООО «Лютик»','slug','sz077-lyutik','inn','7812345678',
        'owner_user_id',258,'status','active','verified_at',NULL,'representative_approved_at',NULL));

  -- членство владельца во всех трёх (branch_ids NULL = все точки)
  INSERT INTO lovii_b2b.partner_memberships (partner_user_id, partner_id, role, branch_ids, status, created_at, updated_at)
  VALUES (258,p1,'owner',NULL,'active',now(),now()),
         (258,p2,'owner',NULL,'active',now(),now()),
         (258,p3,'owner',NULL,'active',now(),now());

  -- мерчант «Ромашка» (ждёт модерации) + 2 точки
  m1 := pg_temp.clone_row('public','merchants',286, jsonb_build_object(
        'name','Ромашка','slug','sz077-romashka','status','pending_moderation','partner_id',p1,
        'inn','7801234567','legal_name','ООО «Ромашка»'));
  b1 := pg_temp.clone_row('public','merchant_branches',1026, jsonb_build_object(
        'merchant_id',m1,'partner_id',p1,'name','Ромашка · Невский пр., 10'));
  b2 := pg_temp.clone_row('public','merchant_branches',1027, jsonb_build_object(
        'merchant_id',m1,'partner_id',p1,'name','Ромашка · Лиговский пр., 30'));

  -- заявка на стадии выданного счёта → на экране появится «Я оплатил, проверьте»
  a1 := pg_temp.clone_row('public','partner_applications',12, jsonb_build_object(
        'user_id',51,'name','ООО «Ромашка»','inn','7801234567','status','invoice_issued',
        'partner_id',p1,'merchant_id',m1,'branch_id',b1,
        'representative_user_id',51,'promo_code','AA2BTK','rep_approved_at',NULL,
        'rep_rejected_at',NULL,'rep_reject_reason',NULL,'verification_suffix','SZ077'));

  RAISE NOTICE 'partners: % / % / %  merchant: %  branches: % / %  application: %', p1,p2,p3,m1,b1,b2,a1;
END $$;

COMMIT;

-- проверка
SELECT 'partner' AS t, id, name, inn, owner_user_id FROM lovii_b2b.partners WHERE slug LIKE 'sz077-%' ORDER BY id;
SELECT 'member' AS t, partner_user_id, partner_id, role, status FROM lovii_b2b.partner_memberships WHERE partner_user_id=258 ORDER BY partner_id;
SELECT 'merchant' AS t, id, name, status, partner_id FROM public.merchants WHERE partner_id IN (SELECT id FROM lovii_b2b.partners WHERE slug LIKE 'sz077-%');
SELECT 'branch' AS t, id, name, merchant_id FROM public.merchant_branches WHERE merchant_id IN (SELECT id FROM public.merchants WHERE partner_id IN (SELECT id FROM lovii_b2b.partners WHERE slug LIKE 'sz077-%'));
SELECT 'app' AS t, id, status, name, inn, user_id, partner_id, merchant_id, verification_suffix FROM public.partner_applications WHERE inn='7801234567' ORDER BY id;
