\set ON_ERROR_STOP on
BEGIN;

-- Партнёры МСП-демо (владелец — partner_user 258 = core user 51)
INSERT INTO lovii_b2b.partners (id,name,slug,status,owner_user_id,inn,verified_at,created_at,updated_at) VALUES
 (806,'ООО «Ромашка»','sz077-romashka','active',258,'7801234567',NULL,now(),now()),
 (807,'ООО «Василёк»','sz077-vasilek','active',258,'7809876543',NULL,now(),now()),
 (808,'ООО «Лютик»','sz077-lyutik','active',258,'7812345678',NULL,now(),now());

INSERT INTO lovii_b2b.partner_memberships (partner_user_id,partner_id,role,branch_ids,status,created_at,updated_at) VALUES
 (258,806,'owner',NULL,'active',now(),now()),
 (258,807,'owner',NULL,'active',now(),now()),
 (258,808,'owner',NULL,'active',now(),now());

INSERT INTO public.merchants (id,name,slug,merchant_type,status,partner_id,phone,inn,legal_name,created_at,updated_at) VALUES
 (1369,'Ромашка','sz077-romashka','store','pending_moderation',806,'+79119287478','7801234567','ООО «Ромашка»',now(),now());

INSERT INTO public.merchant_branches (id,merchant_id,city_id,address_line,status,location,created_at,updated_at) VALUES
 (1070,1369,3,'Санкт-Петербург, Невский пр., 10','active',ST_SetSRID(ST_MakePoint(30.35,59.93),4326)::geography,now(),now());

-- Заявки владельца: счёт выдан и терминальный отказ
INSERT INTO public.partner_applications (id,user_id,name,inn,address_line,city_name,lat,lon,phone,email,status,promo_code,representative_user_id,partner_id,merchant_id,branch_id,verification_suffix,created_at,updated_at) VALUES
 (29,51,'ООО «Ромашка»','7801234567','Санкт-Петербург, Невский пр., 10','Санкт-Петербург',59.93,30.35,'+79119287478',NULL,'invoice_issued','AA2BTK',51,806,1369,1070,'SZSZ000001',now(),now()),
 (30,51,'ООО «Василёк»','7809876543','Санкт-Петербург, Лиговский пр., 30','Санкт-Петербург',59.92,30.36,'+79119287478',NULL,'failed','AA2BTK',51,807,NULL,NULL,'SZSZ000002',now(),now());

-- Очередь апрувов представителя (ждём подтверждения владельца промокода AA2BTK)
INSERT INTO public.partner_applications (id,user_id,name,inn,address_line,city_name,lat,lon,phone,email,status,promo_code,representative_user_id,verification_suffix,created_at,updated_at) VALUES
 (3,51,'Пекарня «Заветный хлеб»','7801111111','Санкт-Петербург, ул. Белы Куна, 4к1','Санкт-Петербург',59.87,30.40,'+79119287478',NULL,'awaiting_rep_approval','AA2BTK',51,'SZSZ000003',now(),now()),
 (7,51,'ПАФФО','7802222222','Санкт-Петербург, ул. Белы Куна, 6','Санкт-Петербург',59.87,30.41,'+79119287478',NULL,'awaiting_rep_approval','AA2BTK',51,'SZSZ000004',now(),now()),
 (10,51,'Grand','7803333333','Санкт-Петербург, ул. Белы Куна, 16','Санкт-Петербург',59.88,30.42,'+79119287478',NULL,'awaiting_rep_approval','AA2BTK',51,'SZSZ000005',now(),now());

SELECT setval('lovii_b2b.partners_id_seq',(SELECT max(id) FROM lovii_b2b.partners));
SELECT setval('lovii_b2b.partner_memberships_id_seq',(SELECT max(id) FROM lovii_b2b.partner_memberships));
SELECT setval('public.merchants_id_seq',(SELECT max(id) FROM public.merchants));
SELECT setval('public.merchant_branches_id_seq',(SELECT max(id) FROM public.merchant_branches));
SELECT setval('public.partner_applications_id_seq',(SELECT max(id) FROM public.partner_applications));
COMMIT;
