import { useState, useEffect, useCallback } from 'react';
import { BadgePrograma, PaisPescador } from '../components/BadgePrograma';
import { personasDe } from '../lib/personas';
import { SectionHead } from '../components/SectionHead';
import { MetricCard } from '../components/MetricCard';
import { WeatherWidget } from '../components/WeatherWidget';
import { RoomGrid } from '../components/RoomGrid';
import { ReservationCalendar } from '../components/ReservationCalendar';
import { AsyncState } from '../components/AsyncState';
import { STATUS } from '../components/status';
import { getSemaforo, getReservasResumen, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import { FichaPescador } from './Reservas/FichaPescador';
import { useRetornoFicha } from '../hooks/useRetornoFicha';
import { diasEntre, fmtMonto, hoyLocalISO, llegadasProximas, PAGO_LABEL } from '../lib/fichaPescador';
import type { Screen } from '../screens';
import { CLIENT_LOCATION } from '../branding';
import { terminologiaPms } from '../lib/terminologiaPms';
import { temporadaActualCff, CFF_CLIENT_ID } from '../lib/temporadaCff';
import type { SemaforoResponse, ReservaResumenItem, ReservasKpis } from '../types';

function formatMonto(montoPorMoneda: Record<string, number>): string {
  const entries = Object.entries(montoPorMoneda);
  if (entries.length === 0) return 'Sin monto nuevo';
  return entries.map(([currency, amount]) => `${currency} ${amount.toLocaleString('es-CL')}`).join(' · ');
}

const PAGO_CHIP: Record<string, { bg: string; fg: string }> = {
  PAID: { bg: 'var(--status-bien-bg)', fg: 'var(--status-bien-text)' },
  PARTIAL: { bg: 'var(--status-atencion-bg)', fg: 'var(--status-atencion-text)' },
  PENDING: { bg: 'var(--status-critico-bg)', fg: 'var(--status-critico-text)' },
};

const MAX_LLEGADAS = 8;

function fmtCorta(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function cuandoLlega(hoy: string, checkIn: string): string {
  const n = diasEntre(hoy, checkIn);
  if (n <= 0) return 'Llega hoy';
  if (n === 1) return 'Llega mañana';
  return `En ${n} días`;
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
// 5.0.0 (solo la rama sin habitaciones, que es la de Chile Fly Fishing): lo
// primero es quién llega en los próximos 30 días, cada fila abre la ficha del
// pescador, y la tarjeta «Reservas de {mes}» sale de `kpis` del backend.
// Salen de esta rama el calendario (sigue en su pantalla), «Reservas nuevas
// esta semana» y «Sincronización de reservas», que siempre mostraba «—».
// La rama con habitaciones (Alto Castillo) no cambia.
export function Overview({ onDetail, isDesktop, onNavigate }: { onDetail: () => void; isDesktop: boolean; onNavigate?: (s: Screen) => void }) {
  const { handleUnauthorized, clientId, clientDisplayName, pmsRoomViews, clientTerminologia, features } = useAuth();
  // Un solo gate para el Overview nuevo: sin habitaciones Y con la bandera
  // pms_ficha_pesca. Sin la bandera se ve exactamente lo de antes.
  const nuevo = !pmsRoomViews && features?.pms_ficha_pesca === true;
  // Overview es la PRIMERA pantalla: decir "huéspedes" acá mientras el
  // sidebar dice "Viajeros" hace que el panel se contradiga a sí mismo
  // sobre cómo se llaman los clientes de quien lo mira.
  const term = terminologiaPms(clientId, clientTerminologia);
  const location = clientId ? CLIENT_LOCATION[clientId] : undefined;
  const temporada = clientId === CFF_CLIENT_ID ? temporadaActualCff(new Date()) : null;
  const [data, setData] = useState<SemaforoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservas, setReservas] = useState<ReservaResumenItem[] | null>(null);
  const [reservasLoading, setReservasLoading] = useState(true);
  const [reservasError, setReservasError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<ReservasKpis | null>(null);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const { scrollRef, recordar } = useRetornoFicha(fichaId !== null);

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

  // Solo hace falta para el calendario (clientes sin habitaciones) - se
  // pide igual siempre para no depender de un orden de carga entre
  // pmsRoomViews (llega con /dashboard/me, async) y este fetch.
  const loadReservas = useCallback(() => {
    setReservasLoading(true);
    setReservasError(null);
    getReservasResumen()
      .then((r) => {
        setReservas(r.reservas);
        setKpis(r.kpis ?? null);
      })
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setReservasError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setReservasLoading(false));
  }, [handleUnauthorized]);

  useEffect(() => {
    load();
    loadReservas();
  }, [load, loadReservas]);

  const col2 = isDesktop ? '1fr 1fr' : '1fr';
  const s = data?.semaforo;
  const conBanderas = s?.llegadas_48h.valor.con_banderas ?? 0;
  const irCalendario = onNavigate ? () => onNavigate('servicio-pms-reservas') : undefined;

  if (nuevo && fichaId && reservas) {
    return (
      <FichaPescador
        bookingId={fichaId}
        reservas={reservas}
        volverA="Overview"
        isDesktop={isDesktop}
        onVolver={() => setFichaId(null)}
        onCambio={loadReservas}
      />
    );
  }

  function abrirFicha(id: string) {
    recordar(id);
    setFichaId(id);
  }

  const hoy = hoyLocalISO();
  const llegadas = reservas ? llegadasProximas(reservas, hoy) : null;
  // El mes lo dice el backend (kpis.month, hora de Chile): así el título y
  // la cifra hablan del mismo mes aunque el navegador esté en otra zona.
  const mes = kpis?.month ? new Date(`${kpis.month}-01T00:00:00`).toLocaleDateString('es-CL', { month: 'long' }) : null;
  const tarjetaLlegadas48 = s && (
    <MetricCard
      title="Llegadas próximas 48 hrs"
      estado={s.llegadas_48h.estado}
      value={`${s.llegadas_48h.valor.cantidad} ${s.llegadas_48h.valor.cantidad === 1 ? term.personaMinuscula : term.personasMinuscula}`}
      sub={conBanderas > 0 ? `${conBanderas} con indicaciones especiales` : 'Sin indicaciones especiales'}
      onClick={onDetail}
    />
  );
  const tarjetaFormulario = s && (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        marginBottom: 'var(--space-8)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0, color: 'var(--status-bien-dot)' }}>✓</span>
      <div style={{ fontSize: 14, color: 'var(--text)' }}>
        {s.formulario_reservas_7d.cantidad}{' '}
        {s.formulario_reservas_7d.cantidad === 1 ? 'usuario completó' : 'usuarios completaron'} el formulario de reservas esta semana.
      </div>
    </div>
  );

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div className="contenedor-pagina">
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
                <div>
                  <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                    {greetingByHour()}
                  </h1>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
                    Aquí está el resumen operacional de {clientDisplayName ?? 'tu negocio'}.
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                  {location ? `${location.label}, Chile · ` : ''}
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
                    border: `1px solid ${STATUS.atencion.dot}`,
                    borderRadius: 'var(--radius-md)',
                    padding: 16,
                    marginBottom: 'var(--space-6)',
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, color: STATUS.atencion.dot }}>▲</span>
                  <div style={{ flex: 1, fontSize: 13, color: STATUS.atencion.tagText }}>
                    {conBanderas} {conBanderas === 1 ? term.personaMinuscula : term.personasMinuscula} con indicaciones especiales llegan en las próximas 48 horas.
                    Haz clic para ver detalles.
                  </div>
                  <span style={{ fontSize: 16, color: STATUS.atencion.dot, flexShrink: 0, fontWeight: 700 }}>→</span>
                </button>
              )}

              {!nuevo && tarjetaFormulario}

              {!nuevo ? (
                <>
                {pmsRoomViews ? (
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

                  {/* El calendario va ADEMAS de la grilla, no en su lugar
                      (2026-08-12, pedido de Mato: "en el overview el
                      calendario debe mostrar las fechas que están
                      reservadas").

                      Antes el calendario existia solo para los clientes
                      SIN habitaciones: los que si las tienen veian la
                      grilla, que responde "cómo está hoy cada pieza" pero
                      no "qué días del mes están tomados". Son dos
                      preguntas distintas y las dos se hacen al abrir el
                      panel.

                      No hace falta pedir datos nuevos: `loadReservas` ya
                      corre siempre, justamente para no depender del orden
                      en que llega `pmsRoomViews`. */}
                  <div style={{ marginTop: 'var(--space-10)' }}>
                    <SectionHead>Calendario de Reservas</SectionHead>
                    <ReservationCalendar
                      reservas={reservas}
                      loading={reservasLoading}
                      error={reservasError}
                      onRetry={loadReservas}
                      seasonStart={temporada?.inicio}
                      seasonEnd={temporada?.fin}
                    />
                  </div>
                </div>
                ) : (
                <div style={{ marginBottom: 'var(--space-10)' }}>
                  <SectionHead>Calendario de Reservas</SectionHead>
                  <div style={{ marginBottom: 'var(--space-6)' }}>
                    <MetricCard
                      title="Reservas nuevas esta semana"
                      estado={s.reservas_nuevas_7d.estado}
                      value={`${s.reservas_nuevas_7d.valor.cantidad} reserva${s.reservas_nuevas_7d.valor.cantidad === 1 ? '' : 's'}`}
                      sub={formatMonto(s.reservas_nuevas_7d.valor.monto_por_moneda)}
                    />
                  </div>
                  <ReservationCalendar
                    reservas={reservas}
                    loading={reservasLoading}
                    error={reservasError}
                    onRetry={loadReservas}
                    seasonStart={temporada?.inicio}
                    seasonEnd={temporada?.fin}
                  />
                </div>
                )}

              <div style={{ marginBottom: 'var(--space-10)' }}>
                <SectionHead>Operación</SectionHead>
                <div style={{ display: 'grid', gridTemplateColumns: col2, gap: 'var(--space-6)' }}>
                  {tarjetaLlegadas48}
                  <MetricCard title="Sincronización de reservas" estado={s.estado_sincronizacion.estado} value="—" />
                </div>
              </div>
                </>
              ) : (
                <>
                  <section aria-labelledby="ov-llegadas" style={{ marginBottom: 'var(--space-8)' }}>
                    <h2 id="ov-llegadas" data-titulo-lista tabIndex={-1} style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                      Llegan en los próximos 30 días
                    </h2>
                    <AsyncState
                      loading={reservasLoading}
                      error={reservasError ? 'No pudimos cargar las llegadas. Revisa tu conexión y vuelve a intentarlo.' : null}
                      onRetry={loadReservas}
                    >
                      {llegadas && (
                        <ListaLlegadas llegadas={llegadas} hoy={hoy} isDesktop={isDesktop} onAbrir={abrirFicha} onCalendario={irCalendario} />
                      )}
                    </AsyncState>
                  </section>

                  <div style={{ display: 'grid', gridTemplateColumns: col2, gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                    <MetricCard
                      title={mes ? `Reservas de ${mes}` : 'Reservas del mes'}
                      estado={kpis ? 'verde' : 'sin_datos'}
                      neutro={Boolean(kpis)}
                      value={kpis ? String(kpis.bookings_this_month) : '—'}
                      sub={
                        kpis
                          ? `llegadas confirmadas${kpis.bookings_this_month_pending > 0 ? ` · ${kpis.bookings_this_month_pending} sin pagar` : ''}`
                          : 'Sin dato del mes completo'
                      }
                      onClick={irCalendario}
                    />
                    {tarjetaLlegadas48}
                  </div>

                  {tarjetaFormulario}
                </>
              )}

              {location && <WeatherWidget location={location} />}
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}

function ListaLlegadas({
  llegadas,
  hoy,
  isDesktop,
  onAbrir,
  onCalendario,
}: {
  llegadas: ReturnType<typeof llegadasProximas>;
  hoy: string;
  isDesktop: boolean;
  onAbrir: (id: string) => void;
  onCalendario?: () => void;
}) {
  const { confirmadas, pendientes, siguiente } = llegadas;
  const tenue: React.CSSProperties = { fontSize: 13, color: 'var(--text-sub)', margin: 0 };
  const lineaPendientes =
    pendientes > 0 ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <p style={tenue}>
          Además, {pendientes} {pendientes === 1 ? 'reserva sin pagar llega' : 'reservas sin pagar llegan'} en este plazo.
        </p>
        {onCalendario && (
          <button type="button" className="crm-btn crm-btn-text crm-btn-sm" onClick={onCalendario}>
            Ver en el Calendario
          </button>
        )}
      </div>
    ) : null;

  if (confirmadas.length === 0) {
    return (
      <div className="crm-card" style={{ padding: 16 }}>
        {siguiente ? (
          <>
            <p style={{ ...tenue, color: 'var(--text)' }}>Nadie llega en los próximos 30 días.</p>
            <p style={{ ...tenue, marginTop: 4 }}>
              La próxima llegada confirmada es el {fmtCorta(siguiente.CheckIn)}: {siguiente.GuestName}.
            </p>
            <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" style={{ marginTop: 12 }} onClick={() => onAbrir(siguiente.BookingID)} data-fila={siguiente.BookingID}>
              Ver ficha
            </button>
          </>
        ) : (
          <>
            <p style={{ ...tenue, color: 'var(--text)' }}>No hay llegadas confirmadas por ahora.</p>
            {onCalendario && (
              <button type="button" className="crm-btn crm-btn-text crm-btn-sm" style={{ marginTop: 8, marginLeft: -12 }} onClick={onCalendario}>
                Ver Calendario de Reservas
              </button>
            )}
          </>
        )}
        {lineaPendientes}
      </div>
    );
  }

  const visibles = confirmadas.slice(0, MAX_LLEGADAS);
  return (
    <div>
      <ul className="crm-card" style={{ listStyle: 'none', margin: 0, padding: 0, overflow: 'hidden' }}>
        {visibles.map((r, i) => {
          const pago = r.PaymentStatus || 'PENDING';
          const chip = PAGO_CHIP[pago] ?? { bg: 'var(--status-neutro-bg)', fg: 'var(--status-neutro-text)' };
          // PartyMembers llega como texto desde el backend: se lee con personasDe.
          const cantidad = personasDe(r);
          const personas = cantidad != null ? `${cantidad} ${cantidad === 1 ? 'persona' : 'personas'}` : null;
          return (
            <li key={r.BookingID} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)' }}>
              <button
                type="button"
                className="fila-lista"
                data-fila={r.BookingID}
                onClick={() => onAbrir(r.BookingID)}
                style={{ gap: 12, padding: '10px 16px', flexWrap: isDesktop ? 'nowrap' : 'wrap' }}
              >
                <span style={{ minWidth: 86, fontSize: 13 }}>
                  <strong style={{ display: 'block', color: 'var(--text)' }}>{fmtCorta(r.CheckIn)}</strong>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cuandoLlega(hoy, r.CheckIn)}</span>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', overflowWrap: 'anywhere' }}>
                    {r.GuestName || '—'}
                  </span>
                  {r.GuestOriginCountry && (
                    <span data-pais="" style={{ display: 'flex', fontSize: 12, color: 'var(--text-sub)', marginTop: 2, minWidth: 0 }}>
                      <PaisPescador pais={r.GuestOriginCountry} />
                    </span>
                  )}
                  {(r.RoomID || personas) && (
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-sub)', overflowWrap: 'anywhere', marginTop: 2 }}>
                      <BadgePrograma codigo={r.RoomID} />
                      {r.RoomID && personas ? ' · ' : ''}
                      {personas}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: chip.bg, color: chip.fg, whiteSpace: 'nowrap' }}>
                  {PAGO_LABEL[pago] ?? pago}
                  {pago === 'PARTIAL' && r.BalanceDue != null ? ` · debe ${fmtMonto(r.Currency, r.BalanceDue)}` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {confirmadas.length > MAX_LLEGADAS && onCalendario && (
        <button type="button" className="crm-btn crm-btn-text crm-btn-sm" style={{ marginTop: 8, marginLeft: -12 }} onClick={onCalendario}>
          Ver las {confirmadas.length} llegadas en el Calendario
        </button>
      )}
      {lineaPendientes}
    </div>
  );
}
