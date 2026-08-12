import { useState, useEffect, useCallback, useMemo } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { KpiRow } from '../../components/KpiRow';
import { getAgenciasReporte, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { AgenciaFila } from '../../types';

/**
 * Producción por agencia — la respuesta a "cuál agencia rinde más".
 *
 * Dos criterios que hacen que el número signifique algo:
 *
 * - **Solo lo CONFIRMADO cuenta como producción.** Una reserva pendiente
 *   se cae sola a las 48 horas si nadie paga; sumarla infla el ranking
 *   con ventas que no existieron. Lo pendiente se muestra aparte.
 * - **Se cuenta sobre las reservas reales del PMS**, no sobre un contador
 *   propio: un contador se desincroniza en cuanto alguien cancela algo a
 *   mano.
 *
 * Los montos NO se suman entre monedas: una agencia en CLP y otra en USD
 * no se pueden totalizar sin un tipo de cambio que nadie definió.
 */

function money(valor: number, moneda: string): string {
  if (!moneda) return valor.toLocaleString('es-CL');
  return valor.toLocaleString('es-CL', {
    style: 'currency',
    currency: moneda === 'USD' ? 'USD' : 'CLP',
    maximumFractionDigits: 0,
  });
}

function fmtFecha(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function AgenciasReporte({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [filas, setFilas] = useState<AgenciaFila[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAgenciasReporte(desde || undefined, hasta || undefined)
      .then((r) => setFilas(r.agencias))
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) { handleUnauthorized(); return; }
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized, desde, hasta]);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => {
    const f = filas ?? [];
    const activas = f.filter((x) => x.reservas > 0).length;
    const confirmadas = f.reduce((s, x) => s + x.confirmadas, 0);
    const noches = f.reduce((s, x) => s + x.noches, 0);
    // Solo las monedas que de verdad produjeron: mostrar "CLP 0" cuando
    // ninguna agencia en pesos vendió nada es ruido.
    const porMoneda = new Map<string, number>();
    for (const x of f) {
      if (x.monto_confirmado > 0) porMoneda.set(x.moneda, (porMoneda.get(x.moneda) ?? 0) + x.monto_confirmado);
    }
    return { activas, total: f.length, confirmadas, noches, porMoneda };
  }, [filas]);

  const campoFecha: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    background: 'var(--white)', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit',
  };

  const col = (w: number, extra?: React.CSSProperties): React.CSSProperties => ({ flexShrink: 0, width: w, ...extra });

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end',
            gap: 12, paddingBottom: 'var(--space-7)', borderBottom: '1px solid var(--border)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Producción por agencia
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Ordenado por lo efectivamente pagado. El rango filtra por fecha de llegada.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input style={campoFecha} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
            <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>a</span>
            <input style={campoFecha} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
          </div>
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {filas && filas.length === 0 && (
            <EmptyStateIllustrated
              icon={<span style={{ fontSize: 36 }}>📈</span>}
              title="Todavía no hay agencias para medir"
              description="Cuando cargues una agencia en la sección anterior, acá vas a ver cuántas reservas trajo, cuántas terminó pagando y cuánto significó eso."
            />
          )}

          {filas && filas.length > 0 && (
            <>
              <div style={{ marginBottom: 'var(--space-8)' }}>
                <KpiRow
                  items={[
                    { label: 'Agencias con ventas', value: kpis.activas, sub: `de ${kpis.total} cargadas` },
                    { label: 'Reservas pagadas', value: kpis.confirmadas, sub: 'confirmadas en el rango' },
                    { label: 'Noches vendidas', value: kpis.noches, sub: 'solo de reservas pagadas' },
                    ...[...kpis.porMoneda.entries()].map(([moneda, monto]) => ({
                      label: `Ingresos ${moneda}`,
                      value: money(monto, moneda),
                      sub: 'confirmado',
                    })),
                  ]}
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                {isDesktop && (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', background: '#f9fafb',
                      borderBottom: '1px solid var(--border)', padding: '12px 24px',
                      fontSize: 12, fontWeight: 600, color: 'var(--text-sub)',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>Agencia</span>
                    <span style={col(90, { textAlign: 'center' })}>Reservas</span>
                    <span style={col(90, { textAlign: 'center' })}>Pagadas</span>
                    <span style={col(80, { textAlign: 'center' })}>Noches</span>
                    <span style={col(90, { textAlign: 'center' })}>Conversión</span>
                    <span style={col(140, { textAlign: 'right' })}>Ingresos</span>
                  </div>
                )}

                {filas.map((fila) => (
                  <div
                    key={fila.agency_id}
                    style={{
                      display: 'flex', flexWrap: isDesktop ? 'nowrap' : 'wrap', alignItems: 'center',
                      gap: isDesktop ? 0 : 8, padding: isDesktop ? '14px 24px' : '14px 16px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: isDesktop ? 0 : '100%' }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        {fila.nombre}
                        {fila.estado === 'SUSPENDIDA' && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--status-critico-dot)', marginLeft: 8 }}>
                            suspendida
                          </span>
                        )}
                      </span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>
                        {fila.confirmadas > 0
                          ? `Ticket promedio ${money(fila.ticket_promedio, fila.moneda)} · última reserva ${fmtFecha(fila.ultima_reserva)}`
                          : 'Sin reservas pagadas todavía'}
                      </span>
                    </span>
                    <span style={isDesktop ? col(90, { textAlign: 'center' }) : {}}>
                      <Dato label="Reservas" valor={String(fila.reservas)} isDesktop={isDesktop} />
                    </span>
                    <span style={isDesktop ? col(90, { textAlign: 'center' }) : {}}>
                      <Dato label="Pagadas" valor={String(fila.confirmadas)} isDesktop={isDesktop} />
                    </span>
                    <span style={isDesktop ? col(80, { textAlign: 'center' }) : {}}>
                      <Dato label="Noches" valor={String(fila.noches)} isDesktop={isDesktop} />
                    </span>
                    <span style={isDesktop ? col(90, { textAlign: 'center' }) : {}}>
                      <Dato label="Conversión" valor={`${fila.conversion_pct}%`} isDesktop={isDesktop} />
                    </span>
                    <span style={isDesktop ? col(140, { textAlign: 'right' }) : {}}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                        {money(fila.monto_confirmado, fila.moneda)}
                      </span>
                      {fila.monto_pendiente > 0 && (
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>
                          {money(fila.monto_pendiente, fila.moneda)} sin pagar
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 14 }}>
                Los ingresos no se suman entre monedas: cada agencia se muestra en la moneda de su acuerdo.
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}

function Dato({ label, valor, isDesktop }: { label: string; valor: string; isDesktop: boolean }) {
  if (isDesktop) return <span style={{ fontSize: 14, color: 'var(--text)' }}>{valor}</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 6, fontSize: 12, color: 'var(--text-sub)', marginRight: 12 }}>
      {label}: <strong style={{ color: 'var(--text)' }}>{valor}</strong>
    </span>
  );
}
