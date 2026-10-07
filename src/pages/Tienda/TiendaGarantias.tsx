import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { AvisoFlotante, type Aviso } from '../../components/AvisoFlotante';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { KpiRow } from '../../components/KpiRow';
import { eliminarTiendaGarantia, getTiendaGarantias, restaurarTiendaGarantia, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { StoreGarantia } from '../../types';
import { GarantiaFicha } from './GarantiaFicha';
import { ESTADOS_GARANTIA as ESTADOS, TRAMO_NOMBRE, fmtMomento, money } from './garantias';

type Vista = 'activas' | 'eliminadas';

// Ancho fijo para que «Restaurando…» no mueva la fila y el encabezado
// reserve el mismo espacio.
const ANCHO_RESTAURAR = 120;

const porFecha = (a: StoreGarantia, b: StoreGarantia) => b.created_at.localeCompare(a.created_at);

export function TiendaGarantias({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [garantias, setGarantias] = useState<StoreGarantia[] | null>(null);
  // La papelera (2026-10-07, decisión de Mato): no cuenta en la lista ni en
  // los indicadores, y desde acá se restaura.
  const [eliminadas, setEliminadas] = useState<StoreGarantia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('activas');
  const [soloReincidentes, setSoloReincidentes] = useState(false);
  // null = cerrada; sin garantía = agregar una. La garantía es la copia que
  // había al abrir: recargar la lista no le cambia los datos a una ficha que
  // alguien está editando. `n` la vuelve a montar cuando se reemplaza a
  // propósito (al restaurarla, o al traer la versión actual tras un 409).
  const [ficha, setFicha] = useState<{ garantia?: StoreGarantia; n: number } | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [restaurando, setRestaurando] = useState<string | null>(null);
  const contador = useRef(0);

  const avisar = (texto: string, extra?: Omit<Aviso, 'id' | 'texto'>) => setAviso({ id: ++contador.current, texto, ...extra });
  const cerrarAviso = useCallback(() => setAviso(null), []);
  const abrir = (g?: StoreGarantia) => setFicha({ garantia: g, n: ++contador.current });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getTiendaGarantias()
      .then((r) => {
        setGarantias(r.garantias);
        setEliminadas(r.eliminadas ?? []);
      })
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized]);

  // Después de guardar, eliminar o restaurar: trae la lista sin el estado de
  // carga, así la pantalla no parpadea. `veces_usada` se recalcula en el
  // backend, por eso no se arma la fila a mano.
  const recargarEnSilencio = useCallback(
    () =>
      getTiendaGarantias()
        .then((r) => {
          setGarantias(r.garantias);
          setEliminadas(r.eliminadas ?? []);
          return r;
        })
        .catch((e: unknown) => {
          if (e instanceof UnauthorizedError) handleUnauthorized();
          return null;
        }),
    [handleUnauthorized],
  );

  useEffect(() => {
    load();
  }, [load]);

  // La ficha espera la respuesta antes de cerrarse: si falla, el error queda
  // a la vista en la ficha y no hay una fila que desaparece y vuelve.
  async function eliminar(g: StoreGarantia) {
    const r = await eliminarTiendaGarantia(g.solicitud_id);
    const marcada = { ...g, eliminada_en: r.eliminada_en, actualizada_en: r.actualizada_en };
    setGarantias((prev) => (prev ?? []).filter((x) => x.solicitud_id !== g.solicitud_id));
    setEliminadas((prev) => [marcada, ...prev.filter((x) => x.solicitud_id !== g.solicitud_id)]);
    setFicha(null);
    avisar(`Eliminaste la garantía de ${g.nombre || g.solicitud_id}.`, {
      accion: { label: 'Deshacer', deshacer: true, onClick: () => void restaurar(marcada, 'deshacer') },
    });
    void recargarEnSilencio();
  }

  async function restaurar(g: StoreGarantia, desde: 'deshacer' | 'lista' | 'ficha') {
    if (desde === 'deshacer') avisar('Restaurando…');
    if (desde === 'lista') setRestaurando(g.solicitud_id);
    try {
      const r = await restaurarTiendaGarantia(g.solicitud_id);
      const viva = { ...g, eliminada_en: '', actualizada_en: r.actualizada_en };
      setEliminadas((prev) => prev.filter((x) => x.solicitud_id !== g.solicitud_id));
      setGarantias((prev) => [viva, ...(prev ?? []).filter((x) => x.solicitud_id !== g.solicitud_id)].sort(porFecha));
      if (desde === 'ficha') abrir(viva);
      avisar(
        desde === 'deshacer' ? 'Listo: la garantía volvió a la lista.' : `Restauraste la garantía de ${g.nombre || g.solicitud_id}.`,
        desde === 'lista'
          ? {
              accion: {
                label: 'Abrir',
                onClick: () => {
                  setVista('activas');
                  abrir(viva);
                  setAviso(null);
                },
              },
            }
          : undefined,
      );
      void recargarEnSilencio();
    } catch (e) {
      // Desde la ficha, el error lo muestra la ficha.
      if (desde === 'ficha') throw e;
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      avisar(`No se pudo restaurar: ${e instanceof Error ? e.message : 'error de red'}.`, { tono: 'error' });
    } finally {
      setRestaurando(null);
    }
  }

  // Tras un 409: la versión guardada reemplaza lo que la ficha tenía.
  async function verActual() {
    const id = ficha?.garantia?.solicitud_id;
    if (!id) return;
    const r = await recargarEnSilencio();
    const actual = r && [...r.garantias, ...(r.eliminadas ?? [])].find((x) => x.solicitud_id === id);
    if (actual) {
      abrir(actual);
    } else {
      setFicha(null);
      avisar('No se pudo traer la versión actual. Recarga la página.', { tono: 'error' });
    }
  }

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
  const encabezado: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: '#f9fafb',
    borderBottom: '1px solid var(--border)',
    padding: '12px 24px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-sub)',
  };
  const tabla: React.CSSProperties = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' };
  const conPapelera = eliminadas.length > 0 || vista === 'eliminadas';

  function pastillaEstado(g: StoreGarantia) {
    const meta = ESTADOS.find((e) => e.key === g.estado);
    return (
      <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: meta?.bg, color: meta?.fg }}>
        {meta?.label ?? g.estado}
      </span>
    );
  }

  function vecesBadge(g: StoreGarantia) {
    const repite = g.veces_usada > 1;
    return (
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          background: repite ? 'var(--status-atencion-bg)' : 'var(--status-neutro-bg)',
          color: repite ? 'var(--status-atencion-text)' : 'var(--text-sub)',
        }}
      >
        {repite ? `${g.veces_usada}ª vez` : '1ª vez'}
      </span>
    );
  }

  const unaLinea: React.CSSProperties = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  function celdasComunes(g: StoreGarantia) {
    return (
      <>
        {/* El cliente se queda con el ancho que sobra: un nombre largo no se
            corta mientras haya espacio en la fila. */}
        <span style={{ flex: '1 1 210px', minWidth: 0, paddingRight: 12, boxSizing: 'border-box' }}>
          <span style={{ ...unaLinea, fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{g.nombre || '—'}</span>
          <span style={{ ...unaLinea, fontSize: 12, color: 'var(--text-muted)' }} title={g.email || undefined}>
            {g.email || g.telefono || 'Sin correo'}
          </span>
        </span>
        <span style={col(190, { ...unaLinea, paddingRight: 12, boxSizing: 'border-box', fontSize: 13, color: 'var(--text-sub)' })}>
          {g.cana}
          {g.modelo ? ` · ${g.modelo}` : ''}
        </span>
        <span style={col(120, { fontSize: 13, color: 'var(--text-sub)' })}>
          {g.tramo} · {TRAMO_NOMBRE[g.tramo] ?? '—'}
        </span>
        <span style={col(130)}>{pastillaEstado(g)}</span>
      </>
    );
  }

  // En el celular, tres líneas en vez de siete: quién y cuándo, qué caña, y
  // en qué va. El correo y el teléfono están en la ficha.
  function filaMovil(g: StoreGarantia, cuando: string, extra?: React.ReactNode) {
    return (
      <>
        <span style={{ display: 'flex', width: '100%', alignItems: 'baseline', gap: 8 }}>
          <span style={{ ...unaLinea, flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{g.nombre || '—'}</span>
          <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>{cuando}</span>
        </span>
        <span style={{ ...unaLinea, width: '100%', fontSize: 13, color: 'var(--text-sub)' }}>
          {g.cana}
          {g.modelo ? ` · ${g.modelo}` : ''} · Tramo {g.tramo} ({TRAMO_NOMBRE[g.tramo] ?? '—'})
        </span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          {pastillaEstado(g)}
          {extra}
        </span>
      </>
    );
  }

  const fila: React.CSSProperties = {
    all: 'unset',
    boxSizing: 'border-box',
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    flexDirection: isDesktop ? 'row' : 'column',
    alignItems: isDesktop ? 'center' : 'flex-start',
    gap: isDesktop ? 0 : 4,
    padding: isDesktop ? '14px 24px' : '14px 16px',
  };

  const listaActivas = (
    <div style={tabla}>
      {isDesktop && (
        <div style={encabezado}>
          <span style={{ flex: '1 1 210px', minWidth: 0 }}>Cliente</span>
          <span style={col(190)}>Caña</span>
          <span style={col(120)}>Tramo</span>
          <span style={col(130)}>Estado</span>
          <span style={col(95, { textAlign: 'center' })}>Veces</span>
          <span style={col(130, { textAlign: 'right' })}>Fecha</span>
          <span style={col(24)} />
        </div>
      )}
      {filtradas.map((g) => (
        // La fila entera abre la ficha, editable ahí mismo.
        <button key={g.solicitud_id} onClick={() => abrir(g)} aria-haspopup="dialog" style={{ ...fila, borderBottom: '1px solid var(--border-soft)' }}>
          {isDesktop ? (
            <>
              {celdasComunes(g)}
              <span style={col(95, { textAlign: 'center' })}>{vecesBadge(g)}</span>
              <span style={col(130, { textAlign: 'right', fontSize: 13, color: 'var(--text-sub)' })}>{fmtMomento(g.created_at)}</span>
              <span aria-hidden="true" style={col(24, { textAlign: 'right', fontSize: 18, color: 'var(--text-faint)' })}>
                ›
              </span>
            </>
          ) : (
            filaMovil(g, fmtMomento(g.created_at), g.veces_usada > 1 ? vecesBadge(g) : null)
          )}
        </button>
      ))}
      {filtradas.length === 0 && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>Nadie ha pedido garantía más de una vez.</div>
      )}
    </div>
  );

  const listaEliminadas =
    eliminadas.length === 0 ? (
      <div className="crm-empty" style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
        No hay garantías eliminadas.
      </div>
    ) : (
      <>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 'var(--space-5)' }}>
          No cuentan en los indicadores ni en las veces de cada persona. Restaura una y vuelve a la lista tal como estaba.
        </div>
        <div style={tabla}>
          {isDesktop && (
            <div style={encabezado}>
              <span style={{ flex: '1 1 210px', minWidth: 0 }}>Cliente</span>
              <span style={col(190)}>Caña</span>
              <span style={col(120)}>Tramo</span>
              <span style={col(130)}>Estado</span>
              <span style={col(130)}>Eliminada</span>
              {/* El hueco de Restaurar en cada fila: botón + separación + margen
                  derecho. Sin él, el cliente flexible del encabezado se estira
                  más que el de la fila y las columnas no calzan. */}
              <span style={col(ANCHO_RESTAURAR + 8 + 16)} />
            </div>
          )}
          {eliminadas.map((g) => (
            <div
              key={g.solicitud_id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: isDesktop ? 16 : 12, borderBottom: '1px solid var(--border-soft)' }}
            >
              <button onClick={() => abrir(g)} aria-haspopup="dialog" style={{ ...fila, flex: 1, minWidth: 0 }}>
                {isDesktop ? (
                  <>
                    {celdasComunes(g)}
                    <span style={col(130, { fontSize: 13, color: 'var(--text-sub)' })}>{fmtMomento(g.eliminada_en)}</span>
                  </>
                ) : (
                  filaMovil(g, '', <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Eliminada {fmtMomento(g.eliminada_en)}</span>)
                )}
              </button>
              <button
                className="crm-btn crm-btn-ghost crm-btn-sm"
                style={{ width: ANCHO_RESTAURAR, flexShrink: 0 }}
                onClick={() => void restaurar(g, 'lista')}
                disabled={restaurando === g.solicitud_id}
                aria-label={`Restaurar la garantía de ${g.nombre || g.solicitud_id}`}
              >
                {restaurando === g.solicitud_id ? 'Restaurando…' : 'Restaurar'}
              </button>
            </div>
          ))}
        </div>
      </>
    );

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
            <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>Garantías</h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Solicitudes de reposición de tramos: las del formulario de la web y las que agregas a mano.
            </div>
          </div>
          <button className="crm-btn crm-btn-primary" onClick={() => abrir()}>
            + Agregar garantía
          </button>
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {/* El selector de vista va primero: debajo de los indicadores
              saltaba hacia arriba al ocultarlos, justo bajo el puntero. */}
          {garantias && conPapelera && (
            <div style={{ marginBottom: 'var(--space-7)' }}>
              <div role="group" aria-label="Qué garantías ver" style={{ display: 'flex', gap: 4 }}>
                {(
                  [
                    ['activas', 'Activas', garantias.length],
                    ['eliminadas', 'Eliminadas', eliminadas.length],
                  ] as const
                ).map(([clave, nombre, cuantas]) => (
                  <button key={clave} className="crm-btn crm-btn-sm crm-btn-text" aria-pressed={vista === clave} onClick={() => setVista(clave)}>
                    {nombre} <span style={{ fontWeight: 400, opacity: 0.75 }}>{cuantas}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {garantias && garantias.length > 0 && vista === 'activas' && (
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

          {garantias && vista === 'activas' && kpis.reincidentes > 0 && (
            <div style={{ marginBottom: 'var(--space-7)' }}>
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
                  color: soloReincidentes ? 'var(--status-atencion-text)' : 'var(--text-sub)',
                  background: soloReincidentes ? 'var(--status-atencion-bg)' : 'var(--border)',
                }}
              >
                {soloReincidentes ? '✓ ' : ''}Solo quienes ya pidieron antes
              </button>
            </div>
          )}

          {garantias && vista === 'activas' && garantias.length === 0 && (
            <EmptyStateIllustrated
              icon={<span style={{ fontSize: 36 }}>🎣</span>}
              title={eliminadas.length > 0 ? 'No hay garantías activas' : 'Aún no hay solicitudes de garantía'}
              description={
                eliminadas.length > 0
                  ? 'Las que eliminaste están en Eliminadas, de donde se restauran.'
                  : 'Cuando alguien pida reponer un tramo desde tienda.chileflyfishing.cl/garantia, o cuando agregues una a mano, va a aparecer acá con sus datos de despacho.'
              }
            />
          )}
          {garantias && vista === 'activas' && garantias.length > 0 && listaActivas}
          {garantias && vista === 'eliminadas' && listaEliminadas}
        </AsyncState>
      </div>

      {ficha && (
        <GarantiaFicha
          key={ficha.n}
          garantia={ficha.garantia}
          isDesktop={isDesktop}
          onClose={() => setFicha(null)}
          onGuardado={() => {
            const nueva = !ficha.garantia;
            setFicha(null);
            if (nueva) setVista('activas');
            avisar(nueva ? 'Agregaste la garantía.' : 'Guardaste los cambios.');
            void recargarEnSilencio();
          }}
          onEliminar={eliminar}
          onRestaurar={(g) => restaurar(g, 'ficha')}
          onVerActual={() => void verActual()}
        />
      )}
      {aviso && <AvisoFlotante key={aviso.id} aviso={aviso} isDesktop={isDesktop} onCerrar={cerrarAviso} />}
    </div>
  );
}
