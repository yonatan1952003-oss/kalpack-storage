import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, AlertCircle, ShoppingCart, Ship, Clock, TrendingDown, Zap, X, Package } from 'lucide-react';
import type { AIAlert, PurchaseOrder, SalesRow, CatalogProduct, AuditEntry } from '../types';
import { Card, Button } from '../components/Card';

interface Props {
  alerts: AIAlert[];
  salesData: SalesRow[];
  pos: PurchaseOrder[];
  catalog: CatalogProduct[];
  onCreatePO: (supplier: string, items: { sku: string; qty: number }[]) => void;
  onAudit: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
}

const SEVERITY_CONFIG = {
  red: { icon: AlertCircle, color: 'var(--status-critical)', bg: 'rgba(251, 113, 133, 0.1)', label: 'קריטי', border: 'rgba(251, 113, 133, 0.3)' },
  yellow: { icon: AlertTriangle, color: 'var(--status-warning)', bg: 'rgba(251, 191, 36, 0.1)', label: 'אזהרה', border: 'rgba(251, 191, 36, 0.3)' },
  green: { icon: CheckCircle, color: 'var(--status-received)', bg: 'rgba(52, 211, 153, 0.1)', label: 'תקין', border: 'rgba(52, 211, 153, 0.3)' },
};

