import type { FishingExperience, HuespedItem, MercadoLodge, ProgramaLodge, ReservaResumenItem, UnidadCosto } from '../types';

// Reglas de la ficha del pescador y de las listas que la abren (5.0.0). Viven
// aquí, sin React, para que el Resumen, el Calendario y Pescadores no puedan
// contar distinto y para probarlas sin dibujar pantallas.

export const EXPERIENCIA_LABEL: Record<FishingExperience, string> = {
  BEGINNER: 'Principiante',
  INTERMEDIATE: 'Intermedio',
  ADVANCED: 'Avanzado',
};

export const ESTADO_RESERVA_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  PENDING: 'Pendiente de pago',
  CANCELLED: 'Cancelada',
};

export const PAGO_LABEL: Record<string, string> = {
  PAID: 'Pagada',
  PENDING: 'Sin pagar',
  PARTIAL: 'Abono parcial',
  REFUNDED: 'Devuelta',
};

/** Fecha de hoy en la hora del equipo que mira el panel (no en UTC). */
export function hoyLocalISO(ahora: Date = new Date()): string {
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return hoyLocalISO(d);
}

export function diasEntre(desde: string, hasta: string): number {
  const ms = new Date(`${hasta}T00:00:00`).getTime() - new Date(`${desde}T00:00:00`).getTime();
  return Math.round(ms / 86400000);
}

/** «USD 9.800». Sin decimales si son cero. */
/** Texto único de la licencia en All Inclusive, en la ficha y en Ventas. */
export const LICENCIA_INCLUIDA = 'Incluida, la compra el guía';

/** «USD 9.800», «USD 43,50», «CLP 360.000»: con centavos, siempre dos
 *  decimales; sin centavos, ninguno. */
export function fmtMonto(moneda: string | null | undefined, monto: number): string {
  const abs = Math.abs(monto);
  const conCentavos = Math.round(abs * 100) % 100 !== 0;
  const n = abs.toLocaleString('es-CL', { minimumFractionDigits: conCentavos ? 2 : 0, maximumFractionDigits: conCentavos ? 2 : 0 });
  return `${monto < 0 ? '−' : ''}${moneda ?? ''} ${n}`.trim();
}

/** «9,2 %» con espacio no separable (U+00A0) antes del %, como en el mix de
 *  Ventas: así «%» no queda solo en la línea siguiente a 320 px. */
