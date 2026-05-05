import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Ship, Package, DollarSign } from 'lucide-react';
import type { Container, PurchaseOrder } from '../types';
import { Card, CardHeader, StatCard, StatusBadge, Button, Input } from '../components/Card';
import { v4 as uuid } from 'uuid';

interface Props {
  containers: Container[];
  setContainers: React.Dispatch<React.SetStateAction<Container[]>>;
  pos: PurchaseOrder[];
}

export function ContainersTab({ containers, setContainers, pos }: Props) {
  const [showNew, setShowNew] = useState(false);

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
                          setContainers(prev => prev.map(c =>
                            c.id === container.id ? { ...c, status: e.target.value as Container['status'] } : c
                          ));
                        }}
                        className="text-xs rounded-lg border px-2 py-1 outline-none"
                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        <option value="loading">בטעינה</option>
                        <option value="in-transit">בהפלגה</option>
                        <option value="arrived">הגיע</option>
                      </select>
                    </div>
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
                      const { po, item } = getItemDetails(ci.poId, ci.lineItemId);
                      const landedCost = item ? item.unitPrice + costPerUnit : 0;
                      return (
                        <tr key={i} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                          <td className="py-2 px-2 font-mono text-xs" style={{ color: 'var(--accent)' }}>{po?.poNumber}</td>
                          <td className="py-2 px-2 font-mono text-xs">{item?.sku}</td>
                          <td className="py-2 px-2 font-mono">{ci.quantity.toLocaleString()}</td>
                          <td className="py-2 px-2 font-mono">${item?.unitPrice.toFixed(2)}</td>
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
    </div>
  );
}

function NewContainerForm({ pos, onSave, onCancel }: {
  pos: PurchaseOrder[];
  onSave: (c: Container) => void;
  onCancel: () => void;
}) {
  const [containerNumber, setContainerNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [departureDate, setDepartureDate] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ poId: string; lineItemId: string; quantity: number }[]>([]);

  const suppliers = [...new Set(pos.map(p => p.supplier))];
  const supplierPOs = pos.filter(p => p.supplier === supplier);

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
        <Button onClick={() => {
          onSave({
            id: uuid(),
            containerNumber: containerNumber || `CNT-${Date.now()}`,
            supplier,
            shippingCost,
            departureDate,
            arrivalDate,
            status: 'loading',
            items: selectedItems,
          });
        }}>שמור מכולה</Button>
      </div>
    </Card>
  );
}
