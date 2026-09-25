"""Сверка значений свойств общих кабинетных классов demo vs app (Vue scoped + cabinet-ui)."""
import re, glob, sys
from collections import defaultdict

_demo_root = sys.argv[1] if len(sys.argv)>1 else "."
_app_root = sys.argv[2] if len(sys.argv)>2 else "."
DEMO = f"{_demo_root}/css/lovii.css"
APP_DIR = f"{_app_root}/src/modules/roles-module"

def blocks_from(src):
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    out = []
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", src):
        sel = re.sub(r"\s+", " ", m.group(1).strip())
        props = {}
        for p in m.group(2).split(";"):
            if ":" in p:
                k, v = p.split(":", 1)
                k = k.strip()
                if not k.startswith(("&", "@")):
                    props[k] = re.sub(r"\s+", " ", v.strip())
        out.append((sel, props))
    return out

demo = blocks_from(open(DEMO, encoding="utf-8").read())
app = []
for f in glob.glob(APP_DIR + "/**/*.vue", recursive=True):
    for m in re.finditer(r"<style[^>]*>(.*?)</style>", open(f, encoding="utf-8").read(), flags=re.S):
        for sel, props in blocks_from(m.group(1)):
            app.append((sel, props, f.split("/")[-1]))
for sel, props in blocks_from(open(APP_DIR + "/styles/cabinet-ui.scss", encoding="utf-8").read()):
    app.append((sel, props, "cabinet-ui.scss"))

SHARED = ["cabinet__ava","cabinet__bar","cabinet__bar-ico","cabinet__bar-in","cabinet__bar-ind",
"cabinet__bar-label","cabinet__bar-link","cabinet__body","cabinet__head","cabinet__note",
"cabinet__title","cabinet__titles","msp-overview__kpi","msp-payment__amount","msp-payment__code",
"msp-starter__meter","msp-starter__meter-fill","msp-starter__progress","msp-starter__progress-label",
"msp-starter__step","msp-starter__steps","role-kpi","role-kpi__label","role-kpi__sub","role-kpi__value",
"role-kpi_accent","role-next","role-next__arrow","role-next__body","role-next__desc","role-next__icon",
"role-next__title","role-pulse","role-section-head","role-section-head__sub","role-tag","st-off",
"role-card","role-empty__icon","role-empty__text","role-empty__title","role-field__label"]

def norm(v):
    v = v.replace("'", '"')
    v = re.sub(r"0\.(?=\d)", ".", v)   # 0.85 -> .85
    v = re.sub(r"px\b", "px", v)
    return v.lower()

report = []
for fam in SHARED:
    d_blocks = [(s, p) for s, p in demo if re.search(rf"\.{fam}(?![\w-])", s)]
    a_blocks = [(s, p, f) for s, p, f in app if re.search(rf"\.{fam}(?![\w-])", s)]
    if not d_blocks or not a_blocks:
        continue
    # слить значения по семейству (demo и app по отдельности)
    d_all, a_all = defaultdict(set), defaultdict(set)
    for s, p in d_blocks:
        for k, v in p.items(): d_all[k].add(norm(v))
    for s, p, f in a_blocks:
        for k, v in p.items(): a_all[k].add(norm(v))
    common = set(d_all) & set(a_all)
    diffs = []
    for k in sorted(common):
        if d_all[k] != a_all[k]:
            diffs.append(f"{k}: demo={sorted(d_all[k])} app={sorted(a_all[k])}")
    if diffs:
        report.append((fam, diffs))

print(f"семейств с разночтениями: {len(report)} из {len(SHARED)} проверенных")
for fam, diffs in report:
    print(f"\n[{fam}]")
    for d in diffs[:6]:
        print("   ", d[:150])
