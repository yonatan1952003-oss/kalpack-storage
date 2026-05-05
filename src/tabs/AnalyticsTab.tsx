import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, X } from 'lucide-react';
import type { PurchaseOrder, Container, SalesRow, CatalogProduct } from '../types';
import { Card, CardHeader, StatCard } from '../components/Card';
import { toDailySales } from '../store';

interface Props {
  pos: PurchaseOrder[];
  containers: Container[];
  salesData: SalesRow[];
  catalog: CatalogProduct[];
}

export function AnalyticsTab({ pos, containers, salesData, catalog }: Props) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredPos = useMemo(() => pos.filter(po => {
    if (dateFrom && po.date < dateFrom) return false;
    if (dateTo && po.date > dateTo) return false;
    return true;
  }), [pos, dateFrom, dateTo]);

  const analytics = useMemo(() => {
    const allItems = filteredPos.flatMap(po => po.items);

    const bySupplier = new Map<string, number>();
    for (const po of filteredPos) {
      const val = po.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      bySupplier.set(po.supplier, (bySupplier.get(po.supplier) || 0) + val);
    }
    const supplierSpending = [...bySupplier.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const byCategory = new Map<string, number>();
    for (const item of allItems) {
      const val = item.quantity * item.unitPrice;
      byCategory.set(item.category, (byCategory.get(item.category) || 0) + val);
    }
    const categorySpending = [...byCategory.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const topSelling = [...salesData]
      .map(r => ({ ...r, dailySales: toDailySales(r) }))
      .sort((a, b) => b.dailySales - a.dailySales);

    const stockValue = salesData.reduce((s, r) => {
      const cat = catalog.find(c => c.sku === r.sku);
      return s + r.currentStock * (cat?.unitPrice || 0);
    }, 0);

    const totalShipping = containers.reduce((s, c) => s + c.shippingCost, 0);
    const totalOrderValue = allItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    // Monthly PO count trend
    const monthlyPOs = new Map<string, number>();
    for (const po of filteredPos) {
      const month = po.date.slice(0, 7);
      monthlyPOs.set(month, (monthlyPOs.get(month) || 0) + 1);
    }
    const poTrend = [...monthlyPOs.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    // Monthly spending trend
    const monthlySpend = new Map<string, number>();
    for (const po of filteredPos) {
      const month = po.date.slice(0, 7);
      const val = po.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      monthlySpend.set(month, (monthlySpend.get(month) || 0) + val);
    }
    const spendingTrend = [...monthlySpend.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    return { supplierSpending, categorySpending, topSelling, stockValue, totalShipping, totalOrderValue, poTrend, spendingTrend };
  }, [filteredPos, containers, salesData, catalog]);

  const maxSupplier = Math.max(...analytics.supplierSpending.map(s => s.value), 1);
  const maxCategory = Math.max(...analytics.categorySpending.map(s => s.value), 1);
  const maxSpend = Math.max(...analytics.spendingTrend.map(([, v]) => v), 1);
  const maxPO = Math.max(...analytics.poTrend.map(([, c]) => c), 1);

  const chartColors = ['var(--accent)', 'var(--status-ready)', 'var(--status-warning)', 'var(--status-production)'];
  const filtersActive = dateFrom !== '' || dateTo !== '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">אנליטיקס</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>ניתוח ביצועי מחסן ורכש</p>
        </div>

        {/* Date range picker */}
        <div dir="rtl" className="flex flex-wrap items-center gap-2">
          <CalendarDays size={15} style={{ color: 'var(--text-muted)' }} />
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-8 rounded-lg border px-2 text-xs outline-none"
              style={{ background: 'var(--bg-tertiary)', borderColor: filtersActive ? 'var(--accent)' : 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>עד</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-8 rounded-lg border px-2 text-xs outline-none"
              style={{ background: 'var(--bg-tertiary)', borderColor: filtersActive ? 'var(--accent)' : 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
          {filtersActive && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-medium hover:opacity-80"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            >
              <X size={12} /> נקה
            </button>
          )}
          {filtersActive && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
              {filteredPos.length} הזמנות
            </span>
          )}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="סה״כ הוצאות רכש" value={`$${analytics.totalOrderValue.toLocaleString()}`} color="var(--accent)" />
        <StatCard label="עלויות הובלה" value={`$${analytics.totalShipping.toLocaleString()}`} color="var(--status-warning)" />
        <StatCard label="שווי מלאי" value={`$${Math.round(analytics.stockValue).toLocaleString()}`} color="var(--status-ready)" />
        <StatCard label="מוצרים בקטלוג" value={catalog.length} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Supplier spending */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader title="הוצאות לפי ספק" subtitle="שווי הזמנות כולל" />
            <div className="space-y-3">
              {analytics.supplierSpending.map((s, i) => (
                <div key={s.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>${s.value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.value / maxSupplier) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                      style={{ background: chartColors[i % 4] }}
                    />
                  </div>
                </div>
              ))}
              {analytics.supplierSpending.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>אין נתונים</p>}
            </div>
          </Card>
        </motion.div>

        {/* Category spending */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader title="הוצאות לפי קטגוריה" subtitle="התפלגות הזמנות" />
            <div className="space-y-3">
              {analytics.categorySpending.map((s, i) => (
                <div key={s.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--status-ready)' }}>${s.value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.value / maxCategory) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                      style={{ background: chartColors[(i + 2) % 4] }}
                    />
                  </div>
                </div>
              ))}
              {analytics.categorySpending.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>אין נתונים</p>}
            </div>
          </Card>
        </motion.div>

        {/* Top selling */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader title="מוצרים מובילים במכירות" subtitle="לפי קצב מכירה יומי" />
            <div className="space-y-2">
              {analytics.topSelling.slice(0, 6).map((row, i) => (
                <div key={row.sku} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: i < 3 ? 'var(--accent)' : 'var(--text-secondary)', color: '#080c16' }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold truncate">{row.sku}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{row.name}</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="text-sm font-bold font-mono">{Math.round(row.dailySales)}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>יח׳/יום</p>
                  </div>
                </div>
              ))}
              {analytics.topSelling.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>אין נתוני מכירות</p>}
            </div>
          </Card>
        </motion.div>

        {/* Monthly spending trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card>
            <CardHeader title="הוצאות רכש לפי חודש" subtitle="מגמת הוצאות ($)" />
            <div className="flex items-end gap-1.5 h-48">
              {analytics.spendingTrend.map(([month, val], i) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${month}: $${val.toLocaleString()}`}>
                  <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--accent)' }}>
                    ${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  </span>
                  <motion.div
                    className="w-full rounded-t-lg"
                    initial={{ height: 0 }}
                    animate={{ height: `${(val / maxSpend) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.07 }}
                    style={{ background: 'linear-gradient(to top, var(--accent), var(--accent-dark))', minHeight: 8 }}
                  />
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>{month.slice(5)}/{month.slice(2, 4)}</span>
                </div>
              ))}
              {analytics.spendingTrend.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>אין נתונים</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* PO count trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader title="מספר הזמנות לפי חודש" subtitle="כמות הזמנות רכש" />
            <div className="flex items-end gap-1.5 h-48">
              {analytics.poTrend.map(([month, count], i) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${month}: ${count} הזמנות`}>
                  <span className="text-sm font-mono font-bold" style={{ color: 'var(--status-ready)' }}>{count}</span>
                  <motion.div
                    className="w-full rounded-t-lg"
                    initial={{ height: 0 }}
                    animate={{ height: `${(count / maxPO) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    style={{ background: 'linear-gradient(to top, var(--status-ready), var(--accent))', minHeight: 8 }}
                  />
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>{month.slice(5)}/{month.slice(2, 4)}</span>
                </div>
              ))}
              {analytics.poTrend.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>אין נתונים</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
