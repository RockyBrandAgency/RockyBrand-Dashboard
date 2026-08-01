import { useEffect, useState, type FormEvent } from 'react';
import { LogoPlaceholder } from '../components/LogoPlaceholder';
import { useAuth } from '../context/AuthContext';
import { applyClientTheme, CLIENT_BRANDING, clientIdFromHostname } from '../branding';

// El Make solo traia un campo de email (sin password) - Cognito real
// necesita ambos, se agrega el campo con el mismo lenguaje visual.
export function LoginScreen({ sessionExpiredMessage }: { sessionExpiredMessage?: string | null }) {
  const { login, loginError, isLoggingIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Sin sesión todavía no hay ningún dato de identidad real - el único
  // indicio es el subdominio (nombredelcliente.panel.rockybrand.cl). Si
  // no matchea un cliente conocido (localhost, URL default de Amplify),
  // cae al placeholder genérico de siempre - nunca se inventa un logo.
  const clientId = clientIdFromHostname(window.location.hostname);
  const branding = clientId ? CLIENT_BRANDING[clientId] : null;

  useEffect(() => {
    applyClientTheme(clientId);
  }, [clientId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch {
      // loginError ya queda seteado en el contexto
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            {branding ? (
              <img
                src={branding.logoSrcLight}
                alt={branding.logoAlt}
                style={{ height: 160, width: 'auto', maxWidth: 320, objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <LogoPlaceholder size="lg" />
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{branding?.logoAlt ?? 'RockyBrand'}</div>
              <div style={{ fontSize: 10, color: 'var(--primary)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
                Executive Dashboard
              </div>
            </div>
            <div style={{ width: 40, height: 1.5, background: 'var(--border)' }} />
          </div>
        </div>

        {sessionExpiredMessage && (
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 9,
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--text-sub)',
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            {sessionExpiredMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
              Correo electrónico
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="carolina@altocastillo.cl"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
              Contraseña
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </label>

          {loginError && (
            <div style={{ fontSize: 13, color: '#B94040', textAlign: 'center', padding: '4px 0' }}>{loginError}</div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            style={{
              all: 'unset',
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--primary)',
              color: '#fff',
              borderRadius: 9,
              padding: '15px',
              fontSize: 16,
              fontWeight: 800,
              cursor: isLoggingIn ? 'default' : 'pointer',
              opacity: isLoggingIn ? 0.7 : 1,
              textAlign: 'center',
              minHeight: 52,
              marginTop: 6,
              letterSpacing: '-0.01em',
            }}
          >
            {isLoggingIn ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 9,
  padding: '14px 16px',
  fontSize: 16,
  color: 'var(--text)',
  outline: 'none',
  minHeight: 52,
  fontFamily: 'Inter, sans-serif',
} as const;
