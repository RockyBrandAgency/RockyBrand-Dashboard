import { useEffect, useId, useMemo, useState } from 'react';
import { crearTiendaGarantia, editarTiendaGarantia, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { StoreGarantia, StoreGarantiaDatos, StoreGarantiaEstado } from '../../types';
import { ESTADOS_GARANTIA, PRECIO_REPOSICION_CLP, TRAMO_NOMBRE, money } from './garantias';

// Agregar una garantía a mano o editar una existente (2026-10-07, pedido de
// Mato): datos del cliente y de la caña, precio y costos, pago, despacho y
// entrega. El mismo formulario para las dos cosas, porque el backend valida
// los dos casos con las mismas reglas (store_admin_lambda._validar_datos_garantia).
//
// Ninguno de los dos caminos le manda un correo al cliente.

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 4,
  fontSize: 14,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  background: 'var(--white)',
  color: 'var(--text)',
};
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const seccion: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 'var(--space-6) 0 8px' };
const grilla: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 };
const ayuda: React.CSSProperties = { fontSize: 12, color: 'var(--text-faint)', marginTop: 6 };
const errorDeCampo: React.CSSProperties = { fontSize: 12, color: 'var(--status-critico-dot)', marginTop: 4 };

const MONTO_MAXIMO_CLP = 10_000_000;
const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

// Todo como texto, tal cual está en los inputs. Se convierte al guardar.
interface Formulario {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  region: string;
  cana: string;
  modelo: string;
  tramo: string;
  descripcion: string;
  estado: StoreGarantiaEstado;
  costo_clp: string;
  costo_despacho_clp: string;
  costo_douglas_clp: string;
  pagado: boolean;
  fecha_pago: string;
  courier: string;
  numero_seguimiento: string;
  fecha_despacho: string;
  fecha_entrega: string;
  nota_interna: string;
}

function miles(n: number | null): string {
  return n === null ? '' : n.toLocaleString('es-CL');
}

function desdeGarantia(g?: StoreGarantia): Formulario {
  return {
    nombre: g?.nombre ?? '',
    email: g?.email ?? '',
    telefono: g?.telefono ?? '',
    direccion: g?.direccion_calle ?? '',
    comuna: g?.comuna ?? '',
    region: g?.region ?? '',
    cana: g?.cana ?? '',
    modelo: g?.modelo ?? '',
    tramo: g?.tramo ?? '',
    descripcion: g?.descripcion ?? '',
    estado: g?.estado ?? 'recibida',
    costo_clp: miles(g ? g.costo_clp : PRECIO_REPOSICION_CLP),
    costo_despacho_clp: miles(g?.costo_despacho_clp ?? null),
    costo_douglas_clp: miles(g?.costo_douglas_clp ?? null),
    pagado: g?.pagado ?? false,
    fecha_pago: g?.fecha_pago ?? '',
    courier: g?.courier ?? '',
    numero_seguimiento: g?.numero_seguimiento ?? '',
    fecha_despacho: g?.fecha_despacho ?? '',
    fecha_entrega: g?.fecha_entrega ?? '',
    nota_interna: g?.nota_interna ?? '',
  };
}

// Pesos enteros. Acepta "50.000", "$50.000" o "50000"; vacío = no cargado.
// Un decimal o una letra es un error, no se redondea en silencio.
export function leerMonto(texto: string): number | null | 'invalido' {
  const limpio = texto.replace(/[\s.$]/g, '');
  if (limpio === '') return null;
  if (!/^\d+$/.test(limpio)) return 'invalido';
  const n = Number(limpio);
  return n <= MONTO_MAXIMO_CLP ? n : 'invalido';
}

