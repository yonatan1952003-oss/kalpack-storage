import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Factory, Ship, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PurchaseOrder } from '../types';
import { Card, CardHeader, StatCard, SupplierBlock, LeadBar } from '../components/Card';

interface Props {
  pos: PurchaseOrder[];
}

/** Days from `from` to `to` (positive if `to` is later). */
function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function LeadTimesTab({ pos }: Props) {
  // Tick "today" once a day so countdowns auto-refresh without reload
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setToday(new Date()), 60 * 60 * 1000); // hourly is enough
    return () => clearInterval(id);
  }, []);

  // Build live countdowns for active production / shipping
  const countdowns = useMemo(() => {
    const out: {
      poNumber: string; supplier: string; sku: string; description: string;
      kind: 'production' | 'shipping';
      anchor: string; deadline: string; remaining: number; total: number; quantity: number;
    }[] = [];
    for (const po of pos) {
      const anchorDate = po.executionDate || po.date;
      for (const item of po.items) {
        // Production countdown — for items still in production
        if (item.statusBreakdown.production > 0 && anchorDate) {
          const start = new Date(anchorDate);
          const deadline = new Date(start);
          deadline.setDate(deadline.getDate() + item.estimatedProductionDays);
          out.push({
            poNumber: po.poNumber, supplier: po.supplier, sku: item.sku, description: item.description,
            kind: 'production', anchor: anchorDate, deadline: deadline.toISOString().slice(0, 10),
            remaining: daysBetween(today, deadline), total: item.estimatedProductionDays,
            quantity: item.statusBreakdown.production,
          });
        }
        // Shipping countdown — for items in transit with an estimated arrival
        if (item.statusBreakdown.transit > 0 && item.estimatedArrival) {
          const arrival = new Date(item.estimatedArrival);
          out.push({
            poNumber: po.poNumber, supplier: po.supplier, sku: item.sku, description: item.description,
            kind: 'shipping', anchor: '', deadline: item.estimatedArrival,
            remaining: daysBetween(today, arrival), total: item.estimatedShippingDays,
            quantity: item.statusBreakdown.transit,
          });
        }
      }
    }
    return out.sort((a, b) => a.remaining - b.remaining);
  }, [pos, today]);

  const overdue = countdowns.filter(c => c.remaining < 0);
  const dueSoon = countdowns.filter(c => c.remaining >= 0 && c.remaining <= 7);

  // Derive lead times directly from PO items
  const leadData = useMemo(() => {
    const map = new Map<string, { supplier: string; sku: string; description: string; prodDays: number; shipDays: number }>();
    for (const po of pos) {
      for (const item of po.items) {
        const key = `${po.supplier}::${item.sku}`;
        if (!map.has(key)) {
          map.set(key, {
            supplier: po.supplier,
            sku: item.sku,
            description: item.description,
            prodDays: item.estimatedProductionDays,
            shipDays: item.estimatedShippingDays,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [pos]);

  const suppliers = [...new Set(leadData.map(l => l.supplier))];
  const avgProd = leadData.length > 0 ? Math.round(leadData.reduce((s, l) => s + l.prodDays, 0) / leadData.length) : 0;
  const avgShip = leadData.length > 0 ? Math.round(leadData.reduce((s, l) => s + l.shipDays, 0) / leadData.length) : 0;

  // Actual transition measurements from PO history
  const measurements: { sku: string; transition: string; days: number }[] = [];
  for (const po of pos) {
    for (const item of po.items) {
      for (let i = 0; i < item.statusTransitions.length; i++) {
        const t = item.statusTransitions[i];
        const fromDate = i === 0 ? new Date(item.createdAt) : new Date(item.statusTransitions[i - 1].date);
        const toDate = new Date(t.date);
        const days = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        measurements.push({ sku: item.sku, transition: `${t.from} → ${t.to}`, days });
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ממוצע ייצור" value={`${avgProd} ימים`} color="var(--status-production)" />
        <StatCard label="ממוצע הפלגה" value={`${avgShip} ימים`} color="var(--status-ready)" />
        <StatCard label="באיחור" value={overdue.length} color="#ef4444" sub="פריטים עם דדליין שעבר" />
        <StatCard label="קרוב לדדליין" value={dueSoon.length} color="var(--status-warning)" sub="≤ 7 ימים" />
      </div>

      {/* Live countdown — production + shipping */}
      {countdowns.length > 0 && (
        <Card>
          <CardHeader title="ספירה לאחור פעילה" subtitle={`מתעדכן אוטומטית · ${today.toLocaleDateString('he-IL')}`} />
          <div className="space-y-2">
            {countdowns.map((c, i) => {
              const pct = c.total > 0 ? Math.max(0, Math.min(100, ((c.total - c.remaining) / c.total) * 100)) : 0;
              const isOverdue = c.remaining < 0;
              const isClose = c.remaining >= 0 && c.remaining <= 7;
              const Icon = c.kind === 'production' ? Factory : Ship;
              const color = isOverdue ? '#ef4444' : isClose ? 'var(--status-warning)' : c.kind === 'production' ? 'var(--status-production)' : 'var(--status-ready)';
              return (
                <div key={i} className="p-3 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: isOverdue ? 'rgba(239,68,68,0.4)' : 'var(--border-color)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <Icon size={14} style={{ color }} />
                    <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>{c.poNumber}</span>
                    <span className="font-mono text-xs font-bold">{c.sku}</span>
                    <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{c.description}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.quantity.toLocaleString()} יח׳</span>
                    {isOverdue
                      ? <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#ef4444' }}><AlertTriangle size={12} />איחור {Math.abs(c.remaining)} ימים</span>
                      : c.remaining === 0
                        ? <span className="flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--status-warning)' }}><Clock size={12} />היום</span>
                        : c.remaining <= 7
                          ? <span className="flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--status-warning)' }}><Clock size={12} />{c.remaining} ימים</span>
                          : <span className="flex items-center gap-1 text-xs font-bold" style={{ color }}><CheckCircle2 size={12} />{c.remaining} ימים</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {c.kind === 'production' ? `מ-${c.anchor}` : 'הפלגה'}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                      <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{c.deadline}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {suppliers.map((supplier, idx) => {
        const items = leadData.filter(l => l.supplier === supplier);
        return (
          <motion.div key={supplier} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
            <SupplierBlock supplier={supplier} count={items.length}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <th className="kp-th">מק״ט</th>
                      <th className="kp-th">תיאור</th>
                      <th className="kp-th">
                        <div className="flex items-center gap-1"><Factory size={12} /> ייצור</div>
                      </th>
                      <th className="kp-th">
                        <div className="flex items-center gap-1"><Ship size={12} /> הפלגה</div>
                      </th>
                      <th className="kp-th">
                        <div className="flex items-center gap-1"><Clock size={12} /> סה״כ</div>
                      </th>
                      <th className="kp-th">ויזואליזציה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const total = item.prodDays + item.shipDays;
                      return (
                        <tr key={item.sku} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                          <td className="kp-td kp-code font-mono text-xs font-bold">{item.sku}</td>
                          <td className="kp-td text-xs">{item.description}</td>
                          <td className="kp-td kp-num">
                            <span className="font-mono font-bold" style={{ color: 'var(--status-production)' }}>{item.prodDays}</span>
                            <span className="text-xs ms-1" style={{ color: 'var(--text-muted)' }}>ימים</span>
                          </td>
                          <td className="kp-td kp-num">
                            <span className="font-mono font-bold" style={{ color: 'var(--status-ready)' }}>{item.shipDays}</span>
                            <span className="text-xs ms-1" style={{ color: 'var(--text-muted)' }}>ימים</span>
                          </td>
                          <td className="kp-td kp-num">
                            <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{total}</span>
                            <span className="text-xs ms-1" style={{ color: 'var(--text-muted)' }}>ימים</span>
                          </td>
                          <td className="kp-td w-48">
                            <LeadBar prod={item.prodDays} ship={item.shipDays} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SupplierBlock>
          </motion.div>
        );
      })}

      {measurements.length > 0 && (
        <Card>
          <CardHeader title="מעברי סטטוס בפועל" subtitle="מדידות מהזמנות קיימות" />
          <div className="space-y-2">
            {measurements.slice(0, 12).map((m, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold">{m.sku}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.transition}</span>
                </div>
                <span className="font-mono text-sm font-bold" style={{ color: 'var(--accent)' }}>{m.days} ימים</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
