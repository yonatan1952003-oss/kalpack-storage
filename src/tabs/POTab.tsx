import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, ChevronUp, ArrowLeftRight, Trash2, Filter, X, Download, Upload, Ship as ShipIcon, Edit3, CreditCard, FileSpreadsheet } from 'lucide-react';
import { STATUS_LABELS, STATUS_COLORS, STATUS_ORDER } from '../types';
import type { PurchaseOrder, POLineItem, Status, Filters, CatalogProduct, Container, ContainerItem, ContainerType, Supplier } from '../types';
import { CONTAINER_VOLUMES } from '../types';
import { Card, StatCard, Button, Input, StatusBadge } from '../components/Card';
import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import { downloadExcel } from '../utils/excelExport';
import { insertInventoryFromCatalog } from '../lib/db';

interface Props {
  pos: PurchaseOrder[];
  setPos: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  onReceive: (sku: string, qty: number) => void;
  catalog: CatalogProduct[];
  suppliers?: Supplier[];
  setContainers?: React.Dispatch<React.SetStateAction<Container[]>>;
}

interface BulkSelected {
  poId: string;
  itemId: string;
  qty: number;
  fromStatus: Status;
}

export function POTab({ pos, setPos, onReceive, catalog, suppliers, setContainers }: Props) {
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(() => new Set(pos[0]?.id ? [pos[0].id] : []));
  const [showNewPO, setShowNewPO] = useState(false);
  const [editingPO, setEditingPO] = useState<string | null>(null);
  const [splitModal, setSplitModal] = useState<{ poId: string; item: POLineItem } | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<BulkSelected[]>([]);
  const [bulkTransitModal, setBulkTransitModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ supplier: '', color: '', category: '', status: '', search: '' });
  const [statusDetailModal, setStatusDetailModal] = useState<Status | null>(null);
  const [deleteConfirmPO, setDeleteConfirmPO] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [completedPOIds, setCompletedPOIds] = useState<string[]>([]);
  const prevPosRef = useRef<PurchaseOrder[]>(pos);

  // Detect POs that just transitioned to fully-received and surface a banner
  // recommending deletion since the order is complete.
  useEffect(() => {
    const newly: string[] = [];
    for (const po of pos) {
      const isComplete = po.items.length > 0 && po.items.every(i => i.statusBreakdown.received === i.quantity);
      const prev = prevPosRef.current.find(p => p.id === po.id);
      const wasComplete = prev && prev.items.length > 0 && prev.items.every(i => i.statusBreakdown.received === i.quantity);
      if (isComplete && !wasComplete && !completedPOIds.includes(po.id)) newly.push(po.id);
    }
    if (newly.length > 0) setCompletedPOIds(prev => [...prev, ...newly]);
    prevPosRef.current = pos;
  }, [pos, completedPOIds]);

  const togglePO = (id: string) => {
    setExpandedPOs(prev => {
      const next = new Set(prev);
      if (bulkMode) {
        // In bulk mode, allow multiple POs open simultaneously
        if (next.has(id)) next.delete(id); else next.add(id);
      } else {
        // Normal mode: single open
        if (next.has(id)) { next.clear(); } else { next.clear(); next.add(id); }
      }
      return next;
    });
  };

  // Merge supplier names from existing POs, the catalog, and the user's
