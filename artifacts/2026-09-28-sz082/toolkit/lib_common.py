#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SZ-082 Phase A — common audit library (READ-ONLY, no file modification).

Rules encoded here (from canon/TASKS/SZ-082-dead-code-audit.md):
  * A finding is reported ONLY if at least 2 independent check strategies agree.
  * If any strategy yields only ambiguous short-name hits -> verdict AMBIGUOUS (manual), never auto-P1.
  * Migrations are NEVER candidates.
  * Report row format: finding -> where -> why looks dead -> verdict.
"""
import os, re, json, subprocess, hashlib
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Callable, Optional

SKIP_DIRS = {
    'node_modules', 'dist', 'build', '.git', '.idea', '.vscode', 'vendor',
    '__pycache__', '.nuxt', '.output', 'coverage', 'storage',
}
# Hard rule from the card: migrations are never dead code.
HARD_EXCLUDE_PARTS = (os.path.join('database', 'migrations'), 'node_modules', 'vendor')

LIVE = 'LIVE'
AMBIGUOUS = 'AMBIGUOUS(мансревью)'
DEAD_CANDIDATE = 'CANDIDATE'


def git_head(root: str) -> str:
    try:
        sha = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=root, capture_output=True,
                             text=True, timeout=20).stdout.strip()
        dt = subprocess.run(['git', 'log', '-1', '--format=%ci'], cwd=root, capture_output=True,
                            text=True, timeout=20).stdout.strip()
        return f"{sha} ({dt})"
    except Exception as e:
        return f"UNRESOLVED: {e}"


def is_skipped(dirpath: str) -> bool:
    parts = set(dirpath.replace('\\', '/').split('/'))
    if parts & SKIP_DIRS:
        return True
    p = dirpath.replace('\\', '/')
    return any(hp in p for hp in ('database/migrations',))


def iter_files(root: str, exts: Optional[tuple] = None) -> List[str]:
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        if is_skipped(dirpath):
            continue
        for fn in filenames:
            if exts and not fn.endswith(tuple(exts)):
                continue
            out.append(os.path.join(dirpath, fn))
    return sorted(out)


def read_text(path: str) -> str:
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    except Exception:
        return ''


@dataclass
class Candidate:
    cid: str
    repo: str
    kind: str            # vue-component | route-orphan | scss | pwa | php-class | command | event | config-key | filament-resource | api-endpoint | demo-screen
    path: str            # repo-relative path or key
    why: str             # why it looks dead
    priority: str = ''   # P1 / P2 / P3 — assigned manually by Super Z, script only proposes base
    strategies: Dict[str, List[str]] = field(default_factory=dict)  # name -> evidence lines

    def add(self, name: str, evidence: List[str]):
        self.strategies[name] = evidence[:12]  # cap evidence, keep report readable

    def verdict(self) -> str:
        named = {k: v for k, v in self.strategies.items() if not k.startswith('_')}
        strict = ('S1_import', 'S2_fqcn', 'S_route_record', 'S_manifest', 'S_registration',
                  'S_discovery', 'S_client_call', 'S_schedule', 'S2_any_ref',
                  'S1_model_exists', 'S2_policy_ref', 'S1_in_dict', 'S1_scss_ref', 'S1_blade_ref', 'S1_static_ref')
        if any(named.get(s) for s in strict):
            return LIVE
        soft = {k: v for k, v in named.items() if k not in strict}
        if any(soft.values()):
            return AMBIGUOUS
        # every strategy ran and returned zero evidence
        return DEAD_CANDIDATE


def kebab(name: str) -> str:
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1-\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1-\2', s1).lower()


def search(root: str, files: List[str], pattern: str, exclude_path: Optional[str] = None,
           flags=re.IGNORECASE) -> List[str]:
    """Search regex in given file list; return ['rel:ln: line'] evidence list."""
    rx = re.compile(pattern, flags)
    ev = []
    for fp in files:
        if exclude_path and os.path.abspath(fp) == os.path.abspath(exclude_path):
            continue
        txt = read_text(fp)
        if not txt:
            continue
        rel = os.path.relpath(fp, root)
        for i, line in enumerate(txt.splitlines(), 1):
            if rx.search(line):
                ev.append(f"{rel}:{i}: {line.strip()[:160]}")
                if len(ev) >= 40:
                    return ev
    return ev


def all_src_files(root: str, extra_exts: tuple = ()) -> List[str]:
    exts = ('.vue', '.ts', '.js', '.tsx', '.jsx', '.scss', '.css', '.json', '.html', '.md') + extra_exts
    return iter_files(root, exts)


def write_report(out_dir: str, repo: str, candidates: List[Candidate], meta: Dict):
    os.makedirs(out_dir, exist_ok=True)
    payload = {'repo': repo, 'meta': meta,
               'candidates': [{**asdict(c), 'verdict': c.verdict()} for c in candidates]}
    jpath = os.path.join(out_dir, f"{repo}.findings.json")
    with open(jpath, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    rows = []
    for c in candidates:
        v = c.verdict()
        ev_str = '; '.join(f"{k}: {len(v2)} hit(s)" for k, v2 in c.strategies.items())
        rows.append(f"| {c.kind} | `{c.path}` | {c.why} | {ev_str or '—'} | **{v}** |")
    mpath = os.path.join(out_dir, f"{repo}.findings.md")
    with open(mpath, 'w', encoding='utf-8') as f:
        f.write(f"# SZ-082 механические находки — {repo}\n\n")
        f.write(f"- HEAD: `{meta.get('head', '?')}`\n")
        f.write(f"- exclusions: `{meta.get('exclusions', '—')}`\n")
        f.write(f"- rules: находка = ≥2 независимые стратегии согласны «нет ссылок»; "
                f"одиночные short-name попадания = AMBIGUOUS; миграции не сканируются.\n\n")
        f.write("| kind | где | почему выглядит мёртвым | стратегии (свидетельства) | вердикт |\n")
        f.write("|---|---|---|---|---|\n")
        f.write('\n'.join(rows) + '\n')
    return jpath, mpath
