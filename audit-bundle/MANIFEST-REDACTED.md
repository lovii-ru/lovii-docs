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

## Инвентарь (sha256, генерируется при сборке — R-0.4 арены)

```
84ca6419e30603279198cfd726628ee7cf1bda17ea456c2a5806900159e60cd0  ./.DS_Store
2bbc84e969011f0eb4f8921ededbad7090cb889d43419d2bb43cb5dc36757ff0  ./AUDIT-CONTROL-2026-10-05.md
5b408c00506eda71eec888428351705f78a3a487baf63b9ea1a8c1692005b625  ./AUDIT-FINDINGS-2026-10-05.md
6e80e66cb827b2d4ece9e7f628cd8fa8022ccd78f8200cdb08e4a6af6611063f  ./AUDIT-VERDICT-ZCODE-2026-10-05.md
a59994745ddb2562c52567157fe31af2bbb3b81fe39ee903a2123ef6da849aef  ./BASELINE-RECOMMENDATIONS.md
ba135fb3b9bc461ced41086e6ed04b0eb7fe8fbd6774cb98573cbf4801b3924f  ./INFRA-CONTEXT.md
a51dd859ccdd4dd38ce739549322fb6032568101cbfad50827b61e9a9b33a65a  ./README.md
a3ab5abc5bfbdbe0294dfa02e6d013cb868b661f1ce7d9cfee79302cae316c87  ./infra/compose-core-prod.yml
a3ab5abc5bfbdbe0294dfa02e6d013cb868b661f1ce7d9cfee79302cae316c87  ./infra/compose-core-staging.yml
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  ./infra/compose-gateway.yml
a208c83d2a30a4f8160390ee95d74174dddbcbd159e55e140efe5a6912790b4e  ./infra/compose-lovii-admin.yml
e366305f5098e890894b91022b5ecdee348e5a7555f622cb823f6daaf5a78367  ./infra/compose-lovii-app.yml
3c2830ccd27728fdb93b2d09ad138f3e6ed4c9857da5015cc9754aa0f6d80169  ./infra/compose-lovii-b2b.yml
bc4968db68de0fb6b7c0895d6a482004b6d0ae39ac97071ecc2a68e923c4a37e  ./infra/crontab.txt
b3721df6e589a09573aa010ec8ad02a3d60bf563e316623f1238cbca399c4784  ./infra/gostiny-deploy.sh
05b73fed212fadc5bc586ee5e8bc2568ee5b83ac2223b83e0c6a1ba3b5ace53d  ./infra/runner-admin.json
6280323b742ad1130e5b5a26f93a17ba955442b7fce0a269f84544f425bf9fd2  ./infra/runner-app.json
d237103e6c089c1f3c7abd5b5c258235563ee2200d87b017f8dd36ae7ad92fbb  ./infra/runner-b2b.json
55fcc601802db22eb3c175f9b3b1bb82b3d15b4fe9e9224e09565c458ef63ad9  ./infra/runner-core.json
d4194966bba8c9b52cbf7f86d0c86ab6edbadbc9ea32e61fdf88b43b8c1b7b86  ./workflows/.DS_Store
72df6b79992f7c0ac432e8f0b993115c516cc0e98eb7ac251ab0253f83494158  ./workflows/lovii-admin/ci.yml
79d38a2d1acb4f73c347217d5d947934f0e4431b215a86b7bdd44b41a1697a9a  ./workflows/lovii-app/ci.yml
9fdc77e1ce575f1b828b6b54f896b5bda8b3658af58716c735f6410c95b67697  ./workflows/lovii-b2b/ci.yml
cb197bf12a6a09e63c7bebc8932a06636c8c6036fb5e735578612810255e4063  ./workflows/lovii-core/ci.yml
```

Правки 05.10 (волна 1): workflows обновлены из репо после внедрения R-1.1..1.7.
