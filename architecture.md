# Kalpack Storage — מפת ארכיטקטורה

מסמך אוריינטציה לסשן חדש עם Claude / מפתח חדש. המטרה: להבין תוך דקה איזה קובץ אחראי על מה, איך זורם המידע, ומהן ההחלטות שכבר נקבעו.

> **חשוב:** כל מסך משתמש הוא בעברית RTL. כל הטקסט במחרוזות בקוד הוא בעברית. אל תתרגם אותו.

---

## 1. סטאק טכנולוגי

| שכבה | בחירה | למה |
|---|---|---|
| Build | **Vite 8** + TypeScript ~5.9 | Build מהיר, HMR, dev server על :5173 |
| UI | **React 19** | Concurrent features, `lazy` per-tab |
| עיצוב | **Tailwind v4** (`@tailwindcss/vite`) + CSS variables | פלטה דרך `THEMES` ב-`App.tsx`, לא דרך `tailwind.config` |
| אנימציה | framer-motion | מעברי טאבים, מודאלים |
| גרפים | recharts | טאבי Analytics/Graphs/Dashboard |
| אייקונים | lucide-react | |
| גיליונות | xlsx | ייבוא/יצוא ב-DataTab + utils/excelExport |
| Backend | **Supabase** (`@supabase/supabase-js`) | טבלת `public.inventory` בלבד כרגע |
| התמדה מקומית | **localStorage** | כל ה-state נשמר תחת מפתחות `kalpack-*` |
| אימות | `AuthGate` עוטף את `<App/>` ב-`main.tsx` | Supabase Auth |
| מזהים | `uuid` v4 | למסמכי PO, items, audit |

הפרויקט הוא SPA טהור — אין router. ניווט בין טאבים דרך `?tab=` ב-URL + `pushState`/`popstate` ב-`App.tsx`.

---

## 2. מבנה תיקיות

```
new project/
├── public/                 # נכסי סטטיים
├── src/
│   ├── main.tsx            # נקודת כניסה — עוטף את App ב-AuthGate
│   ├── App.tsx             # ⭐ מצב גלובלי, ניתוב טאבים, theme, גיבוי/שחזור
│   ├── store.ts            # MOCK_POS / MOCK_CONTAINERS / MOCK_CATALOG / MOCK_SALES + generateAlerts()
│   ├── types.ts            # ⭐ כל ה-domain types — קרא כאן קודם
│   ├── index.css           # Tailwind + מחלקות גלובליות
│   │
│   ├── lib/
│   │   ├── supabase.ts     # createClient יחיד — env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
│   │   └── db.ts           # InventoryRow ↔ CatalogProduct/SalesRow + CRUD על public.inventory
│   │
│   ├── components/         # רכיבים משותפים (לא tab-specific)
│   │   ├── AuthGate.tsx        # שער כניסה Supabase
│   │   ├── Sidebar.tsx         # ניווט
│   │   ├── TopBar.tsx          # כותרת לפי TAB_META
│   │   ├── GlobalSearch.tsx    # ⌘K / Ctrl+K
│   │   ├── Card.tsx            # מעטפת כרטיס סטנדרטית
│   │   ├── RightPanel.tsx      # הוסר מה-UI אבל הקובץ נותר
│   │   └── InventoryAnalyticsDashboard.tsx
│   │
│   ├── tabs/               # טאב אחד = קובץ אחד, lazy-loaded ב-App.tsx
│   │   ├── DashboardTab.tsx
│   │   ├── POTab.tsx           # הגדול ביותר (~83KB) — ניהול הזמנות רכש
│   │   ├── ContainersTab.tsx
│   │   ├── ArrivedContainersTab.tsx
│   │   ├── LeadTimesTab.tsx
│   │   ├── AITab.tsx
│   │   ├── DataTab.tsx         # קטלוג + ייבוא Excel
│   │   ├── SuppliersTab.tsx
│   │   ├── AnalyticsTab.tsx
│   │   ├── GraphsTab.tsx
│   │   └── SettingsTab.tsx
│   │
│   └── utils/
│       ├── persistence.ts  # loadState/saveState — wrapper על localStorage
│       ├── excelExport.ts
│       └── printReport.ts
└── package.json
```

⭐ = "אם קראת רק שלושה קבצים, שיהיו אלה."

---

## 3. מודל הנתונים — מהי ישות ולמה

ההיררכיה (מ-`types.ts`):

```
Supplier  ──┐
            ▼
PurchaseOrder ─── items: POLineItem[] ─── statusBreakdown: { production, ready, transit, received }
                                          │
                                          ▼
                               Container ─── items: ContainerItem[]  (poId + lineItemId + qty + snapshot)
                                          │
                                          ▼  (כשמגיע)
                               arrivedContainers (אותו טיפוס Container, ארכיון)

CatalogProduct  ←  ↔ Supabase public.inventory  ↔  →  SalesRow (מסונכרן ב-realtime)
                       (lib/db.ts: rowToCatalog / rowToSales / fetch / insert / update / delete)

AIAlert  ← נגזר מ-(salesData, pos, reorderDays) דרך store.generateAlerts()

AuditEntry  → לוג של פעולות, נשמר ב-localStorage עד 200 הרשומות האחרונות
```

