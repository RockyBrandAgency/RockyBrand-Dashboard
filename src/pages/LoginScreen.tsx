import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { applyClientTheme, applyClientTitle, CLIENT_BRANDING, clientIdFromHostname } from '../branding';
import { EyeOffIcon, TreePineIcon } from '../components/icons/RockyIcons';

// El Make solo traia un campo de email (sin password) - Cognito real
// necesita ambos, se agrega el campo con el mismo lenguaje visual.
export function LoginScreen({ sessionExpiredMessage }: { sessionExpiredMessage?: string | null }) {
  const { login, loginError, isLoggingIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sin sesión todavía no hay ningún dato de identidad real - el único
  // indicio es el subdominio (nombredelcliente.panel.rockybrand.cl). Si
  // no matchea un cliente conocido (localhost, URL default de Amplify),
  // cae al placeholder genérico de siempre - nunca se inventa un logo.
  const clientId = clientIdFromHostname(window.location.hostname);
  const branding = clientId ? CLIENT_BRANDING[clientId] : null;

  useEffect(() => {
    applyClientTheme(clientId);
    applyClientTitle(clientId);
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
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-10)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 4px 8px rgba(0,0,0,0.03)',
          padding: 'var(--space-10)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-9)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-5)' }}>
          {branding ? (
            <img
              src={branding.logoSrcLight}
              alt={branding.logoAlt}
              style={{ height: 48, width: 'auto', maxWidth: 200, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TreePineIcon size={24} color="#fff" />
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{branding?.logoAlt ?? 'RockyBrand'}</h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>Portal de Clientes · RockyBrand</div>
          </div>
        </div>

        {sessionExpiredMessage && (
          <div
            style={{
              background: 'var(--status-atencion-bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--status-atencion-text)',
              textAlign: 'center',
            }}
          >
            {sessionExpiredMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)' }}>Correo Electrónico</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="carolina@altocastillo.cl"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)' }}>Contraseña</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 40, width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  all: 'unset',
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  display: 'flex',
                  color: 'var(--text-faint)',
                }}
              >
                <EyeOffIcon size={16} />
              </button>
            </div>
          </label>

          {loginError && <div style={{ fontSize: 13, color: 'var(--status-critico-text)', textAlign: 'center' }}>{loginError}</div>}

          <button
            type="submit"
            disabled={isLoggingIn}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              background: 'var(--primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-5)',
              fontSize: 14,
              fontWeight: 600,
              cursor: isLoggingIn ? 'default' : 'pointer',
              opacity: isLoggingIn ? 0.7 : 1,
              textAlign: 'center',
            }}
          >
            {isLoggingIn ? 'Entrando…' : 'Ingresar al Panel'}
          </button>
        </form>
      </div>

      <div style={{ paddingTop: 'var(--space-8)', fontSize: 12, color: 'var(--text-faint)' }}>
        Desarrollado con orgullo en Chile por RockyBrand®
      </div>
    </div>
  );
}

const inputStyle = {
  boxSizing: 'border-box',
  background: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '12px',
  fontSize: 14,
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
} as const;
