import { useState, useEffect, useCallback, useMemo } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { KpiRow } from '../../components/KpiRow';
import { getTiendaGarantias, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { StoreGarantia } from '../../types';

function money(clp: number | undefined): string {
  return (clp ?? 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

function fmtWhen(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// El número de tramo solo dice algo si se sabe desde dónde se cuenta. Acá el
// 1 es la punta — mismo criterio que el formulario público, que se lo explica
// al cliente con esas mismas palabras.
const TRAMO_NOMBRE: Record<string, string> = {
  '1': 'Punta',
  '2': 'Segundo',
  '3': 'Tercero',
  '4': 'Base',
};

export function TiendaGarantias({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [garantias, setGarantias] = useState<StoreGarantia[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloReincidentes, setSoloReincidentes] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getTiendaGarantias()
      .then((r) => setGarantias(r.garantias))
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

  const kpis = useMemo(() => {
    const g = garantias ?? [];
    // Personas distintas, no solicitudes: dos tramos pedidos por la misma
    // persona son un caso, no dos clientes.
    const personas = new Set(g.map((x) => x.email)).size;
    const reincidentes = new Set(g.filter((x) => x.veces_usada > 1).map((x) => x.email)).size;
    const total = g.reduce((s, x) => s + (x.costo_clp || 0), 0);
    return { solicitudes: g.length, personas, reincidentes, total };
  }, [garantias]);

  const filtradas = useMemo(
    () => (garantias ?? []).filter((g) => !soloReincidentes || g.veces_usada > 1),
    [garantias, soloReincidentes],
  );

  const col = (w: number, extra?: React.CSSProperties): React.CSSProperties => ({ flexShrink: 0, width: w, ...extra });

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Garantías
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Solicitudes de reposición de tramos, tal como llegan del formulario de la web.
            </div>
          </div>
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {garantias && garantias.length > 0 && (
            <div style={{ marginBottom: 'var(--space-8)' }}>
              <KpiRow
                items={[
                  { label: 'Solicitudes', value: kpis.solicitudes, sub: 'en total' },
                  { label: 'Personas', value: kpis.personas, sub: 'distintas' },
                  { label: 'Repiten garantía', value: kpis.reincidentes, sub: 'con más de una solicitud' },
                  { label: 'Reposiciones', value: money(kpis.total), sub: 'sumando todas las solicitudes' },
                ]}
              />
            </div>
          )}

          {garantias && garantias.length === 0 && (
            <EmptyStateIllustrated
              icon={<span style={{ fontSize: 36 }}>🎣</span>}
              title="Aún no hay solicitudes de garantía"
              description="Cuando alguien pida reponer un tramo desde tienda.chileflyfishing.cl/garantia, va a aparecer acá con sus datos de despacho."
            />
          )}

          {garantias && garantias.length > 0 && (
            <>
              {kpis.reincidentes > 0 && (
                <button
                  onClick={() => setSoloReincidentes((v) => !v)}
                  aria-pressed={soloReincidentes}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 'var(--space-7)',
                    color: soloReincidentes ? 'var(--status-atencion-dot)' : 'var(--text-sub)',
                    background: soloReincidentes ? 'var(--status-atencion-bg)' : 'var(--border)',
                  }}
                >
                  {soloReincidentes ? '✓ ' : ''}Solo quienes ya pidieron antes
                </button>
              )}

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                {isDesktop && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#f9fafb',
                      borderBottom: '1px solid var(--border)',
                      padding: '12px 24px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-sub)',
                    }}
                  >
                    <span style={col(210)}>Cliente</span>
                    <span style={col(190)}>Caña</span>
                    <span style={col(130)}>Tramo</span>
                    <span style={col(110, { textAlign: 'center' })}>Veces</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>Fecha</span>
                  </div>
                )}

                {filtradas.map((g) => {
                  const repite = g.veces_usada > 1;
                  const abierto = abierta === g.solicitud_id;
                  return (
                    <div key={g.solicitud_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      {/* La fila entera abre el detalle. Los datos de despacho
                          no caben en una tabla, pero son justo lo que hay que
                          copiar para mandar el tramo — así que están a un
                          clic, no en otra pantalla. */}
                      <button
                        onClick={() => setAbierta(abierto ? null : g.solicitud_id)}
                        aria-expanded={abierto}
                        style={{
                          all: 'unset',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                          width: '100%',
                          display: 'flex',
                          flexDirection: isDesktop ? 'row' : 'column',
                          alignItems: isDesktop ? 'center' : 'flex-start',
                          gap: isDesktop ? 0 : 6,
                          padding: isDesktop ? '14px 24px' : '14px 16px',
                        }}
                      >
                        <span style={isDesktop ? col(210) : { display: 'block' }}>
                          <span style={{ display: 'block', fontWeight: 600, color: 'var(--text)', fontSize: isDesktop ? 13 : 14 }}>
                            {g.nombre || '—'}
                          </span>
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{g.email}</span>
                        </span>
                        <span style={isDesktop ? col(190, { fontSize: 13, color: 'var(--text-sub)' }) : { fontSize: 13, color: 'var(--text-sub)' }}>
                          {g.cana}
                          {g.modelo ? ` · ${g.modelo}` : ''}
                        </span>
                        <span style={isDesktop ? col(130, { fontSize: 13, color: 'var(--text-sub)' }) : { fontSize: 13, color: 'var(--text-sub)' }}>
                          {g.tramo} · {TRAMO_NOMBRE[g.tramo] ?? '—'}
                        </span>
                        <span style={isDesktop ? col(110, { textAlign: 'center' }) : { marginTop: 2 }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-sm)',
                              background: repite ? 'var(--status-atencion-bg)' : 'var(--status-neutro-bg)',
                              color: repite ? 'var(--status-atencion-dot)' : 'var(--text-sub)',
                            }}
                          >
                            {repite ? `${g.veces_usada}ª vez` : '1ª vez'}
                          </span>
                        </span>
                        <span style={isDesktop ? { flex: 1, textAlign: 'right', fontSize: 13, color: 'var(--text-sub)' } : { fontSize: 12, color: 'var(--text-muted)' }}>
                          {fmtWhen(g.created_at)}
                        </span>
                      </button>

                      {abierto && (
                        <div
                          style={{
                            padding: isDesktop ? '0 24px 18px' : '0 16px 18px',
                            display: 'grid',
                            gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
                            gap: 'var(--space-6)',
                          }}
                        >
                          <Dato label="Teléfono" valor={g.telefono} />
                          <Dato label="Dirección de despacho" valor={g.direccion} />
                          <Dato label="Costo de reposición" valor={money(g.costo_clp)} />
                          <Dato label="N° de solicitud" valor={g.solicitud_id} />
                          {g.descripcion && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <Dato label="Qué pasó" valor={g.descripcion} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filtradas.length === 0 && (
                  <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nadie ha pedido garantía más de una vez.
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

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 3, wordBreak: 'break-word' }}>{valor || '—'}</div>
    </div>
  );
}
