import { useState, useEffect, useCallback, useMemo } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { KpiRow } from '../../components/KpiRow';
import { getTiendaGarantias, actualizarTiendaGarantia, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { StoreGarantia, StoreGarantiaEstado } from '../../types';
import { GarantiaFormModal } from './GarantiaFormModal';
import { ESTADOS_GARANTIA as ESTADOS, TRAMO_NOMBRE, fmtFecha, margen, money } from './garantias';

function fmtWhen(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function TiendaGarantias({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [garantias, setGarantias] = useState<StoreGarantia[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloReincidentes, setSoloReincidentes] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  // null = cerrado; {} = agregar una nueva; { garantia } = editar esa.
  const [formulario, setFormulario] = useState<{ garantia?: StoreGarantia } | null>(null);

  // Se actualiza la fila en memoria en vez de recargar la lista entera: el
  // backend ya confirmó el cambio, y recargar haría parpadear la pantalla y
  // cerraría el detalle que la persona tiene abierto.
  async function cambiarEstado(g: StoreGarantia, estado: StoreGarantiaEstado) {
    if (g.estado === estado) return;
    setGuardando(g.solicitud_id);
    setErrorGuardar(null);
    try {
      const r = await actualizarTiendaGarantia(g.solicitud_id, estado);
      setGarantias((prev) =>
        (prev ?? []).map((x) =>
          x.solicitud_id === g.solicitud_id ? { ...x, estado, actualizada_en: r.actualizada_en ?? x.actualizada_en } : x,
        ),
      );
      // Al pasar a Despachada o Entregada el backend completa la fecha si
      // faltaba: se trae sin parpadeo para que el detalle la muestre.
      recargarEnSilencio();
    } catch (e: unknown) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
        return;
      }
      setErrorGuardar(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(null);
    }
  }

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

  // Después de guardar: trae la lista sin el estado de carga, así la
  // pantalla no parpadea ni se cierra el detalle abierto. `veces_usada` se
  // recalcula en el backend, por eso no se arma la fila a mano.
  const recargarEnSilencio = useCallback(() => {
    getTiendaGarantias()
      .then((r) => setGarantias(r.garantias))
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) handleUnauthorized();
      });
  }, [handleUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(() => {
    const g = garantias ?? [];
    // Personas distintas, no solicitudes: dos tramos pedidos por la misma
    // persona son un caso, no dos clientes.
    // `persona` es el correo o, sin correo (las agregadas a mano), el teléfono.
    const personas = new Set(g.map((x) => x.persona ?? x.email)).size;
    const reincidentes = new Set(g.filter((x) => x.veces_usada > 1).map((x) => x.persona ?? x.email)).size;
    const total = g.reduce((s, x) => s + (x.costo_clp || 0), 0);
    const pendientes = g.filter((x) => x.estado === 'recibida' || x.estado === 'en_revision').length;
    return { solicitudes: g.length, personas, reincidentes, total, pendientes };
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
              Solicitudes de reposición de tramos: las del formulario de la web y las que agregas a mano.
            </div>
          </div>
          <button className="crm-btn crm-btn-primary" onClick={() => setFormulario({})}>
            + Agregar garantía
          </button>
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {garantias && garantias.length > 0 && (
            <div style={{ marginBottom: 'var(--space-8)' }}>
              <KpiRow
                items={[
                  { label: 'Por atender', value: kpis.pendientes, sub: `de ${kpis.solicitudes} en total` },
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
              description="Cuando alguien pida reponer un tramo desde tienda.chileflyfishing.cl/garantia, o cuando agregues una a mano, va a aparecer acá con sus datos de despacho."
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
                    <span style={col(120)}>Tramo</span>
                    <span style={col(130)}>Estado</span>
                    <span style={col(95, { textAlign: 'center' })}>Veces</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>Fecha</span>
                  </div>
                )}

                {filtradas.map((g) => {
                  const repite = g.veces_usada > 1;
                  const abierto = abierta === g.solicitud_id;
                  const estadoMeta = ESTADOS.find((e) => e.key === g.estado);
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
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{g.email || g.telefono || 'Sin correo'}</span>
                        </span>
                        <span style={isDesktop ? col(190, { fontSize: 13, color: 'var(--text-sub)' }) : { fontSize: 13, color: 'var(--text-sub)' }}>
                          {g.cana}
                          {g.modelo ? ` · ${g.modelo}` : ''}
                        </span>
                        <span style={isDesktop ? col(120, { fontSize: 13, color: 'var(--text-sub)' }) : { fontSize: 13, color: 'var(--text-sub)' }}>
                          {g.tramo} · {TRAMO_NOMBRE[g.tramo] ?? '—'}
                        </span>
                        <span style={isDesktop ? col(130) : { marginTop: 2 }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-sm)',
                              background: estadoMeta?.bg,
                              color: estadoMeta?.fg,
                            }}
                          >
                            {estadoMeta?.label ?? g.estado}
                          </span>
                        </span>
                        <span style={isDesktop ? col(95, { textAlign: 'center' }) : { marginTop: 2 }}>
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
                            gridTemplateColumns: isDesktop ? '1fr 1fr 1fr' : '1fr',
                            gap: 'var(--space-6)',
                          }}
                        >
                          <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              N° {g.solicitud_id} · {g.origen === 'manual' ? 'Agregada a mano' : 'Formulario web'}
                            </span>
                            <button className="crm-btn crm-btn-tonal crm-btn-sm" onClick={() => setFormulario({ garantia: g })}>
                              Editar garantía
                            </button>
                          </div>
                          <Dato label="Teléfono" valor={g.telefono} />
                          <Dato label="Correo" valor={g.email} />
                          <Dato label="Dirección de despacho" valor={g.direccion} />
                          <Dato label="Empresa de transporte" valor={g.courier} />
                          <Dato label="N° de seguimiento" valor={g.numero_seguimiento} />
                          <Dato label="Despachada el" valor={g.fecha_despacho ? fmtFecha(g.fecha_despacho) : ''} />
                          <Dato label="Recibida por el cliente el" valor={g.fecha_entrega ? fmtFecha(g.fecha_entrega) : ''} />
                          <Dato
                            label="Pago"
                            valor={g.pagado ? `Pagado${g.fecha_pago ? ` el ${fmtFecha(g.fecha_pago)}` : ''}` : 'Pendiente'}
                          />
                          <Dato label="Precio al cliente" valor={money(g.costo_clp)} />
                          <Dato label="Costo de despacho" valor={g.costo_despacho_clp === null || g.costo_despacho_clp === undefined ? '' : money(g.costo_despacho_clp)} />
                          <Dato label="Costo pagado a Douglas" valor={g.costo_douglas_clp === null || g.costo_douglas_clp === undefined ? '' : money(g.costo_douglas_clp)} />
                          <Dato label="Margen" valor={margenDe(g)} />
                          {g.descripcion && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <Dato label="Qué pasó" valor={g.descripcion} />
                            </div>
                          )}
                          {g.nota_interna && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <Dato label="Nota interna" valor={g.nota_interna} />
                            </div>
                          )}
                          <div style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>
                              Marcar como
                            </div>
                            <div role="radiogroup" aria-label="Estado de la solicitud" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {ESTADOS.map((e) => {
                                const activo = g.estado === e.key;
                                return (
                                  <button
                                    key={e.key}
                                    role="radio"
                                    aria-checked={activo}
                                    disabled={guardando === g.solicitud_id}
                                    onClick={() => cambiarEstado(g, e.key)}
                                    style={{
                                      all: 'unset',
                                      cursor: guardando === g.solicitud_id ? 'wait' : 'pointer',
                                      padding: '7px 14px',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: 13,
                                      fontWeight: activo ? 700 : 500,
                                      background: activo ? e.bg : 'var(--border)',
                                      color: activo ? e.fg : 'var(--text-sub)',
                                      opacity: guardando === g.solicitud_id ? 0.6 : 1,
                                    }}
                                  >
                                    {activo ? '✓ ' : ''}
                                    {e.label}
                                  </button>
                                );
                              })}
                            </div>
                            {errorGuardar && (
                              <div role="alert" style={{ marginTop: 8, fontSize: 13, color: 'var(--status-critico-dot)' }}>
                                {errorGuardar}
                              </div>
                            )}
                          </div>
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

      {formulario && (
        <GarantiaFormModal
          garantia={formulario.garantia}
          onClose={() => setFormulario(null)}
          onGuardado={(id) => {
            setFormulario(null);
            setAbierta(id);
            recargarEnSilencio();
          }}
        />
      )}
    </div>
  );
}

// Las garantías anteriores al 2026-10-07 no tienen costos cargados: sin
// costos no hay margen que mostrar.
function margenDe(g: StoreGarantia): string {
  const m = margen({ costo_clp: g.costo_clp, costo_despacho_clp: g.costo_despacho_clp ?? null, costo_douglas_clp: g.costo_douglas_clp ?? null });
  return m === null ? '' : money(m);
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
