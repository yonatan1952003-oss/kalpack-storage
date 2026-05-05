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
import { Card, CardHeader, StatCard } from './Card';
import type { CatalogProduct, SalesRow } from '../types';

interface Props {
  catalog: CatalogProduct[];
  salesData: SalesRow[];
}

interface Row {
  sku: string;
  name: string;
  category: string;
  initialStock: number;
  unitsSold: number;
  currentStock: number;
  unitPrice: number;
  currency: string;
  revenue: number;
  utilization: number; // 0..1
}

const ALL = '__all__';

const fmtMoney = (n: number, currency = 'USD') => {
  try {
    return n.toLocaleString('he-IL', { style: 'currency', currency, maximumFractionDigits: 0 });
  } catch {
    // Fallback when currency is not a valid ISO 4217 code (e.g., bad Excel import)
    return `${n.toLocaleString('he-IL')} ${currency}`;
  }
};
const fmtNum = (n: number) => n.toLocaleString('he-IL');
const fmtAxis = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`);

export function InventoryAnalyticsDashboard({ catalog, salesData }: Props) {
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
        currentStock: s.currentStock,
        unitPrice,
        currency: cat?.currency || 'USD',
        revenue: s.salesAmount * unitPrice,
        utilization: initialStock > 0 ? s.salesAmount / initialStock : 0,
      };
    });
  }, [catalog, salesData]);

  const [selectedSku, setSelectedSku] = useState<string>(ALL);

  // Reset to ALL if previously selected SKU disappears (e.g., after data import)
  const effectiveSku = rows.some((r) => r.sku === selectedSku) ? selectedSku : ALL;
  const isAll = effectiveSku === ALL;

  const selectedRow = useMemo(
    () => rows.find((r) => r.sku === effectiveSku) ?? null,
    [rows, effectiveSku],
  );

  // Metrics: aggregate when ALL, else single product
  const metrics = useMemo(() => {
    if (isAll) {
      const initialStock = rows.reduce((s, r) => s + r.initialStock, 0);
      const currentStock = rows.reduce((s, r) => s + r.currentStock, 0);
      const unitsSold = rows.reduce((s, r) => s + r.unitsSold, 0);
      const revenue = rows.reduce((s, r) => s + r.revenue, 0);
      return {
        currentStock,
        unitsSold,
        revenue,
        utilization: initialStock > 0 ? unitsSold / initialStock : 0,
      };
    }
    const r = selectedRow;
    return {
      currentStock: r?.currentStock ?? 0,
      unitsSold: r?.unitsSold ?? 0,
      revenue: r?.revenue ?? 0,
      utilization: r?.utilization ?? 0,
    };
  }, [isAll, rows, selectedRow]);

  // Currency for the revenue card — use selected row's currency, else first row's, fallback USD
  const currency = selectedRow?.currency || rows[0]?.currency || 'USD';

  // Empty state
  if (rows.length === 0) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center py-24 gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
        >
          📦
        </div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          אין נתונים להצגה
        </h2>
        <p className="text-sm text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
          הוסף מוצרים לקטלוג ונתוני מכירות כדי לראות את לוח האנליטיקה.
        </p>
      </div>
    );
  }

  // Background scatter (non-selected) and foreground scatter (selected) for highlight effect
  const bgRows = isAll ? [] : rows.filter((r) => r.sku !== effectiveSku);
  const fgRows = isAll ? rows : rows.filter((r) => r.sku === effectiveSku);

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header + product selector */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2
              className="text-base font-semibold accent-underline pb-1"
              style={{
                color: 'var(--text-primary)',
                fontFamily: "'Outfit', 'Noto Sans Hebrew', sans-serif",
              }}
            >
              לוח אנליטיקה למלאי
            </h2>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              בחר מוצר כדי לבחון את ביצועי המלאי וההכנסות שלו
            </p>
          </div>
          <ProductSelect
            value={effectiveSku}
            rows={rows}
            onChange={setSelectedSku}
          />
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="מלאי קיים"
          value={fmtNum(metrics.currentStock)}
          sub={isAll ? `${rows.length} מוצרים` : selectedRow?.name}
          color="#38bdf8"
        />
        <StatCard
          label="סך הכנסות"
          value={fmtMoney(metrics.revenue, currency)}
          sub={isAll ? 'כל המוצרים' : selectedRow?.sku}
          color="var(--accent)"
        />
        <StatCard
          label="יחידות שנמכרו"
          value={fmtNum(metrics.unitsSold)}
          sub={
            isAll
              ? `מתוך ${fmtNum(rows.reduce((s, r) => s + r.initialStock, 0))} מלאי התחלתי`
              : `מתוך ${fmtNum(selectedRow?.initialStock ?? 0)} מלאי התחלתי`
          }
          color="#f59e0b"
        />
        <StatCard
          label="ניצול מלאי"
          value={`${Math.round(metrics.utilization * 100)}%`}
          sub={isAll ? 'ממוצע משוקלל' : 'מהמלאי ההתחלתי נמכר'}
          color="#34d399"
        />
      </div>

      {/* Scatter / bubble chart */}
      <Card>
        <CardHeader
          title="הכנסות מול יחידות שנמכרו"
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
                tickFormatter={fmtAxis}
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
              {bgRows.length > 0 && (
                <Scatter data={bgRows} fill="var(--text-muted)" fillOpacity={0.2} />
              )}
              <Scatter
                data={fgRows}
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
            פירוט מוצרים{isAll ? '' : ` — ${selectedRow?.name ?? ''}`}
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
                <th className="kp-th text-end">מק"ט</th>
                <th className="kp-th text-start">שם מוצר</th>
                <th className="kp-th text-end">מלאי התחלתי</th>
                <th className="kp-th text-end">נמכר</th>
                <th className="kp-th text-end">הכנסות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSelected = !isAll && r.sku === effectiveSku;
                const dim = !isAll && !isSelected;
                return (
                  <tr
                    key={r.sku}
                    style={{
                      background: isSelected ? 'var(--accent-bg)' : undefined,
                      opacity: dim ? 0.45 : 1,
                    }}
                  >
                    <td className="kp-td kp-code">{r.sku}</td>
                    <td className="kp-td font-medium">{r.name}</td>
                    <td className="kp-td kp-num" style={{ color: '#38bdf8' }}>
                      {fmtNum(r.initialStock)}
                    </td>
                    <td className="kp-td kp-num" style={{ color: '#d97706', fontWeight: 600 }}>
                      {fmtNum(r.unitsSold)}
                    </td>
                    <td
                      className="kp-td kp-num font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {fmtMoney(r.revenue, r.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ProductSelect({
  value,
  rows,
  onChange,
}: {
  value: string;
  rows: Row[];
  onChange: (sku: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 w-full md:w-80">
      <label
        htmlFor="kp-product-select"
        className="text-[11px] font-semibold tracking-wide"
        style={{
          color: 'var(--text-muted)',
          fontFamily: "'Outfit', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        בחר מוצר
      </label>
      <select
        id="kp-product-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border px-4 py-2.5 text-sm outline-none transition-[border-color,box-shadow] duration-200 cursor-pointer appearance-none"
        style={{
          background: 'var(--bg-tertiary)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'><path d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'left 14px center',
          paddingLeft: 36,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-bg)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-color)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <option value={ALL}>כל המוצרים</option>
        {rows.map((r) => (
          <option key={r.sku} value={r.sku}>
            {r.name} — {r.sku}
          </option>
        ))}
      </select>
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
        <div className="text-end tabular-nums">{Math.round(p.utilization * 100)}%</div>
      </div>
    </div>
  );
}
