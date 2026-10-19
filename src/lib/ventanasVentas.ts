import { MERCADO_LABEL, PROGRAMA_LABEL } from './fichaPescador';
import { fraseMix, inicioFrase, masVendido, pctMix, type Mix } from './ventasMix';
import type { MercadoLodge, ProgramaLodge, VentasCaja, VentasCajaMonto, VentasPeriodo, VentasResponse, VentasSegmento, VentasTarifa, VentasVentana, VentasVentanas } from '../types';

/** Lodge → Ventas por período (spec-ventas-cajas.md, 18-oct). El servidor
 *  calcula todo; aquí solo se valida, se ordena y se elige qué decir. El
 *  panel suma únicamente N y R: Σ cajas + otros (§3). */

export const PERIODOS: VentasPeriodo[] = ['30d', '90d', 'temporada'];
export const ETIQUETA_PERIODO: Record<VentasPeriodo, string> = { '30d': '30 días', '90d': '90 días', temporada: 'Temporada' };
export const PERIODO_POR_DEFECTO: VentasPeriodo = 'temporada';

/** Orden fijo de las cajas en pantalla. Pedido de Mato (18-oct): primero All
 *  Inclusive (USA y Brasil) y después Full Day por país: Chile, Brasil, USA y otros. */
export const ORDEN_CAJAS: `${ProgramaLodge}:${MercadoLodge}`[] = ['ALL_INCLUSIVE:USA', 'ALL_INCLUSIVE:BR', 'FULL_DAY:CL', 'FULL_DAY:BR', 'FULL_DAY:USA'];
/** La única caja que se oculta cuando está en 0. */
export const CAJA_OPCIONAL = 'ALL_INCLUSIVE:BR';

export const claveCaja = (c: { programa: ProgramaLodge; mercado: MercadoLodge }) => `${c.programa}:${c.mercado}`;

const esConteo = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
const esNumero = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const MERCADOS: MercadoLodge[] = ['USA', 'BR', 'CL'];
const PROGRAMAS: ProgramaLodge[] = ['FULL_DAY', 'ALL_INCLUSIVE'];

function montoValido(m: unknown): m is VentasCajaMonto {
  const x = m as VentasCajaMonto;
  return !!x && typeof x.moneda === 'string' && x.moneda !== '' && esConteo(x.reservas) && esNumero(x.venta) && esNumero(x.costo) && esNumero(x.ganancia) && (x.margen === null || esNumero(x.margen));
}

function cajaValida(c: unknown): c is VentasCaja {
  const x = c as VentasCaja;
  return (
    !!x &&
    PROGRAMAS.includes(x.programa) &&
    MERCADOS.includes(x.mercado) &&
    esConteo(x.reservas) &&
    esConteo(x.pescadores) &&
    (x.jornadas == null || esConteo(x.jornadas)) &&
    Array.isArray(x.montos) &&
    x.montos.every(montoValido) &&
    esConteo(x.sin_calcular)
  );
}

/** Una ventana bien formada, con las 5 cajas en el orden fijo; null si no. */
function ventanaDe(v: unknown): VentasVentana | null {
  const x = v as VentasVentana;
  if (!x || typeof x !== 'object' || !Array.isArray(x.cajas) || x.cajas.length !== ORDEN_CAJAS.length) return null;
  if (!x.cajas.every(cajaValida)) return null;
  const porClave = new Map(x.cajas.map((c) => [claveCaja(c), c]));
  if (porClave.size !== ORDEN_CAJAS.length || !ORDEN_CAJAS.every((k) => porClave.has(k))) return null;
  if (!x.otros || !esConteo(x.otros.reservas) || !esConteo(x.otros.pescadores)) return null;
  if (!Array.isArray(x.mercados) || !x.mercados.every((m) => m && MERCADOS.includes(m.mercado) && esConteo(m.pescadores) && esConteo(m.reservas))) return null;
  if (!Array.isArray(x.programas) || !x.programas.every((p) => p && PROGRAMAS.includes(p.programa) && esConteo(p.pescadores) && esConteo(p.reservas))) return null;
  if (typeof x.hasta !== 'string' || (x.desde != null && typeof x.desde !== 'string')) return null;
  return { ...x, cajas: ORDEN_CAJAS.map((k) => porClave.get(k)!), sin_fecha_confirmacion: esConteo(x.sin_fecha_confirmacion) ? x.sin_fecha_confirmacion : 0 };
}

