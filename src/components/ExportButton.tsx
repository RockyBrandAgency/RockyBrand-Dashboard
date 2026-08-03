import { DownloadIcon } from './icons/RockyIcons';

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        all: 'unset',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 600,
        color: disabled ? 'var(--text-faint)' : 'var(--text-sub)',
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <DownloadIcon size={14} />
      Exportar CSV
    </button>
  );
}
