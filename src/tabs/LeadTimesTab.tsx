import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Factory, Ship } from 'lucide-react';
import type { PurchaseOrder } from '../types';
import { Card, CardHeader, StatCard, SupplierBlock, LeadBar } from '../components/Card';

interface Props {
  pos: PurchaseOrder[];
}

export function LeadTimesTab({ pos }: Props) {
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
        <StatCard label="סה״כ אספקה" value={`${avgProd + avgShip} ימים`} color="var(--accent)" />
        <StatCard label="מדידות בפועל" value={measurements.length} sub="מעברי סטטוס" />
      </div>

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
