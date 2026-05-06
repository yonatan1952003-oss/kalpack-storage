#!/usr/bin/env bash
# Block destructive bash commands that need explicit user authorization.
set -uo pipefail

input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')
[[ -z "$cmd" ]] && exit 0

# Patterns that should never run without explicit user approval
patterns='(rm -rf |git reset --hard|git push --force|git push -f($| )|git push.* -f($| )|git checkout -- |git clean -fd?|git branch -D |npm uninstall)'

if echo "$cmd" | grep -qE "$patterns"; then
  matched=$(echo "$cmd" | grep -oE "$patterns" | head -1)
  {
    echo "🛑 פעולה הרסנית נחסמה: \"$matched\""
    echo "פקודה מלאה: $cmd"
    echo ""
    echo "פעולה זו עלולה לאבד עבודה (rm -rf / reset --hard / push --force / clean -f / וכו')."
    echo "אל תרוץ אותה. במקום זאת:"
    echo "  1. הסבר למשתמש מה אתה רוצה למחוק/לדרוס ולמה."
    echo "  2. בקש אישור מפורש בצ'אט."
    echo "  3. רק אחרי 'כן' מהמשתמש — הרץ שוב."
    echo ""
    echo "אם נתקלת בשגיאה והפיתוי הוא 'בוא נמחק ונתחיל מחדש' — עצור. חקור שורש קודם."
  } >&2
  exit 2
fi
exit 0
