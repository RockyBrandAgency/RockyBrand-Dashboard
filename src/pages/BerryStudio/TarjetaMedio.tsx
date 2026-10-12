import type { CSSProperties, ReactNode } from 'react';
import type { BerryMedio, BerryTipo } from '../../types';
import { AudioLinesIcon, FilmIcon, ImageIcon } from '../../components/icons/RockyIcons';
import { fechaRelativa, formatearTamano, partesDetalle, seEstaDemorando, tonoMedio, type Tono } from './formatos';

// Una tarjeta de la biblioteca. La etiqueta del estado la redacta el
// backend (`etiqueta`), igual que en Publicación: dos pantallas traduciendo
// el mismo estado por su cuenta terminan diciendo cosas distintas.

export function Badge({ texto, tono }: { texto: string; tono: Tono }) {
  return (
    <span
      style={{
        background: `var(--status-${tono}-bg)`,
        color: `var(--status-${tono}-text)`,
        borderRadius: 'var(--radius-sm)',
        padding: '3px 8px',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flexShrink: 1,
        minWidth: 0,
      }}
    >
      {texto}
    </span>
  );
}

/** Trozos de detalle separados por « · »: un trozo nunca se parte, y si la
 *  línea se corta, el punto queda al final de la línea de arriba. */
export function LineaDetalle({ trozos }: { trozos: string[] }) {
  return (
    <>
      {trozos.map((trozo, i) => (
        <span key={i}>
          <span style={{ whiteSpace: 'nowrap' }}>
            {trozo}
            {i < trozos.length - 1 && ' ·'}
          </span>
          {i < trozos.length - 1 && ' '}
        </span>
      ))}
    </>
  );
}

export function IconoTipo({ tipo, size }: { tipo: BerryTipo | null; size: number }) {
  if (tipo === 'audio') return <AudioLinesIcon size={size} />;
  if (tipo === 'foto') return <ImageIcon size={size} />;
  return <FilmIcon size={size} />;
}

const tarjeta: CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  minWidth: 0,
  background: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-card)',
  overflow: 'hidden',
  textAlign: 'left',
  color: 'var(--text)',
};

export function TarjetaMedio({
  medio,
  ahora,
  aqui = false,
  reanudable = false,
  quitando = false,
  errorQuitar = null,
  onAbrir,
  onQuitar,
}: {
  medio: BerryMedio;
  ahora: number;
  /** Esta pestaña lo está subiendo (o lo tiene en pausa). */
  aqui?: boolean;
  /** Este navegador guarda con qué seguirla. */
  reanudable?: boolean;
  quitando?: boolean;
  errorQuitar?: string | null;
  onAbrir: (m: BerryMedio, origen: HTMLElement) => void;
  onQuitar?: (m: BerryMedio) => void;
}) {
  const demorado = seEstaDemorando(medio, ahora);
  // Subiendo y sin nadie que la suba: quedó a medias en otra pestaña, otro
  // equipo o una sesión que se cerró.
  const aMedias = medio.estado === 'subiendo' && !aqui;
  const linea = [...partesDetalle(medio.tipo, medio.detalle), formatearTamano(medio.tamano)];

  const contenido: ReactNode = (
    <>
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 9',
          background: 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-faint)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {medio.miniatura_url && medio.tipo !== 'audio' ? (
          <img
            src={medio.miniatura_url}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <IconoTipo tipo={medio.tipo} size={36} />
        )}
      </div>
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span
            title={medio.nombre}
            style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {medio.nombre}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-sub)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {fechaRelativa(medio.creado, ahora)}
          </span>
        </div>
        <div style={{ display: 'flex', minWidth: 0 }}>
          <Badge texto={aMedias ? 'Subida a medias' : medio.etiqueta} tono={aMedias ? 'atencion' : tonoMedio(medio, ahora)} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5 }}>
          <LineaDetalle trozos={linea} />
        </div>
        {demorado && (
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--status-atencion-text)', lineHeight: 1.5 }}>
            Se está demorando más de lo normal
          </div>
        )}
        {medio.estado === 'error' && medio.error && (
          <div style={{ fontSize: 12, color: 'var(--status-critico-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {medio.error}
          </div>
        )}
        {aMedias && reanudable && (
          <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5 }}>
            Para seguirla, vuelve a elegir el mismo archivo.
          </div>
        )}
        {aMedias && errorQuitar && (
          <div style={{ fontSize: 12, color: 'var(--status-critico-text)', lineHeight: 1.5 }}>{errorQuitar}</div>
        )}
        {aMedias && medio.upload_id && onQuitar && (
          <div>
            <button
              type="button"
              className="crm-btn crm-btn-sm crm-btn-ghost"
              disabled={quitando}
              onClick={() => onQuitar(medio)}
              aria-label={`Quitar la subida a medias de ${medio.nombre}`}
            >
              {quitando ? 'Quitando…' : 'Quitar'}
            </button>
          </div>
        )}
      </div>
    </>
  );

  if (medio.estado === 'listo' && medio.ver_url) {
    return (
      <button
        type="button"
        onClick={(e) => onAbrir(medio, e.currentTarget)}
        aria-label={`Ver ${medio.nombre}`}
        style={{ all: 'unset', ...tarjeta, cursor: 'pointer' }}
      >
        {contenido}
      </button>
    );
  }
  return <div style={tarjeta}>{contenido}</div>;
}
