import { CFF_CLIENT_ID } from './temporadaCff';
import type { NavLeaf } from '../screens';

// Cómo se llaman las personas del PMS en cada cliente. 2026-08-11, pedido
// explícito de Mato en dos mensajes: "para el cliente chile fly fishing,
// solo para este cliente, la columna huésped se reemplaza por Angler, se
// quita la columna noches" y "Huespedes (para alto castillo), Pescadores
// para ChileFlyFishing".
//
// Las dos palabras de CFF son distintas a propósito y no un descuido: en
// la tabla la columna dice "Angler" (es el término que usan con sus
// clientes, en inglés) y el acceso del menú dice "Pescadores". Así lo
// pidió, textual.
//
// Va por client_id, igual que la temporada de pesca (temporadaCff.ts), y
// NO por la bandera pms_room_views: esa significa "este cliente no tiene
// habitaciones" y es un concepto distinto — un cliente sin habitaciones
// no es necesariamente un lodge de pesca.
export interface TerminologiaPms {
  /** Encabezado de la columna de la tabla de reservas. */
  columnaPersona: string;
  /** Nombre del acceso en el menú y título de la pantalla. */
  navPersonas: string;
  /** Para textos corridos ("Aún no hay pescadores cargados"). */
  personasMinuscula: string;
  /** CFF vende programas guiados por día, no alojamiento por noche. */
  mostrarNoches: boolean;
}

const CFF: TerminologiaPms = {
  columnaPersona: 'Angler',
  navPersonas: 'Pescadores',
  personasMinuscula: 'pescadores',
  mostrarNoches: false,
};

const GENERICO: TerminologiaPms = {
  columnaPersona: 'Huésped',
  navPersonas: 'Huéspedes',
  personasMinuscula: 'huéspedes',
  mostrarNoches: true,
};

export function terminologiaPms(clientId: string | null): TerminologiaPms {
  return clientId === CFF_CLIENT_ID ? CFF : GENERICO;
}

// El label de navegación de la pantalla de personas cambia por cliente;
// el resto de los items usa el suyo tal cual. Vive acá y no en screens.ts
// porque screens.ts es una tabla estática sin acceso al cliente logueado.
export function labelNav(item: NavLeaf, clientId: string | null, corto = false): string {
  if (item.id === 'servicio-pms-huespedes') return terminologiaPms(clientId).navPersonas;
  return corto ? item.shortLabel : item.label;
}
