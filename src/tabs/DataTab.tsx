import { useState, useRef } from 'react';
import { Upload, Download, Trash2, Edit3, Check, X, BookOpen, BarChart3, Boxes, AlertCircle } from 'lucide-react';
import type { SalesRow, CatalogProduct, PurchaseOrder, SalesPeriod } from '../types';
import { toDailySales } from '../store';
import { Card, CardHeader, StatCard, Button } from '../components/Card';
import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import { downloadExcel } from '../utils/excelExport';
import { deleteInventoryById, updateInventoryStockBySku } from '../lib/db';

interface Props {
  catalog: CatalogProduct[];
  setCatalog: React.Dispatch<React.SetStateAction<CatalogProduct[]>>;
  salesData: SalesRow[];
  setSalesData: React.Dispatch<React.SetStateAction<SalesRow[]>>;
  pos: PurchaseOrder[];
}

type Section = 'catalog' | 'inventory' | 'sales';

export function DataTab({ catalog, setCatalog, salesData, setSalesData, pos }: Props) {
  const [activeSection, setActiveSection] = useState<Section>('catalog');

  return (
    <div className="space-y-8">
      {/* Section switcher — RTL segmented control */}
      <div
        dir="rtl"
        role="tablist"
        aria-label="מקטעי נתונים"
        className="inline-flex gap-3 p-2 rounded-2xl border"
        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
      >
        {([
          { id: 'catalog' as Section, label: 'קטלוג מוצרים', icon: BookOpen },
          { id: 'inventory' as Section, label: 'מלאי ERP', icon: Boxes },
          { id: 'sales' as Section, label: 'דוח מכירות', icon: BarChart3 },
        ]).map(sec => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              role="tab"
              aria-selected={isActive}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-bold transition-[background,color,box-shadow,filter] hover:brightness-110"
              style={{
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                background: isActive
                  ? 'linear-gradient(135deg, var(--accent-strong) 0%, var(--accent) 100%)'
                  : 'transparent',
                boxShadow: isActive
                  ? '0 2px 12px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15)'
                  : 'none',
                fontFamily: "'Heebo', sans-serif",
              }}
            >
              <Icon size={18} />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {activeSection === 'catalog' && <CatalogSection catalog={catalog} setCatalog={setCatalog} />}
      {activeSection === 'inventory' && <InventorySection salesData={salesData} setSalesData={setSalesData} pos={pos} catalog={catalog} />}
      {activeSection === 'sales' && <SalesSection salesData={salesData} setSalesData={setSalesData} />}
    </div>
  );
}

/* ---- 1. CATALOG SECTION ---- */
function CatalogSection({ catalog, setCatalog }: { catalog: CatalogProduct[]; setCatalog: React.Dispatch<React.SetStateAction<CatalogProduct[]>> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadMsg, setUploadMsg] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<CatalogProduct[] | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');
  const [filterQtyMin, setFilterQtyMin] = useState('');
  const [filterQtyMax, setFilterQtyMax] = useState('');

  const parseCatalogFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
        const products: CatalogProduct[] = [];
        for (const row of json) {
          const sku = String(row['מק״ט'] || row['SKU'] || row['sku'] || row['מקט'] || '').trim();
          if (!sku) continue;
          products.push({
            id: uuid(), sku,
            name: String(row['שם'] || row['name'] || row['תיאור'] || ''),
            color: String(row['צבע'] || row['color'] || ''),
            category: String(row['קטגוריה'] || row['category'] || ''),
            cbm: Number(row['CBM'] || row['cbm'] || row['נפח'] || 0),
            technicalDetails: String(row['פרטים טכניים'] || row['technical'] || ''),
            supplier: String(row['ספק'] || row['supplier'] || ''),
            unitPrice: Number(row['מחיר'] || row['price'] || row['מחיר יחידה'] || 0),
            currency: 'USD',
            estimatedProductionDays: Number(row['ימי ייצור'] || row['production_days'] || 30),
            estimatedShippingDays: Number(row['ימי הפלגה'] || row['shipping_days'] || 60),
            quantity: Number(row['כמות'] || row['quantity'] || row['profit_quantity'] || 0),
          });
        }
        if (products.length > 0) {
          setPreview(products);
          setUploadMsg('');
        } else {
          setUploadMsg('לא נמצאו מוצרים בקובץ');
        }
      } catch { setUploadMsg('שגיאה בקריאת הקובץ'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmCatalogImport = () => {
    if (!preview) return;
    setCatalog(prev => {
      const existing = new Set(prev.map(p => p.sku));
      const newOnes = preview.filter(p => !existing.has(p.sku));
      const updated = prev.map(p => { const u = preview.find(x => x.sku === p.sku); return u ? { ...p, ...u, id: p.id } : p; });
      return [...updated, ...newOnes];
    });
    const existingSkus = new Set(catalog.map(p => p.sku));
    const newCount = preview.filter(p => !existingSkus.has(p.sku)).length;
    const updCount = preview.length - newCount;
    setUploadMsg(`יובאו ${preview.length} מוצרים — ${newCount} חדשים, ${updCount} עודכנו`);
    setPreview(null);
    setShowUpload(false);
  };

  const downloadTemplate = () => {
    const data = [{ 'מק״ט': 'LED-5050-WW', 'שם': 'רצועת LED לבן חם', 'צבע': 'לבן חם', 'קטגוריה': 'תאורת LED', 'CBM': 0.02, 'פרטים טכניים': '5050 SMD, IP65', 'ספק': 'Shenzhen Bright', 'מחיר': 2.40, 'ימי ייצור': 25, 'ימי הפלגה': 60 }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'קטלוג');
    downloadExcel(wb, 'catalog_template.xlsx');
  };

  const suppliers = [...new Set(catalog.map(c => c.supplier).filter(Boolean))];
  const categories = [...new Set(catalog.map(c => c.category).filter(Boolean))];

  const filteredCatalog = catalog.filter(p => {
    if (filterCategory && p.category !== filterCategory) return false;
    const pMin = filterPriceMin === '' ? -Infinity : Number(filterPriceMin);
    const pMax = filterPriceMax === '' ? Infinity : Number(filterPriceMax);
    if (p.unitPrice < pMin || p.unitPrice > pMax) return false;
    const qMin = filterQtyMin === '' ? -Infinity : Number(filterQtyMin);
    const qMax = filterQtyMax === '' ? Infinity : Number(filterQtyMax);
    if (p.quantity < qMin || p.quantity > qMax) return false;
    return true;
  });

  const filtersActive = filterCategory !== '' || filterPriceMin !== '' || filterPriceMax !== '' || filterQtyMin !== '' || filterQtyMax !== '';
  const resetFilters = () => { setFilterCategory(''); setFilterPriceMin(''); setFilterPriceMax(''); setFilterQtyMin(''); setFilterQtyMax(''); };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="מוצרים בקטלוג" value={catalog.length} />
        <StatCard label="ספקים" value={suppliers.length} />
        <StatCard label="קטגוריות" value={categories.length} />
        <StatCard label="ערך ממוצע" value={catalog.length > 0 ? `$${(catalog.reduce((s, c) => s + c.unitPrice, 0) / catalog.length).toFixed(2)}` : '—'} color="var(--accent)" />
      </div>

      <div dir="rtl" className="flex justify-start">
        <Button onClick={() => setShowUpload(v => !v)}>
          <Upload size={14} className="inline ml-1" />{showUpload ? 'סגור' : 'העלאת קובץ אקסל'}
        </Button>
      </div>
      {showUpload && (
        <Card>
          <CardHeader title="העלאת קטלוג מוצרים" subtitle="העלה Excel עם הגדרות מוצרים — מק״ט, שם, צבע, קטגוריה, נפח, ספק" action={
            <Button variant="secondary" onClick={downloadTemplate}><Download size={14} className="inline ml-1" />הורד תבנית</Button>
          } />
          {!preview ? (
            <>
              <DropZone fileRef={fileRef} onFile={parseCatalogFile} label="גרור קובץ קטלוג מוצרים או לחץ לבחירה" sub="עמודות: מק״ט, שם, צבע, קטגוריה, CBM, ספק, מחיר" />
              {uploadMsg && <p className="mt-2 text-sm font-medium" style={{ color: uploadMsg.includes('שגיאה') ? 'var(--status-critical)' : 'var(--status-received)' }}>{uploadMsg}</p>}
            </>
          ) : (
            <ImportPreview
              total={preview.length}
              newCount={preview.filter(p => !catalog.find(c => c.sku === p.sku)).length}
              updateCount={preview.filter(p => !!catalog.find(c => c.sku === p.sku)).length}
              skippedCount={0}
              rows={preview.slice(0, 5).map(p => ({ sku: p.sku, name: p.name, extra: p.category }))}
              onConfirm={confirmCatalogImport}
              onCancel={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
            />
          )}
        </Card>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="px-6 pt-6">
          <CardHeader title="קטלוג מוצרים" subtitle={filtersActive ? `${filteredCatalog.length} מתוך ${catalog.length} מוצרים` : `${catalog.length} מוצרים רשומים`} />
        </div>
        <div dir="rtl" className="px-6 pb-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>קטגוריה</label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm outline-none"
              style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', minWidth: 160, fontFamily: "'Heebo', sans-serif" }}
            >
              <option value="">הכל</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>מחיר ($)</label>
            <div className="flex gap-2">
              <input type="number" placeholder="מינימום" value={filterPriceMin} onChange={e => setFilterPriceMin(e.target.value)}
                className="h-9 w-24 rounded-md border px-2 text-sm text-center outline-none"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              <input type="number" placeholder="מקסימום" value={filterPriceMax} onChange={e => setFilterPriceMax(e.target.value)}
                className="h-9 w-24 rounded-md border px-2 text-sm text-center outline-none"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>כמות</label>
            <div className="flex gap-2">
              <input type="number" placeholder="מינימום" value={filterQtyMin} onChange={e => setFilterQtyMin(e.target.value)}
                className="h-9 w-24 rounded-md border px-2 text-sm text-center outline-none"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              <input type="number" placeholder="מקסימום" value={filterQtyMax} onChange={e => setFilterQtyMax(e.target.value)}
                className="h-9 w-24 rounded-md border px-2 text-sm text-center outline-none"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          {filtersActive && (
            <Button variant="secondary" onClick={resetFilters}><X size={14} className="inline ml-1" />נקה</Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="kp-table">
            <thead>
              <tr>
                <th className="kp-th kp-code">מק״ט</th>
                <th className="kp-th">שם</th>
                <th className="kp-th kp-num">כמות</th>
                <th className="kp-th">קטגוריה</th>
                <th className="kp-th kp-num">CBM</th>
                <th className="kp-th">ספק</th>
                <th className="kp-th kp-num">מחיר</th>
                <th className="kp-th kp-num">ייצור</th>
                <th className="kp-th kp-num">הפלגה</th>
                <th className="kp-th" style={{ width: 56 }}></th>
              </tr>
            </thead>
            <tbody>
              {catalog.length === 0 ? (
                <EmptyRow colSpan={10} message="אין מוצרים בקטלוג. העלה קובץ Excel כדי להתחיל." />
              ) : filteredCatalog.length === 0 ? (
                <EmptyRow colSpan={10} message="לא נמצאו מוצרים התואמים לפילטר." />
              ) : filteredCatalog.map(p => (
                <tr key={p.id}>
                  <td className="kp-td kp-code font-mono font-bold">{p.sku}</td>
                  <td className="kp-td">{p.name}</td>
                  <td className="kp-td kp-num font-mono">{p.quantity.toLocaleString()}</td>
                  <td className="kp-td">{p.category}</td>
                  <td className="kp-td kp-num font-mono">{p.cbm}</td>
                  <td className="kp-td">{p.supplier}</td>
                  <td className="kp-td kp-num font-mono">${p.unitPrice}</td>
                  <td className="kp-td kp-num font-mono">{p.estimatedProductionDays}d</td>
                  <td className="kp-td kp-num font-mono">{p.estimatedShippingDays}d</td>
                  <td className="kp-td">
                    <button
                      onClick={async () => {
                        try {
                          await deleteInventoryById(p.id);
                          setCatalog(prev => prev.filter(x => x.id !== p.id));
                        } catch (err) {
                          alert('שגיאה במחיקה: ' + (err as Error).message);
                        }
                      }}
                      className="text-red-400 p-1.5 rounded-md hover:bg-red-500/10"
                      aria-label="מחק"
                    ><Trash2 size={14} /></button>
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

/* ---- 2. INVENTORY SECTION ---- */
function InventorySection({ salesData, setSalesData, pos, catalog }: { salesData: SalesRow[]; setSalesData: React.Dispatch<React.SetStateAction<SalesRow[]>>; pos: PurchaseOrder[]; catalog: CatalogProduct[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadMsg, setUploadMsg] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<{ sku: string; name: string; stock: number }[] | null>(null);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<SalesRow | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStockMin, setFilterStockMin] = useState('');
  const [filterStockMax, setFilterStockMax] = useState('');
  const [filterDaysMin, setFilterDaysMin] = useState('');
  const [filterDaysMax, setFilterDaysMax] = useState('');

  const catalogBySku = new Map(catalog.map(c => [c.sku, c]));
  const categories = [...new Set(catalog.map(c => c.category).filter(Boolean))];

  const parseInventoryFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
        const updates: { sku: string; name: string; stock: number }[] = [];
        for (const row of json) {
          const sku = String(row['מק״ט'] || row['SKU'] || row['sku'] || row['מקט'] || '').trim();
          const stock = Number(row['מלאי'] || row['מלאי נוכחי'] || row['stock'] || row['current_stock'] || 0);
          if (!sku) continue;
          updates.push({ sku, name: String(row['שם'] || row['name'] || sku), stock });
        }
        if (updates.length > 0) {
          setPreview(updates);
          setUploadMsg('');
        } else {
          setUploadMsg('לא נמצאו נתונים');
        }
      } catch { setUploadMsg('שגיאה בקריאת הקובץ'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmInventoryImport = async () => {
    if (!preview) return;
    const results = await Promise.allSettled(
      preview.map(u => updateInventoryStockBySku(u.sku, u.stock))
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    setSalesData(prev => {
      const bySku = new Map(prev.map(r => [r.sku, r]));
      for (const u of preview) {
        const existing = bySku.get(u.sku);
        if (existing) bySku.set(u.sku, { ...existing, currentStock: u.stock });
        else bySku.set(u.sku, { sku: u.sku, name: u.name, salesAmount: 0, salesPeriod: 'week' as SalesPeriod, currentStock: u.stock });
      }
      return Array.from(bySku.values());
    });
    if (failed > 0) setUploadMsg(`עודכן מלאי עבור ${preview.length - failed} מוצרים, ${failed} נכשלו`);
    else setUploadMsg(`עודכן מלאי עבור ${preview.length} מוצרים`);
    setPreview(null);
    setShowUpload(false);
  };

  const downloadTemplate = () => {
    const data = [{ 'מק״ט': 'LED-5050-WW', 'שם': 'רצועת LED לבן חם', 'מלאי נוכחי': 1200 }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'מלאי');
    downloadExcel(wb, 'inventory_template.xlsx');
  };

  const exportReceived = () => {
    const rows: Record<string, unknown>[] = [];
    for (const po of pos) for (const item of po.items) {
      if (item.statusBreakdown.received > 0) {
        rows.push({ 'מק״ט': item.sku, 'תיאור': item.description, 'צבע': item.color, 'כמות': item.statusBreakdown.received, 'מחיר': item.unitPrice, 'עלות הובלה': item.shippingCostPerUnit, 'עלות נחיתה': item.unitPrice + item.shippingCostPerUnit, 'ספק': po.supplier, 'הזמנה': po.poNumber, 'מקדמה': item.prepaidAmount });
      }
    }
    if (rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'קליטת מלאי');
    downloadExcel(wb, `inventory_received_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getStatus = (p: SalesRow) => {
    const daily = toDailySales(p);
    const days = daily > 0 ? Math.floor(p.currentStock / daily) : 999;
    if (days < 7) return 'קריטי';
    if (days < 30) return 'נמוך';
    return 'תקין';
  };

  const filteredInventory = salesData.filter(p => {
    if (filterCategory && catalogBySku.get(p.sku)?.category !== filterCategory) return false;
    if (filterStatus && getStatus(p) !== filterStatus) return false;
    const sMin = filterStockMin === '' ? -Infinity : Number(filterStockMin);
    const sMax = filterStockMax === '' ? Infinity : Number(filterStockMax);
    if (p.currentStock < sMin || p.currentStock > sMax) return false;
    const daily = toDailySales(p);
    const days = daily > 0 ? Math.floor(p.currentStock / daily) : 999;
    const dMin = filterDaysMin === '' ? -Infinity : Number(filterDaysMin);
    const dMax = filterDaysMax === '' ? Infinity : Number(filterDaysMax);
    if (days < dMin || days > dMax) return false;
    return true;
  });

  const filtersActive = filterCategory !== '' || filterStatus !== '' || filterStockMin !== '' || filterStockMax !== '' || filterDaysMin !== '' || filterDaysMax !== '';
  const resetFilters = () => { setFilterCategory(''); setFilterStatus(''); setFilterStockMin(''); setFilterStockMax(''); setFilterDaysMin(''); setFilterDaysMax(''); };

  const totalStock = filteredInventory.reduce((s, p) => s + p.currentStock, 0);
  const inventoriedCount = salesData.filter(p => p.currentStock > 0).length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="מלאי כולל" value={totalStock.toLocaleString()} sub="יחידות" />
        <StatCard label="מוצרים" value={filteredInventory.length} />
        <StatCard label="מלאי נמוך" value={filteredInventory.filter(p => { const d = toDailySales(p); return d > 0 && (p.currentStock / d) < 30; }).length} color="var(--status-critical)" sub="< 30 יום" />
      </div>

      <div dir="rtl" className="flex justify-start">
        <Button onClick={() => setShowUpload(v => !v)}>
          <Upload size={14} className="inline ml-1" />{showUpload ? 'סגור' : 'העלאת קובץ אקסל'}
        </Button>
      </div>
      {showUpload && (
        <Card>
          <CardHeader title="העלאת מלאי מ-ERP" subtitle="העלה קובץ Excel עם מלאי נוכחי לפי מק״ט" action={
            <div className="kp-actionbar">
              <Button variant="secondary" onClick={downloadTemplate}><Download size={14} className="inline ml-1" />תבנית</Button>
              <Button variant="secondary" onClick={exportReceived}><Download size={14} className="inline ml-1" />ייצוא קליטה</Button>
            </div>
          } />
          {!preview ? (
            <>
              <DropZone fileRef={fileRef} onFile={parseInventoryFile} label="גרור קובץ מלאי ERP או לחץ לבחירה" sub="עמודות: מק״ט, מלאי נוכחי" />
              {uploadMsg && <p className="mt-2 text-sm font-medium" style={{ color: uploadMsg.includes('שגיאה') ? 'var(--status-critical)' : 'var(--status-received)' }}>{uploadMsg}</p>}
            </>
          ) : (
            <ImportPreview
              total={preview.length}
              newCount={preview.filter(u => !salesData.find(s => s.sku === u.sku)).length}
              updateCount={preview.filter(u => !!salesData.find(s => s.sku === u.sku)).length}
              skippedCount={0}
              rows={preview.slice(0, 5).map(u => ({ sku: u.sku, name: u.name, extra: `${u.stock.toLocaleString()} יח׳` }))}
              onConfirm={confirmInventoryImport}
              onCancel={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
            />
          )}
        </Card>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="px-6 pt-6">
          <CardHeader title="מלאי נוכחי" subtitle={filtersActive ? `${filteredInventory.length} מתוך ${inventoriedCount} מוצרים` : `${inventoriedCount} מוצרים רשומים`} />
        </div>
        <div dir="rtl" className="px-6 pb-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>קטגוריה</label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm outline-none"
              style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', minWidth: 160, fontFamily: "'Heebo', sans-serif" }}
            >
              <option value="">הכל</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>סטטוס</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm outline-none"
              style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', minWidth: 140, fontFamily: "'Heebo', sans-serif" }}
            >
              <option value="">הכל</option>
              <option value="קריטי">קריטי</option>
              <option value="נמוך">נמוך</option>
              <option value="תקין">תקין</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>מלאי (יחידות)</label>
            <div className="flex gap-2">
              <input type="number" placeholder="מינימום" value={filterStockMin} onChange={e => setFilterStockMin(e.target.value)}
                className="h-9 w-24 rounded-md border px-2 text-sm text-center outline-none"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              <input type="number" placeholder="מקסימום" value={filterStockMax} onChange={e => setFilterStockMax(e.target.value)}
                className="h-9 w-24 rounded-md border px-2 text-sm text-center outline-none"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>ימי מלאי</label>
            <div className="flex gap-2">
              <input type="number" placeholder="מינימום" value={filterDaysMin} onChange={e => setFilterDaysMin(e.target.value)}
                className="h-9 w-24 rounded-md border px-2 text-sm text-center outline-none"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              <input type="number" placeholder="מקסימום" value={filterDaysMax} onChange={e => setFilterDaysMax(e.target.value)}
                className="h-9 w-24 rounded-md border px-2 text-sm text-center outline-none"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          {filtersActive && (
            <Button variant="secondary" onClick={resetFilters}><X size={14} className="inline ml-1" />נקה</Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="kp-table">
            <thead>
              <tr>
                <th className="kp-th kp-code">מק״ט</th>
                <th className="kp-th">שם</th>
                <th className="kp-th kp-num">מלאי</th>
                <th className="kp-th kp-num">מכירה יומית</th>
                <th className="kp-th kp-num">ימי מלאי</th>
                <th className="kp-th">סטטוס</th>
                <th className="kp-th" style={{ width: 96 }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {salesData.length === 0 ? (
                <EmptyRow colSpan={7} message="אין נתוני מלאי. העלה קובץ ERP כדי להתחיל." />
              ) : filteredInventory.length === 0 ? (
                <EmptyRow colSpan={7} message="לא נמצאו מוצרים התואמים לפילטר." />
              ) : filteredInventory.map(p => {
                const daily = toDailySales(p);
                const days = daily > 0 ? Math.floor(p.currentStock / daily) : 999;
                const isEditing = editingRow === p.sku;
                return (
                  <tr key={p.sku}>
                    <td className="kp-td kp-code font-mono font-bold">{p.sku}</td>
                    <td className="kp-td">{p.name}</td>
                    <td className="kp-td kp-num">{isEditing
                      ? <input type="number" value={editValues?.currentStock || ''} onChange={e => setEditValues(v => v ? { ...v, currentStock: parseInt(e.target.value) || 0 } : v)}
                          className="w-24 rounded border px-2 py-1 text-xs text-center outline-none" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                      : <span className="font-mono font-bold">{p.currentStock.toLocaleString()}</span>}
                    </td>
                    <td className="kp-td kp-num font-mono">{Math.round(daily)}</td>
                    <td className="kp-td kp-num"><span className={`font-mono font-bold ${days < 7 ? 'text-red-400' : days < 30 ? 'text-amber-400' : ''}`}>{days === 999 ? '∞' : days}</span></td>
                    <td className="kp-td">
                      {days < 7 ? <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400">קריטי</span>
                        : days < 30 ? <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400">נמוך</span>
                        : <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400">תקין</span>}
                    </td>
                    <td className="kp-td">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={() => { if (editValues) setSalesData(prev => prev.map(r => r.sku === editingRow ? editValues : r)); setEditingRow(null); }} className="text-emerald-400 p-1.5 rounded-md hover:bg-emerald-500/10"><Check size={14} /></button>
                          <button onClick={() => setEditingRow(null)} className="text-red-400 p-1.5 rounded-md hover:bg-red-500/10"><X size={14} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingRow(p.sku); setEditValues({ ...p }); }} className="p-1.5 rounded-md hover:bg-[var(--accent-bg)]" style={{ color: 'var(--accent)' }}><Edit3 size={14} /></button>
                      )}
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

/* ---- 3. SALES SECTION ---- */
function SalesSection({ salesData, setSalesData }: { salesData: SalesRow[]; setSalesData: React.Dispatch<React.SetStateAction<SalesRow[]>> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadMsg, setUploadMsg] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [period, setPeriod] = useState<SalesPeriod>('week');

  const periodLabels: Record<SalesPeriod, string> = { day: 'יומי', week: 'שבועי', month: 'חודשי' };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
        let count = 0;
        for (const row of json) {
          const sku = String(row['מק״ט'] || row['SKU'] || row['sku'] || row['מקט'] || '').trim();
          const sales = Number(row['מכירות'] || row['כמות'] || row['sales'] || row['quantity'] || 0);
          if (!sku || !sales) continue;
          count++;
          setSalesData(prev => {
            const existing = prev.find(p => p.sku === sku);
            if (existing) return prev.map(p => p.sku === sku ? { ...p, salesAmount: sales, salesPeriod: period } : p);
            return [...prev, { sku, name: String(row['שם'] || row['name'] || sku), salesAmount: sales, salesPeriod: period, currentStock: 0 }];
          });
        }
        setUploadMsg(count > 0 ? `עודכנו מכירות ${periodLabels[period]}ות עבור ${count} מוצרים` : 'לא נמצאו נתונים');
      } catch { setUploadMsg('שגיאה בקריאת הקובץ'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const data = [{ 'מק״ט': 'LED-5050-WW', 'שם': 'רצועת LED לבן חם', 'מכירות': 310 }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'מכירות');
    downloadExcel(wb, 'sales_report_template.xlsx');
  };

  return (
    <div className="space-y-8">
      <div dir="rtl" className="flex justify-start">
        <Button onClick={() => setShowUpload(v => !v)}>
          <Upload size={14} className="inline ml-1" />{showUpload ? 'סגור' : 'העלאת קובץ אקסל'}
        </Button>
      </div>
      {showUpload && (
      <Card>
        <CardHeader title="העלאת דוח מכירות" subtitle="העלה דוח מכירות מה-ERP וגדיר את התקופה" action={
          <Button variant="secondary" onClick={downloadTemplate}><Download size={14} className="inline ml-1" />תבנית</Button>
        } />

        {/* Action bar: period selector */}
        <div className="kp-actionbar mb-6" dir="rtl">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>תקופת הדוח:</span>
          <div
            dir="rtl"
            role="tablist"
            aria-label="תקופת דוח מכירות"
            className="inline-flex gap-1 p-1 rounded-lg border"
            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
          >
            {(['day', 'week', 'month'] as SalesPeriod[]).map(p => {
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  role="tab"
                  aria-selected={active}
                  className="px-4 h-9 rounded-md text-sm font-bold transition-[background,color,box-shadow,filter] hover:brightness-110"
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, var(--accent-strong) 0%, var(--accent) 100%)'
                      : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                    boxShadow: active
                      ? '0 2px 12px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15)'
                      : 'none',
                    fontFamily: "'Heebo', sans-serif",
                  }}
                >
                  {periodLabels[p]}
                </button>
              );
            })}
          </div>
        </div>

        <DropZone fileRef={fileRef} onFile={handleFile} label={`גרור דוח מכירות ${periodLabels[period]} או לחץ לבחירה`} sub="עמודות: מק״ט, מכירות" />
        {uploadMsg && <p className="mt-2 text-sm font-medium" style={{ color: uploadMsg.includes('שגיאה') ? 'var(--status-critical)' : 'var(--status-received)' }}>{uploadMsg}</p>}
      </Card>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="px-6 pt-6">
          <CardHeader title="נתוני מכירות" subtitle="המודל משתמש בנתונים אלו לחיזוי" />
        </div>
        <div className="overflow-x-auto">
          <table className="kp-table">
            <thead>
              <tr>
                <th className="kp-th kp-code">מק״ט</th>
                <th className="kp-th">שם</th>
                <th className="kp-th kp-num">מכירות</th>
                <th className="kp-th">תקופה</th>
                <th className="kp-th kp-num">מכירה יומית</th>
                <th className="kp-th kp-num">מלאי</th>
                <th className="kp-th kp-num">ימי מלאי</th>
              </tr>
            </thead>
            <tbody>
              {salesData.length === 0 ? (
                <EmptyRow colSpan={7} message="אין נתוני מכירות. העלה דוח מכירות כדי להתחיל." />
              ) : salesData.map(p => {
                const daily = toDailySales(p);
                const days = daily > 0 ? Math.floor(p.currentStock / daily) : 999;
                return (
                  <tr key={p.sku}>
                    <td className="kp-td kp-code font-mono font-bold">{p.sku}</td>
                    <td className="kp-td">{p.name}</td>
                    <td className="kp-td kp-num font-mono">{p.salesAmount.toLocaleString()}</td>
                    <td className="kp-td">{{ day: 'יומי', week: 'שבועי', month: 'חודשי' }[p.salesPeriod]}</td>
                    <td className="kp-td kp-num font-mono" style={{ color: 'var(--accent)' }}>{Math.round(daily)}</td>
                    <td className="kp-td kp-num font-mono">{p.currentStock.toLocaleString()}</td>
                    <td className="kp-td kp-num"><span className={`font-mono font-bold ${days < 7 ? 'text-red-400' : days < 30 ? 'text-amber-400' : ''}`}>{days === 999 ? '∞' : days}</span></td>
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

/* ---- Import validation preview ---- */
function ImportPreview({
  total, newCount, updateCount, skippedCount, rows, onConfirm, onCancel,
}: {
  total: number; newCount: number; updateCount: number; skippedCount: number;
  rows: { sku: string; name: string; extra?: string }[];
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: 'var(--accent)', background: 'var(--accent-dim)' }}>
      <div className="flex items-center gap-2">
        <AlertCircle size={16} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>תצוגה מקדימה לפני ייבוא</span>
      </div>

      {/* Stats row */}
      <div dir="rtl" className="grid grid-cols-3 gap-3">
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-secondary)' }}>
          <p className="text-lg font-bold font-mono">{total}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>נמצאו בקובץ</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-secondary)' }}>
          <p className="text-lg font-bold font-mono" style={{ color: 'var(--status-ready)' }}>{newCount}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>חדשים</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-secondary)' }}>
          <p className="text-lg font-bold font-mono" style={{ color: 'var(--accent)' }}>{updateCount}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>יעודכנו</p>
        </div>
      </div>

      {/* Sample rows */}
      {rows.length > 0 && (
        <div dir="rtl" className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>דוגמאות ({rows.length < total ? `${rows.length} מתוך ${total}` : total})</p>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
              <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{r.sku}</span>
              <span className="truncate mx-2 flex-1" style={{ color: 'var(--text-secondary)' }}>{r.name}</span>
              {r.extra && <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{r.extra}</span>}
            </div>
          ))}
        </div>
      )}

      {skippedCount > 0 && (
        <p className="text-xs" style={{ color: 'var(--status-warning)' }}>⚠ {skippedCount} שורות ללא מק״ט — יושמטו</p>
      )}

      <div dir="rtl" className="flex gap-2">
        <button
          onClick={onConfirm}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          אשר ייבוא
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

/* ---- Empty state row — keeps table height stable ---- */
function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
        <div className="text-sm">{message}</div>
      </td>
    </tr>
  );
}

/* ---- Shared DropZone ---- */
function DropZone({ fileRef, onFile, label, sub }: { fileRef: React.RefObject<HTMLInputElement | null>; onFile: (f: File) => void; label: string; sub: string }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-[transform,border-color] cursor-pointer ${dragOver ? 'scale-[1.01]' : ''}`}
      style={{ borderColor: dragOver ? 'var(--accent)' : 'var(--border-color)', background: dragOver ? 'var(--accent-dim)' : 'transparent' }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => fileRef.current?.click()}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <Upload size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  );
}
