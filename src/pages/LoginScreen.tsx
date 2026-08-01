import { useState, type FormEvent } from 'react';
import { LogoPlaceholder } from '../components/LogoPlaceholder';
import { useAuth } from '../context/AuthContext';
import { CLIENT_BRANDING, clientIdFromHostname } from '../branding';

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
        background: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 50% at 50% 35%, rgba(188,194,179,0.10) 0%, transparent 70%)',
        }}
      />

      <div style={{ width: '100%', maxWidth: 340, zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            {branding ? (
              <img
                src={branding.logoSrc}
                alt={branding.logoAlt}
                style={{ height: 72, width: 'auto', maxWidth: 220, objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <LogoPlaceholder size="lg" />
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{branding?.logoAlt ?? 'RockyBrand'}</div>
              <div style={{ fontSize: 10, color: 'var(--sage)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
                Executive Dashboard
              </div>
            </div>
            <div style={{ width: 40, height: 1.5, background: 'var(--sage)', opacity: 0.4 }} />
          </div>
        </div>

        {sessionExpiredMessage && (
          <div
            style={{
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.20)',
              borderRadius: 9,
              padding: '10px 14px',
              fontSize: 13,
              color: '#fff',
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            {sessionExpiredMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.50)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
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
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.50)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
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
            <div style={{ fontSize: 13, color: '#FCA5A5', textAlign: 'center', padding: '4px 0' }}>{loginError}</div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            style={{
              all: 'unset',
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--white)',
              color: 'var(--primary)',
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
  background: 'rgba(255,255,255,0.09)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 9,
  padding: '14px 16px',
  fontSize: 16,
  color: '#fff',
  outline: 'none',
  minHeight: 52,
  fontFamily: 'Inter, sans-serif',
} as const;
