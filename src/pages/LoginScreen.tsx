import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CampoCodigo, InscripcionTotp } from '../components/VerificacionDosPasos';
import { applyClientTheme, applyClientTitle, CLIENT_BRANDING, clientIdFromHostname } from '../branding';
import { EyeOffIcon, TreePineIcon } from '../components/icons/RockyIcons';

// El Make solo traia un campo de email (sin password) - Cognito real
// necesita ambos, se agrega el campo con el mismo lenguaje visual.
export function LoginScreen({ sessionExpiredMessage }: { sessionExpiredMessage?: string | null }) {
  const { login, loginError, isLoggingIn, desafio } = useAuth();
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

        {desafio ? (
          <PasoDeSeguridad email={email} />
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)' }}>Correo Electrónico</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                /* Genérico a propósito. Era el correo real de la dueña de Alto
                   Castillo y lo veía CUALQUIER cliente: el login es la misma
                   app para todos los subdominios, así que el panel de Karibu
                   mostraba el correo de una clienta de otra marca como
                   ejemplo. Encontrado el 2026-09-08 mirando la pantalla, no el
                   código. */
                placeholder="tu@correo.cl"
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
                  /* Objetivo de 32x32 (WCAG 2.2 2.5.8 pide 24x24; medía 16x16)
                     con el ícono centrado: right 4 + 16 de medio ancho deja el
                     centro del ícono donde estaba (right 12 + 8), y cabe en el
                     paddingRight 40 del campo. */
                  style={{
                    all: 'unset',
                    position: 'absolute',
                    right: 4,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    color: 'var(--text-faint)',
                  }}
                >
                  <EyeOffIcon size={16} />
                </button>
              </div>
            </label>

            {loginError && <div role="alert" style={{ fontSize: 13, color: 'var(--status-critico-text)', textAlign: 'center' }}>{loginError}</div>}

            {/* El unico boton que el cliente ve antes de entrar, asi que es el
                primero que tiene que verse como el sistema. width:100% se
                conserva -en un formulario de login el CTA ocupa el ancho de la
                caja, es lo que hace tambien M3-; lo que sale es el estilo propio
                de alto/radio/peso y el opacity a mano, que ahora es :disabled. */}
            <button
              type="submit"
              className="crm-btn crm-btn-primary"
              disabled={isLoggingIn}
              style={{ width: '100%' }}
            >
              {isLoggingIn ? 'Entrando…' : 'Ingresar al Panel'}
            </button>
          </form>
        )}
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

// Encabezado de cada paso, con el criterio del panel: badge → título → detalle.
function EncabezadoPaso({ icono, badge, titulo, detalle }: { icono: ReactNode; badge: string; titulo: string; detalle: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
      <span className="crm-pill" style={{ gap: 'var(--space-2)' }}>
        {icono}
        {badge}
      </span>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{titulo}</h2>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>{detalle}</p>
    </div>
  );
}

const NOTA_TRES_MINUTOS = 'Tienes 3 minutos para completar este paso; si se pasa, vuelves a empezar.';

