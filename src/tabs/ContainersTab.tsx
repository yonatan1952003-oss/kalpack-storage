import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Ship, Package, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Container, ContainerItem, ContainerType, PurchaseOrder } from '../types';
import { CONTAINER_VOLUMES } from '../types';
import { Card, CardHeader, StatCard, StatusBadge, Button, Input } from '../components/Card';
import { downloadExcel } from '../utils/excelExport';
import { v4 as uuid } from 'uuid';

interface Props {
  containers: Container[];
  setContainers: React.Dispatch<React.SetStateAction<Container[]>>;
  setArrivedContainers?: React.Dispatch<React.SetStateAction<Container[]>>;
  pos: PurchaseOrder[];
  setPos?: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  /** When provided, arrival is delegated to the DB (trigger handles archive +
   * status_breakdown shift). When omitted, the local-only flow is used. */
  onArchive?: (containerId: string) => Promise<void>;
}

export function ContainersTab({ containers, setContainers, setArrivedContainers, pos, setPos, onArchive }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [confirmArrival, setConfirmArrival] = useState<Container | null>(null);

  const totalShipping = containers.reduce((s, c) => s + c.shippingCost, 0);
  const totalUnits = containers.reduce((s, c) => s + c.items.reduce((s2, i) => s2 + i.quantity, 0), 0);

  const getItemDetails = (poId: string, lineItemId: string) => {
    const po = pos.find(p => p.id === poId);
    const item = po?.items.find(i => i.id === lineItemId);
    return { po, item };
  };

  const containerStatusLabels: Record<string, string> = {
    loading: 'בטעינה',
    'in-transit': 'בהפלגה',
    arrived: 'הגיע',
  };

  const itemDisplay = (ci: ContainerItem) => {
    const live = getItemDetails(ci.poId, ci.lineItemId);
    if (live.po && live.item) {
      return {
        poNumber: live.po.poNumber, supplier: live.po.supplier,
        sku: live.item.sku, description: live.item.description,
        unitPrice: live.item.unitPrice, color: live.item.color, category: live.item.category, cbm: live.item.cbm,
        currency: live.item.currency, shippingCostPerUnit: live.item.shippingCostPerUnit,
      };
    }
    return ci.snapshot ?? null;
  };

  const handleArrival = (container: Container) => {
    // When wired to Supabase, delegate the data move to the DB trigger.
    // The frontend still generates the ERP intake Excel locally.
    if (onArchive) {
      const unitCount = container.items.reduce((s, i) => s + i.quantity, 0);
      const costPerUnit = unitCount > 0 ? container.shippingCost / unitCount : 0;
      const arrivalDate = new Date().toISOString().slice(0, 10);
      const rows = container.items.map(ci => {
        const d = itemDisplay(ci);
        const landedCost = d ? d.unitPrice + costPerUnit : 0;
        return {
          'מספר מכולה': container.containerNumber,
          'מספר הזמנה': d?.poNumber ?? '',
          'ספק': d?.supplier ?? container.supplier,
          'מק״ט': d?.sku ?? '',
          'תיאור': d?.description ?? '',
          'צבע': d?.color ?? '',
          'קטגוריה': d?.category ?? '',
          'CBM': d?.cbm ?? 0,
          'כמות שהתקבלה': ci.quantity,
          'מחיר יחידה': d?.unitPrice ?? 0,
          'עלות הובלה ליחידה': costPerUnit.toFixed(2),
          'עלות נחיתה ליחידה': landedCost.toFixed(2),
          'סה״כ שורה': (ci.quantity * landedCost).toFixed(2),
          'תאריך הגעה': arrivalDate,
        };
      });
      if (rows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 14) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'קליטת מלאי');
        downloadExcel(wb, `arrival_${container.containerNumber}_${arrivalDate}.xlsx`);
      }
      // Optimistic UI: remove from active list immediately. Realtime will
      // populate the arrived list a moment later.
      setContainers(prev => prev.filter(c => c.id !== container.id));
      onArchive(container.id);
      setConfirmArrival(null);
      return;
    }
    if (!setArrivedContainers || !setPos) {
      // Fallback: just flip status (if parent didn't wire arrival props)
      setContainers(prev => prev.map(c => c.id === container.id ? { ...c, status: 'arrived' } : c));
      return;
    }
    const arrivalDate = new Date().toISOString().slice(0, 10);
    const unitCount = container.items.reduce((s, i) => s + i.quantity, 0);
    const costPerUnit = unitCount > 0 ? container.shippingCost / unitCount : 0;

    // Generate Excel for ERP intake
    const rows = container.items.map(ci => {
      const d = itemDisplay(ci);
      const landedCost = d ? d.unitPrice + costPerUnit : 0;
      return {
        'מספר מכולה': container.containerNumber,
        'מספר הזמנה': d?.poNumber ?? '',
        'ספק': d?.supplier ?? container.supplier,
        'מק״ט': d?.sku ?? '',
        'תיאור': d?.description ?? '',
        'צבע': d?.color ?? '',
        'קטגוריה': d?.category ?? '',
        'CBM': d?.cbm ?? 0,
        'כמות שהתקבלה': ci.quantity,
        'מחיר יחידה': d?.unitPrice ?? 0,
        'עלות הובלה ליחידה': costPerUnit.toFixed(2),
        'עלות נחיתה ליחידה': landedCost.toFixed(2),
        'סה״כ שורה': (ci.quantity * landedCost).toFixed(2),
        'תאריך הגעה': arrivalDate,
      };
    });
    if (rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 14) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'קליטת מלאי');
      downloadExcel(wb, `arrival_${container.containerNumber}_${arrivalDate}.xlsx`);
    }

    // Remove the container quantities from PO line items (partial removal — leave the rest)
    setPos(prev => prev.map(po => {
      const containerEntries = container.items.filter(i => i.poId === po.id);
      if (containerEntries.length === 0) return po;
      const updatedItems = po.items.map(item => {
        const entry = containerEntries.find(e => e.lineItemId === item.id);
        if (!entry) return item;
        const remainingQty = Math.max(0, item.quantity - entry.quantity);
        // Subtract from received status (or transit fallback if not yet received)
        const newBreakdown = { ...item.statusBreakdown };
        const fromReceived = Math.min(newBreakdown.received, entry.quantity);
        newBreakdown.received -= fromReceived;
        let leftToRemove = entry.quantity - fromReceived;
        if (leftToRemove > 0) {
          const fromTransit = Math.min(newBreakdown.transit, leftToRemove);
          newBreakdown.transit -= fromTransit;
          leftToRemove -= fromTransit;
        }
        if (leftToRemove > 0) {
          // last-resort fallback: reduce ready/production
          for (const s of ['ready', 'production'] as const) {
            const take = Math.min(newBreakdown[s], leftToRemove);
            newBreakdown[s] -= take;
            leftToRemove -= take;
            if (leftToRemove <= 0) break;
          }
        }
        return { ...item, quantity: remainingQty, statusBreakdown: newBreakdown };
      }).filter(i => i.quantity > 0);
      return { ...po, items: updatedItems };
    }).filter(po => po.items.length > 0));

    // Snapshot items so the arrived container still displays after PO removal
    const snapshotted: ContainerItem[] = container.items.map(ci => ({
      ...ci,
      snapshot: ci.snapshot ?? (() => {
        const d = itemDisplay(ci);
        return d ? { ...d } : undefined;
      })(),
    }));

    // Move to arrived archive
    setArrivedContainers(prev => [{ ...container, status: 'arrived', arrivalDate, items: snapshotted, archivedAt: new Date().toISOString() }, ...prev]);
    setContainers(prev => prev.filter(c => c.id !== container.id));
    setConfirmArrival(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="מכולות פעילות" value={containers.length} />
        <StatCard label="עלות הובלה כוללת" value={`$${totalShipping.toLocaleString()}`} color="var(--accent)" />
        <StatCard label="סה״כ יחידות" value={totalUnits.toLocaleString()} />
        <StatCard label="עלות ליחידה (ממוצע)" value={totalUnits > 0 ? `$${(totalShipping / totalUnits).toFixed(2)}` : '—'} color="var(--status-ready)" />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">מכולות</h2>
        <Button onClick={() => setShowNew(true)}>
          <Plus size={16} className="inline ml-1" />
          מכולה חדשה
        </Button>
      </div>

      {showNew && (
        <NewContainerForm
          pos={pos}
          onSave={(c) => { setContainers(prev => [c, ...prev]); setShowNew(false); }}
          onCancel={() => setShowNew(false)}
        />
      )}

      <div className="space-y-4">
        {containers.map((container, idx) => {
          const unitCount = container.items.reduce((s, i) => s + i.quantity, 0);
          const costPerUnit = unitCount > 0 ? container.shippingCost / unitCount : 0;
          const containerCBM = container.items.reduce((s, i) => {
            const d = itemDisplay(i);
            return s + (d ? d.cbm * i.quantity : 0);
          }, 0);
          const ctype = container.containerType ?? '40HC';
          const cap = CONTAINER_VOLUMES[ctype].volume;
          const cbmPct = cap > 0 ? Math.min((containerCBM / cap) * 100, 100) : 0;

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
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-dim)' }}>
                      <Ship size={20} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <span className="font-bold font-mono text-sm">{container.containerNumber}</span>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{container.supplier}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={container.status} label={containerStatusLabels[container.status]} />
                    <div className="text-left">
                      <select
                        value={container.status}
                        onChange={(e) => {
                          const next = e.target.value as Container['status'];
                          if (next === 'arrived') {
                            setConfirmArrival(container);
                            return;
                          }
                          setContainers(prev => prev.map(c =>
                            c.id === container.id ? { ...c, status: next } : c
                          ));
                        }}
                        className="text-xs rounded-lg border px-2 py-1 outline-none"
                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        <option value="loading">בטעינה</option>
                        <option value="in-transit">בהפלגה</option>
                        <option value="arrived">הגיע (קליטה למלאי)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* CBM capacity bar */}
                <div className="mb-4 p-3 rounded-lg space-y-2" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>קיבולת {ctype} ({cap} CBM)</span>
                    <span className="font-mono font-bold" style={{ color: containerCBM > cap ? '#ef4444' : 'var(--text-primary)' }}>
                      {containerCBM.toFixed(2)} / {cap} CBM ({cbmPct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                    <div className="h-full" style={{ width: `${cbmPct}%`, background: containerCBM > cap ? '#ef4444' : cbmPct > 85 ? 'var(--status-warning)' : 'var(--status-received)' }} />
                  </div>
                </div>

                {/* Shipping cost info */}
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
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>יחידות במכולה</p>
                      <p className="text-sm font-bold font-mono">{unitCount.toLocaleString()}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>עלות ליחידה</p>
                    <p className="text-sm font-bold font-mono" style={{ color: 'var(--accent)' }}>${costPerUnit.toFixed(2)}</p>
                  </div>
                </div>

                {/* Items table */}
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <th className="text-right py-2 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>הזמנה</th>
                      <th className="text-right py-2 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>מק״ט</th>
                      <th className="text-right py-2 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>כמות</th>
                      <th className="text-right py-2 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>מחיר קנייה</th>
                      <th className="text-right py-2 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>עלות נחיתה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {container.items.map((ci, i) => {
                      const d = itemDisplay(ci);
                      const landedCost = d ? d.unitPrice + costPerUnit : 0;
                      return (
                        <tr key={i} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                          <td className="py-2 px-2 font-mono text-xs" style={{ color: 'var(--accent)' }}>{d?.poNumber ?? '—'}</td>
                          <td className="py-2 px-2 font-mono text-xs">{d?.sku ?? '—'}</td>
                          <td className="py-2 px-2 font-mono">{ci.quantity.toLocaleString()}</td>
                          <td className="py-2 px-2 font-mono">${d ? d.unitPrice.toFixed(2) : '—'}</td>
                          <td className="py-2 px-2 font-mono font-bold" style={{ color: 'var(--status-received)' }}>
                            ${landedCost.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>

                {(container.departureDate || container.arrivalDate) && (
                  <div className="mt-3 flex flex-wrap gap-4 pt-3 text-xs" style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    {container.departureDate && (
                      <span className="flex items-center gap-1.5">
                        <span style={{ color: 'var(--text-muted)' }}>יציאה:</span>
                        <span className="font-mono font-medium">{container.departureDate}</span>
                      </span>
                    )}
                    {container.arrivalDate && (
                      <span className="flex items-center gap-1.5">
                        <span style={{ color: 'var(--text-muted)' }}>הגעה משוערת:</span>
                        <span className="font-mono font-medium">{container.arrivalDate}</span>
                      </span>
                    )}
                    {container.departureDate && container.arrivalDate && (
                      <span className="flex items-center gap-1.5">
                        <span style={{ color: 'var(--text-muted)' }}>זמן הפלגה:</span>
                        <span className="font-mono font-medium" style={{ color: 'var(--accent)' }}>
                          {Math.floor((new Date(container.arrivalDate).getTime() - new Date(container.departureDate).getTime()) / 86400000)} ימים
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {confirmArrival && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmArrival(null)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border p-6 w-full max-w-md" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-bg)' }}>
                <Ship size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="text-lg font-bold">קליטת מכולה למלאי</h3>
            </div>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              מכולה <span className="font-mono font-bold">{confirmArrival.containerNumber}</span> ({confirmArrival.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()} יח׳).
            </p>
            <ul className="text-xs space-y-1 mb-4 list-disc list-inside" style={{ color: 'var(--text-muted)' }}>
              <li>יורד אקסל קליטה לקליטה ב-ERP</li>
              <li>הפריטים יוסרו מדף הזמנות הרכש (רק הכמות שבמכולה)</li>
              <li>המכולה תועבר ללשונית "מכולות שהגיעו"</li>
              <li>המלאי לא יתעדכן כאן — סנכרון יבוצע מה-ERP</li>
            </ul>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setConfirmArrival(null)}>ביטול</Button>
              <Button onClick={() => handleArrival(confirmArrival)}>אישור קליטה</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function NewContainerForm({ pos, onSave, onCancel }: {
  pos: PurchaseOrder[];
  onSave: (c: Container) => void;
  onCancel: () => void;
}) {
  const [containerNumber, setContainerNumber] = useState('');
  const [containerType, setContainerType] = useState<ContainerType>('40HC');
  const [supplier, setSupplier] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [departureDate, setDepartureDate] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ poId: string; lineItemId: string; quantity: number }[]>([]);

  const suppliers = [...new Set(pos.map(p => p.supplier))];
  const supplierPOs = pos.filter(p => p.supplier === supplier);

  // Compute total CBM
  const totalCBM = selectedItems.reduce((sum, si) => {
    const po = pos.find(p => p.id === si.poId);
    const item = po?.items.find(i => i.id === si.lineItemId);
    return sum + (item ? item.cbm * si.quantity : 0);
  }, 0);
  const capacity = CONTAINER_VOLUMES[containerType].volume;
  const usagePct = capacity > 0 ? (totalCBM / capacity) * 100 : 0;
  const overCapacity = totalCBM > capacity;
  const remaining = capacity - totalCBM;
  const recommendedType: ContainerType =
    totalCBM <= CONTAINER_VOLUMES['20FT'].volume ? '20FT'
    : totalCBM <= CONTAINER_VOLUMES['40FT'].volume ? '40FT'
    : '40HC';
  const barColor = overCapacity ? '#ef4444' : usagePct > 85 ? 'var(--status-warning)' : 'var(--status-received)';

  const addItem = (poId: string, lineItemId: string) => {
    if (selectedItems.find(i => i.lineItemId === lineItemId)) return;
    const po = pos.find(p => p.id === poId);
    const item = po?.items.find(i => i.id === lineItemId);
    if (item) {
      const available = item.statusBreakdown.ready;
      if (available > 0) {
        setSelectedItems(prev => [...prev, { poId, lineItemId, quantity: available }]);
      }
    }
  };

  return (
    <Card>
      <CardHeader title="מכולה חדשה" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <Input label="מספר מכולה" value={containerNumber} onChange={e => setContainerNumber(e.target.value)} placeholder="MSCU-XXXX" />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>ספק</label>
          <select
            value={supplier}
            onChange={e => { setSupplier(e.target.value); setSelectedItems([]); }}
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="">בחר ספק</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Input label="עלות הובלה ($)" type="number" value={shippingCost || ''} onChange={e => setShippingCost(parseFloat(e.target.value) || 0)} />
        <Input label="תאריך יציאה" type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} />
        <Input label="תאריך הגעה משוערת" type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} />
      </div>

      {/* Container type + CBM capacity */}
      <div className="p-4 rounded-xl border mb-4 space-y-3" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">סוג מכולה וקיבולת</span>
          <span className="text-xs font-mono" style={{ color: barColor }}>
            {totalCBM.toFixed(2)} / {capacity} CBM ({usagePct.toFixed(0)}%)
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['20FT', '40FT', '40HC'] as ContainerType[]).map(t => (
            <button key={t} type="button" onClick={() => setContainerType(t)}
              className="px-3 py-2 rounded-lg text-xs font-bold transition-[transform,background] hover:scale-105 relative"
              style={{
                background: containerType === t ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                border: `1px solid ${containerType === t ? 'var(--accent)' : 'var(--border-color)'}`,
                color: containerType === t ? 'var(--accent)' : 'var(--text-secondary)',
              }}>
              {t}
              <div className="text-[10px] font-normal opacity-70">{CONTAINER_VOLUMES[t].volume} CBM</div>
              {recommendedType === t && totalCBM > 0 && (
                <span className="absolute -top-1 -left-1 text-[9px] px-1 rounded-full font-bold" style={{ background: 'var(--status-received)', color: 'white' }}>מומלץ</span>
              )}
            </button>
          ))}
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          <div className="h-full transition-[width]" style={{ width: `${Math.min(usagePct, 100)}%`, background: barColor }} />
        </div>
        {overCapacity ? (
          <div className="text-xs p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
            ⚠ חריגה של {(totalCBM - capacity).toFixed(2)} CBM — נדרשות {Math.ceil(totalCBM / capacity)} מכולות מסוג {containerType}.
          </div>
        ) : (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            נשארו {remaining.toFixed(2)} CBM פנויים
          </div>
        )}
      </div>

      {supplier && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>פריטים זמינים (סטטוס: מוכן)</p>
          <div className="space-y-1">
            {supplierPOs.flatMap(po =>
              po.items
                .filter(item => item.statusBreakdown.ready > 0)
                .map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:opacity-80 transition-[opacity]"
                    style={{ background: 'var(--bg-tertiary)' }}
                    onClick={() => addItem(po.id, item.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{po.poNumber}</span>
                      <span className="text-sm">{item.sku}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.description}</span>
                    </div>
                    <span className="text-xs font-mono">{item.statusBreakdown.ready} מוכנים</span>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">פריטים במכולה:</p>
          {selectedItems.map((si, idx) => {
            const po = pos.find(p => p.id === si.poId);
            const item = po?.items.find(i => i.id === si.lineItemId);
            return (
              <div key={idx} className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono">{item?.sku}</span>
                <input
                  type="number"
                  value={si.quantity}
                  min={1}
                  onChange={e => {
                    const newItems = [...selectedItems];
                    newItems[idx] = { ...newItems[idx], quantity: parseInt(e.target.value) || 0 };
                    setSelectedItems(newItems);
                  }}
                  className="w-20 rounded-lg border px-2 py-1 text-sm text-center"
                  style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
                <button onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== idx))} className="text-red-400 text-xs">
                  הסר
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>ביטול</Button>
        <Button disabled={overCapacity} onClick={() => {
          onSave({
            id: uuid(),
            containerNumber: containerNumber || `CNT-${Date.now()}`,
            supplier,
            shippingCost,
            departureDate,
            arrivalDate,
            status: 'loading',
            containerType,
            items: selectedItems,
          });
        }}>{overCapacity ? 'מעל קיבולת' : 'שמור מכולה'}</Button>
      </div>
    </Card>
  );
}
