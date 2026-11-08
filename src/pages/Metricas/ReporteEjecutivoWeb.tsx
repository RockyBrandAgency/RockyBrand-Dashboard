import { ClipboardList, Clock, Globe, MapPin, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { banderaDePais } from '../../lib/banderas';
import type { WebMetrics, WebReporteEjecutivo } from '../../types';

// Reporte ejecutivo del sitio (2026-11-07, pedido de Chile Fly Fishing).
// Cuatro preguntas, una tarjeta cada una, en el orden en que se pidieron:
// desde dónde nos visitan, Estados Unidos por ciudad, dónde se cae la gente
// del formulario de reserva y cuánto dura una visita. Cada tarjeta dice la
// respuesta en el título; el detalle va debajo para quien quiera mirarlo.
//
// Criterio visual del panel (Mato, 18-oct): badge → título → detalle, espacios
// de 6/12/18/24 e íconos Lucide. Los números vienen todos de GA4 por
// `web.ejecutivo`; acá solo se calculan porcentajes y diferencias entre ellos.

const CARD: React.CSSProperties = {
  background: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-card)',
  padding: 24,
  minWidth: 0,
};

const fmt = (n: number) => n.toLocaleString('es-CL');

function pct(parte: number, total: number): string {
  if (!total) return '—';
  return `${Math.round((parte / total) * 100)} %`;
}

export function formatoDuracion(segundos: number | null | undefined): string {
  if (segundos == null) return '—';
  const s = Math.round(segundos);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  const resto = s % 60;
  return resto ? `${min} min ${resto} s` : `${min} min`;
}

// GA4 entrega los países en inglés; los más frecuentes van traducidos y el
// resto queda como viene, que se entiende igual.
const PAISES_ES: Record<string, string> = {
  'United States': 'Estados Unidos', 'United Kingdom': 'Reino Unido', Germany: 'Alemania',
  France: 'Francia', Spain: 'España', Brazil: 'Brasil', Canada: 'Canadá', Mexico: 'México',
  Netherlands: 'Países Bajos', Switzerland: 'Suiza', Italy: 'Italia', Japan: 'Japón',
  Ireland: 'Irlanda', Sweden: 'Suecia', Norway: 'Noruega', Belgium: 'Bélgica',
  Singapore: 'Singapur', Australia: 'Australia', Argentina: 'Argentina', 'New Zealand': 'Nueva Zelanda',
  '(not set)': 'Sin país',
};

function Tarjeta({ icono: Icono, badge, titulo, sub, children, estilo }: {
  icono: LucideIcon; badge: string; titulo: ReactNode; sub?: ReactNode; children: ReactNode;
  estilo?: React.CSSProperties;
}) {
  return (
    <section style={{ ...CARD, ...estilo }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Icono size={18} strokeWidth={1.75} color="var(--text-sub)" aria-hidden />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {badge}
        </span>
      </div>
      <div style={{ fontSize: 18, lineHeight: '24px', fontWeight: 700, color: 'var(--text)' }}>{titulo}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
      <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 18, paddingTop: 18 }}>{children}</div>
    </section>
  );
}

function Fila({ etiqueta, valor, extra }: { etiqueta: ReactNode; valor: ReactNode; extra?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, fontSize: 13, minWidth: 0 }}>
      {/* La etiqueta baja de línea en vez de cortarse: en 320 px una elipsis
          dejaba «Duración promedio de la vi…» y el dato no se entendía. */}
      <span style={{ color: 'var(--text)', minWidth: 0, overflowWrap: 'anywhere' }}>{etiqueta}</span>
      <span style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
        {extra && <span style={{ color: 'var(--text-muted)' }}>{extra}</span>}
        <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
      </span>
    </div>
  );
}

function Nota({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 12 }}>{children}</div>;
}