/** Las tres ventanas si el servidor las mandó completas; null si falta
 *  cualquiera (Lambda anterior o respuesta a medias): la página queda la de
 *  antes (§10 E3, CA-V31/32). */
export function ventanasDe(d: { ventanas?: unknown } | null | undefined): VentasVentanas | null {
  const v = d?.ventanas as Partial<VentasVentanas> | undefined;
  if (!v || typeof v !== 'object') return null;
  const a = ventanaDe(v['30d']);
  const b = ventanaDe(v['90d']);
  const c = ventanaDe(v.temporada);
  if (!a || !b || !c) return null;
  return { hoy: typeof v.hoy === 'string' ? v.hoy : undefined, '30d': a, '90d': b, temporada: c };
}

/** N y R del período: Σ cajas + otros (§3). */
export function totalesVentana(v: VentasVentana): { pescadores: number; reservas: number } {
  return v.cajas.reduce((a, c) => ({ pescadores: a.pescadores + c.pescadores, reservas: a.reservas + c.reservas }), { pescadores: v.otros.pescadores, reservas: v.otros.reservas });
}

/** Las 4 fijas siempre; All Inclusive Brasil solo con reservas (§7.1). */
export function cajasVisibles(v: VentasVentana): VentasCaja[] {
  return v.cajas.filter((c) => claveCaja(c) !== CAJA_OPCIONAL || c.reservas > 0);
}

/** La ventana como mix, para reusar la frase y «Más vendido» de ventasMix:
 *  las 5 cajas son los segmentos clasificados y «otros» va sin clasificar. */
export function mixDeVentana(v: VentasVentana): Mix {
  const segmentos: VentasSegmento[] = v.cajas.map((c) => ({
    programa: c.programa,
    mercado: c.mercado,
    reservas: c.reservas,
    pescadores: c.pescadores,
    unidades: c.programa === 'FULL_DAY' ? (c.jornadas ?? 0) : c.pescadores,
    unidad: c.programa === 'FULL_DAY' ? 'jornada' : 'pescador',
  }));
  if (v.otros.reservas > 0 || v.otros.pescadores > 0) segmentos.push({ programa: null, mercado: null, reservas: v.otros.reservas, pescadores: v.otros.pescadores, unidades: null, unidad: null });
  return {
    segmentos,
    mercados: v.mercados,
    programas: v.programas.map((p) => ({ programa: p.programa, reservas: p.reservas, pescadores: p.pescadores, unidades: 0, unidad: p.programa === 'FULL_DAY' ? 'jornada' : 'pescador' })),
  };
}

/** Inicio de la frase según el período (§6). */
export function inicioPeriodo(periodo: VentasPeriodo, temporada: VentasResponse['periodo'], hoy: string): string {
  if (periodo === '30d') return 'En los últimos 30 días';
  if (periodo === '90d') return 'En los últimos 90 días';
  return inicioFrase(temporada, hoy);
}

/** La frase del período; null sin reservas (E6). La segunda oración solo
 *  nombra cajas, nunca «Otros» (§6). */
export function fraseVentana(v: VentasVentana, periodo: VentasPeriodo, temporada: VentasResponse['periodo'], hoy: string): string | null {
  return fraseMix(mixDeVentana(v), temporada, hoy, { inicio: inicioPeriodo(periodo, temporada, hoy), dosPuntos: true });
}

/** Clave de la caja «Más vendido» (≥ 10 pescadores y sin empate), o null. */
export function cajaMasVendida(v: VentasVentana): string | null {
  const s = masVendido(mixDeVentana(v));
  return s && s.programa && s.mercado ? `${s.programa}:${s.mercado}` : null;
}

const ORDEN_MONEDAS = ['USD', 'CLP'];
/** USD primero, CLP después y el resto por orden alfabético. */
export function ordenarMontos(montos: VentasCajaMonto[]): VentasCajaMonto[] {
  const rango = (m: string) => {
    const i = ORDEN_MONEDAS.indexOf(m);
    return i === -1 ? ORDEN_MONEDAS.length : i;
  };
  return montos.slice().sort((a, b) => rango(a.moneda) - rango(b.moneda) || a.moneda.localeCompare(b.moneda));
}

