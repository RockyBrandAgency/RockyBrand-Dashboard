import { useState, useEffect, useCallback } from 'react';
import { SectionHead } from '../../components/SectionHead';
import { MetricCard } from '../../components/MetricCard';
import { AsyncState } from '../../components/AsyncState';
import { getSemaforo, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import type { SemaforoResponse } from '../../types';
import type { Screen } from '../../screens';

function ChannelCard({
  icon,
  label,
  value,
  sub,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
        cursor: 'pointer',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>→</span>
    </button>
  );
}

// "Resumen" de Métricas: Email Marketing (getSemaforo, sin cambios) +
// tarjetas reales de cada canal que gestionan los Agentes de IA, cada una
// clickeable hacia su página de detalle (Métricas > Facebook/Instagram/
// Youtube/SEO) - pedido explícito de Mato (2026-08-01), ya con datos
// reales conectados (compute_metrics_report).
export function MetricasResumen({ isDesktop, onNavigate }: { isDesktop: boolean; onNavigate: (screen: Screen) => void }) {
  const { handleUnauthorized, clientServices } = useAuth();
  const [data, setData] = useState<SemaforoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showEmail = !clientServices || clientServices.email_marketing;
  const showAgentsChannels = !clientServices || clientServices.agents;

  const load = useCallback(() => {
    if (!showEmail) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getSemaforo()
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized, showEmail]);

  useEffect(() => {
    load();
  }, [load]);

  const { data: report, loading: reportLoading, error: reportError, reload: reloadReport } = useMetricsReport();

  const s = data?.semaforo;
  const col2 = isDesktop ? '1fr 1fr' : '1fr';

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Métricas
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Resumen</h1>
        </div>

        {showEmail && (
          <div style={{ marginBottom: 40 }}>
            <SectionHead icon="✉️">Email Marketing</SectionHead>
            <AsyncState loading={loading} error={error} onRetry={load}>
              {s && (
                <div style={{ display: 'grid', gridTemplateColumns: col2, gap: 12 }}>
                  <MetricCard title="Leads / consultas nuevas 7 días" estado={s.leads_7d.estado} value={`${s.leads_7d.valor.cantidad}`} sub="Contactos nuevos" />
                  <MetricCard
                    title="Open rate última campaña"
                    estado={s.open_rate_ultima_campana.estado}
                    value={s.open_rate_ultima_campana.valor != null ? `${s.open_rate_ultima_campana.valor}%` : '—'}
                  />
                </div>
              )}
            </AsyncState>
          </div>
        )}

        {showAgentsChannels && (
          <div style={{ marginBottom: 40 }}>
            <SectionHead icon="📊">Redes y SEO</SectionHead>
            <AsyncState loading={reportLoading} error={reportError} onRetry={reloadReport}>
              {report && (
                <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: 12 }}>
                  <ChannelCard
                    icon="📘"
                    label="Facebook"
                    value={report.facebook.seguidores_actuales?.toLocaleString('es-CL') ?? '—'}
                    sub="seguidores"
                    onClick={() => onNavigate('metricas-facebook')}
                  />
                  <ChannelCard
                    icon="📷"
                    label="Instagram"
                    value={report.social.seguidores_actuales?.toLocaleString('es-CL') ?? '—'}
                    sub="seguidores"
                    onClick={() => onNavigate('metricas-instagram')}
                  />
                  <ChannelCard
                    icon="▶️"
                    label="Youtube"
                    value={report.youtube.suscriptores_actuales?.toLocaleString('es-CL') ?? '—'}
                    sub="suscriptores"
                    onClick={() => onNavigate('metricas-youtube')}
                  />
                  <ChannelCard
                    icon="🔍"
                    label="SEO"
                    value={report.seo.posicion_actual !== null ? `#${report.seo.posicion_actual}` : '—'}
                    sub={report.seo.keyword ?? 'posición promedio'}
                    onClick={() => onNavigate('metricas-seo')}
                  />
                  <ChannelCard icon="🎵" label="TikTok" value="—" sub="sin conectar" onClick={() => onNavigate('metricas-tiktok')} />
                </div>
              )}
            </AsyncState>
          </div>
        )}
      </div>
    </div>
  );
}