export function validarFormulario(f: Formulario): { datos: StoreGarantiaDatos } | { error: string; campo: keyof Formulario } {
  const t = (s: string) => s.trim();
  if (!t(f.nombre)) return { error: 'Falta el nombre.', campo: 'nombre' };
  if (!t(f.telefono)) return { error: 'Falta el teléfono.', campo: 'telefono' };
  if (t(f.email) && !EMAIL_RE.test(t(f.email))) return { error: 'El correo no tiene un formato válido.', campo: 'email' };
  if (!t(f.cana)) return { error: 'Falta la caña.', campo: 'cana' };
  if (!TRAMO_NOMBRE[f.tramo]) return { error: 'Elige el tramo.', campo: 'tramo' };

  const precio = leerMonto(f.costo_clp);
  if (precio === null) return { error: 'Falta el precio al cliente.', campo: 'costo_clp' };
  const despacho = leerMonto(f.costo_despacho_clp);
  const douglas = leerMonto(f.costo_douglas_clp);
  const montos = [
    [precio, 'El precio al cliente', 'costo_clp'],
    [despacho, 'El costo de despacho', 'costo_despacho_clp'],
    [douglas, 'El costo pagado a Douglas', 'costo_douglas_clp'],
  ] as const;
  for (const [valor, nombre, campo] of montos) {
    if (valor === 'invalido') return { error: `${nombre} debe ser un monto en pesos, sin decimales (hasta $10.000.000).`, campo };
  }
  if (f.fecha_despacho && f.fecha_entrega && f.fecha_entrega < f.fecha_despacho) {
    return { error: 'La fecha de entrega no puede ser anterior a la de despacho.', campo: 'fecha_entrega' };
  }

  return {
    datos: {
      nombre: t(f.nombre),
      email: t(f.email),
      telefono: t(f.telefono),
      direccion: t(f.direccion),
      comuna: t(f.comuna),
      region: t(f.region),
      cana: t(f.cana),
      modelo: t(f.modelo),
      tramo: f.tramo,
      descripcion: t(f.descripcion),
      estado: f.estado,
      costo_clp: precio as number,
      costo_despacho_clp: despacho as number | null,
      costo_douglas_clp: douglas as number | null,
      pagado: f.pagado,
      // Una fecha de pago sin pago no existe: el backend la rechaza.
      fecha_pago: f.pagado ? f.fecha_pago : '',
      courier: t(f.courier),
      numero_seguimiento: t(f.numero_seguimiento),
      fecha_despacho: f.fecha_despacho,
      fecha_entrega: f.fecha_entrega,
      nota_interna: t(f.nota_interna),
    },
  };
}

