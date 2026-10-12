import { useEffect, useId, useRef, useState } from 'react';
import type { BerryMedio } from '../../types';
import { formatearTamano, partesDetalle } from './formatos';
import { LineaDetalle } from './TarjetaMedio';

// Visor de un medio listo: el proxy del video, el JPEG de la foto o el audio
// original, tal cual los firma el backend.
//
// El tamaño se calcula a mano y no con CSS: un clip vertical tiene que caber
// entero en el alto de la ventana, y el <video> mide 300×150 hasta que llega
// su metadata. Con el ancho y alto del detalle (o los que trae el archivo) se
// ajusta a la caja disponible sin saltos.
//
// Las URLs firmadas vencen (`vence_en`). Si el archivo no carga, se pide la
// biblioteca de nuevo una vez y se reintenta con la URL nueva.

const ALTO_CABECERA = 64;
// En el celular el detalle puede ir en dos líneas.
const ALTO_CABECERA_MOVIL = 82;

function useVentana() {
  const [v, setV] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const alCambiar = () => setV({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);
  return v;
}

function ajustar(ancho: number, alto: number, maxW: number, maxH: number) {
  const escala = Math.min(maxW / ancho, maxH / alto, 1.5);
  return { width: Math.max(1, Math.floor(ancho * escala)), height: Math.max(1, Math.floor(alto * escala)) };
}

export function VisorMedio({
  medio,
  onCerrar,
  onRefrescar,
}: {
  medio: BerryMedio;
  onCerrar: () => void;
  /** Vuelve a pedir la biblioteca y devuelve este medio con URLs nuevas. */
  onRefrescar: (id: string) => Promise<BerryMedio | null>;
}) {
  const [src, setSrc] = useState(medio.ver_url);
  const [reintentado, setReintentado] = useState(false);
  const [fallo, setFallo] = useState(false);
  // Del video se conoce de antemano la medida del proxy; manda la que trae el
  // archivo al cargar. La foto se mide al cargar.
  const [dim, setDim] = useState<{ w: number; h: number } | null>(
    medio.tipo === 'video' && medio.detalle?.ancho && medio.detalle?.alto
      ? { w: medio.detalle.ancho, h: medio.detalle.alto }
      : null,
  );
  const medir = (w: number, h: number) => {
    if (w && h && (dim?.w !== w || dim?.h !== h)) setDim({ w, h });
  };
  const dialogo = useRef<HTMLDivElement>(null);
  const cerrar = useRef<HTMLButtonElement>(null);
  const vivo = useRef(true);
  const idTitulo = useId();
  const ventana = useVentana();

  useEffect(() => {
    vivo.current = true;
    cerrar.current?.focus();
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      vivo.current = false;
      document.body.style.overflow = previo;
    };
  }, []);

  // Escape cierra; Tab no sale del diálogo.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCerrar();
        return;
      }
      if (e.key !== 'Tab' || !dialogo.current) return;
      const enfocables = Array.from(
        dialogo.current.querySelectorAll<HTMLElement>('button, a[href], video, audio, [tabindex]:not([tabindex="-1"])'),
      );
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
  }, [onCerrar]);

  const alFallar = async () => {
    if (reintentado) {
      setFallo(true);
      return;
    }
    setReintentado(true);
    const nuevo = await onRefrescar(medio.id).catch(() => null);
    if (!vivo.current) return;
    if (nuevo?.ver_url && nuevo.ver_url !== src) setSrc(nuevo.ver_url);
    else setFallo(true);
  };

  const movil = ventana.w < 768;
  const margen = movil ? 16 : 32;
  const maxW = ventana.w - margen * 2;
  const cabecera = movil ? ALTO_CABECERA_MOVIL : ALTO_CABECERA;
  const maxH = ventana.h - margen * 2 - cabecera;
  const caja = dim ? ajustar(dim.w, dim.h, maxW, maxH) : null;
  const anchoPanel = medio.tipo === 'audio' ? Math.min(520, maxW) : Math.max(caja?.width ?? 0, Math.min(360, maxW));
  const detalle = [...partesDetalle(medio.tipo, medio.detalle), formatearTamano(medio.tamano)];
  const tamanoMedio = caja
    ? { width: caja.width, height: caja.height }
    : { maxWidth: maxW, maxHeight: maxH, width: 'auto', height: 'auto' };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(9, 9, 11, 0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: margen,
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        style={{ width: anchoPanel, maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <div
          style={{
            width: '100%',
            height: cabecera,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxSizing: 'border-box',
            paddingBottom: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, color: '#fff' }}>
            <div
              id={idTitulo}
              title={medio.nombre}
              style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {medio.nombre}
            </div>
            {detalle.length > 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.72)',
                  marginTop: 2,
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  ...(movil
                    ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }
                    : { whiteSpace: 'nowrap' as const }),
                }}
              >
                <LineaDetalle trozos={detalle} />
              </div>
            )}
          </div>
          <button
            ref={cerrar}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{
              all: 'unset',
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              background: 'rgba(255,255,255,0.12)',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {fallo || !src ? (
          <div
            role="alert"
            style={{
              color: '#fff',
              fontSize: 14,
              lineHeight: 1.5,
              padding: '32px 16px',
              textAlign: 'center',
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            No se pudo cargar el archivo. Cierra y vuelve a abrirlo en unos minutos.
          </div>
        ) : medio.tipo === 'video' ? (
          <video
            key={src}
            src={src}
            controls
            playsInline
            preload="metadata"
            aria-label={medio.nombre}
            onError={() => void alFallar()}
            onLoadedMetadata={(e) => {
              medir(e.currentTarget.videoWidth, e.currentTarget.videoHeight);
            }}
            style={{ display: 'block', background: '#000', borderRadius: 'var(--radius-sm)', ...tamanoMedio }}
          />
        ) : medio.tipo === 'foto' ? (
          <img
            key={src}
            src={src}
            alt={medio.nombre}
            onError={() => void alFallar()}
            onLoad={(e) => {
              medir(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
            }}
            style={{ display: 'block', borderRadius: 'var(--radius-sm)', objectFit: 'contain', ...tamanoMedio }}
          />
        ) : (
          <audio
            key={src}
            src={src}
            controls
            preload="metadata"
            aria-label={medio.nombre}
            onError={() => void alFallar()}
            style={{ display: 'block', width: '100%' }}
          />
        )}
      </div>
    </div>
  );
}
