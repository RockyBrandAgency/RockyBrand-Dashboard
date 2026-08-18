// Los sellos de tiempo del backend son UTC **sin la 'Z'**.
//
// Casi todo el PMS los escribe con `datetime.datetime.utcnow().isoformat()`
// (pms_lambda, pms_itinerario, crm_worker al anotar el vuelo), que produce
// "2026-08-17T23:41:07.912345": es UTC, pero no lo dice. `new Date()` sobre
// esa cadena la interpreta como hora LOCAL, así que en Chile el sello queda
// corrido varias horas hacia atrás sin que nada falle — el tipo de error que
// no se nota hasta que alguien compara dos horas y no le cuadran.
//
// Vive en un solo lugar para que la próxima pantalla que muestre un sello no
// vuelva a elegir mal. Si algún día el backend empieza a mandar la Z (o un
// offset), esto sigue funcionando: solo la agrega cuando falta.

export function fechaDesdeSelloUtc(iso: string): Date | null {
  if (!iso) return null;
  const normalizado = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(normalizado);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "17 ago 2026, 20:41" en hora de Chile. Devuelve la cadena cruda si no parsea. */
export function fmtSelloUtc(iso: string): string {
  const d = fechaDesdeSelloUtc(iso);
  if (!d) return iso;
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Igual que el anterior pero sin el año, para sellos recientes. */
export function fmtSelloUtcCorto(iso: string): string {
  const d = fechaDesdeSelloUtc(iso);
  if (!d) return iso;
  return d.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
