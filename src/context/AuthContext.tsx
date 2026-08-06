import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { login as cognitoLogin, getStoredSession, clearStoredSession, decodeIdTokenClaims, LoginError } from '../api/cognitoAuth';
import { getMe, UnauthorizedError } from '../api/dashboardApi';
import { applyClientTheme, applyClientTitle, CLIENT_BRANDING } from '../branding';
import type { ClientServices } from '../types';

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
  // SettingsScreen la llama después de subir un logo nuevo, para que el
  // Sidebar/MobileBar lo reflejen sin esperar a un remount de toda la app.
  setUploadedLogo: (src: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readUserEmail(): string {
  const session = getStoredSession();
  if (!session) return '';
  const claims = decodeIdTokenClaims(session.idToken);
  return typeof claims.email === 'string' ? claims.email : '';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getStoredSession());
  const [userEmail, setUserEmail] = useState(readUserEmail);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [clientDisplayName, setClientDisplayName] = useState<string | null>(null);
  const [clientDisplaySubtitle, setClientDisplaySubtitle] = useState('');
  const [clientServices, setClientServices] = useState<ClientServices | null>(null);
  const [clientLogoSrcLight, setClientLogoSrcLight] = useState<string | null>(null);
  const [clientLogoSrcDark, setClientLogoSrcDark] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [pmsRoomViews, setPmsRoomViews] = useState(true);

  const setUploadedLogo = useCallback((src: string) => {
    setClientLogoSrcLight(src);
    setClientLogoSrcDark(src);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setClientDisplayName(null);
      setClientDisplaySubtitle('');
      setClientServices(null);
      setClientLogoSrcLight(null);
      setClientLogoSrcDark(null);
      setClientId(null);
      return;
    }
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        setClientDisplayName(me.display_name);
        setClientDisplaySubtitle(me.display_subtitle);
        setClientServices(me.services);
        setClientLogoSrcLight(me.logo_data_url ?? CLIENT_BRANDING[me.client_id]?.logoSrcLight ?? null);
        setClientLogoSrcDark(me.logo_data_url ?? CLIENT_BRANDING[me.client_id]?.logoSrcDark ?? null);
        setClientId(me.client_id);
        setPmsRoomViews(me.pms_room_views);
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
    setIsAuthenticated(false);
    setUserEmail('');
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearStoredSession();
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
        clientLogoSrcLight,
        clientLogoSrcDark,
        clientId,
        pmsRoomViews,
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
