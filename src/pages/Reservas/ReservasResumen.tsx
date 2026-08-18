import { useState, useEffect, useCallback, useMemo } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { OriginBadge } from '../../components/OriginBadge';
import { SearchIcon, CalendarIcon, CalendarRangeIcon } from '../../components/icons/RockyIcons';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { BookingDetailModal } from '../../components/BookingDetailModal';
import { NewBookingModal } from '../../components/NewBookingModal';
import { ReservationCalendar } from '../../components/ReservationCalendar';
import { PlusIcon } from '../../components/icons/RockyIcons';
import { getReservasResumen, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import { CLIENT_LOCATION } from '../../branding';
import { temporadaActualCff, CFF_CLIENT_ID } from '../../lib/temporadaCff';
import { terminologiaPms } from '../../lib/terminologiaPms';
import type { ReservaResumenItem } from '../../types';

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelada',
};

// bg/dot exactos de --status-bien/-atencion/-critico (Figma frame
// "19 — Reservas Resumen": Confirmada #dcfce7/#16a34a, Pendiente
// #fef3c7/#d97706, Cancelada #fee2e2/#ef4444 - los 3 coinciden byte a
// byte con el token "-dot" de cada estado, no con "-text").
const STATUS_COLOR: Record<string, { bg: string; dot: string }> = {
  CONFIRMED: { bg: 'var(--status-bien-bg)', dot: 'var(--status-bien-dot)' },
  PENDING: { bg: 'var(--status-atencion-bg)', dot: 'var(--status-atencion-dot)' },
  CANCELLED: { bg: 'var(--status-critico-bg)', dot: 'var(--status-critico-dot)' },
};

const TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Todas' },
  { key: 'CONFIRMED', label: 'Confirmada' },
  { key: 'PENDING', label: 'Pendiente' },
  { key: 'CANCELLED', label: 'Cancelada' },
];

const PAGE_SIZE = 15;

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nights(checkIn: string, checkOut: string): number {
  const inD = new Date(`${checkIn}T00:00:00`);
  const outD = new Date(`${checkOut}T00:00:00`);
  return Math.max(0, Math.round((outD.getTime() - inD.getTime()) / 86400000));
}

