import { Toggle } from './Toggle';

export function ToggleRow({ label, sub, on, toggle }: { label: string; sub?: string; on: boolean; toggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <Toggle on={on} onToggle={toggle} size="md" />
    </div>
  );
}