// Suppliers tab so the dropdown shows everyone they've defined.
const allSuppliers = [...new Set([
  ...pos.map(p => p.supplier),
  ...catalog.map(c => c.supplier),
  ...(suppliers ?? []).map(s => s.name),
].filter(Boolean))];
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

  const handleBulkTransfer = (toStatus: Status, transitData?: { containerNumber: string; containerType: ContainerType; jobNumber: string; estimatedArrival: string; departureDate: string; shippingCostPerUnit: number }) => {
    // Build container snapshot items if moving to transit
    const containerItems: ContainerItem[] = [];
    let primarySupplier = '';

    setPos(prev => prev.map(po => ({
      ...po,
      items: po.items.map(item => {
        const sel = bulkSelected.find(s => s.poId === po.id && s.itemId === item.id);
        if (!sel) return item;
        const moveQty = Math.min(sel.qty, item.statusBreakdown[sel.fromStatus]);
        if (moveQty <= 0) return item;
        const newBreakdown = { ...item.statusBreakdown };
        newBreakdown[sel.fromStatus] -= moveQty;
        newBreakdown[toStatus] += moveQty;
        if (toStatus === 'received') onReceive(item.sku, moveQty);
        if (toStatus === 'transit' && transitData) {
          if (!primarySupplier) primarySupplier = po.supplier;
          containerItems.push({
            poId: po.id,
            lineItemId: item.id,
            quantity: moveQty,
            snapshot: {
              poNumber: po.poNumber,
              supplier: po.supplier,
              sku: item.sku,
              description: item.description,
              color: item.color,
              category: item.category,
              cbm: item.cbm,
              unitPrice: item.unitPrice,
              currency: item.currency,
              shippingCostPerUnit: transitData.shippingCostPerUnit,
            },
          });
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

    // Auto-create container when bulk-transferring to transit
    if (toStatus === 'transit' && transitData && containerItems.length > 0 && setContainers) {
      const totalQty = containerItems.reduce((s, i) => s + i.quantity, 0);
      const newContainer: Container = {
        id: uuid(),
        containerNumber: transitData.containerNumber || `CNT-${Date.now()}`,
        supplier: primarySupplier,
        shippingCost: transitData.shippingCostPerUnit * totalQty,
        departureDate: transitData.departureDate,
        arrivalDate: transitData.estimatedArrival,
        status: 'in-transit',
        containerType: transitData.containerType,
        items: containerItems,
      };
      setContainers(prev => [newContainer, ...prev]);
    }

    setBulkSelected([]); setBulkMode(false); setBulkTransitModal(false);
  };

  const handleDeletePO = (poId: string) => {
    setPos(prev => prev.filter(p => p.id !== poId));
    setExpandedPOs(prev => { const next = new Set(prev); next.delete(poId); return next; });
    setBulkSelected(prev => prev.filter(s => s.poId !== poId));
    setDeleteConfirmPO(null);
  };

  const exportPOToExcel = (po: PurchaseOrder) => {
    const rows = po.items.map(item => ({
      'מק״ט': item.sku,
      'תיאור': item.description,
      'צבע': item.color,
      'קטגוריה': item.category,
      'CBM': item.cbm,
      'כמות': item.quantity,
      'מחיר יחידה': item.unitPrice,
      'מטבע': item.currency,
      'סה״כ שורה': item.quantity * item.unitPrice,
      'בייצור': item.statusBreakdown.production,
      'מוכן': item.statusBreakdown.ready,
      'בים': item.statusBreakdown.transit,
      'נכנס למלאי': item.statusBreakdown.received,
      'מספר JOB': item.jobNumber,
      'צפי הגעה': item.estimatedArrival,
      'מקדמה ($)': item.prepaidAmount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
    // Header sheet with PO meta
    const meta = [
      ['מספר הזמנה', po.poNumber],
      ['ספק', po.supplier],
      ['תאריך הזמנה', po.date],
      ['תאריך ביצוע', po.executionDate || '—'],
      ['הערות', po.notes],
      ['סה״כ שווי', po.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)],
    ];
    const metaWs = XLSX.utils.aoa_to_sheet(meta);
    metaWs['!cols'] = [{ wch: 20 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, metaWs, 'פרטי הזמנה');
    XLSX.utils.book_append_sheet(wb, ws, 'פריטים');
    downloadExcel(wb, `${po.poNumber}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
          <Button variant="secondary" onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setBulkSelected([]); }}>
            <ArrowLeftRight size={14} className="inline ml-1" /> {bulkMode ? 'סיים בולק' : 'העברה בבולק'}
          </Button>
          <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
            <Upload size={14} className="inline ml-1" /> ייבוא PO מאקסל
          </Button>
          <Button variant="secondary" onClick={exportReceivedToExcel}>
            <Download size={14} className="inline ml-1" /> יצוא קליטה
          </Button>
        </div>
      </div>

      {/* Bulk bar */}
      {bulkMode && bulkSelected.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">{bulkSelected.length} פריטים נבחרו · סה״כ {bulkSelected.reduce((s, x) => s + x.qty, 0).toLocaleString()} יח׳</span>
            <button onClick={() => setBulkSelected([])} className="text-xs underline mr-auto" style={{ color: 'var(--text-muted)' }}>נקה הכל</button>
            <div className="flex gap-2">
              {STATUS_ORDER.map(status => (
                <button key={status} onClick={() => status === 'transit' ? setBulkTransitModal(true) : handleBulkTransfer(status)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white hover:scale-105 transition-[transform]" style={{ background: STATUS_COLORS[status] }}>
                  העבר ל{STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
          {/* Per-item rows: editable qty + from-status */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {bulkSelected.map((sel, idx) => {
              const po = pos.find(p => p.id === sel.poId);
              const item = po?.items.find(i => i.id === sel.itemId);
              if (!po || !item) return null;
              const availableStatuses = STATUS_ORDER.filter(s => item.statusBreakdown[s] > 0);
              const max = item.statusBreakdown[sel.fromStatus] || 0;
              return (
                <div key={`${sel.poId}-${sel.itemId}`} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <span className="font-mono" style={{ color: 'var(--accent)' }}>{po.poNumber}</span>
                  <span className="font-mono font-bold">{item.sku}</span>
                  <span className="opacity-70 truncate flex-1">{item.description}</span>
                  <label className="opacity-70">מ:</label>
                  <select value={sel.fromStatus} onChange={e => {
                    const fs = e.target.value as Status;
                    setBulkSelected(prev => prev.map((s, i) => i === idx ? { ...s, fromStatus: fs, qty: Math.min(s.qty, item.statusBreakdown[fs]) } : s));
                  }} className="rounded-md px-2 py-1 text-xs border outline-none" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                    {availableStatuses.map(s => <option key={s} value={s}>{STATUS_LABELS[s]} ({item.statusBreakdown[s]})</option>)}
                  </select>
                  <label className="opacity-70">כמות:</label>
                  <input type="number" min={1} max={max} value={sel.qty} onChange={e => {
                    const v = Math.max(1, Math.min(max, parseInt(e.target.value) || 0));
                    setBulkSelected(prev => prev.map((s, i) => i === idx ? { ...s, qty: v } : s));
                  }} className="w-20 rounded-md px-2 py-1 text-xs text-center font-mono border outline-none" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  <button onClick={() => setBulkSelected(prev => prev.filter((_, i) => i !== idx))} className="opacity-50 hover:opacity-100">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Completion banner — POs that just became 100% received */}
      <AnimatePresence>
        {completedPOIds.map(poId => {
          const po = pos.find(p => p.id === poId);
          if (!po) return null;
          return (
            <motion.div key={poId}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 p-4 rounded-2xl border"
              style={{ background: 'rgba(52, 211, 153, 0.08)', borderColor: 'rgba(52, 211, 153, 0.4)' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(52, 211, 153, 0.18)' }}>
                <span style={{ color: 'var(--status-received)', fontSize: 20 }}>✓</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: 'var(--status-received)' }}>
                  הזמנה {po.poNumber} הסתיימה — כל הכמות נכנסה למלאי
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  מומלץ למחוק את ההזמנה — המלאי כבר אצלנו וירשם דרך ה-ERP.
                </p>
              </div>
              <button onClick={() => setCompletedPOIds(prev => prev.filter(id => id !== poId))}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                התעלם
              </button>
              <button onClick={() => { setCompletedPOIds(prev => prev.filter(id => id !== poId)); setDeleteConfirmPO(poId); }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white"
                style={{ background: '#ef4444' }}>
                מחק הזמנה
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

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
          allSuppliers={allSuppliers}
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
          const isExpanded = expandedPOs.has(po.id);
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
                  onClick={() => togglePO(po.id)}
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
                    {po.executionDate && (
                      <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                        ביצוע: {po.executionDate}
                      </span>
                    )}
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
                    <button onClick={(e) => { e.stopPropagation(); setEditingPO(po.id); setExpandedPOs(new Set()); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-[transform,background] hover:scale-105"
                      style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
                      title="ערוך הזמנה">
                      <Edit3 size={14} />
                      <span className="text-xs font-medium">עריכה</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); exportPOToExcel(po); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-[transform,background] hover:scale-105"
                      style={{ background: 'rgba(52, 211, 153, 0.1)', color: 'var(--status-received)', border: '1px solid rgba(52, 211, 153, 0.3)' }}
                      title="ייצוא הזמנה לאקסל">
                      <FileSpreadsheet size={14} />
                      <span className="text-xs font-medium">אקסל</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmPO(po.id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-[transform,background] hover:scale-105"
                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                      title="מחק הזמנה">
                      <Trash2 size={14} />
                      <span className="text-xs font-medium">מחק</span>
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
                                      onChange={() => setBulkSelected(prev => {
                                        if (isSelected) return prev.filter(s => !(s.poId === po.id && s.itemId === item.id));
                                        const earliest = STATUS_ORDER.find(s => item.statusBreakdown[s] > 0) || 'production';
                                        return [...prev, { poId: po.id, itemId: item.id, fromStatus: earliest, qty: item.statusBreakdown[earliest] }];
                                      })} />
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

      {bulkTransitModal && <BulkTransitModal
        bulkSelected={bulkSelected}
        pos={pos}
        onConfirm={(data) => handleBulkTransfer('transit', data)}
        onClose={() => setBulkTransitModal(false)} />}

      {statusDetailModal && <StatusDetailModal status={statusDetailModal} pos={pos} onClose={() => setStatusDetailModal(null)} />}

      {deleteConfirmPO && (() => {
        const po = pos.find(p => p.id === deleteConfirmPO);
        if (!po) return null;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmPO(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="rounded-2xl border p-6 w-full max-w-md" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}><Trash2 size={20} style={{ color: '#ef4444' }} /></div>
                <h3 className="text-lg font-bold">מחיקת הזמנת רכש</h3>
              </div>
              <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                הפעולה תמחק את ההזמנה <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{po.poNumber}</span> ({po.items.length} פריטים) לצמיתות.
              </p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>לא ניתן לבטל. מכולות שכבר נוצרו מההזמנה לא יושפעו.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setDeleteConfirmPO(null)}>ביטול</Button>
                <button onClick={() => handleDeletePO(po.id)} className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: '#ef4444' }}>מחק לצמיתות</button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {importModalOpen && (
        <ImportExcelModal
          catalog={catalog}
          existingSuppliers={allSuppliers}
          onClose={() => setImportModalOpen(false)}
          onImport={(newPO) => {
            setPos(prev => [newPO, ...prev]);
            setImportModalOpen(false);
          }}
        />
      )}

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} />
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
  const safeTotal = total > 0 ? total : Math.max(1, Object.values(breakdown).reduce((s, v) => s + v, 0));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex rounded-full overflow-hidden h-2.5 w-full" style={{ background: 'var(--bg-tertiary)' }}>
        {STATUS_ORDER.map(status => {
          const pct = (breakdown[status] / safeTotal) * 100;
          if (pct <= 0) return null;
          return <div key={status} className="h-full" style={{ width: `${pct}%`, background: STATUS_COLORS[status] }} />;
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

function BulkTransitModal({ bulkSelected, pos, onConfirm, onClose }: {
  bulkSelected: BulkSelected[];
  pos: PurchaseOrder[];
  onConfirm: (data: { containerNumber: string; containerType: ContainerType; jobNumber: string; estimatedArrival: string; departureDate: string; shippingCostPerUnit: number }) => void;
  onClose: () => void;
}) {
  const [containerNumber, setContainerNumber] = useState('');
  const [containerType, setContainerType] = useState<ContainerType>('40HC');
  const [jobNumber, setJobNumber] = useState('');
  const [eta, setEta] = useState('');
  const [departureDate, setDepartureDate] = useState(new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState(0);

  // Compute total CBM of selected items
  const totalCBM = useMemo(() => {
    return bulkSelected.reduce((sum, sel) => {
      const po = pos.find(p => p.id === sel.poId);
      const item = po?.items.find(i => i.id === sel.itemId);
      return sum + (item ? item.cbm * sel.qty : 0);
    }, 0);
  }, [bulkSelected, pos]);

  const capacity = CONTAINER_VOLUMES[containerType].volume;
  const usagePct = capacity > 0 ? (totalCBM / capacity) * 100 : 0;
  const overCapacity = totalCBM > capacity;
  const remaining = capacity - totalCBM;
  // Auto-suggest # of containers if overCapacity
  const suggestedContainers = overCapacity ? Math.ceil(totalCBM / capacity) : 1;
  const recommendedType: ContainerType =
    totalCBM <= CONTAINER_VOLUMES['20FT'].volume ? '20FT'
    : totalCBM <= CONTAINER_VOLUMES['40FT'].volume ? '40FT'
    : '40HC';

  const barColor = overCapacity ? '#ef4444' : usagePct > 85 ? 'var(--status-warning)' : 'var(--status-received)';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1"><ShipIcon size={20} style={{ color: 'var(--accent)' }} /><h3 className="text-lg font-bold">העברה לים — {bulkSelected.length} פריטים</h3></div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>תיווצר מכולה חדשה אוטומטית בלשונית "מכולות".</p>

        {/* CBM Capacity Panel */}
        <div className="p-4 rounded-xl border mb-4 space-y-3" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">קיבולת מכולה</span>
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
          {/* Capacity bar */}
          <div className="h-3 rounded-full overflow-hidden relative" style={{ background: 'var(--bg-primary)' }}>
            <div className="h-full transition-[width]" style={{ width: `${Math.min(usagePct, 100)}%`, background: barColor }} />
            {overCapacity && (
              <div className="absolute top-0 right-0 h-full w-1" style={{ background: '#ef4444' }} />
            )}
          </div>
          {overCapacity ? (
            <div className="text-xs p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
              ⚠ חריגה של {(totalCBM - capacity).toFixed(2)} CBM. נדרשות {suggestedContainers} מכולות מסוג {containerType} (או {recommendedType === containerType ? 'גודל גדול יותר' : `${recommendedType} בודדת`}).
            </div>
          ) : (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              נשארו {remaining.toFixed(2)} CBM פנויים במכולה
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Input label="מספר מכולה" value={containerNumber} onChange={e => setContainerNumber(e.target.value)} placeholder="MSCU-XXXXX" />
          <Input label="מספר JOB" value={jobNumber} onChange={e => setJobNumber(e.target.value)} placeholder="JOB-XXX" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="תאריך יציאה" type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} />
            <Input label="צפי הגעה לנמל" type="date" value={eta} onChange={e => setEta(e.target.value)} />
          </div>
          <Input label="עלות הובלה ליחידה ($)" type="number" step="0.01" value={cost || ''} onChange={e => setCost(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>ביטול</Button>
          <Button
            disabled={overCapacity}
            onClick={() => onConfirm({ containerNumber, containerType, jobNumber, estimatedArrival: eta, departureDate, shippingCostPerUnit: cost })}>
            {overCapacity ? 'מעל קיבולת — בחר מכולה גדולה יותר' : 'העבר לים + צור מכולה'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* --- Import PO from Excel --- */
interface ImportRow {
  sku: string;
  quantity: number;
  cbm: number;
  unitPrice: number;
  __new?: boolean; // SKU not in catalog
}

function ImportExcelModal({ catalog, existingSuppliers, onClose, onImport }: {
  catalog: CatalogProduct[];
  existingSuppliers: string[];
  onClose: () => void;
  onImport: (po: PurchaseOrder) => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [poNumber, setPoNumber] = useState(`PO-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`);
  const [supplier, setSupplier] = useState('');
  const [customSupplier, setCustomSupplier] = useState('');
  const [executionDate, setExecutionDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const downloadTemplate = () => {
    const sample = [
      { SKU: 'LED-5050-WW',   Quantity: 5000, CBM: 0.02,  'Unit Price': 2.40 },
      { SKU: 'LED-2835-CW',   Quantity: 3000, CBM: 0.015, 'Unit Price': 1.80 },
      { SKU: 'NEW-SKU-EX-01', Quantity: 1000, CBM: 0.01,  'Unit Price': 4.50 },
    ];
    const ws = XLSX.utils.json_to_sheet(sample, { header: ['SKU', 'Quantity', 'CBM', 'Unit Price'] });
    ws['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PO Items');
    downloadExcel(wb, 'PO_Import_Template.xlsx');
  };

  const handleFile = async (file: File) => {
    setError('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
      if (data.length === 0) { setError('הקובץ ריק'); return; }
      // Flexible column matching: SKU/מקט, Quantity/כמות, CBM, Price/מחיר
      const parsed: ImportRow[] = data.map(r => {
        const sku = String(r['SKU'] ?? r['sku'] ?? r['מקט'] ?? r['מק״ט'] ?? r['מק"ט'] ?? '').trim();
        const quantity = Number(r['Quantity'] ?? r['quantity'] ?? r['כמות'] ?? 0);
        const cbm = Number(r['CBM'] ?? r['cbm'] ?? 0);
        const unitPrice = Number(r['Unit Price'] ?? r['UnitPrice'] ?? r['unitPrice'] ?? r['מחיר'] ?? r['מחיר ליחידה'] ?? r['Price'] ?? 0);
        return { sku, quantity, cbm, unitPrice, __new: !catalog.find(c => c.sku === sku) };
      }).filter(r => r.sku);
      if (parsed.length === 0) { setError('לא נמצאו שורות תקינות. ודא שיש עמודות SKU/Quantity/CBM/Unit Price'); return; }
      setRows(parsed);
    } catch (e) {
      setError(`שגיאה בקריאת הקובץ: ${(e as Error).message}`);
    }
  };

  const effectiveSupplier = supplier === '__custom__' ? customSupplier : supplier;
  const canSubmit = rows.length > 0 && poNumber && effectiveSupplier;
  const newSkuCount = rows.filter(r => r.__new).length;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSyncing(true);
    // For new SKUs, push to Supabase inventory table (realtime subscription will pick up)
    for (const r of rows) {
      if (r.__new) {
        try {
          await insertInventoryFromCatalog({
            id: '', sku: r.sku, name: r.sku, color: '', category: '',
            cbm: r.cbm, technicalDetails: '', supplier: effectiveSupplier,
            unitPrice: r.unitPrice, currency: 'USD',
            estimatedProductionDays: 30, estimatedShippingDays: 60, quantity: 0,
          });
        } catch (e) {
          console.error('Failed to sync new SKU to Supabase:', r.sku, e);
        }
      }
    }
    setSyncing(false);
    const today = new Date().toISOString().slice(0, 10);
    const newPO: PurchaseOrder = {
      id: uuid(), poNumber, supplier: effectiveSupplier, date: today, executionDate, notes: 'יובא מאקסל',
      items: rows.map(r => {
        const cat = catalog.find(c => c.sku === r.sku);
        return {
          id: uuid(),
          sku: r.sku,
          description: cat?.name || r.sku,
          color: cat?.color || '',
          category: cat?.category || '',
          cbm: r.cbm,
          technicalDetails: cat?.technicalDetails || '',
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          currency: 'USD',
          statusBreakdown: { production: r.quantity, ready: 0, transit: 0, received: 0 },
          createdAt: today,
          statusTransitions: [],
          estimatedProductionDays: cat?.estimatedProductionDays || 30,
          estimatedShippingDays: cat?.estimatedShippingDays || 60,
          shippingCostPerUnit: 0,
          jobNumber: '',
          estimatedArrival: '',
          prepaidAmount: 0, prepaidDate: '', prepaidNote: '',
        };
      }),
    };
    onImport(newPO);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-bg)' }}><Upload size={20} style={{ color: 'var(--accent)' }} /></div>
          <h3 className="text-lg font-bold">ייבוא הזמנת רכש מאקסל</h3>
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>עמודות נדרשות: <span className="font-mono">SKU / Quantity / CBM / Unit Price</span> (גם בעברית: מקט / כמות / CBM / מחיר)</p>
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-[transform,background] hover:scale-105 flex-shrink-0"
            style={{ background: 'rgba(52, 211, 153, 0.1)', color: 'var(--status-received)', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
            <Download size={12} />
            הורד תבנית
          </button>
        </div>

        {/* Step 1: file upload */}
        {rows.length === 0 && (
          <div className="space-y-3">
            <label className="block">
              <input type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <div className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-white/[0.02] transition-colors"
                style={{ borderColor: 'var(--border-strong)' }}>
                <Upload size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-bold">לחץ לבחירת קובץ אקסל</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>.xlsx או .xls</p>
              </div>
            </label>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )}

        {/* Step 2: preview + assign PO */}
        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <Input label="מספר הזמנה" value={poNumber} onChange={e => setPoNumber(e.target.value)} />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>ספק</label>
                <select value={supplier} onChange={e => setSupplier(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  <option value="">בחר ספק</option>
                  {existingSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="__custom__">+ ספק חדש</option>
                </select>
              </div>
              {supplier === '__custom__' && (
                <Input label="שם ספק חדש" value={customSupplier} onChange={e => setCustomSupplier(e.target.value)} />
              )}
              <Input label="תאריך ביצוע" type="date" value={executionDate} onChange={e => setExecutionDate(e.target.value)} />
            </div>
            <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: 'var(--border-color)' }}>
              <div className="px-4 py-2 text-xs font-bold flex items-center justify-between" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                <span>תצוגה מקדימה — {rows.length} שורות</span>
                {newSkuCount > 0 && <span style={{ color: 'var(--status-warning)' }}>{newSkuCount} מק״טים חדשים יוקמו בקטלוג + סופהבייס</span>}
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ background: 'var(--bg-tertiary)' }}>
                    <tr>
                      <th className="text-right px-3 py-2 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>מק״ט</th>
                      <th className="text-right px-3 py-2 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>כמות</th>
                      <th className="text-right px-3 py-2 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>CBM</th>
                      <th className="text-right px-3 py-2 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>מחיר</th>
                      <th className="text-right px-3 py-2 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="px-3 py-1.5 font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>{r.sku}</td>
                        <td className="px-3 py-1.5 font-mono">{r.quantity.toLocaleString()}</td>
                        <td className="px-3 py-1.5 font-mono">{r.cbm}</td>
                        <td className="px-3 py-1.5 font-mono">${r.unitPrice}</td>
                        <td className="px-3 py-1.5 text-xs">
                          {r.__new
                            ? <span style={{ color: 'var(--status-warning)' }}>חדש</span>
                            : <span style={{ color: 'var(--status-received)' }}>קיים</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex gap-2 justify-between items-center">
              <button onClick={() => setRows([])} className="text-xs underline" style={{ color: 'var(--text-muted)' }}>טען קובץ אחר</button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose} disabled={syncing}>ביטול</Button>
                <Button onClick={handleSubmit} disabled={!canSubmit || syncing}>
                  {syncing ? 'מסנכרן...' : 'צור הזמנה'}
                </Button>
              </div>
            </div>
          </>
        )}
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

/* --- SKU Autocomplete (type-to-search) --- */
function SkuAutocomplete({ value, catalog, onSelect, style }: {
  value: string;
  catalog: CatalogProduct[];
  onSelect: (sku: string, fromCatalog: boolean) => void;
  style?: React.CSSProperties;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sync external value -> input when parent updates (e.g. fillFromCatalog)
  const lastValueRef = useRef(value);
  if (value !== lastValueRef.current) {
    lastValueRef.current = value;
    if (value !== query) setQuery(value);
  }

  const suggestions = useMemo(() => {
    if (!query.trim()) return catalog.slice(0, 50);
    const q = query.toLowerCase();
    return catalog.filter(c =>
      c.sku.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query, catalog]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const commitChoice = (sku: string, fromCatalog: boolean) => {
    setQuery(sku);
    onSelect(sku, fromCatalog);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); return; }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = suggestions[activeIdx];
      if (pick) commitChoice(pick.sku, true);
      else commitChoice(query, false);
    }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="flex flex-col gap-1.5 relative" ref={wrapRef}>
      <label className="text-[11px] font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>מק״ט</label>
      <input
        type="text"
        value={query}
        placeholder="הקלד או חפש..."
        onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setTimeout(() => onSelect(query, false), 100); }}
        onKeyDown={onKeyDown}
        className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 transition-[border-color,box-shadow]"
        style={style}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 right-0 left-0 z-50 rounded-xl border overflow-hidden overflow-y-auto"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-strong)', boxShadow: 'var(--card-shadow)', maxHeight: 'min(60vh, 480px)' }}>
          {suggestions.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commitChoice(c.sku, true); }}
              onMouseEnter={() => setActiveIdx(i)}
              className="w-full text-right px-3 py-2 flex items-center justify-between gap-2 transition-colors"
              style={{ background: i === activeIdx ? 'var(--accent-bg)' : 'transparent' }}
            >
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>{c.sku}</span>
              <span className="text-xs flex-1 text-right truncate" style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
              {c.color && <span className="text-[10px] opacity-60">{c.color}</span>}
            </button>
          ))}
        </div>
      )}
      {open && suggestions.length === 0 && query.trim() && (
        <div className="absolute top-full mt-1 right-0 left-0 z-50 rounded-xl border p-3 text-xs"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
          לא נמצאו התאמות ל-"<span className="font-mono">{query}</span>" — ייווצר מק״ט חופשי.
        </div>
      )}
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
  const [executionDate, setExecutionDate] = useState(editPO?.executionDate || new Date().toISOString().slice(0, 10));

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
      // Pull product metadata from catalog but NOT unitPrice — price is set per PO
      // to allow market fluctuations.
      n[idx] = {
        ...n[idx],
        sku: cat.sku, description: cat.name, color: cat.color, category: cat.category,
        cbm: cat.cbm, technicalDetails: cat.technicalDetails,
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
      executionDate,
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
            <Input label="תאריך ביצוע (ממנו מתחיל זמן הייצור)" type="date" value={executionDate} onChange={e => setExecutionDate(e.target.value)} style={inputHighlight} />
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
                    // unitPrice intentionally not pulled from catalog — set per PO
                    const newItem: ItemDraft = { id: uuid(), sku: cat.sku, description: cat.name, color: cat.color, category: cat.category, cbm: cat.cbm, technicalDetails: cat.technicalDetails, quantity: 0, unitPrice: 0, estimatedProductionDays: cat.estimatedProductionDays, estimatedShippingDays: cat.estimatedShippingDays, statusBreakdown: { production: 0, ready: 0, transit: 0, received: 0 }, shippingCostPerUnit: 0, jobNumber: '', estimatedArrival: '', prepaidAmount: 0, prepaidDate: '', prepaidNote: '' };
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
                    <SkuAutocomplete
                      value={item.sku}
                      catalog={catalog}
                      onSelect={(sku, fromCatalog) => fromCatalog ? fillFromCatalog(idx, sku) : updateItem(idx, 'sku', sku)}
                      style={inputHighlight}
                    />
                    <Input label="תיאור" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} style={inputHighlight} />
                    <Input label="צבע" value={item.color} onChange={e => updateItem(idx, 'color', e.target.value)} style={inputHighlight} />
                    <Input label="CBM" type="number" step="0.001" min="0" value={item.cbm || ''} onChange={e => updateItem(idx, 'cbm', parseFloat(e.target.value) || 0)} placeholder="0.000" style={inputHighlight} />
                    <Input label="כמות" type="number" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                      style={{ ...inputHighlight, borderColor: 'rgba(52, 211, 153,0.5)', boxShadow: '0 0 0 1px rgba(52, 211, 153,0.2)' }} />
                    <Input label={item.unitPrice > 0 ? 'מחיר יחידה ($)' : 'מחיר יחידה ($) — חובה'} type="number" step="0.01" value={item.unitPrice || ''} onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      placeholder="הזן ידנית"
                      style={{ ...inputHighlight, borderColor: item.unitPrice > 0 ? 'rgba(52, 211, 153,0.5)' : 'rgba(251, 113, 133, 0.6)', boxShadow: item.unitPrice > 0 ? '0 0 0 1px rgba(52, 211, 153,0.2)' : '0 0 0 2px rgba(251, 113, 133, 0.18)' }} />
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
