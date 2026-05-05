import { motion } from 'framer-motion';
import { PackageCheck, Ship, Package, DollarSign, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Container, ContainerItem, PurchaseOrder } from '../types';
import { Card, StatCard, StatusBadge, Button } from '../components/Card';
import { downloadExcel } from '../utils/excelExport';

interface Props {
  containers: Container[];
  pos: PurchaseOrder[];
}

export function ArrivedContainersTab({ containers, pos }: Props) {
  const totalShipping = containers.reduce((s, c) => s + c.shippingCost, 0);
  const totalUnits = containers.reduce((s, c) => s + c.items.reduce((s2, i) => s2 + i.quantity, 0), 0);

  const getDisplay = (ci: ContainerItem) => {
    if (ci.snapshot) return ci.snapshot;
    const po = pos.find(p => p.id === ci.poId);
    const item = po?.items.find(i => i.id === ci.lineItemId);
    if (po && item) return {
      poNumber: po.poNumber, supplier: po.supplier, sku: item.sku, description: item.description,
      color: item.color, category: item.category, cbm: item.cbm,
      unitPrice: item.unitPrice, currency: item.currency, shippingCostPerUnit: item.shippingCostPerUnit,
    };
    return null;
  };

  const reExportExcel = (container: Container) => {
    const unitCount = container.items.reduce((s, i) => s + i.quantity, 0);
    const costPerUnit = unitCount > 0 ? container.shippingCost / unitCount : 0;
    const rows = container.items.map(ci => {
      const d = getDisplay(ci);
      const landedCost = d ? d.unitPrice + costPerUnit : 0;
      return {
        'מספר מכולה': container.containerNumber,
        'מספר הזמנה': d?.poNumber ?? '',
        'ספק': d?.supplier ?? container.supplier,
        'מק״ט': d?.sku ?? '',
        'תיאור': d?.description ?? '',
        'CBM': d?.cbm ?? 0,
        'כמות': ci.quantity,
        'מחיר יחידה': d?.unitPrice ?? 0,
        'עלות הובלה ליחידה': costPerUnit.toFixed(2),
        'עלות נחיתה ליחידה': landedCost.toFixed(2),
        'תאריך הגעה': container.arrivalDate,
      };
    });
    if (rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'קליטה');
    downloadExcel(wb, `arrival_${container.containerNumber}_${container.arrivalDate}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="מכולות שהגיעו" value={containers.length} />
        <StatCard label="עלות הובלה כוללת" value={`$${totalShipping.toLocaleString()}`} color="var(--accent)" />
        <StatCard label="סה״כ יחידות שנקלטו" value={totalUnits.toLocaleString()} />
        <StatCard label="עלות ליחידה (ממוצע)" value={totalUnits > 0 ? `$${(totalShipping / totalUnits).toFixed(2)}` : '—'} color="var(--status-ready)" />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">מכולות שהגיעו (ארכיון)</h2>
      </div>

      {containers.length === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PackageCheck size={48} style={{ color: 'var(--text-muted)' }} />
            <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>אין עדיין מכולות בארכיון.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>מכולות יופיעו כאן לאחר העברתן לסטטוס "הגיע" בלשונית מכולות.</p>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {containers.map((container, idx) => {
          const unitCount = container.items.reduce((s, i) => s + i.quantity, 0);
          const costPerUnit = unitCount > 0 ? container.shippingCost / unitCount : 0;

          return (
            <motion.div
              key={container.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52, 211, 153,0.12)' }}>
                      <PackageCheck size={20} style={{ color: 'var(--status-received)' }} />
                    </div>
                    <div>
                      <span className="font-bold font-mono text-sm">{container.containerNumber}</span>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{container.supplier}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status="received" label="נקלט למלאי" />
                    <Button variant="secondary" onClick={() => reExportExcel(container)}>
                      <Download size={14} className="inline ml-1" /> אקסל קליטה
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} style={{ color: 'var(--accent)' }} />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>עלות הובלה</p>
                      <p className="text-sm font-bold font-mono">${container.shippingCost.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package size={14} style={{ color: 'var(--status-ready)' }} />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>יחידות שנקלטו</p>
                      <p className="text-sm font-bold font-mono">{unitCount.toLocaleString()}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>עלות ליחידה</p>
                    <p className="text-sm font-bold font-mono" style={{ color: 'var(--accent)' }}>${costPerUnit.toFixed(2)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <th className="text-right py-2 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>הזמנה</th>
                        <th className="text-right py-2 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>מק״ט</th>
                        <th className="text-right py-2 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>תיאור</th>
                        <th className="text-right py-2 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>כמות</th>
                        <th className="text-right py-2 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>מחיר יחידה</th>
                        <th className="text-right py-2 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>עלות נחיתה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {container.items.map((ci, i) => {
                        const d = getDisplay(ci);
                        const landedCost = d ? d.unitPrice + costPerUnit : 0;
                        return (
                          <tr key={i} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                            <td className="py-2 px-2 font-mono text-xs" style={{ color: 'var(--accent)' }}>{d?.poNumber ?? '—'}</td>
                            <td className="py-2 px-2 font-mono text-xs font-bold">{d?.sku ?? '—'}</td>
                            <td className="py-2 px-2 text-xs">{d?.description ?? '—'}</td>
                            <td className="py-2 px-2 font-mono">{ci.quantity.toLocaleString()}</td>
                            <td className="py-2 px-2 font-mono">${d ? d.unitPrice.toFixed(2) : '—'}</td>
                            <td className="py-2 px-2 font-mono font-bold" style={{ color: 'var(--status-received)' }}>${landedCost.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 pt-3 text-xs" style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  {container.departureDate && (
                    <span className="flex items-center gap-1.5">
                      <Ship size={12} />
                      <span style={{ color: 'var(--text-muted)' }}>יציאה:</span>
                      <span className="font-mono font-medium">{container.departureDate}</span>
                    </span>
                  )}
                  {container.arrivalDate && (
                    <span className="flex items-center gap-1.5">
                      <PackageCheck size={12} />
                      <span style={{ color: 'var(--text-muted)' }}>הגעה:</span>
                      <span className="font-mono font-medium">{container.arrivalDate}</span>
                    </span>
                  )}
                  {container.archivedAt && (
                    <span className="flex items-center gap-1.5">
                      <span style={{ color: 'var(--text-muted)' }}>נקלט ב:</span>
                      <span className="font-mono font-medium">{new Date(container.archivedAt).toLocaleString('he-IL')}</span>
                    </span>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
