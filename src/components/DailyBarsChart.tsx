import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { scaleLinear } from 'd3-scale';

export interface DailyBar {
  fecha: string; // ISO date
  valor: number; // cambio neto del día (puede ser negativo)
  acumulado?: number | null; // total de seguidores ese día, para el tooltip
}

interface Props {
  bars: DailyBar[];
  height?: number;
  compact?: boolean;
  unitLabel?: string;
  formatDate?: (iso: string) => string;
}

// Paleta DIVERGENTE, no categórica: el dato tiene polaridad (ganó / perdió
// seguidores) y el cero es el punto neutro real, no un extremo de la escala.
// Los dos hex salieron del validador de la guía de visualización
// (`validate_palette.js --mode light`, superficie #fcfcfb) y pasan las seis
// comprobaciones — el verde de marca `--primary` (#2d5a3d) NO pasa: cae fuera
// de la banda de luminosidad y bajo el piso de croma, o sea que como relleno
// de dato se lee gris. Se usa igual para el texto y los bordes, donde sí
// corresponde; acá manda la legibilidad del dato.
const SUBE = '#2e9e63';
const BAJA = '#c2410c';

const defaultFormatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });

const firmado = (v: number) => (v > 0 ? '+' : '') + v.toLocaleString('es-CL');

