import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { login as cognitoLogin, getStoredSession, clearStoredSession, decodeIdTokenClaims, LoginError } from '../api/cognitoAuth';
import { getMe, UnauthorizedError } from '../api/dashboardApi';
import { leerPerfilCacheado, guardarPerfilCacheado, borrarPerfilCacheado } from '../api/perfilCache';
import { applyClientTheme, applyClientTitle, CLIENT_BRANDING, clientIdFromHostname } from '../branding';
import type { ClientFeatures, ClientServices, MeResponse } from '../types';

interface AuthContextValue {
  isAuthenticated: boolean;
  userEmail: string;
  loginError: string | null;
  sessionExpiredMessage: string | null;
  isLoggingIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  handleUnauthorized: () => void;
  // Identidad + servicios REALES del cliente logueado (rockybrand-client-config,
  // vía GET /dashboard/me) - cada cliente entra a SU panel, no al panel
  // global de staff, así que el sidebar/branding se arma con esto, nunca
  // con un nombre hardcodeado. null mientras carga.
  clientDisplayName: string | null;
  clientDisplaySubtitle: string;
  clientServices: ClientServices | null;
  // Terminología de personas del cliente (ver MeResponse.terminologia).
  // Viaja por el contexto y no se lee de un módulo suelto para que el
  // sidebar y las pantallas se redibujen cuando llega /dashboard/me.
  clientTerminologia: MeResponse['terminologia'];
  // Logo real del cliente logueado, en sus 2 variantes (mismo criterio que
  // ya usaba LoginScreen con CLIENT_BRANDING: "Light" para fondo claro -
  // Sidebar -, "Dark" para fondo oscuro/de marca - MobileBar). El que subió
  // desde Configuración (rockybrand-client-config.logo_data_url) tiene
  // prioridad y se usa para AMBAS variantes (es un solo archivo, no hay
  // par claro/oscuro de una subida del cliente) - si no hay uno, cada
  // variante cae a su equivalente estático de branding.ts. null si
  // ninguno de los dos existe todavía.
  //
  // Bug real encontrado con Playwright antes de este cambio (2026-08-03):
  // un solo `clientLogoSrc` compartido usaba siempre logoSrcDark - el
  // logo de Alto Castillo es blanco/transparente (invisible sobre blanco,
  // ver el comentario de CLIENT_BRANDING), y el Sidebar tiene fondo
  // blanco, así que el logo real de Alto Castillo desaparecía por completo
  // ahí (el MobileBar, con fondo --primary oscuro, sí lo mostraba bien -
  // por eso el bug no se notaba antes: el Sidebar nunca había usado el
  // logo real todavía).
  clientLogoSrcLight: string | null;
  clientLogoSrcDark: string | null;
  // client_id real (no el subdominio) - lo necesitan componentes que
  // varían por cliente pero no tienen su propio branding (ej.
  // WeatherWidget, ubicación real). null mientras carga.
  clientId: string | null;
  // false para un cliente sin habitaciones (ej. Chile Fly Fishing, que
  // vende programas de pesca guiados) - Overview.tsx lo usa para no
  // mostrarle "Ocupación de Habitaciones". true mientras carga (mismo
  // criterio "nunca esconder por un falso negativo" que clientServices).
  pmsRoomViews: boolean;
  // Sub-opciones dentro de cada servicio contratado (qué pantallas del PMS
  // y qué pestañas de Email Marketing ve este cliente), tal como las dejó
  // el panel de staff. null mientras carga Y también cuando la Lambda
  // desplegada es anterior a que existieran: los dos casos significan "no
  // sé", y no saber nunca esconde una pantalla.
  features: ClientFeatures | null;
  // SettingsScreen la llama después de subir un logo nuevo, para que el
  // Sidebar/MobileBar lo reflejen sin esperar a un remount de toda la app.
  setUploadedLogo: (src: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * El client_id que dice el ID token, o null si no hay sesión.
 *
 * Se lee para UNA sola cosa: comprobar que quien entra a
 * {cliente}.panel.rockybrand.cl sea de ESE cliente. No autoriza nada — el
 * aislamiento de datos lo sigue haciendo el backend con el claim del JWT en
 * cada request, y el authorizer de API Gateway lo valida de verdad.
 */
function clientIdDeLaSesion(): string | null {
  const session = getStoredSession();
  if (!session) return null;
  const claim = decodeIdTokenClaims(session.idToken)['custom:client_id'];
  return typeof claim === 'string' && claim ? claim : null;
}

/**
 * Quién NO puede quedarse en este subdominio: el usuario de otro cliente.
 *
 * Hasta el 2026-09-08, entrar a karibu-safari-africa.panel.rockybrand.cl con
 * la cuenta de Alto Castillo abría el panel de Alto Castillo entero —su
 * marca, sus métricas, sus campañas— bajo la URL de Karibu. Los datos eran
 * los correctos para ese token (el backend nunca se equivocó), pero la
 * pantalla afirmaba algo falso: que ese era el panel de Karibu. Quien mira no
 * tiene forma de saber cuál de las dos cosas creer.
 *
 * En localhost o en la URL por defecto de Amplify no hay subdominio que
 * comparar: `clientIdFromHostname` devuelve null y esto no bloquea nada.
 */
function clienteEquivocado(): string | null {
  const delHost = clientIdFromHostname(window.location.hostname);
  if (!delHost) return null;
  const deLaSesion = clientIdDeLaSesion();
  if (!deLaSesion || deLaSesion === delHost) return null;
  return deLaSesion;
}

function readUserEmail(): string {
  const session = getStoredSession();
  if (!session) return '';
  const claims = decodeIdTokenClaims(session.idToken);
  return typeof claims.email === 'string' ? claims.email : '';
}

// Perfil de la carga anterior de esta misma pestaña, si lo hay (ver
// api/perfilCache.ts). Es lo que evita que recargar la página deje el panel
// esperando a /dashboard/me con un menú que todavía no es de nadie.
function perfilInicial(): MeResponse | null {
  const session = getStoredSession();
  return session ? leerPerfilCacheado(session.idToken) : null;
}

// Se evalúa al cargar el módulo, ANTES de que el estado inicial de
// `isAuthenticated` borre la sesión ajena: después ya no habría qué leer para
// poder explicarle a la persona qué pasó.
const clienteEquivocadoRecordado = clienteEquivocado();

export function AuthProvider({ children }: { children: ReactNode }) {
  // Una sesión de otro cliente puede venir ya abierta en esta pestaña
  // (sessionStorage) y entonces nunca pasa por login. Se descarta ACÁ, en el
  // estado inicial, para que el panel no llegue a montarse con ella.
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const ajeno = clienteEquivocado();
    if (ajeno) {
      clearStoredSession();
      borrarPerfilCacheado();
      return false;
    }
    return !!getStoredSession();
  });
  const [userEmail, setUserEmail] = useState(readUserEmail);
  // Se muestra en el login cuando la sesión que había era de otro cliente:
  // sin esto, la pantalla vuelve al formulario sin decir por qué y parece
  // que la sesión se cayó sola.
  const [loginError, setLoginError] = useState<string | null>(() => {
    const ajeno = clienteEquivocadoRecordado;
    return ajeno
      ? `Cerramos la sesión de ${ajeno}: este es el panel de otro cliente. ` +
        `Entra en ${ajeno}.panel.rockybrand.cl, o inicia sesión con la cuenta de este panel.`
      : null;
  });
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  // Los inicializadores lazy corren UNA vez, antes del primer render: si hay
  // perfil recordado, el primer pixel que se pinta ya es el del cliente
  // correcto. Si no lo hay (primera carga de la pestaña), todo arranca en
  // null igual que siempre y las pantallas muestran su esqueleto.
  const [clientDisplayName, setClientDisplayName] = useState<string | null>(() => perfilInicial()?.display_name ?? null);
  const [clientDisplaySubtitle, setClientDisplaySubtitle] = useState(() => perfilInicial()?.display_subtitle ?? '');
  const [clientServices, setClientServices] = useState<ClientServices | null>(() => perfilInicial()?.services ?? null);
  const [clientLogoSrcLight, setClientLogoSrcLight] = useState<string | null>(() => {
    const me = perfilInicial();
    return me ? me.logo_data_url ?? CLIENT_BRANDING[me.client_id]?.logoSrcLight ?? null : null;
  });
  const [clientLogoSrcDark, setClientLogoSrcDark] = useState<string | null>(() => {
    const me = perfilInicial();
    return me ? me.logo_data_url ?? CLIENT_BRANDING[me.client_id]?.logoSrcDark ?? null : null;
  });
  const [clientId, setClientId] = useState<string | null>(() => perfilInicial()?.client_id ?? null);
  const [pmsRoomViews, setPmsRoomViews] = useState(() => perfilInicial()?.pms_room_views ?? true);
  const [clientTerminologia, setClientTerminologia] = useState<MeResponse['terminologia']>(() => perfilInicial()?.terminologia ?? null);
  const [features, setFeatures] = useState<ClientFeatures | null>(() => perfilInicial()?.features ?? null);

