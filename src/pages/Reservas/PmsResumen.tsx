import { useState, useEffect, useCallback, useMemo } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { CalendarRangeIcon, ChevronDownIcon, UsersIcon } from '../../components/icons/RockyIcons';
import { BookingDetailModal } from '../../components/BookingDetailModal';
import { getReservasResumen, getHuespedes, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import { terminologiaPms } from '../../lib/terminologiaPms';
import { fechasImportantesProximas, semanaDe, isoLocal, type FechaImportante } from '../../lib/fechasImportantes';
import type { HuespedItem, ReservaResumenItem } from '../../types';

const STATUS_LABEL: Record<string, string> = { CONFIRMED: 'Confirmada', PENDING: 'Pendiente', CANCELLED: 'Cancelada' };
const STATUS_COLOR: Record<string, { bg: string; dot: string }> = {
  CONFIRMED: { bg: 'var(--status-bien-bg)', dot: 'var(--status-bien-dot)' },
  PENDING: { bg: 'var(--status-atencion-bg)', dot: 'var(--status-atencion-dot)' },
  CANCELLED: { bg: 'var(--status-critico-bg)', dot: 'var(--status-critico-dot)' },
};

function fmtDia(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtCorta(d: Date): string {
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

function cuando(enDias: number): string {
  if (enDias === 0) return 'hoy';
  if (enDias === 1) return 'mañana';
  return `en ${enDias} días`;
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

// Resumen del PMS — primer acceso de la sección, para TODOS los clientes
// (2026-08-11, pedido explícito de Mato: "un resumen, con métricas,
// cantidad de reservas, quien llega esta semana, quien se va. Fechas
// importantes (cumpleaños, aniversario)").
//
// Todo sale de dos llamadas que ya existen (reservas + huéspedes); no hay
// un endpoint de "resumen" nuevo porque no haría falta: son los mismos
// datos, cruzados acá. Los números dicen "en la ventana del panel" y no
// pretenden ser un histórico: las reservas vienen con el lookahead que
// cada cliente tiene configurado (get_pms_lookahead_days).
export function PmsResumen({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized, clientId, clientDisplayName, pmsRoomViews } = useAuth();
  const t = terminologiaPms(clientId);
  const [reservas, setReservas] = useState<ReservaResumenItem[] | null>(null);
  const [huespedes, setHuespedes] = useState<HuespedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ReservaResumenItem | null>(null);
  // El detalle de "Reservas activas" se despliega en esta misma pantalla y
  // no navega a otra (2026-08-17, decisión de Mato). El motivo es que
  // "activas" no existe como filtro en el Calendario: es un recorte que se
  // deriva acá (todo lo que no está cancelado), así que mandarlo a otra
  // pantalla obligaría a recalcular el mismo conjunto en dos lugares — y el
  // día que uno de los dos cambie, el número de la tarjeta y la lista que
  // abre dejarían de coincidir sin que nadie se entere.
  const [activasAbiertas, setActivasAbiertas] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getReservasResumen(), getHuespedes()])
      .then(([r, h]) => {
        setReservas(r.reservas);
        setHuespedes(h.huespedes);
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

  useEffect(() => {
    load();
  }, [load]);

  const hoy = useMemo(() => new Date(), []);
  const semana = useMemo(() => semanaDe(hoy), [hoy]);
  const semIni = isoLocal(semana.inicio);
  const semFin = isoLocal(semana.fin);
  const hoyIso = isoLocal(hoy);

  const activas = useMemo(() => (reservas ?? []).filter((r) => r.Status !== 'CANCELLED'), [reservas]);

  const llegan = useMemo(
    () => activas.filter((r) => r.CheckIn >= semIni && r.CheckIn <= semFin).sort((a, b) => a.CheckIn.localeCompare(b.CheckIn)),
    [activas, semIni, semFin]
  );
  const sevan = useMemo(
    () => activas.filter((r) => r.CheckOut >= semIni && r.CheckOut <= semFin).sort((a, b) => a.CheckOut.localeCompare(b.CheckOut)),
    [activas, semIni, semFin]
  );
  // "Alojados ahora": llegó y todavía no se fue. El check-out no cuenta
  // como noche, por eso es CheckOut > hoy y no >=.
  const alojados = useMemo(() => activas.filter((r) => r.CheckIn <= hoyIso && r.CheckOut > hoyIso), [activas, hoyIso]);

  // El mismo conjunto que cuenta la tarjeta, en el orden en que va a pasar:
  // primero lo que está ocurriendo, después lo que viene, al final lo que ya
  // terminó pero sigue dentro de la ventana que trae el backend.
  const activasOrdenadas = useMemo(
    () => [...activas].sort((a, b) => a.CheckIn.localeCompare(b.CheckIn)),
    [activas]
  );

  const personasSemana = llegan.reduce((n, r) => n + (r.PartyMembers ?? 1), 0);
  const pendientes = (reservas ?? []).filter((r) => r.Status === 'PENDING').length;
  const canceladas = (reservas ?? []).filter((r) => r.Status === 'CANCELLED').length;

  const fechas = useMemo(() => fechasImportantesProximas(huespedes, hoy, 30), [huespedes, hoy]);
  const conFechaCargada = huespedes.filter((h) => h.BirthDate || h.AnniversaryDate).length;

  // Una fecha importante vale el doble si la persona va a estar en la casa
  // ese día: es la diferencia entre saber un dato y poder hacer algo con él.
  const guestEnCasa = useMemo(() => {
    const m = new Map<string, ReservaResumenItem>();
    for (const r of activas) if (r.GuestID) m.set(r.GuestID, r);
    return m;
  }, [activas]);

  function estanciaEnLaFecha(f: FechaImportante): ReservaResumenItem | null {
    const iso = isoLocal(f.proxima);
    const r = guestEnCasa.get(f.guestId);
    if (!r) return null;
    return iso >= r.CheckIn && iso <= r.CheckOut ? r : null;
  }

  const card: React.CSSProperties = {
    background: 'var(--white)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-card)',
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ paddingBottom: 'var(--space-7)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-8)' }}>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Resumen
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
            Cómo viene la semana en {clientDisplayName ?? 'tu negocio'} · {fmtCorta(semana.inicio)} al {fmtCorta(semana.fin)}
          </div>
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {reservas && reservas.length === 0 && (
            <EmptyStateIllustrated
              icon={<CalendarRangeIcon size={36} />}
              title="Todavía no hay reservas"
              description="Cuando entre la primera reserva, acá vas a ver de un vistazo quién llega, quién se va y las fechas que conviene no dejar pasar."
            />
          )}

          {reservas && reservas.length > 0 && (
            <>
              <div className="crm-mini-dash">
                <button
                  type="button"
                  className="crm-mini-card crm-mini-card-btn"
                  aria-expanded={activasAbiertas}
                  aria-controls="panel-reservas-activas"
                  onClick={() => setActivasAbiertas((v) => !v)}
                >
                  <div className="crm-mini-label">Reservas activas</div>
                  <div className="crm-mini-value">{activas.length}</div>
                  <div className="crm-mini-sub">
                    {pendientes} pendiente{pendientes === 1 ? '' : 's'}
                    {canceladas > 0 && ` · ${canceladas} cancelada${canceladas === 1 ? '' : 's'}`}
                  </div>
                  <span className="crm-mini-cta">
                    {activasAbiertas ? 'Ocultar el detalle' : 'Ver el detalle'}
                    <span className="crm-mini-caret" style={{ display: 'inline-flex' }} aria-hidden="true">
                      <ChevronDownIcon size={12} />
                    </span>
                  </span>
                </button>
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Llegan esta semana</div>
                  <div className={`crm-mini-value ${llegan.length ? 'ok' : ''}`}>{llegan.length}</div>
                  <div className="crm-mini-sub">{personasSemana} persona{personasSemana === 1 ? '' : 's'}</div>
                </div>
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Se van esta semana</div>
                  <div className="crm-mini-value">{sevan.length}</div>
                  <div className="crm-mini-sub">{pmsRoomViews ? 'Habitaciones a preparar' : 'Cierres de programa'}</div>
                </div>
                <div className="crm-mini-card">
                  <div className="crm-mini-label">{pmsRoomViews ? 'Alojados ahora' : 'En curso ahora'}</div>
                  <div className="crm-mini-value">{alojados.length}</div>
                  <div className="crm-mini-sub">Al día de hoy</div>
                </div>
              </div>

              {activasAbiertas && (
                <DetalleActivas
                  items={activasOrdenadas}
                  hoyIso={hoyIso}
                  isDesktop={isDesktop}
                  etiquetaLugar={pmsRoomViews ? 'Habitación' : 'Programa'}
                  onClick={setDetalle}
                  estilo={card}
                />
              )}

              <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 'var(--space-7)', marginBottom: 'var(--space-7)' }}>
                <ListaReservas
                  titulo="Llegan esta semana"
                  vacio={`Nadie llega entre el ${fmtCorta(semana.inicio)} y el ${fmtCorta(semana.fin)}.`}
                  items={llegan}
                  campoFecha="CheckIn"
                  onClick={setDetalle}
                  estilo={card}
                />
                <ListaReservas
                  titulo="Se van esta semana"
                  vacio={`Nadie se va entre el ${fmtCorta(semana.inicio)} y el ${fmtCorta(semana.fin)}.`}
                  items={sevan}
                  campoFecha="CheckOut"
                  onClick={setDetalle}
                  estilo={card}
                />
              </div>

              <div style={{ ...card, padding: 'var(--space-7)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Fechas importantes</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Cumpleaños y aniversarios de los próximos 30 días</div>
                </div>

                {fechas.length === 0 ? (
                  <div style={{ marginTop: 'var(--space-6)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {conFechaCargada === 0 ? (
                      <>
                        Todavía no hay ninguna fecha cargada. Se cargan una sola vez por persona, desde{' '}
                        <strong>{t.navPersonas}</strong>: abre la ficha y completa el cumpleaños o el aniversario.
                        Después aparecen acá solas, cada año.
                      </>
                    ) : (
                      <>
                        Ninguna de las {conFechaCargada} fecha{conFechaCargada === 1 ? '' : 's'} cargada
                        {conFechaCargada === 1 ? '' : 's'} cae en los próximos 30 días.
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'var(--space-6)' }}>
                    {fechas.map((f) => {
                      const estancia = estanciaEnLaFecha(f);
                      return (
                        <div
                          key={`${f.guestId}-${f.tipo}`}
                          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 13, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}
                        >
                          <span style={{ fontSize: 16 }} aria-hidden="true">
                            {f.tipo === 'cumpleanos' ? '🎂' : '💛'}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 140 }}>{f.nombre}</span>
                          <span style={{ color: 'var(--text-sub)', flex: 1, minWidth: 160 }}>
                            {f.tipo === 'cumpleanos' ? 'Cumpleaños' : 'Aniversario'}
                            {f.numero !== undefined && ` · ${f.numero} año${f.numero === 1 ? '' : 's'}`}
                            {' · '}
                            {fmtCorta(f.proxima)} ({cuando(f.enDias)})
                          </span>
                          {estancia ? (
                            <span style={chip('var(--status-bien-bg)', 'var(--status-bien-dot)')}>
                              {pmsRoomViews ? 'Está alojado ese día' : 'Está en viaje ese día'}
                            </span>
                          ) : (
                            <span style={chip('var(--status-neutro-bg)', 'var(--status-neutro-text)')}>Sin reserva ese día</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {huespedes.length === 0 && (
                <div style={{ marginTop: 'var(--space-6)', fontSize: 12, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UsersIcon size={14} color="var(--text-faint)" />
                  Todavía no hay fichas de {t.personasMinuscula} cargadas.
                </div>
              )}
            </>
          )}
        </AsyncState>
      </div>

      {detalle && (
        <BookingDetailModal
          reserva={detalle}
          roomViews={pmsRoomViews}
          showNights={t.mostrarNoches}
          onClose={() => setDetalle(null)}
          onGuardado={() => {
            setDetalle(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// El detalle que abre la tarjeta "Reservas activas". Trabaja sobre la MISMA
// lista que produce el número de la tarjeta: no vuelve a pedirle nada al
// backend ni a filtrar por su cuenta, así que los dos no pueden discrepar.
//
// Va agrupado por momento y no por estado (confirmada/pendiente) porque la
// pregunta que dispara el click es operativa —"¿qué tengo encima?"— y no
// contable. El estado igual viaja en cada fila, en su chip de siempre.
function DetalleActivas({
  items,
  hoyIso,
  isDesktop,
  etiquetaLugar,
  onClick,
  estilo,
}: {
  items: ReservaResumenItem[];
  hoyIso: string;
  isDesktop: boolean;
  etiquetaLugar: string;
  onClick: (r: ReservaResumenItem) => void;
  estilo: React.CSSProperties;
}) {
  const enCurso = items.filter((r) => r.CheckIn <= hoyIso && r.CheckOut > hoyIso);
  const porVenir = items.filter((r) => r.CheckIn > hoyIso);
  // La ventana del backend arranca 14 días atrás, así que en esta lista
  // siempre puede haber reservas ya terminadas. Se muestran igual —siguen
  // sumando al número de la tarjeta, esconderlas dejaría una cuenta que no
  // cuadra— pero al final y atenuadas.
  const terminadas = items.filter((r) => r.CheckOut <= hoyIso);

  const grupos: { titulo: string; ayuda: string; filas: ReservaResumenItem[]; atenuado?: boolean }[] = [
    { titulo: 'En curso', ayuda: 'Ya llegaron y todavía no se van', filas: enCurso },
    { titulo: 'Por venir', ayuda: 'Todavía no llegan', filas: porVenir },
    { titulo: 'Ya terminaron', ayuda: 'Siguen en la ventana del panel', filas: terminadas, atenuado: true },
  ].filter((g) => g.filas.length > 0);

  return (
    <div id="panel-reservas-activas" style={{ ...estilo, padding: 'var(--space-7)', marginBottom: 'var(--space-7)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          Reservas activas <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-faint)' }}>({items.length})</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Todo lo que no está cancelado · abre cualquiera para ver su ficha</div>
      </div>

      {items.length === 0 ? (
        <div style={{ marginTop: 'var(--space-6)', fontSize: 13, color: 'var(--text-muted)' }}>
          No hay ninguna reserva activa en la ventana que muestra el panel.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)', marginTop: 'var(--space-7)' }}>
          {grupos.map((g) => (
            <div key={g.titulo}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {g.titulo}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  {g.filas.length} · {g.ayuda}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, opacity: g.atenuado ? 0.62 : 1 }}>
                {g.filas.map((r) => {
                  const sc = STATUS_COLOR[r.Status];
                  return (
                    <button
                      key={r.BookingID}
                      type="button"
                      className="cal-fila"
                      style={isDesktop ? undefined : { alignItems: 'flex-start', flexWrap: 'wrap' }}
                      onClick={() => onClick(r)}
                    >
                      <span style={{ color: 'var(--text-sub)', minWidth: isDesktop ? 150 : undefined, whiteSpace: 'nowrap' }}>
                        {fmtCorta(new Date(`${r.CheckIn}T00:00:00`))} → {fmtCorta(new Date(`${r.CheckOut}T00:00:00`))}
                      </span>
                      <span style={{ flex: 1, minWidth: 140, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.GuestName}</span>
                        <span style={{ color: 'var(--text-faint)' }} title={`${etiquetaLugar}: ${r.RoomID}`}>
                          {' · '}
                          {r.RoomID}
                        </span>
                      </span>
                      <span style={{ color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>
                        {r.PartyMembers ?? 1} p.
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', minWidth: isDesktop ? 110 : undefined, textAlign: 'right' }}>
                        {r.Currency} {r.TotalAmount.toLocaleString('es-CL')}
                      </span>
                      <span style={chip(sc?.bg ?? 'var(--status-neutro-bg)', sc?.dot ?? 'var(--status-neutro-text)')}>
                        {STATUS_LABEL[r.Status] ?? r.Status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ListaReservas({
  titulo,
  vacio,
  items,
  campoFecha,
  onClick,
  estilo,
}: {
  titulo: string;
  vacio: string;
  items: ReservaResumenItem[];
  campoFecha: 'CheckIn' | 'CheckOut';
  onClick: (r: ReservaResumenItem) => void;
  estilo: React.CSSProperties;
}) {
  return (
    <div style={{ ...estilo, padding: 'var(--space-7)' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 'var(--space-6)' }}>
        {titulo} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-faint)' }}>({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{vacio}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((r) => {
            const sc = STATUS_COLOR[r.Status];
            return (
              <button key={r.BookingID} type="button" className="cal-fila" onClick={() => onClick(r)}>
                <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 92 }}>{fmtDia(r[campoFecha])}</span>
                <span style={{ flex: 1, color: 'var(--text)', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.GuestName}
                  <span style={{ color: 'var(--text-faint)' }}> · {r.RoomID}</span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: sc?.bg ?? 'var(--status-neutro-bg)', color: sc?.dot ?? 'var(--status-neutro-text)' }}>
                  {STATUS_LABEL[r.Status] ?? r.Status}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
