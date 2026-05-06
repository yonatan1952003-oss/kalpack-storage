#!/usr/bin/env bash
# When user asks about theme/colors, inject a reminder about THEMES location.
set -uo pipefail

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt // empty')
[[ -z "$prompt" ]] && exit 0

# Hebrew + English keywords. Case-insensitive for English.
if echo "$prompt" | grep -qiE 'theme|color|palette|tailwind\.config' \
   || echo "$prompt" | grep -qE 'צבע|ערכת נושא|פלטה|ערכת צבעים|רקע|רקעים'; then
  msg="💡 תזכורת אוטומטית (זוהתה התייחסות ל-theme/צבעים):

ערכות נושא בפרויקט הזה מוגדרות ב-\`THEMES\` בתוך \`src/App.tsx:76\` (אובייקט עם dark/light), **לא** ב-tailwind.config (אין כזה בכלל). הצבעים נחשפים כ-CSS variables על document.documentElement.

לכן:
- שינוי צבע = ערוך את \`THEMES\` ב-App.tsx, לא קובץ tailwind/css.
- צריכת צבע ברכיב = \`var(--bg-primary)\`, \`var(--text-primary)\`, \`var(--accent)\` וכו' — לא hex ישיר ב-JSX.
- recharts צורכת את אותם vars ישירות, אז צריך להעביר אותם דרך \`getComputedStyle(document.documentElement).getPropertyValue('--accent')\` ב-runtime."

  jq -n --arg ctx "$msg" '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}'
fi
exit 0