  const setUploadedLogo = useCallback((src: string) => {
    setClientLogoSrcLight(src);
    setClientLogoSrcDark(src);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      borrarPerfilCacheado();
      setClientDisplayName(null);
      setClientDisplaySubtitle('');
      setClientServices(null);
      // También `features`: son la configuración de ESE cliente. Dejarlas
      // puestas al desloguear las arrastraría a la sesión siguiente.
      setFeatures(null);
      setClientLogoSrcLight(null);
      setClientLogoSrcDark(null);
      setClientId(null);
      return;
    }
    // El theme y el título del cliente recordado se aplican YA, sin esperar la
    // respuesta: si no, la primera carga pinta el panel con la paleta neutra
    // de RockyBrand y recién después toma el color del cliente. Es el mismo
    // salto de identidad que el del menú, en color.
    const recordado = perfilInicial();
    if (recordado) {
      applyClientTheme(recordado.client_id);
      applyClientTitle(recordado.client_id);
    }
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        const sesion = getStoredSession();
        if (sesion) guardarPerfilCacheado(sesion.idToken, me);
        setClientDisplayName(me.display_name);
        setClientDisplaySubtitle(me.display_subtitle);
        setClientServices(me.services);
        setClientLogoSrcLight(me.logo_data_url ?? CLIENT_BRANDING[me.client_id]?.logoSrcLight ?? null);
        setClientLogoSrcDark(me.logo_data_url ?? CLIENT_BRANDING[me.client_id]?.logoSrcDark ?? null);
        setClientId(me.client_id);
        setPmsRoomViews(me.pms_room_views);
        setClientTerminologia(me.terminologia ?? null);
        setFeatures(me.features ?? null);
        // Solo SETEA acá, nunca resetea (ver la rama !isAuthenticated de
        // arriba) - si reseteara en cada mount, pisaría el theme que
        // LoginScreen ya aplicó por subdominio antes del login (efectos
        // de hijos corren antes que los del padre, AuthProvider envuelve
        // a LoginScreen). El reset real pasa solo al volver a esa
        // pantalla (mount fresco, mismo mecanismo por hostname).
        applyClientTheme(me.client_id);
        applyClientTitle(me.client_id);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof UnauthorizedError) {
          clearStoredSession();
          borrarPerfilCacheado();
          setIsAuthenticated(false);
          setUserEmail('');
          setSessionExpiredMessage('Tu sesión expiró, inicia sesión de nuevo.');
          return;
        }
        // Sin datos de servicios el sidebar no puede filtrar nada real -
        // se queda cargando en vez de mostrar/esconder algo por error de
        // red transitorio (mismo criterio que 05-panel-web).
        console.error('Error cargando el perfil del cliente', e);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    setSessionExpiredMessage(null);
    try {
      await cognitoLogin(email, password);
      // La sesión existe y es válida, pero puede no ser de ESTE panel. Se
      // descarta antes de dar por iniciada la sesión: así nadie llega a ver
      // un panel que no le corresponde ni siquiera un instante.
      const ajeno = clienteEquivocado();
      if (ajeno) {
        clearStoredSession();
        borrarPerfilCacheado();
        setLoginError(
          `Esa cuenta es de otro cliente. Entra en ${ajeno}.panel.rockybrand.cl, ` +
          'o inicia sesión con la cuenta de este panel.',
        );
        return;
      }
      setIsAuthenticated(true);
      setUserEmail(readUserEmail());
    } catch (e) {
      setLoginError(e instanceof LoginError ? e.message : 'No se pudo iniciar sesión.');
      throw e;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    borrarPerfilCacheado();
    setIsAuthenticated(false);
    setUserEmail('');
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearStoredSession();
    borrarPerfilCacheado();
    setIsAuthenticated(false);
    setUserEmail('');
    setSessionExpiredMessage('Tu sesión expiró, inicia sesión de nuevo.');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userEmail,
        loginError,
        sessionExpiredMessage,
        isLoggingIn,
        login,
        logout,
        handleUnauthorized,
        clientDisplayName,
        clientDisplaySubtitle,
        clientServices,
        clientTerminologia,
        clientLogoSrcLight,
        clientLogoSrcDark,
        clientId,
        pmsRoomViews,
        features,
        setUploadedLogo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
