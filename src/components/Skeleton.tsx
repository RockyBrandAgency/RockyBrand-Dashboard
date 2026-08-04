import { useEffect, useRef } from 'react';
import { startSkeletonPulse } from '../lib/skeletonGsap';

// Bloque de shimmer individual - alto/ancho configurables, reusado por
// SkeletonBlock (loading genérico de AsyncState) y por cualquier pantalla
// que quiera un placeholder con la forma real de su contenido.
export function SkeletonBar({ width = '100%', height = 14, radius = 6 }: { width?: number | string; height?: number; radius?: number }) {
  return <div style={{ width, height, borderRadius: radius, background: 'var(--surface-2)' }} />;
}

// Skeleton genérico usado por AsyncState mientras no hay datos - imita la
// silueta de una tarjeta con 3 líneas de texto, repetida. No conoce la
// forma real de cada pantalla (AsyncState envuelve contenido arbitrario),
// así que es deliberadamente neutro en vez de intentar adivinar el layout
// final.
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const bars = Array.from(el.querySelectorAll<HTMLElement>('[data-skeleton-bar]'));
    return startSkeletonPulse(bars);
  }, [rows]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-7)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div data-skeleton-bar>
            <SkeletonBar width="35%" height={12} />
          </div>
          <div data-skeleton-bar>
            <SkeletonBar width="60%" height={20} />
          </div>
          <div data-skeleton-bar>
            <SkeletonBar width="45%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}
