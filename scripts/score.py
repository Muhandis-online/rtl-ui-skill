"""Score the full comparison: every run of every task, grouped by task, model and condition.

    GRADED=./graded python scripts/score.py > evidence/results/scores.json

Baseline runs: no suffix, -b1, -b2. Skill v0.5 runs: -v5a, -v5b. Older skill runs (-s1, -s2: v0.1/v0.3) are not
part of this comparison. A check counts for a run only where it applied ("-" cells are left out).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# graded run folders, as written by scripts/grade_runs.sh
PHASEB = os.environ.get("GRADED", os.path.join(HERE, "..", "graded"))
sys.path.insert(0, HERE)
import summarize  # noqa: E402

TASKS = ["t4", "t5", "t7", "t1", "t3", "t6"]
MODELS = ["haiku", "sonnet"]


def condition(run):
    if re.search(r"-v5[ab]$", run):
        return "skill"
    if re.search(r"-s\d$", run):
        return None  # older skill versions
    return "baseline"


def langswitch(run_dir):
    p = os.path.join(run_dir, "lang", "langswitch.json")
    if not os.path.isfile(p):
        return "-"
    d = json.load(open(p, encoding="utf-8"))["desktop"]
    ok = d.get("afterEnglish", {}).get("dir") == "ltr" and d.get("afterArabic", {}).get("dir") == "rtl"
    return "." if ok else "x"


def main():
    runs = {}
    for name in sorted(os.listdir(PHASEB)):
        m = re.match(r"(t\d)-(haiku|sonnet)(?:-.+)?$", name)
        if not m or m.group(1) not in TASKS or not os.path.isfile(os.path.join(PHASEB, name, "typed.json")):
            continue
        cond = condition(name)
        if not cond:
            continue
        cells = summarize.row(os.path.join(PHASEB, name))
        cells["language switch works"] = langswitch(os.path.join(PHASEB, name))
        runs[name] = {"task": m.group(1), "model": m.group(2), "condition": cond, "cells": cells}

    checks = list(next(iter(runs.values()))["cells"].keys())

    def agg(filter_):
        out = {}
        for c in checks:
            applied = [r for r in runs.values() if filter_(r) and r["cells"][c] != "-"]
            out[c] = {"failed": sum(r["cells"][c].startswith("x") for r in applied), "applied": len(applied)}
        return out

    result = {
        "runs": runs,
        "checks": checks,
        "by_condition": {c: agg(lambda r, c=c: r["condition"] == c) for c in ("baseline", "skill")},
        "by_model": {f"{m}/{c}": agg(lambda r, m=m, c=c: r["model"] == m and r["condition"] == c)
                     for m in MODELS for c in ("baseline", "skill")},
        "by_task": {f"{t}/{c}": agg(lambda r, t=t, c=c: r["task"] == t and r["condition"] == c)
                    for t in TASKS for c in ("baseline", "skill")},
        # defects per run: how many applicable checks failed
        "defects_per_run": {n: sum(v.startswith("x") for v in r["cells"].values()) for n, r in runs.items()},
    }
    json.dump(result, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
