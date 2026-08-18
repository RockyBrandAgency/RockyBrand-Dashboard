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
        // El tween se GUARDA y se mata en el cleanup. Sin eso, una recarga
        // que termina en menos de 150ms dejaba la pantalla en skeleton
        // PARA SIEMPRE: loading volvía a false y la rama de abajo ponía
        // displaySkeleton=false, pero el onComplete del tween todavía
        // vivo lo volvía a poner en true y ya nadie lo bajaba (loading no
        // vuelve a cambiar). Encontrado en vivo (2026-08-11) con
        // Playwright en Housekeeping, al recargar el tablero después de
        // marcar una habitación - pero le pasa a CUALQUIER pantalla de
        // este panel que recargue rápido (guardar fechas de una reserva,
        // Tienda, Email), no es propio de esa pantalla.
        const tween = gsap.to(contentRef.current, {
          opacity: 0,
          duration: 0.15,
          ease: 'power1.in',
          onComplete: () => setDisplaySkeleton(true),
        });
        prevLoading.current = loading;
        return () => {
          tween.kill();
        };
      }
      setDisplaySkeleton(true);
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
          <button className="crm-btn crm-btn-primary" onClick={onRetry}>
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return <div ref={contentRef}>{children}</div>;
}
