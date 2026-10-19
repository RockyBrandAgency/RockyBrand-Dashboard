import { useId, useLayoutEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { BadgePrograma, RanuraBandera } from '../../components/BadgePrograma';
import { banderaDeMercado } from '../../lib/banderas';
import { Icono, type Concepto } from '../../lib/iconos';
import { fechaCorta, fmtMonto, fmtPorcentaje, MERCADO_LABEL, PROGRAMA_LABEL } from '../../lib/fichaPescador';
import {
  bajoLista,
  cajaMasVendida,
  cajasVisibles,
  claveCaja,
  estadoCaja,
  ETIQUETA_PERIODO,
  fraseVentana,
  margenListaDe,
  ordenarMontos,
  PERIODOS,
  pescadoresTexto,
  reservasConPlata,
  reservasTexto,
  textoEstadoPeriodo,
  textoSinFecha,
  totalesVentana,
} from '../../lib/ventanasVentas';
import { Chip } from './ChipVenta';
import { arco, GraficoBarras, GraficoDona } from './GraficosVentas';
import { GraficoTendencia } from './GraficoTendencia';
import { tendenciaDe } from '../../lib/tendenciaVentas';
import type { VentasCaja, VentasCajaMonto, VentasMes, VentasPeriodo, VentasResponse, VentasTarifa, VentasVentanas } from '../../types';

// Resumen de Ventas por período (spec-ventas-cajas.md, 18-oct): filtro 30 /
// 90 días / temporada, frase, cajas por programa y mercado y gráficos. Las
// tres ventanas llegan en la misma respuesta: cambiar de período no pide nada.

const n = (x: number) => x.toLocaleString('es-CL');

/** Cifra que GSAP anima sin mover el layout (§9.4): el molde invisible fija
 *  el ancho con el valor final, la vista (aria-hidden) se escribe encima y
 *  el lector de pantalla lee el valor final. React no escribe la vista: la
 *  llena el efecto de ResumenPorPeriodo, siempre primero con el valor final. */
function Cifra({ clave, valor, texto, formato, className }: { clave: string; valor: number; texto: string; formato: string; className?: string }) {
  return (
    <span className={`cifra-anim${className ? ` ${className}` : ''}`} data-anim-clave={clave} data-anim-valor={valor} data-anim-formato={formato} data-valor-final={texto}>
      <span className="cifra-anim__molde" aria-hidden="true">
        {texto}
      </span>
      <span className="cifra-anim__vista" aria-hidden="true" data-anim-vista="" />
      <span className="solo-lector">{texto}</span>
    </span>
  );
}

/** El texto de una cifra a medio camino, con el mismo formato que la final
 *  (nunca más larga: un monto entero no muestra centavos al animar). */
export function formatoCifra(formato: string, x: number, final: number): string {
  if (formato === 'pct') return fmtPorcentaje(Math.round(x * 10) / 10);
  if (formato.startsWith('monto:')) {
    const conCentavos = Math.round(Math.abs(final) * 100) % 100 !== 0;
    return fmtMonto(formato.slice(6), conCentavos ? Math.round(x * 100) / 100 : Math.round(x));
  }
  return n(Math.round(x));
}

function vistaDe(el: HTMLElement): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-anim-vista]');
}

/** Pinta un sector de la dona con su radio actual (el activo es más grande). */
function pintarArco(c: SVGCircleElement, inicio: number, largo: number, sep: number) {
  const r = Number(c.getAttribute('r'));
  const g = arco(r, inicio, largo, sep);
  c.setAttribute('stroke-dasharray', g.dash);
  c.setAttribute('stroke-dashoffset', g.offset);
}

interface Previos {
  nums: Map<string, number>;
  anchos: Map<string, number>;
  arcos: Map<string, [number, number]>;
  cajas: Set<string>;
}

/** Entrada y cambio de período con GSAP (§9). gsap.matchMedia crea su propio
 *  contexto: revert() en el desmontaje o antes de la próxima corrida limpia
 *  todo. Con reduced motion no hay ninguna animación: los valores finales se
 *  ponen antes de cualquier cosa, también si matchMedia no responde. */
