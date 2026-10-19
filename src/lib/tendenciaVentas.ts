// Tendencia de ventas por fecha de confirmación (pedido de Mato, 18-oct):
// «¿en qué fechas vendemos más?». Se calcula en el cliente con
// `meses[].reservas[].FechaConfirmacion` de GET /dashboard/ventas, que ya
// viene como día de Chile (YYYY-MM-DD). Por eso toda la aritmética es sobre
// el día como texto, en UTC: la zona horaria del navegador no la mueve.
// Mide pescadores, igual que las barras y la dona: USD y CLP no se suman.
import type { VentasPeriodo, VentasReserva } from '../types';

/** Mismo criterio que las cajas y las barras (`_CAJAS` de pms_utilidad.py y
 *  `barrasDe`): All Inclusive es caja solo en USA y Brasil; Full Day, en USA,
 *  Brasil y Chile. Lo demás —AI Chile, sin programa o sin mercado— es «Otros». */
function serieDe(r: Pick<VentasReserva, 'Programa' | 'Mercado'>): 'ai' | 'fd' | 'otros' {
  if (r.Programa === 'ALL_INCLUSIVE' && (r.Mercado === 'USA' || r.Mercado === 'BR')) return 'ai';
  if (r.Programa === 'FULL_DAY' && (r.Mercado === 'USA' || r.Mercado === 'BR' || r.Mercado === 'CL')) return 'fd';
  return 'otros';
}

export type Escala = 'dia' | 'semana';

export interface Tramo {
  /** Primer y último día del tramo, recortados al período. */
  desde: string;
  hasta: string;
  ai: number;
  fd: number;
  /** «Otros» de las barras: AI Chile y lo que no tiene programa o mercado. */
  otros: number;
  total: number;
  reservas: number;
}

