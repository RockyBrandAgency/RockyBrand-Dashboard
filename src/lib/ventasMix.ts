import { MERCADO_LABEL, PROGRAMA_LABEL } from './fichaPescador';
import type { MercadoLodge, ProgramaLodge, VentasMercadoMix, VentasProgramaMix, VentasResponse, VentasSegmento } from '../types';

/** «Qué se vende» (spec-ventas-mix.md, decisiones de Mato del 17-oct): el mix
 *  se mide en pescadores, lo calcula el servidor y el panel no lo recalcula;
 *  aquí solo se ordena, se elige qué frase decir y se revisa que cuadre. */

export const MINIMO_LIDER = 10;
export const ORDEN_MERCADOS: MercadoLodge[] = ['USA', 'BR', 'CL'];
export const ORDEN_PROGRAMAS: ProgramaLodge[] = ['FULL_DAY', 'ALL_INCLUSIVE'];

export interface Mix {
  segmentos: VentasSegmento[];
  mercados: VentasMercadoMix[];
  programas: VentasProgramaMix[];
}

const esConteo = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** El mix si el servidor lo mandó completo y bien formado; null si no (Lambda anterior). */
export function mixDe(d: { segmentos?: unknown; mercados?: unknown; programas?: unknown } | null | undefined): Mix | null {
  if (!d || !Array.isArray(d.segmentos) || !Array.isArray(d.mercados) || !Array.isArray(d.programas)) return null;
  const segmentos = d.segmentos as VentasSegmento[];
  const mercados = d.mercados as VentasMercadoMix[];
  const programas = d.programas as VentasProgramaMix[];
  const ok =
    segmentos.every((s) => s && esConteo(s.reservas) && esConteo(s.pescadores)) &&
    mercados.every((m) => m && ORDEN_MERCADOS.includes(m.mercado) && esConteo(m.reservas) && esConteo(m.pescadores)) &&
    programas.every((p) => p && ORDEN_PROGRAMAS.includes(p.programa) && esConteo(p.reservas) && esConteo(p.pescadores));
  return ok ? { segmentos, mercados, programas } : null;
}

export const clasificado = (s: VentasSegmento): s is VentasSegmento & { programa: ProgramaLodge; mercado: MercadoLodge } => s.programa != null && s.mercado != null;

/** N y R: todos los pescadores y reservas confirmadas, también los sin clasificar. */
export function totalesMix(mix: Mix): { pescadores: number; reservas: number } {
  return mix.segmentos.reduce((a, s) => ({ pescadores: a.pescadores + s.pescadores, reservas: a.reservas + s.reservas }), { pescadores: 0, reservas: 0 });
}

/** Lo sin clasificar (programa o mercado null), sumado. */
export function sinClasificar(mix: Mix): { pescadores: number; reservas: number } {
  return mix.segmentos.filter((s) => !clasificado(s)).reduce((a, s) => ({ pescadores: a.pescadores + s.pescadores, reservas: a.reservas + s.reservas }), { pescadores: 0, reservas: 0 });
}

/** El mix cuadra con el resumen: cada programa y los mercados suman lo mismo
 *  que el resumen y que sus segmentos. Si no, se muestra el estado M6. */
export function cuadra(mix: Mix, resumen: VentasResponse['resumen']): boolean {
  const prog = (p: ProgramaLodge) => mix.programas.find((x) => x.programa === p) ?? { reservas: 0, pescadores: 0 };
  const segs = (p: ProgramaLodge) => mix.segmentos.filter((s) => s.programa === p && s.mercado != null);
  const suma = (l: { reservas: number; pescadores: number }[]) => l.reduce((a, x) => [a[0] + x.reservas, a[1] + x.pescadores], [0, 0]);
  const fd = prog('FULL_DAY');
  const ai = prog('ALL_INCLUSIVE');
  if (fd.reservas !== resumen.full_day.reservas || fd.pescadores !== resumen.full_day.pescadores) return false;
  if (ai.reservas !== resumen.all_inclusive.reservas || ai.pescadores !== resumen.all_inclusive.pescadores) return false;
  for (const p of ORDEN_PROGRAMAS) {
    const [r, n] = suma(segs(p));
    if (r !== prog(p).reservas || n !== prog(p).pescadores) return false;
  }
  const [rm, nm] = suma(mix.mercados);
  return rm === fd.reservas + ai.reservas && nm === fd.pescadores + ai.pescadores;
}

