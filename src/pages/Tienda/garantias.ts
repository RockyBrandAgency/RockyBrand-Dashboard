import type { StoreGarantia, StoreGarantiaEstado } from '../../types';

// Lo que comparten la pantalla de Garantías y su ficha.

// Cinco estados, espejo de ESTADOS_GARANTIA en store_admin_lambda.py. Sin
// esto la pantalla es una lista que solo crece: todo queda en "recibida" para
// siempre y a los pocos meses no se distingue lo pendiente de lo resuelto.
// «Entregada» (2026-10-07): el cliente ya recibió el tramo.
// El texto va con los tokens `*-text`: los `*-dot` sobre su fondo daban
// contraste 2,9:1 (medido el 2026-10-07), bajo el 4,5:1 de WCAG. Despachada
// va en azul y Entregada en verde: en el mismo color no se distinguían.
export const ESTADOS_GARANTIA: { key: StoreGarantiaEstado; label: string; bg: string; fg: string }[] = [
  { key: 'recibida', label: 'Recibida', bg: 'var(--status-atencion-bg)', fg: 'var(--status-atencion-text)' },
  { key: 'en_revision', label: 'En revisión', bg: 'var(--status-neutro-bg)', fg: 'var(--text-sub)' },
  { key: 'despachada', label: 'Despachada', bg: 'var(--status-info-bg)', fg: 'var(--status-info-text)' },
  { key: 'entregada', label: 'Entregada', bg: 'var(--status-bien-bg)', fg: 'var(--status-bien-text)' },
  { key: 'rechazada', label: 'Rechazada', bg: 'var(--status-critico-bg)', fg: 'var(--status-critico-text)' },
];

// El número de tramo solo dice algo si se sabe desde dónde se cuenta. Acá el
// 1 es la punta — mismo criterio que el formulario público, que se lo explica
// al cliente con esas mismas palabras.
export const TRAMO_NOMBRE: Record<string, string> = {
  '1': 'Punta',
  '2': 'Segundo',
  '3': 'Tercero',
  '4': 'Base',
};

// Lo que cuesta reponer un tramo según el formulario de la web
// (COSTO_POR_TRAMO_CLP en store_garantias_lambda.py). Acá es solo el valor
// con que parte una garantía agregada a mano: se puede cambiar.
export const PRECIO_REPOSICION_CLP = 50_000;

export function money(clp: number | null | undefined): string {
  return (clp ?? 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

// "2026-10-07" → "7 oct 2026". Se arma la fecha con sus partes y no con
// new Date("2026-10-07"): esa la lee como medianoche UTC, y en Chile se ve
// como el día anterior.
export function fmtFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso || '—';
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Un instante ISO con hora ("2026-10-07T15:04:05+00:00") en la hora local:
// "07 oct, 12:04". Para las fechas sin hora, fmtFecha.
export function fmtMomento(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

// Lo que queda de la reposición después de los costos que se cargaron.
// null si no hay ningún costo cargado: un margen igual al precio sería falso.
export function margen(g: { costo_clp: number; costo_despacho_clp: number | null; costo_douglas_clp: number | null }): number | null {
  if (g.costo_despacho_clp === null && g.costo_douglas_clp === null) return null;
  return g.costo_clp - (g.costo_despacho_clp ?? 0) - (g.costo_douglas_clp ?? 0);
}

// --- RUT ------------------------------------------------------------------
// Cuerpo de 7 u 8 dígitos y dígito verificador (módulo 11). Mismo criterio
// que _rut en store_admin_lambda.py, que lo vuelve a comprobar al guardar.

export function limpiarRut(texto: string): string {
  return texto.replace(/[^0-9kK]/g, '').toUpperCase();
}

export function digitoVerificador(cuerpo: string): string {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
}

export function rutValido(texto: string): boolean {
  const limpio = limpiarRut(texto);
  const cuerpo = limpio.slice(0, -1);
  return /^\d{7,8}$/.test(cuerpo) && digitoVerificador(cuerpo) === limpio.slice(-1);
}

// "12345678-5" → "12.345.678-5". Lo que no es un RUT vuelve tal cual: el
// error se muestra al guardar, no se corrige en silencio.
export function formatearRut(texto: string): string {
  if (!rutValido(texto)) return texto.trim();
  const limpio = limpiarRut(texto);
  return `${limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${limpio.slice(-1)}`;
}

// --- Despacho -------------------------------------------------------------
// Las 16 regiones, de norte a sur, con el nombre corto de uso común. Es un
// select y no texto libre (2026-10-08): el filtro por región del listado
// solo sirve si «Aysén» se escribe siempre igual.
export const REGIONES = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana',
  "O'Higgins",
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén',
  'Magallanes',
];

// Sugerencias para «Empresa de transporte»; se puede escribir otra.
export const COURIERS = ['Starken', 'Chilexpress', 'Correos de Chile', 'Blue Express'];

// --- Filtros del listado (2026-10-08, pedido de Mato) ----------------------
// Año, región y caña, para ver a qué región se despacha más, en qué año hubo
// más casos y qué caña pide más garantías. `region` y `cana` guardan la
// clave normalizada (ver `clave`), no el texto tal como se escribió.

export interface FiltrosGarantias {
  anio: string;
  region: string;
  cana: string;
  soloReincidentes: boolean;
}

export const SIN_FILTROS: FiltrosGarantias = { anio: '', region: '', cana: '', soloReincidentes: false };

// Año en que llegó la solicitud. created_at viene en UTC; el año en Chile
// solo difiere unas horas la noche de Año Nuevo, y da lo mismo.
export function anioDe(g: { created_at: string }): string {
  return g.created_at.slice(0, 4);
}

// «sky g», «SKY G » y «Sky G» son la misma caña: las del formulario web y
// las agregadas a mano no se escriben igual.
export function clave(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface OpcionFiltro {
  valor: string;
  label: string;
  cuantas: number;
}

// Los valores distintos de un campo, con cuántas garantías tiene cada uno,
// de más a menos. Se muestra la primera forma en que se escribió. El vacío
// no es una opción: se filtra por lo que se sabe.
export function opcionesDe(garantias: StoreGarantia[], leer: (g: StoreGarantia) => string): OpcionFiltro[] {
  const vistas = new Map<string, OpcionFiltro>();
  for (const g of garantias) {
    const texto = leer(g).trim();
    const k = clave(texto);
    if (!k) continue;
    const o = vistas.get(k);
    if (o) o.cuantas += 1;
    else vistas.set(k, { valor: k, label: texto, cuantas: 1 });
  }
  return [...vistas.values()].sort((a, b) => b.cuantas - a.cuantas || a.label.localeCompare(b.label, 'es'));
}

export function filtrarGarantias(garantias: StoreGarantia[], f: FiltrosGarantias): StoreGarantia[] {
  return garantias.filter(
    (g) =>
      (!f.soloReincidentes || g.veces_usada > 1) &&
      (!f.anio || anioDe(g) === f.anio) &&
      (!f.region || clave(g.region) === f.region) &&
      (!f.cana || clave(g.cana) === f.cana),
  );
}

export function hayFiltros(f: FiltrosGarantias): boolean {
  return Boolean(f.anio || f.region || f.cana || f.soloReincidentes);
}
