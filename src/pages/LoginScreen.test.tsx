import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({
  DASHBOARD_API_URL: 'https://api.test',
  COGNITO_IDP_URL: 'https://idp.test/',
  COGNITO_CLIENT_ID: 'cliente-test',
  COGNITO_REGION: 'us-east-2',
  COGNITO_USER_POOL_ID: 'pool-test',
}));

vi.mock('../api/dashboardApi', async (original) => ({
  ...(await original<typeof import('../api/dashboardApi')>()),
  getMe: async () => ({ client_id: 'cliente-test', display_name: 'Cliente Test', display_subtitle: '', services: {}, pms_room_views: false, logo_data_url: null }),
}));

import { AuthProvider } from '../context/AuthContext';
import { LoginScreen } from './LoginScreen';
import { getStoredSession } from '../api/cognitoAuth';

const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const idToken = b64({ alg: 'none' }) + '.' + b64({ email: 'qa@example.test' }) + '.f';
const tokens = { AuthenticationResult: { IdToken: idToken, AccessToken: 'a', RefreshToken: 'r', ExpiresIn: 3600 } };
const mfa = { ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 's-1', ChallengeParameters: { USER_ID_FOR_SRP: 'u-1' } };
const error = (tipo: string): [number, unknown] => [400, { __type: tipo, message: tipo }];

let root: Root | null = null;
let contenedor: HTMLDivElement | null = null;
let cola: Record<string, [number, unknown][]>;

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  sessionStorage.clear();
  cola = {};
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
    const target = String((init.headers as Record<string, string>)['X-Amz-Target']).split('.').pop()!;
    const [status, body] = cola[target]?.shift() ?? [503, {}];
    return new Response(JSON.stringify(body), { status });
  }));
});

afterEach(() => {
  act(() => root?.unmount());
  contenedor?.remove();
});

const $ = <T extends Element>(sel: string) => contenedor!.querySelector<T>(sel);
const boton = (texto: string) => [...contenedor!.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)!;
async function escribir(input: HTMLInputElement, valor: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { set.call(input, valor); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function enviar(texto: string) {
  await act(async () => { boton(texto).click(); });
  await act(async () => {});
}

async function montarYEntrar() {
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  await act(async () => { root!.render(<AuthProvider><LoginScreen /></AuthProvider>); });
  await escribir($('input[placeholder="tu@correo.cl"]')!, 'qa@example.test');
  await escribir($('input[placeholder="••••••••"]')!, 'clave');
  await enviar('Ingresar al Panel');
}
const campoCodigo = () => $<HTMLInputElement>('input[autocomplete="one-time-code"]');

describe('pantalla de login con verificación en dos pasos', () => {
  it('código incorrecto: avisa y sigue en el paso del código; el correcto guarda la sesión', async () => {
    cola = { InitiateAuth: [[200, mfa]], RespondToAuthChallenge: [error('CodeMismatchException'), [200, tokens]] };
    await montarYEntrar();
    expect(campoCodigo()).not.toBeNull();

    await escribir(campoCodigo()!, '000000');
    await enviar('Verificar y entrar');
    expect(campoCodigo()).not.toBeNull();
    expect($('[role="alert"]')?.textContent).toBeTruthy();
    expect(getStoredSession()).toBeNull();

    await escribir(campoCodigo()!, '123456');
    await enviar('Verificar y entrar');
    expect(getStoredSession()?.idToken).toBe(idToken);
  });

  it('sesión del desafío vencida: vuelve al formulario de correo con el aviso', async () => {
    cola = { InitiateAuth: [[200, mfa]], RespondToAuthChallenge: [error('NotAuthorizedException')] };
    await montarYEntrar();
    await escribir(campoCodigo()!, '123456');
    await enviar('Verificar y entrar');
    expect(campoCodigo()).toBeNull();
    expect($('input[placeholder="tu@correo.cl"]')).not.toBeNull();
    expect(contenedor!.textContent).toContain('Este inicio de sesión ya no es válido');
    expect(getStoredSession()).toBeNull();
  });
});
