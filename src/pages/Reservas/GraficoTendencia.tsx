// «¿En qué fechas vendemos más?» (pedido de Mato, 18-oct). Líneas por día
// (30 días) o por semana ISO (90 días y Temporada), con pescadores por fecha
// de confirmación en hora de Chile. Desde el 19-oct son líneas, a pedido de
// Mato («el último gráfico lo quiero de líneas»); antes eran columnas.
//
// - Total: la línea más marcada, porque responde la pregunta del gráfico. Solo
//   se dibuja si hay más de una serie: con una sola, sería la misma línea.
// - Cada serie lleva su color, un trazo y un marcador propios, más la leyenda:
//   no depende solo del color (WCAG 2.2, 1.4.1).
// - El ancho del lienzo se mide antes de pintar (useAnchoContenido) y el alto
//   es fijo, así que no salta al montar (CLS 0).
import { useAnchoContenido } from '../../hooks/useAnchoContenido';
import { Icono } from '../../lib/iconos';
import { etiquetaTramo, fraseTendencia, textoTramo, type Tendencia, type Tramo } from '../../lib/tendenciaVentas';

/** Alto del área de líneas y franja de 24 bajo ella para las fechas. */
const ALTO = 144;
const EJE_X = 24;
/** Margen izquierdo con el eje Y (0 y el máximo), derecho para el punto destacado, y el de arriba y abajo. */
const IZQ = 30;
const DER = 12;
const ARRIBA = 12;
const BASE = ALTO - 6;
/** Marcadores: la primera línea (el total, o la única serie) lleva uno en cada
 *  tramo si quedan a 12 px o más; si no, y en las demás series, solo los tramos
 *  con ventas. Con 44 semanas en 250 px, o cuatro series en 0, los marcadores
 *  en cero tapaban la línea y no decían nada. */
const PASO_MARCADORES = 12;
/** Ancho de un carácter de 12 px (estimado por lo alto) y aire entre fechas. */
const PX_CARACTER = 7;
const AIRE_FECHAS = 12;

type Clave = 'total' | 'ai' | 'fd' | 'otros';
type Forma = 'circulo' | 'cuadrado' | 'rombo' | 'triangulo';
interface Serie {
  clave: Clave;
  nombre: string;
  color: string;
  ancho: number;
  /** stroke-dasharray; undefined = continuo. */
  trazo?: string;
  forma: Forma;
}

const TOTAL: Serie = { clave: 'total', nombre: 'Total', color: 'var(--text)', ancho: 3, forma: 'circulo' };
const SERIES: readonly Serie[] = [
  { clave: 'ai', nombre: 'All Inclusive', color: 'var(--programa-ai-borde)', ancho: 2, trazo: '8 4', forma: 'cuadrado' },
  { clave: 'fd', nombre: 'Full Day', color: 'var(--programa-fd-borde)', ancho: 2, trazo: '3 3', forma: 'rombo' },
  { clave: 'otros', nombre: 'Otros', color: 'var(--mercado-sin)', ancho: 2, trazo: '0.1 4', forma: 'triangulo' },
];

function Marcador({ forma, x, y, color }: { forma: Forma; x: number; y: number; color: string }) {
  const borde = { stroke: 'var(--tarjeta-fondo)', strokeWidth: 1.5, fill: color } as const;
  if (forma === 'cuadrado') return <rect x={x - 3.5} y={y - 3.5} width={7} height={7} {...borde} />;
  if (forma === 'rombo') return <path d={`M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z`} {...borde} />;
  if (forma === 'triangulo') return <path d={`M${x} ${y - 5}L${x + 5} ${y + 4}L${x - 5} ${y + 4}Z`} {...borde} />;
  return <circle cx={x} cy={y} r={4} {...borde} />;
}

/** Fechas del eje X sin encimarse: cada `paso` tramos, con el paso más corto
 *  que deja 12 px libres entre una y otra. La primera y la última van siempre;
 *  si la última queda muy cerca de la anterior, sale la anterior. */
function fechasEje(tramos: readonly Tramo[], xs: readonly number[], conAno: boolean) {
  const n = tramos.length;
  const items = tramos.map((t, i) => {
    const texto = etiquetaTramo({ desde: t.desde, hasta: t.desde }, conAno);
    const w = texto.length * PX_CARACTER;
    const ancla: 'start' | 'end' | 'middle' = n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle';
    const ini = ancla === 'start' ? xs[i] : ancla === 'end' ? xs[i] - w : xs[i] - w / 2;
    return { i, texto, ancla, ini, fin: ini + w };
  });
  if (n <= 1) return items;
  const caben = (sel: typeof items) => sel.every((it, k) => k === 0 || it.ini >= sel[k - 1].fin + AIRE_FECHAS);
  for (let paso = 1; paso < n; paso++) {
    const sel = items.filter((it) => it.i % paso === 0 && it.i < n - 1);
    if (n - 1 - sel[sel.length - 1].i < paso && sel.length > 1 && items[n - 1].ini < sel[sel.length - 1].fin + AIRE_FECHAS) sel.pop();
    sel.push(items[n - 1]);
    if (caben(sel)) return sel;
  }
  return caben([items[0], items[n - 1]]) ? [items[0], items[n - 1]] : [items[0]];
}