/** Margen de lista comparable con el de la caja en `moneda`, o null (§7.4):
 *  una sola tarifa para el programa y mercado, con precio y margen, y precio,
 *  costo y caja en la misma moneda. FD Brasil (USD contra CLP) nunca compara. */
export function margenListaDe(tarifas: VentasTarifa[] | null | undefined, programa: ProgramaLodge, mercado: MercadoLodge, moneda: string): number | null {
  const misma = (tarifas ?? []).filter((t) => t.programa === programa && t.mercado === mercado);
  if (misma.length !== 1) return null;
  const t = misma[0];
  if (!t.precio || !esNumero(t.margen) || !t.costo) return null;
  if (t.precio.moneda !== moneda || t.costo.moneda !== moneda) return null;
  return t.margen;
}

const a1 = (x: number) => Math.round(x * 10) / 10;
/** Bajo lista: el margen, redondeado a 1 decimal, menor que el de lista redondeado igual. */
export function bajoLista(margen: number | null, lista: number | null): boolean {
  return esNumero(margen) && esNumero(lista) && a1(margen) < a1(lista);
}

export type EstadoCaja = 'cero' | 'sin-plata' | 'parcial' | 'completa';
/** cero: sin ventas en el período · sin-plata: ventas sin ningún monto ·
 *  parcial: algunas reservas sin calcular · completa: todo calculado. */
export function estadoCaja(c: VentasCaja): EstadoCaja {
  if (c.reservas === 0) return 'cero';
  if (c.montos.length === 0) return 'sin-plata';
  return c.sin_calcular > 0 ? 'parcial' : 'completa';
}

/** Reservas que suman en la plata: la suma de cada moneda (cada reserva tiene una sola). */
export const reservasConPlata = (c: VentasCaja) => c.montos.reduce((a, m) => a + m.reservas, 0);

// --- Gráficos (§8): miden pescadores, nunca plata ---

export interface FilaBarra {
  clave: string; // «FULL_DAY:BR» u «otros»
  programa: ProgramaLodge | null;
  mercado: MercadoLodge | null;
  pescadores: number;
  reservas: number;
  jornadas: number | null;
  pct: number;
}
export interface GrupoBarras {
  programa: ProgramaLodge;
  pescadores: number;
  reservas: number;
  jornadas: number | null;
  pct: number;
  filas: FilaBarra[];
}

/** Barras: FD (USA, BR, CL) y AI (USA y BR si su caja se ve). La cabecera
 *  de cada grupo = Σ de SUS filas (decisión del coordinador, 18-oct, opción
 *  A): no se usa `programas`, que en AI incluye Chile. «Otros» = `v.otros`
 *  (AI Chile + sin programa), si tiene pescadores. Así Σ cabeceras + Otros =
 *  Σ cajas + otros = N, sin doble conteo. Largo = pescadores ÷ N. */
export function barrasDe(v: VentasVentana): { grupos: GrupoBarras[]; otros: FilaBarra | null; total: number } {
  const N = totalesVentana(v).pescadores;
  const visibles = new Set(cajasVisibles(v).map(claveCaja));
  const grupos = PROGRAMAS.map((programa): GrupoBarras => {
    const filas = MERCADOS.map((m) => v.cajas.find((c) => c.programa === programa && c.mercado === m))
      .filter((c): c is VentasCaja => !!c && visibles.has(claveCaja(c)))
      .map((c) => ({ clave: claveCaja(c), programa, mercado: c.mercado, pescadores: c.pescadores, reservas: c.reservas, jornadas: programa === 'FULL_DAY' ? (c.jornadas ?? 0) : null, pct: pctMix(c.pescadores, N) }));
    const pescadores = filas.reduce((a, f) => a + f.pescadores, 0);
    const reservas = filas.reduce((a, f) => a + f.reservas, 0);
    const jornadas = programa === 'FULL_DAY' ? filas.reduce((a, f) => a + (f.jornadas ?? 0), 0) : null;
    return { programa, pescadores, reservas, jornadas, pct: pctMix(pescadores, N), filas };
  });
  const otros = v.otros.pescadores > 0 ? { clave: 'otros', programa: null, mercado: null, pescadores: v.otros.pescadores, reservas: v.otros.reservas, jornadas: null, pct: pctMix(v.otros.pescadores, N) } : null;
  return { grupos, otros, total: N };
}

