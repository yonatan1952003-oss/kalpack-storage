import { useState, useEffect, useMemo, useRef, lazy, Suspense, Component, useCallback, type ReactNode } from 'react';
import type { TabId, PurchaseOrder, Container, CatalogProduct, SalesRow, AIAlert, Supplier, AuditEntry, Theme, POLineItem } from './types';
import { MOCK_CATALOG, MOCK_SALES, generateAlerts } from './store';
import { loadState, saveState } from './utils/persistence';
import { fetchInventory, rowToCatalog, rowToSales, type InventoryRow } from './lib/db';
import { supabase } from './lib/supabase';
import {
  listPOs, listContainers, listArrivedContainers,
  createPO, updatePO as updatePOService, deletePO,
  createContainer, updateContainer, deleteContainer, markContainerArrived,
  migrateLocalToSupabaseIfEmpty,
} from './lib/poService';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { GlobalSearch } from './components/GlobalSearch';
import { v4 as uuid } from 'uuid';

/* ─── Lazy-loaded tabs (code-split per route) ─── */
const DashboardTab = lazy(() => import('./tabs/DashboardTab').then(m => ({ default: m.DashboardTab })));
const POTab = lazy(() => import('./tabs/POTab').then(m => ({ default: m.POTab })));
const ContainersTab = lazy(() => import('./tabs/ContainersTab').then(m => ({ default: m.ContainersTab })));
const ArrivedContainersTab = lazy(() => import('./tabs/ArrivedContainersTab').then(m => ({ default: m.ArrivedContainersTab })));
const LeadTimesTab = lazy(() => import('./tabs/LeadTimesTab').then(m => ({ default: m.LeadTimesTab })));
const AITab = lazy(() => import('./tabs/AITab').then(m => ({ default: m.AITab })));
const DataTab = lazy(() => import('./tabs/DataTab').then(m => ({ default: m.DataTab })));
const SuppliersTab = lazy(() => import('./tabs/SuppliersTab').then(m => ({ default: m.SuppliersTab })));
const AnalyticsTab = lazy(() => import('./tabs/AnalyticsTab').then(m => ({ default: m.AnalyticsTab })));
const GraphsTab = lazy(() => import('./tabs/GraphsTab').then(m => ({ default: m.GraphsTab })));
const SettingsTab = lazy(() => import('./tabs/SettingsTab').then(m => ({ default: m.SettingsTab })));

/* ─── Initial suppliers from PO data ─── */
const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 'sup-1', name: 'Shenzhen Bright Electronics', contactName: 'Li Wei', email: 'liwei@szbright.cn', phone: '+86-755-1234567', country: 'סין', currency: 'USD', paymentTerms: 'T/T 30% מקדמה, 70% לפני משלוח', notes: 'ספק ראשי לתאורת LED', rating: 4, createdAt: '2024-01-01' },
  { id: 'sup-2', name: 'Guangzhou Power Systems', contactName: 'Zhang Min', email: 'zhang@gzpower.cn', phone: '+86-20-9876543', country: 'סין', currency: 'USD', paymentTerms: 'T/T 50/50', notes: 'ספקי כוח Mean Well', rating: 3, createdAt: '2024-06-01' },
];

/* ─── Error Boundary ─── */
interface EBState { hasError: boolean; error?: Error }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false };

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'rgba(239,68,68,0.15)' }}>
            ⚠️
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>שגיאה בלתי צפויה</h2>
          <p className="text-sm text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
            {this.state.error?.message || 'אירעה שגיאה. נסה לרענן את הדף.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-6 py-2 rounded-xl text-sm font-semibold text-black"
            style={{ background: 'linear-gradient(135deg,#a3e635,#22c55e)' }}
          >
            נסה שנית
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Loading spinner ─── */
function TabLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  );
}

