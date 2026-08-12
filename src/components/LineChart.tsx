import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import gsap from 'gsap';

interface TrendPoint {
  fecha: string;
  valor: number | null;
}

// Gráfico de tendencia SVG (sin librería de charts). La línea se dibuja al
// aparecer con GSAP (stroke-dashoffset), el área hace fade y el punto del
// último dato entra con un pop; al mover el mouse, una guía vertical y un
// punto siguen el dato real más cercano.
//
// Los nulls se saltan al armar la línea (se conecta el punto real anterior
// con el siguiente), pero SÍ cuentan para la posición en el eje X - un
// hueco se ve como tramo más inclinado, nunca como un corte.
//
// `menorEsMejor` invierte el eje Y. Es para la posición en Google: con el
// eje normal, subir del puesto 30 al 5 se dibuja como una caída, que es
// exactamente lo contrario de lo que pasó. Un gráfico que miente al revés
// es peor que no tenerlo.
export function LineChart({
  points,
  color,
  height = 120,
  formatValue = (v: number) => v.toLocaleString('es-CL'),
  formatDate,
  menorEsMejor = false,
}: {
  points: TrendPoint[];
  color: string;
  height?: number;
  formatValue?: (v: number) => string;
  formatDate?: (fecha: string) => string;
  menorEsMejor?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPolylineElement>(null);
  const areaRef = useRef<SVGPolygonElement>(null);
  const lastDotRef = useRef<HTMLDivElement>(null);
  const hoverDotRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<SVGLineElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 100;
  const H = height;
  const PAD_Y = 8;

  const realCount = points.filter((p) => p.valor !== null).length;

  const { coords, min, max } = useMemo(() => {
    if (!points.length) return { coords: [] as ([number, number] | null)[], min: 0, max: 0 };
    const values = points.map((p) => p.valor).filter((v): v is number => v !== null);
    if (!values.length) return { coords: points.map(() => null), min: 0, max: 0 };
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const span = maxV - minV || 1;
    const stepX = points.length > 1 ? W / (points.length - 1) : 0;
    const c = points.map((p, i) => {
      if (p.valor === null) return null;
      const x = points.length > 1 ? i * stepX : W / 2;
      const alto = (H - PAD_Y * 2);
      // Sin invertir: el valor más alto queda arriba. Invertido: el más
      // bajo queda arriba, porque "mejor" siempre tiene que ir hacia arriba.
      const y = menorEsMejor
        ? PAD_Y + ((p.valor - minV) / span) * alto
        : H - ((p.valor - minV) / span) * alto - PAD_Y;
      return [x, y] as [number, number];
    });
    return { coords: c, min: minV, max: maxV };
  }, [points, H, menorEsMejor]);

  const realCoords = coords.filter((c): c is [number, number] => c !== null);
  const hayLinea = realCoords.length > 1;

  // Entrada: la línea se dibuja sola. Cada tween se guarda para matarlo en
  // el cleanup - sin eso, StrictMode (que este app tiene activo) monta dos
  // veces y quedan dos tweens peleando por el mismo nodo, y un desmontaje a
  // mitad de animación deja el trazo cortado para siempre.
  useEffect(() => {
    const path = pathRef.current;
    if (!path || !hayLinea) return;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const largo = path.getTotalLength();
    const tweens: gsap.core.Tween[] = [];

    if (reducido) {
      gsap.set(path, { strokeDasharray: 'none', strokeDashoffset: 0 });
      if (areaRef.current) gsap.set(areaRef.current, { opacity: 1 });
      if (lastDotRef.current) gsap.set(lastDotRef.current, { opacity: 1, scale: 1 });
    } else {
      gsap.set(path, { strokeDasharray: largo, strokeDashoffset: largo });
      tweens.push(gsap.to(path, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out' }));
      if (areaRef.current) {
        tweens.push(gsap.fromTo(areaRef.current, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.3, ease: 'power1.out' }));
      }
      if (lastDotRef.current) {
        tweens.push(gsap.fromTo(lastDotRef.current,
          { opacity: 0, scale: 0.2 },
          { opacity: 1, scale: 1, duration: 0.45, delay: 0.9, ease: 'back.out(2.2)' }));
      }
    }

    return () => {
      tweens.forEach((t) => t.kill());
      // Deja el gráfico en su estado final, no a medio dibujar: si el
      // componente se remonta (recarga de datos), lo que se ve un instante
      // antes del próximo tween es el trazo completo.
      gsap.set(path, { strokeDasharray: 'none', strokeDashoffset: 0 });
      if (areaRef.current) gsap.set(areaRef.current, { opacity: 1 });
      if (lastDotRef.current) gsap.set(lastDotRef.current, { opacity: 1, scale: 1 });
    };
  }, [hayLinea, realCount, menorEsMejor]);

  // Hover: la guía y el punto viven siempre en el DOM con opacidad 0 y se
  // mueven con GSAP. Montarlos y desmontarlos con React haría que salten
  // de posición en vez de seguir al cursor.
  useEffect(() => {
    const dot = hoverDotRef.current;
    const guide = guideRef.current;
    if (!dot || !guide) return;
    const tweens: gsap.core.Tween[] = [];
    const coord = hoverIdx !== null ? coords[hoverIdx] : null;

    if (!coord) {
      tweens.push(gsap.to([dot, guide], { opacity: 0, duration: 0.15, overwrite: 'auto' }));
    } else {
      const [x, y] = coord;
      tweens.push(gsap.to(dot, {
        left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`,
        opacity: 1, duration: 0.12, ease: 'power2.out', overwrite: 'auto',
      }));
      tweens.push(gsap.to(guide, {
        attr: { x1: x, x2: x }, opacity: 1, duration: 0.12, ease: 'power2.out', overwrite: 'auto',
      }));
    }
    return () => tweens.forEach((t) => t.kill());
  }, [hoverIdx, coords, H]);

  if (!realCoords.length) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Sin datos todavía</div>
    );
  }

  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let closest: number | null = null;
    let closestDist = Infinity;
    coords.forEach((c, i) => {
      if (!c) return;
      const d = Math.abs(c[0] - relX);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    });
    setHoverIdx(closest);
  };

  const areaPoints = hayLinea
    ? `${realCoords[0][0]},${H} ${realCoords.map(([x, y]) => `${x},${y}`).join(' ')} ${realCoords[realCoords.length - 1][0]},${H}`
    : '';

  const lastReal = realCoords[realCoords.length - 1];
  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;
  const gradientId = `lc-${color.replace(/[^a-zA-Z0-9]/g, '')}${menorEsMejor ? '-inv' : ''}`;
  // Arriba siempre va "mejor": el valor más alto, salvo en posición.
  const etiquetaArriba = menorEsMejor ? min : max;
  const etiquetaAbajo = menorEsMejor ? max : min;

  const punto = (ref: React.RefObject<HTMLDivElement | null>, x: number, y: number, visible: boolean) => (
    <div
      ref={ref}
      style={{
        position: 'absolute', left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`,
        width: 7, height: 7, borderRadius: '50%', background: color,
        transform: 'translate(-50%,-50%)', border: '2px solid var(--white)',
        opacity: visible ? 1 : 0, pointerEvents: 'none',
      }}
    />
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', width: 44, flexShrink: 0, textAlign: 'right' }}>
          <span>{formatValue(etiquetaArriba)}</span>
          <span>{formatValue(etiquetaAbajo)}</span>
        </div>
        <div style={{ position: 'relative', flex: 1, height: H }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {hayLinea && (
              <>
                {areaPoints && <polygon ref={areaRef} points={areaPoints} fill={`url(#${gradientId})`} stroke="none" />}
                <polyline
                  ref={pathRef}
                  points={realCoords.map(([x, y]) => `${x},${y}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
            <line
              ref={guideRef}
              x1={0} x2={0} y1={0} y2={H}
              stroke="var(--border)" strokeWidth={1}
              vectorEffect="non-scaling-stroke" opacity={0}
            />
          </svg>
          {punto(lastDotRef, lastReal[0], lastReal[1], !hayLinea)}
          {punto(hoverDotRef, 0, 0, false)}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginLeft: 52, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{formatDate ? formatDate(points[0].fecha) : points[0].fecha}</span>
        <span>{formatDate ? formatDate(points[points.length - 1].fecha) : points[points.length - 1].fecha}</span>
      </div>
      {hoverPoint && hoverPoint.valor !== null && (
        <div style={{ marginLeft: 52, marginTop: 4, fontSize: 12, color: 'var(--text)' }}>
          <strong>{formatValue(hoverPoint.valor)}</strong>
          <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{formatDate ? formatDate(hoverPoint.fecha) : hoverPoint.fecha}</span>
        </div>
      )}
      {realCount < 4 && (
        <div style={{ marginLeft: 52, marginTop: 6, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Solo {realCount} punto{realCount === 1 ? '' : 's'} real{realCount === 1 ? '' : 'es'} — se completa con el tiempo
        </div>
      )}
    </div>
  );
}
