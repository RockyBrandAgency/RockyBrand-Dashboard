import type { BerryMedio } from '../../types';
import type { Tono } from './formatos';
import { formatearRestante, formatearTamano, formatearVelocidad } from './formatos';
import { Badge, IconoTipo } from './TarjetaMedio';
import { cancelarSubida, pausarSubida, quitarSubida, reanudarSubida, reintentarSubida, type EntradaSubida } from './subidasEnCurso';

// La cola de lo que esta pestaña está subiendo. Una vez completada, el estado
// lo dicta la biblioteca (Preparando → Listo), no la cola.

interface Vista {
  texto: string;
  tono: Tono;
  error: string | null;
  porcentaje: number;
}

function vista(e: EntradaSubida, medio: BerryMedio | undefined): Vista {
  const porcentaje = e.tamano > 0 ? Math.min(100, Math.floor((e.subidos / e.tamano) * 100)) : 0;
  switch (e.estado) {
    case 'en-espera':
      return { texto: 'En espera', tono: 'neutro', error: null, porcentaje: 0 };
    case 'iniciando':
    case 'subiendo':
      return { texto: 'Subiendo', tono: 'info', error: null, porcentaje };
    case 'completando':
      return { texto: 'Completando', tono: 'info', error: null, porcentaje: 100 };
    case 'pausada':
      return { texto: 'En pausa', tono: 'atencion', error: null, porcentaje };
    case 'cancelada':
      return { texto: 'Cancelada', tono: 'neutro', error: null, porcentaje };
    case 'error':
      return { texto: 'Error', tono: 'critico', error: e.error, porcentaje };
    case 'completada': {
      const m = medio ?? e.medio;
      if (m?.estado === 'listo') return { texto: 'Listo', tono: 'bien', error: null, porcentaje: 100 };
      if (m?.estado === 'error') return { texto: 'Error', tono: 'critico', error: m.error, porcentaje: 100 };
      return { texto: 'Preparando', tono: 'info', error: null, porcentaje: 100 };
    }
  }
}

function lineaProgreso(e: EntradaSubida, v: Vista): string {
  if (e.estado === 'pausada') return `${v.porcentaje} % · ${formatearTamano(e.subidos)} de ${formatearTamano(e.tamano)}`;
  if (e.estado === 'subiendo' || e.estado === 'iniciando') {
    const partes = [`${v.porcentaje} %`, `${formatearTamano(e.subidos)} de ${formatearTamano(e.tamano)}`];
    if (e.velocidad) partes.push(formatearVelocidad(e.velocidad));
    if (e.restanteS != null) partes.push(formatearRestante(e.restanteS));
    return partes.filter(Boolean).join(' · ');
  }
  if (e.estado === 'completando') return 'Uniendo las partes en el servidor…';
  if (e.estado === 'completada') return formatearTamano(e.tamano);
  return `${formatearTamano(e.tamano)}`;
}

function colorBarra(t: Tono): string {
  if (t === 'critico') return 'var(--status-critico-dot)';
  if (t === 'bien') return 'var(--status-bien-dot)';
  if (t === 'neutro') return 'var(--status-neutro-dot)';
  return 'var(--primary)';
}

function FilaSubida({ e, medio }: { e: EntradaSubida; medio: BerryMedio | undefined }) {
  const v = vista(e, medio);
  const subiendo = e.estado === 'iniciando' || e.estado === 'subiendo';
  const puedeCancelar = subiendo || e.estado === 'en-espera' || e.estado === 'pausada';
  const sinBarra = e.estado === 'error' && e.subidos === 0;
  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-card)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ color: 'var(--text-faint)', display: 'flex', flexShrink: 0 }}>
          <IconoTipo tipo={e.tipo} size={18} />
        </span>
        <span
          title={e.nombre}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {e.nombre}
        </span>
        <span style={{ flexShrink: 0, display: 'flex' }}>
          <Badge texto={v.texto} tono={v.tono} />
        </span>
      </div>

      {!sinBarra && (
        <div
          role="progressbar"
          aria-label={`Progreso de ${e.nombre}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={v.porcentaje}
          style={{ height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)', overflow: 'hidden' }}
        >
          <div
            style={{
              height: '100%',
              width: `${v.porcentaje}%`,
              background: colorBarra(v.tono),
              borderRadius: 'var(--radius-pill)',
              transition: 'width 0.25s linear',
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px 12px' }}>
        <span style={{ fontSize: 12, color: 'var(--text-sub)', fontVariantNumeric: 'tabular-nums', minWidth: 0 }}>
          {lineaProgreso(e, v)}
        </span>
        <span style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {subiendo && (
            <button type="button" className="crm-btn crm-btn-sm crm-btn-text" onClick={() => pausarSubida(e.clave)}>
              Pausar
            </button>
          )}
          {e.estado === 'pausada' && (
            <button type="button" className="crm-btn crm-btn-sm crm-btn-tonal" onClick={() => reanudarSubida(e.clave)}>
              Reanudar
            </button>
          )}
          {puedeCancelar && (
            <button type="button" className="crm-btn crm-btn-sm crm-btn-text" onClick={() => cancelarSubida(e.clave)}>
              Cancelar
            </button>
          )}
          {e.estado === 'error' && e.reintentable && (
            <button type="button" className="crm-btn crm-btn-sm crm-btn-tonal" onClick={() => reintentarSubida(e.clave)}>
              Reintentar
            </button>
          )}
          {!puedeCancelar && e.estado !== 'completando' && (
            <button
              type="button"
              className="crm-btn crm-btn-sm crm-btn-text"
              onClick={() => quitarSubida(e.clave)}
              aria-label={`Quitar ${e.nombre} de la lista`}
            >
              Quitar
            </button>
          )}
        </span>
      </div>

      {v.error && (
        <div style={{ fontSize: 12, color: 'var(--status-critico-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
          {v.error}
        </div>
      )}
    </div>
  );
}

export function ListaSubidas({ entradas, medios }: { entradas: EntradaSubida[]; medios: Map<string, BerryMedio> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entradas.map((e) => (
        <FilaSubida key={e.clave} e={e} medio={e.medio ? medios.get(e.medio.id) : undefined} />
      ))}
    </div>
  );
}
