import { useMemo, useState } from 'react';
import { crearReserva, crearHuesped, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import type { ReservaResumenItem } from '../types';

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 4,
  fontSize: 14,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  background: 'var(--white)',
  color: 'var(--text)',
};
const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' };

// Reserva manual (llamada, mail, walk-in) desde el panel del cliente -
// 2026-08-06, pedido explícito de Mato: "el PMS... debe ser capaz de
// agregar... reservas", para TODOS los clientes (no solo CFF). Mismos
// campos que NewBookingModal.tsx del panel de staff (05-panel-web), pero
// ese exige elegir de una lista de huéspedes ya creados por separado -
// acá no hay una pantalla de "Huéspedes" aparte, así que se agrega el
// modo "huésped nuevo" inline en el mismo formulario.
export function NewBookingModal({
  reservas,
  roomViews,
  onClose,
  onCreado,
}: {
  reservas: ReservaResumenItem[] | null;
  roomViews: boolean;
  onClose: () => void;
  onCreado: () => void;
}) {
  const { handleUnauthorized } = useAuth();

  const huespedes = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const r of reservas ?? []) {
      if (r.GuestID && !vistos.has(r.GuestID)) vistos.set(r.GuestID, r.GuestName);
    }
    return Array.from(vistos, ([GuestID, GuestName]) => ({ GuestID, GuestName }));
  }, [reservas]);

  const [huespedNuevo, setHuespedNuevo] = useState(huespedes.length === 0);
  const [guestId, setGuestId] = useState(huespedes[0]?.GuestID ?? '');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [originCountry, setOriginCountry] = useState('');

  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [partyMembers, setPartyMembers] = useState('2');
  const [currency, setCurrency] = useState('CLP');
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('PENDING');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guestListo = huespedNuevo ? fullName.trim() && (email.trim() || whatsapp.trim()) : !!guestId;
  const fechasOk = !!checkIn && !!checkOut && checkOut > checkIn;
  const puedeGuardar = guestListo && roomId.trim() && fechasOk;

  async function guardar() {
    if (!puedeGuardar || guardando) return;
    setGuardando(true);
    setError('');
    try {
      let finalGuestId = guestId;
      if (huespedNuevo) {
        const contact: { Email?: string; WhatsApp?: string } = {};
        if (email.trim()) contact.Email = email.trim();
        if (whatsapp.trim()) contact.WhatsApp = whatsapp.trim();
        const creado = await crearHuesped({
          FullName: fullName.trim(),
          Contact: contact,
          OriginCountry: originCountry.trim() || undefined,
        });
        finalGuestId = creado.GuestID;
      }
      await crearReserva({
        GuestID: finalGuestId,
        RoomID: roomId.trim(),
        CheckIn: checkIn,
        CheckOut: checkOut,
        PartyMembers: Number(partyMembers) || 1,
        Financials: { Currency: currency, TotalAmount: Number(totalAmount) || 0, PaymentStatus: paymentStatus },
      });
      onCreado();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo crear la reserva.');
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
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-card-hover)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Nueva reserva</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ all: 'unset', cursor: 'pointer', fontSize: 22, color: 'var(--text-faint)', lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 'var(--space-6)' }}>
          Reserva directa (llamada, mail, walk-in) — queda registrada con origen Directa.
        </div>

        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={fieldLabel}>Huésped</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 8 }}>
            <button
              onClick={() => setHuespedNuevo(false)}
              disabled={huespedes.length === 0}
              style={{
                all: 'unset',
                cursor: huespedes.length ? 'pointer' : 'default',
                opacity: huespedes.length ? 1 : 0.4,
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                background: !huespedNuevo ? 'var(--primary)' : 'var(--surface-2)',
                color: !huespedNuevo ? '#fff' : 'var(--text-sub)',
              }}
            >
              Ya registrado
            </button>
            <button
              onClick={() => setHuespedNuevo(true)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                background: huespedNuevo ? 'var(--primary)' : 'var(--surface-2)',
                color: huespedNuevo ? '#fff' : 'var(--text-sub)',
              }}
            >
              Nuevo
            </button>
          </div>

          {huespedNuevo ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={fieldLabel}>Nombre completo</label>
                <input autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} placeholder="Ej. Orlando Araneda" />
              </div>
              <div>
                <label style={fieldLabel}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={fieldLabel}>WhatsApp</label>
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} style={inputStyle} placeholder="+56 9…" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={fieldLabel}>País de origen</label>
                <input value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} style={inputStyle} />
              </div>
              {!email.trim() && !whatsapp.trim() && (
                <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-faint)' }}>Necesita al menos un email o un WhatsApp.</div>
              )}
            </div>
          ) : (
            <select value={guestId} onChange={(e) => setGuestId(e.target.value)} style={inputStyle}>
              {huespedes.map((g) => (
                <option key={g.GuestID} value={g.GuestID}>
                  {g.GuestName}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={fieldLabel}>{roomViews ? 'Habitación' : 'Programa'}</label>
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={inputStyle}
            placeholder={roomViews ? 'Ej. Cabaña Sur' : 'Ej. Pesca con mosca 3 días'}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={fieldLabel}>Check-in</label>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabel}>Check-out</label>
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabel}>Personas</label>
            <input type="number" min="1" value={partyMembers} onChange={(e) => setPartyMembers(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 6 }}>
          <div>
            <label style={fieldLabel}>Moneda</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle}>
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Total</label>
            <input type="number" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} style={inputStyle} placeholder="0" />
          </div>
          <div>
            <label style={fieldLabel}>Estado de pago</label>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} style={inputStyle}>
              <option value="PENDING">Pendiente</option>
              <option value="PARTIAL">Parcial</option>
              <option value="PAID">Pagado</option>
              <option value="REFUNDED">Reembolsado</option>
            </select>
          </div>
        </div>

        {checkIn && checkOut && checkOut <= checkIn && (
          <div style={{ fontSize: 12, color: 'var(--status-critico-dot)', marginTop: 6 }}>El check-out debe ser posterior al check-in.</div>
        )}
        {error && <div style={{ fontSize: 12, color: 'var(--status-critico-dot)', marginTop: 6 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-6)' }}>
          <button
            onClick={() => void guardar()}
            disabled={!puedeGuardar || guardando}
            style={{
              all: 'unset',
              cursor: puedeGuardar && !guardando ? 'pointer' : 'default',
              opacity: puedeGuardar ? 1 : 0.5,
              background: 'var(--primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {guardando ? 'Creando…' : 'Crear reserva'}
          </button>
          <button
            onClick={onClose}
            style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-sub)', fontSize: 13, fontWeight: 600, padding: '8px 16px' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
