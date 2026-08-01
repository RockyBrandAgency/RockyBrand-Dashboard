export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        all: 'unset',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        fontSize: 12,
        fontWeight: 700,
        color: disabled ? 'var(--text-muted)' : '#fff',
        background: disabled ? 'var(--border)' : 'var(--primary)',
        borderRadius: 8,
        cursor: disabled ? 'default' : 'pointer',
        boxSizing: 'border-box',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      ⬇ Exportar
    </button>
  );
}