export function GraficoTendencia({ tendencia: t }: { tendencia: Tendencia }) {
  const [refLienzo, medido] = useAnchoContenido<HTMLDivElement>();
  const n = t.tramos.length;
  const max = t.maximo?.total ?? 0;
  const presentes = SERIES.filter((s) => t.tramos.some((x) => x[s.clave] > 0));
  const lineas = presentes.length > 1 ? [TOTAL, ...presentes] : presentes;
  const escala = t.escala === 'dia' ? 'día' : 'semana';
  const conVentas = t.tramos.filter((x) => x.total > 0);
  const W = medido ?? 0;
  const listo = W > IZQ + DER && max > 0;
  const util = BASE - ARRIBA;
  const xs = t.tramos.map((_, i) => (n === 1 ? (IZQ + W - DER) / 2 : IZQ + (i * (W - IZQ - DER)) / (n - 1)));
  const y = (v: number) => BASE - (v / max) * util;
  const paso = n > 1 ? (W - IZQ - DER) / (n - 1) : Infinity;
  const todos = paso >= PASO_MARCADORES;
  const iMax = t.maximo ? t.tramos.indexOf(t.maximo) : -1;
  // El punto destacado va sobre el total o, con una sola serie, sobre ella.
  const conMax = lineas[0];
  return (
    <figure className="grafico tarjeta" data-grafico="tendencia" data-escala={t.escala}>
      <figcaption>
        <h3 className="grafico__titulo parte-titulo" data-parte="titulo">
          <Icono concepto="grafico-tendencia" />
          Pescadores por fecha de venta
        </h3>
        <span className="grafico__bajada">Por {escala}, según el día en que se confirmó la reserva (hora de Chile).</span>
      </figcaption>
      {max > 0 && (
        <>
          <ul className="tendencia__leyenda" aria-hidden="true">
            {lineas.map((s) => (
              <li key={s.clave} data-leyenda={s.clave}>
                <svg width="30" height="12" className="tendencia__muestra" focusable="false">
                  <line x1="0" x2="30" y1="6" y2="6" stroke={s.color} strokeWidth={s.ancho} strokeDasharray={s.trazo} strokeLinecap={s.clave === 'otros' ? 'round' : 'butt'} />
                  <Marcador forma={s.forma} x={15} y={6} color={s.color} />
                </svg>
                {s.nombre}
              </li>
            ))}
          </ul>
          <div ref={refLienzo} className="tendencia__lienzo" data-parte="detalle">
            <svg width="100%" height={ALTO + EJE_X} aria-hidden="true" focusable="false" className="tendencia__svg">
              {listo && (
                <>
                  <line x1={IZQ} x2={W - DER} y1={ARRIBA} y2={ARRIBA} className="tendencia__guia" />
                  <line x1={IZQ} x2={W - DER} y1={BASE + 0.5} y2={BASE + 0.5} className="tendencia__base" />
                  <text x={IZQ - 6} y={ARRIBA} className="tendencia__eje-y" textAnchor="end" dominantBaseline="central" data-eje-y="max">
                    {max.toLocaleString('es-CL')}
                  </text>
                  <text x={IZQ - 6} y={BASE} className="tendencia__eje-y" textAnchor="end" dominantBaseline="central" data-eje-y="0">
                    0
                  </text>
                  {fechasEje(t.tramos, xs, t.conAno).map((f) => (
                    <text key={f.i} x={xs[f.i]} y={ALTO + 6} className="tendencia__eje-x" textAnchor={f.ancla} dominantBaseline="hanging" data-eje-x={t.tramos[f.i].desde}>
                      {f.texto}
                    </text>
                  ))}
                </>
              )}
              {/* Siempre presente, aunque falte el ancho: la animación lo toma en el primer cuadro. */}
              <g data-anim-trazo="">
                {listo &&
                  lineas.map((s) => (
                    <path
                      key={s.clave}
                      data-serie={s.clave}
                      d={t.tramos.map((x, i) => `${i === 0 ? 'M' : 'L'}${xs[i]} ${y(x[s.clave])}`).join('')}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={s.ancho}
                      strokeDasharray={s.trazo}
                      strokeLinecap={s.clave === 'otros' ? 'round' : 'butt'}
                      strokeLinejoin="round"
                    />
                  ))}
                {listo &&
                  lineas.map((s) => (
                    <g key={s.clave} data-marcadores={s.clave}>
                      {t.tramos.map((x, i) => ((todos && s === lineas[0]) || x[s.clave] > 0 ? <Marcador key={x.desde} forma={s.forma} x={xs[i]} y={y(x[s.clave])} color={s.color} /> : null))}
                    </g>
                  ))}
                {listo && iMax >= 0 && (
                  <g data-maximo="" data-tramo={t.tramos[iMax].desde} data-total={max}>
                    <circle cx={xs[iMax]} cy={y(t.tramos[iMax][conMax.clave])} r={7} fill="none" stroke="var(--text)" strokeWidth={2} />
                  </g>
                )}
              </g>
            </svg>
          </div>
          <ul className="solo-lector">
            {conVentas.map((x) => (
              <li key={x.desde}>{textoTramo(x, t.conAno)}</li>
            ))}
          </ul>
        </>
      )}
      <p className="grafico__detalle" data-parte="detalle" data-detalle-grafico="tendencia">
        {fraseTendencia(t)}
      </p>
      {t.sinFecha > 0 && (
        <p className="tendencia__nota">
          {t.sinFecha === 1 ? '1 reserva sin fecha de confirmación no entra en este gráfico.' : `${t.sinFecha.toLocaleString('es-CL')} reservas sin fecha de confirmación no entran en este gráfico.`}
        </p>
      )}
    </figure>
  );
}