// Cuántos seguidores ganó o perdió la cuenta CADA DÍA, no el total acumulado.
// Son dos preguntas distintas y la curva de totales no contesta la segunda: en
// una cuenta que crece, la curva de totales sube siempre y todos los días se
// ven igual de buenos. Acá se ve cuál día movió la aguja y cuál no.
//
// El sentido de la barra (arriba/abajo desde el cero) repite lo que dice el
// color: es la codificación secundaria que exige la guía para no dejar la
// polaridad solo en el color.
export function DailyBarsChart({
  bars,
  height = 200,
  compact = false,
  unitLabel = '',
  formatDate = defaultFormatDate,
}: Props) {
  const barsRef = useRef<SVGGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 640;
  const margin = { top: 22, right: 12, bottom: compact ? 20 : 26, left: 36 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const { yScale, paso, anchoBarra, maxIdx, hayNegativos } = useMemo(() => {
    if (bars.length === 0) {
      return { yScale: null, paso: 0, anchoBarra: 0, maxIdx: -1, hayNegativos: false };
    }
    const valores = bars.map((b) => b.valor);
    const maxV = Math.max(0, ...valores);
    const minV = Math.min(0, ...valores);
    // El dominio SIEMPRE incluye el cero: es la línea contra la que se lee
    // cada barra. Un dominio que empieza en el mínimo exagera diferencias
    // chicas — es el error más común de un gráfico de barras.
    const pad = (maxV - minV) * 0.15 || 1;
    const y = scaleLinear().domain([minV - (minV < 0 ? pad : 0), maxV + pad]).range([innerH, 0]);
    const p = innerW / bars.length;
    return {
      yScale: y,
      paso: p,
      // 2px de aire entre barras (el "surface gap" de la guía): sin él, una
      // racha de días buenos se lee como un bloque sólido y se pierde el día.
      anchoBarra: Math.max(2, p - 2),
      maxIdx: valores.indexOf(maxV),
      hayNegativos: minV < 0,
    };
  }, [bars, innerW, innerH]);

  useEffect(() => {
    if (!barsRef.current || bars.length === 0) return;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rects = barsRef.current.querySelectorAll<SVGRectElement>('[data-barra]');
    if (reducido) {
      gsap.set(rects, { scaleY: 1, opacity: 1 });
      return;
    }
    // Crecen DESDE la línea del cero, que es de donde nace el dato. Un
    // `transform-origin` en el centro las haría brotar del aire.
    const ctx = gsap.context(() => {
      gsap.fromTo(
        rects,
        { scaleY: 0, opacity: 0.35 },
        {
          scaleY: 1,
          opacity: 1,
          duration: 0.5,
          ease: 'power2.out',
          stagger: { each: 0.014, from: 'start' },
        },
      );
    }, barsRef);
    return () => ctx.revert();
  }, [bars]);

  if (bars.length === 0 || !yScale) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
        Sin datos diarios en el rango.
      </div>
    );
  }

  const y0 = yScale(0);
  const hover = hoverIdx !== null ? bars[hoverIdx] : null;
  const ticks = yScale.ticks(4);

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`Cambio diario de ${unitLabel || 'la métrica'}, ${bars.length} días`}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grilla recesiva: guía la lectura, no compite con el dato. */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={yScale(t)} y2={yScale(t)} stroke="var(--border-soft)" strokeWidth={1} />
              <text x={-8} y={yScale(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--text-faint)">
                {t}
              </text>
            </g>
          ))}

          <g ref={barsRef}>
            {bars.map((b, i) => {
              const sube = b.valor >= 0;
              const alto = Math.abs(yScale(b.valor) - y0);
              const x = i * paso + (paso - anchoBarra) / 2;
              return (
                <rect
                  key={b.fecha}
                  data-barra
                  x={x}
                  y={sube ? y0 - alto : y0}
                  width={anchoBarra}
                  height={Math.max(alto, b.valor === 0 ? 1 : 1)}
                  rx={Math.min(4, anchoBarra / 2)}
                  fill={b.valor === 0 ? 'var(--border-strong)' : sube ? SUBE : BAJA}
                  opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.45}
                  style={{ transformOrigin: `${x + anchoBarra / 2}px ${y0}px` }}
                />
              );
            })}
          </g>

          {/* La línea del cero va ENCIMA de las barras y más marcada que la
              grilla: es el umbral que separa ganar de perder. */}
          <line
            x1={0}
            x2={innerW}
            y1={y0}
            y2={y0}
            stroke={hayNegativos ? 'var(--text-muted)' : 'var(--border-strong)'}
            strokeWidth={hayNegativos ? 1.5 : 1}
          />

          {/* Etiqueta directa SOLO en el mejor día. Un número sobre cada
              barra es ruido; uno sobre el máximo es la respuesta a "¿cuál
              fue el mejor día?" sin pasar por el tooltip. */}
          {maxIdx >= 0 && bars[maxIdx].valor > 0 && (
            <text
              x={maxIdx * paso + paso / 2}
              y={yScale(bars[maxIdx].valor) - 7}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="var(--text)"
            >
              {firmado(bars[maxIdx].valor)}
            </text>
          )}

          {/* Fechas cada ~7 barras, no una por barra (se solaparían) ni solo
              los extremos (entonces el gráfico se ve pero no se puede ubicar
              un peak en el calendario, que es justo para lo que sirve: "el
              salto fue el 16-ago, el día que salió el reel"). */}
          {bars.map((b, i) => {
            const cada = Math.max(1, Math.ceil(bars.length / (compact ? 3 : 5)));
            const ultimo = i === bars.length - 1;
            if (!ultimo && (i % cada !== 0 || i > bars.length - 1 - Math.floor(cada / 2))) return null;
            return (
              <text
                key={`tick-${b.fecha}`}
                x={i * paso + paso / 2}
                y={innerH + 16}
                textAnchor={ultimo ? 'end' : i === 0 ? 'start' : 'middle'}
                fontSize={10}
                fill="var(--text-faint)"
              >
                {formatDate(b.fecha)}
              </text>
            );
          })}

          {/* Zonas de hover más anchas que la barra: con barras de 4px, un
              hit target del ancho de la barra es imposible de acertar. */}
          {bars.map((b, i) => (
            <rect
              key={`hit-${b.fecha}`}
              x={i * paso}
              y={0}
              width={paso}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          ))}
        </g>
      </svg>

      {hover && (
        <div
          style={{
            position: 'absolute',
            left: `${((margin.left + (hoverIdx as number) * paso + paso / 2) / width) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -105%)',
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-tooltip)',
            padding: '7px 10px',
            fontSize: 11,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          <div style={{ color: 'var(--text-muted)' }}>{formatDate(hover.fecha)}</div>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
            {firmado(hover.valor)} {unitLabel}
          </div>
          {hover.acumulado != null && (
            <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
              total ese día: {hover.acumulado.toLocaleString('es-CL')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
