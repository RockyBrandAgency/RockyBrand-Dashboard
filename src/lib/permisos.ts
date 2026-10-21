/**
 * Rol del usuario en el panel y qué acciones le muestra la interfaz.
 *
 * Decisión de Mato (2026-10-20): tres grupos de Cognito, que llegan en el
 * claim `cognito:groups` del ID token. QUIEN AUTORIZA ES EL SERVIDOR: esto
 * solo esconde o deshabilita lo que el rol no puede, para no ofrecer un botón
 * que va a terminar en 403. Si el servidor dice 403 igual, la pantalla
 * muestra su mensaje (ver SinPermisoError en api/dashboardApi.ts).
 *
 * Usuario sin grupo de cliente = admin, mientras dura la migración: las
 * cuentas que existen hoy no tienen grupo y no pueden perder nada al
 * desplegar esto antes de que se les asigne uno.
 */

export type Rol = 'lectura' | 'editor' | 'admin';

const GRUPOS: Record<string, Rol> = {
  'cliente-lectura': 'lectura',
  'cliente-editor': 'editor',
  'cliente-admin': 'admin',
};

// Si alguien quedara en dos grupos, manda el de MENOS permisos: un error de
// asignación no debe abrir más de lo que se quiso dar.
const ORDEN: Rol[] = ['lectura', 'editor', 'admin'];

/** El rol que dicen los claims del ID token. */
export function rolDesdeClaims(claims: Record<string, unknown>): Rol {
  const grupos = claims['cognito:groups'];
  const lista = Array.isArray(grupos) ? grupos : typeof grupos === 'string' ? [grupos] : [];
  const roles = lista.map((g) => (typeof g === 'string' ? GRUPOS[g] : undefined)).filter((r): r is Rol => !!r);
  if (roles.length === 0) return 'admin';
  return roles.reduce((menor, r) => (ORDEN.indexOf(r) < ORDEN.indexOf(menor) ? r : menor));
}

/**
 * Acciones que cambian algo. Ver la información no es una acción: lo ve
 * cualquier rol.
 */
export type Accion =
  // Editor y admin
  | 'pms.operar' // reservas, huéspedes, housekeeping, itinerarios, confirmar
  | 'tienda.editar' // productos y garantías (crear, editar, papelera)
  | 'email.borrador' // guardar borradores de campaña
  | 'email.plantillas' // crear, editar y borrar plantillas
  | 'email.prueba' // envío de prueba
  | 'contenido.revisar' // aprobar o rechazar piezas
  | 'subidas' // Berry Studio
  // Solo admin
  | 'email.enviar' // enviar ahora
  | 'email.programar' // programar campañas
  | 'email.campanas.borrar' // borrar una campaña, también un borrador (DELETE /dashboard/email/campaigns)
  | 'email.journeys' // activar, pausar y borrar automatizaciones
  | 'email.contactos' // importar, crear y borrar contactos
  | 'logo'
  | 'agencias'
  | 'tienda.garantias.borrar' // borrar para siempre desde la papelera
  | 'tienda.garantias.notificar'; // aviso de despacho por WhatsApp

const DE_EDITOR: ReadonlySet<Accion> = new Set<Accion>([
  'pms.operar',
  'tienda.editar',
  'email.borrador',
  'email.plantillas',
  'email.prueba',
  'contenido.revisar',
  'subidas',
]);

export function puede(rol: Rol, accion: Accion): boolean {
  if (rol === 'admin') return true;
  if (rol === 'editor') return DE_EDITOR.has(accion);
  return false;
}

export const NOMBRE_ROL: Record<Rol, string> = {
  lectura: 'Lectura',
  editor: 'Editor',
  admin: 'Administrador',
};

/** Texto para el `title` o la nota de un control deshabilitado por rol. */
export function motivoSinPermiso(rol: Rol): string {
  return `Tu rol (${NOMBRE_ROL[rol]}) no permite esta acción. Pídesela a un administrador de tu cuenta.`;
}
