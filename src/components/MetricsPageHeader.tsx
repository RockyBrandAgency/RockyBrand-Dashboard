import { DateRangeControl, type DateRangeDays } from './DateRangeControl';
import { ExportButton } from './ExportButton';

// Encabezado compartido por Métricas > Resumen y las 5 páginas de canal:
// breadcrumb + título arriba (con fecha/ubicación a la derecha), selector
// de rango (7/30/90 días) + exportar debajo. Un solo lugar para este
// layout en vez de repetirlo 6 veces.
export function MetricsPageHeader({
  breadcrumb,
  title,
  subtitle,
  contextLabel,
  isDesktop,
  days,
  onDaysChange,
  onExport,
  exportDisabled,
  // Hallazgo de auditoría 2026-08-04: las 6 pantallas usaban el mismo
  // var(--font-size-3xl) (22px), que no coincide con NINGUNA de las 2
  // variantes reales de Figma - "Métricas Resumen" es 20px, los 5
  // canales de detalle (Facebook/Instagram/YouTube/SEO/TikTok) son 24px.
  // Default 24 porque es el caso mayoritario (5 de 6); Resumen pasa 20.
  titleSize = 24,
}: {
  breadcrumb: string;
  title: string;
  // Hallazgo de auditoría 2026-08-04: Figma trae un subtítulo bajo el
  // título en "Métricas Resumen" ("Visualiza las estadísticas de
  // marketing de {cliente}.") que no existía acá - opcional para no
  // forzarlo en los 5 canales de detalle, que en Figma no lo tienen.
  subtitle?: string;
  contextLabel?: string | null;
  isDesktop: boolean;
  days: DateRangeDays;
  onDaysChange: (days: DateRangeDays) => void;
  onExport: () => void;
  exportDisabled?: boolean;
  titleSize?: 20 | 24;
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
          <h1 style={{ margin: 0, fontSize: isDesktop ? titleSize : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {title}
          </h1>
          {subtitle && <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>{subtitle}</div>}
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
