import { useState } from 'react';
import { guardarDiaItinerario, vaciarDiaItinerario, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import { fmtSelloUtcCorto } from '../lib/selloUtc';
import type { ItinerarioDia, ItinerarioReserva, TipoDeAgua } from '../types';

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
const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

// Los mismos 3 valores que declara pms_itinerario.TIPOS_DE_AGUA. Es una lista
// cerrada para poder contar después ("cuántos días de lago llevamos"): un
// campo libre con "Rio", "río" y "el río" no se puede contar. El NOMBRE sí es
// libre — son cientos y cambian.
const AGUAS: { valor: TipoDeAgua; label: string }[] = [
  { valor: '', label: 'Sin definir' },
  { valor: 'rio', label: 'Río' },
  { valor: 'lago', label: 'Lago' },
  { valor: 'laguna', label: 'Laguna' },
];

function fmtDiaLargo(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Una jornada: el plan de la mañana y lo que quedó anotado a la vuelta, en el
// mismo formulario (2026-08-17, pedido explícito de Mato). No son dos
// pantallas porque no son dos momentos separables: el guía cambia de río a
// las once y el plan se reescribe.
//
// Guarda el día ENTERO en cada envío, igual que el backend lo reemplaza
// entero. Con un guardado parcial, borrar una hora cargada mal no tendría
// forma de persistirse.
export function DiaItinerarioModal({
  reserva,
  dia,
  onClose,
  onGuardado,
}: {
  reserva: ItinerarioReserva;
  dia: ItinerarioDia;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { handleUnauthorized } = useAuth();
  const [guia, setGuia] = useState(dia.Guia);
  const [tipoAgua, setTipoAgua] = useState<TipoDeAgua>(dia.Agua.Tipo);
  const [nombreAgua, setNombreAgua] = useState(dia.Agua.Nombre);
  const [salida, setSalida] = useState(dia.HoraSalida);
  const [regreso, setRegreso] = useState(dia.HoraRegreso);
  const [truchas, setTruchas] = useState(dia.TruchasPescadas === null ? '' : String(dia.TruchasPescadas));
  const [notas, setNotas] = useState(dia.Notas);
  const [guardando, setGuardando] = useState(false);
  const [vaciando, setVaciando] = useState(false);
  const [error, setError] = useState('');

  const teniaAlgo = Boolean(
    dia.Guia || dia.Agua.Tipo || dia.Agua.Nombre || dia.HoraSalida || dia.HoraRegreso || dia.Notas || dia.TruchasPescadas !== null
  );

  async function guardar() {
    // Las mismas dos reglas que valida pms_itinerario. Se repiten acá para
    // contestar al instante y sin viaje al servidor, NO para reemplazarlo:
    // una validación que vive solo en el navegador se la saltea cualquier
    // otro llamador.
    if (salida && regreso && regreso < salida) {
      setError('La hora de regreso no puede ser anterior a la de salida.');
      return;
    }
    const n = truchas.trim() === '' ? null : Number(truchas);
    if (n !== null && (!Number.isInteger(n) || n < 0)) {
      setError('Las truchas pescadas tienen que ser un número entero de 0 para arriba.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await guardarDiaItinerario({
        BookingID: reserva.BookingID,
        Fecha: dia.Fecha,
        Guia: guia,
        Agua: { Tipo: tipoAgua, Nombre: nombreAgua },
        HoraSalida: salida,
        HoraRegreso: regreso,
        TruchasPescadas: n,
        Notas: notas,
      });
      onGuardado();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo guardar la jornada.');
    } finally {
      setGuardando(false);
    }
  }

  async function vaciar() {
    if (!confirm(`¿Vaciar lo anotado el ${fmtDiaLargo(dia.Fecha)}?\n\nEl día vuelve a quedar en blanco.`)) return;
    setVaciando(true);
    setError('');
    try {
      await vaciarDiaItinerario(reserva.BookingID, dia.Fecha);
      onGuardado();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo vaciar la jornada.');
    } finally {
      setVaciando(false);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 'var(--space-3)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{fmtDiaLargo(dia.Fecha)}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              {reserva.GuestName} · {reserva.RoomID}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ all: 'unset', cursor: 'pointer', fontSize: 22, color: 'var(--text-faint)', lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 'var(--space-7)' }}>
          Anotá lo que se planea en la mañana y completá el resto a la vuelta. Todo es opcional: un día
          a medio llenar es más útil que uno en blanco.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={fieldLabel} htmlFor="itin-guia">
              Guía
            </label>
            <input
              id="itin-guia"
              autoFocus
              value={guia}
              onChange={(e) => setGuia(e.target.value)}
              style={inputStyle}
              placeholder="Quién sale con el grupo"
            />
          </div>

          <div>
            <label style={fieldLabel} htmlFor="itin-tipo-agua">
              Tipo de agua
            </label>
            <select
              id="itin-tipo-agua"
              value={tipoAgua}
              onChange={(e) => setTipoAgua(e.target.value as TipoDeAgua)}
              style={inputStyle}
            >
              {AGUAS.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={fieldLabel} htmlFor="itin-nombre-agua">
              Nombre del agua
            </label>
            <input
              id="itin-nombre-agua"
              value={nombreAgua}
              onChange={(e) => setNombreAgua(e.target.value)}
              style={inputStyle}
              placeholder="Ej. Río Baker"
            />
          </div>

          <div>
            <label style={fieldLabel} htmlFor="itin-salida">
              Hora de salida
            </label>
            <input id="itin-salida" type="time" value={salida} onChange={(e) => setSalida(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabel} htmlFor="itin-regreso">
              Hora de regreso
            </label>
            <input id="itin-regreso" type="time" value={regreso} onChange={(e) => setRegreso(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={fieldLabel} htmlFor="itin-truchas">
              Truchas pescadas
            </label>
            <input
              id="itin-truchas"
              type="number"
              min="0"
              inputMode="numeric"
              value={truchas}
              onChange={(e) => setTruchas(e.target.value)}
              style={inputStyle}
              placeholder="—"
            />
            {/* Cero y vacío NO son lo mismo, y la diferencia se pierde si
                nadie la dice: un día sin pique es un dato del río, un día sin
                anotar es una tarea pendiente. */}
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6, lineHeight: 1.45 }}>
              Dejalo en blanco si todavía no se contó. Un <strong>0</strong> se guarda como día sin pique.
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={fieldLabel} htmlFor="itin-notas">
              Notas de la jornada
            </label>
            <textarea
              id="itin-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              placeholder="Clima, moscas que funcionaron, tramo del río, lo que convenga recordar el año que viene."
            />
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: 'var(--status-critico-dot)', marginTop: 'var(--space-6)' }}>{error}</div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'var(--space-7)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--border-soft)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="crm-btn crm-btn-primary" onClick={() => void guardar()} disabled={guardando || vaciando}>
              {guardando ? 'Guardando…' : 'Guardar jornada'}
            </button>
            <button className="crm-btn crm-btn-ghost" onClick={onClose} disabled={guardando || vaciando}>
              Cancelar
            </button>
          </div>
          {teniaAlgo && (
            <button
              onClick={() => void vaciar()}
              disabled={guardando || vaciando}
              style={{
                all: 'unset',
                cursor: guardando || vaciando ? 'default' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--status-critico-dot)',
                padding: '10px 4px',
              }}
            >
              {vaciando ? 'Vaciando…' : 'Vaciar el día'}
            </button>
          )}
        </div>

        {dia.UpdatedAt && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 'var(--space-5)' }}>
            Última anotación: {fmtSelloUtcCorto(dia.UpdatedAt)}
            {dia.UpdatedBy && ` · ${dia.UpdatedBy}`}
          </div>
        )}
      </div>
    </div>
  );
}
