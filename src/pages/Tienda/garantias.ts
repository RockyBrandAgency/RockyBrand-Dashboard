import type { StoreGarantiaEstado } from '../../types';

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
