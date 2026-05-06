# Kalpack Storage — Roadmap לסשן

> קובץ זה נטען אוטומטית בכל סשן. קצר בכוונה. ל**איך** המערכת בנויה — קרא את `architecture.md`.

## שפה ו-RTL
- כל ה-UI בעברית RTL. **אל תתרגם** טקסטים בקוד. כשמוסיפים מחרוזת חדשה למשתמש — בעברית.
- תגובות ב-chat: עברית.

## איפה דברים יושבים — Cheat Sheet

| משימה | קובץ ראשון להסתכל בו |
|---|---|
| הוספת/שינוי טאב | `src/App.tsx` (renderTab + lazy import) |
| Domain types / shape של PO/Container/Catalog | `src/types.ts` ⭐ |
| State גלובלי, theme, גיבוי, ניווט URL | `src/App.tsx` |
| Supabase / `public.inventory` | `src/lib/db.ts` + `src/lib/supabase.ts` |
| לוגיקת התראות AI | `src/store.ts` → `generateAlerts()` |
| צבעים / ערכת נושא | `THEMES` ב-`src/App.tsx:76` (לא tailwind.config) |
| ייבוא Excel | `src/tabs/DataTab.tsx` + `src/utils/excelExport.ts` |
| חיפוש גלובלי ⌘K | `src/components/GlobalSearch.tsx` |
| Auth | `src/components/AuthGate.tsx` (עוטף ב-`main.tsx`) |
| התמדה מקומית | `src/utils/persistence.ts` (כל המפתחות `kalpack-*`) |

## נוהג עבודה יעיל

1. **לפני קוד — אוריינטציה:** קרא את `architecture.md` (סעיף רלוונטי) + את ה-types הקשורים. אל תקפוץ ישר ל-grep.
2. **שינוי schema של PO/Container** = סיכון גבוה: יש `ContainerItem.snapshot` ו-localStorage שכבר מאוכלס אצל המשתמש. ספק migration או הסבר breaking change לפני שמשנים.
3. **localStorage = מקור אמת** לכל מלבד `inventory`. אל תניח שיש backend ל-POs/Containers/Suppliers/Audit.
4. **Realtime Supabase פעיל** על `inventory` (ראה `App.tsx` סביב שורה 227). שינויים ל-catalog דרך `lib/db.ts`, לא ישירות ב-state — אחרת סנכרון ישבור.
5. **Lazy tabs:** טאב חדש = `lazy(() => import(...))` ב-`App.tsx` + ערך ב-`VALID_TABS` + רשומה ב-`TAB_META` + case ב-`renderTab`. ארבעה מקומות, לא לשכוח.
6. **צבעים:** רק דרך `var(--bg-primary)` וכו'. אל תכניס hex ישיר ל-JSX.

## הרצה
```bash
npm run dev      # :5173
npm run build    # tsc -b && vite build
npm run lint
```

צריך `.env.local` עם `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY`.

## דגשים סביבה
- הנתיב מכיל רווחים — תמיד עטוף במרכאות בפקודות shell.
- preview MCP על ה-Mac הזה לא עובד (App Translocation). הרץ dev server ב-Bash עם `run_in_background` ובדוק עם `curl`.

## כשמשהו לא ברור
שאל לפני שמנחשים. הפרויקט בייצור אצל הבעלים — אל תרענן/תאפס נתונים מקומיים בלי אישור.
