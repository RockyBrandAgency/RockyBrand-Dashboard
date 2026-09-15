import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { Card } from './Card';
import { useBreakpoint } from '../hooks/useBreakpoint';
import type { FranjaHoraria, HorarioPorFormato, MejoresHorarios } from '../types';

// UN solo color de dato. Las barras son una sola serie (alcance mediano por
// franja): pintar la franja ganadora de otro color sería colorear por RANGO,
// no por entidad, y eso repinta el gráfico entero en cuanto cambia un dato.
// La recomendación se señala con etiqueta directa y marcador, no con color.
// #2e9e63 pasa las cinco comprobaciones del validador de la guía de
// visualización sobre superficie #ffffff (banda de luminosidad, piso de
// croma, contraste >= 3:1). El verde de marca --primary (#2d5a3d) NO pasa:
// como relleno de dato se lee gris, y por eso acá no se usa.
const DATO = '#2e9e63';

// Las franjas con muestra insuficiente se distinguen por TEXTURA, no por
// color: una trama funciona en daltonismo, en impresión y en modo de
// contraste forzado, donde un verde más claro no se distingue de otro.
const PATRON_ID = 'trama-franja-insuficiente';

const CONFIANZA_ETIQUETA: Record<string, string> = {
  alta: 'Señal clara',
  media: 'Señal moderada',
  baja: 'Señal débil',
};

const numero = (v: number) => v.toLocaleString('es-CL');

const fechaCorta = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });

