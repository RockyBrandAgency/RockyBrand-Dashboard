interface Kpi {
  label: string;
  value: number | string | null;
  sub?: string;
  // Solo valores que son un delta/neto real llevan signo "+" - un conteo
  // o promedio absoluto nunca debería mostrar "+2".
  signed?: boolean;
}

function formatKpiValue(kpi: Kpi): string {
  if (kpi.value === null) return '—';
  if (typeof kpi.value === 'number') {
    const prefix = kpi.signed && kpi.value > 0 ? '+' : '';
    return prefix + kpi.value.toLocaleString('es-CL');
  }
  return kpi.value;
}

export function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12 }}>
      {items.map((kpi) => (
        <div key={kpi.label} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>{kpi.label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 6, letterSpacing: '-0.01em' }}>{formatKpiValue(kpi)}</div>
          {kpi.sub && <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 3 }}>{kpi.sub}</div>}
        </div>
      ))}
    </div>
  );
}
