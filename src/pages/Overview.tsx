import { useState, useEffect, useCallback } from 'react';
import { SectionHead } from '../components/SectionHead';
import { MetricCard } from '../components/MetricCard';
import { WeatherWidget } from '../components/WeatherWidget';
import { RoomGrid } from '../components/RoomGrid';
import { AsyncState } from '../components/AsyncState';
import { STATUS } from '../components/status';
import { getSemaforo, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import { CLIENT_LOCATION } from '../branding';
import type { SemaforoResponse } from '../types';

function formatMonto(montoPorMoneda: Record<string, number>): string {
  const entries = Object.entries(montoPorMoneda);
  if (entries.length === 0) return 'Sin monto nuevo';
  return entries.map(([currency, amount]) => `${currency} ${amount.toLocaleString('es-CL')}`).join(' · ');
}

function greetingByHour(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

// "Overview" (antes "Estado Actual", renombrado 2026-08-01) es un resumen
// ejecutivo puramente operativo (reservas, calendario, quién llega/quién
// se va, clima) - pedido explícito de Mato: "nada de métricas de
// marketing" acá. Leads/open-rate de email vivían antes en esta pantalla
// (sección "Ventas y Marketing") - se movieron a Métricas > Resumen
// (MetricasResumen.tsx), misma fuente de datos (getSemaforo), solo
// cambia dónde se muestra.
export function Overview({ onDetail, isDesktop }: { onDetail: () => void; isDesktop: boolean }) {
  const { handleUnauthorized, clientId } = useAuth();
  const location = clientId ? CLIENT_LOCATION[clientId] : undefined;
  const [data, setData] = useState<SemaforoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
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
  }, [handleUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const col2 = isDesktop ? '1fr 1fr' : '1fr';
  const s = data?.semaforo;
  const conBanderas = s?.llegadas_48h.valor.con_banderas ?? 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <AsyncState loading={loading} error={error} onRetry={load}>
          {s && (
            <>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  gap: 12,
                  paddingBottom: 'var(--space-7)',
                  borderBottom: '1px solid var(--border)',
                  marginBottom: 'var(--space-8)',
                }}
              >
                <h1 style={{ margin: 0, fontSize: isDesktop ? 'var(--font-size-3xl)' : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                  {greetingByHour()}
                </h1>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                  {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>

              {conBanderas > 0 && (
                <button
                  onClick={onDetail}
                  style={{
                    all: 'unset',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    background: STATUS.atencion.tagBg,
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-5) var(--space-7)',
                    marginBottom: 'var(--space-6)',
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, color: STATUS.atencion.dot }}>▲</span>
                  <div style={{ flex: 1, fontSize: 13, color: STATUS.atencion.tagText }}>
                    {conBanderas} huésped{conBanderas === 1 ? '' : 'es'} con indicaciones especiales llegan en las próximas 48 horas.
                    Haz clic para ver detalles.
                  </div>
                  <span style={{ fontSize: 16, color: STATUS.atencion.dot, flexShrink: 0, fontWeight: 700 }}>→</span>
                </button>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-5) var(--space-7)',
                  marginBottom: 'var(--space-8)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, color: 'var(--status-bien-dot)' }}>✓</span>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  {s.formulario_reservas_7d.cantidad}{' '}
                  {s.formulario_reservas_7d.cantidad === 1 ? 'usuario completó' : 'usuarios completaron'} el formulario de reservas esta semana.
                </div>
              </div>

              <div style={{ marginBottom: 'var(--space-10)' }}>
                <SectionHead>Ocupación de Habitaciones</SectionHead>
                <div style={{ display: 'grid', gridTemplateColumns: col2, gap: 'var(--space-6)' }}>
                  <MetricCard
                    title="Ocupación próximos 30 días"
                    estado={s.ocupacion_30d.estado}
                    value={s.ocupacion_30d.valor != null ? `${s.ocupacion_30d.valor}%` : '—'}
                    sub={s.ocupacion_30d.umbral_usado ? `Umbral verde ≥ ${(s.ocupacion_30d.umbral_usado as Record<string, number>).verde_pct}%` : undefined}
                  />
                  <MetricCard
                    title="Reservas nuevas esta semana"
                    estado={s.reservas_nuevas_7d.estado}
                    value={`${s.reservas_nuevas_7d.valor.cantidad} reserva${s.reservas_nuevas_7d.valor.cantidad === 1 ? '' : 's'}`}
                    sub={formatMonto(s.reservas_nuevas_7d.valor.monto_por_moneda)}
                  />
                </div>
                <div style={{ marginTop: 'var(--space-6)' }}>
                  <RoomGrid isDesktop={isDesktop} />
                </div>
              </div>

              <div style={{ marginBottom: 'var(--space-10)' }}>
                <SectionHead>Operación</SectionHead>
                <div style={{ display: 'grid', gridTemplateColumns: col2, gap: 'var(--space-6)' }}>
                  <MetricCard
                    title="Llegadas próximas 48 hrs"
                    estado={s.llegadas_48h.estado}
                    value={`${s.llegadas_48h.valor.cantidad} huésped${s.llegadas_48h.valor.cantidad === 1 ? '' : 'es'}`}
                    sub={conBanderas > 0 ? `${conBanderas} con indicaciones especiales` : 'Sin indicaciones especiales'}
                    onClick={onDetail}
                  />
                  <MetricCard title="Sincronización de reservas" estado={s.estado_sincronizacion.estado} value="—" />
                </div>
              </div>

              {location && <WeatherWidget location={location} />}
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
