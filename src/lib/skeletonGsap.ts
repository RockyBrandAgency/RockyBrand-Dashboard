import gsap from 'gsap';

// Spec real de Figma (frame "44 — Spec: Transiciones", item 04 "Estado de
// Carga (Skeleton/Shimmer)"): ciclo de pulso de 1.5s, transición de 0.3s.
// `prefers-reduced-motion` anula la animación por completo (mismo criterio
// que buttonHoverGsap.ts / Toggle.tsx).
export function startSkeletonPulse(els: HTMLElement[]): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || els.length === 0) {
    els.forEach((el) => {
      el.style.opacity = '0.6';
    });
    return () => {};
  }
  const tween = gsap.to(els, {
    opacity: 0.45,
    duration: 0.75,
    ease: 'power1.inOut',
    repeat: -1,
    yoyo: true,
    stagger: 0.06,
  });
  return () => tween.kill();
}
