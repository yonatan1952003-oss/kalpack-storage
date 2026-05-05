import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingCart, Truck, Package, FileText, ArrowLeft } from 'lucide-react';
import type { PurchaseOrder, Container, CatalogProduct, SalesRow, TabId } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: TabId) => void;
  pos: PurchaseOrder[];
  containers: Container[];
  catalog: CatalogProduct[];
  salesData: SalesRow[];
}

interface SearchResult {
  type: 'po' | 'item' | 'container' | 'product' | 'stock';
  title: string;
  subtitle: string;
  tab: TabId;
  icon: React.ElementType;
  color: string;
}

export function GlobalSearch({ open, onClose, onNavigate, pos, containers, catalog, salesData }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const items: SearchResult[] = [];

    // Search POs
    for (const po of pos) {
      if (po.poNumber.toLowerCase().includes(q) || po.supplier.toLowerCase().includes(q)) {
        items.push({ type: 'po', title: po.poNumber, subtitle: `${po.supplier} • ${po.items.length} פריטים`, tab: 'po', icon: ShoppingCart, color: 'var(--accent)' });
      }
      for (const item of po.items) {
        if (item.sku.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)) {
          items.push({ type: 'item', title: `${item.sku} — ${item.description}`, subtitle: `${po.poNumber} • ${item.quantity} יח׳`, tab: 'po', icon: FileText, color: 'var(--status-production)' });
        }
      }
    }

    // Search containers
    for (const c of containers) {
      if (c.containerNumber.toLowerCase().includes(q) || c.supplier.toLowerCase().includes(q)) {
        const statusLabel = c.status === 'loading' ? 'בטעינה' : c.status === 'in-transit' ? 'בהפלגה' : 'הגיע';
        items.push({ type: 'container', title: c.containerNumber, subtitle: `${c.supplier} • ${statusLabel}`, tab: 'containers', icon: Truck, color: 'var(--status-warning)' });
      }
    }

    // Search catalog
    for (const p of catalog) {
      if (p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q)) {
        items.push({ type: 'product', title: `${p.sku} — ${p.name}`, subtitle: `${p.supplier} • $${p.unitPrice}`, tab: 'data', icon: Package, color: 'var(--status-ready)' });
      }
    }

    // Search sales/stock
    for (const s of salesData) {
      if (s.sku.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) {
        items.push({ type: 'stock', title: s.name, subtitle: `מלאי: ${s.currentStock} • ${s.sku}`, tab: 'data', icon: Package, color: 'var(--status-received)' });
      }
    }

    return items.slice(0, 12);
  }, [query, pos, containers, catalog, salesData]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [results.length]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[selectedIdx]) {
        onNavigate(results[selectedIdx].tab);
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, results, selectedIdx, onClose, onNavigate]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(8,12,22,0.7)', backdropFilter: 'blur(8px)' }} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="חיפוש גלובלי"
            className="relative w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', overscrollBehavior: 'contain' }}
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <Search size={20} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="חיפוש הזמנות, מוצרים, מכולות…"
                className="flex-1 bg-transparent text-base outline-none"
                style={{ color: 'var(--text-primary)' }}
                dir="rtl"
                aria-label="חיפוש גלובלי"
                autoComplete="off"
              />
              <kbd className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {query && results.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>לא נמצאו תוצאות עבור &ldquo;{query}&rdquo;</p>
                </div>
              )}
              {results.map((result, i) => {
                const Icon = result.icon;
                return (
                  <button
                    key={`${result.type}-${i}`}
                    className="w-full flex items-center gap-3 px-5 py-3 text-right transition-colors"
                    style={{
                      background: i === selectedIdx ? 'var(--bg-secondary)' : 'transparent',
                    }}
                    onMouseEnter={() => setSelectedIdx(i)}
                    onClick={() => { onNavigate(result.tab); onClose(); }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${result.color} 12%, transparent)` }}>
                      <Icon size={16} style={{ color: result.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{result.subtitle}</p>
                    </div>
                    {i === selectedIdx && <ArrowLeft size={14} style={{ color: 'var(--accent)' }} />}
                  </button>
                );
              })}
            </div>

            {!query && (
              <div className="px-5 py-4 text-center">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  הקלד כדי לחפש בהזמנות, מוצרים, מכולות ומלאי
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