export function fmtPorcentaje(valor: number): string {
  const n = Math.abs(valor).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${valor < 0 ? '−' : ''}${n}\u00a0%`;
}

/** «14 nov 2026»; con `conDia`, «vie 13 nov 2026». Texto vacío sin fecha. */
export function fechaCorta(iso: string | null | undefined, conDia = false): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { ...(conDia ? { weekday: 'short' as const } : {}), day: 'numeric', month: 'short', year: 'numeric' }).replace(',', '');
}

/** Dólar observado: «CLP 948,00», siempre con dos decimales. */
export function fmtDolar(valor: number): string {
  return `CLP ${valor.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Motivos que dependen del dólar: con ellos falta la conversión, no un dato de la reserva. */
export const MOTIVOS_DOLAR = new Set(['SIN_DOLAR', 'SIN_FECHA_CONFIRMACION']);

export const PROGRAMA_LABEL: Record<ProgramaLodge, string> = { ALL_INCLUSIVE: 'All Inclusive', FULL_DAY: 'Full Day' };

/** Nombre de un RoomID para mostrar: «FULL_DAY» → «Full Day». Un RoomID que no
 *  es código de programa (Alto Castillo: «Suite 1») queda tal cual. Lo usan la
 *  ficha y el calendario, para que digan lo mismo. */
export function nombrePrograma(roomId: string): string {
  return Object.prototype.hasOwnProperty.call(PROGRAMA_LABEL, roomId) ? PROGRAMA_LABEL[roomId as ProgramaLodge] : roomId;
}
// Mercado USA = todo pescador que no es de Chile ni de Brasil (o sin país). Se
// muestra «USA y otros» (Mato, 17-oct); el código interno sigue siendo USA.
export const MERCADO_LABEL: Record<MercadoLodge, string> = { USA: 'USA y otros', CL: 'Chile', BR: 'Brasil' };


/** El programa sale de Profit.Programa; si una Lambda anterior no lo manda,
 *  solo se acepta un RoomID que ya sea el código. Nada de adivinar por nombre. */
export function programaDe(r: ReservaResumenItem): ProgramaLodge | null {
  const p = r.Profit?.Programa;
  if (p === 'ALL_INCLUSIVE' || p === 'FULL_DAY') return p;
  if (r.RoomID === 'ALL_INCLUSIVE' || r.RoomID === 'FULL_DAY') return r.RoomID;
  return null;
}

/** «2 jornadas», «1 pescador». `persona` es la terminología del cliente. */
export function unidadTexto(unidad: UnidadCosto, n: number, persona: { singular: string; plural: string }): string {
  if (unidad === 'jornada') return n === 1 ? '1 jornada' : `${n} jornadas`;
  return `${n} ${n === 1 ? persona.singular : persona.plural}`;
}

/** «2026-10» → «Octubre 2026». */
export function mesLargo(mes: string): string {
  const d = new Date(`${mes}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return mes;
  const t = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Por qué no hay número. Lo usan la ficha y Ventas, con el mismo texto.
 *  `fechaConfirmacion` (YYYY-MM-DD) nombra el día del dólar que falta. */
export function motivoSinUtilidad(
  reason: string | null | undefined,
  monedaReserva?: string | null,
  monedaCostos?: string | null,
  fechaConfirmacion?: string | null,
): string {
  switch (reason) {
    case 'SIN_DOLAR':
      return fechaConfirmacion
        ? `Falta el dólar observado del ${fechaCorta(fechaConfirmacion)}: la ganancia no se calcula`
        : 'Falta el dólar observado del día de confirmación: la ganancia no se calcula';
    case 'SIN_FECHA_CONFIRMACION':
      return 'Falta la fecha de confirmación: sin ella no se sabe qué dólar usar y la ganancia no se calcula';
    case 'SIN_TARIFA':
      return 'Sin tarifa del guía para esa fecha de llegada';
    case 'TARIFA_SOLAPADA':
      return 'Hay dos tarifas del guía para esa fecha; revisa la configuración';
    case 'SIN_PESCADORES':
      return 'Falta cuántos pescadores vienen';
    case 'SIN_PRECIO':
      return 'Falta el precio de la reserva';
    case 'CANCELADA':
      return 'La reserva está cancelada: no deja ganancia';
    case 'SIN_PROGRAMA':
      return 'No se reconoce el programa de la reserva (debe ser All Inclusive o Full Day)';
    case 'SIN_FECHAS':
      return 'Faltan las fechas de llegada o salida';
    case 'MONEDA_DISTINTA':
      if (!monedaReserva) return 'La reserva y el costo del guía están en monedas distintas';
      return monedaCostos
        ? `La reserva está en ${monedaReserva}; los costos están en ${monedaCostos}`
        : `La reserva está en ${monedaReserva} y el costo del guía, en otra moneda`;
    default:
      return 'No se pudo calcular la ganancia';
  }
}

export interface UtilidadVista {
  /** Lo que va en grande: «9,2 %» o «—». */
  valor: string;
  /** Lo que va debajo: el monto, o por qué no hay número. */
  motivo: string;
  negativa: boolean;
  /** «(9.800 − 8.400 − 500) ÷ 9.800 = 9,2 %», solo con número. */
  formula: string | null;
}

// La utilidad la calcula el servidor (Profit). Aquí solo se decide cómo se
// lee. El porcentaje es Percent tal como llega (0–100, un decimal: lo
// calcula pms_utilidad.py sobre TotalAmount): una sola fuente.
export function utilidadDe(r: ReservaResumenItem): UtilidadVista {
  const sinNumero = (motivo: string): UtilidadVista => ({ valor: '—', motivo, negativa: false, formula: null });
  const p = r.Profit;
  if (!p) return sinNumero('Sin dato de ganancia');
  if (p.Amount == null || p.Percent == null) {
    // Sin confirmar todavía no hay día de confirmación ni, por lo tanto, dólar.
    if (r.Status === 'PENDING' && p.Reason && MOTIVOS_DOLAR.has(p.Reason)) {
      return sinNumero('Se calcula al confirmar la reserva, con el dólar observado de ese día.');
    }
    return sinNumero(motivoSinUtilidad(p.Reason, r.Currency, p.Currency, p.ConfirmedAt));
  }
  const pct = p.Percent;
  const moneda = p.Currency || r.Currency;
  const negativa = p.Amount < 0;
  const n = (x: number) => x.toLocaleString('es-CL', { maximumFractionDigits: 2 });
  const restas = [p.SupplierCost].filter((x): x is number => x != null && x !== 0);
  const formula = `(${[r.TotalAmount, ...restas].map(n).join(' − ')}) ÷ ${n(r.TotalAmount)} = ${fmtPorcentaje(pct)}`;
  return {
    valor: fmtPorcentaje(pct),
    motivo: negativa ? `Pierde ${fmtMonto(moneda, -p.Amount)}` : `${fmtMonto(moneda, p.Amount)} después del costo ${p.Supplier ? `de ${p.Supplier}` : 'del guía'}`,
    negativa,
    formula,
  };
}

export interface FilaPescador extends HuespedItem {
  /** Solo las confirmadas, por fecha de llegada. */
  reservas: ReservaResumenItem[];
  proxima: ReservaResumenItem | null;
  /** La que abre la ficha: la próxima, o la más reciente si ya viajó. */
  abrir: ReservaResumenItem;
  yaViajo: boolean;
}

// Pescadores en CFF: solo quien tiene al menos una reserva confirmada. Una
// pendiente o cancelada no cuenta; quien ya viajó dentro de la ventana sigue,
// marcado.
export function pescadoresConfirmados(huespedes: HuespedItem[], reservas: ReservaResumenItem[], hoy: string): FilaPescador[] {
  const porHuesped = new Map<string, ReservaResumenItem[]>();
  for (const r of reservas) {
    if (!r.GuestID || r.Status !== 'CONFIRMED') continue;
    const lista = porHuesped.get(r.GuestID) ?? [];
    lista.push(r);
    porHuesped.set(r.GuestID, lista);
  }
  const filas: FilaPescador[] = [];
  for (const h of huespedes) {
    const suyas = (porHuesped.get(h.GuestID) ?? []).slice().sort((a, b) => a.CheckIn.localeCompare(b.CheckIn));
    if (suyas.length === 0) continue;
    const proxima = suyas.find((r) => r.CheckIn >= hoy) ?? null;
    filas.push({ ...h, reservas: suyas, proxima, abrir: proxima ?? suyas[suyas.length - 1], yaViajo: !proxima });
  }
  return filas;
}

export interface LlegadasProximas {
  confirmadas: ReservaResumenItem[];
  pendientes: number;
  /** La primera confirmada después del plazo, para el estado vacío. */
  siguiente: ReservaResumenItem | null;
}

export function llegadasProximas(reservas: ReservaResumenItem[], hoy: string, dias = 30): LlegadasProximas {
  // Igual que el backend (calcular_kpis): hoy <= CheckIn < hoy + 30.
  const hasta = sumarDias(hoy, dias);
  const porFecha = reservas.slice().sort((a, b) => a.CheckIn.localeCompare(b.CheckIn));
  const enPlazo = (r: ReservaResumenItem) => r.CheckIn >= hoy && r.CheckIn < hasta;
  return {
    confirmadas: porFecha.filter((r) => r.Status === 'CONFIRMED' && enPlazo(r)),
    pendientes: porFecha.filter((r) => r.Status === 'PENDING' && enPlazo(r)).length,
    siguiente: porFecha.find((r) => r.Status === 'CONFIRMED' && r.CheckIn >= hasta) ?? null,
  };
}

// Las notas llegan como texto libre desde el PMS o la web. Se parten por salto
// de línea y por los separadores que la gente escribe a mano (·, ;, viñetas)
// para listarlas (2026-08-11, pedido de Mato: «las notas deben quedar en
// bullets»). Compartida por BookingDetailModal y la ficha del pescador.
export function notasEnBullets(texto: string): string[] {
  return texto
    .split(/\r?\n|·|;/)
    .map((n) => n.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
}
