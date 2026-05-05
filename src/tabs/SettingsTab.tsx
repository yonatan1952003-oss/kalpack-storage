import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Download, Upload, Sun, Moon, Trash2,
  Check, AlertTriangle, Clock, RefreshCw,
} from 'lucide-react';
import type { Theme, AuditEntry } from '../types';
import { Card, CardHeader, Button } from '../components/Card';

interface Props {
  theme: Theme;
  setTheme: (t: Theme) => void;
  auditLog: AuditEntry[];
  onExportBackup: () => void;
  onImportBackup: (data: string) => void;
  onClearData: () => void;
  reorderDays: number;
  setReorderDays: (d: number) => void;
  lastSynced: string;
}

export function SettingsTab({ theme, setTheme, auditLog, onExportBackup, onImportBackup, onClearData, reorderDays, setReorderDays, lastSynced }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result as string;
        JSON.parse(data); // validate JSON
        onImportBackup(data);
        setImportMsg('הנתונים יובאו בהצלחה!');
        setTimeout(() => setImportMsg(''), 3000);
      } catch {
        setImportMsg('שגיאה: קובץ לא תקין');
        setTimeout(() => setImportMsg(''), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const recentAudit = auditLog.slice(0, 20);

  const actionLabels: Record<string, string> = {
    create: 'יצירה',
    update: 'עדכון',
    delete: 'מחיקה',
    import: 'ייבוא',
    export: 'ייצוא',
    status_change: 'שינוי סטטוס',
  };

  const entityLabels: Record<string, string> = {
    po: 'הזמנת רכש',
    container: 'מכולה',
    catalog: 'קטלוג',
    sales: 'מכירות',
    supplier: 'ספק',
    settings: 'הגדרות',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>ניהול מערכת והעדפות</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Theme */}
        <Card>
          <CardHeader title="ערכת נושא" subtitle="עיצוב המערכת" />
          <div dir="rtl" role="radiogroup" aria-label="ערכת נושא" className="flex gap-3">
            <button
              onClick={() => setTheme('dark')}
              role="radio"
              aria-checked={theme === 'dark'}
              className="flex-1 p-4 rounded-xl border-2 flex items-center gap-3 transition-[border-color,background,box-shadow,filter] hover:brightness-110 text-right"
              style={{
                borderColor: theme === 'dark' ? 'var(--accent)' : 'var(--border-color)',
                background: theme === 'dark' ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                boxShadow: theme === 'dark' ? '0 2px 12px var(--accent-glow)' : 'none',
              }}
            >
              <Moon size={20} aria-hidden="true" style={{ color: theme === 'dark' ? 'var(--accent)' : 'var(--text-muted)' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>כהה</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>מצב חשוך</p>
              </div>
              {theme === 'dark' && <Check size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} className="ms-auto" />}
            </button>
            <button
              onClick={() => setTheme('light')}
              role="radio"
              aria-checked={theme === 'light'}
              className="flex-1 p-4 rounded-xl border-2 flex items-center gap-3 transition-[border-color,background,box-shadow,filter] hover:brightness-110 text-right"
              style={{
                borderColor: theme === 'light' ? 'var(--accent)' : 'var(--border-color)',
                background: theme === 'light' ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                boxShadow: theme === 'light' ? '0 2px 12px var(--accent-glow)' : 'none',
              }}
            >
              <Sun size={20} aria-hidden="true" style={{ color: theme === 'light' ? 'var(--accent)' : 'var(--text-muted)' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>בהיר</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>מצב בהיר</p>
              </div>
              {theme === 'light' && <Check size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} className="ms-auto" />}
            </button>
          </div>
        </Card>

        {/* Reorder threshold */}
        <Card>
          <CardHeader title="סף הזמנה מחדש" subtitle="ימי בטחון לחישוב התראות מלאי" />
          <div dir="rtl" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{reorderDays} ימים</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>מלאי בטחון מעבר לזמן האספקה</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReorderDays(Math.max(7, reorderDays - 7))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold hover:opacity-80"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                >−</button>
                <input
                  type="number"
                  value={reorderDays}
                  min={7}
                  max={180}
                  onChange={e => setReorderDays(Math.max(7, Math.min(180, Number(e.target.value) || 30)))}
                  className="w-16 h-8 rounded-lg border text-center text-sm font-mono font-bold outline-none"
                  style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                />
                <button
                  onClick={() => setReorderDays(Math.min(180, reorderDays + 7))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold hover:opacity-80"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                >+</button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[14, 30, 45, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setReorderDays(d)}
                  className="px-3 h-7 rounded-lg text-xs font-bold transition-[background,color] hover:opacity-80"
                  style={{
                    background: reorderDays === d ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: reorderDays === d ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {d}י
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* User info */}
        <Card>
          <CardHeader title="פרטי משתמש" subtitle="פרופיל המנהל" />
          <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#080c16' }}>
              מנ
            </div>
            <div>
              <p className="font-bold">מנהל מערכת</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>מנהל רכש</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>גישה מלאה לכל המערכת</p>
            </div>
          </div>
        </Card>

        {/* Backup */}
        <Card>
          <CardHeader title="גיבוי ושחזור" subtitle="ייצוא וייבוא נתוני המערכת" action={
            lastSynced ? (
              <div dir="rtl" className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <RefreshCw size={11} />
                <span>סונכרן {new Date(lastSynced).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ) : undefined
          } />
          <div className="space-y-3">
            <Button className="w-full" onClick={onExportBackup}>
              <Download size={16} /> ייצוא גיבוי (JSON)
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> ייבוא מגיבוי
            </Button>
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" aria-label="בחר קובץ גיבוי" />
            <div aria-live="polite" aria-atomic="true">
              {importMsg && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-xs text-center p-2 rounded-lg"
                  role="status"
                  style={{
                    background: importMsg.includes('שגיאה') ? 'rgba(251, 113, 133, 0.1)' : 'rgba(52, 211, 153, 0.1)',
                    color: importMsg.includes('שגיאה') ? 'var(--status-critical)' : 'var(--status-received)',
                  }}
                >
                  {importMsg}
                </motion.div>
              )}
            </div>
          </div>
        </Card>

        {/* Danger zone */}
        <Card>
          <CardHeader title="אזור מסוכן" subtitle="פעולות בלתי הפיכות" />
          <div className="p-4 rounded-xl border" style={{ borderColor: 'rgba(251, 113, 133, 0.3)', background: 'rgba(251, 113, 133, 0.05)' }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} style={{ color: 'var(--status-critical)' }} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: 'var(--status-critical)' }}>מחיקת כל הנתונים</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  פעולה זו תמחק את כל הנתונים מה-localStorage. מומלץ לבצע גיבוי לפני.
                </p>
                {!confirmClear ? (
                  <Button variant="ghost" className="mt-3 !text-red-400 hover:!bg-red-500/10" onClick={() => setConfirmClear(true)}>
                    <Trash2 size={14} /> מחק הכל
                  </Button>
                ) : (
                  <div className="flex gap-2 mt-3">
                    <Button variant="ghost" className="!text-red-400 !bg-red-500/10" onClick={() => { onClearData(); setConfirmClear(false); }}>
                      אני בטוח — מחק
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmClear(false)}>ביטול</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Audit log */}
      <Card>
        <CardHeader title="יומן פעילות" subtitle={`${auditLog.length} רשומות`} />
        {recentAudit.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>אין פעילות מתועדת עדיין</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentAudit.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#080c16' }}>
                  {entry.user.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: entry.action === 'delete' ? 'rgba(251, 113, 133, 0.15)' : entry.action === 'create' ? 'rgba(52, 211, 153, 0.15)' : 'var(--accent-bg)',
                        color: entry.action === 'delete' ? 'var(--status-critical)' : entry.action === 'create' ? 'var(--status-received)' : 'var(--accent)',
                      }}>
                      {actionLabels[entry.action] || entry.action}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      {entityLabels[entry.entity] || entry.entity}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{entry.description}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(entry.timestamp).toLocaleString('he-IL')} • {entry.user}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
