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
  // Logo real del cliente logueado (branding.ts), resuelto por su
  // client_id real (no por el subdominio - ya hay sesión, se usa el dato
  // de verdad). null si el cliente no tiene logo cargado todavía.
  clientLogoSrc: string | null;
  // client_id real (no el subdominio) - lo necesitan componentes que
  // varían por cliente pero no tienen su propio branding (ej.
  // WeatherWidget, ubicación real). null mientras carga.
  clientId: string | null;
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
  const [clientLogoSrc, setClientLogoSrc] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setClientDisplayName(null);
      setClientDisplaySubtitle('');
      setClientServices(null);
      setClientLogoSrc(null);
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
        setClientLogoSrc(CLIENT_BRANDING[me.client_id]?.logoSrcDark ?? null);
        setClientId(me.client_id);
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
        clientLogoSrc,
        clientId,
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
