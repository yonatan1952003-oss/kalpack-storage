#!/usr/bin/env bash
# Reminder when src/types.ts is edited — schema changes are high risk.
set -uo pipefail

input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
[[ "$file" == */src/types.ts ]] || exit 0

msg="⚠️ שינית את src/types.ts (schema של domain types).

בדוק לפני סיום:
1. ContainerItem.snapshot — אם שינית את ה-shape, מכולות שכבר הגיעו (kalpack-arrived-containers ב-localStorage) עלולות לקרוס בטעינה.
2. localStorage migration — לקוחות קיימים יטענו state ישן עם מפתחות kalpack-*. ספק נתיב migration ב-utils/persistence.ts או הסבר breaking change למשתמש.
3. שדה אופציונלי → חובה — ישבור נתונים קיימים שלא כוללים אותו.
4. שינוי שם שדה — חפש שימושים בכל src/tabs/ ו-src/lib/db.ts לפני."

jq -n --arg ctx "$msg" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
exit 0
