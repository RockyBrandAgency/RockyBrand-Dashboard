import { DASHBOARD_API_URL } from '../config';
import { getStoredSession, refreshSession, SessionExpiredError } from './cognitoAuth';
import type { SemaforoResponse, LlegadasResponse, DisponibilidadResponse, MeResponse } from '../types';

// Misma clase / mismo criterio que 05-panel-web/src/api.ts: cualquier 401
// (o refresh fallido) burbujea como UnauthorizedError para que AuthContext
// fuerce logout y vuelva a la pantalla de login.
export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
  }
}

async function authedFetch(path: string): Promise<Response> {
  const session = getStoredSession();
  if (!session) throw new UnauthorizedError();
  return fetch(`${DASHBOARD_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.idToken}` },
  });
}

// El client_id SIEMPRE sale del claim del ID token en el backend (nunca de
// un parametro) - este cliente no manda ni podria mandar un client_id, ni
// falta que lo haga.
async function request<T>(path: string): Promise<T> {
  let res = await authedFetch(path);

  if (res.status === 401) {
    try {
      await refreshSession();
    } catch (e) {
      if (e instanceof SessionExpiredError) throw new UnauthorizedError();
      throw e;
    }
    res = await authedFetch(path);
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
