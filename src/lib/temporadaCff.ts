// Temporada real de pesca de Chile Fly Fishing: 12 de octubre - 30 de abril
// (cruza el límite de año calendario). 2026-08-06, pedido explícito de
// Mato: "el PMS debiera siempre mostrar el calendario, en el caso de
// chile fly fishing desde el 12 de octubre al 30 de abril". Estas fechas
// son un hecho de negocio propio de este cliente, no una regla genérica
// de "sin habitaciones" (eso es pmsRoomViews, un concepto distinto) - por
// eso esto se aplica por client_id, no por esa bandera.
export function temporadaActualCff(hoy: Date): { inicio: Date; fin: Date } {
  const anio = hoy.getFullYear();
  const finAbrilEsteAnio = new Date(anio, 3, 30);
  const inicioOctubreEsteAnio = new Date(anio, 9, 12);
  if (hoy <= finAbrilEsteAnio) {
    return { inicio: new Date(anio - 1, 9, 12), fin: finAbrilEsteAnio };
  }
  return { inicio: inicioOctubreEsteAnio, fin: new Date(anio + 1, 3, 30) };
}

export const CFF_CLIENT_ID = 'chile-fly-fishing';
