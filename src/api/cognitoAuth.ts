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

// El codigo de 6 digitos no coincide (CodeMismatchException o, al inscribir,
// EnableSoftwareTokenMFAException). Se queda en el mismo paso para reintentar.
export class CodigoIncorrectoError extends LoginError {}

// La sesion de un desafio (MFA o clave nueva) dura 3 minutos (AuthSessionValidity
// del app client). Vencida, Cognito responde NotAuthorizedException y lo unico
// que sirve es volver a empezar con correo y contrasena.
export class SesionDeLoginVencidaError extends LoginError {}

// El refresh token murio (vencido o revocado) - forzar logout completo.
export class SessionExpiredError extends Error {}

interface CognitoAuthResult {
  AccessToken: string;
  IdToken: string;
  RefreshToken?: string;
  ExpiresIn: number;
}

// Respuesta de InitiateAuth / RespondToAuthChallenge: o trae los tokens o
// trae un desafio que hay que responder (2026-10-20, MFA del panel).
interface RespuestaAuth {
  AuthenticationResult?: CognitoAuthResult;
  ChallengeName?: string;
  ChallengeParameters?: Record<string, string>;
  Session?: string;
}

// Los __type de error de Cognito a veces vienen con prefijo de namespace
// (ej. "aws.cognito#NotAuthorizedException") - nos quedamos solo con el
// nombre real del tipo, tolerante a esa variabilidad documentada.
function extractErrorType(type: unknown): string {
  if (typeof type !== 'string') return '';
  const idx = Math.max(type.lastIndexOf('#'), type.lastIndexOf(':'));
  return idx >= 0 ? type.slice(idx + 1) : type;
}

// Cognito explica la politica de claves en ingles ("Password must have
// uppercase characters"). Se traduce lo que se reconoce y, si no, se dice en
// general que no cumple: el mensaje en ingles no le sirve al cliente.
function claveNoCumple(message: string): string {
  const m = message.toLowerCase();
  const faltas: string[] = [];
  if (m.includes('uppercase')) faltas.push('una mayúscula');
  if (m.includes('lowercase')) faltas.push('una minúscula');
  if (m.includes('numeric') || m.includes('number')) faltas.push('un número');
  if (m.includes('symbol')) faltas.push('un símbolo');
  const largo = /length greater than or equal to (\d+)/.exec(m)?.[1] ?? (m.includes('long enough') ? '' : null);
  if (largo !== null) faltas.push(largo ? `al menos ${largo} caracteres` : 'más caracteres');
  if (m.includes('previous') || m.includes('history')) return 'La contraseña nueva no puede ser una que ya usaste.';
  return faltas.length
    ? `La contraseña nueva necesita ${faltas.join(', ')}.`
    : 'La contraseña nueva no cumple los requisitos de seguridad. Usa una más larga, con mayúsculas, minúsculas, números y símbolos.';
}

// Contexto de la llamada: el mismo NotAuthorizedException significa "clave
// equivocada" en el login y "se acabaron los 3 minutos" en un desafio.
type Contexto = 'login' | 'refresh' | 'desafio' | 'sesion';

function errorDeCognito(errorType: string, message: string, contexto: Contexto): Error {
  if (contexto === 'refresh') return new SessionExpiredError(message);
  switch (errorType) {
    case 'CodeMismatchException':
    case 'EnableSoftwareTokenMFAException':
      return new CodigoIncorrectoError('El código no es correcto. Escribe el que muestra ahora tu app de autenticación.');
    case 'ExpiredCodeException':
      return new CodigoIncorrectoError('Ese código ya se usó o venció. Espera el siguiente en tu app y escríbelo.');
    case 'InvalidPasswordException':
    case 'PasswordHistoryPolicyViolationException':
      return new LoginError(claveNoCumple(message));
    case 'TooManyRequestsException':
    case 'LimitExceededException':
    case 'TooManyFailedAttemptsException':
      return new LoginError('Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar.');
    case 'PasswordResetRequiredException':
      return new LoginError('Tu contraseña debe restablecerse. Pide a RockyBrand una clave temporal nueva.');
    case 'UserNotConfirmedException':
      return new LoginError('Tu cuenta todavía no está confirmada. Escríbele a RockyBrand.');
    case 'SoftwareTokenMFANotFoundException':
      return new LoginError('La verificación en dos pasos no está disponible para esta cuenta. Escríbele a RockyBrand.');
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      if (contexto === 'desafio') {
        // Cognito responde lo mismo si la sesión del desafío venció (dura 3
        // minutos) o si la invalidó tras un código incorrecto: no se puede
        // saber cuál de las dos fue, así que el mensaje cubre ambas.
        return new SesionDeLoginVencidaError('Este inicio de sesión ya no es válido: venció o se cerró después de un código incorrecto. Vuelve a empezar con tu correo y contraseña.');
      }
      if (contexto === 'sesion') return new SessionExpiredError(message);
      return new LoginError('Correo o contraseña inválidos.');
    default:
      return new LoginError('No se pudo completar el paso. Intenta de nuevo en un momento.');
  }
}

