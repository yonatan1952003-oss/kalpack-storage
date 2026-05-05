import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, ChevronUp, ArrowLeftRight, Trash2, Filter, X, Download, Ship as ShipIcon, Edit3, CreditCard } from 'lucide-react';
import { STATUS_LABELS, STATUS_COLORS, STATUS_ORDER } from '../types';
import type { PurchaseOrder, POLineItem, Status, Filters, CatalogProduct } from '../types';
import { Card, StatCard, Button, Input, StatusBadge } from '../components/Card';
import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import { downloadExcel } from '../utils/excelExport';

interface Props {
  pos: PurchaseOrder[];
  setPos: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  onReceive: (sku: string, qty: number) => void;
  catalog: CatalogProduct[];
}

export function POTab({ pos, setPos, onReceive, catalog }: Props) {
  const [expandedPO, setExpandedPO] = useState<string | null>(pos[0]?.id || null);
  const [showNewPO, setShowNewPO] = useState(false);
  const [editingPO, setEditingPO] = useState<string | null>(null);
  const [splitModal, setSplitModal] = useState<{ poId: string; item: POLineItem } | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<{ poId: string; itemId: string }[]>([]);
  const [bulkTransitModal, setBulkTransitModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ supplier: '', color: '', category: '', status: '', search: '' });
  const [statusDetailModal, setStatusDetailModal] = useState<Status | null>(null);

  const allSuppliers = [...new Set(pos.map(p => p.supplier))];
  const allColors = [...new Set(pos.flatMap(p => p.items.map(i => i.color)).filter(Boolean))];
  const allCategories = [...new Set(pos.flatMap(p => p.items.map(i => i.category)).filter(Boolean))];

  const filteredPos = useMemo(() => {
    return pos.map(po => {
      if (filters.supplier && po.supplier !== filters.supplier) return null;
      const filteredItems = po.items.filter(item => {
        if (filters.color && item.color !== filters.color) return false;
        if (filters.category && item.category !== filters.category) return false;
        if (filters.status && item.statusBreakdown[filters.status] <= 0) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          if (!item.sku.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
        }
        return true;
      });
      if (filteredItems.length === 0) return null;
      return { ...po, items: filteredItems };
    }).filter(Boolean) as PurchaseOrder[];
  }, [pos, filters]);

  const stats = useMemo(() => {
    const all = pos.flatMap(po => po.items);
    return {
      totalOrders: pos.length, totalItems: all.length,
      totalValue: all.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
      production: all.reduce((s, i) => s + i.statusBreakdown.production, 0),
      ready: all.reduce((s, i) => s + i.statusBreakdown.ready, 0),
      transit: all.reduce((s, i) => s + i.statusBreakdown.transit, 0),
      received: all.reduce((s, i) => s + i.statusBreakdown.received, 0),
    };
  }, [pos]);

  const hasActiveFilters = filters.supplier || filters.color || filters.category || filters.status || filters.search;

  const handleBulkTransfer = (toStatus: Status, transitData?: { jobNumber: string; estimatedArrival: string; shippingCostPerUnit: number }) => {
    setPos(prev => prev.map(po => ({
      ...po,
      items: po.items.map(item => {
        const sel = bulkSelected.find(s => s.poId === po.id && s.itemId === item.id);
        if (!sel) return item;
        const newBreakdown = { ...item.statusBreakdown };
        const toIdx = STATUS_ORDER.indexOf(toStatus);
        for (let i = toIdx - 1; i >= 0; i--) {
          const fromSt = STATUS_ORDER[i];
          if (newBreakdown[fromSt] > 0) {
            const qty = newBreakdown[fromSt];
            newBreakdown[toStatus] += qty;
            newBreakdown[fromSt] = 0;
            if (toStatus === 'received') onReceive(item.sku, qty);
            break;
          }
        }
        return {
          ...item, statusBreakdown: newBreakdown,
          ...(toStatus === 'transit' && transitData ? {
            shippingCostPerUnit: transitData.shippingCostPerUnit,
            jobNumber: transitData.jobNumber,
            estimatedArrival: transitData.estimatedArrival,
          } : {}),
        };
      }),
    })));
    setBulkSelected([]); setBulkMode(false); setBulkTransitModal(false);
  };

  const exportReceivedToExcel = () => {
    const rows: Record<string, unknown>[] = [];
    for (const po of pos) {
      for (const item of po.items) {
        if (item.statusBreakdown.received > 0) {
          rows.push({
            'מספר הזמנה': po.poNumber, 'ספק': po.supplier, 'מק״ט': item.sku,
            'תיאור': item.description, 'צבע': item.color, 'קטגוריה': item.category,
            'CBM': item.cbm, 'כמות שנכנסה למלאי': item.statusBreakdown.received,
            'מחיר יחידה': item.unitPrice, 'עלות הובלה ליחידה': item.shippingCostPerUnit,
            'עלות נחיתה': item.unitPrice + item.shippingCostPerUnit,
            'סה״כ': item.statusBreakdown.received * (item.unitPrice + item.shippingCostPerUnit),
            'מקדמה ששולמה': item.prepaidAmount,
          });
        }
      }
    }
    if (rows.length === 0) {
      alert('אין פריטים בסטטוס "נכנס למלאי" לייצוא');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'קליטת מלאי');

    ws['!cols'] = Object.keys(rows[0]).map(key => ({ wch: Math.max(key.length, 14) }));
    downloadExcel(wb, `inventory_received_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="הזמנות" value={stats.totalOrders} sub={`${stats.totalItems} שורות`} />
        <StatCard label="שווי כולל" value={`$${stats.totalValue.toLocaleString()}`} color="var(--status-warning)" />
        {([
          { key: 'production' as const, color: STATUS_COLORS.production, label: 'בייצור' },
          { key: 'ready' as const, color: STATUS_COLORS.ready, label: 'מוכן' },
          { key: 'transit' as const, color: STATUS_COLORS.transit, label: 'בים' },
          { key: 'received' as const, color: STATUS_COLORS.received, label: 'נכנס למלאי' },
        ]).map(s => (
          <div key={s.key} className="cursor-pointer" onClick={() => setStatusDetailModal(s.key)}>
            <StatCard
              label={s.label}
              value={stats[s.key].toLocaleString()}
              color={s.color}
              sub="לחץ לפירוט →"
            />
          </div>
        ))}
        <StatCard label="CBM כולל" value={pos.flatMap(p => p.items).reduce((s, i) => s + i.cbm * i.quantity, 0).toFixed(1)} sub="מ״ק" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 px-6 py-4 rounded-2xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-xl font-bold">הזמנות רכש</h2>
        
        <Button onClick={() => setShowNewPO(true)} variant="success">
          <Plus size={16} className="inline ml-1" /> הזמנה חדשה
        </Button>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={14} className="inline ml-1" /> פילטר
          </Button>
          <Button variant="secondary" onClick={() => setBulkMode(!bulkMode)}>
            <ArrowLeftRight size={14} className="inline ml-1" /> העברה בבולק
          </Button>
          <Button variant="secondary" onClick={exportReceivedToExcel}>
            <Download size={14} className="inline ml-1" /> ייצוא לאקסל
          </Button>
        </div>
      </div>

      {/* Bulk bar */}
      {bulkMode && bulkSelected.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-2xl border" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
          <span className="text-sm font-bold">{bulkSelected.length} פריטים נבחרו</span>
          <div className="flex gap-2 mr-auto">
            {STATUS_ORDER.map(status => (
              <button key={status} onClick={() => status === 'transit' ? setBulkTransitModal(true) : handleBulkTransfer(status)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white hover:scale-105 transition-[transform]" style={{ background: STATUS_COLORS[status] }}>
                העבר ל{STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold">סינון</span>
                {hasActiveFilters && <button onClick={() => setFilters({ supplier: '', color: '', category: '', status: '', search: '' })} className="text-xs" style={{ color: 'var(--accent)' }}>נקה הכל</button>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <FilterSelect label="ספק" value={filters.supplier} options={allSuppliers} onChange={v => setFilters(f => ({ ...f, supplier: v }))} />
                <FilterSelect label="צבע" value={filters.color} options={allColors} onChange={v => setFilters(f => ({ ...f, color: v }))} />
                <FilterSelect label="קטגוריה" value={filters.category} options={allCategories} onChange={v => setFilters(f => ({ ...f, category: v }))} />
                <FilterSelect label="סטטוס" value={filters.status} options={STATUS_ORDER} labels={STATUS_LABELS} onChange={v => setFilters(f => ({ ...f, status: v as Status | '' }))} />
                <Input label="חיפוש" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="מק״ט / תיאור…" />
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New PO / Edit PO */}
      {(showNewPO || editingPO) && (
        <POForm
          catalog={catalog}
          allSuppliers={[...new Set([...allSuppliers, ...catalog.map(c => c.supplier)])]}
          editPO={editingPO ? pos.find(p => p.id === editingPO) : undefined}
          onSave={(po) => {
            if (editingPO) {
              setPos(prev => prev.map(p => p.id === po.id ? po : p));
              setEditingPO(null);
            } else {
              setPos(prev => [po, ...prev]);
              setShowNewPO(false);
            }
          }}
          onCancel={() => { setShowNewPO(false); setEditingPO(null); }}
        />
      )}

      {/* PO List — rich card layout with accent border */}
      <div className="flex flex-col gap-8">
        {filteredPos.map((po, idx) => {
          const poValue = po.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
          const poCBM = po.items.reduce((s, i) => s + i.cbm * i.quantity, 0);
          const isExpanded = expandedPO === po.id;
          return (
            <motion.div key={po.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
              <div
                className="rounded-2xl border overflow-hidden transition-[border-color,box-shadow]"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: isExpanded ? 'var(--accent)' : 'var(--border-color)',
                  borderRightWidth: '4px',
                  borderRightColor: 'var(--accent)',
                  boxShadow: isExpanded ? 'var(--card-shadow)' : 'none',
                }}
              >
                {/* PO Header — clickable, full-width summary */}
                <div
                  className="flex items-center justify-between px-8 py-6 cursor-pointer group transition-colors hover:bg-white/[0.02]"
                  onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                >
                  {/* Right side: PO info */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                      <span className="text-base font-bold" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--accent)' }}>{po.poNumber}</span>
                    </div>
                    <div className="h-5 w-px" style={{ background: 'var(--border-color)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{po.supplier}</span>
                    <span
                      className="text-xs px-2.5 py-1 rounded-lg"
                      style={{ background: 'rgba(100, 180, 255,0.08)', color: 'var(--text-muted)' }}
                    >
                      {po.date}
                    </span>
                  </div>

                  {/* Left side: summary stats */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>שווי:</span>
                      <span className="text-sm font-bold font-mono" style={{ color: 'var(--accent)' }}>${poValue.toLocaleString()}</span>
                    </div>
                    <div className="h-4 w-px" style={{ background: 'var(--border-color)' }} />
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>CBM:</span>
                      <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{poCBM.toFixed(2)}</span>
                    </div>
                    <div className="h-4 w-px" style={{ background: 'var(--border-color)' }} />
                    <span
                      className="text-xs font-medium px-3 py-1 rounded-full"
                      style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                    >
                      {po.items.length} פריטים
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); setEditingPO(po.id); setExpandedPO(null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-[transform,background] hover:scale-105"
                      style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
                      title="ערוך הזמנה">
                      <Edit3 size={14} />
                      <span className="text-xs font-medium">עריכה</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Items Table */}
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                    <div className="border-t overflow-x-auto" style={{ borderColor: 'var(--border-color)' }}>
                      <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                        <thead>
                          <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                            {bulkMode && <th className="py-3 px-4 w-10"></th>}
                            <th className="text-right py-3 px-4 font-medium text-[11px] uppercase tracking-wider w-[10%]">מק״ט</th>
                            <th className="text-right py-3 px-4 font-medium text-[11px] uppercase tracking-wider w-[22%]">תיאור</th>
                            <th className="text-right py-3 px-4 font-medium text-[11px] uppercase tracking-wider w-[8%]">צבע</th>
                            <th className="text-right py-3 px-4 font-medium text-[11px] uppercase tracking-wider w-[6%]">CBM</th>
                            <th className="text-right py-3 px-4 font-medium text-[11px] uppercase tracking-wider w-[7%]">כמות</th>
                            <th className="text-right py-3 px-4 font-medium text-[11px] uppercase tracking-wider w-[7%]">מחיר</th>
                            <th className="text-right py-3 px-4 font-medium text-[11px] uppercase tracking-wider w-[25%]">סטטוסים</th>
                            <th className="text-right py-3 px-4 w-[5%]"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {po.items.map(item => {
                            const isSelected = bulkSelected.some(s => s.poId === po.id && s.itemId === item.id);
                            return (
                              <tr key={item.id} className="border-b hover:bg-white/[0.02]" style={{ borderColor: 'var(--border-color)', background: isSelected ? 'var(--accent-bg)' : undefined }}>
                                {bulkMode && (
                                  <td className="py-4 px-4">
                                    <input type="checkbox" checked={isSelected} className="w-4 h-4" 
                                      onChange={() => setBulkSelected(prev => isSelected ? prev.filter(s => !(s.poId === po.id && s.itemId === item.id)) : [...prev, { poId: po.id, itemId: item.id }])} />
                                  </td>
                                )}
                                <td className="py-4 px-4 font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>{item.sku}</td>
                                <td className="py-4 px-4">
                                  <div className="font-medium">{item.description}</div>
                                  {item.technicalDetails && <div className="text-[10px] text-slate-500 mt-1">{item.technicalDetails}</div>}
                                </td>
                                <td className="py-4 px-4 text-xs opacity-80">{item.color}</td>
                                <td className="py-4 px-4 font-mono text-xs">{item.cbm}</td>
                                <td className="py-4 px-4 font-mono font-bold">{item.quantity.toLocaleString()}</td>
                                <td className="py-4 px-4 font-mono">${item.unitPrice.toFixed(2)}</td>
                                <td className="py-4 px-4"><StatusBar breakdown={item.statusBreakdown} total={item.quantity} /></td>
                                <td className="py-4 px-4">
                                  <button onClick={() => setSplitModal({ poId: po.id, item })} className="p-1.5 rounded-lg hover:bg-white/5 opacity-40 hover:opacity-100 transition-[opacity]">
                                    <ArrowLeftRight size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Footer summary */}
                      <div
                        className="flex items-center justify-between px-6 py-3 border-t"
                        style={{ borderColor: 'var(--border-color)', background: 'rgba(100, 180, 255,0.03)' }}
                      >
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {po.items.length} שורות · סה״כ {po.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()} יח׳
                        </span>
                        <span className="text-sm font-mono font-bold" style={{ color: 'var(--accent)' }}>
                          סה״כ: ${poValue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modals */}
      {splitModal && <SplitModal item={splitModal.item} onSave={(newBreakdown, transitData) => {
        const oldReceived = splitModal.item.statusBreakdown.received;
        setPos(prev => prev.map(po => po.id === splitModal.poId ? { ...po, items: po.items.map(i => i.id === splitModal.item.id ? { ...i, statusBreakdown: newBreakdown, ...(transitData || {}) } : i) } : po));
        if (newBreakdown.received > oldReceived) onReceive(splitModal.item.sku, newBreakdown.received - oldReceived);
        setSplitModal(null);
      }} onClose={() => setSplitModal(null)} />}

      {bulkTransitModal && <BulkTransitModal count={bulkSelected.length}
        onConfirm={(data) => handleBulkTransfer('transit', data)} onClose={() => setBulkTransitModal(false)} />}

      {statusDetailModal && <StatusDetailModal status={statusDetailModal} pos={pos} onClose={() => setStatusDetailModal(null)} />}
    </div>
  );
}

/* --- Helpers --- */
function FilterSelect({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
        <option value="">הכל</option>
        {options.map(o => <option key={o} value={o}>{labels?.[o] || o}</option>)}
      </select>
    </div>
  );
}

function StatusBar({ breakdown, total }: { breakdown: Record<Status, number>; total: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex rounded-full overflow-hidden h-1.5 w-full bg-slate-800">
        {STATUS_ORDER.map(status => {
          const pct = (breakdown[status] / total) * 100;
          if (pct <= 0) return null;
          return <div key={status} style={{ width: `${pct}%`, background: STATUS_COLORS[status] }} />;
        })}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_ORDER.map(status => breakdown[status] > 0 ? (
          <StatusBadge key={status} status={status} label={`${STATUS_LABELS[status]}: ${breakdown[status]}`} />
        ) : null)}
      </div>
    </div>
  );
}

function SplitModal({ item, onSave, onClose }: {
  item: POLineItem;
  onSave: (breakdown: Record<Status, number>, transitData?: Partial<POLineItem>) => void;
  onClose: () => void;
}) {
  const [breakdown, setBreakdown] = useState({ ...item.statusBreakdown });
  const [jobNumber, setJobNumber] = useState(item.jobNumber);
  const [estimatedArrival, setEstimatedArrival] = useState(item.estimatedArrival);
  const [shippingCost, setShippingCost] = useState(item.shippingCostPerUnit);
  const [prepaidAmount, setPrepaidAmount] = useState(item.prepaidAmount);
  const [prepaidNote, setPrepaidNote] = useState(item.prepaidNote);
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  const isValid = total === item.quantity;
  const transitIncreased = breakdown.transit > item.statusBreakdown.transit;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1">פיצול כמויות</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{item.sku} — {item.description} — סה״כ {item.quantity} יח׳</p>

        <div className="space-y-3">
          {STATUS_ORDER.map(status => (
            <div key={status} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: STATUS_COLORS[status] }} />
              <label className="text-sm flex-1">{STATUS_LABELS[status]}</label>
              <input type="number" min={0} max={item.quantity} value={breakdown[status]}
                onChange={e => setBreakdown(prev => ({ ...prev, [status]: Math.max(0, parseInt(e.target.value) || 0) }))}
                className="w-24 rounded-lg border px-3 py-1.5 text-sm text-center outline-none"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
            </div>
          ))}
        </div>

        {/* Transit details */}
        {transitIncreased && (
          <div className="mt-4 p-3 rounded-lg border space-y-3" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
            <div className="flex items-center gap-2"><ShipIcon size={14} style={{ color: 'var(--accent)' }} /><span className="text-sm font-bold">פרטי הפלגה</span></div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="מספר JOB" value={jobNumber} onChange={e => setJobNumber(e.target.value)} placeholder="JOB-XXX" />
              <Input label="צפי הגעה" type="date" value={estimatedArrival} onChange={e => setEstimatedArrival(e.target.value)} />
            </div>
            <Input label="עלות הובלה ליחידה ($)" type="number" step="0.01" value={shippingCost || ''} onChange={e => setShippingCost(parseFloat(e.target.value) || 0)} />
          </div>
        )}

        {/* Prepayment */}
        <div className="mt-4 p-3 rounded-lg border space-y-3" style={{ background: 'rgba(52, 211, 153, 0.05)', borderColor: 'rgba(52, 211, 153, 0.2)' }}>
          <div className="flex items-center gap-2"><CreditCard size={14} style={{ color: 'var(--status-received)' }} /><span className="text-sm font-bold">מקדמה</span></div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="סכום מקדמה ($)" type="number" step="0.01" value={prepaidAmount || ''} onChange={e => setPrepaidAmount(parseFloat(e.target.value) || 0)} />
            <Input label="הערה" value={prepaidNote} onChange={e => setPrepaidNote(e.target.value)} placeholder="העברה בנקאית…" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className={`text-sm font-mono font-bold ${isValid ? 'text-emerald-400' : 'text-red-400'}`}>{total} / {item.quantity}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>ביטול</Button>
            <Button disabled={!isValid} onClick={() => onSave(breakdown, {
              ...(transitIncreased ? { shippingCostPerUnit: shippingCost, jobNumber, estimatedArrival } : {}),
              prepaidAmount, prepaidNote,
            })}>שמור</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function BulkTransitModal({ count, onConfirm, onClose }: { count: number; onConfirm: (data: { jobNumber: string; estimatedArrival: string; shippingCostPerUnit: number }) => void; onClose: () => void }) {
  const [jobNumber, setJobNumber] = useState('');
  const [eta, setEta] = useState('');
  const [cost, setCost] = useState(0);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border p-6 w-full max-w-sm" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3"><ShipIcon size={20} style={{ color: 'var(--accent)' }} /><h3 className="text-lg font-bold">העברה לים — {count} פריטים</h3></div>
        <div className="space-y-3">
          <Input label="מספר JOB" value={jobNumber} onChange={e => setJobNumber(e.target.value)} placeholder="JOB-XXX" />
          <Input label="צפי הגעה לנמל" type="date" value={eta} onChange={e => setEta(e.target.value)} />
          <Input label="עלות הובלה ליחידה ($)" type="number" step="0.01" value={cost || ''} onChange={e => setCost(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>ביטול</Button>
          <Button onClick={() => onConfirm({ jobNumber, estimatedArrival: eta, shippingCostPerUnit: cost })}>העבר לים</Button>
        </div>
      </motion.div>
    </div>
  );
}

function StatusDetailModal({ status, pos, onClose }: { status: Status; pos: PurchaseOrder[]; onClose: () => void }) {
  const bySupplier: Record<string, { po: PurchaseOrder; item: POLineItem; qty: number }[]> = {};
  for (const po of pos) for (const item of po.items) {
    const qty = item.statusBreakdown[status];
    if (qty <= 0) continue;
    if (!bySupplier[po.supplier]) bySupplier[po.supplier] = [];
    bySupplier[po.supplier].push({ po, item, qty });
  }
  const totalQty = Object.values(bySupplier).flat().reduce((s, r) => s + r.qty, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full" style={{ background: STATUS_COLORS[status] }} />
            <h3 className="text-lg font-bold">פירוט: {STATUS_LABELS[status]}</h3>
            <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>({totalQty.toLocaleString()} יח׳)</span>
          </div>
          <button onClick={onClose} className="p-1"><X size={20} /></button>
        </div>
        {Object.entries(bySupplier).map(([supplier, rows]) => (
          <div key={supplier} className="mb-5">
            <h4 className="text-sm font-bold mb-2 pb-1 border-b" style={{ borderColor: 'var(--border-color)' }}>
              {supplier} <span className="font-normal text-xs mr-2" style={{ color: 'var(--text-muted)' }}>({rows.reduce((s, r) => s + r.qty, 0).toLocaleString()} יח׳)</span>
            </h4>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>
                <th className="text-right py-1 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>הזמנה</th>
                <th className="text-right py-1 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>מק״ט</th>
                <th className="text-right py-1 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>תיאור</th>
                <th className="text-right py-1 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>צבע</th>
                <th className="text-right py-1 px-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>כמות</th>
              </tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <td className="py-2 px-2 font-mono text-xs" style={{ color: 'var(--accent)' }}>{r.po.poNumber}</td>
                  <td className="py-2 px-2 font-mono text-xs font-bold">{r.item.sku}</td>
                  <td className="py-2 px-2 text-xs">{r.item.description}</td>
                  <td className="py-2 px-2 text-xs">{r.item.color}</td>
                  <td className="py-2 px-2 font-mono font-bold">{r.qty.toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
            </div>
          </div>
        ))}
        {Object.keys(bySupplier).length === 0 && <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>אין פריטים בסטטוס זה</p>}
      </motion.div>
    </div>
  );
}

/* --- PO Form (Create + Edit) --- */
function POForm({ catalog, allSuppliers, editPO, onSave, onCancel }: {
  catalog: CatalogProduct[];
  allSuppliers: string[];
  editPO?: PurchaseOrder;
  onSave: (po: PurchaseOrder) => void;
  onCancel: () => void;
}) {
  const [poNumber, setPoNumber] = useState(editPO?.poNumber || '');
  const [supplier, setSupplier] = useState(editPO?.supplier || '');
  const [customSupplier, setCustomSupplier] = useState('');
  const [notes, setNotes] = useState(editPO?.notes || '');

  type ItemDraft = {
    id: string; sku: string; description: string; color: string; category: string; cbm: number;
    technicalDetails: string; quantity: number; unitPrice: number;
    estimatedProductionDays: number; estimatedShippingDays: number;
    statusBreakdown: Record<Status, number>;
    shippingCostPerUnit: number; jobNumber: string; estimatedArrival: string;
    prepaidAmount: number; prepaidDate: string; prepaidNote: string;
  };

  const [items, setItems] = useState<ItemDraft[]>(
    editPO
      ? editPO.items.map(i => ({ ...i }))
      : [{ id: uuid(), sku: '', description: '', color: '', category: '', cbm: 0, technicalDetails: '', quantity: 0, unitPrice: 0, estimatedProductionDays: 30, estimatedShippingDays: 60, statusBreakdown: { production: 0, ready: 0, transit: 0, received: 0 }, shippingCostPerUnit: 0, jobNumber: '', estimatedArrival: '', prepaidAmount: 0, prepaidDate: '', prepaidNote: '' }]
  );

  const effectiveSupplier = supplier === '__custom__' ? customSupplier : supplier;
  const supplierProducts = catalog.filter(c => c.supplier === effectiveSupplier);

  const fillFromCatalog = (idx: number, sku: string) => {
    const cat = catalog.find(c => c.sku === sku);
    if (!cat) {
      updateItem(idx, 'sku', sku);
      return;
    }
    setItems(prev => {
      const n = [...prev];
      n[idx] = {
        ...n[idx],
        sku: cat.sku, description: cat.name, color: cat.color, category: cat.category,
        cbm: cat.cbm, technicalDetails: cat.technicalDetails, unitPrice: cat.unitPrice,
        estimatedProductionDays: cat.estimatedProductionDays, estimatedShippingDays: cat.estimatedShippingDays,
      };
      return n;
    });
  };

  const updateItem = (idx: number, field: string, value: unknown) => {
    setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n; });
  };

  const handleSave = () => {
    const po: PurchaseOrder = {
      id: editPO?.id || uuid(),
      poNumber: poNumber || `PO-${Date.now()}`,
      supplier: effectiveSupplier,
      date: editPO?.date || new Date().toISOString().split('T')[0],
      notes,
      items: items.filter(i => i.sku).map(i => ({
        ...i,
        currency: 'USD',
        createdAt: editPO ? i.id : new Date().toISOString().split('T')[0],
        statusTransitions: editPO ? (editPO.items.find(e => e.id === i.id)?.statusTransitions || []) : [],
        statusBreakdown: editPO
          ? i.statusBreakdown
          : { production: i.quantity, ready: 0, transit: 0, received: 0 },
        quantity: editPO ? i.quantity : i.quantity,
      })),
    };
    if (po.items.length > 0) onSave(po);
  };

  const inputHighlight = {
    background: 'var(--bg-primary)',
    borderColor: 'var(--accent)',
    color: 'var(--text-primary)',
    boxShadow: '0 0 0 3px var(--accent-bg)',
  };

  return (
    <div className="rounded-2xl border-2 overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--accent)', boxShadow: 'var(--card-shadow)' }}>
      {/* Form Header */}
      <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'var(--accent-bg)', borderBottom: '1px solid var(--accent)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <Edit3 size={16} color="white" />
          </div>
          <div>
            <h3 className="text-base font-bold">{editPO ? `עריכת הזמנה: ${editPO.poNumber}` : 'הזמנה חדשה'}</h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{editPO ? 'ערוך את פרטי ההזמנה וסטטוסים' : 'מלא את פרטי ההזמנה החדשה'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>ביטול</Button>
          <Button onClick={handleSave} style={{ background: 'var(--status-received)', boxShadow: '0 2px 8px rgba(52, 211, 153, 0.3)' }}>{editPO ? 'עדכן הזמנה' : 'שמור הזמנה'}</Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Section 1: Order Details */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full" style={{ background: 'var(--accent)' }} />
            <span className="text-sm font-bold">פרטי הזמנה</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-xl" style={{ background: 'rgba(100, 180, 255,0.04)', border: '1px solid var(--border-color)' }}>
            <Input label="מספר הזמנה" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="PO-2025-XXX" style={inputHighlight} />
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>ספק</label>
              <select value={supplier} onChange={e => setSupplier(e.target.value)}
                className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 transition-[border-color,box-shadow]"
                style={inputHighlight}>
                <option value="">בחר ספק</option>
                {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__custom__">+ ספק חדש</option>
              </select>
            </div>
            {supplier === '__custom__'
              ? <Input label="שם ספק" value={customSupplier} onChange={e => setCustomSupplier(e.target.value)} style={inputHighlight} />
              : <Input label="הערות" value={notes} onChange={e => setNotes(e.target.value)} style={inputHighlight} />
            }
          </div>
        </div>

        {/* Section 2: Catalog Quick-Add */}
        {effectiveSupplier && supplierProducts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full" style={{ background: 'var(--status-received)' }} />
              <span className="text-sm font-bold">הוספה מהירה מהקטלוג</span>
            </div>
            <div className="flex gap-2 flex-wrap p-4 rounded-xl" style={{ background: 'rgba(52, 211, 153, 0.04)', border: '1px solid rgba(52, 211, 153, 0.15)' }}>
              {supplierProducts.map(cat => (
                <button key={cat.id} onClick={() => {
                  const existing = items.findIndex(i => !i.sku);
                  if (existing >= 0) fillFromCatalog(existing, cat.sku);
                  else {
                    const newItem: ItemDraft = { id: uuid(), sku: cat.sku, description: cat.name, color: cat.color, category: cat.category, cbm: cat.cbm, technicalDetails: cat.technicalDetails, quantity: 0, unitPrice: cat.unitPrice, estimatedProductionDays: cat.estimatedProductionDays, estimatedShippingDays: cat.estimatedShippingDays, statusBreakdown: { production: 0, ready: 0, transit: 0, received: 0 }, shippingCostPerUnit: 0, jobNumber: '', estimatedArrival: '', prepaidAmount: 0, prepaidDate: '', prepaidNote: '' };
                    setItems(prev => [...prev, newItem]);
                  }
                }}
                  className="px-3 py-2 rounded-lg text-xs border transition-[transform,border-color] hover:scale-105 hover:border-emerald-500/50"
                  style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                  <span className="font-mono font-bold" style={{ color: 'var(--status-received)' }}>{cat.sku}</span>
                  <span className="mx-1">—</span>{cat.name}
                  {cat.color && <span className="mr-1 opacity-60">({cat.color})</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Line Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full" style={{ background: 'var(--status-warning)' }} />
              <span className="text-sm font-bold">שורות פריטים</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(251, 191, 36,0.15)', color: 'var(--status-warning)' }}>{items.filter(i => i.sku).length} פריטים</span>
            </div>
            <button onClick={() => setItems([...items, { id: uuid(), sku: '', description: '', color: '', category: '', cbm: 0, technicalDetails: '', quantity: 0, unitPrice: 0, estimatedProductionDays: 30, estimatedShippingDays: 60, statusBreakdown: { production: 0, ready: 0, transit: 0, received: 0 }, shippingCostPerUnit: 0, jobNumber: '', estimatedArrival: '', prepaidAmount: 0, prepaidDate: '', prepaidNote: '' }])}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-[transform] hover:scale-105"
              style={{ background: 'rgba(251, 191, 36,0.12)', color: 'var(--status-warning)', border: '1px solid rgba(251, 191, 36,0.25)' }}>
              <Plus size={12} />הוסף שורה
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.id} className="rounded-xl border-2 overflow-hidden" style={{ borderColor: item.sku ? 'rgba(251, 191, 36,0.2)' : 'var(--border-color)' }}>
                {/* Item header */}
                <div className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(251, 191, 36,0.06)' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--status-warning)' }}>
                    פריט #{idx + 1} {item.sku && `— ${item.sku}`}
                  </span>
                  {items.length > 1 && (
                    <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
                      <Trash2 size={12} />מחק
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-3" style={{ background: 'rgba(100, 180, 255,0.03)' }}>
                  {/* Row 1: Core fields */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>מק״ט</label>
                      <select value={item.sku} onChange={e => fillFromCatalog(idx, e.target.value)}
                        className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 transition-[border-color,box-shadow]"
                        style={inputHighlight}>
                        <option value="">בחר מק״ט</option>
                        {catalog.map(c => <option key={c.id} value={c.sku}>{c.sku} — {c.name}</option>)}
                        <option value="__manual__">הזנה ידנית</option>
                      </select>
                      {item.sku === '__manual__' && <input value="" onChange={e => updateItem(idx, 'sku', e.target.value)} placeholder="מק״ט חופשי"
                        className="rounded-xl border px-3 py-2 text-sm outline-none mt-1 focus:ring-2 focus:ring-emerald-500/30" style={inputHighlight} />}
                    </div>
                    <Input label="תיאור" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} style={inputHighlight} />
                    <Input label="צבע" value={item.color} onChange={e => updateItem(idx, 'color', e.target.value)} style={inputHighlight} />
                    <Input label="CBM" type="text" value={item.cbm.toString()} onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) updateItem(idx, 'cbm', v === '' ? 0 : parseFloat(v) || 0); }} placeholder="0" style={inputHighlight} />
                    <Input label="כמות" type="number" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                      style={{ ...inputHighlight, borderColor: 'rgba(52, 211, 153,0.5)', boxShadow: '0 0 0 1px rgba(52, 211, 153,0.2)' }} />
                    <Input label="מחיר יחידה ($)" type="number" step="0.01" value={item.unitPrice || ''} onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      style={{ ...inputHighlight, borderColor: 'rgba(52, 211, 153,0.5)', boxShadow: '0 0 0 1px rgba(52, 211, 153,0.2)' }} />
                  </div>

                  {/* Row 2: Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Input label="קטגוריה" value={item.category} onChange={e => updateItem(idx, 'category', e.target.value)} style={inputHighlight} />
                    <Input label="פרטים טכניים" value={item.technicalDetails} onChange={e => updateItem(idx, 'technicalDetails', e.target.value)} style={inputHighlight} />
                    <Input label="ימי ייצור" type="number" value={item.estimatedProductionDays || ''} onChange={e => updateItem(idx, 'estimatedProductionDays', parseInt(e.target.value) || 0)} style={inputHighlight} />
                    <Input label="ימי הפלגה" type="number" value={item.estimatedShippingDays || ''} onChange={e => updateItem(idx, 'estimatedShippingDays', parseInt(e.target.value) || 0)} style={inputHighlight} />
                  </div>

                  {/* Row 3: Status breakdown (edit mode only) */}
                  {editPO && (
                    <div className="p-3 rounded-lg" style={{ background: 'rgba(167, 139, 250,0.06)', border: '1px solid rgba(167, 139, 250,0.15)' }}>
                      <p className="text-[11px] font-bold mb-2" style={{ color: 'var(--status-production)' }}>פיצול סטטוסים</p>
                      <div className="grid grid-cols-4 gap-3">
                        {STATUS_ORDER.map(s => (
                          <div key={s} className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                              <label className="text-[11px] font-medium">{STATUS_LABELS[s]}</label>
                            </div>
                            <input type="number" min={0} value={item.statusBreakdown[s]}
                              onChange={e => {
                                const newBreakdown = { ...item.statusBreakdown, [s]: Math.max(0, parseInt(e.target.value) || 0) };
                                updateItem(idx, 'statusBreakdown', newBreakdown);
                              }}
                              className="w-full rounded-lg border px-3 py-2 text-sm text-center outline-none font-mono font-bold focus:ring-2 focus:ring-emerald-500/30"
                              style={{ background: 'var(--bg-primary)', borderColor: `${STATUS_COLORS[s]}50`, color: STATUS_COLORS[s] }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
