import { useEffect, useId, useRef, useState } from 'react';
import {
  borrarReservaDefinitivo,
  ConflictError,
  DEMASIADOS_ITEMS,
  ErrorTransitorio,
  NoEncontradoError,
  NOCHES_SIN_LIBERAR,
  RESERVA_MODIFICADA,
  SinPermisoError,
  SolicitudInvalidaError,
  SOLO_CANCELADAS,
  TimeoutError,
  UnauthorizedError,
} from '../../api/dashboardApi';
import { Icono } from '../../lib/iconos';

// «Borrar definitivamente» (10-nov-2026, decisión de Mato). Solo para una
// reserva CANCELADA y solo para el rol admin: quien decide si se muestra es
// la ficha; quien autoriza es el servidor (403 si no). No reemplaza a
// «Cancelar reserva», que sigue igual y sí se puede revertir.
//
// La confirmación va dentro de la página, como las demás de la ficha, y abre
// con el foco en «Volver sin cambios»: el botón seguro. Esc la cierra. Criterio visual
// del panel: radio de 6 px, espacios de 6/12/18 y badge → título → detalle.

interface Props {
  bookingId: string;
  /** Programa y fechas, lo único que muestra la confirmación de la reserva. */
  resumen: string;
  /** Texto del aviso que muestra la lista después de borrar. */
  textoAviso: string;
  /** El servidor la borró: la pantalla cierra la ficha y la saca de su lista. */
  onBorrada: (bookingId: string, textoAviso: string) => void;
  /** Recargar lo último (tras un 409 o un 404). */
  onRecargar: () => void;
  onUnauthorized: () => void;
}

interface Falla {
  texto: string;
  recargar: boolean;
}

// Cada 409 del contrato (ver borrarReservaDefinitivo) con su texto. Los dos
// que no se arreglan recargando mandan a soporte y no ofrecen «Recargar».
// Se arma al primer uso, no al importar: así las pruebas que simulan la API
// sin estas constantes pueden importar la ficha igual.
const porCodigo = (): Record<string, Falla> => ({
  [SOLO_CANCELADAS]: { texto: 'Esta reserva ya no está cancelada y solo se borran las canceladas. Recarga para ver su estado actual.', recargar: true },
  [RESERVA_MODIFICADA]: { texto: 'Alguien cambió esta reserva mientras la mirabas. Recarga para ver lo último; no se borró nada.', recargar: true },
  [NOCHES_SIN_LIBERAR]: { texto: 'No se borró: todavía quedan noches tomadas a nombre de esta reserva. Escribe a soporte de RockyBrand para liberarlas.', recargar: false },
  [DEMASIADOS_ITEMS]: { texto: 'No se borró: esta reserva tiene demasiados registros para borrarla desde el panel. Escribe a soporte de RockyBrand.', recargar: false },
});
const CONFLICTO_SIN_CODIGO: Falla = { texto: 'No se borró: la reserva cambió. Recarga para ver lo último.', recargar: true };
const NO_EXISTE: Falla = { texto: 'Esta reserva ya no existe: puede que otra persona la haya borrado. Recarga para actualizar la lista.', recargar: true };
const ID_INVALIDO: Falla = { texto: 'No se borró: el panel no reconoce el identificador de esta reserva. Recarga e intenta de nuevo.', recargar: true };
// POST sin reintento: tras un tiempo agotado o un corte la respuesta no llegó,
// pero el servidor pudo haberla borrado.
const SIN_RESPUESTA: Falla = { texto: 'No llegó la respuesta del servidor. Puede que se haya borrado; recarga para confirmar.', recargar: true };
const ERROR_SERVIDOR: Falla = { texto: 'No se borró: el servidor tuvo un problema. Intenta de nuevo en unos minutos y, si se repite, escribe a soporte de RockyBrand.', recargar: false };

function fallaDe(e: unknown): Falla {
  if (e instanceof ConflictError) return (e.code && porCodigo()[e.code]) || CONFLICTO_SIN_CODIGO;
  if (e instanceof NoEncontradoError) return NO_EXISTE;
  if (e instanceof SinPermisoError) return { texto: `No se borró. ${e.message}`, recargar: false };
  if (e instanceof SolicitudInvalidaError) return ID_INVALIDO;
  if (e instanceof TimeoutError) return SIN_RESPUESTA;
  // Un corte de red (o un 504 sin cuerpo propio) no trae mensaje del servidor.
  if (e instanceof ErrorTransitorio && !e.delServidor) return SIN_RESPUESTA;
  // 500, o un 503 con mensaje propio: el servidor respondió que no pudo.
  return ERROR_SERVIDOR;
}

const fila: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 6, margin: 0, fontSize: 14, lineHeight: '24px', color: 'var(--text)' };
const icono: React.CSSProperties = { display: 'inline-flex', flexShrink: 0, height: 24, alignItems: 'center', color: 'var(--text-sub)' };