function useAnimacion(raiz: React.RefObject<HTMLDivElement | null>, clave: string) {
  const previos = useRef<Previos | null>(null);
  const entradaHecha = useRef(false);
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const nums = [...el.querySelectorAll<HTMLElement>('[data-anim-clave]')];
    const barras = [...el.querySelectorAll<HTMLElement>('[data-anim-ancho]')];
    const arcos = [...el.querySelectorAll<SVGCircleElement>('[data-arco]')];
    const cajas = [...el.querySelectorAll<HTMLElement>('[data-caja]')];
    const trazos = [...el.querySelectorAll<SVGGElement>('[data-anim-trazo]')];
    const svg = el.querySelector('[data-dona-sep]');
    const sep = Number(svg?.getAttribute('data-dona-sep') ?? 0);
    const ahora: Previos = { nums: new Map(), anchos: new Map(), arcos: new Map(), cajas: new Set(cajas.map((c) => c.dataset.caja!)) };
    // 1. Valores finales, siempre (reduced motion, jsdom o una corrida cortada a medias).
    for (const c of nums) {
      const v = vistaDe(c);
      if (v) v.textContent = c.dataset.valorFinal ?? '';
      ahora.nums.set(c.dataset.animClave!, Number(c.dataset.animValor));
    }
    barras.forEach((b, i) => {
      const w = Number(b.dataset.animAncho);
      b.style.width = `${w}%`;
      ahora.anchos.set(b.closest('[data-barra]')?.getAttribute('data-barra') ?? String(i), w);
    });
    for (const a of arcos) {
      const ini = Number(a.dataset.inicio);
      const lar = Number(a.dataset.largo);
      pintarArco(a, ini, lar, sep);
      ahora.arcos.set(a.dataset.arco!, [ini, lar]);
    }
    const antes = previos.current;
    const entrada = !entradaHecha.current || !antes;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: reduce)', () => {
      entradaHecha.current = true;
    });
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Si el contexto se revierte a mitad (cambio de período, reduced motion
      // o desmontaje), las cifras, barras y arcos vuelven a su valor final:
      // nunca queda un número intermedio en pantalla.
      const reponer = () => {
        for (const c of nums) {
          const v = vistaDe(c);
          if (v) v.textContent = c.dataset.valorFinal ?? '';
        }
        for (const b of barras) b.style.width = `${b.dataset.animAncho}%`;
        for (const a of arcos) pintarArco(a, Number(a.dataset.inicio), Number(a.dataset.largo), sep);
        if (trazos.length) gsap.set(trazos, { clearProps: 'clipPath' });
      };
      // Líneas de la tendencia: se dibujan de izquierda a derecha con un
      // recorte (clip-path) que se abre; sirve igual para trazos continuos y
      // con guiones, y no mueve nada de lugar (sin CLS). Al terminar se quita.
      const crecer = (dur: number, retraso: number) => {
        if (trazos.length) gsap.fromTo(trazos, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: dur, delay: retraso, ease: 'power1.inOut', overwrite: 'auto', clearProps: 'clipPath' });
      };
      const contar = (c: HTMLElement, desde: number, dur: number, delay: number) => {
        const final = Number(c.dataset.animValor);
        const v = vistaDe(c);
        if (!v || desde === final) return;
        const p = { x: desde };
        v.textContent = formatoCifra(c.dataset.animFormato ?? '', desde, final);
        gsap.to(p, {
          x: final,
          duration: dur,
          delay,
          ease: 'power2.out',
          overwrite: 'auto',
          onUpdate: () => {
            v.textContent = formatoCifra(c.dataset.animFormato ?? '', p.x, final);
          },
          onComplete: () => {
            v.textContent = c.dataset.valorFinal ?? '';
          },
        });
      };
      const arcosA = (desde: (k: string) => [number, number], dur: number, ease: string) => {
        if (arcos.length === 0) return;
        const p = { t: 0 };
        const fin = arcos.map((a) => ahora.arcos.get(a.dataset.arco!)!);
        const ini = arcos.map((a) => desde(a.dataset.arco!));
        const pintar = () => arcos.forEach((a, i) => pintarArco(a, ini[i][0] + (fin[i][0] - ini[i][0]) * p.t, ini[i][1] + (fin[i][1] - ini[i][1]) * p.t, sep));
        pintar();
        gsap.to(p, { t: 1, duration: dur, ease, overwrite: 'auto', onUpdate: pintar, onComplete: pintar });
      };
      if (entrada) {
        const tl = gsap.timeline({ onComplete: () => void (entradaHecha.current = true) });
        tl.from(cajas, { opacity: 0, y: 8, duration: 0.35, ease: 'power2.out', stagger: 0.06, clearProps: 'opacity,transform' }, 0);
        cajas.forEach((c, i) => {
          for (const num of c.querySelectorAll<HTMLElement>('[data-anim-clave]')) contar(num, 0, 0.8, i * 0.06);
        });
        if (barras.length) tl.fromTo(barras, { width: '0%' }, { width: (_i: number, b: HTMLElement) => `${b.dataset.animAncho}%`, duration: 0.6, ease: 'power2.out', stagger: 0.05 }, 0.15);
        arcosA(() => [0, 0], 0.8, 'power2.inOut');
        crecer(0.8, 0.2);
        return reponer;
      }
      for (const c of nums) contar(c, antes!.nums.get(c.dataset.animClave!) ?? 0, 0.5, 0);
      for (const b of barras) {
        const k = b.closest('[data-barra]')?.getAttribute('data-barra') ?? '';
        const desde = antes!.anchos.get(k) ?? 0;
        const hasta = Number(b.dataset.animAncho);
        if (desde !== hasta) gsap.fromTo(b, { width: `${desde}%` }, { width: `${hasta}%`, duration: 0.45, ease: 'power2.inOut', overwrite: 'auto' });
      }
      arcosA((k) => antes!.arcos.get(k) ?? [0, 0], 0.45, 'power2.inOut');
      crecer(0.5, 0);
      // All Inclusive Brasil entra con fundido; su espacio aparece sin animar la altura.
      const nuevas = cajas.filter((c) => !antes!.cajas.has(c.dataset.caja!));
      if (nuevas.length) gsap.from(nuevas, { opacity: 0, duration: 0.25, ease: 'power1.out', clearProps: 'opacity' });
      return reponer;
    });
    return () => {
      previos.current = ahora;
      mm.revert();
    };
  }, [raiz, clave]);
}


