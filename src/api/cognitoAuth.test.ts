import { beforeEach, describe, expect, it, vi } from 'vitest';

// config.ts exige las VITE_* al importarse y la CI no tiene .env.
vi.mock('../config', () => ({
  DASHBOARD_API_URL: 'https://api.test',
  COGNITO_IDP_URL: 'https://idp.test/',
  COGNITO_CLIENT_ID: 'cliente-test',
  COGNITO_REGION: 'us-east-2',
  COGNITO_USER_POOL_ID: 'pool-test',
}));

import {
  alCambiarSesion, CodigoIncorrectoError, completarInscripcionEnLogin, getStoredSession, iniciarInscripcionEnLogin,
  login, LoginError, refreshSession, responderCodigoMfa, responderNuevaClave, SesionDeLoginVencidaError,
  SessionExpiredError, setStoredSession, type DesafioLogin,
} from './cognitoAuth';

const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const idToken = b64({ alg: 'none' }) + '.' + b64({ email: 'qa@example.test', 'custom:client_id': 'demo' }) + '.f';
const tokens = { AuthenticationResult: { IdToken: idToken, AccessToken: 'acc', RefreshToken: 'ref', ExpiresIn: 3600 } };

type Respuesta = [number, unknown];
let fetchMock: ReturnType<typeof vi.fn>;
let llamadas: { target: string; body: Record<string, unknown> }[];

/** Simula Cognito: cada X-Amz-Target responde lo que diga `cola` en orden. */
function cognito(cola: Record<string, Respuesta[]>) {
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
    const target = String((init.headers as Record<string, string>)['X-Amz-Target']).split('.').pop()!;
    llamadas.push({ target, body: JSON.parse(String(init.body)) });
    const [status, body] = cola[target]?.shift() ?? [400, { __type: 'InvalidParameterException', message: 'no esperado' }];
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/x-amz-json-1.1' } });
  });
}
const error = (tipo: string, message = tipo): Respuesta => [400, { __type: tipo, message }];