export interface Tendencia {
  escala: Escala;
  tramos: Tramo[];
  total: number;
  reservas: number;
  /** Reservas del período sin fecha de confirmación válida: no entran. */
  sinFecha: number;
  /** El primer tramo con más pescadores; null si no hay ventas. */
  maximo: Tramo | null;
  /** Otros tramos con el mismo máximo. */
  empatados: number;
  /** El período cruza de año: las etiquetas llevan el año. */
  conAno: boolean;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 86_400_000;

function aDia(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / MS_DIA;
}

function aIso(dia: number): string {
  return new Date(dia * MS_DIA).toISOString().slice(0, 10);
}

/** Lunes de la semana del día (semana ISO 8601, de lunes a domingo). */
export function lunesDe(iso: string): string {
  const d = aDia(iso);
  const dow = (new Date(d * MS_DIA).getUTCDay() + 6) % 7;
  return aIso(d - dow);
}

/** 30 días va por día; 90 días y Temporada, por semana. */
export function escalaDe(periodo: VentasPeriodo): Escala {
  return periodo === '30d' ? 'dia' : 'semana';
}

export function tendenciaDe(reservas: readonly VentasReserva[], ventana: { desde: string | null; hasta: string }, periodo: VentasPeriodo): Tendencia {
  const escala = escalaDe(periodo);
  const hasta = ventana.hasta;
  const conFecha = reservas.filter((r) => typeof r.FechaConfirmacion === 'string' && DIA.test(r.FechaConfirmacion));
  const desde = ventana.desde ?? conFecha.reduce<string | null>((min, r) => (r.FechaConfirmacion! <= hasta && (min === null || r.FechaConfirmacion! < min) ? r.FechaConfirmacion! : min), null);
  // Solo Temporada no tiene `desde`: ahí las reservas sin fecha se cuentan aparte.
  const sinFecha = ventana.desde === null ? reservas.length - conFecha.length : 0;
  const vacia: Tendencia = { escala, tramos: [], total: 0, reservas: 0, sinFecha, maximo: null, empatados: 0, conAno: false };
  if (desde === null || !DIA.test(desde) || !DIA.test(hasta) || desde > hasta) return vacia;

  const d0 = aDia(desde);
  const d1 = aDia(hasta);
  const tramos: Tramo[] = [];
  const inicio = escala === 'dia' ? d0 : aDia(lunesDe(desde));
  const paso = escala === 'dia' ? 1 : 7;
  for (let d = inicio; d <= d1; d += paso) {
    tramos.push({ desde: aIso(Math.max(d, d0)), hasta: aIso(Math.min(d + paso - 1, d1)), ai: 0, fd: 0, otros: 0, total: 0, reservas: 0 });
  }
  for (const r of conFecha) {
    const f = r.FechaConfirmacion!;
    if (f < desde || f > hasta) continue;
    const t = tramos[Math.floor((aDia(f) - inicio) / paso)];
    const p = Math.max(0, r.Pescadores ?? 0);
    t[serieDe(r)] += p;
    t.total += p;
    t.reservas += 1;
  }
  let maximo: Tramo | null = null;
  for (const t of tramos) if (t.total > 0 && (!maximo || t.total > maximo.total)) maximo = t;
  const empatados = maximo ? tramos.filter((t) => t !== maximo && t.total === maximo!.total).length : 0;
  return {
    escala,
    tramos,
    total: tramos.reduce((a, t) => a + t.total, 0),
    reservas: tramos.reduce((a, t) => a + t.reservas, 0),
    sinFecha,
    maximo,
    empatados,
    conAno: desde.slice(0, 4) !== hasta.slice(0, 4),
  };
}

function fmt(iso: string, opciones: Intl.DateTimeFormatOptions): string {
  return new Date(aDia(iso) * MS_DIA).toLocaleDateString('es-CL', { timeZone: 'UTC', ...opciones }).replace(/\./g, '');
}

/** «14 oct» por día; «13–19 oct» o «28 sept – 4 oct» por semana. */
export function etiquetaTramo(t: Pick<Tramo, 'desde' | 'hasta'>, conAno = false): string {
  const ano = conAno ? ({ year: 'numeric' } as const) : {};
  if (t.desde === t.hasta) return fmt(t.desde, { day: 'numeric', month: 'short', ...ano });
  const mismoMes = t.desde.slice(0, 7) === t.hasta.slice(0, 7);
  if (mismoMes) return `${fmt(t.desde, { day: 'numeric' })}–${fmt(t.hasta, { day: 'numeric', month: 'short', ...ano })}`;
  const mismoAno = t.desde.slice(0, 4) === t.hasta.slice(0, 4);
  return `${fmt(t.desde, { day: 'numeric', month: 'short', ...(conAno && !mismoAno ? ano : {}) })} – ${fmt(t.hasta, { day: 'numeric', month: 'short', ...ano })}`;
}

function pesc(n: number): string {
  return `${n.toLocaleString('es-CL')} ${n === 1 ? 'pescador' : 'pescadores'}`;
}

/** Desglose por serie, solo las que tienen pescadores, en el orden del apilado. */
function desglose(t: Tramo, sep: string): string {
  return [t.ai > 0 ? `All Inclusive ${t.ai}` : '', t.fd > 0 ? `Full Day ${t.fd}` : '', t.otros > 0 ? `Otros ${t.otros}` : ''].filter(Boolean).join(sep);
}

/** La frase visible del máximo, con su desglose en texto: en el gráfico de
 *  líneas, cada serie se distingue por su trazo y su marcador, no solo por el
 *  color (WCAG 1.4.1), y aquí lo repite el texto. */
export function fraseTendencia(t: Tendencia): string {
  if (!t.maximo) {
    if (t.reservas > 0) return `${t.reservas === 1 ? '1 venta' : `${t.reservas.toLocaleString('es-CL')} ventas`} en el período, sin pescadores informados.`;
    return 'Sin ventas con fecha de confirmación en este período.';
  }
  const cuando = etiquetaTramo(t.maximo, t.conAno);
  const partes = desglose(t.maximo, ' · ');
  if (t.reservas === 1) return `Una sola venta en el período: ${cuando}, ${pesc(t.maximo.total)} (${partes}). Con una venta todavía no hay tendencia.`;
  const nombre = t.escala === 'dia' ? 'Mejor día' : 'Mejor semana';
  const empate = t.empatados > 0 ? `; empata con ${t.empatados === 1 ? 'otro' : `${t.empatados} más`}` : '';
  return `${nombre}: ${cuando}, ${pesc(t.maximo.total)} (${partes}${empate}).`;
}

/** Texto de un tramo para lector de pantalla. */
export function textoTramo(t: Tramo, conAno: boolean): string {
  const partes = desglose(t, ', ');
  return `${etiquetaTramo(t, conAno)}: ${pesc(t.total)}${partes ? ` (${partes})` : ''}.`;
}