export function AITab({ alerts, catalog, onCreatePO, onAudit }: Props) {
  const [showBuilder, setShowBuilder] = useState(false);

  const red = alerts.filter(a => a.severity === 'red');
  const yellow = alerts.filter(a => a.severity === 'yellow');
  const green = alerts.filter(a => a.severity === 'green');

  const urgentItems = alerts
    .filter(a => a.severity !== 'green' && a.recommendedQty && a.recommendedQty > 0)
    .sort((a, b) => (a.daysUntilStockout || 999) - (b.daysUntilStockout || 999));

  return (
    <div className="space-y-6">
      {/* Traffic Lights */}
      <div className="grid grid-cols-3 gap-4">
        {([{ items: red, key: 'red' as const }, { items: yellow, key: 'yellow' as const }, { items: green, key: 'green' as const }]).map(({ items, key }) => {
          const cfg = SEVERITY_CONFIG[key];
          const Icon = cfg.icon;
          return (
            <div key={key} className="rounded-xl border p-5 text-center" style={{ background: items.length > 0 ? cfg.bg : 'var(--bg-card)', borderColor: items.length > 0 ? cfg.border : 'var(--border-color)' }}>
              <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${items.length > 0 && key === 'red' ? 'animate-pulse' : ''}`} style={{ background: items.length > 0 ? cfg.color : 'var(--bg-tertiary)' }}>
                <Icon size={24} color={items.length > 0 ? 'white' : 'var(--text-muted)'} />
              </div>
              <p className="text-3xl font-bold font-mono" style={{ color: cfg.color }}>{items.length}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Smart PO Builder button */}
      {urgentItems.length > 0 && (
        <div dir="rtl" className="flex justify-start">
          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--accent-strong), var(--accent))', color: '#fff', boxShadow: '0 4px 20px var(--accent-glow)' }}
          >
            <Zap size={16} />
            Smart PO Builder — הזמנות אוטומטיות ({urgentItems.length} פריטים)
          </button>
        </div>
      )}

      {/* Smart PO Builder modal */}
      <AnimatePresence>
        {showBuilder && (
          <SmartPOBuilder
            urgentItems={urgentItems}
            catalog={catalog}
            onCreatePO={onCreatePO}
            onAudit={onAudit}
            onClose={() => setShowBuilder(false)}
          />
        )}
      </AnimatePresence>

      {/* Model explanation */}
      <Card>
        <div className="flex items-center gap-2 mb-3"><Clock size={16} style={{ color: 'var(--accent)' }} /><span className="text-sm font-bold">מודל חיזוי</span></div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          המודל מחשב ימי מלאי על בסיס דוח מכירות (יומי/שבועי/חודשי), מלאי נוכחי מה-ERP, וזמני אספקה מוגדרים לכל הזמנה
          (ייצור + ~60 ימי הפלגה מסין). ההתראות מתריעות כשימי המלאי קטנים מזמן ההפלגה. פריטים בצנרת נלקחים בחשבון.
        </p>
      </Card>

      {/* Container recommendation */}
      {urgentItems.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="rounded-xl border-2 p-5" style={{ background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08), rgba(251, 113, 133, 0.05))', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
            <div className="flex items-center gap-2 mb-3"><Ship size={20} style={{ color: 'var(--accent)' }} /><h3 className="font-bold">המלצת AI: מכולה קרובה</h3></div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>על בסיס קצב מכירות, מלאי וזמני אספקה — אלה המוצרים שמומלץ לתעדף:</p>
            <div className="space-y-2">
              {urgentItems.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: SEVERITY_CONFIG[item.severity].color, color: 'white' }}>{idx + 1}</span>
                    <div>
                      <span className="font-mono text-xs font-bold">{item.sku}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}><TrendingDown size={10} className="inline ml-0.5" />{item.daysUntilStockout} ימים למלאי אפס</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono" style={{ color: 'var(--accent)' }}>{item.recommendedQty?.toLocaleString()} יח׳</span>
                    <ShoppingCart size={14} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Alerts */}
      <div className="space-y-3">
        {alerts.map((alert, idx) => {
          const config = SEVERITY_CONFIG[alert.severity];
          const Icon = config.icon;
          return (
            <motion.div key={alert.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
              <div className="rounded-xl border p-4 flex items-start gap-4" style={{ background: config.bg, borderColor: config.border }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${config.color} 14%, transparent)` }}>
                  <Icon size={20} style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full" style={{ background: config.color, color: 'white' }}>{config.label}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{alert.sku}</span>
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{alert.message}</p>
                </div>
                {alert.actionLabel && alert.recommendedQty && (
                  <Button className="shrink-0 mt-1" onClick={() => {
                    const cat = catalog.find(c => c.sku === alert.sku);
                    const supplier = cat?.supplier || 'ספק לא ידוע';
                    onCreatePO(supplier, [{ sku: alert.sku, qty: alert.recommendedQty! }]);
                    onAudit({ action: 'create', entity: 'po', entityId: alert.sku, description: `הזמנה אוטומטית מ-AI: ${alert.sku} x ${alert.recommendedQty}`, user: 'מנהל מערכת' });
                  }}>{alert.actionLabel}</Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {alerts.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <CheckCircle size={48} className="mx-auto mb-3" style={{ color: 'var(--status-received)' }} />
            <p className="text-lg font-medium">הכל תקין!</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>העלה דוח מכירות ומלאי בלשונית "נתונים ומלאי" לקבלת חיזויים</p>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---- Smart PO Builder modal ---- */
function SmartPOBuilder({
  urgentItems, catalog, onCreatePO, onAudit, onClose,
}: {
  urgentItems: AIAlert[];
  catalog: CatalogProduct[];
  onCreatePO: (supplier: string, items: { sku: string; qty: number }[]) => void;
  onAudit: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
  onClose: () => void;
}) {
  // Group items by supplier (looked up from catalog)
  const bySupplier = new Map<string, { alert: AIAlert; qty: number }[]>();
  for (const alert of urgentItems) {
    const cat = catalog.find(c => c.sku === alert.sku);
    const supplier = cat?.supplier || 'ספק לא ידוע';
    if (!bySupplier.has(supplier)) bySupplier.set(supplier, []);
    bySupplier.get(supplier)!.push({ alert, qty: alert.recommendedQty || 0 });
  }

  // Local state for editable quantities per SKU
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const alert of urgentItems) init[alert.sku] = alert.recommendedQty || 0;
    return init;
  });
  const [created, setCreated] = useState<Set<string>>(new Set());

  const handleCreate = (supplier: string, items: { alert: AIAlert }[]) => {
    const lineItems = items.map(i => ({ sku: i.alert.sku, qty: quantities[i.alert.sku] || 0 })).filter(i => i.qty > 0);
    if (lineItems.length === 0) return;
    onCreatePO(supplier, lineItems);
    onAudit({
      action: 'create', entity: 'po', entityId: supplier,
      description: `Smart PO Builder: ${supplier} — ${lineItems.length} פריטים, ${lineItems.reduce((s, i) => s + i.qty, 0).toLocaleString()} יח׳`,
      user: 'מנהל מערכת',
    });
    setCreated(prev => new Set([...prev, supplier]));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-2xl border-2 overflow-hidden"
      style={{ borderColor: 'var(--accent)', background: 'var(--bg-card)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ background: 'linear-gradient(135deg, var(--accent-strong), var(--accent))' }}>
        <div className="flex items-center gap-3">
          <Zap size={20} color="#fff" />
          <div>
            <p className="font-bold text-white">Smart PO Builder</p>
            <p className="text-xs text-white/80">צור הזמנות בכמה לחיצות, מקובצות לפי ספק</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
          aria-label="סגור"
        >
          <X size={18} color="#fff" />
        </button>
      </div>

      {/* Body — supplier groups */}
      <div dir="rtl" className="p-5 space-y-4 max-h-[600px] overflow-y-auto">
        {[...bySupplier.entries()].map(([supplier, items]) => {
          const isCreated = created.has(supplier);
          const totalUnits = items.reduce((s, i) => s + (quantities[i.alert.sku] || 0), 0);
          const totalValue = items.reduce((s, i) => {
            const cat = catalog.find(c => c.sku === i.alert.sku);
            return s + (quantities[i.alert.sku] || 0) * (cat?.unitPrice || 0);
          }, 0);

          return (
            <div
              key={supplier}
              className="rounded-xl border p-4"
              style={{
                background: isCreated ? 'rgba(52, 211, 153, 0.05)' : 'var(--bg-secondary)',
                borderColor: isCreated ? 'var(--status-received)' : 'var(--border-color)',
              }}
            >
              {/* Supplier header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package size={16} style={{ color: 'var(--accent)' }} />
                  <h4 className="font-bold text-sm">{supplier}</h4>
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    {items.length} פריטים
                  </span>
                </div>
                <div className="text-left text-xs">
                  <p className="font-bold font-mono" style={{ color: 'var(--accent)' }}>{totalUnits.toLocaleString()} יח׳</p>
                  <p className="font-mono" style={{ color: 'var(--text-muted)' }}>${totalValue.toLocaleString()}</p>
                </div>
              </div>

              {/* Item list */}
              <div className="space-y-1.5 mb-3">
                {items.map(({ alert }) => {
                  const cat = catalog.find(c => c.sku === alert.sku);
                  return (
                    <div key={alert.sku} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-card)' }}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: SEVERITY_CONFIG[alert.severity].color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold">{alert.sku}</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {alert.daysUntilStockout}י מלאי • ${cat?.unitPrice?.toFixed(2) || '0'}
                          </span>
                        </div>
                      </div>
                      <input
                        type="number"
                        value={quantities[alert.sku] || 0}
                        min={0}
                        onChange={e => setQuantities(prev => ({ ...prev, [alert.sku]: Math.max(0, parseInt(e.target.value) || 0) }))}
                        disabled={isCreated}
                        className="w-20 h-7 rounded border px-2 text-xs text-center font-mono outline-none disabled:opacity-50"
                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      />
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>יח׳</span>
                    </div>
                  );
                })}
              </div>

              {/* Action button */}
              {isCreated ? (
                <div className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(52, 211, 153, 0.1)', color: 'var(--status-received)' }}>
                  <CheckCircle size={14} />
                  הזמנה נוצרה בהצלחה
                </div>
              ) : (
                <button
                  onClick={() => handleCreate(supplier, items)}
                  disabled={totalUnits === 0}
                  className="w-full py-2.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <ShoppingCart size={14} className="inline ml-1.5" />
                  צור הזמנה ל-{supplier} ({totalUnits.toLocaleString()} יח׳)
                </button>
              )}
            </div>
          );
        })}

        {bySupplier.size === 0 && (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            אין פריטים דחופים להזמנה
          </p>
        )}
      </div>

      {/* Footer summary */}
      <div className="px-5 py-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {created.size} מתוך {bySupplier.size} הזמנות נוצרו
        </span>
        <button
          onClick={onClose}
          className="px-3 py-1 rounded-md text-xs font-medium hover:opacity-80"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          סגור
        </button>
      </div>
    </motion.div>
  );
}