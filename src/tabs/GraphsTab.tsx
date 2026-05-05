import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardHeader, StatCard } from '../components/Card';
import type { CatalogProduct, SalesRow } from '../types';

interface GraphsTabProps {
  catalog: CatalogProduct[];
  salesData: SalesRow[];
}

interface Row {
  sku: string;
  name: string;
  category: string;
  initialStock: number;
  unitsSold: number;
  unitPrice: number;
  currency: string;
  revenue: number;
  currentStock: number;
  sellThrough: number;
}

const fmtMoney = (n: number, currency = 'USD') =>
  n.toLocaleString('he-IL', { style: 'currency', currency, maximumFractionDigits: 0 });
const fmtNum = (n: number) => n.toLocaleString('he-IL');

export function GraphsTab({ catalog, salesData }: GraphsTabProps) {
  // Join sales rows with catalog to derive everything needed
  const rows = useMemo<Row[]>(() => {
    return salesData.map((s) => {
      const cat = catalog.find((c) => c.sku === s.sku);
      const unitPrice = cat?.unitPrice ?? 0;
      const initialStock = s.currentStock + s.salesAmount;
      return {
        sku: s.sku,
        name: s.name || cat?.name || s.sku,
        category: cat?.category || 'אחר',
        initialStock,
        unitsSold: s.salesAmount,
        unitPrice,
        currency: cat?.currency || 'USD',
        revenue: s.salesAmount * unitPrice,
        currentStock: s.currentStock,
        sellThrough: initialStock > 0 ? s.salesAmount / initialStock : 0,
      };
    });
  }, [catalog, salesData]);

  const categories = useMemo(() => {
    const set = new Set(rows.map((r) => r.category));
    return Array.from(set);
  }, [rows]);

  const [activeCategory, setActiveCategory] = useState<string>(categories[0] ?? '');

  // Reset to first category if current is missing (e.g., after data import)
  const currentCategory = categories.includes(activeCategory) ? activeCategory : categories[0] ?? '';

  const filtered = useMemo(
    () => rows.filter((r) => r.category === currentCategory),
    [rows, currentCategory],
  );

  const totals = useMemo(() => {
    const stock = filtered.reduce((s, r) => s + r.initialStock, 0);
    const sold = filtered.reduce((s, r) => s + r.unitsSold, 0);
    const revenue = filtered.reduce((s, r) => s + r.revenue, 0);
    return {
      stock,
      sold,
      revenue,
      remaining: stock - sold,
      sellThrough: stock > 0 ? sold / stock : 0,
    };
  }, [filtered]);

  // Empty state
  if (rows.length === 0) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center py-24 gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
        >
          📊
        </div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          אין נתוני מכירות להצגה
        </h2>
        <p className="text-sm text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
          הוסף נתוני מכירות בלשונית "נתונים ומלאי" כדי לראות גרפים של ביצועי מוצרים.
        </p>
      </div>
    );
  }

  const currency = filtered[0]?.currency || 'USD';

  return (
    <div dir="rtl" className="space-y-8">
      {/* Category selector */}
      <Card>
        <CardHeader
          title="ביצועי מכירות לפי קטגוריה"
          subtitle="בחר קטגוריה כדי לבחון את ביצועי המוצרים"
        />
        <div className="flex flex-col gap-1.5" style={{ maxWidth: 320 }}>
          <label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>קטגוריה</label>
          <select
            value={currentCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="h-9 rounded-md border px-3 text-sm outline-none"
            style={{
              background: 'var(--bg-tertiary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
              minWidth: 200,
              fontFamily: "'Heebo', sans-serif",
            }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {categories.length} קטגוריות זמינות • {filtered.length} מוצרים בקטגוריה הנבחרת
          </p>
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="מלאי התחלתי"
          value={fmtNum(totals.stock)}
          sub={`${filtered.length} מוצרים בקטגוריה`}
          color="#38bdf8"
        />
        <StatCard
          label="יחידות שנמכרו"
          value={fmtNum(totals.sold)}
          sub={`${Math.round(totals.sellThrough * 100)}% ניצול מלאי`}
          color="#f59e0b"
        />
        <StatCard
          label="סך הכנסות"
          value={fmtMoney(totals.revenue, currency)}
          sub="בקטגוריה הנבחרת"
        />
        <StatCard
          label="מלאי קיים"
          value={fmtNum(totals.remaining)}
          sub={`${Math.round((1 - totals.sellThrough) * 100)}% מהמלאי במחסן`}
        />
      </div>

      {/* Scatter chart */}
      <Card>
        <CardHeader
          title="הכנסות מול כמות שנמכרה"
          subtitle="גודל העיגול = מלאי התחלתי. רחף עם העכבר לפרטים."
        />
        <div style={{ width: '100%', height: 380 }} dir="ltr">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 16, right: 32, bottom: 36, left: 32 }}>
              <CartesianGrid stroke="var(--grid-line)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="unitsSold"
                name="יחידות שנמכרו"
                tickFormatter={fmtNum}
                stroke="var(--text-muted)"
                fontSize={12}
                label={{
                  value: 'יחידות שנמכרו',
                  position: 'insideBottom',
                  offset: -18,
                  fill: 'var(--text-secondary)',
                  fontSize: 12,
                }}
              />
              <YAxis
                type="number"
                dataKey="revenue"
                name="הכנסות"
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                }
                stroke="var(--text-muted)"
                fontSize={12}
                label={{
                  value: `הכנסות (${currency})`,
                  angle: -90,
                  position: 'insideLeft',
                  offset: 8,
                  fill: 'var(--text-secondary)',
                  fontSize: 12,
                }}
              />
              <ZAxis type="number" dataKey="initialStock" range={[80, 600]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltip />} />
              <Scatter
                data={filtered}
                fill="var(--accent)"
                fillOpacity={0.85}
                stroke="var(--accent-strong)"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Data table */}
      <Card className="!p-0 overflow-hidden">
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            פירוט מוצרים — {currentCategory}
          </h3>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#38bdf8' }} />
              מלאי
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />
              נמכר
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="kp-table w-full">
            <thead>
              <tr>
                <th className="kp-th text-start">מוצר</th>
                <th className="kp-th text-end">מק"ט</th>
                <th className="kp-th text-end">מלאי התחלתי</th>
                <th className="kp-th text-end">נמכר</th>
                <th className="kp-th" style={{ width: 220 }}>
                  ניצול מלאי
                </th>
                <th className="kp-th text-end">הכנסות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.sku}>
                  <td className="kp-td font-medium">{r.name}</td>
                  <td className="kp-td kp-code">{r.sku}</td>
                  <td className="kp-td kp-num" style={{ color: '#38bdf8' }}>
                    {fmtNum(r.initialStock)}
                  </td>
                  <td className="kp-td kp-num" style={{ color: '#d97706', fontWeight: 600 }}>
                    {fmtNum(r.unitsSold)}
                  </td>
                  <td className="kp-td">
                    <SellThroughBar pct={r.sellThrough} />
                  </td>
                  <td
                    className="kp-td kp-num font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {fmtMoney(r.revenue, r.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SellThroughBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  const display = Math.round(clamped * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(56, 189, 248, 0.18)' }}
      >
        <div
          className="absolute inset-y-0 start-0 rounded-full transition-[width]"
          style={{ width: `${display}%`, background: '#f59e0b' }}
        />
      </div>
      <span
        className="text-xs font-medium tabular-nums w-10 text-end"
        style={{ color: 'var(--text-muted)' }}
      >
        {display}%
      </span>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: Row }[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div
      dir="rtl"
      className="rounded-lg p-3 text-xs min-w-[220px]"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--card-shadow)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="font-semibold mb-2">{p.name}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1" style={{ color: 'var(--text-secondary)' }}>
        <div>מק"ט</div>
        <div className="text-end kp-code">{p.sku}</div>
        <div>מלאי התחלתי</div>
        <div className="text-end tabular-nums" style={{ color: '#38bdf8' }}>
          {fmtNum(p.initialStock)}
        </div>
        <div>יחידות שנמכרו</div>
        <div className="text-end tabular-nums" style={{ color: '#d97706', fontWeight: 600 }}>
          {fmtNum(p.unitsSold)}
        </div>
        <div>מחיר ליחידה</div>
        <div className="text-end tabular-nums">{fmtMoney(p.unitPrice, p.currency)}</div>
        <div>הכנסות</div>
        <div
          className="text-end tabular-nums font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {fmtMoney(p.revenue, p.currency)}
        </div>
        <div>ניצול מלאי</div>
        <div className="text-end tabular-nums">{Math.round(p.sellThrough * 100)}%</div>
      </div>
    </div>
  );
}
