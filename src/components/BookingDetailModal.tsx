import { useState } from 'react';
import { actualizarReserva, cancelarReserva, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import { telefonoDe, enlaceWhatsapp } from '../lib/contactoHuesped';
import type { ReservaResumenItem } from '../types';

const STATUS_LABEL: Record<string, string> = { CONFIRMED: 'Confirmada', PENDING: 'Pendiente', CANCELLED: 'Cancelada' };
const STATUS_COLOR: Record<string, { bg: string; dot: string }> = {
  CONFIRMED: { bg: 'var(--status-bien-bg)', dot: 'var(--status-bien-dot)' },
  PENDING: { bg: 'var(--status-atencion-bg)', dot: 'var(--status-atencion-dot)' },
  CANCELLED: { bg: 'var(--status-critico-bg)', dot: 'var(--status-critico-dot)' },
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

  const sc = STATUS_COLOR[reserva.Status];
  const contacto = reserva.GuestContact || {};

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
      <div
        style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          maxWidth: 520,
          width: '100%',
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
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ all: 'unset', cursor: 'pointer', fontSize: 22, color: 'var(--text-faint)', lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => void guardarFechas()}
                  disabled={guardando}
                  style={{ all: 'unset', cursor: 'pointer', background: 'var(--primary)', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 700 }}
                >
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  onClick={() => {
                    setEditandoFechas(false);
                    setCheckIn(reserva.CheckIn);
                    setCheckOut(reserva.CheckOut);
                    setError('');
                  }}
                  style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-sub)', fontSize: 13, fontWeight: 600, padding: '8px 16px' }}
                >
                  Cancelar
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

        {!editandoFechas && (
          <div
            style={{
              borderTop: '1px solid var(--border-soft)',
              marginTop: 'var(--space-6)',
              paddingTop: 'var(--space-6)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <button className="crm-btn crm-btn-ghost" onClick={() => setEditandoFechas(true)}>
              Modificar fechas
            </button>
            {reserva.Status !== 'CANCELLED' && (
              <button
                onClick={() => void cancelar()}
                disabled={cancelando}
                style={{ all: 'unset', cursor: cancelando ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--status-critico-dot)', padding: '10px 4px' }}
              >
                {cancelando ? 'Cancelando…' : 'Cancelar reserva'}
              </button>
            )}
          </div>
        )}

        {/* El error de cancelar no vive dentro del bloque de edición de
            fechas, así que sin esto una cancelación fallida no decía nada
            (el botón volvía de "Cancelando…" a su estado normal y listo). */}
        {!editandoFechas && error && (
          <div style={{ fontSize: 12, color: 'var(--status-critico-dot)', marginTop: 10 }}>{error}</div>
        )}
      </div>
    </div>
  );
}
