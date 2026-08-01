import { DateRangeControl, type DateRangeDays } from './DateRangeControl';
import { ExportButton } from './ExportButton';

// Encabezado compartido por Métricas > Resumen y las 5 páginas de canal:
// título + selector de rango (7/30/90 días) + exportar. Un solo lugar
// para este layout en vez de repetirlo 6 veces.
export function MetricsPageHeader({
  title,
  subtitle,
  isDesktop,
  days,
  onDaysChange,
  onExport,
  exportDisabled,
}: {
  title: string;
  subtitle?: string | null;
  isDesktop: boolean;
  days: DateRangeDays;
  onDaysChange: (days: DateRangeDays) => void;
  onExport: () => void;
  exportDisabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, marginBottom: 28 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
          Métricas
        </div>
        <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>{subtitle}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <DateRangeControl value={days} onChange={onDaysChange} />
        <ExportButton onClick={onExport} disabled={exportDisabled} />
      </div>
    </div>
  );
}