/** Fila de dato (spec §16.4): ícono 18 · 6 · etiqueta · 12 · valor a la derecha.
 *  Va siempre dentro de un <dl> (§7.2): ícono y etiqueta en <dt>, valor en <dd>. */
export function FilaDato({ concepto, icono, etiqueta, children, fuerte, className, ...resto }: { concepto: string; icono?: Concepto; etiqueta: React.ReactNode; children: React.ReactNode; fuerte?: boolean; className?: string } & Record<`data-${string}`, string | undefined>) {
  return (
    <div {...resto} className={`fila-dato${className ? ` ${className}` : ''}`} data-fila-dato={concepto}>
      <dt className="fila-dato__etiqueta">
        <Icono concepto={icono ?? (concepto as Concepto)} />
        <span>{etiqueta}</span>
      </dt>
      <dd className={`fila-dato__valor${fuerte ? ' fila-dato__valor--fuerte' : ''}`}>{children}</dd>
    </div>
  );
}

/** Plata de una caja en una moneda (§7.2–7.5, orden §16.4): rótulo, venta y
 *  costo, y el bloque «resultado» con ganancia, margen y lista. */
function BloqueMoneda({ m, lista, parcial, clave, varias }: { m: VentasCajaMonto; lista: number | null; parcial: boolean; clave: string; varias: boolean }) {
  const perdida = m.ganancia < 0 || (m.margen ?? 0) < 0;
  const bajo = !perdida && bajoLista(m.margen, lista);
  const rojo = perdida ? ' caja__perdida' : '';
  return (
    <div className="grupo grupo--div caja__moneda" data-parte="detalle" data-moneda={m.moneda}>
      {/* §7.2: con una sola moneda el rótulo es solo «En USD». */}
      <p className="caja__rotulo">{varias ? `En ${m.moneda} · ${reservasTexto(m.reservas)}` : `En ${m.moneda}`}</p>
      <dl className="lista-datos">
      <FilaDato concepto="venta" etiqueta="Venta">
        <Cifra clave={`${clave}:${m.moneda}:venta`} valor={m.venta} texto={fmtMonto(m.moneda, m.venta)} formato={`monto:${m.moneda}`} />
      </FilaDato>
      <FilaDato concepto="costo" etiqueta="Costo Guillermo">
        {fmtMonto(m.moneda, m.costo)}
      </FilaDato>
      </dl>
      <div className="resultado" data-resultado="">
        <dl className="lista-datos">
        <FilaDato concepto="ganancia" icono={m.ganancia < 0 ? 'perdida' : 'ganancia'} etiqueta="Ganancia" fuerte className={m.ganancia < 0 ? 'fila-dato--perdida' : undefined}>
          <span className={rojo.trim() || undefined}>
            <Cifra clave={`${clave}:${m.moneda}:ganancia`} valor={m.ganancia} texto={fmtMonto(m.moneda, m.ganancia)} formato={`monto:${m.moneda}`} />
          </span>
        </FilaDato>
        <FilaDato concepto="margen" etiqueta="Margen" fuerte data-margen={m.margen == null ? 'Margen —' : `Margen ${fmtPorcentaje(m.margen)}${parcial ? ' parcial' : ''}`} {...(lista != null ? { 'data-margen-lista': lista.toFixed(1) } : {})}>
          <span className={rojo.trim() || undefined}>{m.margen == null ? '—' : <Cifra clave={`${clave}:${m.moneda}:margen`} valor={m.margen} texto={fmtPorcentaje(m.margen)} formato="pct" />}</span>
          {parcial && (
            <>
              {' '}
              <span className="caja__parcial">parcial</span>
            </>
          )}
        </FilaDato>
        </dl>
        {(lista != null || perdida || bajo) && (
          <div className="caja__lista">
            {lista != null && <span>lista {fmtPorcentaje(lista)}</span>}
            {bajo && (
              <>
                <Chip data-bajo-lista="">Bajo lista</Chip>
                <span className="solo-lector">
                  : margen {fmtPorcentaje(m.margen!)} contra {fmtPorcentaje(lista!)} de lista
                </span>
              </>
            )}
            {perdida && <Chip critico>Pérdida</Chip>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Grupo de aviso al final de la caja: ícono y texto, sin botón (19-oct). */
function GrupoAviso({ concepto = 'aviso', children, ...resto }: { concepto?: Concepto; children: React.ReactNode } & Record<`data-${string}`, string | number | undefined>) {
  return (
    <div className="grupo grupo--div caja__avisos" data-parte="detalle">
      <div className={`caja__aviso-fila${concepto === 'aviso' ? ' caja__aviso-fila--atencion' : ''}`}>
        <span className="ranura-24">
          <Icono concepto={concepto} />
        </span>
        <p className="caja__aviso" {...resto}>
          {children}
        </p>
      </div>
    </div>
  );
}

// Sin «Ver cuáles» ni «Ver dólar y equilibrio» desde el 19-oct: las secciones
// a las que llevaban ya no están en esta vista. El motivo va en el texto.
function CajaVenta({ caja, tarifas, masVendida }: { caja: VentasCaja; tarifas: VentasTarifa[] | null | undefined; masVendida: boolean }) {
  const id = useId();
  const clave = claveCaja(caja);
  const estado = estadoCaja(caja);
  const montos = ordenarMontos(caja.montos);
  const fd = caja.programa === 'FULL_DAY';
  return (
    <section className="tarjeta caja" data-caja={clave} aria-labelledby={`${id}-h`}>
      <div className="parte-badge" data-parte="badge">
        <span id={`${id}-b`} className="parte-badge__programa">
          <BadgePrograma codigo={caja.programa} />
        </span>
        {masVendida && <span className="chip-mas-vendido">Más vendido</span>}
      </div>
      <h3 id={`${id}-h`} className="parte-titulo caja__titulo" data-parte="titulo">
        <RanuraBandera bandera={banderaDeMercado(caja.mercado)} />
        {/* Sin el programa, AI USA y FD USA se leen igual en la lista de encabezados. */}
        <span className="solo-lector">{PROGRAMA_LABEL[caja.programa]} </span>
        <span>{MERCADO_LABEL[caja.mercado]}</span>
      </h3>
      {/* Desde 640 px por dentro (@container): conteo | moneda | resultado, para
          que cada etiqueta quede junto a su valor en una caja ancha. */}
      <div className="caja__cuerpo" data-parte="detalle">
      <dl className="grupo caja__conteo" data-parte="detalle" data-grupo="conteo">
        <FilaDato concepto="pescadores" etiqueta="Pescadores" fuerte>
          <Cifra clave={`${clave}:pescadores`} valor={caja.pescadores} texto={n(caja.pescadores)} formato="entero" />
        </FilaDato>
        <FilaDato concepto="reservas" etiqueta="Reservas">
          {n(caja.reservas)}
        </FilaDato>
        {fd && caja.jornadas != null && (
          <FilaDato concepto="jornadas" etiqueta="Jornadas">
            {n(caja.jornadas)}
          </FilaDato>
        )}
      </dl>
      <div className="caja__plata">
      {estado === 'cero' && (
        <div className="grupo grupo--div" data-parte="detalle">
          <dl className="lista-datos">
            <FilaDato concepto="margen" etiqueta="Margen" fuerte data-margen="Margen —">
              —
            </FilaDato>
          </dl>
          <div className="caja__lista">sin ventas en este período</div>
        </div>
      )}
      {estado === 'sin-plata' && (
        <>
          <dl className="grupo grupo--div" data-parte="detalle">
            <FilaDato concepto="margen" etiqueta="Margen" fuerte data-margen="Margen —">
              —
            </FilaDato>
          </dl>
          <GrupoAviso data-sin-calcular={caja.sin_calcular}>
            {caja.sin_calcular > 0 ? `Sin plata calculada: ${reservasTexto(caja.sin_calcular)} sin calcular, por falta de un dato de la reserva o del costo.` : 'Sin plata calculada.'}
          </GrupoAviso>
        </>
      )}
      {(estado === 'parcial' || estado === 'completa') &&
        montos.map((m) => <BloqueMoneda key={m.moneda} m={m} lista={margenListaDe(tarifas, caja.programa, caja.mercado, m.moneda)} parcial={estado === 'parcial'} clave={clave} varias={montos.length > 1} />)}
      </div>
      </div>
      {estado === 'parcial' && (
        <GrupoAviso data-sin-calcular={caja.sin_calcular}>
          Venta, costo, ganancia y margen suman {n(reservasConPlata(caja))} de {reservasTexto(caja.reservas)}: {n(caja.sin_calcular)} sin calcular, por falta de un dato de la reserva o del costo.
        </GrupoAviso>
      )}
      {fd && caja.mercado === 'BR' && estado !== 'cero' && (
        <GrupoAviso concepto="dolar">
          Costo pagado en CLP, pasado a USD con el dólar del día de cada confirmación.
        </GrupoAviso>
      )}
    </section>
  );
}

export function ResumenPorPeriodo({
  ventanas,
  periodo,
  onPeriodo,
  temporada,
  tarifas,
  hoy,
  ancho,
  pendientes,
  meses,
}: {
  ventanas: VentasVentanas;
  periodo: VentasPeriodo;
  onPeriodo: (p: VentasPeriodo) => void;
  temporada: VentasResponse['periodo'];
  tarifas: VentasTarifa[] | null | undefined;
  hoy: string;
  ancho: number | null;
  pendientes: number;
  /** Meses de la temporada: sus reservas confirmadas (FechaConfirmacion) alimentan la tendencia. */
  meses: readonly VentasMes[];
}) {
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const radioTemporada = useRef<HTMLInputElement>(null);
  const v = ventanas[periodo];
  const { reservas: R } = totalesVentana(v);
  const visibles = cajasVisibles(v);
  const lider = cajaMasVendida(v);
  const frase = fraseVentana(v, periodo, temporada, hoy);
  const sinFecha = textoSinFecha(periodo, v);
  const t = temporada.temporada;
  const anchoGraficos = ancho ?? 0;
  // Mismo espacio entre hermanas, cajas y gráficos: 18, y 24 en una columna ancha.
  const hermanas = ancho !== null && ancho >= 1000 ? 24 : 18;
  const tendencia = useMemo(() => tendenciaDe(meses.flatMap((m) => m.reservas), v, periodo), [meses, v, periodo]);
  useAnimacion(raiz, `${t}|${periodo}`);

  function verTemporada() {
    onPeriodo('temporada');
    radioTemporada.current?.focus();
  }

  return (
    <div ref={raiz} data-resumen-periodo="" className="resumen-periodo">
      <div className="resumen-periodo__filtro">
        <fieldset className="periodo">
          <legend className="periodo__legend">Período</legend>
          <div className="periodo__grupo">
            {PERIODOS.map((p) => (
              <label key={p} className="periodo__opcion">
                <input ref={p === 'temporada' ? radioTemporada : undefined} type="radio" name={`${id}-periodo`} value={p} checked={periodo === p} onChange={() => onPeriodo(p)} />
                {ETIQUETA_PERIODO[p]}
              </label>
            ))}
          </div>
        </fieldset>
        <p role="status" className="solo-lector">
          {textoEstadoPeriodo(periodo, t, v)}
        </p>
        <p data-rango-periodo="" className="resumen-periodo__rango">
          <span className="ranura-24">
            <Icono concepto="fechas" />
          </span>
          <span>{periodo === 'temporada' || !v.desde ? `Todas las reservas confirmadas de la temporada ${t}.` : `Reservas de la temporada ${t} confirmadas del ${fechaCorta(v.desde)} al ${fechaCorta(v.hasta)}.`}</span>
        </p>
        {sinFecha && (
          <div data-sin-fecha="" className="resumen-periodo__aviso">
            <p className="resumen-periodo__texto">{sinFecha}</p>
            <button type="button" className="boton-texto" onClick={verTemporada}>
              Ver temporada
            </button>
          </div>
        )}
        {frase && (
          <p data-frase-mix="" className="resumen-periodo__frase">
            {frase}
          </p>
        )}
      </div>
      {/* Una columna en todos los anchos (pedido de Mato, 18-oct): cada caja al 100 %. */}
      <div className="cajas" style={{ gap: hermanas }}>
        {visibles.map((c) => (
          <CajaVenta key={claveCaja(c)} caja={c} tarifas={tarifas} masVendida={lider === claveCaja(c)} />
        ))}
      </div>
      {v.otros.reservas > 0 && (
        <p data-otros="" className="resumen-periodo__nota">
          Otros: {reservasTexto(v.otros.reservas)}, {pescadoresTexto(v.otros.pescadores)} (All Inclusive Chile o sin programa o mercado). No tienen caja.
        </p>
      )}
      {pendientes > 0 && (
        <p className="resumen-periodo__nota">
          {pendientes === 1 ? 'Además hay 1 reserva pendiente de confirmar en la temporada: no entra en estas cifras.' : `Además hay ${n(pendientes)} reservas pendientes de confirmar en la temporada: no entran en estas cifras.`}
        </p>
      )}
      {R === 0 && periodo !== 'temporada' ? (
        <div data-periodo-vacio="" className="tarjeta resumen-periodo__vacio">
          <p className="resumen-periodo__texto">
            No hay reservas de la temporada {t} confirmadas en los últimos {periodo === '30d' ? 30 : 90} días.
          </p>
          <button type="button" className="boton-texto" onClick={verTemporada}>
            Ver temporada
          </button>
        </div>
      ) : (
        <div className="resumen-periodo__graficos">
          <p className="resumen-periodo__nota">Se cuentan pescadores, no plata: USD y CLP no se suman.</p>
          <div className="graficos" style={{ gap: hermanas }}>
            <GraficoBarras ventana={v} masVendida={lider} ancho={anchoGraficos} />
            <GraficoDona ventana={v} ancho={anchoGraficos} />
            <GraficoTendencia tendencia={tendencia} />
          </div>
          <p className="resumen-periodo__nota">Los porcentajes están redondeados.</p>
        </div>
      )}
    </div>
  );
}
