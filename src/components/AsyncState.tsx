import { useEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { SkeletonRows } from './Skeleton';

// El Make no traia ningun estado de carga/error (todo era data estatica
// hardcodeada) - este wrapper es nuevo, necesario para consumir una API
// real que puede tardar o fallar.
//
// Transición de carga = spec real de Figma (frame 44, items 02 y 04): el
// contenido anterior hace fade-out 0.15s ANTES de mostrar el skeleton
// (evita el corte brusco "contenido -> skeleton" cuando cambia un filtro
// que dispara un nuevo fetch), y el contenido nuevo hace fade-in 0.3s al
// llegar. `displaySkeleton` desacoplado de `loading` es lo que permite
// que el contenido viejo siga montado (y visible) durante esos 150ms.
export function AsyncState({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const prevLoading = useRef(loading);
  const [displaySkeleton, setDisplaySkeleton] = useState(loading);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (loading && !prevLoading.current) {
      if (contentRef.current && !reduced) {
        gsap.to(contentRef.current, { opacity: 0, duration: 0.15, ease: 'power1.in', onComplete: () => setDisplaySkeleton(true) });
      } else {
        setDisplaySkeleton(true);
      }
    } else if (!loading) {
      setDisplaySkeleton(false);
    }
    prevLoading.current = loading;
  }, [loading]);

  useEffect(() => {
    if (!displaySkeleton && !loading && contentRef.current) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      gsap.fromTo(contentRef.current, { opacity: 0 }, { opacity: 1, duration: reduced ? 0 : 0.3, ease: 'power1.out' });
    }
  }, [displaySkeleton, loading]);

  if (displaySkeleton) {
    return <SkeletonRows />;
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '60px 20px',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 28 }}>⚠️</span>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No se pudo cargar la información</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320 }}>{error}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              all: 'unset',
              background: 'var(--primary)',
              color: '#fff',
              borderRadius: 9,
              padding: '10px 22px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return <div ref={contentRef}>{children}</div>;
}