export function BorrarReserva({ bookingId, resumen, textoAviso, onBorrada, onRecargar, onUnauthorized }: Props) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [falla, setFalla] = useState<Falla | null>(null);
  const abrirRef = useRef<HTMLButtonElement>(null);
  const seguroRef = useRef<HTMLButtonElement>(null);
  // Al cerrar sin borrar, el foco vuelve al botón que abrió (WCAG 2.4.3).
  const devolverFoco = useRef(false);

  useEffect(() => {
    if (abierto) seguroRef.current?.focus();
    else if (devolverFoco.current) {
      devolverFoco.current = false;
      abrirRef.current?.focus();
    }
  }, [abierto]);

  // Si falla, los botones vuelven a habilitarse y el foco cae al body: lo
  // devolvemos al botón seguro para que el teclado no pierda su lugar (2.4.3).
  // El error se anuncia igual por role="alert".
  useEffect(() => {
    if (falla) seguroRef.current?.focus();
  }, [falla]);

  function abrir() {
    setFalla(null);
    setAbierto(true);
  }

  function cerrar() {
    if (ocupado) return;
    devolverFoco.current = true;
    setFalla(null);
    setAbierto(false);
  }

  async function borrar() {
    if (ocupado) return;
    setOcupado(true);
    setFalla(null);
    try {
      await borrarReservaDefinitivo(bookingId);
    } catch (e) {
      setOcupado(false);
      if (e instanceof UnauthorizedError) return onUnauthorized();
      setFalla(fallaDe(e));
      return;
    }
    // La pantalla desmonta la ficha: aquí ya no se toca el estado.
    onBorrada(bookingId, textoAviso);
  }

  if (!abierto) {
    return (
      <div data-parte="detalle" style={{ marginTop: 12 }}>
        <button ref={abrirRef} type="button" className="crm-btn crm-btn-danger crm-btn-sm" style={{ borderRadius: 'var(--radius-sm)', whiteSpace: 'normal' }} onClick={abrir}>
          <Icono concepto="borrar" />
          Borrar definitivamente
        </button>
      </div>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-texto`}
      data-parte="detalle"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cerrar();
        }
      }}
      style={{
        marginTop: 12,
        padding: 12,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--white)',
        minWidth: 0,
      }}
    >
      <span className="chip" style={{ background: 'var(--status-critico-bg)', color: 'var(--status-critico-text)', borderRadius: 'var(--radius-sm)' }}>
        No se puede deshacer
      </span>
      <h2 id={`${id}-titulo`} style={{ margin: '12px 0 0', fontSize: 16, lineHeight: '24px', fontWeight: 700, color: 'var(--text)' }}>
        ¿Borrar definitivamente esta reserva?
      </h2>
      <div id={`${id}-texto`} style={{ display: 'grid', gap: 6, marginTop: 6 }}>
        <p style={{ ...fila, overflowWrap: 'anywhere' }}>
          <span style={icono}>
            <Icono concepto="fechas" />
          </span>
          <span style={{ minWidth: 0 }}>{resumen}</span>
        </p>
        <p style={fila}>
          <span style={icono}>
            <Icono concepto="borrar" />
          </span>
          <span style={{ minWidth: 0 }}>Se borra para siempre: no se puede recuperar.</span>
        </p>
        <p style={fila}>
          <span style={icono}>
            <Icono concepto="reservas" />
          </span>
          <span style={{ minWidth: 0 }}>Desaparece del historial de reservas y de Ventas.</span>
        </p>
      </div>
      {falla && (
        <div role="alert" style={{ marginTop: 12, fontSize: 13, lineHeight: '18px', color: 'var(--status-critico-text)' }}>
          {falla.texto}
          {falla.recargar && (
            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                className="crm-btn crm-btn-tonal crm-btn-sm"
                style={{ borderRadius: 'var(--radius-sm)' }}
                onClick={() => {
                  // La ficha sigue abierta: el foco vuelve al botón que abrió.
                  devolverFoco.current = true;
                  setFalla(null);
                  setAbierto(false);
                  onRecargar();
                }}
              >
                Recargar
              </button>
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, marginTop: 18 }}>
        <button ref={seguroRef} type="button" className="crm-btn crm-btn-ghost" style={{ borderRadius: 'var(--radius-sm)' }} onClick={cerrar} disabled={ocupado}>
          Volver sin cambios
        </button>
        <button
          type="button"
          className="crm-btn crm-btn-danger-filled"
          style={{ borderRadius: 'var(--radius-sm)', whiteSpace: 'normal', paddingInline: 18 }}
          onClick={() => void borrar()}
          disabled={ocupado}
          aria-busy={ocupado || undefined}
        >
          <Icono concepto="borrar" />
          {ocupado ? 'Borrando…' : 'Borrar definitivamente'}
        </button>
      </div>
    </div>
  );
}
