import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { crearReserva, crearHuesped, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import type { ReservaResumenItem } from '../types';

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 4,
  fontSize: 14,
  minHeight: 44,
  minWidth: 0,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  background: 'var(--white)',
  color: 'var(--text)',
};
// --text-sub: --text-faint (#a1a1aa) no llega a 4,5:1 sobre blanco (WCAG 2.2 1.4.3).
const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.04em' };
// Tres columnas cuando caben; en un teléfono se apilan. Con «1fr 1fr 1fr» los
// campos de fecha desbordaban el modal 115 px a 320 de ancho (WCAG 1.4.10).
const filaCampos: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10 };
// Toques de 44 px (WCAG 2.5.5 y la meta del panel): .crm-btn mide 40 y -sm 32.
const toque44: React.CSSProperties = { minHeight: 44 };
const ENFOCABLES = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Reserva manual (llamada, mail, walk-in) desde el panel del cliente -
// 2026-08-06, pedido explícito de Mato: "el PMS... debe ser capaz de
// agregar... reservas", para TODOS los clientes (no solo CFF). Mismos
// campos que NewBookingModal.tsx del panel de staff (05-panel-web), pero
// ese exige elegir de una lista de huéspedes ya creados por separado -
// acá no hay una pantalla de "Huéspedes" aparte, así que se agrega el
// modo "huésped nuevo" inline en el mismo formulario.
//
// 2026-08-11 (pedido de Mato): `checkInInicial` llega cuando el modal se
// abre desde un click en un día del calendario - solo precarga el
// check-in, nunca el check-out: la duración es una decisión del negocio
// (cada programa dura lo suyo) y adivinarla dejaría reservas con largo
// inventado si alguien guarda sin mirar.
export function NewBookingModal({
  reservas,
  roomViews,
  guestLabel = 'Huésped',
  checkInInicial,
  onClose,
  onCreado,
}: {
  reservas: ReservaResumenItem[] | null;
  roomViews: boolean;
  guestLabel?: string;
  checkInInicial?: string;
  onClose: () => void;
  onCreado: () => void;
}) {
  const { handleUnauthorized, features } = useAuth();
  // Con utilidad (CFF), el programa decide el costo del guía: solo valen los
  // dos códigos que el servidor reconoce. Los demás clientes, texto libre.
  const conPrograma = features?.pms_utilidad === true;
  const id = useId();
  const idPrograma = `${id}-programa`;
  const dialogo = useRef<HTMLDivElement>(null);
  // El botón que abrió el modal: al cerrarse, el foco vuelve a él.
  const [abridor] = useState(() => (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null));

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
  const [checkIn, setCheckIn] = useState(checkInInicial ?? '');
  const [checkOut, setCheckOut] = useState('');
  const [partyMembers, setPartyMembers] = useState('2');
  // CFF (ficha de pesca) vende casi todo en USD: partir en CLP dejaba «690»
  // como 690 CLP y una pérdida falsa (revisión 17-oct). Alto Castillo, CLP.
  const monedaInicial = features?.pms_ficha_pesca === true ? 'USD' : 'CLP';
  const [currency, setCurrency] = useState(monedaInicial);
  const [monedaTocada, setMonedaTocada] = useState(false);
  // `features` puede llegar después de montar: si nadie eligió moneda, sigue
  // al cliente.
  useEffect(() => {
    if (!monedaTocada) setCurrency(monedaInicial);
  }, [monedaInicial, monedaTocada]);
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('PENDING');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  // Al fallar, el botón quedó deshabilitado mientras guardaba y el foco cae a
  // BODY: se lleva al mensaje para que el lector de pantalla y el teclado sigan.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const hayDatos = Boolean(
    fullName.trim() || email.trim() || whatsapp.trim() || originCountry.trim() || roomId.trim() || checkOut || totalAmount || checkIn !== (checkInInicial ?? '') ||
      currency !== monedaInicial || partyMembers !== '2' || paymentStatus !== 'PENDING',
  );

  // Diálogo modal (WAI-ARIA APG, Dialog Modal): mismo patrón que VisorMedio
  // de Berry Studio. El foco entra al abrir, Tab no sale y vuelve al cerrar.
  useEffect(() => {
    if (dialogo.current && !dialogo.current.contains(document.activeElement)) {
      dialogo.current.querySelector<HTMLElement>(ENFOCABLES)?.focus();
    }
    return () => {
      if (abridor && abridor.isConnected) abridor.focus();
    };
  }, [abridor]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // Con «Creando…» el POST sigue: cerrar ahora invita a crearla dos veces.
        if (guardando) return;
        // Con datos escritos se pregunta antes, como en el resto del panel
        // (GarantiaFicha, FichaPescador usan window.confirm).
        if (hayDatos && !window.confirm('¿Cerrar sin crear la reserva? Lo que escribiste se pierde.')) return;
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogo.current) return;
      const enfocables = Array.from(dialogo.current.querySelectorAll<HTMLElement>(ENFOCABLES));
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      const activo = document.activeElement;
      if (!dialogo.current.contains(activo)) {
        e.preventDefault();
        primero.focus();
      } else if (e.shiftKey && activo === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [guardando, hayDatos, onClose]);

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
        if (e.target === e.currentTarget && !guardando) onClose();
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
      {/* Mismo ancho minimo que las fichas de detalle (2026-08-18, pedido de
          Mato): 900px, con min() para que en un celular se adapte en vez de
          desbordar. Este modal se habia quedado en 560px cuando los otros dos
          pasaron a 900 y se veia disparejo al lado de ellos. */}
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h2 id={`${id}-titulo`} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Nueva reserva</h2>
          {/* Icon button de M3: 40x40 redondo, para que la capa de estado del
              hover se recorte redonda y no como un cuadrado. */}
          <button
            onClick={onClose}
            disabled={guardando}
            aria-label="Cerrar"
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: 'pointer',
              fontSize: 22,
              color: 'var(--text-sub)',
              lineHeight: 1,
              width: 44,
              height: 44,
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
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 'var(--space-6)' }}>
          Reserva directa (llamada, mail, walk-in) — queda registrada con origen Directa.
        </div>

        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div id={`${id}-huesped`} style={fieldLabel}>{guestLabel}</div>
          {/* Este par es literalmente el caso "active / inactive" de M3: el
              elegido lleva el contenedor tonal y el label en color de marca,
              el otro queda outlined. aria-pressed no es decorativo - es lo que
              hace que un lector de pantalla diga cual de los dos esta puesto,
              y ademas es el selector que pinta el estado en index.css. El
              deshabilitado sale de :disabled, no de un opacity a mano. */}
          <div role="group" aria-labelledby={`${id}-huesped`} style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 8 }}>
            <button
              className={`crm-btn crm-btn-sm ${huespedNuevo ? 'crm-btn-ghost' : 'crm-btn-primary is-active'}`}
              onClick={() => setHuespedNuevo(false)}
              disabled={huespedes.length === 0}
              aria-pressed={!huespedNuevo}
              style={toque44}
            >
              Ya registrado
            </button>
            <button
              className={`crm-btn crm-btn-sm ${huespedNuevo ? 'crm-btn-primary is-active' : 'crm-btn-ghost'}`}
              onClick={() => setHuespedNuevo(true)}
              aria-pressed={huespedNuevo}
              style={toque44}
            >
              Nuevo
            </button>
          </div>

          {huespedNuevo ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor={`${id}-nombre`} style={fieldLabel}>Nombre completo</label>
                <input id={`${id}-nombre`} autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} placeholder="Nombre y apellido" />
              </div>
              <div>
                <label htmlFor={`${id}-email`} style={fieldLabel}>Email</label>
                <input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label htmlFor={`${id}-whatsapp`} style={fieldLabel}>WhatsApp</label>
                <input id={`${id}-whatsapp`} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} style={inputStyle} placeholder="+56 9…" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor={`${id}-pais`} style={fieldLabel}>País de origen</label>
                <input id={`${id}-pais`} value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} style={inputStyle} />
              </div>
              {!email.trim() && !whatsapp.trim() && (
                <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-sub)' }}>Necesita al menos un email o un WhatsApp.</div>
              )}
            </div>
          ) : (
            <select aria-labelledby={`${id}-huesped`} value={guestId} onChange={(e) => setGuestId(e.target.value)} style={inputStyle}>
              {huespedes.map((g) => (
                <option key={g.GuestID} value={g.GuestID}>
                  {g.GuestName}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginBottom: 10 }}>
          <label htmlFor={idPrograma} style={fieldLabel}>{roomViews && !conPrograma ? 'Habitación' : 'Programa'}</label>
          {conPrograma ? (
            <select id={idPrograma} value={roomId} onChange={(e) => setRoomId(e.target.value)} style={inputStyle}>
              <option value="">Elige el programa</option>
              <option value="ALL_INCLUSIVE">All Inclusive</option>
              <option value="FULL_DAY">Full Day</option>
            </select>
          ) : (
            <input
              id={idPrograma}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              style={inputStyle}
              placeholder={roomViews ? 'Ej. Cabaña Sur' : 'Ej. Programa de 3 días'}
            />
          )}
        </div>

        <div style={{ ...filaCampos, marginBottom: 10 }}>
          <div>
            <label htmlFor={`${id}-checkin`} style={fieldLabel}>Check-in</label>
            <input id={`${id}-checkin`} type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label htmlFor={`${id}-checkout`} style={fieldLabel}>Check-out</label>
            <input id={`${id}-checkout`} type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label htmlFor={`${id}-personas`} style={fieldLabel}>Personas</label>
            <input id={`${id}-personas`} type="number" min="1" value={partyMembers} onChange={(e) => setPartyMembers(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ ...filaCampos, marginBottom: 6 }}>
          <div>
            <label htmlFor={`${id}-moneda`} style={fieldLabel}>Moneda</label>
            <select
              id={`${id}-moneda`}
              value={currency}
              onChange={(e) => {
                setMonedaTocada(true);
                setCurrency(e.target.value);
              }}
              style={inputStyle}
            >
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-total`} style={fieldLabel}>Total</label>
            <input id={`${id}-total`} type="number" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} style={inputStyle} placeholder="0" />
          </div>
          <div>
            <label htmlFor={`${id}-pago`} style={fieldLabel}>Estado de pago</label>
            <select id={`${id}-pago`} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} style={inputStyle}>
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
        {error && (
          <div ref={errorRef} role="alert" tabIndex={-1} style={{ fontSize: 13, color: 'var(--status-critico-text)', marginTop: 6 }}>
            {error}
          </div>
        )}

        {/* Pie de dialogo de M3: descarte primero, confirmacion al final y
            contra el borde derecho. Los dos con .crm-btn, o sea el mismo alto
            de 40px, asi que se alinean por construccion. El estado apagado del
            boton sale de :disabled (contenedor 12% / label 38% de la spec), no
            de un opacity inline que dejaba el texto blanco ilegible. */}
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-7)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-soft)', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className="crm-btn crm-btn-text" onClick={onClose} disabled={guardando} style={toque44}>
            Cancelar
          </button>
          <button className="crm-btn crm-btn-primary" onClick={() => void guardar()} disabled={!puedeGuardar || guardando} style={toque44}>
            {guardando ? 'Creando…' : 'Crear reserva'}
          </button>
        </div>
      </div>
    </div>
  );
}