export function ReporteEjecutivoWeb({ web, isDesktop }: { web: WebMetrics; isDesktop: boolean }) {
  const ej = web.ejecutivo;
  const completo = ej && 'eeuu' in ej && !ej.nota ? ej : null;

  return (
    <div style={{ marginTop: 36 }} data-testid="reporte-ejecutivo">
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Reporte ejecutivo</h2>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          Lo esencial del sitio{web.periodo ? ` · ${web.periodo}` : ''}
        </div>
      </div>

      {!completo ? (
        <div style={{ ...CARD, border: '1px dashed var(--border)', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          {ej?.nota ?? 'El reporte ejecutivo todavía no está disponible para este sitio.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 18 }}>
          <Origen ej={completo} />
          <EstadosUnidos ej={completo} />
          <Formulario ej={completo} isDesktop={isDesktop} />
          <Duracion ej={completo} isDesktop={isDesktop} />
        </div>
      )}
    </div>
  );
}

type Ejecutivo = WebReporteEjecutivo;

function Origen({ ej }: { ej: Ejecutivo }) {
  const total = ej.origen.usuarios;
  const top = ej.origen.paises.slice(0, 5);
  const primero = top[0];
  return (
    <Tarjeta
      icono={Globe}
      badge="Desde dónde nos visitan"
      titulo={primero
        ? <>{PAISES_ES[primero.pais] ?? primero.pais}: {pct(primero.usuarios, total)} de las personas</>
        : 'Sin visitas en el período'}
      sub={total ? `${fmt(total)} personas en total` : undefined}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {top.map((p) => (
          <Fila
            key={p.pais}
            etiqueta={<>{banderaDePais(p.pais) ?? '🌐'} {PAISES_ES[p.pais] ?? p.pais}</>}
            extra={pct(p.usuarios, total)}
            valor={fmt(p.usuarios)}
          />
        ))}
      </div>
      {ej.eeuu.excluye.length > 0 && (
        <Nota>
          No cuenta {ej.eeuu.excluye.join(', ')} (servidores de AWS, no personas); por eso las
          cifras difieren de la tabla «Desde dónde entraron» de arriba.
        </Nota>
      )}
    </Tarjeta>
  );
}

function EstadosUnidos({ ej }: { ej: Ejecutivo }) {
  const { eeuu } = ej;
  return (
    <Tarjeta
      icono={MapPin}
      badge="Visitas desde EE. UU."
      titulo={`${fmt(eeuu.usuarios)} ${eeuu.usuarios === 1 ? 'persona' : 'personas'}`}
      sub={eeuu.duracion_media_s != null ? `Duración promedio de la visita: ${formatoDuracion(eeuu.duracion_media_s)}` : undefined}
    >
      {eeuu.ciudades.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin visitas desde Estados Unidos en el período</div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>
            <span>Ciudad</span><span>Duración · Personas</span>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {eeuu.ciudades.map((c) => (
              <Fila key={c.ciudad} etiqueta={c.ciudad} extra={formatoDuracion(c.duracion_media_s)} valor={fmt(c.usuarios)} />
            ))}
          </div>
        </>
      )}
      {eeuu.excluye.length > 0 && (
        <Nota>No cuenta {eeuu.excluye.join(', ')}: servidores de AWS, no personas.</Nota>
      )}
    </Tarjeta>
  );
}

function Kpi({ etiqueta, valor, extra, critico, fila }: { etiqueta: string; valor: ReactNode; extra?: ReactNode; critico?: boolean; fila?: boolean }) {
  if (fila) {
    // En el teléfono tres casillas no caben: se apilan como filas.
    return (
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
          background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', minWidth: 0,
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{etiqueta}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{valor}</span>
          {extra && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>{extra}</span>}
        </span>
      </div>
    );
  }
  return (
    <div
      style={{
        background: critico ? 'var(--status-critico-bg)' : 'var(--surface-2)',
        borderRadius: 'var(--radius-sm)',
        padding: 12,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: critico ? 'var(--status-critico-text)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>{etiqueta}</div>
      <div style={{ fontSize: 20, lineHeight: '24px', fontWeight: 700, color: critico ? 'var(--status-critico-text)' : 'var(--text)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </div>
      {extra && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{extra}</div>}
    </div>
  );
}

function fechaCorta(iso: string): string {
  // Mediodía: así la zona horaria del navegador no corre la fecha un día.
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Cuántos se quedaron en cada etapa: los que llegaron a ella y no a la
// siguiente. En «Enviaron» se descuentan las consultas, que terminan ahí y
// no pasan al pago: no son gente que se cayó.
function quedaron(etapas: WebReporteEjecutivo['formulario']['etapas'], consultas: number): number[] {
  return etapas.map((e, i) => {
    const siguiente = etapas[i + 1];
    if (!siguiente) return 0;
    const terminan = e.clave === 'booking_request' ? consultas : 0;
    return Math.max(0, e.usuarios - terminan - siguiente.usuarios);
  });
}

const GRUPO: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em',
};

function Formulario({ ej, isDesktop }: { ej: Ejecutivo; isDesktop: boolean }) {
  const { etapas, desde } = ej.formulario;
  const consultas = ej.formulario.consultas ?? 0;
  const inicio = etapas[0]?.usuarios ?? 0;
  const enviaron = etapas.find((e) => e.clave === 'booking_request');
  const pagaron = etapas.find((e) => e.clave === 'purchase');
  const idxEnviaron = etapas.findIndex((e) => e.clave === 'booking_request');

  // La etapa donde más gente se queda es la respuesta a «dónde se caen»:
  // se marca esa y no todas, para que salte a la vista.
  const seQuedan = quedaron(etapas, consultas);
  let peor = -1;
  seQuedan.forEach((n, i) => { if (n > 0 && (peor < 0 || n > seQuedan[peor])) peor = i; });

  const nombrePeor = peor >= 0
    ? (etapas[peor].clave === 'booking_start' && !ej.formulario.detalle_por_paso ? 'el primer paso' : `«${etapas[peor].etapa}»`)
    : null;

  return (
    <Tarjeta
      icono={ClipboardList}
      badge="Formulario de reserva"
      estilo={{ gridColumn: '1 / -1' }}
      titulo={!inicio
        ? 'Nadie abrió el formulario en el período'
        : nombrePeor
          ? <>Donde más se caen: <span style={{ color: 'var(--status-critico-text)' }}>{nombrePeor}</span></>
          : 'Nadie se quedó a medio camino'}
      sub={inicio
        ? (desde ? `Desde el ${fechaCorta(desde)}, cuando empezó la medición por paso` : 'Personas que llegaron a cada etapa en el período')
        : undefined}
    >
      {inicio > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: isDesktop ? 12 : 6, marginBottom: 24 }}>
          <Kpi fila={!isDesktop} etiqueta="Abrieron el formulario" valor={fmt(inicio)} />
          <Kpi fila={!isDesktop} etiqueta="Enviaron solicitud o consulta" valor={fmt(enviaron?.usuarios ?? 0)} extra={pct(enviaron?.usuarios ?? 0, inicio)} />
          <Kpi fila={!isDesktop} etiqueta="Pagaron" valor={fmt(pagaron?.usuarios ?? 0)} extra={pct(pagaron?.usuarios ?? 0, inicio)} />
        </div>
      )}

      <div style={{ display: 'grid', gap: 18 }}>
        {etapas.map((e, i) => {
          const ancho = inicio ? Math.max(e.usuarios ? 2 : 0, Math.round((e.usuarios / inicio) * 100)) : 0;
          const esPeor = i === peor;
          const n = seQuedan[i];
          const llegaron = (
            <span style={{ fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {fmt(e.usuarios)} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>{pct(e.usuarios, inicio)}</span>
            </span>
          );
          const perdida = n > 0 && (
            <span
              style={{
                fontSize: 12,
                color: esPeor ? 'var(--status-critico-text)' : 'var(--text-muted)',
                background: esPeor ? 'var(--status-critico-bg)' : 'transparent',
                padding: esPeor ? '2px 6px' : 0,
                borderRadius: 'var(--radius-sm)',
                fontWeight: esPeor ? 600 : 400,
                display: 'inline-block',
                maxWidth: '100%',
              }}
            >
              {esPeor ? 'Mayor caída · ' : ''}{fmt(n)} {n === 1 ? 'se quedó' : 'se quedaron'} aquí ({pct(n, e.usuarios)})
            </span>
          );
          return (
            <div key={e.clave}>
              {i === 0 && <div style={{ ...GRUPO, marginBottom: 12 }}>En el formulario</div>}
              {i === idxEnviaron && <div style={{ ...GRUPO, margin: '6px 0 12px' }}>Después del formulario</div>}
              <div
                data-etapa={e.clave}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isDesktop ? 'minmax(0, 280px) minmax(0, 1fr) minmax(0, 260px)' : 'minmax(0, 1fr)',
                  alignItems: 'center',
                  gap: isDesktop ? 18 : 6,
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${esPeor ? '#fecaca' : 'transparent'}`,
                  background: esPeor ? 'var(--status-critico-bg)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0, width: 24, height: 24, borderRadius: 12, display: 'grid', placeItems: 'center',
                      fontSize: 12, fontWeight: 700,
                      background: esPeor ? 'var(--status-critico-dot)' : '#C4944E', color: '#fff',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflowWrap: 'anywhere' }}>{e.etapa}</span>
                      {!isDesktop && llegaron}
                    </div>
                    {e.que_pide && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, overflowWrap: 'anywhere' }}>{e.que_pide}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div aria-hidden style={{ flex: 1, background: 'var(--border-soft)', borderRadius: 5, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${ancho}%`, height: '100%', background: esPeor ? 'var(--status-critico-dot)' : '#C4944E', borderRadius: 5 }} />
                  </div>
                  {isDesktop && <span style={{ minWidth: 72, textAlign: 'right' }}>{llegaron}</span>}
                </div>
                <div style={{ minWidth: 0, textAlign: isDesktop ? 'right' : 'left' }}>{perdida}</div>
              </div>
            </div>
          );
        })}
      </div>

      {ej.formulario.consultas != null && ej.formulario.solicitudes != null && (ej.formulario.solicitudes + consultas) > 0 && (
        <Nota>
          Enviaron: {fmt(ej.formulario.solicitudes)} {ej.formulario.solicitudes === 1 ? 'solicitud' : 'solicitudes'} de reserva
          y {fmt(consultas)} {consultas === 1 ? 'consulta' : 'consultas'} (opción «I have questions first»). Las consultas
          terminan ahí: no pasan al pago y no cuentan como caída.
        </Nota>
      )}
      {ej.formulario.nota_pasos && <Nota>{ej.formulario.nota_pasos}</Nota>}
    </Tarjeta>
  );
}

function Duracion({ ej, isDesktop }: { ej: Ejecutivo; isDesktop: boolean }) {
  const s = ej.sesion;
  return (
    <Tarjeta
      icono={Clock}
      badge="Cuánto se quedan"
      estilo={{ gridColumn: '1 / -1' }}
      titulo={s.tiempo_activo_s != null ? `${formatoDuracion(s.tiempo_activo_s)} de atención por visita` : 'Sin visitas en el período'}
      sub="Tiempo con el sitio a la vista, promedio por visita"
    >
      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: 12 }}>
        <Kpi etiqueta="Atención por visita" valor={formatoDuracion(s.tiempo_activo_s)} />
        <Kpi etiqueta="Duración promedio de la visita" valor={formatoDuracion(s.duracion_media_s)} />
        <Kpi
          etiqueta="Visitas con interacción"
          valor={s.sesiones != null ? `${fmt(s.sesiones_con_interaccion ?? 0)} de ${fmt(s.sesiones)}` : '—'}
          extra={s.sesiones ? pct(s.sesiones_con_interaccion ?? 0, s.sesiones) : undefined}
        />
      </div>
      <Nota>
        Con interacción: más de 10 s, o 2 páginas o más, o una conversión. La duración incluye
        pestañas abiertas sin mirar; la atención, no.
      </Nota>
    </Tarjeta>
  );
}
