export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const date = new Date().toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <header
      dir="rtl"
      className="h-14 flex items-center justify-between px-7 border-b sticky top-0 z-20"
      style={{
        background: 'color-mix(in srgb, var(--bg-secondary) 90%, transparent)',
        borderColor: 'var(--border-color)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div>
        <div
          className="text-[15px] font-extrabold tracking-tight"
          style={{
            color: 'var(--text-primary)',
            fontFamily: "'Heebo', sans-serif",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </div>
        )}
      </div>
      <div
        className="text-[11px] font-mono"
        style={{ color: 'var(--text-muted)' }}
      >
        {date}
      </div>
    </header>
  );
}
