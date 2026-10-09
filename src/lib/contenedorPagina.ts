import type { CSSProperties } from 'react';

// El contenedor de cada pantalla, uno solo para todas: si cada una lo
// escribe a mano, al cambiarlo en una se nota el salto de ancho al navegar.
//
// A los costados, 0 cuando sobra espacio (pedido de Mato, 2026-10-08) y
// hasta 40px cuando no. El % se mide sobre el área de contenido (la ventana
// menos la barra lateral): con 1160px o más queda en 0 (una ventana de
// 1440px con la barra de 280px) y con 1120px o menos vuelve a 40px. Así el
// texto nunca queda a menos de 40px del borde en un notebook chico o una
// tablet.
const MARGEN_LATERAL = 'clamp(0px, calc(1160px - 100%), 40px)';

export function contenedorPagina(
  isDesktop: boolean,
  { abajoDesktop = 72, abajoMobile = 88 }: { abajoDesktop?: number; abajoMobile?: number } = {},
): CSSProperties {
  return {
    maxWidth: 1080,
    margin: '0 auto',
    padding: isDesktop ? `36px ${MARGEN_LATERAL} ${abajoDesktop}px` : `20px 16px ${abajoMobile}px`,
  };
}
