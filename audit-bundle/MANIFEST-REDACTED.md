# Манифест санитизации — что вычищено / чего нет в пакете

Проверено grep'ом по всему пакету. Данные состояния на 2026-10-05.

## Нет в пакете (и не должно попасть)

- Любые значения секретов: GitHub Secrets (DEPLOY_SSH_KEY, DEPLOY_HOST,
  DEPLOY_USER, DEPLOY_PATH — в workflows только имена-ссылки `${{ secrets.* }}`);
- Содержимое `.env` серверов (токены ботов MAX/TG/VK, терминалы Т-Банка,
  T-API токен, пароли БД/Redis/Meilisearch, OTP-секреты);
- `.credentials` файлы раннеров (registration token) — из раннеров взят только
  `.runner` (agentId/agentName/labels, без токенов);
- mTLS-сертификаты и ключи Т-Банка (serт, приватные ключи, CA-бандлы);
- `authorized_keys` сервера (в пакете только список комментариев-имён ключей
  в ACCESS-MATRIX репо, не сами ключи);
- IP-адрес сервера и домены намеренно оставлены (публичные), но в связке с
  «этот сервер держит банковский контур» — пометка для аудита, не утечка.

## Что вместо секретов в файлах

- compose-файлы: только `${VAR}`-ссылки на .env сервера — литералов нет
  (проверено grep'ом token|secret|password|key);
- workflows: `${{ secrets.* }}`;
- gostiny-deploy: registry/token приходят по stdin при вызове, на диске не
  хранятся (видно в коде wrapper'а).

## Если найден секрет

Любая модель/агент, нашедший в пакете что-то, похожее на секрет, должен
пометить это как CRITICAL-находку, а не использовать. Утечка секрета из
пакета = ротация всего задетого (см. RULES.md §2).

## Инвентарь (sha256, генерируется при сборке — R-0.4)

Финал 06.10 (RECHECK-3): compose-gateway — литерал SOCKS5 убран (GOST_UPSTREAM в .env хоста), lovii-deploy unified (source a4-predicate.sh, fail-closed), predicate перенесён в infra/, тест wrapper структурный, gostiny-deploy REF_RE без ведущего '-', INBOX/SUMMARY синхронизированы (C1/C4–C6/R-1.8/R-3.1). 51 файл без манифеста, перегенерирован последним шагом коммита.

## Чеклист экспорта машинных файлов в пакет (после инцидента SOCKS5)

Перед коммитом любого машинного конфига:
1. grep -rnE '(socks5?|http|https)://[^/$"'[:space:]]+@' — userinfo-литералы;
2. grep -rniE 'token|secret|password|pass=|key=' по добавленным файлам (ручной просмотр хитов);
3. любые env-значения — только \${VAR}-ссылки, сами значения в .env хоста (в git НЕ попадают).


```
a856058d16471d9fc8671aabfa337d48d7821032b35b240335ef0d3e50dce5ea  ./ARENA-FOLLOWUP-ZCODE-WAVE2-2026-10-05.md
8b05df6bff447f65e5d81364007da1cb595eb905136f1aaef26b447d1efecbb9  ./ARENA-FOLLOWUP-ZCODE-WAVE3-2026-10-05.md
13fc8d45aa94d654736ac0faf46b783412fafd39ee67c17351d93d96d2eeac31  ./ARENA-INBOX-2026-10-05.md
47e5a4ac248599d7446675b9d6217d6dd7282f6ed18d2d32c85793e4d99a661f  ./AUDIT-ACCEPTANCE-2026-10-05.md
2bbc84e969011f0eb4f8921ededbad7090cb889d43419d2bb43cb5dc36757ff0  ./AUDIT-CONTROL-2026-10-05.md
25aaf33ee0f3454130d91c7170958dc1d0fd8a6c3f6b75fea9aad74dfab1fc40  ./AUDIT-CONTROL-R3-2026-10-05.md
5b408c00506eda71eec888428351705f78a3a487baf63b9ea1a8c1692005b625  ./AUDIT-FINDINGS-2026-10-05.md
787973156c150fbad0c15c3981d2fe35e28c060d2a119aa2f8f4305fb25d184a  ./AUDIT-RECONCILIATION-2026-10-05.md
ed98e18312472541381b4d0431667a00d162315fdd155bf287a8e7ec360b4c81  ./AUDIT-RESPONSE-ACCEPTANCE-2026-10-05.md
7962456107ed0ef46173de632f79a73c4b15f2b08158542eb37b47e422514eba  ./AUDIT-RESPONSE-ZCODE-R2-2026-10-05.md
6e80e66cb827b2d4ece9e7f628cd8fa8022ccd78f8200cdb08e4a6af6611063f  ./AUDIT-VERDICT-ZCODE-2026-10-05.md
a59994745ddb2562c52567157fe31af2bbb3b81fe39ee903a2123ef6da849aef  ./BASELINE-RECOMMENDATIONS.md
5d15377bd39012444e15583ce0f0e05d8e5c8d40cc01c8a901c60fd8b12491be  ./EXECUTION-WAVE2-2026-10-05.md
a13b5ce1d7de60038c4196466fb6c07d9741b1bda5b1fe744f7a98b5eb45e5d1  ./EXECUTION-WAVE3-2026-10-05.md
44ffe0d9dc090ee7b9e8b1c91f49b322f35c85dec1555da210f56280cf45579a  ./EXECUTION-WAVE3-CLOSEOUT-2-2026-10-05.md
7a1739253ccb248ca33e91567cbebe9b8a6f1d03ac284aa6625e822e93d1fb54  ./EXECUTION-WAVE3-CLOSEOUT-2026-10-05.md
e1a2bc46fa0fae09801ab1fbe6dbf3556bd1ff40e2f7ed1001719eebc41bbda8  ./INFRA-CONTEXT.md
93708f404457162941cf9762c19dec2f7907cf0e32fc6f3457baa0eeb76c65c1  ./OWNER-DECISIONS-C4C5C6-2026-10-06.md
089765a2faebd641a2cc8b2a13c40a5ae71f9dcf342a8e6c33e885dd5a492fbe  ./R25-ENV-PARITY-CLASSIFICATION-2026-10-05.md
2d74757f54ca9b65796a9f8e9570e0d36d4c0d9ce7cfaf49a8dc2c9dcec530a3  ./README.md
8706f337380391358e7a508492ee5721a7e3ea72beacd7f785e4565f58c270d9  ./ZCODE-FINAL-SUMMARY-2026-10-05.md
b4d414689b429639040e8ba20022c4bf40d294d51f7492166739c57c2e941487  ./ZCODE-RESPONSE-ARENA-RECHECK-3-2026-10-06.md
f4580ebeae59d918fc0c7fabced8be4d9c46b7445b5b80f178560470975ce615  ./ZCODE-RESPONSE-RECHECK-2-2026-10-05.md
d72fa272badc455d275098db40e4c73fd604a5877ff5d22886f9cc55a5121cf0  ./ZCODE-RESPONSE-RECHECK-2026-10-05.md
e8589639dd9b7545609bfed8d4b27ec3d2238c1695206458e6b89f99468bc95d  ./ZCODE-RESPONSE-REVIEW-CLOSEOUT-2-2026-10-05.md
6980dc75c74fe314a7a2166b0e07e173e49f4c57b79e039d211890d6f139e544  ./ZCODE-RESPONSE-REVIEW-RESPONSE-RECHECK-2-2026-10-06.md
3512b4743926bb99d679699afec9b89b82001aa4f9626462985d3479a034c12a  ./infra/a4-predicate.sh
a3ab5abc5bfbdbe0294dfa02e6d013cb868b661f1ce7d9cfee79302cae316c87  ./infra/compose-core-prod.yml
b707d02fedac42b529c1b819e53e264fa5cb43898cc088d110d080abbb0ae777  ./infra/compose-core-staging-extras.yml
b74a32680da25b814dda1d44a8692047bdb752e53d0c155c900cf9b4aa628cc9  ./infra/compose-core-staging.yml
aea4ecbd85e6ef049b39b175520bd749be51510338a48e5dcd4870c913f122c9  ./infra/compose-gateway.yml
a208c83d2a30a4f8160390ee95d74174dddbcbd159e55e140efe5a6912790b4e  ./infra/compose-lovii-admin.yml
e366305f5098e890894b91022b5ecdee348e5a7555f622cb823f6daaf5a78367  ./infra/compose-lovii-app.yml
3c2830ccd27728fdb93b2d09ad138f3e6ed4c9857da5015cc9754aa0f6d80169  ./infra/compose-lovii-b2b.yml
1c9b73c8f48c7e21971eb35a2cc31d8ffb4ac0eb832ceaafe53297759f9b0583  ./infra/crontab.txt
7f5886f28a69636404a67ff31c5cb31544f2a535ac8c756d2b40d85cfc37e5cf  ./infra/deploy-monthly-summary.sh
1059d9f144593f5747bb29933cf2054e1e2eb1a27e7b46d84c52ad801bdb9ee5  ./infra/env-parity-check.sh
8d3aff30dbe6991eb2854360961baead0547a0a484b2f59bcc604b54f8540777  ./infra/gostiny-deploy.sh
478b95727ad58d57f81b13cc44ea9451c334b181a8f256225193a3f671f869b4  ./infra/lovii-deploy.sh
05b73fed212fadc5bc586ee5e8bc2568ee5b83ac2223b83e0c6a1ba3b5ace53d  ./infra/runner-admin.json
6280323b742ad1130e5b5a26f93a17ba955442b7fce0a269f84544f425bf9fd2  ./infra/runner-app.json
d237103e6c089c1f3c7abd5b5c258235563ee2200d87b017f8dd36ae7ad92fbb  ./infra/runner-b2b.json
55fcc601802db22eb3c175f9b3b1bb82b3d15b4fe9e9224e09565c458ef63ad9  ./infra/runner-core.json
814c567f413e92d9a4316defdda7ea5bbea1bd04b0c96ef8d68ab56d612c1fa4  ./infra/runners-compose.yml
bac80a17241c051e10d194a286a7cbb4414cabd36e3579854ad4f2cd02672074  ./tests/RUN-EVIDENCE.md
ecfde52a0c2cc83985aa26598aa48ee97729ab73daa189deb0a080e8328db86d  ./tests/test-mapping.py
0165a48c8cf0926ebdc3e73df4cca9ecf34ad58582478673465fbf2d7bfc86ad  ./tests/test-wrapper-guard.bash
71860b7e24d5086e5e23932ed630e0a520125fa500a382135bd7cb045980a85e  ./workflows/lovii-admin/ci.yml
32ee4c0d63f71276039c3f5c438d4b85180d07e6b94263fbf3930071b119b948  ./workflows/lovii-app/ci.yml
4a8d4568ff03884505c44eb603e9a646e81c8296ebb54d6809d215bb93adf741  ./workflows/lovii-b2b/ci.yml
64bd139fd07e7e91f2b1a74c4bf070732c7fd40963ce0f6b2627e0a6fc92d86c  ./workflows/lovii-core/ci.yml
```
