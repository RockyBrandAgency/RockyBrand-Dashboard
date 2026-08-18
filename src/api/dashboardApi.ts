import { DASHBOARD_API_URL } from '../config';
import { getStoredSession, refreshSession, SessionExpiredError } from './cognitoAuth';
import type {
  SemaforoResponse,
  LlegadasResponse,
  DisponibilidadResponse,
  MeResponse,
  ReservasResumenResponse,
  NuevaReservaPayload,
  NuevoHuespedPayload,
  HuespedesResponse,
  HousekeepingResponse,
  RoomState,
  ItinerariosResponse,
  ItinerarioDia,
  DiaItinerarioPayload,
  MetricsReportResponse,
  EmailContact,
  EmailSegment,
  EmailResumen,
  EmailCampaign,
  EmailTemplate,
  EmailMetrics,
  EmailInsights,
  EmailJourneysResponse,
  EmailImportResult,
  SubjectCheck,
  EmailPendientes,
  EmailCampaignDetalle,
  ContentPiecesResponse,
  ContentPiece,
  HorarioSugerido,
  StoreDashboardResumen,
  StoreProduct,
  StoreOrder,
  StoreGarantia,
  StoreGarantiaEstado,
  Agencia,
  AgenciaAcceso,
  AgenciaEstado,
  AgenciaFila,
  AgenciasResponse,
} from '../types';

// Misma clase / mismo criterio que 05-panel-web/src/api.ts: cualquier 401
// (o refresh fallido) burbujea como UnauthorizedError para que AuthContext
// fuerce logout y vuelva a la pantalla de login.
export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
  }
}

