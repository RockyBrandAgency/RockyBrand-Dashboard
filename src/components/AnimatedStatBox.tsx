import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

// Contador animado liviano (GSAP, ya es dependencia de este panel) - pedido
// explícito de Mato 2026-08-07, para el box de visitas de Estados Unidos en
// Métricas > Resumen: "si es necesario un gráfico, que lo use animado".
// Se descartó Remotion (piensa en renderizar video, no en un widget que se
// actualiza solo en un panel web en vivo - decisión confirmada con Mato) a
// favor de esto: mismo look que KpiRow/las tarjetas de Facebook-Instagram,
// solo que el número sube animado al cargar en vez de aparecer estático.
// Respeta prefers-reduced-motion, mismo criterio que buttonHoverGsap.ts.
export function AnimatedStatBox({ label, value, sub }: { label: string; value: number | null; sub?: string | null }) {
  const valorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = valorRef.current;
    if (!el) return;
    if (value == null) {
      el.textContent = '—';
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = value.toLocaleString('es-CL');
      return;
    }
    const contador = { n: 0 };
    const tween = gsap.to(contador, {
      n: value,
      duration: 1.1,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = Math.round(contador.n).toLocaleString('es-CL');
      },
    });
    return () => {
      tween.kill();
    };
  }, [value]);

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, boxShadow: 'var(--shadow-card)' }}>
      <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{label}</div>
      <div ref={valorRef} style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginTop: 8, letterSpacing: '-0.01em' }}>
        {value == null ? '—' : '0'}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
