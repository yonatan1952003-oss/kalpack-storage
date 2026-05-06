#!/usr/bin/env bash
# Block on TypeScript errors after edits to .ts/.tsx files.
# Runs as asyncRewake in settings.json — fires after the model "finishes"
# and re-pings it with errors if any.
set -uo pipefail

input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
[[ -z "$file" ]] && exit 0
[[ "$file" =~ \.(ts|tsx)$ ]] || exit 0

# Resolve project root (this script lives at <root>/.claude/hooks/)
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root" || exit 0
[[ -f tsconfig.json ]] || exit 0

if ! out=$(npx --no-install tsc --noEmit 2>&1); then
  {
    echo "❌ TypeScript check נכשל אחרי השינוי ל-${file}"
    echo ""
    echo "$out" | head -60
    echo ""
    echo "תקן את שגיאות הטיפוסים. אל תכריז שסיימת עד שה-tsc עובר ירוק."
  } >&2
  exit 2
fi
exit 0
