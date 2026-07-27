import { COGNITO_IDP_URL, COGNITO_CLIENT_ID } from '../config';

const SESSION_STORAGE_KEY = 'rockybrandDashboardSession';

export interface StoredSession {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Credenciales invalidas al hacer login - mostrar mensaje, NO cerrar sesion
// (no habia sesion todavia).
export class LoginError extends Error {}

// El refresh token murio (vencido o revocado) - forzar logout completo.
export class SessionExpiredError extends Error {}

interface CognitoAuthResult {
  AccessToken: string;
  IdToken: string;
  RefreshToken?: string;
  ExpiresIn: number;
}

// Los __type de error de Cognito a veces vienen con prefijo de namespace
// (ej. "aws.cognito#NotAuthorizedException") - nos quedamos solo con el
// nombre real del tipo, tolerante a esa variabilidad documentada.
function extractErrorType(type: unknown): string {
  if (typeof type !== 'string') return '';
  const idx = Math.max(type.lastIndexOf('#'), type.lastIndexOf(':'));
  return idx >= 0 ? type.slice(idx + 1) : type;
}

// Llamada cruda a la API JSON de Cognito Identity Provider - sin SDK, sin
// firma SigV4 (InitiateAuth/RespondToAuthChallenge son operaciones publicas
// pensadas para clientes sin credenciales AWS embebidas). Confirmado contra
// el comportamiento real de la API en la Sesion 1 (mismo shape que devuelve
// `aws cognito-idp initiate-auth` por CLI).
async function cognitoRequest(target: string, body: Record<string, unknown>): Promise<CognitoAuthResult> {
  const res = await fetch(COGNITO_IDP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorType = extractErrorType(data.__type);
    const message = typeof data.message === 'string' ? data.message : 'Error de autenticación.';
    if (target === 'InitiateAuth' && body.AuthFlow === 'REFRESH_TOKEN_AUTH') {
      throw new SessionExpiredError(message);
    }
    if (errorType === 'NotAuthorizedException' || errorType === 'UserNotFoundException') {
      throw new LoginError('Correo o contraseña inválidos.');
    }
    throw new LoginError(message);
  }
  return (data.AuthenticationResult ?? data) as CognitoAuthResult;
}

function toStoredSession(result: CognitoAuthResult, previousRefreshToken?: string): StoredSession {
  const refreshToken = result.RefreshToken ?? previousRefreshToken;
  if (!refreshToken) throw new Error('Cognito no devolvió refresh token.');
  return {
    idToken: result.IdToken,
    accessToken: result.AccessToken,
    refreshToken,
    expiresAt: Date.now() + result.ExpiresIn * 1000,
  };
}

export async function login(email: string, password: string): Promise<StoredSession> {
  const result = await cognitoRequest('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  const session = toStoredSession(result);
  setStoredSession(session);
  return session;
}

// REFRESH_TOKEN_AUTH nunca rota el refresh token (no se habilito rotacion
// en el app client) - el mismo refresh token sigue siendo valido hasta sus
// 30 dias o revocacion explicita.
export async function refreshSession(): Promise<StoredSession> {
  const current = getStoredSession();
  if (!current) throw new SessionExpiredError('No hay sesión guardada.');
  const result = await cognitoRequest('InitiateAuth', {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: { REFRESH_TOKEN: current.refreshToken },
  });
  const session = toStoredSession(result, current.refreshToken);
  setStoredSession(session);
  return session;
}

export function getStoredSession(): StoredSession | null {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function setStoredSession(session: StoredSession): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

// Decodifica el ID token SOLO para mostrar datos en la UI (email, etc) -
// nunca se usa esto para autorizar nada, la validacion real ya la hizo el
// JWT authorizer de API Gateway del lado del servidor.
export function decodeIdTokenClaims(idToken: string): Record<string, unknown> {
  try {
    const payload = idToken.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}
