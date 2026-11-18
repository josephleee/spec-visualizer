#!/usr/bin/env bash
# Prints the CHANGELOG.md section of one version (without its heading). Fails when there is none.
# Usage: scripts/release-notes.sh 0.1.0 [CHANGELOG.md]
set -euo pipefail
version="$1"
notes="$(awk -v v="$version" '
  /^## /            { h = $2; gsub(/[\[\]]/, "", h); sub(/^v/, "", h); on = (h == v); next }
  /^\[[^]]*\]: /    { on = 0 }   # link definitions at the end of the file
  on' "${2:-CHANGELOG.md}")"
# Trim blank lines at both ends.
notes="$(printf '%s\n' "$notes" | sed -e '/./,$!d' | awk '{ l[NR] = $0 } /./ { last = NR } END { for (i = 1; i <= last; i++) print l[i] }')"
if [ -z "$notes" ]; then
  echo "CHANGELOG.md has no section \"## [$version]\" with text in it" >&2
  exit 1
fi
printf '%s\n' "$notes"
