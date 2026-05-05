import { useState } from 'react';
import {
  Phone,
  Mail,
  Bell,
  Activity,
  Users,
  CheckCheck,
  PackageCheck,
  CreditCard,
  Printer,
} from 'lucide-react';
import type { AuditEntry } from '../types';

interface Props {
  auditLog: AuditEntry[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onPrint: () => void;
}

const managers = [
  { name: 'דניאל כהן', role: 'מנהל רכש', avatar: 'דכ', online: false, color: 'var(--accent)' },
  { name: 'מיכל לוי', role: 'לוגיסטיקה', avatar: 'מל', online: false, color: 'var(--status-received)' },
  { name: 'יוסי ברק', role: 'מנהל ספקים', avatar: 'יב', online: true, color: 'var(--status-warning)' },
  { name: 'אלישבע פרץ', role: 'מחסן', avatar: 'אפ', online: false, color: 'var(--status-production)' },
];

const avatarColors = ['var(--accent)', 'var(--status-received)', 'var(--status-warning)', 'var(--status-production)'];

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button
            onClick={() => setOpen(!open)}
            className="transition-colors text-[10px]"
            style={{ color: 'var(--text-muted)' }}
          >
            {open ? 'הסתר' : 'הצג'}
          </button>
        </div>
      </div>
      {open && children}
    </div>
  );
}

export function RightPanel({ auditLog, collapsed, onPrint }: Props) {
  const [notifsDismissed, setNotifsDismissed] = useState<Set<string>>(new Set());

  const recentAudit = auditLog.slice(0, 8);
  const unreadCount = recentAudit.filter(e => !notifsDismissed.has(e.id)).length;

  const markAllRead = () => {
    setNotifsDismissed(new Set(recentAudit.map(e => e.id)));
  };

  const actionIcons: Record<string, React.ElementType> = {
    create: PackageCheck,
    update: PackageCheck,
    delete: PackageCheck,
    import: PackageCheck,
    export: CreditCard,
    status_change: PackageCheck,
  };

  const actionColors: Record<string, string> = {
    create: 'var(--status-received)',
    update: 'var(--accent)',
    delete: 'var(--status-critical)',
    import: 'var(--status-ready)',
    export: 'var(--status-warning)',
    status_change: 'var(--status-production)',
  };

  if (collapsed) return null;

  return (
    <aside
      dir="rtl"
      className="w-64 flex-shrink-0 flex-col h-screen sticky top-0 overflow-y-auto hidden xl:flex"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>פאנל פעילות</span>
        <div className="flex items-center gap-2">
          <button onClick={onPrint} className="transition-colors" style={{ color: 'var(--text-muted)' }} title="הדפסת דוח" aria-label="הדפסת דוח">
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          {unreadCount > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(0, 212, 170, 0.15)', color: 'var(--accent)' }}
            >
              {unreadCount} חדש
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Notifications from audit log */}
        <Section
          title="התראות"
          icon={Bell}
          action={
            unreadCount > 0 ? (
              <button
                onClick={markAllRead}
                className="text-[10px] flex items-center gap-1 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <CheckCheck className="w-3 h-3" />
                סמן הכל
              </button>
            ) : undefined
          }
        >
          <div className="space-y-2">
            {recentAudit.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>אין התראות</p>
            ) : (
              recentAudit.map((entry) => {
                const NIcon = actionIcons[entry.action] || PackageCheck;
                const color = actionColors[entry.action] || 'var(--accent)';
                const isRead = notifsDismissed.has(entry.id);
                return (
                  <button
                    key={entry.id}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-xl transition-colors cursor-pointer hover:bg-white/[0.03] text-right"
                    style={
                      !isRead
                        ? { background: 'rgba(100, 180, 255, 0.03)', border: '1px solid var(--border-color)' }
                        : { border: '1px solid transparent' }
                    }
                    onClick={() => setNotifsDismissed(prev => new Set([...prev, entry.id]))}
                    aria-label={`${isRead ? '' : 'חדש: '}${entry.description}`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }}
                    >
                      <NIcon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug" style={{ color: isRead ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                        {entry.description}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {new Date(entry.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} • {entry.user}
                      </p>
                    </div>
                    {!isRead && (
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Section>

        <div className="h-px" style={{ background: 'var(--sidebar-border)' }} />

        {/* Activity feed */}
        <Section title="פעילות אחרונה" icon={Activity}>
          <div className="relative">
            <div
              className="absolute right-3 top-0 bottom-0 w-px"
              style={{ background: 'var(--sidebar-border)' }}
            />
            <div className="space-y-4">
              {auditLog.slice(0, 4).map((a, i) => (
                <div key={a.id} className="flex items-start gap-3 relative">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold z-10"
                    style={{ background: avatarColors[i % avatarColors.length], color: '#080c16' }}
                  >
                    {a.user.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                      <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{a.user}</span>{' '}
                      {a.description}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(a.timestamp).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {auditLog.length === 0 && <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>אין פעילות</p>}
            </div>
          </div>
        </Section>

        <div className="h-px" style={{ background: 'var(--sidebar-border)' }} />

        {/* Team */}
        <Section title="הצוות" icon={Users}>
          <div className="space-y-1">
            {managers.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors hover:bg-white/[0.04] group cursor-pointer"
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{ background: m.color, color: '#080c16' }}
                  >
                    {m.avatar}
                  </div>
                  <div
                    className="absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full border-2"
                    style={{
                      background: m.online ? 'var(--status-received)' : 'var(--text-muted)',
                      borderColor: 'var(--sidebar-bg)',
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{m.name}</p>
                    {m.online && (
                      <span
                        className="text-[9px] px-1.5 rounded"
                        style={{ background: 'rgba(52, 211, 153, 0.12)', color: 'var(--status-received)' }}
                      >
                        מחובר
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{m.role}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                  <button
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
                    style={{ background: 'rgba(0, 212, 170, 0.15)' }}
                    aria-label={`שלח מייל ל${m.name}`}
                  >
                    <Mail className="w-3 h-3" aria-hidden="true" style={{ color: 'var(--accent)' }} />
                  </button>
                  <button
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
                    style={{ background: 'rgba(0, 212, 170, 0.15)' }}
                    aria-label={`התקשר ל${m.name}`}
                  >
                    <Phone className="w-3 h-3" aria-hidden="true" style={{ color: 'var(--accent)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </aside>
  );
}