export function GarantiaFormModal({
  garantia,
  onClose,
  onGuardado,
}: {
  /** Sin garantía = agregar una nueva. */
  garantia?: StoreGarantia;
  onClose: () => void;
  onGuardado: (solicitudId: string) => void;
}) {
  const { handleUnauthorized } = useAuth();
  const inicial = useMemo(() => desdeGarantia(garantia), [garantia]);
  const [f, setF] = useState<Formulario>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El campo que no pasó la validación: el error se muestra bajo él y no al
  // final de un formulario de 21 campos, donde no se ve.
  const [errorCampo, setErrorCampo] = useState<keyof Formulario | null>(null);
  const id = useId();
  const tituloId = `${id}-titulo`;
  const editando = Boolean(garantia);
  const cambiado = JSON.stringify(f) !== JSON.stringify(inicial);

  function set<K extends keyof Formulario>(clave: K, valor: Formulario[K]) {
    setF((prev) => ({ ...prev, [clave]: valor }));
    if (clave === errorCampo) {
      setErrorCampo(null);
      setError(null);
    }
  }

  function errorBajo(clave: keyof Formulario) {
    return errorCampo === clave && error ? (
      <div id={`${id}-${clave}-error`} role="alert" style={errorDeCampo}>
        {error}
      </div>
    ) : null;
  }

  function invalido(clave: keyof Formulario) {
    return errorCampo === clave
      ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-${clave}-error`, style: { ...inputStyle, border: '1px solid var(--status-critico-dot)' } }
      : {};
  }

  // Un formulario largo no se pierde por un Escape o un clic de más.
  function cerrar() {
    if (guardando) return;
    if (cambiado && !window.confirm('¿Descartar los cambios de esta garantía?')) return;
    onClose();
  }

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar();
    }
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  });

  async function guardar() {
    const r = validarFormulario(f);
    if ('error' in r) {
      setError(r.error);
      setErrorCampo(r.campo);
      const el = document.getElementById(`${id}-${r.campo}`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView?.({ block: 'center' });
      return;
    }
    setGuardando(true);
    setError(null);
    setErrorCampo(null);
    try {
      if (garantia) {
        await editarTiendaGarantia(garantia.solicitud_id, r.datos, garantia.actualizada_en ?? '');
        onGuardado(garantia.solicitud_id);
      } else {
        const creada = await crearTiendaGarantia(r.datos);
        onGuardado(creada.solicitud_id);
      }
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo guardar la garantía.');
    } finally {
      setGuardando(false);
    }
  }

  const precio = leerMonto(f.costo_clp);
  const despacho = leerMonto(f.costo_despacho_clp);
  const douglas = leerMonto(f.costo_douglas_clp);
  const margenVisible =
    typeof precio === 'number' && despacho !== 'invalido' && douglas !== 'invalido' && (despacho !== null || douglas !== null)
      ? precio - (despacho ?? 0) - (douglas ?? 0)
      : null;

  // Campo de texto con su label enlazado: el id lo exige el label y lo usan
  // las pruebas para encontrar cada campo por su nombre visible.
  function texto(clave: keyof Formulario, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) {
    const campoId = `${id}-${clave}`;
    return (
      <div>
        <label htmlFor={campoId} style={fieldLabel}>
          {label}
        </label>
        <input
          id={campoId}
          value={f[clave] as string}
          onChange={(e) => set(clave, e.target.value as never)}
          style={inputStyle}
          disabled={guardando}
          {...extra}
          {...invalido(clave)}
        />
        {errorBajo(clave)}
      </div>
    );
  }

  function area(clave: 'descripcion' | 'nota_interna', label: string, maxLength: number) {
    const campoId = `${id}-${clave}`;
    return (
      <div style={{ gridColumn: '1 / -1' }}>
        <label htmlFor={campoId} style={fieldLabel}>
          {label}
        </label>
        <textarea
          id={campoId}
          value={f[clave]}
          onChange={(e) => set(clave, e.target.value)}
          maxLength={maxLength}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
          disabled={guardando}
        />
      </div>
    );
  }

  const monto = { inputMode: 'numeric' as const, placeholder: '0' };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          width: '100%',
          minWidth: 'min(900px, 100%)',
          maxWidth: 960,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-card-hover)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h2 id={tituloId} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            {editando ? `Editar garantía ${garantia!.solicitud_id}` : 'Agregar garantía'}
          </h2>
          <button
            onClick={cerrar}
            aria-label="Cerrar"
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: 'pointer',
              fontSize: 22,
              color: 'var(--text-faint)',
              lineHeight: 1,
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
          {editando
            ? 'Los cambios quedan guardados en la garantía. No se le avisa nada al cliente.'
            : 'Para un caso que no llegó por el formulario de la web: WhatsApp, teléfono o en persona. No se le envía ningún correo al cliente.'}{' '}
          Los campos con * son obligatorios.
        </div>

        <h3 style={seccion}>Cliente</h3>
        <div style={grilla}>
          {texto('nombre', 'Nombre *', { autoFocus: true, maxLength: 80 })}
          {texto('telefono', 'Teléfono *', { maxLength: 24, placeholder: '+56 9…', type: 'tel' })}
          {texto('email', 'Correo', { maxLength: 254, type: 'email' })}
        </div>

        <h3 style={seccion}>Caña</h3>
        <div style={grilla}>
          {texto('cana', 'Caña *', { maxLength: 80, placeholder: 'Ej.: SKY G' })}
          {texto('modelo', 'Modelo', { maxLength: 80, placeholder: 'Ej.: 5904' })}
          <div>
            <label htmlFor={`${id}-tramo`} style={fieldLabel}>
              Tramo *
            </label>
            <select id={`${id}-tramo`} value={f.tramo} onChange={(e) => set('tramo', e.target.value)} style={inputStyle} disabled={guardando} {...invalido('tramo')}>
              <option value="">Elige…</option>
              {Object.entries(TRAMO_NOMBRE).map(([n, nombre]) => (
                <option key={n} value={n}>
                  {n} · {nombre}
                </option>
              ))}
            </select>
            {errorBajo('tramo')}
          </div>
          {area('descripcion', 'Qué pasó', 1000)}
        </div>

        <h3 style={seccion}>Despacho y entrega</h3>
        <div style={grilla}>
          <div style={{ gridColumn: '1 / -1' }}>{texto('direccion', 'Dirección de despacho', { maxLength: 160, placeholder: 'Calle y número' })}</div>
          {texto('comuna', 'Comuna', { maxLength: 60 })}
          {texto('region', 'Región', { maxLength: 60 })}
          {texto('courier', 'Empresa de transporte', { maxLength: 60, placeholder: 'Ej.: Starken, Chilexpress' })}
          {texto('numero_seguimiento', 'N° de seguimiento', { maxLength: 80 })}
          {texto('fecha_despacho', 'Fecha de despacho', { type: 'date' })}
          {texto('fecha_entrega', 'Recibida por el cliente el', { type: 'date', min: f.fecha_despacho || undefined })}
        </div>
        <div style={ayuda}>Si el estado es Despachada o Entregada y la fecha queda vacía, se guarda la de hoy.</div>

        <h3 style={seccion}>Precio, costos y pago</h3>
        <div style={grilla}>
          {texto('costo_clp', 'Precio al cliente *', monto)}
          {texto('costo_despacho_clp', 'Costo de despacho', monto)}
          {texto('costo_douglas_clp', 'Costo pagado a Douglas', monto)}
          <div>
            <div style={fieldLabel}>Margen</div>
            <div
              aria-live="polite"
              style={{
                fontSize: 14,
                marginTop: 4,
                padding: '8px 0',
                fontWeight: 600,
                color: margenVisible !== null && margenVisible < 0 ? 'var(--status-critico-dot)' : 'var(--text)',
              }}
            >
              {margenVisible === null ? '—' : money(margenVisible)}
            </div>
          </div>
        </div>
        <div style={{ ...grilla, marginTop: 10, alignItems: 'end' }}>
          <label htmlFor={`${id}-pagado`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text)', cursor: 'pointer', padding: '8px 0' }}>
            <input
              id={`${id}-pagado`}
              type="checkbox"
              checked={f.pagado}
              onChange={(e) => set('pagado', e.target.checked)}
              disabled={guardando}
              style={{ width: 18, height: 18, margin: 0 }}
            />
            Pagado
          </label>
          {f.pagado && texto('fecha_pago', 'Fecha de pago', { type: 'date' })}
        </div>

        <h3 style={seccion}>Estado y nota</h3>
        <div style={grilla}>
          <div>
            <label htmlFor={`${id}-estado`} style={fieldLabel}>
              Estado
            </label>
            <select
              id={`${id}-estado`}
              value={f.estado}
              onChange={(e) => set('estado', e.target.value as StoreGarantiaEstado)}
              style={inputStyle}
              disabled={guardando}
            >
              {ESTADOS_GARANTIA.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          {area('nota_interna', 'Nota interna (no la ve el cliente)', 500)}
        </div>

        {/* Pie pegado al borde inferior: con 21 campos, los botones y el error
            del servidor no pueden quedar fuera de la vista. */}
        <div
          style={{
            position: 'sticky',
            bottom: 'calc(-1 * var(--space-8))',
            margin: 'var(--space-7) calc(-1 * var(--space-8)) calc(-1 * var(--space-8))',
            padding: 'var(--space-6) var(--space-8) var(--space-8)',
            background: 'var(--white)',
            borderTop: '1px solid var(--border-soft)',
          }}
        >
          {error && !errorCampo && (
            <div role="alert" style={{ fontSize: 13, color: 'var(--status-critico-dot)', marginBottom: 'var(--space-5)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
            <button className="crm-btn crm-btn-text" onClick={cerrar} disabled={guardando}>
              Cancelar
            </button>
            <button className="crm-btn crm-btn-primary" onClick={() => void guardar()} disabled={guardando || (editando && !cambiado)}>
              {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar garantía'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
