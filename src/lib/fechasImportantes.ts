// Cumpleaños y aniversarios: comparación por mes-día, ignorando el año.
// 2026-08-11, pedido de Mato ("fechas importantes (cumpleaños, aniversario)").
//
// El año se ignora a propósito y eso obliga a un cuidado que no es obvio: la
// ventana de "próximos N días" cruza el 31 de diciembre. Un cumpleaños el 3
// de enero tiene que aparecer el 28 de diciembre; comparar strings ISO daría
// que enero < diciembre y lo escondería justo cuando importa.

export interface FechaImportante {
  guestId: string;
  nombre: string;
  tipo: 'cumpleanos' | 'aniversario';
  /** La fecha original guardada (ISO), para mostrar el año si sirve. */
  fechaOriginal: string;
  /** El día en que cae este año/el próximo, ya resuelto. */
  proxima: Date;
  /** Días desde hoy (0 = hoy). */
  enDias: number;
  /** Cuántos cumple/celebra, si la fecha original trae un año creíble. */
  numero?: number;
}

function soloFecha(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * La próxima vez que cae un mes-día, a partir de `hoy` (incluido).
 * Devuelve null si la fecha no es una ISO válida.
 *
 * El 29 de febrero de un año no bisiesto se resuelve al 1 de marzo, que es
 * lo que hace el propio `Date` al desbordar. Se deja así a propósito: es
 * preferible saludar un día corrido a no saludar nunca.
 */
export function proximaOcurrencia(iso: string, hoy: Date): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const mes = Number(m[2]) - 1;
  const dia = Number(m[3]);
  if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return null;
  const base = soloFecha(hoy);
  const esteAnio = new Date(base.getFullYear(), mes, dia);
  return esteAnio >= base ? esteAnio : new Date(base.getFullYear() + 1, mes, dia);
}

export function diasHasta(fecha: Date, hoy: Date): number {
  return Math.round((soloFecha(fecha).getTime() - soloFecha(hoy).getTime()) / 86400000);
}

interface PersonaConFechas {
  GuestID: string;
  FullName: string;
  BirthDate?: string | null;
  AnniversaryDate?: string | null;
}

/**
 * Las fechas importantes que caen dentro de los próximos `dias` días,
 * ordenadas por cercanía. Una persona puede aportar dos (cumpleaños y
 * aniversario) y las dos entran por separado.
 */
export function fechasImportantesProximas(
  personas: PersonaConFechas[],
  hoy: Date,
  dias = 30
): FechaImportante[] {
  const out: FechaImportante[] = [];
  for (const p of personas) {
    const campos: [string | null | undefined, FechaImportante['tipo']][] = [
      [p.BirthDate, 'cumpleanos'],
      [p.AnniversaryDate, 'aniversario'],
    ];
    for (const [iso, tipo] of campos) {
      if (!iso) continue;
      const proxima = proximaOcurrencia(iso, hoy);
      if (!proxima) continue;
      const enDias = diasHasta(proxima, hoy);
      if (enDias < 0 || enDias > dias) continue;
      const anioOriginal = Number(iso.slice(0, 4));
      // Un año claramente de relleno (1900, o futuro) no se muestra como
      // "cumple 126": mejor no decir un número que decir uno absurdo.
      const numero =
        anioOriginal > 1920 && anioOriginal <= proxima.getFullYear()
          ? proxima.getFullYear() - anioOriginal
          : undefined;
      out.push({ guestId: p.GuestID, nombre: p.FullName, tipo, fechaOriginal: iso, proxima, enDias, numero });
    }
  }
  return out.sort((a, b) => a.enDias - b.enDias || a.nombre.localeCompare(b.nombre));
}

/** Lunes a domingo de la semana en la que cae `hoy` (convención es-CL). */
export function semanaDe(hoy: Date): { inicio: Date; fin: Date } {
  const base = soloFecha(hoy);
  const offset = (base.getDay() + 6) % 7; // 0 = lunes
  const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset);
  const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
  return { inicio, fin };
}

export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