function Nota({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>{children}</p>;
}

// --- Gráfico -----------------------------------------------------------------

function GraficoFranjas({
  franjas,
  franjaRecomendada,
  minimoPorFranja,
  compacto,
}: {
  franjas: FranjaHoraria[];
  franjaRecomendada: string;
  minimoPorFranja: number;
  compacto: boolean;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // El viewBox se angosta en móvil en vez de dejar que el SVG de 640 se
  // encoja: escalar un viewBox ancho a 380px de pantalla achica TAMBIÉN las
  // etiquetas, y el `n=7` (que es el dato que sostiene la recomendación)
  // terminaba en ~6px reales, ilegible. Con el viewBox angosto las fuentes
  // se dibujan al tamaño que dicen.
  const width = compacto ? 360 : 640;
  const height = compacto ? 250 : 240;
  const margin = compacto
    ? { top: 26, right: 4, bottom: 48, left: 30 }
    : { top: 30, right: 12, bottom: 44, left: 44 };
  const fuenteEje = compacto ? 9 : 10;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const { yScale, paso, anchoBarra } = useMemo(() => {
    const valores = franjas.map((f) => f.alcance_mediano ?? 0);
    const max = Math.max(1, ...valores);
    // El dominio arranca en CERO siempre: en un gráfico de barras el largo de
    // la barra ES el dato, y un eje truncado convierte una diferencia del 10%
    // en una barra el triple de alta.
    const y = scaleLinear().domain([0, max * 1.15]).range([innerH, 0]);
    const p = innerW / franjas.length;
    // 2px de aire entre barras: sin el espaciador, franjas vecinas parecidas
    // se leen como un bloque sólido.
    return { yScale: y, paso: p, anchoBarra: Math.max(2, p - (compacto ? 6 : 10)) };
  }, [franjas, innerW, innerH, compacto]);

  const ticks = yScale.ticks(4);
  const hover = hoverIdx !== null ? franjas[hoverIdx] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={`Alcance mediano por franja horaria. La franja de ${franjaRecomendada} es la de mayor alcance.`}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <pattern id={PATRON_ID} width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width={6} height={6} fill="var(--white)" />
            <line x1={0} y1={0} x2={0} y2={6} stroke={DATO} strokeWidth={2.5} opacity={0.55} />
          </pattern>
        </defs>

        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grilla recesiva: orienta la lectura, no compite con el dato. */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={yScale(t)} y2={yScale(t)} stroke="var(--border-soft)" strokeWidth={1} />
              <text x={-8} y={yScale(t)} dy="0.32em" textAnchor="end" fontSize={fuenteEje} fill="var(--text-faint)">
                {t >= 1000 ? `${t / 1000}k` : t}
              </text>
            </g>
          ))}

          {franjas.map((f, i) => {
            const x = i * paso + (paso - anchoBarra) / 2;

            // Sin publicaciones a esa hora: ni barra ni cero. Una barra de
            // altura cero afirmaría "publicaste y no te vio nadie"; el hueco
            // dice lo que de verdad pasa, que es que nunca se probó.
            if (f.alcance_mediano === null) {
              return (
                <line
                  key={f.franja}
                  x1={x}
                  x2={x + anchoBarra}
                  y1={innerH}
                  y2={innerH}
                  stroke="var(--border-strong)"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
              );
            }

            const alto = innerH - yScale(f.alcance_mediano);
            return (
              <rect
                key={f.franja}
                x={x}
                y={yScale(f.alcance_mediano)}
                width={anchoBarra}
                height={Math.max(alto, 1)}
                rx={4}
                fill={f.suficiente ? DATO : `url(#${PATRON_ID})`}
                stroke={f.suficiente ? 'none' : DATO}
                strokeWidth={f.suficiente ? 0 : 1}
                strokeOpacity={0.55}
                opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.45}
              />
            );
          })}

          {/* Etiqueta directa SOLO sobre la franja recomendada. Un número
              sobre cada barra es ruido; uno sobre la que importa es la
              respuesta sin pasar por el tooltip. */}
          {franjas.map((f, i) => {
            if (f.franja !== franjaRecomendada || f.alcance_mediano === null) return null;
            return (
              <text
                key="etiqueta"
                x={i * paso + paso / 2}
                y={yScale(f.alcance_mediano) - 9}
                textAnchor="middle"
                fontSize={compacto ? 11 : 12}
                fontWeight={700}
                fill="var(--text)"
              >
                {numero(f.alcance_mediano)}
              </text>
            );
          })}

          {/* Eje de horas + tamaño de muestra bajo cada franja. El `n` va a la
              vista, no al tooltip: es lo que separa "te rinde mejor" de "ahí
              publicaste una vez y te fue bien". */}
          {franjas.map((f, i) => (
            <g key={`eje-${f.franja}`}>
              <text
                x={i * paso + paso / 2}
                y={innerH + 16}
                textAnchor="middle"
                fontSize={fuenteEje + 1}
                fontWeight={f.franja === franjaRecomendada ? 700 : 400}
                fill={f.franja === franjaRecomendada ? 'var(--text)' : 'var(--text-faint)'}
              >
                {f.franja.slice(0, 5)}
              </text>
              <text x={i * paso + paso / 2} y={innerH + 31} textAnchor="middle" fontSize={fuenteEje} fill="var(--text-faint)">
                {f.publicaciones === 0 ? '—' : `n=${f.publicaciones}`}
              </text>
            </g>
          ))}

          {/* Zonas de hover del ancho completo de la franja: el hit target
              nunca es del porte de la barra. */}
          {franjas.map((f, i) => (
            <rect
              key={`hit-${f.franja}`}
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
            transform: 'translate(-50%, -100%)',
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-tooltip)',
            padding: '8px 10px',
            fontSize: 11,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{hover.franja}</div>
          {hover.alcance_mediano === null ? (
            <div style={{ color: 'var(--text-muted)', marginTop: 3 }}>Nunca has publicado a esta hora.</div>
          ) : (
            <>
              <div style={{ color: 'var(--text-sub)', marginTop: 3 }}>
                {numero(hover.alcance_mediano)} personas en la publicación típica
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                {hover.publicaciones} {hover.publicaciones === 1 ? 'publicación' : 'publicaciones'}
                {hover.engagement_mediano_pct != null ? ` · ${hover.engagement_mediano_pct}% de interacción` : ''}
              </div>
              {!hover.suficiente && (
                <div style={{ color: 'var(--text-muted)', marginTop: 4, maxWidth: 220, whiteSpace: 'normal' }}>
                  Muestra chica (menos de {minimoPorFranja}): se muestra, pero no se recomienda.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Alternativa en texto del gráfico. No es decorativa: es la vía de
          lectura para quien usa lector de pantalla. */}
      <table style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        <caption>Alcance mediano por franja horaria</caption>
        <thead>
          <tr>
            <th scope="col">Franja</th>
            <th scope="col">Publicaciones</th>
            <th scope="col">Alcance mediano</th>
          </tr>
        </thead>
        <tbody>
          {franjas.map((f) => (
            <tr key={f.franja}>
              <th scope="row">{f.franja}</th>
              <td>{f.publicaciones}</td>
              <td>{f.alcance_mediano === null ? 'sin publicaciones' : numero(f.alcance_mediano)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Bloques de apoyo --------------------------------------------------------

function Leyenda({ minimoPorFranja }: { minimoPorFranja: number }) {
  const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
      <span style={item}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: DATO, flexShrink: 0 }} />
        Muestra suficiente ({minimoPorFranja} publicaciones o más)
      </span>
      <span style={item}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            border: `1px solid ${DATO}`,
            backgroundImage: `repeating-linear-gradient(45deg, ${DATO} 0 2px, transparent 2px 5px)`,
            flexShrink: 0,
          }}
        />
        Muestra chica: referencial
      </span>
      <span style={item}>
        <span style={{ width: 12, borderTop: '2px dashed var(--border-strong)', flexShrink: 0 }} />
        Nunca publicaste a esa hora
      </span>
    </div>
  );
}

function PorFormato({ formato }: { formato: HorarioPorFormato }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: 'var(--space-5)',
        background: 'var(--surface-2)',
      }}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
        {formato.etiqueta}
      </div>
      {formato.hay_recomendacion && formato.mejor ? (
        <>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{formato.mejor.franja}</div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4, lineHeight: 1.5 }}>
            {numero(formato.mejor.alcance_mediano)} personas en la publicación típica · {formato.mejor.publicaciones} de{' '}
            {formato.publicaciones} {formato.etiqueta}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{formato.mensaje}</div>
      )}
    </div>
  );
}

