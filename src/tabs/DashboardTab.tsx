import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingCart, Truck, AlertCircle, Package, DollarSign,
  TrendingUp, Clock, ArrowUpLeft, ArrowDownRight, Boxes, Zap, Check,
} from 'lucide-react';
import type { PurchaseOrder, Container, SalesRow, AIAlert, CatalogProduct, TabId } from '../types';
import { Card, StatCard, Button } from '../components/Card';
import { toDailySales } from '../store';

const SAFETY_DAYS = 30;

interface Props {
  pos: PurchaseOrder[];
  containers: Container[];
  salesData: SalesRow[];
  alerts: AIAlert[];
  catalog: CatalogProduct[];
  onNavigate: (tab: TabId) => void;
  onCreatePO: (supplier: string, items: { sku: string; qty: number }[]) => void;
}

const fadeIn = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
});

export function DashboardTab({ pos, containers, salesData, alerts, catalog, onNavigate, onCreatePO }: Props) {
  const [approvedSuppliers, setApprovedSuppliers] = useState<Set<string>>(new Set());

  // Compute reorder suggestions: stock + open pipeline vs daily sales
  const suggestions = useMemo(() => {
    const allItems = pos.flatMap(po => po.items);
    // In-pipeline qty per SKU = production + ready + transit (not yet received)
    const pipelineBySku = new Map<string, number>();
    for (const it of allItems) {
      const inPipeline = it.statusBreakdown.production + it.statusBreakdown.ready + it.statusBreakdown.transit;
      pipelineBySku.set(it.sku, (pipelineBySku.get(it.sku) ?? 0) + inPipeline);
    }
    type Suggestion = { sku: string; name: string; supplier: string; stock: number; pipeline: number; dailySales: number; daysCover: number; suggestedQty: number; price: number };
    const out: Suggestion[] = [];
    for (const row of salesData) {
      const daily = toDailySales(row);
      if (daily <= 0) continue;
      const pipeline = pipelineBySku.get(row.sku) ?? 0;
      const totalAvailable = row.currentStock + pipeline;
      const daysCover = Math.floor(totalAvailable / daily);
      if (daysCover >= SAFETY_DAYS) continue;
      const cat = catalog.find(c => c.sku === row.sku);
      const suggestedQty = Math.ceil(((SAFETY_DAYS - daysCover) * daily) / 50) * 50; // round up to 50-unit chunks
      out.push({
        sku: row.sku,
        name: row.name,
        supplier: cat?.supplier || 'לא ידוע',
        stock: row.currentStock,
        pipeline,
        dailySales: daily,
        daysCover,
        suggestedQty,
        price: cat?.unitPrice ?? 0,
      });
    }
    out.sort((a, b) => a.daysCover - b.daysCover);
    return out;
  }, [pos, salesData, catalog]);

  // Group suggestions by supplier for one-click bulk PO
  const bySupplier = useMemo(() => {
    const map = new Map<string, typeof suggestions>();
    for (const s of suggestions) {
      const arr = map.get(s.supplier) ?? [];
      arr.push(s);
      map.set(s.supplier, arr);
    }
    return Array.from(map.entries());
  }, [suggestions]);

  const handleApprove = (supplier: string, items: { sku: string; qty: number }[]) => {
    onCreatePO(supplier, items);
    setApprovedSuppliers(prev => new Set(prev).add(supplier));
  };

  const stats = useMemo(() => {
    const allItems = pos.flatMap(po => po.items);
    const totalValue = allItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const totalReceived = allItems.reduce((s, i) => s + i.statusBreakdown.received, 0);
    const totalInTransit = allItems.reduce((s, i) => s + i.statusBreakdown.transit, 0);
    const totalProduction = allItems.reduce((s, i) => s + i.statusBreakdown.production, 0);
    const totalReady = allItems.reduce((s, i) => s + i.statusBreakdown.ready, 0);
    const totalStock = salesData.reduce((s, r) => s + r.currentStock, 0);
    const dailySalesTotal = salesData.reduce((s, r) => s + toDailySales(r), 0);
    const avgDaysOfStock = dailySalesTotal > 0 ? Math.round(totalStock / dailySalesTotal) : 0;
    const activeContainers = containers.filter(c => c.status !== 'arrived').length;
    const totalShipping = containers.reduce((s, c) => s + c.shippingCost, 0);

    return {
      totalPOs: pos.length,
      totalValue,
      totalReceived,
      totalInTransit,
      totalProduction,
      totalReady,
      totalStock,
      avgDaysOfStock,
      activeContainers,
      totalShipping,
      catalogSize: catalog.length,
      criticalAlerts: alerts.filter(a => a.severity === 'red').length,
      warningAlerts: alerts.filter(a => a.severity === 'yellow').length,
    };
  }, [pos, containers, salesData, alerts, catalog]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeIn(0)}>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>לוח בקרה</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>סקירה כללית של פעילות המחסן</p>
      </motion.div>

      {/* Alert banner */}
      {stats.criticalAlerts > 0 && (
        <motion.button {...fadeIn(0.05)}
          className="w-full rounded-xl border-2 p-4 flex items-center gap-3 cursor-pointer hover:brightness-110 transition-[filter,border-color] text-right"
          style={{ background: 'rgba(251, 113, 133, 0.08)', borderColor: 'rgba(251, 113, 133, 0.3)' }}
          onClick={() => onNavigate('ai')}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center animate-pulse" style={{ background: 'var(--status-critical)' }}>
            <AlertCircle size={20} color="white" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">{stats.criticalAlerts} התראות קריטיות</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>מוצרים עומדים להיגמר — לחץ לצפייה</p>
          </div>
          <ArrowUpLeft size={18} aria-hidden="true" style={{ color: 'var(--status-critical)' }} />
        </motion.button>
      )}

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div {...fadeIn(0.1)}>
          <StatCard label="סה״כ הזמנות רכש" value={stats.totalPOs} color="var(--accent)" />
        </motion.div>
        <motion.div {...fadeIn(0.12)}>
          <StatCard label="שווי הזמנות" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.totalValue)} color="var(--status-ready)" />
        </motion.div>
        <motion.div {...fadeIn(0.14)}>
          <StatCard label="מכולות פעילות" value={stats.activeContainers} color="var(--status-warning)" />
        </motion.div>
        <motion.div {...fadeIn(0.16)}>
          <StatCard label="ימי מלאי ממוצע" value={stats.avgDaysOfStock}
            sub={stats.avgDaysOfStock < 30 ? 'נמוך!' : 'תקין'}
            alert={stats.avgDaysOfStock < 14 ? 'critical' : stats.avgDaysOfStock < 30 ? 'warning' : undefined}
          />
        </motion.div>
      </div>

      {/* Pipeline overview */}
      <motion.div {...fadeIn(0.2)}>
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>צנרת אספקה</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>סטטוס כל הפריטים בהזמנות</p>
            </div>
            <button onClick={() => onNavigate('po')} className="text-xs font-medium flex items-center gap-1 hover:underline" style={{ color: 'var(--accent)' }}>
              צפה בהזמנות <ArrowUpLeft size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'בייצור', value: stats.totalProduction, color: 'var(--status-production)', icon: Clock },
              { label: 'מוכן', value: stats.totalReady, color: 'var(--status-ready)', icon: Package },
              { label: 'בים', value: stats.totalInTransit, color: 'var(--status-transit)', icon: Truck },
              { label: 'נכנס למלאי', value: stats.totalReceived, color: 'var(--status-received)', icon: Boxes },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
                  <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)` }}>
                    <Icon size={18} style={{ color: item.color }} />
                  </div>
                  <p className="text-2xl font-bold font-mono" style={{ color: item.color }}>{item.value.toLocaleString()}</p>
                  <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
                </div>
              );
            })}
          </div>
          {/* Pipeline bar */}
          {(() => {
            const total = stats.totalProduction + stats.totalReady + stats.totalInTransit + stats.totalReceived;
            const segments = [
              { label: 'בייצור', value: stats.totalProduction, color: 'var(--status-production)' },
              { label: 'מוכן', value: stats.totalReady, color: 'var(--status-ready)' },
              { label: 'בים', value: stats.totalInTransit, color: 'var(--status-transit)' },
              { label: 'נכנס למלאי', value: stats.totalReceived, color: 'var(--status-received)' },
            ];
            const pctLabel = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <>
                <div
                  className="mt-4 h-3 rounded-full overflow-hidden flex"
                  style={{ background: 'var(--bg-tertiary)' }}
                  role="img"
                  aria-label={segments.map(s => `${s.label}: ${pctLabel(s.value)}%`).join(', ')}
                >
                  {total > 0 && segments.map((seg, i) => (
                    <motion.div
                      key={seg.label}
                      initial={{ width: 0 }}
                      animate={{ width: `${(seg.value / total) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                      style={{ background: seg.color }}
                      title={`${seg.label}: ${seg.value.toLocaleString()} (${pctLabel(seg.value)}%)`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {segments.map(seg => (
                    <div key={seg.label} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: seg.color }} />
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {seg.label}
                        <span className="font-mono opacity-70 ms-1">{pctLabel(seg.value)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </Card>
      </motion.div>

      {/* Auto-reorder suggestions */}
      {suggestions.length > 0 && (
        <motion.div {...fadeIn(0.25)}>
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Zap size={16} style={{ color: 'var(--status-warning)' }} />
                  המלצות הזמנה אוטומטית
                </h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {suggestions.length} מק״טים מתחת ל-{SAFETY_DAYS} ימי מלאי (כולל פריטים בצנרת)
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {bySupplier.map(([supplier, items]) => {
                const totalQty = items.reduce((s, i) => s + i.suggestedQty, 0);
                const totalCost = items.reduce((s, i) => s + i.suggestedQty * i.price, 0);
                const approved = approvedSuppliers.has(supplier);
                return (
                  <div key={supplier} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
                    <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-tertiary)' }}>
                      <div className="flex items-center gap-3">
                        <Package size={14} style={{ color: 'var(--accent)' }} />
                        <div>
                          <p className="text-sm font-bold">{supplier}</p>
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {items.length} מק״טים • {totalQty.toLocaleString()} יח׳ • ${totalCost.toFixed(0)}
                          </p>
                        </div>
                      </div>
                      {approved ? (
                        <span className="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-received)' }}>
                          <Check size={12} /> נוצרה הזמנה
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => handleApprove(supplier, items.map(i => ({ sku: i.sku, qty: i.suggestedQty })))}
                        >
                          <Check size={12} className="inline ml-1" />
                          אשר וצור הזמנה
                        </Button>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="kp-table">
                        <thead>
                          <tr>
                            <th className="kp-th kp-code">מק״ט</th>
                            <th className="kp-th">שם</th>
                            <th className="kp-th kp-num">מלאי</th>
                            <th className="kp-th kp-num">בצנרת</th>
                            <th className="kp-th kp-num">מכירה יומית</th>
                            <th className="kp-th kp-num">ימי כיסוי</th>
                            <th className="kp-th kp-num">המלצה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(it => (
                            <tr key={it.sku}>
                              <td className="kp-td kp-code font-mono font-bold">{it.sku}</td>
                              <td className="kp-td">{it.name}</td>
                              <td className="kp-td kp-num font-mono">{it.stock.toLocaleString()}</td>
                              <td className="kp-td kp-num font-mono" style={{ color: 'var(--status-transit)' }}>{it.pipeline.toLocaleString()}</td>
                              <td className="kp-td kp-num font-mono">{Math.round(it.dailySales)}</td>
                              <td className="kp-td kp-num">
                                <span className={`font-mono font-bold ${it.daysCover < 7 ? 'text-red-400' : it.daysCover < 14 ? 'text-amber-400' : ''}`}>
                                  {it.daysCover}
                                </span>
                              </td>
                              <td className="kp-td kp-num font-mono font-bold" style={{ color: 'var(--accent)' }}>
                                {it.suggestedQty.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Bottom grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Stock summary */}
        <motion.div {...fadeIn(0.3)}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Boxes size={16} style={{ color: 'var(--accent)' }} /> מלאי נוכחי
              </h3>
              <button onClick={() => onNavigate('data')} className="text-xs flex items-center gap-1 hover:underline" style={{ color: 'var(--accent)' }}>
                נתונים מלאים <ArrowUpLeft size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {salesData.slice(0, 5).map(row => {
                const daily = toDailySales(row);
                const days = daily > 0 ? Math.floor(row.currentStock / daily) : 999;
                return (
                  <div key={row.sku} className="flex items-center justify-between gap-3 p-2.5 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-mono font-bold block truncate" title={row.sku}>{row.sku}</span>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }} title={row.name}>{row.name}</p>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <span className="text-sm font-bold font-mono">{row.currentStock.toLocaleString()}</span>
                      <p className="text-[10px]" style={{ color: days <= 7 ? 'var(--status-critical)' : days <= 30 ? 'var(--status-warning)' : 'var(--text-secondary)' }}>
                        {days <= 7 ? <ArrowDownRight size={10} className="inline" /> : null}
                        {days} ימים
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Quick actions */}
        <motion.div {...fadeIn(0.35)}>
          <Card>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
              <TrendingUp size={16} style={{ color: 'var(--accent)' }} /> פעולות מהירות
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'הזמנה חדשה', icon: ShoppingCart, tab: 'po' as TabId, color: 'var(--accent)' },
                { label: 'מכולה חדשה', icon: Truck, tab: 'containers' as TabId, color: 'var(--status-ready)' },
                { label: 'התראות AI', icon: AlertCircle, tab: 'ai' as TabId, color: 'var(--status-critical)', badge: stats.criticalAlerts + stats.warningAlerts },
                { label: 'זמני אספקה', icon: Clock, tab: 'leadtimes' as TabId, color: 'var(--status-warning)' },
                { label: 'ניהול ספקים', icon: Package, tab: 'suppliers' as TabId, color: 'var(--status-production)' },
                { label: 'ייצוא נתונים', icon: DollarSign, tab: 'data' as TabId, color: 'var(--status-received)' },
              ].map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => onNavigate(action.tab)}
                    className="p-5 rounded-xl border text-right transition-[transform,border-color,background] hover:scale-[1.02] active:scale-[0.98] relative min-h-[96px] flex flex-col justify-between"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = action.color; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                  >
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-2" style={{ background: `color-mix(in srgb, ${action.color} 14%, transparent)` }}>
                      <Icon size={22} style={{ color: action.color }} aria-hidden="true" />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{action.label}</p>
                    {action.badge && action.badge > 0 && (
                      <span className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'var(--status-critical)' }} aria-label={`${action.badge} התראות`}>
                        {action.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
