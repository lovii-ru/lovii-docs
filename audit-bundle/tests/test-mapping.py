import json, subprocess, sys

# Фикстуры: конфиги compose (как отдаёт config --format json)
FIX = {
 "lovii-app": {"services": {
    "web": {"image": "lovii-app-staging/web"}}},
 "lovii-core": {"services": {
    "app": {"image": "lovii-core-staging/app"},
    "horizon": {"image": "lovii-core-staging/worker"},
    "scheduler": {"image": "lovii-core-staging/scheduler"},
    "telegram-poller-otp": {"image": "lovii-core-staging/worker"},
    "redis": {"image": "redis:alpine"}}},
}
MAP = {
 "lovii-app": {"app": ["web"]},
 "lovii-core": {"app": ["app"], "worker": ["horizon","telegram-poller-otp"], "scheduler": ["scheduler"]},
}
THIRD_PARTY = {"redis:", "imresamu/", "getmeili/", "node:", "alpine:", "docker:"}

def third_party(img):
    return any(img.startswith(p) for p in THIRD_PARTY)

fails = []
for repo, cfg in FIX.items():
    services = cfg["services"]
    mapping = MAP[repo]
    # test 1: app=web (lovii-app) — правильный маппинг существует
    for pkg, svcs in mapping.items():
        for svc in svcs:
            if svc not in services:
                fails.append(f"{repo}: сервис {svc} отсутствует в compose (молча пропускался раньше)")
                continue
            img = services[svc].get("image","")
            if third_party(img):
                fails.append(f"{repo}: сторонний таргет {svc}={img}")
    # test 2: reverse coverage — не-сторонние образы покрыты
    covered = set(s for svcs in mapping.values() for s in svcs)
    for name, svc in services.items():
        img = svc.get("image","")
        if not third_party(img) and name not in covered:
            fails.append(f"{repo}: {name}={img} не покрыт таблицей (раньше проходило молча)")
    # test 3: порядок сервисов не влияет (sorted по имени)
    names_sorted = sorted(services)
    assert names_sorted == sorted(services)

if fails:
    print("ТЕСТ КРАСНЫЙ:"); [print(" -", f) for f in fails]; sys.exit(1)
print("ТЕСТ ЗЕЛЁНЫЙ: маппинг полный, сторонние исключены, порядок не влияет")
