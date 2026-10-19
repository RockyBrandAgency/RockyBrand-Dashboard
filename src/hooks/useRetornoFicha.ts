import { useCallback, useLayoutEffect, useRef } from 'react';

// Lista → ficha → lista sin perder el lugar (5.0.0). La pantalla devuelve la
// ficha en vez de la lista (patrón de TiendaGarantias), así que sus filtros
// siguen en el estado del componente; lo que se pierde al desmontar la lista
// es el scroll y el foco. Este hook los guarda al abrir y los devuelve al
// volver: el foco vuelve a la fila que abrió la ficha (WCAG 2.4.3) o, si esa
// fila ya no está, al título marcado con data-titulo-lista.
export function useRetornoFicha(abierta: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const guardado = useRef<{ fila: string; top: number; doc: number } | null>(null);

  // App no acota el alto, así que quien desplaza suele ser el documento y no
  // el contenedor: se guardan los dos.
  const recordar = useCallback((fila: string) => {
    guardado.current = { fila, top: scrollRef.current?.scrollTop ?? 0, doc: document.scrollingElement?.scrollTop ?? 0 };
  }, []);

  useLayoutEffect(() => {
    if (abierta) {
      // La ficha parte arriba, no a la altura donde estaba la fila.
      if (guardado.current && document.scrollingElement) document.scrollingElement.scrollTop = 0;
      return;
    }
    const g = guardado.current;
    const cont = scrollRef.current;
    if (!g || !cont) return;
    guardado.current = null;
    cont.scrollTop = g.top;
    if (document.scrollingElement) document.scrollingElement.scrollTop = g.doc;
    const fila = Array.from(cont.querySelectorAll<HTMLElement>('[data-fila]')).find((el) => el.dataset.fila === g.fila);
    const destino = fila ?? cont.querySelector<HTMLElement>('[data-titulo-lista]');
    destino?.focus({ preventScroll: Boolean(fila) });
  }, [abierta]);

  return { scrollRef, recordar };
}
