import type { Acompanante, BorradorAcompanante } from '../types';

// Acompañantes de una reserva (2026-10-05, pedido de Mato: "vienen pescadores
// solos y otros con su señora"). Estas reglas repiten las de
// pms_models.validar_acompanantes para avisar antes de mandar; el servidor
// sigue siendo el que decide y su mensaje se muestra tal cual si rechaza.
export const LIMITES_ACOMPANANTE = {
  maxPorReserva: 20,
  nombre: 80,
  alergia: 300,
  notas: 1000,
} as const;

const NACIMIENTO_MINIMO = '1900-01-01';

export const BORRADOR_VACIO: BorradorAcompanante = {
  FirstName: '',
  LastName: '',
  BirthDate: null,
  FoodAllergy: false,
  FoodAllergyDetail: '',
  Notes: '',
};

/** La fecha local como AAAA-MM-DD (no toISOString, que convierte a UTC). */
export function isoLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function esFechaReal(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d;
}

/** El primer problema del borrador, en palabras para quien lo carga; null si está bien. */
export function errorDeAcompanante(b: BorradorAcompanante, hoy: Date = new Date()): string | null {
  const nombre = b.FirstName.trim();
  if (!nombre) return 'Falta el nombre.';
  if (nombre.length > LIMITES_ACOMPANANTE.nombre) return `El nombre admite hasta ${LIMITES_ACOMPANANTE.nombre} caracteres.`;
  if (b.LastName.trim().length > LIMITES_ACOMPANANTE.nombre) {
    return `El apellido admite hasta ${LIMITES_ACOMPANANTE.nombre} caracteres.`;
  }
  if (b.BirthDate) {
    if (!esFechaReal(b.BirthDate)) return 'La fecha de nacimiento no es válida.';
    if (b.BirthDate > isoLocal(hoy)) return 'La fecha de nacimiento no puede ser posterior a hoy.';
    if (b.BirthDate < NACIMIENTO_MINIMO) return 'La fecha de nacimiento no es válida.';
  }
  if (b.FoodAllergy && !b.FoodAllergyDetail.trim()) return 'Indica a qué tiene alergia.';
  if (b.FoodAllergyDetail.trim().length > LIMITES_ACOMPANANTE.alergia) {
    return `El detalle de la alergia admite hasta ${LIMITES_ACOMPANANTE.alergia} caracteres.`;
  }
  if (b.Notes.trim().length > LIMITES_ACOMPANANTE.notas) {
    return `Las notas admiten hasta ${LIMITES_ACOMPANANTE.notas} caracteres.`;
  }
  return null;
}

/** Lo que se manda al servidor: sin espacios sobrantes y sin detalle de alergia huérfano. */
export function normalizarBorrador(b: BorradorAcompanante): BorradorAcompanante {
  return {
    ...(b.CompanionID ? { CompanionID: b.CompanionID } : {}),
    FirstName: b.FirstName.trim(),
    LastName: b.LastName.trim(),
    BirthDate: b.BirthDate || null,
    FoodAllergy: b.FoodAllergy,
    FoodAllergyDetail: b.FoodAllergy ? b.FoodAllergyDetail.trim() : '',
    Notes: b.Notes.trim(),
  };
}

/** Años cumplidos a la fecha `en`; null si no hay fecha válida. */
export function edad(nacimiento: string | null, en: Date = new Date()): number | null {
  if (!nacimiento || !esFechaReal(nacimiento)) return null;
  const [a, m, d] = nacimiento.split('-').map(Number);
  let anos = en.getFullYear() - a;
  if (en.getMonth() + 1 < m || (en.getMonth() + 1 === m && en.getDate() < d)) anos -= 1;
  return anos >= 0 ? anos : null;
}

export function nombreCompleto(a: Pick<Acompanante, 'FirstName' | 'LastName'>): string {
  return [a.FirstName, a.LastName].filter(Boolean).join(' ');
}