beforeEach(() => {
  sessionStorage.clear();
  llamadas = [];
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('login', () => {
  it('sin MFA entra directo y guarda la sesión como antes', async () => {
    cognito({ InitiateAuth: [[200, tokens]] });
    const r = await login(' QA@Example.test ', 'clave');
    expect(r.tipo).toBe('listo');
    expect(getStoredSession()?.idToken).toBe(idToken);
    expect(llamadas[0].body).toMatchObject({ AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: 'qa@example.test' } });
  });

  it('NotAuthorizedException en el login es «Correo o contraseña inválidos»', async () => {
    cognito({ InitiateAuth: [error('NotAuthorizedException', 'Incorrect username or password.')] });
    await expect(login('qa@example.test', 'mala')).rejects.toThrow('Correo o contraseña inválidos.');
    expect(getStoredSession()).toBeNull();
  });
});

describe('desafíos', () => {
  const mfa = { ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 's-1', ChallengeParameters: { USER_ID_FOR_SRP: 'u-1' } };

  it('SOFTWARE_TOKEN_MFA: código incorrecto avisa sin salir del paso; el correcto entra', async () => {
    cognito({ InitiateAuth: [[200, mfa]], RespondToAuthChallenge: [error('CodeMismatchException'), [200, tokens]] });
    const d = await login('qa@example.test', 'clave');
    expect(d).toMatchObject({ tipo: 'codigo', session: 's-1', usuario: 'u-1' });
    await expect(responderCodigoMfa(d as DesafioLogin, '000000')).rejects.toBeInstanceOf(CodigoIncorrectoError);
    expect(getStoredSession()).toBeNull();
    const r = await responderCodigoMfa(d as DesafioLogin, '123456');
    expect(r.tipo).toBe('listo');
    expect(llamadas.at(-1)!.body).toMatchObject({ ChallengeName: 'SOFTWARE_TOKEN_MFA', ChallengeResponses: { USERNAME: 'u-1', SOFTWARE_TOKEN_MFA_CODE: '123456' } });
  });

  it('MFA_SETUP: asocia, verifica y responde con la sesión de VerifySoftwareToken', async () => {
    cognito({
      InitiateAuth: [[200, { ChallengeName: 'MFA_SETUP', Session: 's-1', ChallengeParameters: {} }]],
      AssociateSoftwareToken: [[200, { SecretCode: 'CLAVEDEPRUEBA234', Session: 's-2' }]],
      VerifySoftwareToken: [[200, { Status: 'SUCCESS', Session: 's-3' }]],
      RespondToAuthChallenge: [[200, tokens]],
    });
    const d = await login('qa@example.test', 'clave');
    expect(d.tipo).toBe('inscribir');
    const { secreto, desafio } = await iniciarInscripcionEnLogin(d as DesafioLogin);
    expect(secreto).toBe('CLAVEDEPRUEBA234');
    const r = await completarInscripcionEnLogin(desafio, '123456');
    expect(r.tipo).toBe('listo');
    expect(llamadas.map((l) => l.target)).toEqual(['InitiateAuth', 'AssociateSoftwareToken', 'VerifySoftwareToken', 'RespondToAuthChallenge']);
    expect(llamadas.at(-1)!.body).toMatchObject({ ChallengeName: 'MFA_SETUP', Session: 's-3' });
  });

  it('NEW_PASSWORD_REQUIRED: manda la clave nueva y entra', async () => {
    cognito({
      InitiateAuth: [[200, { ChallengeName: 'NEW_PASSWORD_REQUIRED', Session: 's-1', ChallengeParameters: { requiredAttributes: '[]', userAttributes: '{}' } }]],
      RespondToAuthChallenge: [[200, tokens]],
    });
    const d = await login('qa@example.test', 'temporal');
    expect(d).toMatchObject({ tipo: 'nueva-clave', usuario: 'qa@example.test' });
    const r = await responderNuevaClave(d as DesafioLogin, 'Nueva-Clave-123');
    expect(r.tipo).toBe('listo');
    expect(llamadas.at(-1)!.body).toMatchObject({ ChallengeName: 'NEW_PASSWORD_REQUIRED', ChallengeResponses: { NEW_PASSWORD: 'Nueva-Clave-123' } });
  });

  it('sesión del desafío inválida: error propio, sin afirmar que pasaron 3 minutos', async () => {
    cognito({ InitiateAuth: [[200, mfa]], RespondToAuthChallenge: [error('NotAuthorizedException', 'Invalid session for the user.')] });
    const d = await login('qa@example.test', 'clave');
    const e = await responderCodigoMfa(d as DesafioLogin, '123456').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(SesionDeLoginVencidaError);
    expect(e).toBeInstanceOf(LoginError);
    expect((e as Error).message).toMatch(/venció o se cerró después de un código incorrecto/);
    expect((e as Error).message).not.toMatch(/Pasaron más de 3 minutos/);
  });
});

describe('renovación', () => {
  it('con corte de red lanza el error de red, no SessionExpiredError (no cierra la sesión)', async () => {
    setStoredSession({ idToken, accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() - 1 });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const e = await refreshSession().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(TypeError);
    expect(e).not.toBeInstanceOf(SessionExpiredError);
    expect(getStoredSession()).not.toBeNull();
  });

  it('al guardar un token nuevo avisa a quien sigue la sesión (el rol se recalcula)', async () => {
    setStoredSession({ idToken, accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() - 1 });
    const oyente = vi.fn();
    const soltar = alCambiarSesion(oyente);
    cognito({ InitiateAuth: [[200, { AuthenticationResult: { IdToken: 'otro.e30.f', AccessToken: 'a2', ExpiresIn: 3600 } }]] });
    await refreshSession();
    soltar();
    expect(oyente).toHaveBeenCalled();
    expect(getStoredSession()?.idToken).toBe('otro.e30.f');
  });
});