/* ─── Theme CSS variables — friendly slate + indigo ─── */
const THEMES: Record<Theme, Record<string, string>> = {
  dark: {
    '--bg-primary': '#020617',          // slate-950
    '--bg-secondary': '#0f172a',        // slate-900
    '--bg-tertiary': '#1e293b',         // slate-800
    '--bg-card': '#0f172a',             // slate-900
    '--text-primary': '#f8fafc',        // slate-50
    '--text-secondary': '#cbd5e1',      // slate-300
    '--text-muted': '#94a3b8',          // slate-400
    '--text-subtle': '#64748b',         // slate-500
    '--border-color': '#1e293b',        // slate-800
    '--border-strong': '#334155',       // slate-700
    '--accent': '#818cf8',              // indigo-400
    '--accent-strong': '#6366f1',       // indigo-500
    '--accent-dark': '#4f46e5',         // indigo-600 (legacy alias)
    '--accent-bg': 'rgba(99, 102, 241, 0.12)',
    '--accent-dim': 'rgba(99, 102, 241, 0.08)',  // legacy alias
    '--accent-glow': 'rgba(99, 102, 241, 0.18)',
    '--sidebar-bg': '#020617',
    '--sidebar-border': '#1e293b',
    '--card-shadow': '0 4px 24px rgba(0, 0, 0, 0.25)',
    '--card-ring': 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
    '--grid-line': 'rgba(148, 163, 184, 0.04)',
    '--card-surface': 'linear-gradient(145deg, #0f172a 0%, rgba(15, 23, 42, 0.6) 100%)',
  },
  light: {
    '--bg-primary': '#f8fafc',          // slate-50
    '--bg-secondary': '#ffffff',
    '--bg-tertiary': '#f1f5f9',         // slate-100
    '--bg-card': '#ffffff',
    '--text-primary': '#0f172a',        // slate-900
    '--text-secondary': '#475569',      // slate-600
    '--text-muted': '#64748b',          // slate-500
    '--text-subtle': '#94a3b8',         // slate-400
    '--border-color': '#e2e8f0',        // slate-200
    '--border-strong': '#cbd5e1',       // slate-300
    '--accent': '#6366f1',              // indigo-500
    '--accent-strong': '#4f46e5',       // indigo-600
    '--accent-dark': '#4338ca',         // indigo-700 (legacy alias)
    '--accent-bg': 'rgba(99, 102, 241, 0.08)',
    '--accent-dim': 'rgba(99, 102, 241, 0.06)',  // legacy alias
    '--accent-glow': 'rgba(99, 102, 241, 0.10)',
    '--sidebar-bg': '#ffffff',
    '--sidebar-border': '#e2e8f0',
    '--card-shadow': '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
    '--card-ring': 'none',
    '--grid-line': 'rgba(15, 23, 42, 0.035)',
    '--card-surface': 'linear-gradient(145deg, #ffffff 0%, rgba(248, 250, 252, 0.7) 100%)',
  },
};

/* ─── Tab metadata for TopBar ─── */
const TAB_META: Record<TabId, { title: string; subtitle: string }> = {
  dashboard:  { title: 'לוח בקרה',     subtitle: 'סקירה כללית של פעילות המחסן' },
  po:         { title: 'הזמנות רכש',   subtitle: 'ניהול הזמנות מספקים' },
  containers: { title: 'מכולות',        subtitle: 'ניהול מכולות ועלויות הובלה' },
  arrivedContainers: { title: 'מכולות שהגיעו', subtitle: 'מכולות שנקלטו למלאי - ארכיון' },
  leadtimes:  { title: 'זמני אספקה',   subtitle: 'ייצור + הפלגה לפי מוצר וספק' },
  ai:         { title: 'התראות AI',    subtitle: 'חיזוי מלאי על בסיס מכירות' },
  data:       { title: 'נתונים ומלאי', subtitle: 'קטלוג, מלאי ERP, דוח מכירות' },
  suppliers:  { title: 'ספקים',         subtitle: 'ניהול רשימת ספקים' },
  analytics:  { title: 'אנליטיקס',     subtitle: 'ניתוח ביצועי מחסן ורכש' },
  graphs:     { title: 'גרפים',         subtitle: 'ביצועי מכירות ומלאי לפי קטגוריה' },
  settings:   { title: 'הגדרות',        subtitle: 'העדפות, גיבוי ושחזור נתונים' },
};

