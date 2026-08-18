import { useState } from 'react';
import { actualizarReserva, cancelarReserva, confirmarReserva, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import { telefonoDe, enlaceWhatsapp } from '../lib/contactoHuesped';
import { OriginBadge } from './OriginBadge';
import { fmtSelloUtc } from '../lib/selloUtc';
import type { ReservaResumenItem } from '../types';

const STATUS_LABEL: Record<string, string> = { CONFIRMED: 'Confirmada', PENDING: 'Pendiente', CANCELLED: 'Cancelada' };
const STATUS_COLOR: Record<string, { bg: string; dot: string }> = {
  CONFIRMED: { bg: 'var(--status-bien-bg)', dot: 'var(--status-bien-dot)' },
  PENDING: { bg: 'var(--status-atencion-bg)', dot: 'var(--status-atencion-dot)' },
  CANCELLED: { bg: 'var(--status-critico-bg)', dot: 'var(--status-critico-dot)' },
};

// Los 4 valores que declara pms_models.VALID_PAYMENT_STATUSES. El color no
// se comparte con el del estado de la reserva a propósito: una reserva puede
// estar Pendiente y su pago ya Pagado (pasa cuando entra la plata y todavía
// no corrió la confirmación) - pintarlos iguales escondería justamente el
// caso que hay que mirar.
const PAGO_LABEL: Record<string, string> = {
  PAID: 'Pagada',
  PENDING: 'Sin pagar',
  PARTIAL: 'Abono parcial',
  REFUNDED: 'Devuelta',
};
const PAGO_COLOR: Record<string, { bg: string; fg: string }> = {
  PAID: { bg: 'var(--status-bien-bg)', fg: 'var(--status-bien-dot)' },
  PENDING: { bg: 'var(--status-atencion-bg)', fg: 'var(--status-atencion-dot)' },
  PARTIAL: { bg: 'var(--status-info-bg)', fg: 'var(--status-info-text)' },
  REFUNDED: { bg: 'var(--status-neutro-bg)', fg: 'var(--status-neutro-text)' },
};

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function nights(checkIn: string, checkOut: string): number {
  const ms = new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const fieldValue: React.CSSProperties = { fontSize: 14, color: 'var(--text)', marginTop: 4 };

// Las notas llegan como texto libre desde el PMS/la web. Se parten por
// salto de línea y por los separadores que la gente escribe a mano (·, ;,
// viñetas tipeadas) para poder listarlas - 2026-08-11, pedido de Mato:
// "las notas deben quedar en bullets, fácil de leer". Una nota de un solo
// párrafo sigue siendo un bullet: el formato no cambia según el contenido,
// así siempre se lee igual.
function notasEnBullets(texto: string): string[] {
  return texto
    .split(/\r?\n|·|;/)
    .map((n) => n.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
}

// Detalle real al hacer click en una reserva (2026-08-06, pedido explícito
// de Mato) — quién es, contacto, fechas, y edición real de fechas. Este
// panel no tenía ningún componente de modal propio (a diferencia de
// 05-panel-web) - se arma inline, mismas convenciones de estilo que
// ReservationCalendar.tsx/TiendaInventario.tsx (CSS vars, sin clases
// compartidas).
//
// 2026-08-11 (pedido de Mato): fechas como "Llega:"/"Se va:" en dos líneas
// con la etiqueta en negrita, notas en bullets, y "Modificar fechas" pasa
// de ser un link chico en la cabecera de la sección a un botón secundario
// real al final, junto a la acción destructiva.
export function BookingDetailModal({
  reserva,
  roomViews,
  showNights = true,
  onClose,
  onGuardado,
}: {
  reserva: ReservaResumenItem;
  roomViews: boolean;
  showNights?: boolean;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { handleUnauthorized } = useAuth();
  const [editandoFechas, setEditandoFechas] = useState(false);
  const [checkIn, setCheckIn] = useState(reserva.CheckIn);
  const [checkOut, setCheckOut] = useState(reserva.CheckOut);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  // "No avisar al pescador" (2026-08-18). Ver confirmar() más abajo.
  const [sinAviso, setSinAviso] = useState(false);

  const sc = STATUS_COLOR[reserva.Status];
  const contacto = reserva.GuestContact || {};
  const pago = reserva.PaymentStatus || 'PENDING';
  const pagoColor = PAGO_COLOR[pago];

  async function guardarFechas() {
    if (!checkIn || !checkOut) {
      setError('Completa las dos fechas.');
      return;
    }
    if (checkOut <= checkIn) {
      setError('El check-out debe ser posterior al check-in.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await actualizarReserva(reserva.BookingID, { CheckIn: checkIn, CheckOut: checkOut });
      setEditandoFechas(false);
      onGuardado();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  // "Ya pagó" (2026-08-17, pedido explícito de Mato: "que aparezca el botón
  // confirmar reserva en el caso que sea una reserva pendiente, solo aparece
  // en ese caso"). Es el mismo salto PENDING -> CONFIRMED que hace el cobro
  // de WeTravel, pero a mano: lo usa quien cobró por transferencia, o quien
  // ya vio la plata y no quiere esperar al reconciliador.
  //
  // El botón NO se muestra si la reserva ya está confirmada o cancelada. Eso
  // es la mitad de la barrera: la otra mitad es la condición del backend
  // sobre PENDING, porque una pantalla abierta hace 20 minutos puede estar
  // mostrando un estado que ya cambió.
  async function confirmar() {
    // El aviso al pescador NO sale de este botón: sale del Stream de
    // DynamoDB al aparecer el CONFIRMED. Por eso la casilla no "cancela un
    // envío" - marca la reserva, y crm_worker lee esa marca y no enrola.
    // El diálogo dice explícitamente cuál de los dos casos es, porque
    // después de apretar ya no hay vuelta atrás: el 2026-08-18 hubo que
    // frenar un correo a mano borrando la fila de la cola.
    const aviso = sinAviso
      ? 'NO se le avisa: no recibe el correo de confirmación ni se le arma la ' +
        'secuencia previa al viaje. Es lo correcto para una reserva ya acordada ' +
        'y ya pagada por fuera, que solo estás registrando.'
      : 'SE LE AVISA: le llega el correo "tu reserva está confirmada" y arranca ' +
        'la secuencia previa al viaje. Si es una reserva vieja que ya tenía todo ' +
        'arreglado, marcá "No avisar al pescador" antes de seguir.';
    if (
      !confirm(
        `¿Confirmar la reserva de ${reserva.GuestName}?\n\n` +
          'Queda como Confirmada y su pago como Pagado. Con eso se le bloquea la fecha ' +
          'y deja de correr el plazo que la cancela sola por falta de pago.\n\n' +
          `${aviso}\n\n` +
          'Hacelo solo si la plata ya entró.'
      )
    )
      return;
    setConfirmando(true);
    setError('');
    try {
      await confirmarReserva(reserva.BookingID, sinAviso);
      onGuardado();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo confirmar la reserva.');
    } finally {
      setConfirmando(false);
    }
  }

  // "Eliminar" una reserva = cancelarla (Status -> CANCELLED), nunca un
  // borrado real - confirmado explícitamente con Mato (2026-08-06): queda
  // en el historial/reportes, es reversible (una reserva cancelada por
  // error se puede volver a editar). Mismo criterio ya usado en Tienda.
  async function cancelar() {
    if (!confirm(`¿Cancelar la reserva de ${reserva.GuestName}? Queda marcada como Cancelada, no se borra - se puede filtrar/ocultar de la vista activa.`)) return;
    setCancelando(true);
    setError('');
    try {
      await cancelarReserva(reserva.BookingID);
      onGuardado();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo cancelar la reserva.');
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      {/* Ancho mínimo 900px (2026-08-18, pedido explícito de Mato). El
          `min(900px, 100%)` es la parte que evita que ese mínimo rompa la
          pantalla en un celular: ahí el 100% del overlay es menor que 900 y
          gana, así que la ficha se adapta en vez de desbordar y obligar a
          scrollear de lado. */}
      <div
        style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          width: '100%',
          minWidth: 'min(900px, 100%)',
          maxWidth: 960,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-card-hover)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{reserva.GuestName}</h2>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: sc?.bg, color: sc?.dot, display: 'inline-block', marginTop: 8 }}>
              {STATUS_LABEL[reserva.Status] ?? reserva.Status}
            </span>
          </div>
          {/* Icon button de M3: 40x40 y forma redonda. El redondeo no es
              decorativo - la capa de estado del hover (buttonHoverGsap.ts) se
              recorta con el border-radius del botón, y sin radio quedaba un
              rectángulo duro alrededor de la ×. */}
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: 'pointer',
              fontSize: 22,
              color: 'var(--text-faint)',
              lineHeight: 1,
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* auto-fit y no '1fr 1fr': con la ficha en 900px, dos columnas
            dejaban media pantalla en blanco y una lista larguísima de 8 filas.
            Con minmax(200px,1fr) entran 4 columnas a ese ancho y vuelven a 2
            (y a 1) cuando la ficha se angosta, sin un breakpoint a mano. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <div>
            <div style={fieldLabel}>Email</div>
            <div style={fieldValue}>{contacto.Email || '—'}</div>
          </div>
          <div>
            <div style={fieldLabel}>WhatsApp</div>
            <div style={fieldValue}>
              {enlaceWhatsapp(contacto) ? (
                <a href={enlaceWhatsapp(contacto)!} target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                  {telefonoDe(contacto)}
                </a>
              ) : (telefonoDe(contacto) || '—')}
            </div>
          </div>
          <div>
            <div style={fieldLabel}>País de origen</div>
            <div style={fieldValue}>{reserva.GuestOriginCountry || '—'}</div>
          </div>
          <div>
            <div style={fieldLabel}>Personas</div>
            <div style={fieldValue}>{reserva.PartyMembers ?? '—'}</div>
          </div>
          <div>
            <div style={fieldLabel}>{roomViews ? 'Habitación' : 'Programa'}</div>
            <div style={fieldValue}>{reserva.RoomID}</div>
          </div>
          <div>
            <div style={fieldLabel}>Monto total</div>
            <div style={fieldValue}>
              {reserva.Currency} {reserva.TotalAmount.toLocaleString('es-CL')}
            </div>
          </div>
          {/* Estado del pago y origen: los dos venían en la respuesta del
              backend desde siempre y no se mostraban en ninguna parte de la
              ficha. El estado del pago es el que decide si corresponde
              confirmar; el origen dice si la reserva entró por el formulario
              del sitio o la cargó alguien a mano. */}
          <div>
            <div style={fieldLabel}>Estado del pago</div>
            <div style={{ marginTop: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: pagoColor?.bg ?? 'var(--status-neutro-bg)',
                  color: pagoColor?.fg ?? 'var(--status-neutro-text)',
                  display: 'inline-block',
                }}
              >
                {PAGO_LABEL[pago] ?? pago}
              </span>
            </div>
          </div>
          <div>
            <div style={fieldLabel}>Origen</div>
            <div style={{ marginTop: 6 }}>
              <OriginBadge source={reserva.Source} />
            </div>
          </div>
        </div>

        {/* Vuelo de llegada. El pescador lo manda por WhatsApp DESPUÉS de
            pagar, contestando el correo de confirmación, así que casi siempre
            está vacío y eso no es un error: se dice con todas sus letras en
            vez de dejar un guión que se lee como "algo no cargó". El sello de
            cuándo llegó el dato importa tanto como el número - un vuelo
            informado hace tres semanas puede haber cambiado. */}
        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <div style={fieldLabel}>Vuelo de llegada</div>
          {reserva.FlightNumber ? (
            <div style={{ ...fieldValue, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
              <strong style={{ fontWeight: 700, letterSpacing: '0.02em' }}>{reserva.FlightNumber}</strong>
              {reserva.FlightReportedAt && (
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  informado el {fmtSelloUtc(reserva.FlightReportedAt)}
                </span>
              )}
            </div>
          ) : (
            <div style={{ ...fieldValue, color: 'var(--text-muted)' }}>
              Todavía no lo informa. Llega por WhatsApp cuando contesta el correo de confirmación.
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 'var(--space-6)' }}>
          <div style={{ ...fieldLabel, marginBottom: 'var(--space-4)' }}>Fechas</div>

          {editandoFechas ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                <div>
                  <label style={fieldLabel}>Check-in</label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    style={{ width: '100%', marginTop: 4, fontSize: 14, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>Check-out</label>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    style={{ width: '100%', marginTop: 4, fontSize: 14, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              {error && <div style={{ fontSize: 12, color: 'var(--status-critico-dot)', marginBottom: 10 }}>{error}</div>}
              {/* Mismas clases M3 que el resto: los dos botones quedan del
                  mismo alto y alineados solos, sin padding a mano. */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                <button
                  className="crm-btn crm-btn-text"
                  onClick={() => {
                    setEditandoFechas(false);
                    setCheckIn(reserva.CheckIn);
                    setCheckOut(reserva.CheckOut);
                    setError('');
                  }}
                >
                  Cancelar
                </button>
                <button className="crm-btn crm-btn-primary" onClick={() => void guardarFechas()} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: 'var(--text)' }}>
              <div>
                <strong style={{ fontWeight: 700 }}>Llega:</strong> {fmtDate(reserva.CheckIn)}
              </div>
              <div>
                <strong style={{ fontWeight: 700 }}>Se va:</strong> {fmtDate(reserva.CheckOut)}
              </div>
              {showNights && (
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{nights(reserva.CheckIn, reserva.CheckOut)} noches</div>
              )}
            </div>
          )}
        </div>

        {reserva.BookingNotes && (
          <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)' }}>
            <div style={fieldLabel}>Notas</div>
            <ul style={{ ...fieldValue, margin: '8px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.5 }}>
              {notasEnBullets(reserva.BookingNotes).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Barra de acciones (2026-08-18, pedido de Mato: "los botones que
            aparecerán abajo deben estar alineados"). Antes no lo estaban por
            dos motivos que se arreglan acá: "Cancelar reserva" era un botón
            pelado con padding propio (10px 4px) al lado de botones de otra
            altura, y la casilla "No avisar al pescador" se metía EN la fila,
            empujando de a un botón según su largo.

            Ahora es la disposición de un diálogo de Material 3: la acción
            destructiva a la izquierda, las de avance a la derecha, todas con
            la misma clase .crm-btn -o sea el mismo alto de 40px- así que se
            alinean por construcción y no por un padding calzado a ojo.

            La casilla NO se fue a otra parte del modal: sigue pegada al botón
            que modifica, justo encima y contra el mismo borde derecho. Es una
            modificación de lo que ese botón va a hacer y hay que poder marcarla
            sin buscarla. Va SIN marcar por defecto -el caso normal es una
            reserva recién pagada, y ahí el correo corresponde-: el silencio es
            siempre una decisión explícita de quien la está registrando. */}
        {!editandoFechas && (
          <div
            style={{
              borderTop: '1px solid var(--border-soft)',
              marginTop: 'var(--space-6)',
              paddingTop: 'var(--space-6)',
            }}
          >
            {reserva.Status === 'PENDING' && (
              <label
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 'var(--space-5)',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  cursor: confirmando ? 'default' : 'pointer',
                  userSelect: 'none',
                }}
                title="Marcala cuando estés registrando una reserva ya acordada y ya pagada por fuera: se confirma igual, pero al pescador no le llega el correo de confirmación ni la secuencia previa al viaje."
              >
                <input
                  type="checkbox"
                  checked={sinAviso}
                  disabled={confirmando}
                  onChange={(e) => setSinAviso(e.target.checked)}
                  style={{ cursor: confirmando ? 'default' : 'pointer', margin: 0 }}
                />
                No avisar al pescador
              </label>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {reserva.Status !== 'CANCELLED' && (
                <button className="crm-btn crm-btn-danger" onClick={() => void cancelar()} disabled={cancelando}>
                  {cancelando ? 'Cancelando…' : 'Cancelar reserva'}
                </button>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
                <button className="crm-btn crm-btn-ghost" onClick={() => setEditandoFechas(true)}>
                  Modificar fechas
                </button>
                {reserva.Status === 'PENDING' && (
                  <button className="crm-btn crm-btn-primary" onClick={() => void confirmar()} disabled={confirmando}>
                    {confirmando ? 'Confirmando…' : 'Ya pagó · Confirmar reserva'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* El error de cancelar no vive dentro del bloque de edición de
            fechas, así que sin esto una cancelación fallida no decía nada
            (el botón volvía de "Cancelando…" a su estado normal y listo). */}
        {!editandoFechas && error && (
          <div style={{ fontSize: 12, color: 'var(--status-critico-dot)', marginTop: 10 }}>{error}</div>
        )}

        {/* Los dos identificadores, al pie y en tipografía de máquina. Son lo
            que permite cruzar esta reserva con un cobro de WeTravel, con un
            correo o con un log cuando algo no calza: sin ellos, "la reserva de
            Daniel" no es un dato con el que se pueda buscar en ningún lado.
            Van al final y atenuados porque no son para leer, son para copiar. */}
        <div
          style={{
            borderTop: '1px solid var(--border-soft)',
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-5)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-6)',
            fontSize: 11,
            color: 'var(--text-faint)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          <span>
            Reserva <span style={{ userSelect: 'all', color: 'var(--text-muted)' }}>{reserva.BookingID}</span>
          </span>
          {reserva.GuestID && (
            <span>
              Ficha <span style={{ userSelect: 'all', color: 'var(--text-muted)' }}>{reserva.GuestID}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