// --- Tarjeta -----------------------------------------------------------------

/**
 * Cuándo publicar, según las publicaciones de ESTE cliente.
 *
 * Tres decisiones de esta vista, las tres por el mismo motivo (que el cliente
 * pueda discutir el número en vez de creérselo):
 *
 *   1. El tamaño de muestra va SIEMPRE visible, bajo cada barra, no escondido
 *      en el tooltip. "Publica a las 09:00" con n=7 y con n=1 se ven idénticos
 *      sin ese dato, y solo uno de los dos vale algo.
 *   2. Las franjas con muestra chica se dibujan igual, con trama. Ocultarlas
 *      daría un gráfico más limpio y una lectura falsa del día.
 *   3. La advertencia de correlación no está en un tooltip ni en letra gris de
 *      6px: es parte del texto. Que una franja rinda mejor no prueba que la
 *      hora sea la causa — puede ser que a esa hora salga el mejor contenido.
 *
 * Todo el texto conclusivo lo redacta el backend (social_timing.py) con los
 * números reales delante; esta vista no infiere ni rellena nada.
 */
export function MejoresHorariosCard({ horarios }: { horarios?: MejoresHorarios }) {
  const compacto = useBreakpoint() === 'mobile';

  // `horarios` es opcional aunque el backend actual SIEMPRE lo mande: el
  // frontend y la Lambda se despliegan por separado, así que existe una
  // ventana real en la que el panel nuevo habla con el backend viejo (y
  // también una respuesta cacheada sin el campo). Sin esta guarda, leer
  // `.hay_recomendacion` de undefined tumba la página ENTERA de Instagram
  // por una sección. Se omite la tarjeta y el resto de las métricas sigue
  // en pie; en cuanto la Lambda responde con el campo, aparece sola.
  if (!horarios) return null;

  if (!horarios.hay_recomendacion) {
    return (
      <Card style={{ marginBottom: 28 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Cuándo publicar</h3>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-sub)' }}>{horarios.mensaje}</p>
        <div style={{ marginTop: 12 }}>
          <Nota>
            Se mide con tus propias publicaciones, nunca con promedios de la industria. Cada corrida guarda las
            publicaciones nuevas, así que la muestra crece sola.
          </Nota>
        </div>
      </Card>
    );
  }

  const { mejor, evitar, franjas, por_formato, ventana, confianza } = horarios;

  return (
    <Card style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Cuándo publicar</h3>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 9px',
            borderRadius: 999,
            background: 'var(--status-info-bg)',
            color: 'var(--status-info-text)',
          }}
        >
          {CONFIANZA_ETIQUETA[confianza] ?? confianza} · {horarios.publicaciones_analizadas} publicaciones
        </span>
      </div>

      {/* La franja, grande. Es la respuesta; todo lo demás la sustenta. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '14px 0 6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 34, fontWeight: 700, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {mejor.franja}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>hora de Chile</span>
      </div>

      {/* La evidencia, no el mensaje completo: el titular ('Publica entre
          las 09:00 y las 12:00') ya está arriba en 34px y repetirlo acá deja
          la misma frase dos veces en la misma tarjeta. */}
      <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.6, color: 'var(--text-sub)', maxWidth: 680 }}>
        {horarios.evidencia}
      </p>

      <GraficoFranjas
        franjas={franjas}
        franjaRecomendada={mejor.franja}
        minimoPorFranja={horarios.minimo_por_franja}
        compacto={compacto}
      />
      <Leyenda minimoPorFranja={horarios.minimo_por_franja} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginTop: 20,
        }}
      >
        {Object.entries(por_formato).map(([clave, formato]) => (
          <PorFormato key={clave} formato={formato} />
        ))}
      </div>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-soft)', display: 'grid', gap: 6 }}>
        <Nota>
          {horarios.metrica}, sobre {horarios.publicaciones_analizadas} publicaciones entre el {fechaCorta(ventana.desde)} y
          el {fechaCorta(ventana.hasta)}. Se dejan fuera las {horarios.publicaciones_muy_recientes} publicaciones con menos
          de {horarios.dias_madurez} días medidos: todavía están sumando alcance y bajarían su franja sin que la hora tenga
          nada que ver. Esta lectura usa todo el historial disponible, no el rango que elijas arriba.
        </Nota>
        {evitar && evitar.diferencia_pct != null && (
          <Nota>
            La franja de {evitar.franja} rinde {Math.abs(Math.round(evitar.diferencia_pct))}% menos que el resto del día
            ({evitar.publicaciones} publicaciones).
          </Nota>
        )}
        <Nota>{horarios.advertencia}</Nota>
        <Nota>
          Las historias no entran en este cálculo: Meta no entrega su rendimiento por esta vía, así que no se opina de
          ellas.
        </Nota>
      </div>
    </Card>
  );
}
