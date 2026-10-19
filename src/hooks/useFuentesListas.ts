import { useEffect, useState } from 'react';

/** true cuando la fuente web (Inter, `display=swap`) ya cargó, o pasó `maxMs`.
 *  Ventas espera esto para cambiar el esqueleto por el contenido: si el texto
 *  se dibuja con la fuente de reserva y después cambia a Inter, las líneas se
 *  reacomodan y el contenido salta (CLS medido el 18-oct: 0,02–0,06 en el
 *  teléfono). `document.fonts.ready` también espera las hojas de estilo
 *  pendientes (CSS Font Loading Level 3, §2.4). Sin la API (jsdom), listo. */
// Los pesos que importa index.css (Inter 400–800).
const PESOS = [400, 500, 600, 700, 800];

export function useFuentesListas(maxMs = 1500): boolean {
  // No se confía en `status === 'loaded'` al montar: si la hoja de Google
  // Fonts (@import) todavía no llega, no hay ninguna fuente pendiente y el
  // estado dice «loaded» aunque Inter no esté (medido: CLS 0,012 a 390).
  const [listas, setListas] = useState(() => typeof document === 'undefined' || !document.fonts);
  useEffect(() => {
    if (listas) return;
    let vivo = true;
    const fin = () => {
      if (vivo) setListas(true);
    };
    const t = window.setTimeout(fin, maxMs);
    // Cada peso de Inter es un archivo aparte y solo se pide cuando un texto
    // lo usa: si se espera solo `ready`, los pesos que aparecen recién en el
    // contenido (700 de las cifras) cambian después. Se piden todos antes.
    void document.fonts.ready
      .then(() => Promise.all(PESOS.map((p) => document.fonts.load(`${p} 16px Inter`))))
      .then(fin, fin);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, [listas, maxMs]);
  return listas;
}
