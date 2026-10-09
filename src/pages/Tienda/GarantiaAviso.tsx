import { useState } from 'react';
import { ConflictError, notificarTiendaGarantia, TimeoutError, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { StoreGarantia, StoreGarantiaAviso } from '../../types';
import { fmtMomento } from './garantias';

// Aviso de despacho por WhatsApp (2026-10-08, pedido de Mato). Va dentro de
// «2 Despacho» en la página de la garantía.
//
// El mensaje sale SOLO cuando Mato aprieta el botón y confirma: nada lo manda
// solo. Lo que se puede hacer (notificar, reenviar o nada, y por qué) lo
// decide el backend con la misma regla con que envía
// (garantias_aviso.accion_posible); acá solo se muestra. La vista previa es
// el texto exacto que saldría, armado por la misma función que envía.
//
// El aviso sale con lo GUARDADO: con cambios sin guardar, el botón espera.

const INCIERTO = 'No sabemos si el aviso salió. Espera dos minutos y recarga: si llegó, aparecerá como enviado.';

// WhatsApp marca la negrita con *asteriscos*: la vista previa la muestra igual
// que la verá el cliente.
function conNegritas(texto: string) {
  return texto.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
    parte.length > 2 && parte.startsWith('*') && parte.endsWith('*') ? <strong key={i}>{parte.slice(1, -1)}</strong> : parte,
  );
}

function lineaEstado(a: StoreGarantiaAviso): string {
  const veces = a.envios > 1 ? ` Lleva ${a.envios} envíos.` : '';
  switch (a.estado) {
    case 'enviando':
      return 'Enviándose…';
    case 'incierto':
      return 'No sabemos si salió: WhatsApp no respondió a tiempo. Si llegó, en unos minutos aparecerá como enviado.';
    case 'enviado':
      return `Enviado el ${fmtMomento(a.enviado_en)} a ${a.destino_avisado}.${veces}`;
    case 'entregado':
      return `Llegó a su WhatsApp el ${fmtMomento(a.entregado_en)} (${a.destino_avisado}).${veces}`;
    case 'leido':
      return `Lo leyó el ${fmtMomento(a.leido_en)} (${a.destino_avisado}).${veces}`;
    case 'fallido':
      return `No salió${a.fallido_en ? ` (${fmtMomento(a.fallido_en)})` : ''}: ${a.error?.detalle || 'WhatsApp lo rechazó.'}`;
    default:
      return 'Todavía no se le avisa.';
  }
}