async function authedFetch(path: string, method: string, body?: unknown): Promise<Response> {
  const session = getStoredSession();
  if (!session) throw new UnauthorizedError();
  return fetch(`${DASHBOARD_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.idToken}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// El client_id SIEMPRE sale del claim del ID token en el backend (nunca de
// un parametro ni del body) - este cliente no manda ni podria mandar un
// client_id, ni falta que lo haga.
async function request<T>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
  let res = await authedFetch(path, method, body);

  if (res.status === 401) {
    try {
      await refreshSession();
    } catch (e) {
      if (e instanceof SessionExpiredError) throw new UnauthorizedError();
      throw e;
    }
    res = await authedFetch(path, method, body);
  }

  if (res.status === 401) throw new UnauthorizedError();

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Error de conexión con el dashboard.');
  }
  return data as T;
}

// Sin gate de `services` en el backend (a diferencia de las 3 de abajo) -
// el cliente necesita saber quien es y que tiene contratado incluso si CRM
// esta apagado, para que la UI muestre un estado explicito.
export function getMe(): Promise<MeResponse> {
  return request('/dashboard/me');
}

// El cliente sube su propio logo desde Configuración (pedido explícito de
// Mato, 2026-08-03) - logoDataUrl ya viene redimensionado/comprimido a
// data URL desde el frontend (ver SettingsScreen.tsx), acá solo se manda.
export function uploadClientLogo(logoDataUrl: string): Promise<{ ok: true }> {
  return request('/dashboard/logo', 'PUT', { logo_data_url: logoDataUrl });
}

export function getSemaforo(): Promise<SemaforoResponse> {
  return request('/dashboard/semaforo');
}

export function getLlegadas(): Promise<LlegadasResponse> {
  return request('/dashboard/llegadas');
}

export function getDisponibilidad(): Promise<DisponibilidadResponse> {
  return request('/dashboard/disponibilidad');
}

export function getReservasResumen(): Promise<ReservasResumenResponse> {
  return request('/dashboard/reservas-resumen');
}

// Edita fecha/notas de una reserva desde el detalle (2026-08-06, pedido
// explícito de Mato: click en una reserva → detalle → poder cambiar
// fechas). Solo manda los campos que cambiaron.
export function actualizarReserva(
  bookingId: string,
  cambios: { CheckIn?: string; CheckOut?: string; BookingNotes?: string }
): Promise<{ BookingID: string; message: string }> {
  return request(`/dashboard/reservas/${encodeURIComponent(bookingId)}`, 'PUT', cambios);
}

// Reserva manual (llamada/mail/walk-in) y su cancelación (2026-08-06,
// pedido explícito de Mato: "el PMS... debe ser capaz de agregar o
// eliminar reservas", para todos los clientes). "Eliminar" cancela
// (Status=CANCELLED), nunca borra el registro — confirmado con Mato.
export function crearReserva(payload: NuevaReservaPayload): Promise<{ BookingID: string; message: string }> {
  return request('/dashboard/reservas', 'POST', payload);
}

export function cancelarReserva(bookingId: string): Promise<{ BookingID: string; message: string }> {
  return request(`/dashboard/reservas/${encodeURIComponent(bookingId)}`, 'DELETE');
}

// "Ya pagó": PENDING -> CONFIRMED a mano, desde el detalle de la reserva
// (2026-08-17, pedido explícito de Mato). Es el mismo salto que hace el cobro
// de WeTravel y por eso NO manda ningún estado: el backend reusa
// wetravel_confirmacion.confirmar(), que escribe Status y gsi1sk juntos. El
// cliente no puede elegir a qué estado va - solo pide que se confirme.
//
// Ruta propia y no un PUT sobre la reserva: PUT edita campos, esto dispara
// una transición de estado con una condición sobre PENDING. Un 409 no es un
// error del panel, es la respuesta correcta cuando alguien más ya la confirmó
// (o el job la canceló) en el medio.
export function confirmarReserva(bookingId: string): Promise<{ BookingID: string; Status: string; message: string }> {
  return request(`/dashboard/reservas/${encodeURIComponent(bookingId)}/confirmar`, 'POST');
}

// Lista real de huespedes/pescadores del cliente (pantalla propia del
// PMS, 2026-08-11). Sale del mismo GSI1 que ya usa el panel de staff -
// ver listar_huespedes() en crm_dashboard_api_lambda.py.
export function getHuespedes(): Promise<HuespedesResponse> {
  return request('/dashboard/huespedes');
}

// Housekeeping (2026-08-11, pedido explícito de Mato). Solo responde para
// clientes con habitaciones (pms_room_views) - el gate real está en el
// backend, la UI además esconde el acceso.
export function getHousekeeping(fecha?: string): Promise<HousekeepingResponse> {
  return request(`/dashboard/housekeeping${fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''}`);
}

export function setRoomState(
  roomId: string,
  estado: RoomState,
  nota?: string
): Promise<{ RoomID: string; Estado: string; message: string }> {
  return request('/dashboard/housekeeping', 'PUT', { RoomID: roomId, Estado: estado, Nota: nota ?? '' });
}

// Fechas importantes del huésped (2026-08-11). Mandar '' borra la fecha;
// no mandar el campo lo deja como está.
export function actualizarHuesped(
  guestId: string,
  cambios: { BirthDate?: string; AnniversaryDate?: string }
): Promise<{ GuestID: string; message: string }> {
  return request(`/dashboard/huespedes/${encodeURIComponent(guestId)}`, 'PUT', cambios);
}

export function crearHuesped(payload: NuevoHuespedPayload): Promise<{ GuestID: string; message: string }> {
  return request('/dashboard/huespedes', 'POST', payload);
}

// Itinerarios (2026-08-17, pedido explícito de Mato). Una sola llamada trae
// TODAS las expediciones de la ventana del panel con sus días ya derivados
// por el backend: la pantalla no calcula qué días existen ni cuántas truchas
// suman - los dos números vienen calculados de un solo lado.
export function getItinerarios(bookingId?: string): Promise<ItinerariosResponse> {
  return request(`/dashboard/itinerarios${bookingId ? `?booking_id=${encodeURIComponent(bookingId)}` : ''}`);
}

// Reemplazo COMPLETO del día, no un merge parcial: el formulario manda los
// seis campos siempre, así que borrar un dato (vaciar una hora que se cargó
// mal) se guarda como cualquier otro cambio.
export function guardarDiaItinerario(payload: DiaItinerarioPayload): Promise<{ BookingID: string; dia: ItinerarioDia; message: string }> {
  return request('/dashboard/itinerarios', 'PUT', payload);
}

// "Vaciar", no "borrar": el backend reescribe el día en blanco y conserva el
// rastro de que ahí hubo algo. Un día vacío y uno inexistente se ven igual en
// pantalla, así que un borrado real no aportaría nada visible.
export function vaciarDiaItinerario(bookingId: string, fecha: string): Promise<{ BookingID: string; message: string }> {
  return request('/dashboard/itinerarios', 'DELETE', { BookingID: bookingId, Fecha: fecha });
}

export function getMetricsReport(days = 30): Promise<MetricsReportResponse> {
  return request(`/dashboard/metrics-report?days=${days}`);
}

// Público de Email Marketing + envío manual, desde el panel propio del
// cliente (2026-08-01, pedido explícito de Mato) - pantallas nuevas,
// mismo mecanismo de aislamiento (client_id siempre del JWT en el
// backend), nunca acceso a la herramienta de staff.
export function getEmailContacts(): Promise<{ client_id: string; contacts: EmailContact[] }> {
  return request('/dashboard/email/contacts');
}

export function upsertEmailContact(email: string, name: string, tags: string[]): Promise<{ ok: boolean }> {
  return request('/dashboard/email/contacts', 'POST', { email, name, tags });
}

export function deleteEmailContact(email: string): Promise<{ ok: boolean }> {
  return request('/dashboard/email/contacts', 'DELETE', { email });
}

export function sendTestEmail(subject: string, html_body: string, test_email: string): Promise<{ ok: boolean; enviado_a: string }> {
  return request('/dashboard/email/test-send', 'POST', { subject, html_body, test_email });
}

export function sendEmailNow(subject: string, html_body: string, segment: EmailSegment, name?: string): Promise<{ ok: boolean; campaign_id: string }> {
  return request('/dashboard/email/send', 'POST', { subject, html_body, segment, name });
}

// Las 6 secciones de Email Marketing (2026-08-03). Mismo backend compartido
// que el panel de staff: dos implementaciones distintas del mismo calculo
// terminan mostrando dos numeros distintos y nadie sabe cual creer.
export function getEmailResumen(): Promise<EmailResumen> {
  return request('/dashboard/email/resumen');
}

export function getEmailCampaigns(): Promise<{ campanas: EmailCampaign[] }> {
  return request('/dashboard/email/campaigns');
}

export function getEmailCampaign(id: string): Promise<{ campana: EmailCampaign }> {
  return request(`/dashboard/email/campaigns?campaign_id=${encodeURIComponent(id)}`);
}

export function saveEmailCampaign(campana: Partial<EmailCampaign>): Promise<{ ok: boolean; campaign_id: string; asunto: SubjectCheck }> {
  return request('/dashboard/email/campaigns', 'POST', campana);
}

export function deleteEmailCampaign(campaign_id: string): Promise<{ ok: boolean }> {
  return request('/dashboard/email/campaigns', 'DELETE', { campaign_id });
}

export function getEmailTemplates(): Promise<{ templates: EmailTemplate[] }> {
  return request('/dashboard/email/templates');
}

export function getEmailTemplate(id: string): Promise<{ template: EmailTemplate }> {
  return request(`/dashboard/email/templates?template_id=${encodeURIComponent(id)}`);
}

export function saveEmailTemplate(t: Partial<EmailTemplate>): Promise<{ ok: boolean; template_id: string }> {
  return request('/dashboard/email/templates', 'POST', t);
}

export function deleteEmailTemplate(template_id: string): Promise<{ ok: boolean }> {
  return request('/dashboard/email/templates', 'DELETE', { template_id });
}

export function getEmailMetrics(): Promise<EmailMetrics> {
  return request('/dashboard/email/metrics');
}

export function getEmailInsights(): Promise<EmailInsights> {
  return request('/dashboard/email/insights');
}

export function getEmailJourneys(): Promise<EmailJourneysResponse> {
  return request('/dashboard/email/journeys');
}

export function toggleEmailJourney(track_id: string, activo: boolean): Promise<{ ok: boolean }> {
  return request('/dashboard/email/journeys', 'POST', { track_id, activo });
}

export function deleteEmailJourney(track_id: string): Promise<{ ok: boolean }> {
  return request('/dashboard/email/journeys', 'DELETE', { track_id });
}

// vista_previa=true no escribe nada: devuelve el informe de que pasaria.
// Importar una base sucia es la principal fuente de rebotes duros, y la
// cuenta de SES es COMPARTIDA entre todos los clientes - una base mala de
// uno le sube el bounce rate a todos.
export function importEmailCsv(csv: string, vista_previa: boolean): Promise<EmailImportResult> {
  return request('/dashboard/email/import', 'POST', { csv, vista_previa });
}


// ------------------------------- aprobación de contenido de redes --

export async function getContentPieces(filtros?: {
  estado?: string; plataforma?: string; desde?: string; hasta?: string;
}): Promise<ContentPiecesResponse> {
  const qs = new URLSearchParams();
  Object.entries(filtros || {}).forEach(([k, v]) => { if (v) qs.set(k, v); });
  const sufijo = qs.toString() ? `?${qs}` : '';
  return request<ContentPiecesResponse>(`/dashboard/content/pieces${sufijo}`, 'GET');
}

export async function getHorarioSugerido(): Promise<HorarioSugerido> {
  return request<HorarioSugerido>('/dashboard/content/timing', 'GET');
}

export async function aprobarPieza(pieceId: string, comentario = ''):
  Promise<{ ok: boolean; pieza: ContentPiece; arte_solicitada: boolean }> {
  return request(`/dashboard/content/pieces/${encodeURIComponent(pieceId)}/approve`, 'POST', { comentario });
}

// El comentario es obligatorio y lo valida el backend, no esta función: una
// regla que vive solo en el cliente se la saltea cualquier otro llamador.
export async function rechazarPieza(pieceId: string, comentario: string):
  Promise<{ ok: boolean; pieza: ContentPiece }> {
  return request(`/dashboard/content/pieces/${encodeURIComponent(pieceId)}/reject`, 'POST', { comentario });
}

// Mismo calculo que el panel de staff, no una copia: el backend lo resuelve
// en un modulo compartido para que un contacto no salga vencido en un panel
// y a tiempo en el otro.
export function getEmailPendientes(): Promise<EmailPendientes> {
  return request('/dashboard/email/pendientes');
}

// El detalle con destinatarios uno por uno. Sale por la misma ruta que la
// campana, con ?detalle=1: es el mismo recurso visto con mas profundidad, no
// otro distinto.
export function getEmailCampaignDetalle(id: string): Promise<EmailCampaignDetalle> {
  return request(`/dashboard/email/campaigns?detalle=1&campaign_id=${encodeURIComponent(id)}`);
}

export function scheduleEmailCampaign(campaign_id: string, scheduled_at: string): Promise<{ ok: boolean }> {
  return request('/dashboard/email/campaigns', 'POST', { accion: 'programar', campaign_id, scheduled_at });
}

// ===== Tienda =====
// Exclusiva de este cliente (chile-fly-fishing) - el backend igual revalida
// el client_id del JWT antes de invocar store-admin-api, esto no es la
// unica barrera. `activo` es el interruptor real de "sacar/agregar" un
// modelo: no hay DeleteItem sobre productos (se perderia el historial de
// ordenes que los referencian), asi que "quitar" es desactivar - eso ya
// saca al SKU de /public/productos, no solo lo deja en $0 de stock.

export function getTiendaResumen(): Promise<StoreDashboardResumen> {
  return request('/dashboard/tienda/resumen');
}

export function getTiendaProductos(): Promise<{ productos: StoreProduct[]; umbral_stock_bajo: number }> {
  return request('/dashboard/tienda/productos');
}

// stock_actual_esperado: bloqueo optimista. Cuando se edita stock, se manda
// el valor que la pantalla tenía cargado - si una venta real lo cambió en
// el medio, el backend rechaza con 409 en vez de pisarlo en silencio (ver
// store_admin_lambda.py). precio_clp/activo no lo necesitan.
export function actualizarTiendaProducto(
  sku: string,
  cambios: { precio_clp?: number; stock?: number; activo?: boolean; stock_actual_esperado?: number }
): Promise<{ ok: boolean }> {
  return request('/dashboard/tienda/productos', 'PUT', { sku, ...cambios });
}

export function getTiendaPedidos(estado?: string): Promise<{ ordenes: StoreOrder[] }> {
  return request(`/dashboard/tienda/pedidos${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`);
}

export function getTiendaPedidoDetalle(orderId: string): Promise<{ orden: StoreOrder }> {
  return request(`/dashboard/tienda/pedidos/${encodeURIComponent(orderId)}`);
}

// Garantias. `veces_usada` NO viene guardado en cada solicitud: lo calcula el
// backend sobre todas las del mismo correo, para que el numero siga siendo
// correcto aunque se borre una. Ver store_admin_lambda._listar_garantias.
export function getTiendaGarantias(): Promise<{ garantias: StoreGarantia[] }> {
  return request('/dashboard/tienda/garantias');
}

// Mover una garantía de estado. El backend valida que el id sea de una
// garantía y no de una venta: mandar el id de una orden por acá no le escribe
// un estado de garantía encima a un pedido real.
export function actualizarTiendaGarantia(
  solicitud_id: string,
  estado: StoreGarantiaEstado,
  nota?: string,
): Promise<{ ok: boolean }> {
  return request('/dashboard/tienda/garantias', 'PUT', { solicitud_id, estado, nota });
}

// ------------------------------------------------------------- agencias --
// Portal B2B. Este cliente NUNCA manda un precio ni un agency_id de sesión:
// el precio lo calcula el servidor con la tarifa de la agencia y el
// agency_id de una URL de administración va siempre acompañado del claim
// del lodge, que es lo que acota qué agencias existen.

export function getAgencias(): Promise<AgenciasResponse> {
  return request('/dashboard/agencias');
}

export function getAgencia(agencyId: string): Promise<{ agencia: Agencia; accesos: AgenciaAcceso[] }> {
  return request(`/dashboard/agencias/${encodeURIComponent(agencyId)}`);
}

export interface AgenciaPayload {
  AgencyID?: string;
  Nombre?: string;
  Moneda?: 'CLP' | 'USD';
  Estado?: AgenciaEstado;
  Contacto?: { Nombre?: string; Email?: string; Telefono?: string };
  MinNoches?: number;
  SuplementoMediaPension?: number | null;
  Notas?: string;
  Tarifas?: Record<string, number>;
}

export function crearAgencia(payload: AgenciaPayload): Promise<{ agencia: Agencia }> {
  return request('/dashboard/agencias', 'POST', payload);
}

// Mergea sobre lo guardado: lo que no se manda se conserva. No hace falta
// reenviar la agencia entera para cambiar un precio.
export function actualizarAgencia(agencyId: string, payload: AgenciaPayload): Promise<{ agencia: Agencia }> {
  return request(`/dashboard/agencias/${encodeURIComponent(agencyId)}`, 'PUT', payload);
}

// La clave temporal viene UNA vez en esta respuesta y no se guarda en
// ningún lado. Si se pierde, se resetea.
export function crearAccesoAgencia(agencyId: string, email: string):
  Promise<{ email: string; clave_temporal: string; aviso: string }> {
  return request(`/dashboard/agencias/${encodeURIComponent(agencyId)}/acceso`, 'POST', { email });
}

export function gestionarAccesoAgencia(
  agencyId: string,
  email: string,
  accion: 'resetear' | 'deshabilitar' | 'habilitar',
): Promise<{ email: string; accion: string; clave_temporal?: string }> {
  return request(`/dashboard/agencias/${encodeURIComponent(agencyId)}/acceso`, 'PUT', { email, accion });
}

export function getAgenciasReporte(desde?: string, hasta?: string): Promise<{ agencias: AgenciaFila[] }> {
  const qs = new URLSearchParams();
  if (desde) qs.set('desde', desde);
  if (hasta) qs.set('hasta', hasta);
  const cola = qs.toString();
  return request(`/dashboard/agencias/reporte${cola ? `?${cola}` : ''}`);
}
