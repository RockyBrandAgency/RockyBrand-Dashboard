import { useEffect, useMemo, useRef, useState, useId } from 'react';
import gsap from 'gsap';
import { scaleLinear, scaleTime } from 'd3-scale';
import { line as d3line, area as d3area, curveMonotoneX } from 'd3-shape';
import { extent, mean, bisector } from 'd3-array';

export interface TrendPoint {
  fecha: string; // ISO date
  valor: number | null;
}

interface TrendChartProps {
  points: TrendPoint[];
  previousPeriodPoints?: TrendPoint[];
  color: string;
  height?: number;
  compact?: boolean; // menos ticks de eje - pantallas angostas
  formatValue?: (v: number) => string;
  formatDate?: (iso: string) => string;
  unitLabel?: string; // para el tooltip, ej "seguidores"
}

const defaultFormatValue = (v: number) => v.toLocaleString('es-CL');
const defaultFormatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });

// Gráfico de tendencia real: curva suavizada con huecos honestos (nunca
// interpola entre 2 puntos faltantes), área en degradado de la marca,
// línea de promedio punteada, comparación con el período anterior en
// gris tenue, anotaciones de máximo/mínimo, tooltip real al hover,
// trazo que se dibuja al aparecer (respeta prefers-reduced-motion) -
// pedido explícito de Mato (2026-08-01): "nivel profesional, no de
// plantilla". d3 solo como capa de cálculo (scale/shape/array), el SVG
// se arma a mano.
export function TrendChart({
  points,
  previousPeriodPoints,
  color,
  height = 220,
  compact = false,
  formatValue = defaultFormatValue,
  formatDate = defaultFormatDate,
  unitLabel = '',
}: TrendChartProps) {
  const gradientId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const anotRef = useRef<SVGGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 640; // viewBox lógico - escala por CSS, no por JS
  const margin = { top: 24, right: 30, bottom: compact ? 20 : 28, left: 30 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const validPoints = points.filter((p) => p.valor !== null) as { fecha: string; valor: number }[];

  const { pathD, areaD, prevPathD, xScale, yScale, avg, maxPoint, minPoint, dates } = useMemo(() => {
    if (validPoints.length === 0) {
      return { pathD: '', areaD: '', prevPathD: '', xScale: null, yScale: null, avg: null, maxPoint: null, minPoint: null, dates: [] as Date[] };
    }
    const dates = points.map((p) => new Date(`${p.fecha}T00:00:00`));
    const [xMin, xMax] = extent(dates) as [Date, Date];
    const x = scaleTime().domain([xMin, xMax]).range([0, innerW]);

    const allValues = [...validPoints.map((p) => p.valor), ...((previousPeriodPoints ?? []).filter((p) => p.valor !== null).map((p) => p.valor as number))];
    const yMin = Math.min(0, ...allValues);
    const yMax = Math.max(...allValues);
    const pad = (yMax - yMin) * 0.12 || 1;
    const y = scaleLinear()
      .domain([yMin - pad, yMax + pad])
      .range([innerH, 0]);

    const lineGen = d3line<{ fecha: string; valor: number | null }>()
      .defined((d) => d.valor !== null)
      .x((d) => x(new Date(`${d.fecha}T00:00:00`)))
      .y((d) => y(d.valor as number))
      .curve(curveMonotoneX);
    const areaGen = d3area<{ fecha: string; valor: number | null }>()
      .defined((d) => d.valor !== null)
      .x((d) => x(new Date(`${d.fecha}T00:00:00`)))
      .y0(innerH)
      .y1((d) => y(d.valor as number))
      .curve(curveMonotoneX);

    const avgVal = mean(validPoints, (d) => d.valor) ?? null;
    let maxP = validPoints[0];
    let minP = validPoints[0];
    for (const p of validPoints) {
      if (p.valor > maxP.valor) maxP = p;
      if (p.valor < minP.valor) minP = p;
    }
    const showAnnotations = validPoints.length >= 3 && maxP.fecha !== minP.fecha;

    return {
      pathD: lineGen(points) ?? '',
      areaD: areaGen(points) ?? '',
      prevPathD: previousPeriodPoints ? lineGen(previousPeriodPoints) ?? '' : '',
      xScale: x,
      yScale: y,
      avg: avgVal,
      maxPoint: showAnnotations ? maxP : null,
      minPoint: showAnnotations ? minP : null,
      dates,
    };
  }, [points, previousPeriodPoints, innerW, innerH]);

  const bisectDate = useMemo(() => bisector<Date, Date>((d) => d).left, []);

  // Entrada del gráfico con GSAP (2026-08-18, pedido de Mato: "utiliza GSAP
  // o Remotion para los gráficos de los datos"). Remotion quedó descartado
  // para esto en su momento y con él mismo (ver AnimatedStatBox.tsx): Remotion
  // piensa en renderizar video, no en un widget que se redibuja solo cuando
  // llegan datos nuevos.
  //
  // Reemplaza a la animación de @keyframes que tenía antes este archivo. No es
  // cosmético: un @keyframes corre una sola vez al montar el nodo y no vuelve
  // a dispararse cuando cambian los datos, así que al cambiar el rango de
  // fechas la curva nueva aparecía de golpe. Con GSAP se re-anima con cada
  // serie, y además se puede matar en el cleanup - que es lo que evita que un
  // desmontaje a mitad de camino (o el doble montaje de StrictMode) deje el
  // trazo cortado para siempre, la trampa ya documentada en LineChart.tsx.
  //
  // pathLength={1} en el <path> normaliza el largo del trazo a 1, así que el
  // dash no depende del largo real de la curva y no hay que medirla.
  useEffect(() => {
    const path = pathRef.current;
    if (!path || !pathD) return;
    const area = areaRef.current;
    const anotaciones = anotRef.current ? Array.from(anotRef.current.children) : [];
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const dejarEnFinal = () => {
      gsap.set(path, { strokeDasharray: 'none', strokeDashoffset: 0 });
      if (area) gsap.set(area, { opacity: 1 });
      if (anotaciones.length) gsap.set(anotaciones, { opacity: 1 });
    };

    if (reducido) {
      dejarEnFinal();
      return;
    }

    const tweens: gsap.core.Tween[] = [];
    gsap.set(path, { strokeDasharray: 1, strokeDashoffset: 1 });
    tweens.push(gsap.to(path, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out' }));
    if (area) {
      tweens.push(gsap.fromTo(area, { opacity: 0 }, { opacity: 1, duration: 0.7, delay: 0.2, ease: 'power1.out' }));
    }
    if (anotaciones.length) {
      // SOLO opacity, nunca scale ni transform. Esos <g> ya tienen un
      // `transform={translate(...)}` que escribe React con la posición real
      // del máximo y del mínimo; si GSAP también escribiera transform serían
      // dos dueños de la misma propiedad y la etiqueta saltaría de lugar al
      // llegar datos nuevos. Es el mismo bug que ya está documentado en
      // index.css para las fichas de la pantalla del cerebro.
      tweens.push(
        gsap.fromTo(anotaciones, { opacity: 0 }, { opacity: 1, duration: 0.45, delay: 0.75, stagger: 0.1, ease: 'power2.out' }),
      );
    }

    return () => {
      tweens.forEach((t) => t.kill());
      dejarEnFinal();
    };
  }, [pathD, areaD, prevPathD]);

  if (validPoints.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Sin datos todavía
      </div>
    );
  }

  const handleMove = (clientX: number) => {
    if (!containerRef.current || !xScale) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * width - margin.left;
    const targetDate = xScale.invert(relX);
    let idx = bisectDate(dates, targetDate);
    idx = Math.max(0, Math.min(points.length - 1, idx));
    // Snap al punto real más cercano con dato, para no mostrar tooltip
    // sobre un hueco.
    let best = idx;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      if (p.valor === null) return;
      const d = Math.abs(dates[i].getTime() - targetDate.getTime());
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHoverIdx(best);
  };

  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;
  const hoverValid = hoverPoint && hoverPoint.valor !== null && xScale && yScale;
  const prevValue = hoverIdx !== null && hoverIdx > 0 ? points[hoverIdx - 1]?.valor : null;
  const delta = hoverValid && prevValue !== null && prevValue !== undefined ? (hoverPoint!.valor as number) - prevValue : null;

  const xTicks = compact ? (dates.length > 1 ? [dates[0], dates[dates.length - 1]] : dates) : undefined;

  // Evita que la etiqueta de una anotación se corte contra el borde del
  // SVG cuando el punto está cerca del inicio/fin de la serie.
  const edgeAnchor = (x: number): 'start' | 'middle' | 'end' => {
    if (x < 28) return 'start';
    if (x > innerW - 28) return 'end';
    return 'middle';
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%' }}
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Línea de promedio, punteada y discreta */}
          {/* Área en degradado (fondo) */}
          <path ref={areaRef} d={areaD} fill={`url(#${gradientId})`} />

          {/* Línea de promedio, punteada y discreta - encima del área */}
          {avg !== null && yScale && (
            <line x1={0} x2={innerW} y1={yScale(avg)} y2={yScale(avg)} stroke="var(--text-muted)" strokeOpacity={0.5} strokeDasharray="3,4" strokeWidth={1} />
          )}

          {/* Período anterior, gris tenue detrás de la serie actual */}
          {prevPathD && (
            <path d={prevPathD} fill="none" stroke="var(--text-muted)" strokeOpacity={0.3} strokeWidth={1.5} strokeDasharray="2,3" />
          )}

          {/* Línea principal - el trazo se dibuja con GSAP (ver el useEffect) */}
          <path ref={pathRef} d={pathD} fill="none" stroke={color} strokeWidth={2.25} pathLength={1} />

          {/* Anotaciones de máximo/mínimo */}
          <g ref={anotRef}>
          {maxPoint && xScale && yScale && (
            <g transform={`translate(${xScale(new Date(`${maxPoint.fecha}T00:00:00`))},${yScale(maxPoint.valor)})`}>
              <circle r={3} fill={color} />
              <text
                y={-9}
                dx={edgeAnchor(xScale(new Date(`${maxPoint.fecha}T00:00:00`))) === 'start' ? 4 : edgeAnchor(xScale(new Date(`${maxPoint.fecha}T00:00:00`))) === 'end' ? -4 : 0}
                textAnchor={edgeAnchor(xScale(new Date(`${maxPoint.fecha}T00:00:00`)))}
                fontSize={10}
                fontWeight={700}
                fill="var(--text)"
              >
                {formatValue(maxPoint.valor)}
              </text>
            </g>
          )}
          {minPoint && xScale && yScale && (
            <g transform={`translate(${xScale(new Date(`${minPoint.fecha}T00:00:00`))},${yScale(minPoint.valor)})`}>
              <circle r={3} fill={color} opacity={0.7} />
              <text
                y={16}
                dx={edgeAnchor(xScale(new Date(`${minPoint.fecha}T00:00:00`))) === 'start' ? 4 : edgeAnchor(xScale(new Date(`${minPoint.fecha}T00:00:00`))) === 'end' ? -4 : 0}
                textAnchor={edgeAnchor(xScale(new Date(`${minPoint.fecha}T00:00:00`)))}
                fontSize={10}
                fontWeight={600}
                fill="var(--text-muted)"
              >
                {formatValue(minPoint.valor)}
              </text>
            </g>
          )}
          </g>

          {/* Eje X - ticks reducidos en compact */}
          {xScale &&
            (xTicks ?? xScale.ticks(Math.min(6, validPoints.length))).map((d, i) => (
              <text key={i} x={xScale(d)} y={innerH + 16} textAnchor={edgeAnchor(xScale(d))} fontSize={10} fill="var(--text-muted)">
                {formatDate(d.toISOString().slice(0, 10))}
              </text>
            ))}

          {/* Guía + punto de hover */}
          {hoverValid && (
            <>
              <line
                x1={xScale!(dates[hoverIdx!])}
                x2={xScale!(dates[hoverIdx!])}
                y1={0}
                y2={innerH}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <circle cx={xScale!(dates[hoverIdx!])} cy={yScale!(hoverPoint!.valor as number)} r={4} fill={color} stroke="var(--white)" strokeWidth={1.5} />
            </>
          )}
        </g>
      </svg>

      {hoverValid && xScale && (
        <div
          style={{
            position: 'absolute',
            left: `${(margin.left + xScale(dates[hoverIdx!])) / width * 100}%`,
            top: 4,
            transform: 'translateX(-50%)',
            background: 'var(--text)',
            color: '#fff',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            zIndex: 2,
          }}
        >
          <div style={{ fontWeight: 700 }}>{formatDate(hoverPoint!.fecha)}</div>
          <div>
            {formatValue(hoverPoint!.valor as number)} {unitLabel}
            {delta !== null && (
              <span style={{ opacity: 0.75 }}> ({delta >= 0 ? '+' : ''}{formatValue(delta)})</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
