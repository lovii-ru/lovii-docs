"""Нормализация и сравнение токен-слоёв demo (lovii-tokens.css) vs app (lovii-tokens.scss)."""
import re, difflib

def load(path):
    src = open(path, encoding="utf-8").read()
    # снести комментарии и табы/пробелы к единому виду
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    lines = []
    for ln in src.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        ln = re.sub(r"\s+", " ", ln)
        lines.append(ln.rstrip(";"))
    return lines

demo = load("/home/z/my-project/lovii/_fresh/lovii-demo/assets/lovii-tokens.css")
app = load("/home/z/my-project/lovii/_fresh/lovii-app/src/scss/lovii-tokens.scss")

def tokmap(lines):
    m = {}
    for ln in lines:
        mm = re.match(r"(--[\w-]+):\s*(.+)$", ln)
        if mm:
            m.setdefault(mm.group(1), set()).add(mm.group(2).strip())
    return m

td, ta = tokmap(demo), tokmap(app)
only_d = sorted(set(td) - set(ta))
only_a = sorted(set(ta) - set(td))
diff_vals = sorted(k for k in set(td) & set(ta) if td[k] != ta[k])

print(f"demo токенов: {len(td)}, app токенов: {len(ta)}")
print(f"\n--- ТОЛЬКО В DEMO ({len(only_d)}) ---")
for k in only_d: print(f"  {k}: {sorted(td[k])[0][:70]}")
print(f"\n--- ТОЛЬКО В APP ({len(only_a)}) ---")
for k in only_a: print(f"  {k}: {sorted(ta[k])[0][:70]}")
print(f"\n--- РАЗНЫЕ ЗНАЧЕНИЯ ({len(diff_vals)}) ---")
for k in diff_vals:
    print(f"  {k}:\n    demo: {sorted(td[k])[0][:80]}\n    app:  {sorted(ta[k])[0][:80]}")

# нетокеновые строки (селекторы/правила в токен-слое: база, движение, легаси)
def nonvar(lines):
    return [ln for ln in lines if not re.match(r"(--[\w-]+):", ln) and not ln in ("{", "}", ":root", ":root {") and ("{" in ln or ln == "}" or ":" in ln)]
nd, na = nonvar(demo), nonvar(app)
print(f"\n--- НЕТокеновых строк: demo {len(nd)}, app {len(na)} ---")
for d in difflib.unified_diff(nd, na, lineterm="", n=0):
    if d.startswith(("---", "+++", "@@")): continue
    print(("  " + d)[:120])