export type ClaveSector = MercadoLodge | 'sin';
export interface Sector {
  clave: ClaveSector;
  pescadores: number;
  pct: number;
  /** Fracción del círculo donde empieza y cuánto ocupa (0–1). */
  inicio: number;
  largo: number;
}

/** Dona: USA, BR, CL y «Sin mercado» si N > Σ mercados, para que sume N. */
export function sectoresDe(v: VentasVentana): Sector[] {
  const N = totalesVentana(v).pescadores;
  const lista: { clave: ClaveSector; pescadores: number }[] = MERCADOS.map((m) => ({ clave: m, pescadores: v.mercados.find((x) => x.mercado === m)?.pescadores ?? 0 }));
  const suma = lista.reduce((a, x) => a + x.pescadores, 0);
  if (N > suma) lista.push({ clave: 'sin', pescadores: N - suma });
  const base = Math.max(N, suma);
  let acc = 0;
  return lista.map((x) => {
    const largo = base > 0 ? x.pescadores / base : 0;
    const s = { ...x, pct: pctMix(x.pescadores, base), inicio: acc, largo };
    acc += largo;
    return s;
  });
}

export const NOMBRE_SECTOR: Record<ClaveSector, string> = { USA: MERCADO_LABEL.USA, BR: MERCADO_LABEL.BR, CL: MERCADO_LABEL.CL, sin: 'Sin mercado' };

const n = (x: number) => x.toLocaleString('es-CL');
export const pescadoresTexto = (x: number) => `${n(x)} ${x === 1 ? 'pescador' : 'pescadores'}`;
export const reservasTexto = (x: number) => `${n(x)} ${x === 1 ? 'reserva' : 'reservas'}`;
export const jornadasTexto = (x: number) => `${n(x)} ${x === 1 ? 'jornada' : 'jornadas'}`;
const PCT = ' %';

/** Línea de detalle de una barra (§8.3). */
export function detalleBarra(f: FilaBarra): string {
  if (!f.programa || !f.mercado) return `Otros: ${pescadoresTexto(f.pescadores)} en ${reservasTexto(f.reservas)} (All Inclusive Chile y sin programa) · ${f.pct}${PCT} de los pescadores del período.`;
  const jorn = f.jornadas != null ? ` · ${jornadasTexto(f.jornadas)}` : '';
  return `${PROGRAMA_LABEL[f.programa]} ${MERCADO_LABEL[f.mercado]}: ${pescadoresTexto(f.pescadores)} en ${reservasTexto(f.reservas)}${jorn} · ${f.pct}${PCT} de los pescadores del período.`;
}

/** Línea de detalle de un sector (§8.3). */
export function detalleSector(s: Sector): string {
  return `${NOMBRE_SECTOR[s.clave]}: ${pescadoresTexto(s.pescadores)} · ${s.pct}${PCT} de los pescadores del período.`;
}

/** Anuncio para el lector de pantalla al cambiar de período (§5.1). */
export function textoEstadoPeriodo(periodo: VentasPeriodo, temporada: string, v: VentasVentana): string {
  const { reservas, pescadores } = totalesVentana(v);
  const cifras = `${reservasTexto(reservas)}, ${pescadoresTexto(pescadores)}.`;
  if (periodo === 'temporada') return `Mostrando toda la temporada ${temporada}: ${cifras}`;
  return `Mostrando los últimos ${periodo === '30d' ? 30 : 90} días: ${cifras}`;
}

/** Línea de §5.4, o null si no corresponde (Temporada o n = 0). */
export function textoSinFecha(periodo: VentasPeriodo, v: VentasVentana): string | null {
  const k = v.sin_fecha_confirmacion;
  if (periodo === 'temporada' || k <= 0) return null;
  return k === 1
    ? '1 reserva confirmada no tiene fecha de confirmación: solo entra en «Temporada».'
    : `${n(k)} reservas confirmadas no tienen fecha de confirmación: solo entran en «Temporada».`;
}
