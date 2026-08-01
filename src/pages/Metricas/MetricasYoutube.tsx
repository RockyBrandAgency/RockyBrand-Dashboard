import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { LineChart } from '../../components/LineChart';
import { useMetricsReport } from '../../hooks/useMetricsReport';

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

// Detalle real de YouTube (youtube_snapshot#) - pedido explícito de Mato
// (2026-08-01): panel ejecutivo por canal.
export function MetricasYoutube({ isDesktop }: { isDesktop: boolean }) {
  const { data, loading, error, reload } = useMetricsReport();
  const yt = data?.youtube;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Métricas
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Youtube</h1>
        </div>

        <AsyncState loading={loading} error={error} onRetry={reload}>
          {yt && (
            <>
              <div style={{ marginBottom: 28 }}>
                <KpiRow
                  items={[
                    { label: 'Suscriptores actuales', value: yt.suscriptores_actuales },
                    { label: 'Netos 7 días', value: yt.suscriptores_netos_7d, signed: true },
                    { label: 'Vistas (período)', value: yt.vistas_periodo },
                    { label: 'Minutos vistos', value: yt.minutos_vistos_periodo },
                  ]}
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Suscriptores en el tiempo</div>
                <LineChart
                  points={yt.snapshots.map((s) => ({ fecha: s.fecha, valor: s.suscriptores }))}
                  color="#FF0000"
                  formatDate={formatDateShort}
                />
              </div>

              {yt.top_videos.length > 0 && (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '18px 16px 6px' }}>Videos con más watch time</div>
                  {yt.top_videos.map((v, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-soft)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }}>
                        {typeof v.titulo === 'string' ? v.titulo : `Video ${i + 1}`}
                      </span>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        {typeof v.vistas === 'number' ? `${v.vistas.toLocaleString('es-CL')} vistas` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
