import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card } from '../components/Card';
import { ToggleRow } from '../components/ToggleRow';
import { InscripcionTotp } from '../components/VerificacionDosPasos';
import { useAuth, usePermiso } from '../context/AuthContext';
import { uploadClientLogo } from '../api/dashboardApi';
import {
  completarInscripcionVoluntaria,
  iniciarInscripcionVoluntaria,
  leerEstadoMfa,
  LoginError,
  SessionExpiredError,
} from '../api/cognitoAuth';
import { motivoSinPermiso, NOMBRE_ROL } from '../lib/permisos';
import { CLIENT_LOCATION } from '../branding';

// Redimensiona/comprime la imagen ANTES de mandarla - el backend acepta
// hasta ~300KB de data URL (agent_core.MAX_LOGO_DATA_URL_LEN), y un logo
// no necesita más resolución que la que se ve en el Sidebar (32x32) o el
// login (más grande, pero igual chico). PNG (no JPEG) para no perder
// transparencia - varios logos reales de clientes (ej. Alto Castillo) son
// blancos/transparentes sobre fondo de marca.
function resizeImageToDataUrl(file: File, maxDim = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const MAX_LOGO_DATA_URL_LEN = 300_000;

function LogoCard() {
  const { clientDisplayName, clientLogoSrcLight, setUploadedLogo, rol } = useAuth();
  const puedeLogo = usePermiso('logo');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setSaved(false);
    if (!file.type.startsWith('image/')) {
      setError('Elige un archivo de imagen (PNG, JPG o SVG rasterizado).');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      if (dataUrl.length > MAX_LOGO_DATA_URL_LEN) {
        setError('La imagen sigue siendo muy grande incluso comprimida. Probá con un archivo más simple.');
        return;
      }
      await uploadClientLogo(dataUrl);
      setUploadedLogo(dataUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el logo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card style={{ marginBottom: 'var(--space-8)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Logo del Negocio</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
          Se muestra en el menú lateral de tu panel, en lugar del ícono genérico de RockyBrand.
        </div>
      </div>
      <div style={{ height: 1, background: 'var(--border-soft)', marginBottom: 'var(--space-6)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div
          style={{
            width: 64,
            height: 64,
            flexShrink: 0,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {clientLogoSrcLight ? (
            <img src={clientLogoSrcLight} alt={clientDisplayName ?? 'Logo del cliente'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', padding: '0 6px' }}>Sin logo</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
          <button className="crm-btn crm-btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading || !puedeLogo}>
            {uploading ? 'Subiendo…' : saved ? '✓ Guardado' : 'Subir logo'}
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            {puedeLogo ? 'PNG o JPG. Se ajusta automáticamente al tamaño del panel.' : motivoSinPermiso(rol)}
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--status-critico-text)', marginTop: 8 }}>{error}</div>}
        </div>
      </div>
    </Card>
  );
}


type EstadoTarjetaMfa =
  | { paso: 'cargando' }
  | { paso: 'error'; mensaje: string }
  | { paso: 'listo'; activo: boolean }
  | { paso: 'inscribiendo'; secreto: string };

// Verificación en dos pasos con la sesión ya iniciada (2026-10-20). El pool
// la tiene OPCIONAL mientras todos se inscriben; cuando pase a obligatoria,
// quien no la activó acá la configura en el login (desafío MFA_SETUP).
function VerificacionCard() {
  const { userEmail, handleUnauthorized } = useAuth();
  const [estado, setEstado] = useState<EstadoTarjetaMfa>({ paso: 'cargando' });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallo = (e: unknown, alTerminar: (mensaje: string) => void) => {
    if (e instanceof SessionExpiredError) {
      handleUnauthorized();
      return;
    }
    alTerminar(e instanceof LoginError ? e.message : 'No se pudo consultar la verificación en dos pasos.');
  };

  useEffect(() => {
    let cancelado = false;
    leerEstadoMfa()
      .then((r) => !cancelado && setEstado({ paso: 'listo', activo: r.activo }))
      .catch((e) => !cancelado && fallo(e, (mensaje) => setEstado({ paso: 'error', mensaje })));
    return () => {
      cancelado = true;
    };
    // fallo solo usa handleUnauthorized, que es estable (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empezar = async () => {
    setOcupado(true);
    setError(null);
    try {
      const secreto = await iniciarInscripcionVoluntaria();
      setEstado({ paso: 'inscribiendo', secreto });
    } catch (e) {
      fallo(e, setError);
    } finally {
      setOcupado(false);
    }
  };

  const verificar = async (codigo: string) => {
    setOcupado(true);
    setError(null);
    try {
      await completarInscripcionVoluntaria(codigo);
      setEstado({ paso: 'listo', activo: true });
    } catch (e) {
      fallo(e, setError);
    } finally {
      setOcupado(false);
    }
  };

  const activo = estado.paso === 'listo' && estado.activo;

  return (
    <Card style={{ marginBottom: 'var(--space-8)' }}>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
        {estado.paso === 'listo' && (
          <span
            className="crm-pill"
            data-estado-mfa={activo ? 'activo' : 'inactivo'}
            style={{
              gap: 'var(--space-2)',
              background: activo ? 'var(--status-bien-bg)' : 'var(--status-atencion-bg)',
              color: activo ? 'var(--status-bien-text)' : 'var(--status-atencion-text)',
            }}
          >
            {activo ? <ShieldCheck size={14} aria-hidden="true" /> : <ShieldAlert size={14} aria-hidden="true" />}
            {activo ? 'MFA activado' : 'MFA no activado'}
          </span>
        )}
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Verificación en dos pasos</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
          Además de tu contraseña, al entrar se pide un código de 6 dígitos de una app de autenticación en tu teléfono.
        </div>
      </div>
      <div style={{ height: 1, background: 'var(--border-soft)', marginBottom: 'var(--space-6)' }} />
      {estado.paso === 'cargando' && <div role="status" style={{ fontSize: 13, color: 'var(--text-sub)' }}>Consultando…</div>}
      {estado.paso === 'error' && <div role="alert" style={{ fontSize: 13, color: 'var(--status-critico-text)' }}>{estado.mensaje}</div>}
      {estado.paso === 'listo' && activo && (
        <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
          Tu cuenta ya pide el código al entrar. Si cambias de teléfono, escríbele a RockyBrand para volver a vincularla.
        </div>
      )}
      {estado.paso === 'listo' && !activo && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          {/* .crm-btn es nowrap: a 320 px el texto medía 274 px en un padre de
              238 y salía de la tarjeta (WCAG 2.2 1.4.10). Aquí puede partir en
              dos líneas; el padding vertical las separa del borde. */}
          <button className="crm-btn crm-btn-primary" onClick={empezar} disabled={ocupado} style={{ whiteSpace: 'normal', maxWidth: '100%', paddingBlock: 8 }}>
            {ocupado ? 'Preparando…' : 'Activar verificación en dos pasos'}
          </button>
          {error && <div role="alert" style={{ fontSize: 12, color: 'var(--status-critico-text)' }}>{error}</div>}
        </div>
      )}
      {estado.paso === 'inscribiendo' && (
        <div style={{ maxWidth: 400 }}>
          <InscripcionTotp
            secreto={estado.secreto}
            cuenta={userEmail}
            ocupado={ocupado}
            error={error}
            textoBoton="Activar"
            onVerificar={(c) => void verificar(c)}
          />
          <button
            type="button"
            className="crm-btn crm-btn-text crm-btn-sm"
            style={{ marginTop: 'var(--space-3)' }}
            onClick={() => {
              setError(null);
              setEstado({ paso: 'listo', activo: false });
            }}
          >
            Cancelar
          </button>
        </div>
      )}
    </Card>
  );
}

// Toggles de notificaciones + horario de avisos 100% locales - ni esta
// sesión ni las anteriores construyeron un backend de notificaciones, así
// que estos controles no mandan nada a ningún servidor.
//
// El comentario decía "no se finge una persistencia que no existe", pero la
// nota visible SÍ la fingía a medias: decía "Preferencias guardadas solo en
// este dispositivo" y no se guardan ni ahí -son `useState`, se pierden al
// recargar-. Y la tarjeta del horario no llevaba ninguna advertencia, así que
// quien bajaba hasta ella ajustaba un horario creyendo que silenciaba avisos
// que no existen. Ahora las dos lo dicen (2026-09-08). Layout y copy siguen el Figma real (frame
// "05 — Configuración"); el logo es la única sección que sí es 100% real
// de punta a punta (pedido explícito de Mato, 2026-08-03).
export function SettingsScreen() {
  const { logout, clientId, rol, userEmail } = useAuth();
  const [sw, setSw] = useState({ newBooking: true, cancellation: true, inquiry: false, syncError: true });
  const [horario, setHorario] = useState({ desde: '08:00', hasta: '22:00' });
  const tog = (k: keyof typeof sw) => setSw((s) => ({ ...s, [k]: !s[k] }));
  const location = clientId ? CLIENT_LOCATION[clientId] : undefined;

  const fechaHoy = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaCapitalizada = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div className="contenedor-pagina">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
            paddingBottom: 'var(--space-7)',
            borderBottom: '1px solid var(--border)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Configuración
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Personaliza el logo, los ajustes operacionales y las notificaciones de tu cuenta.
            </div>
          </div>
          {location && <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{location.label}, Chile · {fechaCapitalizada}</div>}
        </div>

        <Card style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <span className="crm-pill" data-rol={rol}>{NOMBRE_ROL[rol]}</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', overflowWrap: 'anywhere' }}>{userEmail || 'Tu cuenta'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
              {rol === 'admin'
                ? 'Puedes ver y cambiar todo en tu panel, incluidos los envíos de campañas.'
                : rol === 'editor'
                  ? 'Puedes operar reservas, tienda, borradores y contenido. Enviar campañas, importar contactos y el logo los hace un administrador.'
                  : 'Puedes ver toda la información, pero no cambiarla.'}
            </div>
          </div>
        </Card>

        <VerificacionCard />

        <LogoCard />

        <Card style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Notificaciones de Eventos</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>Elige qué alertas operacionales deseas recibir.</div>
          </div>
          <div style={{ height: 1, background: 'var(--border-soft)', marginBottom: 'var(--space-6)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <ToggleRow label="Nueva reserva" sub="Avisar cuando ingrese una reserva del motor directo o Booking.com" on={sw.newBooking} toggle={() => tog('newBooking')} />
            <ToggleRow label="Cancelación de reserva" sub="Recibir alerta inmediata si se cancela una reserva confirmada" on={sw.cancellation} toggle={() => tog('cancellation')} />
            <ToggleRow label="Nueva consulta web" sub="Avisos por formularios de consulta de tu sitio" on={sw.inquiry} toggle={() => tog('inquiry')} />
            <ToggleRow label="Error de sincronización PMS" sub="Alerta crítica si falla la conexión automática" on={sw.syncError} toggle={() => tog('syncError')} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-7)' }}>
            Todavía no hay un backend de notificaciones: <strong>estos controles
            no se guardan</strong> y vuelven a su estado inicial al recargar.
          </div>
        </Card>

        <Card style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Horario Preferido de Avisos</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Restringe las notificaciones automáticas para resguardar las horas de descanso.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Igual que arriba: todavía no se guarda ni se aplica.
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border-soft)', marginBottom: 'var(--space-6)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            <input
              type="time"
              aria-label="Horario de avisos, desde"
              value={horario.desde}
              onChange={(e) => setHorario((h) => ({ ...h, desde: e.target.value }))}
              style={{
                background: 'var(--white)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 16px',
                fontSize: 14,
                color: 'var(--text)',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>hasta</span>
            <input
              type="time"
              aria-label="Horario de avisos, hasta"
              value={horario.hasta}
              onChange={(e) => setHorario((h) => ({ ...h, hasta: e.target.value }))}
              style={{
                background: 'var(--white)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 16px',
                fontSize: 14,
                color: 'var(--text)',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            />
          </div>
        </Card>

        {/* var(--danger-hover) es el rojo exacto del Figma para esta tarjeta
            de peligro (distinto del rojo de --status-critico-*, que es el de
            pills de estado normales) - mismo tipo de convivencia de "2 rojos"
            ya documentada en otras pantallas de la app. Usa el token
            existente (index.css ya tenía #dc2626 como --danger-hover) en vez
            de repetir el hex a mano. */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            background: 'var(--status-critico-bg)',
            border: '1px solid var(--danger-hover)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-7)',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger-hover)' }}>Sesión de Usuario</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>Se cerrará el acceso seguro en este dispositivo de forma inmediata.</div>
          </div>
          <button className="crm-btn crm-btn-danger-filled" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
