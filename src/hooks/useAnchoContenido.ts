import { useCallback, useEffect, useRef, useState } from 'react';

// Ancho del contenido de un elemento (sin su padding), al día cuando cambia
// la ventana o la barra lateral. Para decidir el diseño según el espacio que
// de verdad queda, no según el ancho de la ventana: entre la barra lateral y
// los márgenes, la misma ventana deja anchos muy distintos.
//
// La primera medición se hace al montar, antes de pintar: si esperara al
// ResizeObserver, el primer cuadro saldría con el diseño equivocado. Sin
// ResizeObserver (jsdom) queda esa primera medición.
export function useAnchoContenido<T extends HTMLElement>(): [(el: T | null) => void, number | null] {
  const [ancho, setAncho] = useState<number | null>(null);
  const observador = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    observador.current?.disconnect();
    observador.current = null;
    if (!el) return;
    const cs = getComputedStyle(el);
    setAncho(el.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0'));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    observador.current = ro;
  }, []);

  useEffect(() => () => observador.current?.disconnect(), []);

  return [ref, ancho];
}
