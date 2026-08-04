import { useState, useEffect, useCallback } from 'react';
import { SectionHead } from '../../components/SectionHead';
import { MetricCard } from '../../components/MetricCard';
import { AsyncState } from '../../components/AsyncState';
import { getSemaforo, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import { FacebookIcon, InstagramIcon, YoutubeIcon, TiktokIcon, GoogleIcon } from '../../components/PlatformIcons';
import type { DateRangeDays } from '../../components/DateRangeControl';
import { MetricsPageHeader } from '../../components/MetricsPageHeader';
import { downloadCsv } from '../../lib/exportCsv';
import type { SemaforoResponse } from '../../types';
import type { Screen } from '../../screens';

function ChannelCard({
  icon,
  iconBg,
  label,
  value,
  delta,
  disconnected,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  delta?: string | null;
  disconnected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-7)',
        cursor: 'pointer',
        boxSizing: 'border-box',
        width: '100%',
        boxShadow: 'var(--shadow-card)',
        opacity: disconnected ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        {disconnected ? (
          <div style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>
            Desconectado
          </div>
        ) : delta ? (
          <div style={{ background: 'var(--status-bien-bg)', color: 'var(--status-bien-dot)', fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>
            {delta}
          </div>
        ) : null}
      </div>
      <div style={{ textAlign: 'left', width: '100%' }}>
        <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{label}</div>
        <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: disconnected ? 'var(--text-faint)' : 'var(--text)', marginTop: 4 }}>
          {value}
        </div>
      </div>
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
  const [days, setDays] = useState<DateRangeDays>(30);

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

  const { data: report, loading: reportLoading, error: reportError, reload: reloadReport } = useMetricsReport(days);

  const s = data?.semaforo;
  const col2 = isDesktop ? '1fr 1fr' : '1fr';

  const handleExport = () => {
    const rows: (string | number | null)[][] = [
      ['Métricas — Resumen', `últimos ${days} días`],
      [],
      ['Email Marketing'],
      ['Métrica', 'Valor'],
      ['Leads/consultas nuevas 7 días', s?.leads_7d.valor.cantidad ?? ''],
      ['Open rate última campaña (%)', s?.open_rate_ultima_campana.valor ?? ''],
      [],
      ['Redes y SEO'],
      ['Canal', 'Valor', 'Detalle'],
      ['Facebook', report?.facebook.seguidores_actuales ?? '', 'seguidores'],
      ['Instagram', report?.social.seguidores_actuales ?? '', 'seguidores'],
      ['Youtube', report?.youtube.suscriptores_actuales ?? '', 'suscriptores'],
      ['SEO', report?.seo.posicion_actual ?? '', report?.seo.keyword ?? 'posición promedio'],
    ];
    downloadCsv(`metricas-resumen-${days}d.csv`, rows);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <MetricsPageHeader
          breadcrumb="Métricas"
          title="Rendimiento de Canales"
          isDesktop={isDesktop}
          days={days}
          onDaysChange={setDays}
          onExport={handleExport}
          exportDisabled={!s && !report}
        />

        {showEmail && (
          <div style={{ marginBottom: 40 }}>
            <SectionHead>Email Marketing</SectionHead>
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
            <SectionHead>Canales Conectados</SectionHead>
            <AsyncState loading={reportLoading} error={reportError} onRetry={reloadReport}>
              {report && (
                <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(2,1fr)' : 'repeat(1,1fr)', gap: 'var(--space-6)' }}>
                  <ChannelCard
                    icon={<FacebookIcon />}
                    iconBg="#e8f1f5"
                    label="Facebook"
                    value={`Alcance: ${report.facebook.seguidores_actuales?.toLocaleString('es-CL') ?? '—'}`}
                    delta={report.facebook.cambio_neto_7d != null ? `${report.facebook.cambio_neto_7d > 0 ? '+' : ''}${report.facebook.cambio_neto_7d} 7 días` : null}
                    onClick={() => onNavigate('metricas-facebook')}
                  />
                  <ChannelCard
                    icon={<InstagramIcon />}
                    iconBg="#fce8ec"
                    label="Instagram"
                    value={`Seguidores: ${report.social.seguidores_actuales?.toLocaleString('es-CL') ?? '—'}`}
                    delta={report.social.cambio_neto_periodo ? `${report.social.cambio_neto_periodo > 0 ? '+' : ''}${report.social.cambio_neto_periodo} seguidores` : null}
                    onClick={() => onNavigate('metricas-instagram')}
                  />
                  <ChannelCard
                    icon={<YoutubeIcon />}
                    iconBg="#feecec"
                    label="YouTube"
                    value={`Vistas: ${report.youtube.vistas_periodo?.toLocaleString('es-CL') ?? '—'}`}
                    delta={report.youtube.suscriptores_netos_7d ? `${report.youtube.suscriptores_netos_7d > 0 ? '+' : ''}${report.youtube.suscriptores_netos_7d} suscriptores` : null}
                    onClick={() => onNavigate('metricas-youtube')}
                  />
                  <ChannelCard
                    icon={<GoogleIcon />}
                    iconBg="#ebf7ed"
                    label="SEO Orgánico"
                    value={report.seo.posicion_actual !== null ? `Posición: #${report.seo.posicion_actual}` : '—'}
                    delta={report.seo.keyword ?? null}
                    onClick={() => onNavigate('metricas-seo')}
                  />
                  <ChannelCard
                    icon={<TiktokIcon />}
                    iconBg="#f1f3f5"
                    label="TikTok"
                    value="No Conectado"
                    disconnected
                    onClick={() => onNavigate('metricas-tiktok')}
                  />
                </div>
              )}
            </AsyncState>
          </div>
        )}
      </div>
    </div>
  );
}