// "Julio 2026" en el Figma es un selector de mes - acá se arma de verdad
// a partir de los check-in reales de las reservas ya cargadas (no hay
// filtro server-side por mes, así que se filtra sobre lo que ya trajo el
// backend, nunca se inventa un rango de fechas que no exista en los datos).
function monthKey(iso: string): string {
  return iso.slice(0, 7);
}
function monthLabel(key: string): string {
  const d = new Date(`${key}-01T00:00:00`);
  const label = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ReservasResumen({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized, clientDisplayName, clientId, pmsRoomViews } = useAuth();
  const [reservas, setReservas] = useState<ReservaResumenItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('ALL');
  const [tab, setTab] = useState('ALL');
  const [page, setPage] = useState(0);
  const [detalle, setDetalle] = useState<ReservaResumenItem | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  // Fecha con la que se abre "Nueva reserva" cuando el disparador fue un
  // click en un día del calendario (2026-08-11, pedido de Mato). Vacía
  // cuando se abre desde el botón de la cabecera.
  const [fechaNueva, setFechaNueva] = useState<string | undefined>(undefined);

  // Temporada de pesca (12 oct - 30 abr), solo para chile-fly-fishing
  // (2026-08-06, pedido explícito de Mato: "el PMS debiera siempre
  // mostrar el calendario... para ver que fechas disponibles quedan en
  // la temporada"). Es un hecho de negocio de ESTE cliente, no depende
  // de pmsRoomViews (esa bandera es sobre "no tiene habitaciones", un
  // concepto distinto).
  const esCff = clientId === CFF_CLIENT_ID;
  const temporada = useMemo(() => (esCff ? temporadaActualCff(new Date()) : null), [esCff]);

  // Terminología propia de cada cliente (2026-08-11, pedido explícito de
  // Mato: "para el cliente chile fly fishing, SOLO para este cliente, la
  // columna huésped se reemplaza por Angler, se quita la columna noches").
  // La regla vive en un solo lugar (lib/terminologiaPms.ts) para que la
  // tabla, los modales y el menú no puedan quedar diciendo cosas
  // distintas.
  const t = terminologiaPms(clientId);
  const guestLabel = t.columnaPersona;
  const mostrarNoches = t.mostrarNoches;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getReservasResumen()
      .then((r) => setReservas(r.reservas))
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

  const months = useMemo(() => {
    const keys = new Set((reservas ?? []).map((r) => monthKey(r.CheckIn)));
    return Array.from(keys).sort();
  }, [reservas]);

  const filtered = useMemo(() => {
    return (reservas ?? []).filter((r) => {
      if (tab !== 'ALL' && r.Status !== tab) return false;
      if (month !== 'ALL' && monthKey(r.CheckIn) !== month) return false;
      if (search.trim() && !r.GuestName.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [reservas, tab, month, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const location = clientId ? CLIENT_LOCATION[clientId] : undefined;
  const fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);

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
              Calendario de Reservas
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Administra y visualiza todas las estancias en {clientDisplayName ?? 'tu negocio'}.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {location && <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{location.label}, Chile · {fechaCap}</div>}
            {/* El CTA de la pantalla usa el mismo boton que el resto del
                panel (2026-08-18): tenia estilo inline propio -8px 14px, 13px,
                peso 700, radio chico- y quedaba mas bajo y mas cuadrado que
                cualquier otro boton, sin alinearse con nada. .crm-btn le da
                los 40px y la forma de M3. El icono va a 18px, que es la
                medida que la spec fija para el icono de un boton. */}
            <button
              className="crm-btn crm-btn-primary"
              onClick={() => {
                setFechaNueva(undefined);
                setNuevaAbierta(true);
              }}
            >
              <PlusIcon size={18} color="currentColor" />
              Nueva reserva
            </button>
          </div>
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {reservas && reservas.length === 0 && (
            <EmptyStateIllustrated
              icon={<CalendarRangeIcon size={36} />}
              title="Aún no hay reservas"
              description="Cuando se sincronicen reservas desde tu sistema de gestión, van a aparecer acá con toda su información."
            />
          )}

          {reservas && reservas.length > 0 && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', alignItems: 'center', marginBottom: 'var(--space-7)' }}>
                <div
                  className="crm-search-wrap"
                  style={{ width: isDesktop ? 320 : '100%' }}
                >
                  <SearchIcon size={14} color="var(--text-faint)" />
                  <input
                    className="crm-search"
                    placeholder={`Buscar ${guestLabel.toLowerCase()}…`}
                    aria-label={`Buscar ${guestLabel.toLowerCase()}`}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--white)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 10,
                  }}
                >
                  <CalendarIcon size={14} color="var(--text-sub)" />
                  <select
                    value={month}
                    onChange={(e) => {
                      setMonth(e.target.value);
                      setPage(0);
                    }}
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    <option value="ALL">Todos los meses</option>
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {monthLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 4, background: 'var(--border)', padding: 4, borderRadius: 'var(--radius-md)' }}>
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setTab(t.key);
                        setPage(0);
                      }}
                      aria-pressed={tab === t.key}
                      style={{
                        all: 'unset',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 13,
                        fontWeight: tab === t.key ? 600 : 500,
                        color: tab === t.key ? 'var(--text)' : 'var(--text-sub)',
                        background: tab === t.key ? 'var(--white)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Ninguna reserva coincide con el filtro.
                </div>
              ) : (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {isDesktop && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#f9fafb', // Figma (frame 19) - distinto de --surface-2 (#f4f4f5), solo esta tabla
                        borderBottom: '1px solid var(--border)',
                        padding: '12px 24px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-sub)',
                      }}
                    >
                      <span style={col(150)}>{guestLabel}</span>
                      <span style={col(130)}>{pmsRoomViews ? 'Habitación' : 'Programa'}</span>
                      <span style={col(95)}>Check-in</span>
                      <span style={col(95)}>Check-out</span>
                      {mostrarNoches && <span style={col(70, { textAlign: 'center' })}>Noches</span>}
                      <span style={col(130)}>Origen</span>
                      <span style={col(95)}>N° vuelo</span>
                      <span style={col(105)}>Estado</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>Monto Total</span>
                    </div>
                  )}
                  {pageItems.map((r) => {
                    const sc = STATUS_COLOR[r.Status];
                    return (
                      <div
                        key={r.BookingID}
                        onClick={() => setDetalle(r)}
                        style={{
                          display: 'flex',
                          flexDirection: isDesktop ? 'row' : 'column',
                          alignItems: isDesktop ? 'center' : 'flex-start',
                          gap: isDesktop ? 0 : 6,
                          padding: isDesktop ? '16px 24px' : '14px 16px',
                          borderBottom: '1px solid var(--border-soft)',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          title={isDesktop ? r.GuestName : undefined}
                          style={
                            isDesktop
                              ? col(150, { fontWeight: 600, color: 'var(--text)', fontSize: 14, paddingRight: 8, boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
                              : { fontWeight: 700, color: 'var(--text)', fontSize: 14 }
                          }
                        >
                          {r.GuestName}
                        </span>
                        {/* Ancho fijo + texto largo (ej. "Pesca con mosca 4
                            días") se montaba encima de la columna Check-in:
                            la celda no recortaba nada. El nombre completo
                            queda en el title y en el detalle al hacer click. */}
                        <span
                          title={isDesktop ? r.RoomID : undefined}
                          style={
                            isDesktop
                              ? col(130, { fontSize: 14, color: 'var(--text-sub)', paddingRight: 8, boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
                              : { fontSize: 12, color: 'var(--text-muted)' }
                          }
                        >
                          {r.RoomID} {!isDesktop && `· ${fmtDate(r.CheckIn)} → ${fmtDate(r.CheckOut)}`}
                        </span>
                        {isDesktop && (
                          <>
                            <span style={col(95, { fontSize: 14, color: 'var(--text-sub)' })}>{fmtDate(r.CheckIn)}</span>
                            <span style={col(95, { fontSize: 14, color: 'var(--text-sub)' })}>{fmtDate(r.CheckOut)}</span>
                            {mostrarNoches && (
                              <span style={col(70, { fontSize: 14, color: 'var(--text-sub)', textAlign: 'center' })}>{nights(r.CheckIn, r.CheckOut)}</span>
                            )}
                          </>
                        )}
                        <span style={isDesktop ? col(130) : { marginTop: 2 }}>
                          <OriginBadge source={r.Source} />
                        </span>
                        {isDesktop && (
                          /* Casi siempre vacío, y está bien: el huésped lo
                             manda por WhatsApp DESPUÉS de pagar, no al
                             reservar. Por eso el vacío se dibuja como un
                             guión tenue y no como un hueco: un hueco se lee
                             como que algo no cargó. */
                          <span style={col(95, { fontSize: 14, color: r.FlightNumber ? 'var(--text)' : 'var(--text-muted)', fontWeight: r.FlightNumber ? 600 : 400 })}>
                            {r.FlightNumber || '—'}
                          </span>
                        )}
                        <span style={isDesktop ? col(105) : { marginTop: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: sc?.bg ?? 'var(--status-neutro-bg)', color: sc?.dot ?? 'var(--status-neutro-text)' }}>
                            {STATUS_LABEL[r.Status] ?? r.Status}
                          </span>
                        </span>
                        <span style={isDesktop ? { flex: 1, textAlign: 'right', fontWeight: 700, color: 'var(--text)', fontSize: 14 } : { fontWeight: 700, color: 'var(--text)', fontSize: 14, marginTop: 2 }}>
                          {r.Currency} {r.TotalAmount.toLocaleString('es-CL')}
                        </span>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-7)' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                      Mostrando {pageSafe * PAGE_SIZE + 1}–{Math.min(filtered.length, pageSafe * PAGE_SIZE + PAGE_SIZE)} de {filtered.length} reserva{filtered.length === 1 ? '' : 's'}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="crm-btn crm-btn-ghost crm-btn-sm"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={pageSafe === 0}
                      >
                        Anterior
                      </button>
                      <button
                        className="crm-btn crm-btn-ghost crm-btn-sm"
                        onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                        disabled={pageSafe >= pageCount - 1}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </AsyncState>

        {/* El calendario va DESPUÉS de la tabla (2026-08-11, pedido de
            Mato). Sigue el mes del filtro de arriba cuando hay uno
            elegido; con "Todos los meses" navega por su cuenta. La
            sincronización es en un solo sentido a propósito: moverse por
            los meses del calendario no filtra la tabla, para que nadie
            pierda filas de vista sin haberlo pedido. */}
        <div style={{ marginTop: 'var(--space-8)' }}>
          <ReservationCalendar
            reservas={reservas}
            loading={loading}
            error={error}
            onRetry={load}
            seasonStart={temporada?.inicio}
            seasonEnd={temporada?.fin}
            focusMonth={month === 'ALL' ? undefined : month}
            onDayClick={(fechaISO) => {
              setFechaNueva(fechaISO);
              setNuevaAbierta(true);
            }}
            onReservaClick={(r) => setDetalle(r)}
          />
        </div>
      </div>

      {detalle && (
        <BookingDetailModal
          reserva={detalle}
          roomViews={pmsRoomViews}
          showNights={mostrarNoches}
          onClose={() => setDetalle(null)}
          onGuardado={() => {
            setDetalle(null);
            load();
          }}
        />
      )}

      {nuevaAbierta && (
        <NewBookingModal
          reservas={reservas}
          roomViews={pmsRoomViews}
          guestLabel={guestLabel}
          checkInInicial={fechaNueva}
          onClose={() => {
            setNuevaAbierta(false);
            setFechaNueva(undefined);
          }}
          onCreado={() => {
            setNuevaAbierta(false);
            setFechaNueva(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
