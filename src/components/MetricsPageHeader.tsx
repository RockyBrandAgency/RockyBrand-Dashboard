import { DateRangeControl, type DateRangeDays } from './DateRangeControl';
import { ExportButton } from './ExportButton';

// Encabezado compartido por Métricas > Resumen y las 5 páginas de canal:
// breadcrumb + título arriba (con fecha/ubicación a la derecha), selector
// de rango (7/30/90 días) + exportar debajo. Un solo lugar para este
// layout en vez de repetirlo 6 veces.
export function MetricsPageHeader({
  breadcrumb,
  title,
  contextLabel,
  isDesktop,
  days,
  onDaysChange,
  onExport,
  exportDisabled,
}: {
  breadcrumb: string;
  title: string;
  contextLabel?: string | null;
  isDesktop: boolean;
  days: DateRangeDays;
  onDaysChange: (days: DateRangeDays) => void;
  onExport: () => void;
  exportDisabled?: boolean;
}) {
  return (
    <div style={{ width: '100%', marginBottom: 'var(--space-8)' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 12,
          paddingBottom: 'var(--space-7)',
          borderBottom: '1px solid var(--border)',
          marginBottom: 'var(--space-7)',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-sub)', marginBottom: 4 }}>
            {breadcrumb}
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 'var(--font-size-3xl)' : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {title}
          </h1>
        </div>
        {contextLabel && <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{contextLabel}</div>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <DateRangeControl value={days} onChange={onDaysChange} />
        <ExportButton onClick={onExport} disabled={exportDisabled} />
      </div>
    </div>
  );
}
