import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { useMetricsReport } from '../../hooks/useMetricsReport';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pct(part: number, total: number): string {
  if (total <= 0) return '—';
  return `${((part / total) * 100).toFixed(1)}%`;
}

// Vista solo-lectura del historial y desempeño de Email Marketing para el
// cliente - pedido explícito de Mato (2026-08-01): "que Chile Fly Fishing
// y Alto Castillo puedan tener acceso a la plataforma de Email
// Marketing". Alcance confirmado: ver campañas y métricas, no crear ni
// enviar (eso lo sigue operando el staff desde 05-panel-web). Reusa
// data.email de /dashboard/metrics-report - mismo endpoint que Métricas >
// Resumen, sin ruta backend nueva.
export function EmailCampanas({ isDesktop }: { isDesktop: boolean }) {
  const { data, loading, error, reload } = useMetricsReport();
  const email = data?.email;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Servicios Contratados
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Email Marketing</h1>
        </div>

        <AsyncState loading={loading} error={error} onRetry={reload}>
          {email && (
            <>
              <div style={{ marginBottom: 28 }}>
                <KpiRow
                  items={[
                    { label: 'Enviados', value: email.enviados },
                    { label: 'Aperturas', value: email.aperturas },
                    { label: 'Clics', value: email.clics },
                    { label: 'Rebotes', value: email.rebotes },
                  ]}
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '18px 16px 6px' }}>Campañas</div>
                {email.campaigns.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Sin campañas en el rango</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Campaña</th>
                          <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Fecha</th>
                          <th style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Enviados</th>
                          <th style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Open rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {email.campaigns.map((c, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                            <td style={{ padding: '10px 16px', color: 'var(--text)' }}>{c.name ?? 'Sin nombre'}</td>
                            <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{formatDate(c.sent_at)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)' }}>{c.enviados}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontWeight: 700 }}>{pct(c.aperturas, c.enviados)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
