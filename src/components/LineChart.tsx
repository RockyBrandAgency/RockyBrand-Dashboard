import { useMemo, useRef, useState, type MouseEvent } from 'react';

interface TrendPoint {
  fecha: string;
  valor: number | null;
}

// Gráfico de línea SVG real (sin librería - mismo criterio que ya usa
// 05-panel-web/TrendChart.tsx, versión simplificada sin GSAP para no
// sumar una dependencia nueva a este app). Los nulls se saltan al armar
// la línea (se conecta el punto real anterior con el siguiente), pero
// SÍ cuentan para la posición en el eje X - un hueco se ve como tramo
// más inclinado, nunca como un corte.
export function LineChart({
  points,
  color,
  height = 120,
  formatValue = (v: number) => v.toLocaleString('es-CL'),
  formatDate,
}: {
  points: TrendPoint[];
  color: string;
  height?: number;
  formatValue?: (v: number) => string;
  formatDate?: (fecha: string) => string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
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
      const y = H - ((p.valor - minV) / span) * (H - PAD_Y * 2) - PAD_Y;
      return [x, y] as [number, number];
    });
    return { coords: c, min: minV, max: maxV };
  }, [points, H]);

  const realCoords = coords.filter((c): c is [number, number] => c !== null);

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

  const areaPoints =
    realCoords.length > 1
      ? `${realCoords[0][0]},${H} ${realCoords.map(([x, y]) => `${x},${y}`).join(' ')} ${realCoords[realCoords.length - 1][0]},${H}`
      : '';

  const lastReal = realCoords[realCoords.length - 1];
  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;
  const hoverCoord = hoverIdx !== null ? coords[hoverIdx] : null;
  const gradientId = `lc-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', width: 44, flexShrink: 0, textAlign: 'right' }}>
          <span>{formatValue(max)}</span>
          <span>{formatValue(min)}</span>
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
            {realCoords.length > 1 && (
              <>
                {areaPoints && <polygon points={areaPoints} fill={`url(#${gradientId})`} stroke="none" />}
                <polyline
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
            {hoverCoord && (
              <line x1={hoverCoord[0]} x2={hoverCoord[0]} y1={0} y2={H} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          <div style={{ position: 'absolute', left: `${(lastReal[0] / W) * 100}%`, top: `${(lastReal[1] / H) * 100}%`, width: 7, height: 7, borderRadius: '50%', background: color, transform: 'translate(-50%,-50%)', border: '2px solid var(--white)' }} />
          {hoverCoord && (
            <div style={{ position: 'absolute', left: `${(hoverCoord[0] / W) * 100}%`, top: `${(hoverCoord[1] / H) * 100}%`, width: 7, height: 7, borderRadius: '50%', background: color, transform: 'translate(-50%,-50%)', border: '2px solid var(--white)' }} />
          )}
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
