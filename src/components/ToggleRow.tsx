export function ToggleRow({ label, sub, on, toggle }: { label: string; sub?: string; on: boolean; toggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={toggle}
        style={{
          all: 'unset',
          width: 52,
          height: 28,
          borderRadius: 14,
          cursor: 'pointer',
          background: on ? 'var(--primary)' : 'var(--border)',
          position: 'relative',
          transition: 'background 0.18s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 27 : 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.20)',
            transition: 'left 0.18s',
          }}
        />
      </button>
    </div>
  );
}
