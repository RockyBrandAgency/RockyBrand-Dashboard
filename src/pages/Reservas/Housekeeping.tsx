import { useState, useEffect, useCallback, useMemo } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { CalendarRangeIcon } from '../../components/icons/RockyIcons';
import { getHousekeeping, setRoomState, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { HousekeepingHabitacion, RoomState } from '../../types';

// Los 4 estados son los del backend (pms_frontdesk.VALID_ROOM_STATES), no
// una lista propia: mandar uno inventado devuelve 400. El ciclo estándar
// de un PMS es sucia → limpia → inspeccionada (la inspección es el visto
// bueno de gobernanta sobre el trabajo de la mucama), más "fuera de
// servicio" para lo que no se puede vender (mantención, daño).
const ESTADOS: { key: RoomState; label: string; corto: string; bg: string; fg: string }[] = [
  { key: 'DIRTY', label: 'Sin aseo', corto: 'Sin aseo', bg: 'var(--status-critico-bg)', fg: 'var(--status-critico-dot)' },
  { key: 'CLEAN', label: 'Limpia', corto: 'Limpia', bg: 'var(--status-bien-bg)', fg: 'var(--status-bien-dot)' },
  { key: 'INSPECTED', label: 'Inspeccionada', corto: 'Inspeccionada', bg: 'var(--status-bien-bg)', fg: 'var(--status-bien-dot)' },
  { key: 'OUT_OF_SERVICE', label: 'Fuera de servicio', corto: 'Fuera de servicio', bg: 'var(--status-neutro-bg)', fg: 'var(--status-neutro-text)' },
];

const ESTADO_META = Object.fromEntries(ESTADOS.map((e) => [e.key, e])) as Record<RoomState, (typeof ESTADOS)[number]>;

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtFechaLarga(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtActualizado(iso?: string | null): string {
  if (!iso) return 'sin registro';
  // El backend guarda UTC sin sufijo (datetime.utcnow().isoformat()) - sin
  // la Z, el navegador lo leería como hora local y mostraría 4 horas menos.
  const d = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return 'sin registro';
  return d.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const chip = (bg: string, fg: string): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 600,
  padding: '3px 8px',
  borderRadius: 'var(--radius-sm)',
  background: bg,
  color: fg,
  whiteSpace: 'nowrap',
});

// Housekeeping — tercer acceso del PMS, solo para clientes CON
// habitaciones (2026-08-11, pedido explícito de Mato: "identificar
// habitaciones sin aseo, confirmar que habitaciones están limpias, lo
// estandar de una funcionalidad como esta de un PMS"). Hoy eso es solo
// Alto Castillo; el gate es pms_room_views y no el client_id, porque el
// motivo real por el que no aplica a Chile Fly Fishing es que vende
// programas guiados y no tiene habitaciones que limpiar.
//
// Lo estándar de un tablero de housekeeping, que es justo lo que el
// backend ya calculaba para el panel de staff: estado de limpieza, si hay
// alguien adentro, si hoy sale alguien (hay que limpiarla) y si hoy entra
// alguien (tiene que estar lista). La pieza que sale y vuelve a entrar el
// mismo día es la urgente, y es la que se pasa por alto cuando el estado
// se lleva en un cuaderno.
export function Housekeeping({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized, clientDisplayName } = useAuth();
  const [fecha, setFecha] = useState(hoyISO());
  const [data, setData] = useState<HousekeepingHabitacion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState('');
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);
  const [notaTexto, setNotaTexto] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getHousekeeping(fecha)
      .then((r) => setData(r.habitaciones))
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [fecha, handleUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const resumen = useMemo(() => {
    const h = data ?? [];
    return {
      total: h.length,
      sinAseo: h.filter((x) => x.estado === 'DIRTY').length,
      listas: h.filter((x) => x.estado === 'CLEAN' || x.estado === 'INSPECTED').length,
      salidas: h.filter((x) => x.salida_hoy).length,
      llegadas: h.filter((x) => x.llegada_hoy).length,
      fueraDeServicio: h.filter((x) => x.estado === 'OUT_OF_SERVICE').length,
    };
  }, [data]);

  async function cambiar(hab: HousekeepingHabitacion, estado: RoomState, nota?: string) {
    if (guardando) return;
    setGuardando(hab.room_id);
    setErrorAccion('');
    try {
      await setRoomState(hab.room_id, estado, nota ?? hab.nota);
      setNotaAbierta(null);
      load();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo actualizar la habitación.');
    } finally {
      setGuardando(null);
    }
  }

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
              Housekeeping
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Estado de aseo de las habitaciones de {clientDisplayName ?? 'tu negocio'} · {fmtFechaLarga(fecha)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-sub)' }} htmlFor="hk-fecha">
              Día
            </label>
            <input
              id="hk-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value || hoyISO())}
              style={{ fontSize: 13, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--white)', color: 'var(--text)', fontFamily: 'inherit' }}
            />
            {fecha !== hoyISO() && (
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setFecha(hoyISO())}>
                Hoy
              </button>
            )}
          </div>
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {data && data.length === 0 && (
            <EmptyStateIllustrated
              icon={<CalendarRangeIcon size={36} />}
              title="No hay habitaciones cargadas"
              description="El tablero de aseo se arma con el catálogo de habitaciones del PMS. Cuando estén cargadas, cada una aparece acá con su estado."
            />
          )}

          {data && data.length > 0 && (
            <>
              <div className="crm-mini-dash">
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Sin aseo</div>
                  <div className={`crm-mini-value ${resumen.sinAseo ? 'critico' : 'ok'}`}>{resumen.sinAseo}</div>
                  <div className="crm-mini-sub">de {resumen.total} habitaciones</div>
                </div>
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Listas</div>
                  <div className="crm-mini-value ok">{resumen.listas}</div>
                  <div className="crm-mini-sub">Limpias o inspeccionadas</div>
                </div>
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Salidas del día</div>
                  <div className="crm-mini-value">{resumen.salidas}</div>
                  <div className="crm-mini-sub">Hay que limpiarlas hoy</div>
                </div>
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Llegadas del día</div>
                  <div className="crm-mini-value">{resumen.llegadas}</div>
                  <div className="crm-mini-sub">Tienen que estar listas</div>
                </div>
              </div>

              {errorAccion && (
                <div style={{ fontSize: 13, color: 'var(--status-critico-dot)', marginBottom: 'var(--space-6)' }}>{errorAccion}</div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {data.map((hab) => {
                  const meta = ESTADO_META[hab.estado] ?? ESTADO_META.CLEAN;
                  const urgente = hab.prioridad === 3;
                  return (
                    <div
                      key={hab.room_id}
                      style={{
                        background: 'var(--white)',
                        border: urgente ? '1px solid var(--status-critico-dot)' : '1px solid var(--border)',
                        borderLeft: `4px solid ${meta.fg}`,
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-7)',
                        boxShadow: 'var(--shadow-card)',
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{hab.room_id}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            <span style={chip(meta.bg, meta.fg)}>{meta.label}</span>
                            {hab.salida_hoy && <span style={chip('var(--status-atencion-bg)', 'var(--status-atencion-dot)')}>Sale hoy</span>}
                            {hab.llegada_hoy && <span style={chip('var(--status-atencion-bg)', 'var(--status-atencion-dot)')}>Llega hoy</span>}
                            {hab.ocupada_ahora && <span style={chip('var(--status-neutro-bg)', 'var(--status-neutro-text)')}>Ocupada</span>}
                            {urgente && <span style={chip('var(--status-critico-bg)', 'var(--status-critico-dot)')}>Prioridad: sale y entra hoy</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right' }}>
                          Actualizado: {fmtActualizado(hab.actualizado)}
                        </div>
                      </div>

                      {hab.nota && (
                        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 10, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                          {hab.nota}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'var(--space-6)', alignItems: 'center' }}>
                        {ESTADOS.map((e) => {
                          const activo = e.key === hab.estado;
                          return (
                            <button
                              key={e.key}
                              onClick={() => void cambiar(hab, e.key)}
                              disabled={activo || guardando === hab.room_id}
                              aria-pressed={activo}
                              title={activo ? 'Es el estado actual' : `Marcar como ${e.label.toLowerCase()}`}
                              style={{
                                all: 'unset',
                                boxSizing: 'border-box',
                                padding: '7px 12px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: activo || guardando === hab.room_id ? 'default' : 'pointer',
                                background: activo ? e.fg : 'var(--white)',
                                color: activo ? '#fff' : 'var(--text-sub)',
                                border: `1px solid ${activo ? e.fg : 'var(--border-strong, var(--border))'}`,
                                opacity: guardando === hab.room_id && !activo ? 0.5 : 1,
                              }}
                            >
                              {e.corto}
                            </button>
                          );
                        })}
                        <button
                          className="crm-btn crm-btn-ghost crm-btn-sm"
                          onClick={() => {
                            setNotaAbierta(notaAbierta === hab.room_id ? null : hab.room_id);
                            setNotaTexto(hab.nota);
                          }}
                        >
                          {hab.nota ? 'Editar nota' : 'Agregar nota'}
                        </button>
                        {guardando === hab.room_id && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Guardando…</span>}
                      </div>

                      {notaAbierta === hab.room_id && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                          <input
                            autoFocus
                            value={notaTexto}
                            onChange={(ev) => setNotaTexto(ev.target.value)}
                            placeholder="Ej. falta reponer toallas"
                            aria-label={`Nota de ${hab.room_id}`}
                            style={{ flex: 1, minWidth: 220, fontSize: 13, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', background: 'var(--white)', color: 'var(--text)' }}
                          />
                          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => void cambiar(hab, hab.estado, notaTexto.trim())}>
                            Guardar nota
                          </button>
                          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setNotaAbierta(null)}>
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 'var(--space-6)' }}>
                El orden lo decide la urgencia real del día: primero las que se desocupan y vuelven a recibir gente,
                después las que hay que limpiar hoy, y al final las que ya están listas.
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