/* ─── URL state helpers ─── */
const VALID_TABS: TabId[] = ['dashboard', 'po', 'containers', 'arrivedContainers', 'leadtimes', 'ai', 'data', 'suppliers', 'analytics', 'graphs', 'settings'];

function getTabFromURL(): TabId {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as TabId | null;
  if (tab && VALID_TABS.includes(tab)) return tab;
  return loadState<TabId>('kalpack-tab', 'dashboard');
}

function setTabInURL(tab: TabId) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState({}, '', url.toString());
}

/* ─── Main App ─── */
export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(getTabFromURL);
  // Bootstrap from localStorage so the UI has something to render before the
  // Supabase fetch returns; on first mount we either replace it with live DB
  // contents or — if the DB is empty — push the local data up as a one-time
  // migration. After bootstrap, Supabase is the source of truth and these
  // arrays are kept in sync via realtime + service calls.
  const [pos, setPos] = useState<PurchaseOrder[]>(() => loadState<PurchaseOrder[]>('kalpack-pos', []));
  const [containers, setContainers] = useState<Container[]>(() => loadState<Container[]>('kalpack-containers', []));
  const [arrivedContainers, setArrivedContainers] = useState<Container[]>(() => loadState<Container[]>('kalpack-arrived-containers', []));
  const [catalog, setCatalog] = useState<CatalogProduct[]>(() => loadState('kalpack-catalog', MOCK_CATALOG));
  const [salesData, setSalesData] = useState<SalesRow[]>(() => loadState('kalpack-sales', MOCK_SALES));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadState('kalpack-suppliers', INITIAL_SUPPLIERS));
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(() => loadState('kalpack-audit', []));
  const [theme, setThemeState] = useState<Theme>(() => loadState<Theme>('kalpack-theme', 'dark'));
  const [reorderDays, setReorderDays] = useState<number>(() => loadState<number>('kalpack-reorder-days', 30));
  const [lastSynced, setLastSynced] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Apply theme CSS variables
  useEffect(() => {
    const vars = THEMES[theme];
    for (const [key, value] of Object.entries(vars)) {
      document.documentElement.style.setProperty(key, value);
    }
    document.documentElement.style.colorScheme = theme;
    document.body.style.background = vars['--bg-primary'];
    document.body.style.color = vars['--text-primary'];
    // Update theme-color meta tag
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--bg-primary']);
  }, [theme]);

  // Sync active tab to URL + localStorage
  useEffect(() => {
    saveState('kalpack-tab', activeTab);
    setTabInURL(activeTab);
  }, [activeTab]);

  // Handle browser back/forward for tab navigation
  useEffect(() => {
    const handler = () => {
      const tab = getTabFromURL();
      setActiveTab(tab);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  // Load inventory from Supabase on mount + subscribe to realtime changes
  useEffect(() => {
    let cancelled = false;
    fetchInventory()
      .then(rows => {
        if (cancelled) return;
        setCatalog(rows.map(rowToCatalog));
        setSalesData(prev => {
          const prevBySku = new Map(prev.map(r => [r.sku, r]));
          return rows.map(r => {
            const base = rowToSales(r);
            const existing = prevBySku.get(base.sku);
            // Preserve user-entered sales numbers, but always use live stock from Supabase
            return existing
              ? { ...base, salesAmount: existing.salesAmount, salesPeriod: existing.salesPeriod }
              : base;
          });
        });
        setLastSynced(new Date().toISOString());
      })
      .catch(err => {
        console.error('Failed to load inventory from Supabase:', err);
      });

    // Realtime subscription: react to any change on public.inventory
    const channel = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        (payload) => {
          const newRow = payload.new as InventoryRow | undefined;
          const oldRow = payload.old as Partial<InventoryRow> | undefined;

          if (payload.eventType === 'INSERT' && newRow) {
            setCatalog(prev => [...prev, rowToCatalog(newRow)]);
            setSalesData(prev => [...prev, rowToSales(newRow)]);
          } else if (payload.eventType === 'UPDATE' && newRow) {
            const idStr = String(newRow.id);
            setCatalog(prev => prev.map(c => c.id === idStr ? rowToCatalog(newRow) : c));
            setSalesData(prev => {
              const updated = rowToSales(newRow);
              const found = prev.some(r => r.sku === updated.sku);
              if (!found) return [...prev, updated];
              return prev.map(r => r.sku === updated.sku
                // keep user-entered sales fields, refresh stock + name
                ? { ...r, name: updated.name, currentStock: updated.currentStock }
                : r
              );
            });
          } else if (payload.eventType === 'DELETE' && oldRow) {
            const idStr = String(oldRow.id);
            const oldSku = oldRow.sku ?? '';
            setCatalog(prev => prev.filter(c => c.id !== idStr));
            setSalesData(prev => prev.filter(r => r.sku !== oldSku));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Bootstrap: fetch POs / containers / arrived from Supabase. If the DB is
  // empty *and* localStorage has content, push the local content up as a
  // one-time migration. Then subscribe to realtime updates on all three tables.
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        // Read local snapshot before we replace state
        const localPos     = loadState<PurchaseOrder[]>('kalpack-pos', []);
        const localCont    = loadState<Container[]>('kalpack-containers', []);
        const localArrived = loadState<Container[]>('kalpack-arrived-containers', []);

        const result = await migrateLocalToSupabaseIfEmpty({
          pos: localPos, containers: localCont, arrivedContainers: localArrived,
        });
        if (result.migrated) {
          console.log('[Supabase] Migrated localStorage → DB:', result.counts);
        }

        const [freshPos, freshCont, freshArrived] = await Promise.all([
          listPOs(), listContainers(), listArrivedContainers(),
        ]);
        if (cancelled) return;
        setPos(freshPos);
        setContainers(freshCont);
        setArrivedContainers(freshArrived);
        // localStorage is no longer the source of truth for these — clear the slots
        try { localStorage.removeItem('kalpack-pos'); } catch { /* noop */ }
        try { localStorage.removeItem('kalpack-containers'); } catch { /* noop */ }
        try { localStorage.removeItem('kalpack-arrived-containers'); } catch { /* noop */ }
      } catch (e) {
        console.error('[Supabase] Bootstrap failed:', e);
      }
    })();

    // Realtime: re-fetch the affected slice on any change. Simpler than
    // mutating state from the payload (and avoids ordering/race issues).
    const refetchPos = async () => { try { setPos(await listPOs()); } catch (e) { console.error(e); } };
    const refetchContainers = async () => { try { setContainers(await listContainers()); } catch (e) { console.error(e); } };
    const refetchArrived = async () => { try { setArrivedContainers(await listArrivedContainers()); } catch (e) { console.error(e); } };

    const ch = supabase
      .channel('po-system-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, refetchPos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_order_line_items' }, refetchPos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'containers' }, () => { refetchContainers(); refetchPos(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'container_line_items' }, refetchContainers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arrived_containers' }, () => { refetchArrived(); refetchPos(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arrived_container_line_items' }, refetchArrived)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);
  useEffect(() => { saveState('kalpack-catalog', catalog); }, [catalog]);
  useEffect(() => { saveState('kalpack-sales', salesData); }, [salesData]);
  useEffect(() => { saveState('kalpack-suppliers', suppliers); }, [suppliers]);
  useEffect(() => { saveState('kalpack-audit', auditLog); }, [auditLog]);
  useEffect(() => { saveState('kalpack-theme', theme); }, [theme]);
  useEffect(() => { saveState('kalpack-reorder-days', reorderDays); }, [reorderDays]);

  // Global keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Warn before navigating away (unsaved data in localStorage is auto-saved,
  // but open modals / in-progress edits may be lost)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (searchOpen) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [searchOpen]);

  // Mobile: collapse sidebar by default
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    if (mq.matches) setSidebarCollapsed(true);
    const handler = (e: MediaQueryListEvent) => setSidebarCollapsed(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Generate AI alerts
  const alerts: AIAlert[] = useMemo(() => generateAlerts(salesData, pos, reorderDays), [salesData, pos, reorderDays]);
  const criticalCount = useMemo(() =>
    alerts.reduce((n, a) => n + (a.severity === 'red' || a.severity === 'yellow' ? 1 : 0), 0),
    [alerts]
  );

  // Audit log helper
  const addAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
    const newEntry: AuditEntry = {
      ...entry,
      id: uuid(),
      timestamp: new Date().toISOString(),
    };
    setAuditLog(prev => [newEntry, ...prev].slice(0, 200));
  }, []);

  // When items are received, update sales stock counts
  const handleReceive = useCallback((sku: string, qty: number) => {
    setSalesData(prev =>
      prev.map(row => row.sku === sku ? { ...row, currentStock: row.currentStock + qty } : row)
    );
    addAudit({ action: 'status_change', entity: 'po', entityId: sku, description: `${qty} יח׳ מ-${sku} נכנסו למלאי`, user: 'מנהל מערכת' });
  }, [addAudit]);

  // ─── Supabase sync wrappers ────────────────────────────────────────────────
  // Diff the previous and next state and push only the changes. We keep using
  // setPos/setContainers in child components (instant local feedback) and the
  // wrapper fires the matching service calls in the background. The realtime
  // subscription reconciles other tabs / devices.
  const posSyncRef = useRef<PurchaseOrder[]>(pos);
  posSyncRef.current = pos;

  const handleSetPos: React.Dispatch<React.SetStateAction<PurchaseOrder[]>> = useCallback((updater) => {
    setPos(prev => {
      const next = typeof updater === 'function'
        ? (updater as (p: PurchaseOrder[]) => PurchaseOrder[])(prev)
        : updater;
      // Diff
      const prevById = new Map(prev.map(p => [p.id, p]));
      const nextById = new Map(next.map(p => [p.id, p]));
      // Deletions
      for (const [id] of prevById) {
        if (!nextById.has(id)) {
          const removed = prevById.get(id);
          deletePO(id).catch(e => {
            console.error('[poSync] deletePO failed:', id, e);
            // FK constraint: PO has active containers referencing it.
            // Roll back the local deletion + alert the user.
            const code = (e as { code?: string })?.code;
            if (code === '23503' && removed) {
              setPos(curr => curr.some(p => p.id === id) ? curr : [removed, ...curr]);
              alert(`לא ניתן למחוק את ההזמנה ${removed.poNumber} — יש לה מכולות פעילות. מחק קודם את המכולות המקושרות.`);
            }
          });
        }
      }
      // Inserts + updates
      for (const [id, np] of nextById) {
        const pp = prevById.get(id);
        if (!pp) {
          createPO(np).catch(e => console.error('[poSync] createPO failed:', id, e));
        } else if (JSON.stringify(pp) !== JSON.stringify(np)) {
          updatePOService(np).catch(e => console.error('[poSync] updatePO failed:', id, e));
        }
      }
      return next;
    });
  }, []);

  const handleSetContainers: React.Dispatch<React.SetStateAction<Container[]>> = useCallback((updater) => {
    setContainers(prev => {
      const next = typeof updater === 'function'
        ? (updater as (c: Container[]) => Container[])(prev)
        : updater;
      const prevById = new Map(prev.map(c => [c.id, c]));
      const nextById = new Map(next.map(c => [c.id, c]));
      for (const [id] of prevById) {
        if (!nextById.has(id)) {
          // Note: the arrival flow drives this through markContainerArrived
          // (in ContainersTab) — that path doesn't call setContainers directly.
          // A removal here is a user-initiated delete.
          deleteContainer(id).catch(e => console.error('[poSync] deleteContainer failed:', id, e));
        }
      }
      for (const [id, nc] of nextById) {
        const pc = prevById.get(id);
        if (!pc) {
          createContainer(nc).catch(e => console.error('[poSync] createContainer failed:', id, e));
        } else if (JSON.stringify(pc) !== JSON.stringify(nc)) {
          updateContainer(nc).catch(e => console.error('[poSync] updateContainer failed:', id, e));
        }
      }
      return next;
    });
  }, []);

  // Arrived containers are produced by the DB trigger — we never insert
  // directly from the UI. setArrivedContainers stays as a pure local setter
  // (used optimistically by ContainersTab during arrival, then reconciled
  // by realtime).
  const handleArchiveContainer = useCallback(async (containerId: string) => {
    try { await markContainerArrived(containerId); }
    catch (e) { console.error('[poSync] markContainerArrived failed:', containerId, e); }
  }, []);

  // Auto-reorder: create PO from AI alert
  const handleCreatePOFromAlert = useCallback((supplier: string, items: { sku: string; qty: number }[]) => {
    const poNumber = `PO-${new Date().getFullYear()}-${String(pos.length + 1).padStart(3, '0')}`;
    const newPO: PurchaseOrder = {
      id: uuid(),
      poNumber,
      supplier,
      date: new Date().toISOString().slice(0, 10),
      notes: 'הזמנה אוטומטית מהתראת AI',
      items: items.map(({ sku, qty }) => {
        const cat = catalog.find(c => c.sku === sku);
        return {
          id: uuid(),
          sku,
          description: cat?.name || sku,
          color: cat?.color || '',
          category: cat?.category || '',
          cbm: cat?.cbm || 0,
          technicalDetails: cat?.technicalDetails || '',
          quantity: qty,
          unitPrice: cat?.unitPrice || 0,
          currency: cat?.currency || 'USD',
          statusBreakdown: { production: qty, ready: 0, transit: 0, received: 0 },
          createdAt: new Date().toISOString().slice(0, 10),
          statusTransitions: [],
          estimatedProductionDays: cat?.estimatedProductionDays || 30,
          estimatedShippingDays: cat?.estimatedShippingDays || 60,
          shippingCostPerUnit: 0,
          jobNumber: '',
          estimatedArrival: '',
          prepaidAmount: 0,
          prepaidDate: '',
          prepaidNote: '',
        } satisfies POLineItem;
      }),
    };
    setPos(prev => [newPO, ...prev]);
  }, [pos.length, catalog]);

  // Theme setter with audit
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    addAudit({ action: 'update', entity: 'settings', entityId: 'theme', description: `ערכת נושא שונתה ל: ${t === 'dark' ? 'כהה' : 'בהיר'}`, user: 'מנהל מערכת' });
  }, [addAudit]);

  // Backup export
  const handleExportBackup = useCallback(() => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      pos, containers, catalog, salesData, suppliers, auditLog,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kalpack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addAudit({ action: 'export', entity: 'settings', entityId: 'backup', description: 'גיבוי נתונים יוצא', user: 'מנהל מערכת' });
  }, [pos, containers, catalog, salesData, suppliers, auditLog, addAudit]);

  // Backup import
  const handleImportBackup = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw);
      // Shape guard — refuse anything that doesn't look like a backup file.
      // Each top-level slice is optional, but if present must be an array.
      if (!data || typeof data !== 'object') return;
      const isArrayOrMissing = (v: unknown) => v === undefined || Array.isArray(v);
      if (!isArrayOrMissing(data.pos) || !isArrayOrMissing(data.containers) ||
          !isArrayOrMissing(data.catalog) || !isArrayOrMissing(data.salesData) ||
          !isArrayOrMissing(data.suppliers)) {
        console.warn('[handleImportBackup] Rejected: invalid shape');
        return;
      }
      if (data.pos) setPos(data.pos);
      if (data.containers) setContainers(data.containers);
      if (data.catalog) setCatalog(data.catalog);
      if (data.salesData) setSalesData(data.salesData);
      if (data.suppliers) setSuppliers(data.suppliers);
      addAudit({ action: 'import', entity: 'settings', entityId: 'backup', description: 'גיבוי נתונים יובא', user: 'מנהל מערכת' });
    } catch { /* invalid JSON handled by caller */ }
  }, [addAudit]);

  // Clear all data. POs / containers / arrived live in Supabase now — going
  // through the sync wrappers will issue DELETE per row. Other slices stay
  // local, so we reset them in place.
  const handleClearData = useCallback(() => {
    handleSetPos([]);
    handleSetContainers([]);
    setArrivedContainers([]);
    setCatalog(MOCK_CATALOG);
    setSalesData(MOCK_SALES);
    setSuppliers(INITIAL_SUPPLIERS);
    setAuditLog([]);
    addAudit({ action: 'delete', entity: 'settings', entityId: 'all', description: 'כל הנתונים אופסו', user: 'מנהל מערכת' });
  }, [addAudit, handleSetPos, handleSetContainers]);

  // Navigate and close sidebar on mobile — push to history for back button support
  const handleNavigate = useCallback((tab: TabId) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
    setActiveTab(tab);
    if (window.innerWidth < 1024) setSidebarCollapsed(true);
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab pos={pos} containers={containers} salesData={salesData} alerts={alerts} catalog={catalog} onNavigate={handleNavigate} onCreatePO={handleCreatePOFromAlert} />;
      case 'po':
        return <POTab pos={pos} setPos={handleSetPos} onReceive={handleReceive} catalog={catalog} suppliers={suppliers} setContainers={handleSetContainers} />;
      case 'containers':
        return <ContainersTab
          containers={containers}
          setContainers={handleSetContainers}
          setArrivedContainers={setArrivedContainers}
          pos={pos}
          setPos={handleSetPos}
          onArchive={handleArchiveContainer}
        />;
      case 'arrivedContainers':
        return <ArrivedContainersTab containers={arrivedContainers} pos={pos} setContainers={setArrivedContainers} />;
      case 'leadtimes':
        return <LeadTimesTab pos={pos} />;
      case 'ai':
        return <AITab alerts={alerts} salesData={salesData} pos={pos} catalog={catalog} onCreatePO={handleCreatePOFromAlert} onAudit={addAudit} />;
      case 'data':
        return <DataTab catalog={catalog} setCatalog={setCatalog} salesData={salesData} setSalesData={setSalesData} pos={pos} />;
      case 'suppliers':
        return <SuppliersTab suppliers={suppliers} setSuppliers={setSuppliers} pos={pos} containers={containers} onAudit={addAudit} />;
      case 'analytics':
        return <AnalyticsTab pos={pos} containers={containers} salesData={salesData} catalog={catalog} />;
      case 'graphs':
        return <GraphsTab catalog={catalog} salesData={salesData} />;
      case 'settings':
        return <SettingsTab theme={theme} setTheme={setTheme} auditLog={auditLog} onExportBackup={handleExportBackup} onImportBackup={handleImportBackup} onClearData={handleClearData} reorderDays={reorderDays} setReorderDays={setReorderDays} lastSynced={lastSynced} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleNavigate}
        onSearchOpen={() => setSearchOpen(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        alertCount={criticalCount}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopBar title={TAB_META[activeTab].title} subtitle={TAB_META[activeTab].subtitle} />
        <main
          dir="rtl"
          id="main-content"
          className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-8 xl:p-10"
          style={{ background: 'var(--bg-primary)' }}
        >
          <ErrorBoundary>
            <Suspense fallback={<TabLoader />}>
              {renderTab()}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleNavigate}
        pos={pos}
        containers={containers}
        catalog={catalog}
        salesData={salesData}
      />
    </div>
  );
}
