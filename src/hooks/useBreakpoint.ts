import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function computeBreakpoint(width: number): Breakpoint {
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

// Los 3 anchos reales de Figma (frames 21-24 mobile / 25-28 tablet 834px /
// desktop 1440px). Antes solo existía useIsDesktop() (un solo corte en
// 1024px) - un viewport de 834px (el ancho real del canvas tablet de
// Figma) caía en "mobile" y renderizaba el MobileBar completo en vez del
// nav-rail angosto que el archivo real especifica para ese rango.
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => computeBreakpoint(window.innerWidth));
  useEffect(() => {
    const onResize = () => setBp(computeBreakpoint(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return bp;
}
