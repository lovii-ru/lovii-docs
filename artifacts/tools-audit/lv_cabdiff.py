"""Сравнение кабинетных стилей: demo css/lovii.css vs app styles/cabinet-ui.scss (+scoped SFC)."""
import re, subprocess, glob, sys
from collections import defaultdict

_demo_root = sys.argv[1] if len(sys.argv)>1 else "."
_app_root = sys.argv[2] if len(sys.argv)>2 else "."
DEMO = f"{_demo_root}/css/lovii.css"
APP_UI = f"{_app_root}/src/modules/roles-module/styles/cabinet-ui.scss"

def parse_css_blocks(path, nested_ok=False):
    """Вернуть {selector: {prop: value}} — плоско, без вложенности SCSS (app не будес глубоко парсить)."""
    css = open(path, encoding="utf-8").read()
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    blocks = {}
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
        sel = m.group(1).strip().replace("\n", " ")
        body = m.group(2)
        props = {}
        for p in body.split(";"):
            if ":" in p:
                k, v = p.split(":", 1)
                props[k.strip()] = v.strip()
        blocks[sel] = props
    return blocks

def classfam(sel):
    return set(re.findall(r"\.([a-z][\w-]*)", sel))

demo = parse_css_blocks(DEMO)
app = parse_css_blocks(APP_UI)

# классы-семейства кабинетов в demo
cab_re = re.compile(r"cab|rep-|amb-|msp-|^\.role-|^\.st-|dash-")
demo_cab = {s: p for s, p in demo.items() if cab_re.search(s)}
demo_fams = set()
for s in demo_cab: demo_fams |= classfam(s)
app_fams = set()
for s in app: app_fams |= classfam(s)

print(f"demo кабинетов блоков: {len(demo_cab)}, семеств классов: {len(demo_fams)}")
print(f"app cabinet-ui.scss блоков: {len(app)}, семеств классов: {len(app_fams)}")
shared = sorted(demo_fams & app_fams)
only_d = sorted(demo_fams - app_fams)
only_a = sorted(app_fams - demo_fams)
print(f"\nОБЩИЕ семейства ({len(shared)}): {', '.join(shared[:40])}")
print(f"\nТолько в demo ({len(only_d)}): {', '.join(only_d[:50])}")
print(f"\nТолько в app cabinet-ui ({len(only_a)}): {', '.join(only_a[:50])}")

# для общих семейств сравнить значения свойств по совпадающим селекторам
print("\n--- РАЗНОЧТЕНИЯ ПО ОБЩИМ СЕЛЕКТОРАМ ---")
same_sel = [s for s in demo_cab if s in app]
for s in same_sel[:40]:
    dp, ap = demo_cab[s], app[s]
    diffs = []
    for k in set(dp) & set(ap):
        if dp[k] != ap[k]:
            diffs.append(f"{k}: {dp[k]} → {ap[k]}")
    only_dp = set(dp) - set(ap)
    if diffs or only_dp:
        print(f"\n[{s}]")
        for d in diffs: print(f"   {d}")
        if only_dp: print(f"   только demo: { {k: dp[k] for k in only_dp} }")
if not same_sel:
    print("  (совпадающих селекторов 1:1 нет — сравнить по семействам вручную)")
