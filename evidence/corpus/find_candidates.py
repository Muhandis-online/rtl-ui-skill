"""List GitHub repos made by AI app builders whose UI is Arabic.

    python evidence/corpus/find_candidates.py > evidence/corpus/candidates.json

Uses the GitHub code search API through `gh`. Code search allows 10 requests a minute, so the script waits out
the limit instead of failing.
"""
import json
import subprocess
import sys
import time

QUERIES = {
    "lovable": 'lovable.dev lang="ar" filename:index.html',
    "v0": "generator: 'v0.app' lang=\"ar\" filename:layout.tsx",
    "v0-dev": "generator: 'v0.dev' lang=\"ar\" filename:layout.tsx",
    "bolt": 'lang="ar" path:.bolt',
}
PER_PAGE = 100
MAX_PAGES = 3  # the search API stops at 1,000 results; 300 per builder is plenty to sample from


def search(q, page):
    while True:
        r = subprocess.run(["gh", "api", "-X", "GET", "search/code", "-f", f"q={q}", "-f", f"per_page={PER_PAGE}",
                            "-f", f"page={page}"], capture_output=True, text=True, encoding="utf-8")
        if r.returncode == 0:
            return json.loads(r.stdout)
        if "rate limit" in (r.stdout + r.stderr).lower():
            print(f"rate limited on {q!r} page {page}, waiting 65s", file=sys.stderr)
            time.sleep(65)
            continue
        print(r.stdout + r.stderr, file=sys.stderr)
        return {"items": [], "total_count": 0}


def main():
    out = {}
    for builder, q in QUERIES.items():
        repos = {}
        total = 0
        for page in range(1, MAX_PAGES + 1):
            data = search(q, page)
            total = data.get("total_count", 0)
            for item in data.get("items", []):
                repo = item["repository"]
                repos.setdefault(repo["full_name"], {"repo": repo["full_name"], "file": item["path"],
                                                     "fork": repo.get("fork", False)})
            if page * PER_PAGE >= total:
                break
        out[builder] = {"query": q, "total_count": total, "repos": sorted(repos.values(), key=lambda r: r["repo"])}
        print(f"{builder}: {len(repos)} repos (total_count {total})", file=sys.stderr)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
