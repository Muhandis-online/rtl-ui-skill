#!/usr/bin/env bash
# Grade agent runs: build each run's project, serve it, run the probes and save the measurements.
#
#   RUNS=/path/to/agent/runs bash scripts/grade_runs.sh t4-haiku-v5a t7-sonnet-b1 ...
#
# RUNS   folder holding one project folder per run (required)
# OUT    where the measurements go (default: ./graded)
# PORT   first local port to use (default: 5000); runs are graded one after another
# FORCE  set to 1 to regrade runs that already have results
#
# Run one batch at a time: two batches in parallel can collide on ports, and a page that fails to load in the
# grader is not a result (scripts/summarize.py refuses such runs).
# t6-* runs (bilingual task) also get the language-switch probe.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNS="${RUNS:?set RUNS to the folder that holds the agent run folders}"
OUT="${OUT:-$ROOT/graded}"
port=${PORT:-5000}
for run in "$@"; do
  out="$OUT/$run"
  if [ -f "$out/typed.json" ] && [ -z "${FORCE:-}" ]; then echo "skip $run"; continue; fi
  port=$((port + 1))
  rm -rf "$out"
  case $run in t6-*) export LANGSWITCH=1 ;; *) unset LANGSWITCH ;; esac
  node "$ROOT/harness/grade.mjs" "$RUNS/$run" "$out" "$port" > /dev/null 2>&1 && echo "graded $run" || echo "FAILED $run"
done