// Lo que viene después de la contraseña: código, inscripción o clave nueva.
function PasoDeSeguridad({ email }: { email: string }) {
  const {
    desafio,
    loginError,
    isLoggingIn,
    avisoDesafio,
    secretoInscripcion,
    responderCodigo,
    cambiarClaveInicial,
    pedirSecretoInscripcion,
    completarInscripcion,
    volverAlInicio,
  } = useAuth();
  const [codigo, setCodigo] = useState('');
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const idError = useId();
  const pedido = useRef(false);

  // Cada desafío nuevo empieza con el campo vacío: el código de recién es
  // de un solo uso.
  useEffect(() => {
    setCodigo('');
    setErrorLocal(null);
  }, [desafio?.tipo]);

  // La inscripción obligatoria pide el secreto una sola vez al llegar al paso.
  useEffect(() => {
    if (desafio?.tipo !== 'inscribir' || secretoInscripcion || pedido.current) return;
    pedido.current = true;
    void pedirSecretoInscripcion();
  }, [desafio?.tipo, secretoInscripcion, pedirSecretoInscripcion]);

  if (!desafio) return null;
  const error = errorLocal ?? loginError;

  const volver = (
    <button type="button" className="crm-btn crm-btn-text crm-btn-sm" onClick={volverAlInicio} style={{ alignSelf: 'center' }}>
      <ArrowLeft size={16} aria-hidden="true" />
      Volver al inicio
    </button>
  );

  const mensajeError = error && (
    <div id={idError} role="alert" style={{ fontSize: 13, color: 'var(--status-critico-text)', textAlign: 'center' }}>
      {error}
    </div>
  );

  if (desafio.tipo === 'codigo') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (codigo.length === 6) void responderCodigo(codigo);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
      >
        <EncabezadoPaso
          icono={<ShieldCheck size={14} aria-hidden="true" />}
          badge="Verificación en dos pasos"
          titulo="Escribe tu código"
          detalle="Abre tu app de autenticación y escribe el código de 6 dígitos de RockyBrand."
        />
        {avisoDesafio && <div className="crm-aviso ok" role="status" style={{ margin: 0 }}>{avisoDesafio}</div>}
        <CampoCodigo valor={codigo} onCambio={setCodigo} idError={error ? idError : undefined} autoFocus />
        {mensajeError}
        <button type="submit" className="crm-btn crm-btn-primary" disabled={isLoggingIn || codigo.length !== 6} style={{ width: '100%' }}>
          {isLoggingIn ? 'Verificando…' : 'Verificar y entrar'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>{NOTA_TRES_MINUTOS}</div>
        {volver}
      </form>
    );
  }

  if (desafio.tipo === 'inscribir') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <EncabezadoPaso
          icono={<ShieldCheck size={14} aria-hidden="true" />}
          badge="Verificación en dos pasos"
          titulo="Activa tu app de autenticación"
          detalle="Tu cuenta necesita un segundo paso para entrar. Se configura una sola vez."
        />
        {secretoInscripcion ? (
          <InscripcionTotp
            secreto={secretoInscripcion}
            // En la app se lee el correo que la persona escribió, no el
            // username interno de Cognito (puede ser un UUID).
            cuenta={email.trim().toLowerCase() || desafio.usuario}
            ocupado={isLoggingIn}
            error={error}
            textoBoton="Activar y entrar"
            onVerificar={(c) => void completarInscripcion(c)}
          />
        ) : error ? (
          <>
            {mensajeError}
            <button type="button" className="crm-btn crm-btn-primary" disabled={isLoggingIn} onClick={() => void pedirSecretoInscripcion()} style={{ width: '100%' }}>
              Reintentar
            </button>
          </>
        ) : (
          <div role="status" style={{ fontSize: 13, color: 'var(--text-sub)', textAlign: 'center' }}>Preparando tu código QR…</div>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>{NOTA_TRES_MINUTOS}</div>
        {volver}
      </div>
    );
  }

  // nueva-clave
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (clave !== clave2) {
          setErrorLocal('Las dos contraseñas no coinciden.');
          return;
        }
        setErrorLocal(null);
        void cambiarClaveInicial(clave);
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
    >
      <EncabezadoPaso
        icono={<KeyRound size={14} aria-hidden="true" />}
        badge="Primer ingreso"
        titulo="Crea tu contraseña"
        detalle="La que recibiste es temporal. Elige una nueva: solo tú la vas a saber."
      />
      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)' }}>Contraseña nueva</span>
        <input
          type={verClave ? 'text' : 'password'}
          required
          autoComplete="new-password"
          autoFocus
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          aria-describedby={error ? idError : undefined}
          style={inputStyle}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)' }}>Repite la contraseña nueva</span>
        <input
          type={verClave ? 'text' : 'password'}
          required
          autoComplete="new-password"
          value={clave2}
          onChange={(e) => setClave2(e.target.value)}
          aria-describedby={error ? idError : undefined}
          style={inputStyle}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13, color: 'var(--text-sub)', minHeight: 24 }}>
        <input type="checkbox" checked={verClave} onChange={(e) => setVerClave(e.target.checked)} style={{ width: 24, height: 24, margin: 0, cursor: 'pointer' }} />
        Mostrar contraseñas
      </label>
      {mensajeError}
      <button type="submit" className="crm-btn crm-btn-primary" disabled={isLoggingIn} style={{ width: '100%' }}>
        {isLoggingIn ? 'Guardando…' : 'Guardar y entrar'}
      </button>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>{NOTA_TRES_MINUTOS}</div>
      {volver}
    </form>
  );
}
