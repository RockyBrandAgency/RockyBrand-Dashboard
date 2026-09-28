import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// config.ts exige las VITE_* al importarse y la CI no tiene .env.
vi.mock('../config', () => ({
  DASHBOARD_API_URL: 'https://api.test',
  COGNITO_IDP_URL: 'https://idp.test/',
  COGNITO_CLIENT_ID: 'cliente-test',
  COGNITO_REGION: 'us-east-2',
  COGNITO_USER_POOL_ID: 'pool-test',
}));

import { getMe, getSemaforo, crearReserva, TimeoutError, UnauthorizedError } from './dashboardApi';
import { setStoredSession, getStoredSession } from './cognitoAuth';

const API = 'https://api.test';
const IDP = 'https://idp.test/';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function sesion(venceEnMs: number) {
  setStoredSession({
    idToken: 'token-viejo',
    accessToken: 'a',
    refreshToken: 'r',
    expiresAt: Date.now() + venceEnMs,
  });
}

const renovado = () =>
  json(200, { AuthenticationResult: { IdToken: 'token-nuevo', AccessToken: 'a2', ExpiresIn: 3600 } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const llamadasA = (base: string) => fetchMock.mock.calls.filter(([url]) => String(url).startsWith(base));

describe('reintentos', () => {
  it('un GET reintenta un 503 pasajero y devuelve el dato', async () => {
    vi.useFakeTimers();
    sesion(3_600_000);
    fetchMock
      .mockResolvedValueOnce(json(503, { error: 'Service Unavailable' }))
      .mockResolvedValueOnce(json(200, { client_id: 'x' }));

    const promesa = getMe();
    await vi.advanceTimersByTimeAsync(600);

    await expect(promesa).resolves.toEqual({ client_id: 'x' });
    expect(llamadasA(API)).toHaveLength(2);
  });

  it('un GET se rinde tras tres intentos sin red, con un mensaje en español', async () => {
    vi.useFakeTimers();
    sesion(3_600_000);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const promesa = getSemaforo();
    const esperado = expect(promesa).rejects.toThrow(/No se pudo conectar con el panel/);
    await vi.advanceTimersByTimeAsync(2_500);

    await esperado;
    expect(llamadasA(API)).toHaveLength(3);
  });

  it('un POST no se reintenta: repetirlo podría duplicar la reserva', async () => {
    sesion(3_600_000);
    fetchMock.mockResolvedValue(json(503, { error: 'Service Unavailable' }));

    await expect(crearReserva({} as never)).rejects.toThrow('Service Unavailable');
    expect(llamadasA(API)).toHaveLength(1);
  });

  it('un 4xx no se reintenta', async () => {
    sesion(3_600_000);
    fetchMock.mockResolvedValue(json(403, { error: 'no habilitado' }));

    await expect(getSemaforo()).rejects.toThrow('no habilitado');
    expect(llamadasA(API)).toHaveLength(1);
  });
});

describe('tiempo máximo', () => {
  it('una llamada colgada se corta a los 25 s y no se reintenta', async () => {
    vi.useFakeTimers();
    sesion(3_600_000);
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );

    const promesa = getMe();
    const esperado = expect(promesa).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(25_000);

    await esperado;
    expect(llamadasA(API)).toHaveLength(1);
  });
});

describe('sesión', () => {
  it('renueva ANTES de llamar si el token está por vencer', async () => {
    sesion(10_000);
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url === IDP ? renovado() : json(200, { ok: true })),
    );

    await getMe();

    expect(llamadasA(IDP)).toHaveLength(1);
    const [, init] = llamadasA(API)[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer token-nuevo' });
    expect(getStoredSession()?.idToken).toBe('token-nuevo');
  });

  it('tres llamadas simultáneas con 401 piden UN solo refresh', async () => {
    sesion(3_600_000);
    let idp = 0;
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (url === IDP) {
        idp += 1;
        return new Promise((r) => setTimeout(() => r(renovado()), 10));
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return Promise.resolve(auth === 'Bearer token-nuevo' ? json(200, { ok: true }) : json(401, {}));
    });

    await Promise.all([getMe(), getSemaforo(), getMe()]);

    expect(idp).toBe(1);
  });

  it('un refresh rechazado por Cognito termina en UnauthorizedError', async () => {
    sesion(3_600_000);
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url === IDP ? json(400, { __type: 'NotAuthorizedException' }) : json(401, {})),
    );

    await expect(getMe()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
