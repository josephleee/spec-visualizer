#!/usr/bin/env bash
# Installs a packed tarball into an empty folder and checks that the installed command runs.
# Usage: scripts/smoke.sh <tarball> <expected version> [port]
set -euo pipefail
tarball="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
expected="$2"
port="${3:-4455}"
dir="$(mktemp -d)"
cd "$dir"
npm init --yes > /dev/null
npm install --no-audit --no-fund "$tarball"
bin="$dir/node_modules/.bin/spec-visualizer"

got="$("$bin" --version)"
[ "$got" = "$expected" ] || { echo "--version printed \"$got\", expected \"$expected\"" >&2; exit 1; }

"$bin" --demo --no-open --port "$port" &
pid=$!
trap 'kill "$pid" 2> /dev/null || true' EXIT
for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS "http://127.0.0.1:$port/" > /dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:$port/" | grep -qi '<!doctype html'
curl -fsS "http://127.0.0.1:$port/api/project" | grep -q '"001-member-signup"'
kill "$pid" 2> /dev/null || true

# The OpenSpec and Kiro examples, on the next ports.
first="$port"
for pair in "openspec:add-due-reminders" "kiro:tool-search"; do
  format="${pair%%:*}" unit="${pair#*:}" port=$((port + 1))
  "$bin" --demo --format "$format" --no-open --port "$port" &
  pid=$!
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -fsS "http://127.0.0.1:$port/" > /dev/null 2>&1 && break
    sleep 1
  done
  curl -fsS "http://127.0.0.1:$port/api/project" | grep -q "\"$unit\""
  kill "$pid" 2> /dev/null || true
done
echo "smoke ok: spec-visualizer $got served the three demos on ports $first to $port"
