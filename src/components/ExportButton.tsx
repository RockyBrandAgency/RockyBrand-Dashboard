import { DownloadIcon } from './icons/RockyIcons';

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className="crm-btn crm-btn-ghost" onClick={onClick} disabled={disabled} style={{ flexShrink: 0 }}>
      <DownloadIcon size={18} />
      Exportar CSV
    </button>
  );
}
