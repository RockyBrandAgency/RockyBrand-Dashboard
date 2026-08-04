import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

// Spec real de Figma (frame "44 — Spec: Transiciones", item 01 "Indicador
// Deslizante de Pestañas"): 0.3s power2.inOut, el subrayado se desliza
// entre pestañas en vez de aparecer/desaparecer de golpe. Reemplaza el
// `border-bottom-color` estático de `.crm-tab.active` (index.css) por un
// elemento propio animado con GSAP.
export function TabsWithIndicator<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const firstRun = useRef(true);

  const moveIndicator = (animate: boolean) => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    const btn = btnRefs.current.get(active);
    if (!container || !indicator || !btn) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const x = btnRect.left - containerRect.left;
    const width = btnRect.width;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduced) {
      gsap.set(indicator, { x, width });
    } else {
      gsap.to(indicator, { x, width, duration: 0.3, ease: 'power2.inOut', overwrite: 'auto' });
    }
  };

  useLayoutEffect(() => {
    moveIndicator(!firstRun.current);
    firstRun.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    const onResize = () => moveIndicator(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="crm-tabbar" role="tablist" style={{ position: 'relative' }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            if (el) btnRefs.current.set(t.id, el);
          }}
          className={`crm-tab${active === t.id ? ' active' : ''}`}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
      <div ref={indicatorRef} style={{ position: 'absolute', bottom: -1, left: 0, height: 2, background: 'var(--primary)', width: 0 }} />
    </div>
  );
}
