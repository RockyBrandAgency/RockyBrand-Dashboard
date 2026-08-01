import { useState, useEffect, useCallback } from 'react';
import { SectionHead } from '../../components/SectionHead';
import { MetricCard } from '../../components/MetricCard';
import { AsyncState } from '../../components/AsyncState';
import { getSemaforo, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { SemaforoResponse } from '../../types';

// Canales que gestionan los Agentes de IA (redes/SEO) - todavía sin ruta
// client-facing propia (hoy solo existen en el panel de staff, ver
// get_metrics_report en panel_config_api_lambda.py). Se muestran como
// estado honesto "próximamente", nunca con un número inventado - la
// conexión real es la fase siguiente del trabajo (gráficos y métricas de
// redes sociales), pedido explícito de Mato.
const CHANNELS_PROXIMAMENTE = [
  { icon: '📘', label: 'Facebook' },
  { icon: '📷', label: 'Instagram' },
  { icon: '▶️', label: 'YouTube' },
  { icon: '🎵', label: 'TikTok' },
  { icon: '🔍', label: 'SEO' },
];

function ChannelPlaceholder({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--white)',
        border: '1px dashed var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Próximamente</div>
      </div>
    </div>
  );
}

export function MetricasResumen({ isDesktop }: { isDesktop: boolean }) {
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
            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: 12 }}>
              {CHANNELS_PROXIMAMENTE.map((c) => (
                <ChannelPlaceholder key={c.label} {...c} />
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
              Los gráficos detallados de Meta y Google están en la sección correspondiente del menú.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
