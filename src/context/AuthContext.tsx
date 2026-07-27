import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { login as cognitoLogin, getStoredSession, clearStoredSession, decodeIdTokenClaims, LoginError } from '../api/cognitoAuth';

interface AuthContextValue {
  isAuthenticated: boolean;
  userEmail: string;
  loginError: string | null;
  sessionExpiredMessage: string | null;
  isLoggingIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  handleUnauthorized: () => void;
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
      value={{ isAuthenticated, userEmail, loginError, sessionExpiredMessage, isLoggingIn, login, logout, handleUnauthorized }}
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
