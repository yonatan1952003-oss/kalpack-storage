import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Star, Mail, Phone, Globe, Edit3, Trash2, X, Check, Search } from 'lucide-react';
import type { Supplier, PurchaseOrder, Container, AuditEntry } from '../types';
import { Card, CardHeader, Button, Input } from '../components/Card';
import { v4 as uuid } from 'uuid';

interface Props {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  pos: PurchaseOrder[];
  containers: Container[];
  onAudit: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
}

const emptySupplier = (): Supplier => ({
  id: uuid(),
  name: '',
  contactName: '',
  email: '',
  phone: '',
  country: '',
  currency: 'USD',
  paymentTerms: '',
  notes: '',
  rating: 3,
  createdAt: new Date().toISOString().slice(0, 10),
});

export function SuppliersTab({ suppliers, setSuppliers, pos, containers, onAudit }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Supplier>(emptySupplier());
  const [search, setSearch] = useState('');

  const filtered = search
    ? suppliers.filter(s => s.name.includes(search) || s.contactName.includes(search) || s.country.includes(search))
    : suppliers;

  const getSupplierStats = (name: string) => {
    const supplierPOs = pos.filter(po => po.supplier === name);
    const totalItems = supplierPOs.flatMap(po => po.items);
    const totalValue = totalItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const totalQty = totalItems.reduce((s, i) => s + i.quantity, 0);

    const supplierContainers = containers.filter(c => c.supplier === name);
    const arrivedWithDates = supplierContainers.filter(
      c => c.status === 'arrived' && c.departureDate && c.arrivalDate
    );
    const avgTransitDays = arrivedWithDates.length > 0
      ? Math.round(arrivedWithDates.reduce((s, c) => {
          return s + (new Date(c.arrivalDate).getTime() - new Date(c.departureDate).getTime()) / 86400000;
        }, 0) / arrivedWithDates.length)
      : null;

    return { poCount: supplierPOs.length, totalValue, totalQty, containerCount: supplierContainers.length, avgTransitDays };
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      setSuppliers(prev => prev.map(s => s.id === editingId ? form : s));
      onAudit({ action: 'update', entity: 'supplier', entityId: editingId, description: `עודכן ספק: ${form.name}`, user: 'מנהל מערכת' });
    } else {
      setSuppliers(prev => [form, ...prev]);
      onAudit({ action: 'create', entity: 'supplier', entityId: form.id, description: `נוצר ספק חדש: ${form.name}`, user: 'מנהל מערכת' });
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptySupplier());
  };

  const handleDelete = (id: string) => {
    const s = suppliers.find(s => s.id === id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
    onAudit({ action: 'delete', entity: 'supplier', entityId: id, description: `נמחק ספק: ${s?.name}`, user: 'מנהל מערכת' });
  };

  const handleEdit = (supplier: Supplier) => {
    setForm(supplier);
    setEditingId(supplier.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ניהול ספקים</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{suppliers.length} ספקים רשומים</p>
        </div>
        <Button onClick={() => { setForm(emptySupplier()); setEditingId(null); setShowForm(true); }}>
          <Plus size={16} /> ספק חדש
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש ספק…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card>
              <CardHeader title={editingId ? 'עריכת ספק' : 'ספק חדש'} action={
                <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
              } />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="שם ספק" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input label="איש קשר" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
                <Input label="אימייל" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <Input label="טלפון" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <Input label="מדינה" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
                <Input label="מטבע" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
                <Input label="תנאי תשלום" value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>דירוג</label>
                  <div className="flex gap-1 pt-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setForm({ ...form, rating: n })}>
                        <Star size={20} fill={n <= form.rating ? 'var(--status-warning)' : 'transparent'} style={{ color: n <= form.rating ? 'var(--status-warning)' : 'var(--text-muted)' }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Input label="הערות" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <Button variant="secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>ביטול</Button>
                <Button variant="success" onClick={handleSave}><Check size={14} /> {editingId ? 'עדכן' : 'שמור'}</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Supplier cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((supplier, idx) => {
          const stats = getSupplierStats(supplier.name);
          return (
            <motion.div key={supplier.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <Card>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-base">{supplier.name}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} size={12} fill={n <= supplier.rating ? 'var(--status-warning)' : 'transparent'} style={{ color: n <= supplier.rating ? 'var(--status-warning)' : 'var(--text-muted)' }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(supplier)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleDelete(supplier.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-red-400/50 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {supplier.contactName && <div className="flex items-center gap-2"><Globe size={12} />{supplier.contactName} • {supplier.country}</div>}
                  {supplier.email && <div className="flex items-center gap-2"><Mail size={12} />{supplier.email}</div>}
                  {supplier.phone && <div className="flex items-center gap-2"><Phone size={12} />{supplier.phone}</div>}
                  {supplier.paymentTerms && <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>תנאי תשלום: {supplier.paymentTerms}</div>}
                </div>

                {/* Stats from POs + Containers */}
                <div className="grid grid-cols-5 gap-1 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <div className="text-center">
                    <p className="text-base font-bold font-mono" style={{ color: 'var(--accent)' }}>{stats.poCount}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>הזמנות</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold font-mono" style={{ color: 'var(--status-ready)' }}>${stats.totalValue >= 1000 ? `${(stats.totalValue / 1000).toFixed(0)}k` : stats.totalValue}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>שווי</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold font-mono">{stats.totalQty >= 1000 ? `${(stats.totalQty / 1000).toFixed(0)}k` : stats.totalQty}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>יחידות</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold font-mono" style={{ color: 'var(--status-production)' }}>{stats.containerCount}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>מכולות</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold font-mono" style={{ color: stats.avgTransitDays !== null && stats.avgTransitDays > 45 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
                      {stats.avgTransitDays !== null ? `${stats.avgTransitDays}י` : '—'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>הפלגה</p>
                  </div>
                </div>

                {supplier.notes && (
                  <p className="text-xs mt-3 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                    {supplier.notes}
                  </p>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <Globe size={48} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="font-medium">אין ספקים</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>הוסף ספק חדש כדי להתחיל</p>
          </div>
        </Card>
      )}
    </div>
  );
}