export function GarantiaAviso({
  garantia,
  aviso: avisoInicial,
  cambiado,
  onEnviando,
  onAvisoCambiado,
  onRecargar,
  onVerActual,
}: {
  garantia: StoreGarantia;
  aviso: StoreGarantiaAviso;
  /** La página tiene cambios sin guardar. */
  cambiado: boolean;
  /** Mientras se envía, la página no deja guardar, eliminar ni salir. */
  onEnviando: (enviando: boolean) => void;
  /** El listado se queda con el aviso nuevo. */
  onAvisoCambiado: (aviso: StoreGarantiaAviso) => void;
  /** Tras un error: el aviso como quedó guardado, o null si no se pudo traer. */
  onRecargar: () => Promise<StoreGarantiaAviso | null>;
  onVerActual?: () => void;
}) {
  const { handleUnauthorized } = useAuth();
  const [aviso, setAviso] = useState(avisoInicial);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ texto: string; conflicto: boolean } | null>(null);
  const previa = aviso.vista_previa;
  const puede = aviso.accion !== '' && previa !== null;

  async function enviar() {
    if (!previa || aviso.accion === '' || cambiado || enviando) return;
    const reenviar = aviso.accion === 'reenviar';
    const pregunta = reenviar
      ? (aviso.estado === 'incierto'
          ? `No sabemos si el aviso anterior salió. ¿Mandarle otro a ${previa.destino}?`
          : `Este cliente ya tiene un aviso. ¿Mandarle otro a ${previa.destino}?`) +
        (aviso.cambio_desde_aviso ? '\n\nEl nuevo lleva los datos corregidos.' : '')
      : `¿Enviar el aviso de despacho por WhatsApp a ${previa.destino}?\n\nSale el mensaje de la vista previa.`;
    if (!window.confirm(pregunta)) return;

    setEnviando(true);
    onEnviando(true);
    setError(null);
    try {
      const r = await notificarTiendaGarantia(garantia.solicitud_id, garantia.actualizada_en ?? '', reenviar);
      setAviso(r.aviso);
      onAvisoCambiado(r.aviso);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
        return;
      }
      // Solo dos respuestas son seguras: un 409 (no se intentó) y un rechazo
      // de WhatsApp («No se envió…»). Un corte, un 5xx o un timeout no dicen
      // si salió: lo dice el estado guardado, que se trae a continuación.
      // Volver a apretar no duplica: si el primero salió, el backend pide
      // «Reenviar».
      const seguro = e instanceof ConflictError || (e instanceof Error && !(e instanceof TimeoutError) && e.message.startsWith('No se envió'));
      setError({
        texto: seguro && e instanceof Error ? e.message : INCIERTO,
        conflicto: e instanceof ConflictError,
      });
      const guardado = await onRecargar();
      if (guardado) {
        setAviso(guardado);
        onAvisoCambiado(guardado);
      }
    } finally {
      setEnviando(false);
      onEnviando(false);
    }
  }

  const recepcion = aviso.recepcion;
  const tonoEstado =
    aviso.estado === 'fallido' ? 'var(--status-critico-text)' : aviso.estado === 'incierto' ? 'var(--status-atencion-text)' : 'var(--text-sub)';
  // Abierta cuando hay algo por mandar: Mato ve lo que sale antes de apretar.
  const previaAbierta = aviso.accion === 'notificar' || aviso.cambio_desde_aviso;

  return (
    <section
      aria-labelledby={`aviso-${garantia.solicitud_id}`}
      style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--white)' }}
    >
      <h3 id={`aviso-${garantia.solicitud_id}`} style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
        Aviso al cliente por WhatsApp
      </h3>

      <div aria-live="polite" style={{ fontSize: 13, color: tonoEstado, marginTop: 6 }}>
        {lineaEstado(aviso)}
      </div>
      {recepcion && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-bien-text)', marginTop: 6 }}>
          ✓ Confirmó que lo recibió el {fmtMomento(recepcion.confirmada_en)}
          {recepcion.via === 'whatsapp' ? ' (botón «Lo recibí»)' : ''}.
        </div>
      )}
      {aviso.cambio_desde_aviso && aviso.accion === 'reenviar' && (
        <div className="crm-aviso alerta" style={{ margin: '10px 0 0', fontSize: 13 }}>
          Cambiaste datos desde el último aviso: lo que tiene el cliente ya no es correcto. Revisa la vista previa y reenvía.
        </div>
      )}
      {!puede && aviso.motivo && !recepcion && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{aviso.motivo}</div>}

      {previa && (
        <details open={previaAbierta} style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 13, color: 'var(--text-sub)', cursor: 'pointer' }}>Mensaje que recibe {previa.destino}</summary>
          <div style={{ marginTop: 8, maxWidth: 420, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', fontSize: 13, lineHeight: 1.45, color: 'var(--text)' }}>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{conNegritas(previa.texto)}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {previa.botones.map((b) => (
                <span key={b} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--white)', color: 'var(--primary)', border: '1px solid var(--border)' }}>
                  {b}
                </span>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            «Seguir mi envío» abre{' '}
            <a href={previa.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              el seguimiento del courier
            </a>
            . Revisa que funcione antes de avisar.
          </div>
        </details>
      )}

      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--status-critico-text)', marginTop: 10 }}>
          {error.texto}
          {error.conflicto && onVerActual && (
            <div style={{ marginTop: 6 }}>
              <button type="button" className="crm-btn crm-btn-tonal crm-btn-sm" onClick={onVerActual}>
                Ver la versión actual
              </button>
            </div>
          )}
        </div>
      )}

      {puede && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <button
            type="button"
            className={aviso.accion === 'notificar' ? 'crm-btn crm-btn-primary crm-btn-sm' : 'crm-btn crm-btn-tonal crm-btn-sm'}
            onClick={() => void enviar()}
            disabled={cambiado || enviando}
          >
            {enviando ? 'Enviando…' : aviso.accion === 'reenviar' ? 'Reenviar aviso' : aviso.estado === 'fallido' ? 'Reintentar el envío' : 'Notificar al cliente'}
          </button>
          {cambiado && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Guarda los cambios primero: el aviso sale con lo guardado.</span>}
        </div>
      )}
    </section>
  );
}
