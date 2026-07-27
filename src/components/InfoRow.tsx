import type { ReactNode } from 'react';

export function InfoRow({
  icon,
  label,
  urgent,
  noteBg,
  children,
}: {
  icon: string;
  label: string;
  urgent: boolean;
  noteBg?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 8,
        background: noteBg ? '#ECF0E6' : urgent ? 'var(--status-atencion-bg)' : 'var(--bg)',
        border: `1px solid ${urgent ? '#F5C87A' : 'var(--border)'}`,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>{children}</div>
      </div>
    </div>
  );
}