// Llamada cruda a la API JSON de Cognito Identity Provider - sin SDK, sin
// firma SigV4. InitiateAuth, RespondToAuthChallenge, AssociateSoftwareToken,
// VerifySoftwareToken, GetUser y SetUserMFAPreference son operaciones
// publicas: se autorizan con la Session del desafio o con el AccessToken del
// usuario, nunca con IAM (API Reference de cada una, consultada 2026-10-20).
// El app client no tiene secreto: hoy el login funciona sin SECRET_HASH.
async function cognitoCall<T>(target: string, body: Record<string, unknown>, contexto: Contexto): Promise<T> {
  let res: Response;
  try {
    res = await fetch(COGNITO_IDP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Un corte de red al renovar NO es una sesión muerta: se relanza tal cual
    // y dashboardApi lo trata como transitorio, igual que antes.
    if (contexto === 'refresh') throw e;
    throw new LoginError('No se pudo conectar. Revisa tu conexión e intenta de nuevo.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data.message === 'string' ? data.message : '';
    throw errorDeCognito(extractErrorType(data.__type), message, contexto);
  }
  return data as T;
}

function toStoredSession(result: CognitoAuthResult, previousRefreshToken?: string): StoredSession {
  const refreshToken = result.RefreshToken ?? previousRefreshToken;
  if (!refreshToken) throw new LoginError('No se pudo iniciar sesión. Intenta de nuevo.');
  return {
    idToken: result.IdToken,
    accessToken: result.AccessToken,
    refreshToken,
    expiresAt: Date.now() + result.ExpiresIn * 1000,
  };
}

/**
 * Lo que falta para entrar. `session` es la de Cognito (dura 3 minutos) y
 * `usuario` es el USERNAME que piden las respuestas a desafios.
 */
export type DesafioLogin =
  | { tipo: 'codigo'; session: string; usuario: string }
  | { tipo: 'inscribir'; session: string; usuario: string }
  | { tipo: 'nueva-clave'; session: string; usuario: string };

export type ResultadoLogin = { tipo: 'listo'; session: StoredSession } | DesafioLogin;

// Convierte la respuesta de Cognito en el siguiente paso. Con MFA OPTIONAL y
// el usuario sin TOTP, llegan los tokens directo; con TOTP inscrito,
// SOFTWARE_TOKEN_MFA; con MFA ON y sin factor, MFA_SETUP; con clave temporal,
// NEW_PASSWORD_REQUIRED. SELECT_MFA_TYPE solo aparece con mas de un factor
// activo: el pool solo tiene TOTP, asi que se elige ese sin preguntar.
async function siguientePaso(r: RespuestaAuth, usuarioTipeado: string): Promise<ResultadoLogin> {
  if (r.AuthenticationResult) {
    const session = toStoredSession(r.AuthenticationResult);
    setStoredSession(session);
    return { tipo: 'listo', session };
  }
  const session = r.Session ?? '';
  // USER_ID_FOR_SRP es el username real cuando se entra con el correo como
  // alias; si no viene, sirve el mismo correo que se tipeo. Va solo en
  // ChallengeResponses: puede ser un UUID, así que la pantalla (cuenta del QR)
  // usa el correo escrito, no este valor.
  const usuario = r.ChallengeParameters?.USER_ID_FOR_SRP || r.ChallengeParameters?.USERNAME || usuarioTipeado;
  switch (r.ChallengeName) {
    case 'SOFTWARE_TOKEN_MFA':
      return { tipo: 'codigo', session, usuario };
    case 'MFA_SETUP':
    case 'SOFTWARE_TOKEN_SETUP':
      return { tipo: 'inscribir', session, usuario };
    case 'NEW_PASSWORD_REQUIRED': {
      // Si el pool exigiera atributos que la cuenta no tiene, este panel no
      // los pide: se dice claro en vez de fallar con un error de Cognito.
      let requeridos: unknown = [];
      try {
        requeridos = JSON.parse(r.ChallengeParameters?.requiredAttributes ?? '[]');
      } catch {
        requeridos = [];
      }
      if (Array.isArray(requeridos) && requeridos.length > 0) {
        throw new LoginError('Tu cuenta necesita datos que este panel no pide. Escríbele a RockyBrand.');
      }
      return { tipo: 'nueva-clave', session, usuario };
    }
    case 'SELECT_MFA_TYPE': {
      const r2 = await cognitoCall<RespuestaAuth>('RespondToAuthChallenge', {
        ClientId: COGNITO_CLIENT_ID,
        ChallengeName: 'SELECT_MFA_TYPE',
        Session: session,
        ChallengeResponses: { USERNAME: usuario, ANSWER: 'SOFTWARE_TOKEN_MFA' },
      }, 'desafio');
      return siguientePaso(r2, usuarioTipeado);
    }
    default:
      throw new LoginError('Tu cuenta pide un paso de seguridad que este panel no maneja. Escríbele a RockyBrand.');
  }
}

// El USERNAME de Cognito es sensible a mayusculas: "Info@..." con la I
// grande responde UserNotFoundException, que aca se traduce a "Correo o
// contraseña inválidos" - o sea el cliente ve el mismo mensaje que si se
// hubiera equivocado de clave, con la credencial correcta escrita. Pasa
// solo, sin que nadie haga nada raro: el teclado del telefono capitaliza la
// primera letra, y el correo con las credenciales se copia y pega tal cual
// venga escrito. Se normaliza aca y no en la pantalla para que cubra a
// cualquier otro punto de entrada. Todas las cuentas del pool son correos
// en minuscula, asi que bajar el caso no puede dejar a nadie afuera.
export async function login(email: string, password: string): Promise<ResultadoLogin> {
  const usuario = email.trim().toLowerCase();
  const r = await cognitoCall<RespuestaAuth>('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: { USERNAME: usuario, PASSWORD: password },
  }, 'login');
  return siguientePaso(r, usuario);
}

/** Responde el código TOTP de 6 dígitos (desafío SOFTWARE_TOKEN_MFA). */
export async function responderCodigoMfa(d: DesafioLogin, codigo: string): Promise<ResultadoLogin> {
  const r = await cognitoCall<RespuestaAuth>('RespondToAuthChallenge', {
    ClientId: COGNITO_CLIENT_ID,
    ChallengeName: 'SOFTWARE_TOKEN_MFA',
    Session: d.session,
    ChallengeResponses: { USERNAME: d.usuario, SOFTWARE_TOKEN_MFA_CODE: codigo },
  }, 'desafio');
  return siguientePaso(r, d.usuario);
}

/** Cambia la clave temporal (desafío NEW_PASSWORD_REQUIRED). */
export async function responderNuevaClave(d: DesafioLogin, nuevaClave: string): Promise<ResultadoLogin> {
  const r = await cognitoCall<RespuestaAuth>('RespondToAuthChallenge', {
    ClientId: COGNITO_CLIENT_ID,
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    Session: d.session,
    ChallengeResponses: { USERNAME: d.usuario, NEW_PASSWORD: nuevaClave },
  }, 'desafio');
  return siguientePaso(r, d.usuario);
}

/**
 * Inscripción obligatoria (MFA_SETUP), paso 1: pide el secreto a Cognito.
 * El secreto vive solo en memoria de la pantalla: no se guarda, no se
 * registra en consola y no sale a ningún servicio (el QR se dibuja local).
 */
export async function iniciarInscripcionEnLogin(d: DesafioLogin): Promise<{ secreto: string; desafio: DesafioLogin }> {
  const r = await cognitoCall<{ SecretCode: string; Session?: string }>('AssociateSoftwareToken', { Session: d.session }, 'desafio');
  return { secreto: r.SecretCode, desafio: { ...d, session: r.Session ?? d.session } };
}

/**
 * Inscripción obligatoria, paso 2: verifica el primer código y cierra el
 * desafío MFA_SETUP. Cognito puede pedir enseguida un SOFTWARE_TOKEN_MFA.
 */
export async function completarInscripcionEnLogin(d: DesafioLogin, codigo: string): Promise<ResultadoLogin> {
  const v = await cognitoCall<{ Status?: string; Session?: string }>('VerifySoftwareToken', {
    Session: d.session,
    UserCode: codigo,
    FriendlyDeviceName: 'Panel RockyBrand',
  }, 'desafio');
  if (v.Status !== 'SUCCESS') throw new CodigoIncorrectoError('El código no es correcto. Escribe el que muestra ahora tu app de autenticación.');
  const r = await cognitoCall<RespuestaAuth>('RespondToAuthChallenge', {
    ClientId: COGNITO_CLIENT_ID,
    ChallengeName: 'MFA_SETUP',
    Session: v.Session ?? d.session,
    ChallengeResponses: { USERNAME: d.usuario },
  }, 'desafio');
  return siguientePaso(r, d.usuario);
}

// ----------------------------------------------- MFA con sesión iniciada --

export interface EstadoMfa {
  activo: boolean;
}

/** Lee si el usuario ya tiene TOTP (GetUser → UserMFASettingList). */
export async function leerEstadoMfa(): Promise<EstadoMfa> {
  const s = await sesionVigente();
  if (!s) throw new SessionExpiredError('No hay sesión guardada.');
  const r = await cognitoCall<{ UserMFASettingList?: string[] }>('GetUser', { AccessToken: s.accessToken }, 'sesion');
  return { activo: (r.UserMFASettingList ?? []).includes('SOFTWARE_TOKEN_MFA') };
}

/** Inscripción voluntaria, paso 1: secreto nuevo para la cuenta en sesión. */
export async function iniciarInscripcionVoluntaria(): Promise<string> {
  const s = await sesionVigente();
  if (!s) throw new SessionExpiredError('No hay sesión guardada.');
  const r = await cognitoCall<{ SecretCode: string }>('AssociateSoftwareToken', { AccessToken: s.accessToken }, 'sesion');
  return r.SecretCode;
}

/** Inscripción voluntaria, paso 2: verifica el código y deja TOTP como preferido. */
export async function completarInscripcionVoluntaria(codigo: string): Promise<void> {
  const s = await sesionVigente();
  if (!s) throw new SessionExpiredError('No hay sesión guardada.');
  const v = await cognitoCall<{ Status?: string }>('VerifySoftwareToken', {
    AccessToken: s.accessToken,
    UserCode: codigo,
    FriendlyDeviceName: 'Panel RockyBrand',
  }, 'sesion');
  if (v.Status !== 'SUCCESS') throw new CodigoIncorrectoError('El código no es correcto. Escribe el que muestra ahora tu app de autenticación.');
  await cognitoCall('SetUserMFAPreference', {
    AccessToken: s.accessToken,
    SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
  }, 'sesion');
}

// Una sola renovación a la vez (2026-09-28). Al abrir una pantalla salen 2-3
// llamadas juntas; con el token vencido, cada una recibía su 401 y pedía su
// propio refresh a Cognito. Ahora la segunda se cuelga de la primera.
let renovacionEnCurso: Promise<StoredSession> | null = null;

export function refreshSession(): Promise<StoredSession> {
  if (!renovacionEnCurso) {
    renovacionEnCurso = renovar().finally(() => {
      renovacionEnCurso = null;
    });
  }
  return renovacionEnCurso;
}

// Margen para renovar ANTES de que venza: el ID token dura una hora, y
// esperar el 401 costaba tres idas y vueltas por llamada (el 401, el refresh
// y el reintento).
const MARGEN_RENOVACION_MS = 60_000;

export async function sesionVigente(): Promise<StoredSession | null> {
  const session = getStoredSession();
  if (!session) return null;
  if (session.expiresAt - Date.now() > MARGEN_RENOVACION_MS) return session;
  return refreshSession();
}

// REFRESH_TOKEN_AUTH nunca rota el refresh token (no se habilito rotacion
// en el app client) - el mismo refresh token sigue siendo valido hasta sus
// 30 dias o revocacion explicita.
async function renovar(): Promise<StoredSession> {
  const current = getStoredSession();
  if (!current) throw new SessionExpiredError('No hay sesión guardada.');
  const r = await cognitoCall<RespuestaAuth>('InitiateAuth', {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: { REFRESH_TOKEN: current.refreshToken },
  }, 'refresh');
  if (!r.AuthenticationResult) throw new SessionExpiredError('Cognito no devolvió tokens.');
  const session = toStoredSession(r.AuthenticationResult, current.refreshToken);
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

// Quien muestra datos del ID token (el rol) se entera cuando la sesión cambia,
// también cuando renovar() guarda un token nuevo sin pasar por la pantalla.
const oyentesSesion = new Set<() => void>();

export function alCambiarSesion(oyente: () => void): () => void {
  oyentesSesion.add(oyente);
  return () => oyentesSesion.delete(oyente);
}

function avisarCambioSesion(): void {
  for (const oyente of oyentesSesion) oyente();
}

export function setStoredSession(session: StoredSession): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  avisarCambioSesion();
}

export function clearStoredSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  avisarCambioSesion();
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
