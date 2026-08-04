import { useEffect, useState } from 'react';

// Spec real de Figma (frame "45 — Spec: Logo Cliente"), reglas 01-03:
// - object-fit: contain siempre (nunca se recorta ni se deforma).
// - Fallback: iniciales calculadas (primera letra de las 2 primeras
//   palabras del nombre comercial), sobre el color primario REAL del
//   cliente (ya disponible vía var(--primary), mutado en runtime por
//   applyClientTheme). No un ícono genérico fijo.
// - Si el logo subido es demasiado claro para verse sobre blanco, se
//   renderiza sobre un fondo #F4F4F5 en vez de blanco/transparente.
function initialsFrom(name: string | null): string {
  if (!name) return '';
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? '').join('');
}

// Heurística de contraste: si el logo es mayormente pixeles claros
// (luminancia promedio alta) Y con baja opacidad de fondo, se asume que
// se "pierde" sobre blanco puro - variante barata de sampling, no un
// analizador de imagen completo (no hay libs de imagen en el frontend).
function useIsLogoTooLight(src: string | null): boolean {
  const [tooLight, setTooLight] = useState(false);
  useEffect(() => {
    if (!src) {
      setTooLight(false);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        const w = (canvas.width = 32);
        const h = (canvas.height = 32);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let litSum = 0;
        let litCount = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 16) continue;
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          litSum += lum;
          litCount++;
        }
        if (litCount === 0) return;
        setTooLight(litSum / litCount > 235);
      } catch {
        // Canvas puede fallar por CORS con algunos hosts - no bloquea el
        // render, solo se pierde la detección de contraste para ese caso.
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return tooLight;
}

export function ClientLogo({
  src,
  displayName,
  size,
  radius = 'var(--radius-sm)',
}: {
  src: string | null;
  displayName: string | null;
  size: number;
  radius?: number | string;
}) {
  const tooLight = useIsLogoTooLight(src);

  if (src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: radius,
          border: '1px solid var(--border-soft)',
          background: tooLight ? '#F4F4F5' : 'var(--white)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <img src={src} alt={displayName ?? 'Logo del cliente'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  const initials = initialsFrom(displayName);
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius,
        background: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ color: '#fff', fontSize: Math.max(10, Math.round(size * 0.38)), fontWeight: 700, letterSpacing: '-0.02em' }}>{initials}</span>
    </div>
  );
}