/** Porcentaje entero (Math.round) sobre todos los pescadores. */
export function pctMix(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

/** Siempre los tres mercados, de más a menos pescadores; empate en orden USA, BR, CL. */
export function mercadosOrdenados(mix: Mix): VentasMercadoMix[] {
  return ORDEN_MERCADOS.map((m) => mix.mercados.find((x) => x.mercado === m) ?? { mercado: m, reservas: 0, pescadores: 0 }).sort((a, b) => b.pescadores - a.pescadores);
}

/** Segmento de un programa y mercado (0 si el servidor no lo mandó). */
export function segmento(mix: Mix, programa: ProgramaLodge, mercado: MercadoLodge): VentasSegmento {
  return mix.segmentos.find((s) => s.programa === programa && s.mercado === mercado) ?? { programa, mercado, reservas: 0, pescadores: 0, unidades: 0, unidad: programa === 'FULL_DAY' ? 'jornada' : 'pescador' };
}

/** El segmento clasificado con más pescadores, solo si hay mínimo y no hay empate. */
export function masVendido(mix: Mix): VentasSegmento | null {
  if (totalesMix(mix).pescadores < MINIMO_LIDER) return null;
  const segs = mix.segmentos.filter(clasificado);
  const max = Math.max(0, ...segs.map((s) => s.pescadores));
  const top = segs.filter((s) => s.pescadores === max);
  return max > 0 && top.length === 1 ? top[0] : null;
}

/** Fecha de hoy en Chile, YYYY-MM-DD. */
export function hoyChile(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

export function inicioFrase(periodo: VentasResponse['periodo'], hoy: string): string {
  return hoy >= periodo.desde && hoy <= periodo.hasta ? 'Esta temporada' : `En la temporada ${periodo.temporada}`;
}

const n = (x: number) => x.toLocaleString('es-CL');
/** Espacio no separable antes de «%»: «(46 %)» no se corta a 320 px. */
export const PCT = '\u00a0%';
/** «USA y otros, y Brasil», «Full Day Brasil, y All Inclusive USA y otros»: con coma si cualquiera de los dos nombres ya trae «y». */
const unir = (x: string, y: string) => (x.includes(' y ') || y.includes(' y ') ? `${x}, y ${y}` : `${x} y ${y}`);
const pesc = (x: number) => `${n(x)} ${x === 1 ? 'pescador' : 'pescadores'}`;
const resv = (x: number) => `${n(x)} ${x === 1 ? 'reserva' : 'reservas'}`;
const nombreSeg = (s: VentasSegmento) => `${PROGRAMA_LABEL[s.programa!]} ${MERCADO_LABEL[s.mercado!]}`;

/** La frase del resumen (spec §6.4, F0–F4). null en F0 (sin reservas). Sin plata ni tendencias. */
export function fraseMix(mix: Mix, periodo: VentasResponse['periodo'], hoy: string, opciones: { inicio?: string; dosPuntos?: boolean } = {}): string | null {
  const { pescadores: N, reservas: R } = totalesMix(mix);
  const inicio = opciones.inicio ?? inicioFrase(periodo, hoy);
  if (R === 0) return null; // F0
  if (N === 0) return `${inicio} hay ${resv(R)} ${R === 1 ? 'confirmada' : 'confirmadas'}, pero ${R === 1 ? 'no tiene' : 'ninguna tiene'} número de pescadores.`; // F1
  // F2. Con períodos (cajas, 18-oct) va con dos puntos: «llevas» no calza con «En los últimos 30 días».
  if (N < MINIMO_LIDER) return `${inicio}${opciones.dosPuntos ? ':' : ' llevas'} ${pesc(N)} en ${resv(R)}. Con menos de ${MINIMO_LIDER} todavía no se puede decir qué se vende más.`;
  const conPesc = mix.segmentos.filter((s) => s.pescadores > 0);
  if (conPesc.length === 1 && clasificado(conPesc[0])) return `${inicio}, todos los pescadores son de ${nombreSeg(conPesc[0])}: ${n(N)} en ${resv(R)}.`; // F3
  // F4 — Frase A (mercado). Sin pescadores clasificados no hay mercado que nombrar.
  const mercados = mercadosOrdenados(mix);
  const k = mercados[0].pescadores;
  const lideres = mercados.filter((m) => m.pescadores === k);
  const rot = (m: MercadoLodge) => MERCADO_LABEL[m];
  let a = '';
  if (k > 0 && lideres.length === 1) a = `${inicio} lidera ${rot(lideres[0].mercado)}: ${n(k)} de ${pesc(N)} (${pctMix(k, N)}${PCT}).`;
  else if (k > 0 && lideres.length === 2) a = `${inicio} empatan ${unir(rot(lideres[0].mercado), rot(lideres[1].mercado))}: ${pesc(k)} cada uno, de ${n(N)}.`;
  else if (k > 0) a = `${inicio} empatan los tres mercados: ${pesc(k)} cada uno.`;
  // Frase B (segmento)
  const segs = mix.segmentos.filter(clasificado);
  const max = Math.max(0, ...segs.map((s) => s.pescadores));
  const top = segs.filter((s) => s.pescadores === max);
  let b = '';
  if (max > 0 && top.length === 1) b = `Lo que más se vende es ${nombreSeg(top[0])}: ${pesc(max)} en ${resv(top[0].reservas)}.`;
  else if (max > 0 && top.length === 2) b = `Lo que más se vende: ${unir(nombreSeg(top[0]), nombreSeg(top[1]))}, con ${pesc(max)} cada uno.`;
  const frase = [a, b].filter(Boolean).join(' ');
  return frase || null;
}

/** Mercados de un mes con pescadores, en orden fijo; vacío si no hay. */
export function mercadosDelMes(mercados: VentasMercadoMix[] | undefined): VentasMercadoMix[] {
  if (!Array.isArray(mercados)) return [];
  return ORDEN_MERCADOS.map((m) => mercados.find((x) => x.mercado === m)).filter((x): x is VentasMercadoMix => !!x && x.pescadores > 0);
}
