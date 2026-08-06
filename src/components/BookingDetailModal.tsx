import { useState } from 'react';
import { actualizarReserva, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
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

// Detalle real al hacer click en una reserva (2026-08-06, pedido explícito
// de Mato) — quién es, contacto, fechas, y edición real de fechas. Este
// panel no tenía ningún componente de modal propio (a diferencia de
// 05-panel-web) - se arma inline, mismas convenciones de estilo que
// ReservationCalendar.tsx/TiendaInventario.tsx (CSS vars, sin clases
// compartidas).
export function BookingDetailModal({
  reserva,
  roomViews,
  onClose,
  onGuardado,
}: {
  reserva: ReservaResumenItem;
  roomViews: boolean;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { handleUnauthorized } = useAuth();
  const [editandoFechas, setEditandoFechas] = useState(false);
  const [checkIn, setCheckIn] = useState(reserva.CheckIn);
  const [checkOut, setCheckOut] = useState(reserva.CheckOut);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

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
            <div style={fieldValue}>{contacto.WhatsApp || '—'}</div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={fieldLabel}>Fechas</div>
            {!editandoFechas && (
              <button
                onClick={() => setEditandoFechas(true)}
                style={{ all: 'unset', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}
              >
                Modificar fechas
              </button>
            )}
          </div>

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
            <div style={{ fontSize: 14, color: 'var(--text)' }}>
              {fmtDate(reserva.CheckIn)} → {fmtDate(reserva.CheckOut)}
              <span style={{ color: 'var(--text-sub)' }}> · {nights(reserva.CheckIn, reserva.CheckOut)} noches</span>
            </div>
          )}
        </div>

        {reserva.BookingNotes && (
          <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)' }}>
            <div style={fieldLabel}>Notas</div>
            <div style={{ ...fieldValue, whiteSpace: 'pre-wrap' }}>{reserva.BookingNotes}</div>
          </div>
        )}
      </div>
    </div>
  );
}
