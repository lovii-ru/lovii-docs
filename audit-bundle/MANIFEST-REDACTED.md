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

ФИНАЛ 05.10 ночь 3 (после ZCODE-REVIEW-FINAL-SUMMARY, c96e903):
- infra/lovii-deploy.sh = точная копия SRV (sha256 b69b7008… совпадает,
  сверено в момент сборки); содержит A4 strict ID-check (первичная линия)
  — замечание арены про суффикс-обход снято по существу: суффикс-версия
  была промежуточной и не используется.
- workflows ×4 = после R-1.3 (workflow-level cancel удалён;
  checks-cancel/deploy-nocancel job-группы).
- infra/deploy-monthly-summary.sh + env-parity-check.sh приложены (R-3.5/R-2.5).
- Все счётчики и ссылки согласованы (FINAL-SUMMARY: актуальное число файлов
  — в этом манифесте).

```
a856058d16471d9fc8671aabfa337d48d7821032b35b240335ef0d3e50dce5ea  audit-bundle/ARENA-FOLLOWUP-ZCODE-WAVE2-2026-10-05.md
8b05df6bff447f65e5d81364007da1cb595eb905136f1aaef26b447d1efecbb9  audit-bundle/ARENA-FOLLOWUP-ZCODE-WAVE3-2026-10-05.md
9ab57401f4953ebcc08723d685d08eeb80c47b54d2963e00f8787394a4960d7e  audit-bundle/ARENA-INBOX-2026-10-05.md
47e5a4ac248599d7446675b9d6217d6dd7282f6ed18d2d32c85793e4d99a661f  audit-bundle/AUDIT-ACCEPTANCE-2026-10-05.md
2bbc84e969011f0eb4f8921ededbad7090cb889d43419d2bb43cb5dc36757ff0  audit-bundle/AUDIT-CONTROL-2026-10-05.md
25aaf33ee0f3454130d91c7170958dc1d0fd8a6c3f6b75fea9aad74dfab1fc40  audit-bundle/AUDIT-CONTROL-R3-2026-10-05.md
5b408c00506eda71eec888428351705f78a3a487baf63b9ea1a8c1692005b625  audit-bundle/AUDIT-FINDINGS-2026-10-05.md
787973156c150fbad0c15c3981d2fe35e28c060d2a119aa2f8f4305fb25d184a  audit-bundle/AUDIT-RECONCILIATION-2026-10-05.md
d10ac14ff05f31788f06a600e1457b40a9bfd84bb91e098561d08a3e6ba76528  audit-bundle/AUDIT-RESPONSE-ACCEPTANCE-2026-10-05.md
7962456107ed0ef46173de632f79a73c4b15f2b08158542eb37b47e422514eba  audit-bundle/AUDIT-RESPONSE-ZCODE-R2-2026-10-05.md
6e80e66cb827b2d4ece9e7f628cd8fa8022ccd78f8200cdb08e4a6af6611063f  audit-bundle/AUDIT-VERDICT-ZCODE-2026-10-05.md
a59994745ddb2562c52567157fe31af2bbb3b81fe39ee903a2123ef6da849aef  audit-bundle/BASELINE-RECOMMENDATIONS.md
5d15377bd39012444e15583ce0f0e05d8e5c8d40cc01c8a901c60fd8b12491be  audit-bundle/EXECUTION-WAVE2-2026-10-05.md
a13b5ce1d7de60038c4196466fb6c07d9741b1bda5b1fe744f7a98b5eb45e5d1  audit-bundle/EXECUTION-WAVE3-2026-10-05.md
3a6e2fda83073ce7d785fb91e0fcf730c5c46cd7decf887f4d2354ad90da6231  audit-bundle/EXECUTION-WAVE3-CLOSEOUT-2-2026-10-05.md
7a1739253ccb248ca33e91567cbebe9b8a6f1d03ac284aa6625e822e93d1fb54  audit-bundle/EXECUTION-WAVE3-CLOSEOUT-2026-10-05.md
e1a2bc46fa0fae09801ab1fbe6dbf3556bd1ff40e2f7ed1001719eebc41bbda8  audit-bundle/INFRA-CONTEXT.md
089765a2faebd641a2cc8b2a13c40a5ae71f9dcf342a8e6c33e885dd5a492fbe  audit-bundle/R25-ENV-PARITY-CLASSIFICATION-2026-10-05.md
2d74757f54ca9b65796a9f8e9570e0d36d4c0d9ce7cfaf49a8dc2c9dcec530a3  audit-bundle/README.md
b3ca56835ead1d2f418bbcde4676db05d2bcce6d6fe3b66582b7ac1671a2aa18  audit-bundle/ZCODE-FINAL-SUMMARY-2026-10-05.md
e8589639dd9b7545609bfed8d4b27ec3d2238c1695206458e6b89f99468bc95d  audit-bundle/ZCODE-RESPONSE-REVIEW-CLOSEOUT-2-2026-10-05.md
a3ab5abc5bfbdbe0294dfa02e6d013cb868b661f1ce7d9cfee79302cae316c87  audit-bundle/infra/compose-core-prod.yml
b707d02fedac42b529c1b819e53e264fa5cb43898cc088d110d080abbb0ae777  audit-bundle/infra/compose-core-staging-extras.yml
b74a32680da25b814dda1d44a8692047bdb752e53d0c155c900cf9b4aa628cc9  audit-bundle/infra/compose-core-staging.yml
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  audit-bundle/infra/compose-gateway.yml
a208c83d2a30a4f8160390ee95d74174dddbcbd159e55e140efe5a6912790b4e  audit-bundle/infra/compose-lovii-admin.yml
e366305f5098e890894b91022b5ecdee348e5a7555f622cb823f6daaf5a78367  audit-bundle/infra/compose-lovii-app.yml
3c2830ccd27728fdb93b2d09ad138f3e6ed4c9857da5015cc9754aa0f6d80169  audit-bundle/infra/compose-lovii-b2b.yml
1c9b73c8f48c7e21971eb35a2cc31d8ffb4ac0eb832ceaafe53297759f9b0583  audit-bundle/infra/crontab.txt
7f5886f28a69636404a67ff31c5cb31544f2a535ac8c756d2b40d85cfc37e5cf  audit-bundle/infra/deploy-monthly-summary.sh
1458b472eb373f16db0468d10259cd26edf6eb3c737ba754ec60184b2640f784  audit-bundle/infra/env-parity-check.sh
b3721df6e589a09573aa010ec8ad02a3d60bf563e316623f1238cbca399c4784  audit-bundle/infra/gostiny-deploy.sh
b69b7008177fb7d00ad48d44d79dd1b26394f34ae9bb07a8b473463053d46506  audit-bundle/infra/lovii-deploy.sh
05b73fed212fadc5bc586ee5e8bc2568ee5b83ac2223b83e0c6a1ba3b5ace53d  audit-bundle/infra/runner-admin.json
6280323b742ad1130e5b5a26f93a17ba955442b7fce0a269f84544f425bf9fd2  audit-bundle/infra/runner-app.json
d237103e6c089c1f3c7abd5b5c258235563ee2200d87b017f8dd36ae7ad92fbb  audit-bundle/infra/runner-b2b.json
55fcc601802db22eb3c175f9b3b1bb82b3d15b4fe9e9224e09565c458ef63ad9  audit-bundle/infra/runner-core.json
814c567f413e92d9a4316defdda7ea5bbea1bd04b0c96ef8d68ab56d612c1fa4  audit-bundle/infra/runners-compose.yml
28a8f9f57436668ed9eeaceca981540b984819374893178a627852401150115f  audit-bundle/tests/RUN-EVIDENCE.md
ecfde52a0c2cc83985aa26598aa48ee97729ab73daa189deb0a080e8328db86d  audit-bundle/tests/test-mapping.py
71860b7e24d5086e5e23932ed630e0a520125fa500a382135bd7cb045980a85e  audit-bundle/workflows/lovii-admin/ci.yml
32ee4c0d63f71276039c3f5c438d4b85180d07e6b94263fbf3930071b119b948  audit-bundle/workflows/lovii-app/ci.yml
4a8d4568ff03884505c44eb603e9a646e81c8296ebb54d6809d215bb93adf741  audit-bundle/workflows/lovii-b2b/ci.yml
64bd139fd07e7e91f2b1a74c4bf070732c7fd40963ce0f6b2627e0a6fc92d86c  audit-bundle/workflows/lovii-core/ci.yml
```
