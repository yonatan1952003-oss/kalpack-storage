import { type ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-6 glow-hover ${className}`}
      style={{
        background: 'var(--card-surface)',
        borderColor: 'var(--border-color)',
        boxShadow: 'var(--card-shadow), var(--card-ring)',
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-base font-semibold accent-underline pb-1" style={{ color: 'var(--text-primary)', fontFamily: "'Outfit', 'Noto Sans Hebrew', sans-serif" }}>{title}</h2>
        {subtitle && <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  color,
  prefix,
  alert,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  prefix?: string;
  alert?: 'critical' | 'warning';
}) {
  const accentColor = color || 'var(--accent)';

  const alertBorder = alert === 'critical'
    ? 'rgba(251, 113, 133, 0.3)'
    : alert === 'warning'
      ? 'rgba(251, 191, 36, 0.2)'
      : 'var(--border-color)';

  const alertBg = alert === 'critical'
    ? 'linear-gradient(145deg, rgba(251, 113, 133, 0.06) 0%, var(--bg-card) 100%)'
    : alert === 'warning'
      ? 'linear-gradient(145deg, rgba(251, 191, 36, 0.04) 0%, var(--bg-card) 100%)'
      : 'var(--bg-card)';

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col transition-[transform,box-shadow,border-color] hover:scale-[1.02] motion-reduce:hover:scale-100 relative glow-hover ${alert === 'critical' ? 'pulse-critical' : ''}`}
      style={{
        background: alertBg !== 'var(--bg-card)' ? alertBg : 'var(--card-surface)',
        borderColor: alertBorder,
        boxShadow: 'var(--card-shadow), var(--card-ring)',
      }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 right-2 left-2 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)` }} />

      <div className="flex justify-between items-start mb-2">
        <span className="text-[11px] font-medium tracking-wide" style={{ color: 'var(--text-muted)', fontFamily: "'Outfit', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div className="flex-1 flex items-center justify-center py-3">
        <span
          className="text-3xl font-bold tracking-tighter font-mono"
          style={{ color: accentColor }}
        >
          {prefix && <span className="text-xl mr-1 opacity-60">{prefix}</span>}
          {value}
        </span>
      </div>
      {sub && (
        <div
          className="mt-2 text-center text-[11px] font-semibold"
          style={{
            color: alert === 'critical'
              ? 'var(--status-critical)'
              : alert === 'warning'
                ? 'var(--status-warning)'
                : 'var(--text-secondary)',
          }}
        >
          {sub}
        </div>
      )}
      {alert && (
        <span
          className="absolute top-3 right-3 w-2 h-2 rounded-full"
          style={{
            background: alert === 'critical' ? 'var(--status-critical)' : 'var(--status-warning)',
            boxShadow: alert === 'critical' ? '0 0 12px rgba(251, 113, 133, 0.5)' : '0 0 12px rgba(251, 191, 36, 0.4)',
          }}
        />
      )}
    </div>
  );
}

export function SupplierBlock({
  supplier,
  count,
  children,
}: {
  supplier: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden glow-hover"
      style={{
        background: 'var(--card-surface)',
        borderColor: 'var(--border-color)',
        boxShadow: 'var(--card-shadow), var(--card-ring)',
      }}
    >
      <header
        className="flex items-baseline justify-between px-6 py-4 border-b"
        style={{
          background:
            'linear-gradient(90deg, var(--accent-bg) 0%, transparent 60%)',
          borderColor: 'var(--border-color)',
        }}
      >
        <h3
          className="text-lg font-bold tracking-tight"
          style={{
            color: 'var(--text-primary)',
            fontFamily: "'Heebo', sans-serif",
          }}
        >
          {supplier}
        </h3>
        <span
          className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
          style={{
            color: 'var(--accent)',
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent)',
          }}
        >
          {count} מוצרים
        </span>
      </header>
      <div className="px-2 py-2">{children}</div>
    </div>
  );
}

export function LeadBar({
  prod,
  ship,
  max = 100,
}: {
  prod: number;
  ship: number;
  max?: number;
}) {
  const prodPct = Math.min(100, (prod / max) * 100);
  const shipPct = Math.min(100, (ship / max) * 100);
  return (
    <div
      className="relative h-1.5 w-full rounded-full overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.04)' }}
      role="img"
      aria-label={`ייצור ${prod} ימים, הפלגה ${ship} ימים`}
    >
      <div className="absolute inset-y-0 right-0 flex">
        <div
          className="h-full"
          style={{
            width: `${prodPct}%`,
            background: 'var(--status-production)',
            boxShadow: '0 0 6px rgba(167,139,250,0.4)',
          }}
        />
        <div
          className="h-full"
          style={{
            width: `${shipPct}%`,
            background: 'var(--status-ready)',
            boxShadow: '0 0 6px rgba(56,189,248,0.4)',
          }}
        />
      </div>
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    production: 'var(--status-production)',
    ready: 'var(--status-ready)',
    transit: 'var(--status-transit)',
    received: 'var(--status-received)',
    warning: 'var(--status-warning)',
  };
  const bg = colors[status] || '#6b7280';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono"
      style={{ background: `${bg}12`, color: bg, border: `1px solid ${bg}20` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: bg, boxShadow: `0 0 6px ${bg}` }} />
      {label}
    </span>
  );
}

let inputIdCounter = 0;

export function Input({ label, id: propId, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = propId || `kalpack-input-${++inputIdCounter}`;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label htmlFor={id} className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--text-muted)', fontFamily: "'Outfit', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <input
        id={id}
        autoComplete={props.autoComplete || 'off'}
        {...props}
        className={`rounded-xl border px-4 py-2.5 text-sm outline-none transition-[border-color,box-shadow] duration-200 ${props.className || ''}`}
        style={{
          background: 'var(--bg-tertiary)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
          ...props.style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-bg)';
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-color)';
          e.currentTarget.style.boxShadow = 'none';
          props.onBlur?.(e);
        }}
      />
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  pill = false,
  ...props
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'success';
  pill?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, var(--accent-strong) 0%, var(--accent) 100%)',
      color: '#ffffff',
      boxShadow: '0 2px 12px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15)',
    },
    secondary: {
      background: 'var(--bg-tertiary)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-color)',
    },
    success: {
      background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
      color: '#080c16',
      boxShadow: '0 2px 12px rgba(52, 211, 153, 0.2)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)',
    },
  };

  return (
    <button
      {...props}
      className={`px-4 py-2.5 transition-[transform,box-shadow,filter,background,border-color] duration-200 active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-2 text-xs font-bold tracking-wide
        ${pill ? 'rounded-full' : 'rounded-xl'}
        ${variant === 'secondary' ? 'hover:bg-white/5 hover:border-white/10' : 'hover:brightness-110 hover:shadow-lg'}
        ${props.className || ''}`}
      style={{ ...styles[variant], fontFamily: "'Outfit', 'Noto Sans Hebrew', sans-serif", ...props.style }}
    >
      {children}
    </button>
  );
}
