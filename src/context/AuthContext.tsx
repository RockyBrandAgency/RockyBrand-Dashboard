import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { login as cognitoLogin, getStoredSession, clearStoredSession, decodeIdTokenClaims, LoginError } from '../api/cognitoAuth';
import { getMe, UnauthorizedError } from '../api/dashboardApi';
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

  useEffect(() => {
    if (!isAuthenticated) {
      setClientDisplayName(null);
      setClientDisplaySubtitle('');
      setClientServices(null);
      return;
    }
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        setClientDisplayName(me.display_name);
        setClientDisplaySubtitle(me.display_subtitle);
        setClientServices(me.services);
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