**נקודות עדינות:**
- `POLineItem.statusBreakdown` הוא קיבולת — סה"כ הכמות מתחלקת בין ארבעה סטטוסים. סה"כ הסכום = `quantity`.
- `ContainerItem.snapshot` נשמר כשהמכולה מגיעה כי שורות PO עלולות להימחק לאחר מכן.
- `SalesRow.currentStock` תמיד מוחלף מ-Supabase; `salesAmount`/`salesPeriod` נשמרים ידנית מהמשתמש (ראה לוגיקת merge ב-`App.tsx` סביב שורה 210).

---

## 4. זרימת מידע

### טעינת אפליקציה
```
main.tsx
  └─ <AuthGate> (Supabase Auth)
       └─ <App>
            ├─ useState ← loadState('kalpack-*', mock) מ-localStorage
            ├─ useEffect → fetchInventory() מ-Supabase → דורס catalog + ממזג ל-salesData
            ├─ useEffect → supabase.channel('inventory-changes') → realtime INSERT/UPDATE/DELETE
            └─ THEMES[theme] מוחל כ-CSS vars על document.documentElement
```

### כתיבה (User Action → State → Persistence)
```
Tab component
  └─ קורא לסטר/handler מ-App.tsx (למשל setPos, handleReceive, handleCreatePOFromAlert)
       ├─ useState עדכון
       ├─ useEffect → saveState('kalpack-*', value) — שומר ל-localStorage על כל שינוי
       └─ addAudit(...) — מוסיף ל-auditLog (200 אחרונים)
```

### ניווט
```
Sidebar / קישור פנימי
  └─ handleNavigate(tabId)
       ├─ history.pushState עם ?tab=
       ├─ setActiveTab(tabId) → renderTab() מחזיר את <Suspense>(<TabComponent>)
       └─ במובייל: מקפל את הסיידבר
popstate (כפתור אחורה) → קורא tab מה-URL ומסנכרן state
```

### Supabase ↔ App
- מקור אמת ל-מלאי: טבלת `public.inventory` (ראה `lib/db.ts:5` ל-schema).
- שאר הנתונים (POs, Containers, Suppliers, Audit) — **localStorage בלבד**, לא ב-Supabase. החלטה מודעת נכון לעכשיו.
- `lastSynced` נשמר אחרי `fetchInventory` ראשון ומוצג ב-Settings.

---

## 5. ערכת Theme

- **לא קיים `tailwind.config`** עם פלטה. הצבעים מוגדרים כ-CSS vars במשתנה `THEMES` ב-`App.tsx:76`.
- שני מצבים: `'dark'` (slate-950 + indigo-400) ו-`'light'` (slate-50 + indigo-500).
- שינוי theme = החלפת ערכי המשתנים על `document.documentElement`. רכיבים משתמשים ב-`var(--bg-primary)` וכו', לא במחלקות Tailwind.
- פונט: **Heebo** לעברית+לטיני, **JetBrains Mono** לטקסט מספרי.

---

## 6. החלטות חשובות (תיעוד "למה")

| החלטה | רציונל |
|---|---|
| `localStorage` לכל המודלים מלבד inventory | מהירות פיתוח; בעלים יחיד; מעבר ל-Supabase מתוכנן בעתיד |
| Lazy-load של כל טאב | POTab לבד הוא 83KB; חוסך ~300KB ב-initial bundle |
| `THEMES` כ-CSS vars ולא Tailwind plugin | החלפה דינמית בלי rebuild; vars נצרכים ישירות גם ב-`recharts` |
| Snapshot ב-`ContainerItem` | שורות PO ניתנות למחיקה אחרי הגעה; הארכיון חייב לעמוד בפני עצמו |
| `?tab=` ב-URL במקום router | האפליקציה היא single-page עם לא-נתיבים; חסכון ב-deps |
| `RightPanel.tsx` נשאר בקוד אך לא משוחרר | הוסר מה-UI לבקשת המשתמש; שמור למקרה שיוחזר |
| Auth דרך עטיפה ולא Provider | `AuthGate` ב-`main.tsx` חוסם את כל העץ עד התחברות — פשוט יותר |

---

## 7. הרצה

```bash
cd "/Users/yonatanmishan/Desktop/claude/kalpack storage/kalpack/new project"
npm run dev      # http://localhost:5173/
npm run build    # tsc -b && vite build
npm run lint
```

משתני סביבה נדרשים (`.env.local`):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## 8. הנחיות לסשן חדש עם Claude

כשפותחים סשן חדש, הצמד את הקובץ הזה ואת `src/types.ts`. אלה נותנים את 80% מהקונטקסט.

לפני עריכה של טאב, קרא גם את הסעיף הרלוונטי ב-`App.tsx` (renderTab, השדות שמועברים ב-props) — כך תדע אילו setters זמינים ומה ה-shape של הנתונים שמגיעים.

לפני שינוי theme/צבע — ערוך את `THEMES` ב-`App.tsx`, לא קבצי CSS.

לפני שינוי מבנה PO/Container — בדוק את `ContainerItem.snapshot`; שינוי schema עלול לשבור מכולות שכבר הגיעו.
