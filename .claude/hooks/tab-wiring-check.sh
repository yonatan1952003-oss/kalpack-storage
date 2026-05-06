#!/usr/bin/env bash
# After editing src/tabs/*Tab.tsx, verify wiring in App.tsx.
# Required: lazy import + VALID_TABS entry + TAB_META entry + renderTab case.
set -uo pipefail

input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Match e.g. .../src/tabs/DashboardTab.tsx → tab_name=Dashboard
if [[ ! "$file" =~ /src/tabs/([A-Z][A-Za-z0-9]+)Tab\.tsx$ ]]; then
  exit 0
fi
tab_name="${BASH_REMATCH[1]}"

# Camel-case the first letter to lower for the TabId
first=$(printf '%s' "${tab_name:0:1}" | tr '[:upper:]' '[:lower:]')
tab_id="${first}${tab_name:1}"

root="$(cd "$(dirname "$0")/../.." && pwd)"
app="$root/src/App.tsx"
[[ -f "$app" ]] || exit 0

missing=()
grep -qE "lazy\(.*['\"]\\./tabs/${tab_name}Tab" "$app" \
  || missing+=("lazy import של ${tab_name}Tab")
grep -qE "VALID_TABS[^=]*=[^]]*['\"]${tab_id}['\"]" "$app" \
  || missing+=("רשומה ב-VALID_TABS עם '${tab_id}'")
grep -qE "${tab_id}: *\\{ *title:" "$app" \
  || missing+=("רשומה ב-TAB_META עבור '${tab_id}'")
grep -qE "case '${tab_id}':" "$app" \
  || missing+=("case '${tab_id}' ב-renderTab")

if [[ ${#missing[@]} -eq 0 ]]; then
  exit 0
fi

# Build the bullet list
list=""
for m in "${missing[@]}"; do
  list+="  - ${m}"$'\n'
done

msg="📋 בדיקת חיווט טאב: ${tab_name}Tab — חסרים החיבורים הבאים ב-src/App.tsx:

${list}
ראה CLAUDE.md סעיף 'Lazy tabs' (4 מקומות נדרשים). השלם את החסרים לפני שתסיים, אחרת הטאב לא יעבוד."

jq -n --arg ctx "$msg" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
exit 0
