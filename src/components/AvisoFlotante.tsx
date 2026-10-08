import { useEffect, useState } from 'react';

export interface Aviso {
  /** Distinto en cada aviso: uno nuevo reemplaza al anterior y reinicia el tiempo. */
  id: number;
  texto: string;
  tono?: 'error';
  accion?: {
    label: string;
    onClick: () => void;
    /** ⌘Z / Ctrl+Z también la dispara, fuera de un campo de texto. */
    deshacer?: boolean;
  };
}

const DURACION_MS = 8000;
const DURACION_ERROR_MS = 12000;

// Aviso al pie de la pantalla, con una acción opcional (2026-10-07, para el
// «Deshacer» de las garantías eliminadas). Se va solo a los pocos segundos,
// salvo mientras el puntero o el foco están encima: quien va a hacer clic en
// «Deshacer» no puede perder el botón en el camino (WCAG 2.2.1).
export function AvisoFlotante({ aviso, isDesktop, onCerrar }: { aviso: Aviso; isDesktop: boolean; onCerrar: () => void }) {
  const [pausado, setPausado] = useState(false);
  const { accion } = aviso;

  useEffect(() => {
    if (pausado) return;
    const t = window.setTimeout(onCerrar, aviso.tono === 'error' ? DURACION_ERROR_MS : DURACION_MS);
    return () => window.clearTimeout(t);
  }, [pausado, aviso.tono, onCerrar]);

  useEffect(() => {
    if (!accion?.deshacer) return;
    const deshacer = accion.onClick;
    function alTeclear(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      // En un campo, ⌘Z es deshacer lo que se escribió, no esto.
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      e.preventDefault();
      deshacer();
    }
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [accion]);

  return (
    <div
      role={aviso.tono === 'error' ? 'alert' : 'status'}
      className="aviso-flotante"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      style={{
        // Sobre la barra inferior del celular (56 px).
        bottom: isDesktop ? 24 : 'calc(72px + env(safe-area-inset-bottom))',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: 'max-content',
        maxWidth: 'calc(100vw - 32px)',
        boxSizing: 'border-box',
        padding: '6px 6px 6px 16px',
        borderRadius: 'var(--radius-md)',
        background: aviso.tono === 'error' ? 'var(--status-critico-text)' : '#27272a',
        color: '#fafafa',
        fontSize: 14,
        lineHeight: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, padding: '6px 0' }}>{aviso.texto}</span>
      {accion && (
        <button
          type="button"
          onClick={accion.onClick}
          title={accion.deshacer ? 'Deshacer (⌘Z o Ctrl+Z)' : undefined}
          style={{
            all: 'unset',
            cursor: 'pointer',
            flexShrink: 0,
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 700,
            color: aviso.tono === 'error' ? '#fff' : 'color-mix(in srgb, var(--primary) 45%, #ffffff)',
          }}
        >
          {accion.label}
        </button>
      )}
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar aviso"
        style={{
          all: 'unset',
          cursor: 'pointer',
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: 'rgba(250,250,250,0.7)',
        }}
      >
        ×
      </button>
    </div>
  );
}
