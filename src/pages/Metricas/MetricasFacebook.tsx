import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { LineChart } from '../../components/LineChart';
import { useMetricsReport } from '../../hooks/useMetricsReport';

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

// Detalle real de Facebook (misma fuente que ya usa el panel de staff -
// meta_snapshot#, campo pagina_facebook) - pedido explícito de Mato
// (2026-08-01): panel ejecutivo por canal, con gráficos reales.
export function MetricasFacebook({ isDesktop }: { isDesktop: boolean }) {
  const { data, loading, error, reload } = useMetricsReport();
  const fb = data?.facebook;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Métricas
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Facebook</h1>
          {fb?.nombre_pagina && <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>{fb.nombre_pagina}</div>}
        </div>

        <AsyncState loading={loading} error={error} onRetry={reload}>
          {fb && (
            <>
              <div style={{ marginBottom: 28 }}>
                <KpiRow
                  items={[
                    { label: 'Seguidores actuales', value: fb.seguidores_actuales },
                    { label: 'Visualizaciones (último dato)', value: fb.visualizaciones_actual },
                  ]}
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Seguidores en el tiempo</div>
                <LineChart
                  points={fb.snapshots.map((s) => ({ fecha: s.fecha, valor: s.seguidores }))}
                  color="#1877F2"
                  formatDate={formatDateShort}
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Visualizaciones de página</div>
                <LineChart
                  points={fb.visualizaciones_snapshots.map((s) => ({ fecha: s.fecha, valor: s.visualizaciones }))}
                  color="#42A5F5"
                  formatDate={formatDateShort}
                />
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
