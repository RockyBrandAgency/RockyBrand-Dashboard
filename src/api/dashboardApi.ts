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
