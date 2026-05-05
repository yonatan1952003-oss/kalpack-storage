import {
  ShoppingCart,
  BarChart3,
  LineChart,
  Settings,
  Search,
  Truck,
  PackageCheck,
  Package,
  Bell,
  Warehouse,
  LogOut,
  LayoutDashboard,
  Users,
  Menu,
} from 'lucide-react';
import type { TabId } from '../types';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onSearchOpen: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  alertCount?: number;
}

interface NavLink {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const mainNav: { label: string; links: NavLink[] }[] = [
  {
    label: 'ראשי',
    links: [
      { id: 'dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
    ],
  },
  {
    label: 'לוחות מחוונים',
    links: [
      { id: 'po', label: 'הזמנות רכש', icon: ShoppingCart },
      { id: 'containers', label: 'מכולות', icon: Truck },
      { id: 'arrivedContainers', label: 'מכולות שהגיעו', icon: PackageCheck },
      { id: 'data', label: 'נתונים ומלאי', icon: Package },
      { id: 'leadtimes', label: 'זמני אספקה', icon: Warehouse },
      { id: 'ai', label: 'התראות AI', icon: Bell },
    ],
  },
  {
    label: 'ניהול',
    links: [
      { id: 'suppliers', label: 'ספקים', icon: Users },
      { id: 'analytics', label: 'אנליטיקס', icon: BarChart3 },
      { id: 'graphs', label: 'גרפים', icon: LineChart },
    ],
  },
];

const footerNav: NavLink[] = [
  { id: 'settings', label: 'הגדרות', icon: Settings },
];

export function Sidebar({
  activeTab,
  onTabChange,
  onSearchOpen,
  collapsed,
  onToggleCollapse,
  alertCount,
}: SidebarProps) {
  const allLinks = [...mainNav.flatMap((g) => g.links), ...footerNav];

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <button
          className="fixed inset-0 z-40 lg:hidden w-full h-full border-none cursor-default"
          style={{ background: 'rgba(2, 6, 23, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onToggleCollapse}
          aria-label="סגור תפריט"
        />
      )}

      <aside
        dir="rtl"
        className={`flex-shrink-0 flex flex-col h-screen z-50 transition-[width] duration-300
          ${collapsed ? 'w-0 lg:w-20 overflow-hidden' : 'w-72'}
          fixed lg:sticky top-0`}
        style={{
          background: 'var(--sidebar-bg)',
          borderInlineStart: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <button
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold cursor-pointer border-none"
            style={{
              background: 'linear-gradient(135deg, var(--accent-strong) 0%, var(--accent) 100%)',
              color: '#ffffff',
              boxShadow: '0 4px 12px var(--accent-glow)',
              fontFamily: "'Heebo', sans-serif",
              fontSize: '16px',
              letterSpacing: '-0.02em',
            }}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
          >
            K
          </button>
          {!collapsed && (
            <div className="min-w-0">
              <div
                className="text-sm font-bold tracking-wide"
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: "'Heebo', sans-serif",
                  letterSpacing: '0.06em',
                }}
              >
                KALPACK<span style={{ color: 'var(--accent)' }}> STORAGE</span>
              </div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                מערכת ניהול מחסן
              </div>
            </div>
          )}
        </div>

        {/* Search trigger */}
        {!collapsed && (
          <div className="px-3 pt-4">
            <button
              onClick={onSearchOpen}
              className="w-full flex items-center gap-2 px-3 h-11 rounded-lg transition-colors text-right hover:bg-[var(--accent-bg)]"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <Search className="w-4 h-4 flex-shrink-0" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
              <span className="flex-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                חיפוש גלובלי…
              </span>
              <kbd
                className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                }}
              >
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Nav (main) */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {collapsed ? (
            <div className="space-y-2 pt-1">
              {allLinks.map((link) => (
                <CollapsedNavButton
                  key={link.id}
                  link={link}
                  active={link.id === activeTab}
                  alertCount={link.id === 'ai' ? alertCount : undefined}
                  onClick={() => onTabChange(link.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {mainNav.map((group) => (
                <div key={group.label}>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.18em] px-3 mb-2"
                    style={{ color: 'var(--text-subtle)' }}
                  >
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.links.map((link) => (
                      <NavButton
                        key={link.id}
                        label={link.label}
                        Icon={link.icon}
                        badge={link.id === 'ai' ? alertCount : undefined}
                        active={link.id === activeTab}
                        onClick={() => onTabChange(link.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Footer nav (settings) — anchored at bottom */}
        {!collapsed && (
          <div
            className="px-3 py-3 space-y-3"
            style={{ borderTop: '1px solid var(--sidebar-border)' }}
          >
            {footerNav.map((link) => (
              <NavButton
                key={link.id}
                label={link.label}
                Icon={link.icon}
                active={link.id === activeTab}
                onClick={() => onTabChange(link.id)}
              />
            ))}

            {/* User profile card */}
            <div
              className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-[var(--accent-bg)] group"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-strong), var(--accent))',
                  color: '#ffffff',
                  fontFamily: "'Heebo', sans-serif",
                }}
              >
                מנ
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  מנהל מערכת
                </div>
                <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  מנהל רכש
                </div>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 p-1"
                style={{ color: 'var(--text-muted)' }}
                aria-label="התנתק"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile hamburger */}
      {collapsed && (
        <button
          className="fixed top-4 right-4 z-30 w-11 h-11 rounded-lg flex items-center justify-center lg:hidden"
          style={{
            background: 'var(--sidebar-bg)',
            border: '1px solid var(--sidebar-border)',
            boxShadow: 'var(--card-shadow)',
          }}
          onClick={onToggleCollapse}
          aria-label="פתח תפריט"
        >
          <Menu size={20} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
        </button>
      )}
    </>
  );
}

function NavButton({
  label,
  Icon,
  badge,
  active,
  onClick,
}: {
  label: string;
  Icon: React.ElementType;
  badge?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="w-full flex items-center gap-3 px-3 rounded-lg text-right text-sm relative transition-colors"
      style={{
        minHeight: '48px',
        fontWeight: active ? 600 : 500,
        background: active ? 'var(--accent-bg)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--bg-tertiary)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Active indicator bar */}
      {active && (
        <div
          className="absolute inset-y-2 start-0 w-[3px] rounded-full"
          style={{ background: 'var(--accent)' }}
        />
      )}
      <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span
          className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md min-w-[20px] text-center"
          style={{
            background: 'rgba(251, 113, 133, 0.12)',
            color: 'var(--status-critical)',
            border: '1px solid rgba(251, 113, 133, 0.2)',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function CollapsedNavButton({
  link,
  active,
  alertCount,
  onClick,
}: {
  link: NavLink;
  active: boolean;
  alertCount?: number;
  onClick: () => void;
}) {
  const Icon = link.icon;
  return (
    <button
      onClick={onClick}
      title={link.label}
      aria-label={link.label}
      aria-current={active ? 'page' : undefined}
      className="w-full flex items-center justify-center rounded-lg transition-colors relative"
      style={{
        minHeight: '48px',
        background: active ? 'var(--accent-bg)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--bg-tertiary)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
      {active && (
        <div
          className="absolute inset-y-2 start-0 w-[3px] rounded-full"
          style={{ background: 'var(--accent)' }}
        />
      )}
      {link.id === 'ai' && alertCount && alertCount > 0 && (
        <span
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
          style={{
            background: 'var(--status-critical)',
            boxShadow: '0 0 6px rgba(251, 113, 133, 0.5)',
          }}
        />
      )}
    </button>
  );
}
