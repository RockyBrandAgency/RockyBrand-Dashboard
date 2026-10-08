interface Kpi {
  label: string;
  value: number | string | null;
  sub?: string;
  // Solo valores que son un delta/neto real llevan signo "+" - un conteo
  // o promedio absoluto nunca debería mostrar "+2".
  signed?: boolean;
}

function formatKpiValue(kpi: Kpi): string {
  if (kpi.value == null) return '—';
  if (typeof kpi.value === 'number') {
    const prefix = kpi.signed && kpi.value > 0 ? '+' : '';
    return prefix + kpi.value.toLocaleString('es-CL');
  }
  return kpi.value;
}

// Estilo unificado con el KpiCard local de Facebook/Instagram (auditoría
// capa-por-capa 2026-08-04): antes esta versión usaba radius 12/sin
// sombra/24px-800/label 11px, mientras el de Facebook/Instagram usaba
// radius 8/con sombra/22px-700/label 13px - inconsistente al cambiar de
// pestaña dentro del mismo submenú Métricas. Ahora las 4 páginas
// (Facebook/Instagram vía su KpiCard local, YouTube/SEO vía este
// KpiRow) coinciden con el spec real de Figma: padding 20, radius 8,
// sombra, valor 24px/700, label 13px.
//
// Columnas (2026-10-07): con `repeat(n, 1fr)` las n tarjetas iban siempre en
// una fila, y en un celular el valor más largo empujaba la fila fuera de la
// pantalla. Ahora cada tarjeta mide al menos 140 px o 1/n del ancho -lo que
// sea mayor-: en escritorio siguen las n en una fila, y en un celular pasan a
// dos por fila. El -1 px absorbe el redondeo: sin él, n tarjetas exactas
// pueden no caber y la última baja sola.
export function KpiRow({ items }: { items: Kpi[] }) {
  const n = items.length;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(max(140px, calc((100% - ${(n - 1) * 12 + 1}px) / ${n})), 1fr))`,
        gap: 12,
      }}
    >
      {items.map((kpi) => (
        <div key={kpi.label} style={{ minWidth: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{kpi.label}</div>
          {/* 24 px desde 480 px de ancho; menos en un celular, para que un
              "$1.250.000" quepa en media pantalla. */}
          <div style={{ fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: 700, color: 'var(--text)', marginTop: 8, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{formatKpiValue(kpi)}</div>
          {kpi.sub && <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>{kpi.sub}</div>}
        </div>
      ))}
    </div>
  );
}
