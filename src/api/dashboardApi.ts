import { DASHBOARD_API_URL } from '../config';
import { getStoredSession, refreshSession, SessionExpiredError } from './cognitoAuth';
import type {
  SemaforoResponse,
  LlegadasResponse,
  DisponibilidadResponse,
  MeResponse,
  ReservasResumenResponse,
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
