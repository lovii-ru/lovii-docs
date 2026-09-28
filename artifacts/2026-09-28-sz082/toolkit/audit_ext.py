#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SZ-082 Phase A — расширенные проверки карточки (READ-ONLY).
Добавляет к базовым аудиторам:
  app:  helpers/store-export без читателей; роуты без экранов (файл отсутствует);
        тесты, импортирующие несуществующее; иконки LvIcon (LV_ICONS) в обе стороны.
  core: DDD-скан всех классов app/** (Domain/Application/Infrastructure/...);
        enum-кейсы без статических ссылок (мягко — ловушка DB-value);
        blade-партиалы без @include/view-name.
  b2b/admin: Shield-политики без моделей.
Usage: python3 audit_ext.py <repo_root> <out_dir> --repo <name> [--icons-demo <demo js icons file>]
"""
import os, re, sys, argparse
from lib_common import (Candidate, iter_files, read_text, search, all_src_files,
                        write_report, git_head, LIVE)

LIVE_V = LIVE


def ts_files(root):
    return [f for f in all_src_files(root) if f.endswith(('.ts', '.js', '.vue'))]


# ---------------- APP extensions ----------------

def audit_helpers(root, files, out_cands):
    """exported function/const in helpers + stores: S1 import-by-name, S2 raw word."""
    targets = [f for f in files if f.endswith('.ts') and '/src/' in f.replace('\\', '/')
               and ('/helpers/' in f or '/stores/' in f) and '/__tests__' not in f]
    src = [f for f in files if f.endswith(('.ts', '.js', '.vue'))]
    for t in targets:
        txt = read_text(t)
        names = set(re.findall(r"export\s+(?:async\s+)?(?:function|const)\s+(\w+)", txt))
        for n in sorted(names):
            c = Candidate(cid=f"helper:{n}", repo='app', kind='helper-store-export',
                          path=os.path.relpath(t, root),
                          why='exported helper/store-экспорт: нет импортов и упоминаний имени в src')
            c.add('S1_import', search(root, src, rf"import\s+[^;]*\b{re.escape(n)}\b", exclude_path=t))
            if c.verdict() == LIVE_V:
                continue
            c.add('S2_raw_word', search(root, src, rf"\b{re.escape(n)}\b", exclude_path=t))
            if c.verdict() != LIVE_V:
                out_cands.append(c)


IMPORT_RX = re.compile(r"(?:component|element)\s*:\s*\(\)\s*=>\s*import\(\s*['\"]([^'\"]+)['\"]")


def audit_routes_broken(root, files, out_cands):
    """роуты без экранов: import-путь из route record не резолвится в файл."""
    router_files = [f for f in files if ('router' in f or 'routes' in f) and f.endswith(('.ts', '.js'))]
    src_all = files
    for rf in router_files:
        base_dir = os.path.dirname(rf)
        src_root = os.path.join(root, 'src')
        for m in IMPORT_RX.finditer(read_text(rf)):
            spec = m.group(1)
            if spec.startswith('@/'):
                cand = os.path.join(src_root, spec[2:])
            elif spec.startswith('~/'):
                cand = os.path.join(src_root, spec[2:])
            else:
                cand = os.path.normpath(os.path.join(base_dir, spec))
            if not cand.endswith(('.vue', '.ts', '.js')):
                continue
            if os.path.exists(cand):
                continue
            base = os.path.basename(spec.split('/')[-1])
            c = Candidate(cid=f"route-broken:{base}", repo='app', kind='route-without-screen',
                          path=f"{os.path.relpath(rf, root)} → {spec}",
                          why='route record импортирует экран, которого нет в дереве (битый чанк/переименование)')
            c.add('S1_resolve', [])
            c.add('S2_basename', search(root, src_all, re.escape(base)))
            if c.verdict() != LIVE_V:
                out_cands.append(c)


def audit_tests(root, files, out_cands):
    """тесты, тестирующие удалённое: import в __tests__ не резолвится."""
    tests = [f for f in files if ('__tests__' in f or f.endswith('.spec.ts'))]
    for t in tests:
        txt = read_text(t)
        rel_dir = os.path.dirname(t)
        for m in re.finditer(r"from\s+['\"](\.{1,2}/[^'\"]+)['\"]", txt):
            spec = m.group(1)
            for suffix in ('', '.ts', '.vue', '/index.ts', '.js'):
                if os.path.exists(os.path.normpath(os.path.join(rel_dir, spec + suffix))):
                    break
            else:
                c = Candidate(cid=f"test-broken:{os.path.basename(t)}:{os.path.basename(spec)}",
                              repo='app', kind='test-of-removed',
                              path=f"{os.path.relpath(t, root)} → {spec}",
                              why='тест импортирует модуль, которого нет в дереве (тестирует удалённое)')
                c.add('S1_resolve', [])
                c.add('S2_module_name', search(root, [f for f in files if f.endswith(('.ts', '.vue'))],
                                               re.escape(os.path.basename(spec))))
                if c.verdict() != LIVE_V:
                    out_cands.append(c)


def audit_lvicons(root, files, out_cands):
    """LvIcon словарь (LV_ICONS в компоненте) в обе стороны + сверка с demo icons.js."""
    comp = None
    for f in files:
        if os.path.basename(f) == 'LvIcon.vue' and '/__tests__/' not in f:
            comp = f
    if not comp:
        return
    txt = read_text(comp)
    keys = set(re.findall(r"^\s*[\"']?([\w-]+)[\"']?\s*:", txt[txt.index('LV_ICONS'):txt.index('}', txt.index('LV_ICONS'))], re.M))
    vue = [f for f in files if f.endswith('.vue') and f != comp]
    used, dynamic = set(), []
    for f in vue:
        for m in re.finditer(r"<LvIcon[^>]*?(?:\bname\s*=\s*[\"']([\w-]+)[\"']|:name\s*=\s*[\"']([^\"']+)[\"'])", read_text(f), re.S):
            if m.group(1):
                used.add(m.group(1))
            elif m.group(2):
                dynamic.append(f"{os.path.relpath(f, root)}: {m.group(2)[:60]}")
    # S1: имя в LV_ICONS; S2: имя используется в шаблонах
    for n in sorted(used - keys):
        c = Candidate(cid=f"icon-undefined:{n}", repo='app', kind='icon-name-undefined',
                      path=n, why='имя передаётся в LvIcon, но отсутствует в словаре LV_ICONS (глиф не отрисуется)')
        c.add('S1_in_dict', [])
        c.add('S2_usage', [f"{n}: used in templates"])
        out_cands.append(c)
    for n in sorted(keys - used):
        c = Candidate(cid=f"icon-unused:{n}", repo='app', kind='icon-unused-entry',
                      path=n, why='ключ в словаре LV_ICONS: нет статических <LvIcon name=…> использований')
        c.add('S1_in_dict', [f"LV_ICONS key: {n}"])
        c.add('S2_usage', search(root, vue, rf"name\s*=\s*[\"']{re.escape(n)}[\"']"))
        if c.verdict() != LIVE_V and not dynamic:
            out_cands.append(c)
        elif c.verdict() != LIVE_V:
            c.priority = 'P3'
            c.why += f' (есть динамические :name — {len(dynamic)} мест, сверить вручную)'
            out_cands.append(c)


# ---------------- CORE extensions ----------------

def audit_classes_ddd(root, files, out_cands):
    all_php = files
    targets = [f for f in iter_files(os.path.join(root, 'app'), ('.php',))
               if '/Commands/' not in f.replace('\\', '/')]
    for t in sorted(targets):
        base = os.path.basename(t)[:-4]
        rel = os.path.relpath(t, root)
        c = Candidate(cid=f"core:class:{base}", repo='core', kind='php-class-ddd',
                      path=rel, why='PHP-класс: нет use-импортов и FQCN-упоминаний в кодовой базе')
        c.add('S1_import', search(root, all_php, rf"use\s+App\\[\w\\]*{re.escape(base)}\s*;", exclude_path=t))
        c.add('S2_fqcn', search(root, all_php, rf"App\\[\w\\]*{re.escape(base)}\b", exclude_path=t))
        if c.verdict() == LIVE_V:
            continue
        c.add('S3_shortname', search(root, all_php, rf"\b{re.escape(base)}\b", exclude_path=t))
        if c.verdict() != LIVE_V:
            out_cands.append(c)


def audit_enum_cases(root, files, out_cands):
    """enum-кейсы без статических ссылок -> всегда мягко (ловушка DB-value/from())."""
    enum_files = [f for f in files if '/Enums/' in f.replace('\\', '/')]
    for ef in enum_files:
        base = os.path.basename(ef)[:-4]
        txt = read_text(ef)
        for m in re.finditer(r"^\s*case\s+(\w+)\s*=", txt, re.M):
            case = m.group(1)
            refs = search(root, files, rf"\b{re.escape(base)}::{re.escape(case)}\b", exclude_path=ef)
            refs2 = search(root, files, rf"\b{re.escape(case)}\b", exclude_path=ef)
            if refs:
                continue
            c = Candidate(cid=f"core:enumcase:{base}::{case}", repo='core', kind='enum-case',
                          path=f"{os.path.relpath(ef, root)}::{case}",
                          why='enum-кейс без статических ссылок Base::CASE — ловушка: может жить в БД как value (from()/tryFrom)')
            c.add('S1_static_ref', refs)
            c.add('S2_case_word', refs2)
            c.priority = 'P3'  # никогда не кандидат на удаление без ручной сверки БД
            if c.verdict() != LIVE_V:
                out_cands.append(c)


def audit_blade(root, files, out_cands):
    """blade-партиалы без @include/view-name ссылок."""
    blades = [f for f in iter_files(os.path.join(root, 'resources', 'views'), ('.blade.php',))]
    all_php = files + blades
    for b in blades:
        base = os.path.basename(b)[:-10]  # strip .blade.php
        dotted = base.replace('/', '.')
        c = Candidate(cid=f"core:blade:{base}", repo='core', kind='blade-partial',
                      path=os.path.relpath(b, root),
                      why='blade: нет @include/@extends/@component по имени и нет view-name строки')
        c.add('S1_blade_ref', search(root, all_php, rf"@(?:include|extends|component)\(\s*['\"][^'\"]*{re.escape(base)}", exclude_path=b))
        c.add('S2_view_name', search(root, all_php, rf"['\"][\w\.\-]*{re.escape(dotted)}[\w\.\-]*['\"]", exclude_path=b))
        if c.verdict() != LIVE_V:
            out_cands.append(c)


# ---------------- FILAMENT extension ----------------

def audit_shield(root, files, out_cands, repo_name):
    """Shield-политики без соответствующей модели."""
    policies = [f for f in files if '/Policies/' in f.replace('\\', '/') and f.endswith('Policy.php')]
    models = {os.path.basename(m)[:-4] for m in iter_files(root, ('.php',))
              if '/Models/' in m.replace('\\', '/')}
    for p in policies:
        base = os.path.basename(p)[:-10]  # strip Policy.php
        c = Candidate(cid=f"{repo_name}:policy:{base}Policy", repo=repo_name, kind='shield-policy-stale',
                      path=os.path.relpath(p, root),
                      why='Shield-политика без модели-владельца (модель отсутствует в app/Models)')
        c.add('S1_model_exists', [f"model exists: {base}"] if base in models else [])
        c.add('S2_policy_ref', search(root, files, rf"\b{re.escape(base)}Policy\b", exclude_path=p))
        if c.verdict() != LIVE_V:
            out_cands.append(c)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root'); ap.add_argument('out_dir')
    ap.add_argument('--repo', required=True)
    ap.add_argument('--icons-demo', default='')
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    files = all_src_files(root, ('.php', '.blade.php'))
    cands = []
    if args.repo == 'app':
        audit_helpers(root, files, cands)
        audit_routes_broken(root, files, cands)
        audit_tests(root, files, cands)
        audit_lvicons(root, files, cands)
    elif args.repo == 'core':
        audit_classes_ddd(root, files, cands)
        audit_enum_cases(root, files, cands)
        audit_blade(root, files, cands)
    elif args.repo in ('b2b', 'admin'):
        audit_shield(root, files, cands, args.repo)
    meta = {'head': git_head(root), 'pass': 'audit_ext (расширенные проверки карточки SZ-082)'}
    jp, mp = write_report(args.out_dir, f"{args.repo}-ext", cands, meta)
    print(f"[{args.repo}-ext] candidates={len(cands)} -> {mp}")


if __name__ == '__main__':
    main()
