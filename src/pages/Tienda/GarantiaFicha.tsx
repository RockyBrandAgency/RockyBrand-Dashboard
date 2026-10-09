import { useEffect, useId, useMemo, useState } from 'react';
import { ConflictError, crearTiendaGarantia, editarTiendaGarantia, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { StoreGarantia, StoreGarantiaAviso, StoreGarantiaDatos, StoreGarantiaEstado } from '../../types';
import { GarantiaAviso } from './GarantiaAviso';
import { COURIERS, ESTADOS_GARANTIA, PRECIO_REPOSICION_CLP, REGIONES, TRAMO_NOMBRE, fmtMomento, formatearRut, money, rutValido } from './garantias';

// Página de una garantía (2026-10-08, decisión de Mato): reemplaza a la ficha
// lateral. Ocupa el área de contenido en lugar del listado y, al guardar, el
// listado vuelve con el aviso de éxito. La misma página sirve para agregar
// una a mano, porque el backend valida los dos casos con las mismas reglas
// (store_admin_lambda._validar_datos_garantia).
//
// Los datos van en el orden que pidió Mato: 1 cliente, 2 despacho, 3 caña y
// 4 estado y pago. La nota interna cierra.
//
// Una garantía eliminada (está en la papelera) se abre en solo lectura, con
// Restaurar en vez de Guardar. Nada de esto le manda un correo al cliente.
//
// El aviso por WhatsApp (2026-10-08) va en «2 Despacho» (GarantiaAviso): es
// lo único de la página que le escribe al cliente, y solo con su botón.

const ANCHO_PAGINA = 880;
// Alto de la barra inferior del celular (MobileBar): el pie fijo va encima.
const BARRA_MOVIL = 60;

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
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const tituloSeccion: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 };
const numeroSeccion: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: 'var(--text)',
  color: 'var(--white)',
  fontSize: 12,
  fontWeight: 700,
  flexShrink: 0,
};
const bloque: React.CSSProperties = { borderTop: '1px solid var(--border-soft)', paddingTop: 'var(--space-6)', marginTop: 'var(--space-6)' };
const ayuda: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginTop: 6 };
const errorDeCampo: React.CSSProperties = { fontSize: 12, color: 'var(--status-critico-dot)', marginTop: 4 };
const todoElAncho: React.CSSProperties = { gridColumn: '1 / -1' };

const MONTO_MAXIMO_CLP = 10_000_000;
const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

// Todo como texto, tal cual está en los inputs. Se convierte al guardar.
interface Formulario {
  nombre: string;
  rut: string;
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
    rut: g?.rut ?? '',
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
  if (t(f.rut) && !rutValido(f.rut)) return { error: 'El RUT no es válido: revisa el número y el dígito verificador.', campo: 'rut' };
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
      // Siempre "12.345.678-5": así la misma persona se lee igual.
      rut: formatearRut(f.rut),
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

// Lo que el estado elegido completa solo al guardar, dicho antes de guardar.
const FECHA_AUTOMATICA: Partial<Record<StoreGarantiaEstado, { campo: 'fecha_despacho' | 'fecha_entrega'; texto: string }>> = {
  despachada: { campo: 'fecha_despacho', texto: 'Sin fecha de despacho, al guardar queda la de hoy.' },
  entregada: { campo: 'fecha_entrega', texto: 'Sin fecha de entrega, al guardar queda la de hoy.' },
};

export function GarantiaFicha({
  garantia,
  isDesktop,
  onClose,
  onGuardado,
  onEliminar,
  onRestaurar,
  onVerActual,
  onAvisoCambiado,
  onRecargarAviso,
}: {
  /** Sin garantía = agregar una nueva. */
  garantia?: StoreGarantia;
  isDesktop: boolean;
  /** Volver al listado sin guardar. */
  onClose: () => void;
  onGuardado: (solicitudId: string) => void;
  /** Hace la llamada y vuelve al listado. Si lanza, la página muestra el error. */
  onEliminar?: (g: StoreGarantia) => Promise<void>;
  onRestaurar?: (g: StoreGarantia) => Promise<void>;
  /** Tras un 409: trae la versión guardada y vuelve a abrir la página con ella. */
  onVerActual?: () => void;
  /** El listado se queda con el aviso nuevo, sin recargar. */
  onAvisoCambiado?: (solicitudId: string, aviso: StoreGarantiaAviso) => void;
  /** El aviso como quedó guardado; null si no se pudo traer. */
  onRecargarAviso?: (solicitudId: string) => Promise<StoreGarantiaAviso | null>;
}) {
  const { handleUnauthorized } = useAuth();
  const inicial = useMemo(() => desdeGarantia(garantia), [garantia]);
  const [f, setF] = useState<Formulario>(inicial);
  const [ocupado, setOcupado] = useState<'guardar' | 'eliminar' | 'restaurar' | 'notificar' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState(false);
  // El campo que no pasó la validación: el error se muestra bajo él y no al
  // pie de un formulario de 22 campos, donde no se ve.
  const [errorCampo, setErrorCampo] = useState<keyof Formulario | null>(null);
  const [copiado, setCopiado] = useState<'si' | 'no' | null>(null);
  const id = useId();
  const editando = Boolean(garantia);
  const eliminada = Boolean(garantia?.eliminada_en);
  const cambiado = JSON.stringify(f) !== JSON.stringify(inicial);
  const puedeGuardar = !eliminada && ocupado === null && (!editando || cambiado);
  const estadoActual = ESTADOS_GARANTIA.find((e) => e.key === f.estado);

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

  // Un formulario largo no se pierde por un clic de más en «Volver».
  function cerrar() {
    if (ocupado) return;
    if (cambiado && !eliminada && !window.confirm('¿Descartar los cambios de esta garantía?')) return;
    onClose();
  }

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (puedeGuardar) void guardar();
      }
    }
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  });

  function fallo(e: unknown, porDefecto: string) {
    if (e instanceof UnauthorizedError) return handleUnauthorized();
    setConflicto(e instanceof ConflictError);
    setError(e instanceof Error ? e.message : porDefecto);
  }

  async function guardar() {
    const r = validarFormulario(f);
    if ('error' in r) {
      setError(r.error);
      setErrorCampo(r.campo);
      setConflicto(false);
      const el = document.getElementById(`${id}-${r.campo}`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView?.({ block: 'center' });
      return;
    }
    setOcupado('guardar');
    setError(null);
    setErrorCampo(null);
    setConflicto(false);
    try {
      if (garantia) {
        await editarTiendaGarantia(garantia.solicitud_id, r.datos, garantia.actualizada_en ?? '');
        onGuardado(garantia.solicitud_id);
      } else {
        const creada = await crearTiendaGarantia(r.datos);
        onGuardado(creada.solicitud_id);
      }
    } catch (e) {
      fallo(e, 'No se pudo guardar la garantía.');
    } finally {
      setOcupado(null);
    }
  }

  // Sin confirmación: se deshace desde el aviso o desde Eliminadas. Solo se
  // pregunta si hay cambios sin guardar, porque esos no vuelven al restaurar.
  async function eliminar() {
    if (!garantia || !onEliminar) return;
    if (cambiado && !window.confirm('Tienes cambios sin guardar en esta garantía. ¿Eliminarla de todos modos? Esos cambios se pierden.')) return;
    setOcupado('eliminar');
    setError(null);
    setErrorCampo(null);
    try {
      await onEliminar(garantia);
    } catch (e) {
      fallo(e, 'No se pudo eliminar la garantía.');
      setOcupado(null);
    }
  }

  async function restaurar() {
    if (!garantia || !onRestaurar) return;
    setOcupado('restaurar');
    setError(null);
    try {
      await onRestaurar(garantia);
    } catch (e) {
      fallo(e, 'No se pudo restaurar la garantía.');
      setOcupado(null);
    }
  }

  // Lo que hay que escribir en la etiqueta del envío, listo para pegar.
  async function copiarDespacho() {
    const direccion = [f.direccion, f.comuna, f.region].map((s) => s.trim()).filter(Boolean).join(', ');
    const texto = [f.nombre.trim(), formatearRut(f.rut), f.telefono.trim(), direccion].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado('si');
    } catch {
      setCopiado('no');
    }
    window.setTimeout(() => setCopiado(null), 2000);
  }

  const precio = leerMonto(f.costo_clp);
  const despacho = leerMonto(f.costo_despacho_clp);
  const douglas = leerMonto(f.costo_douglas_clp);
  const margenVisible =
    typeof precio === 'number' && despacho !== 'invalido' && douglas !== 'invalido' && (despacho !== null || douglas !== null)
      ? precio - (despacho ?? 0) - (douglas ?? 0)
      : null;
  const fechaAutomatica = FECHA_AUTOMATICA[f.estado];

  // Tres columnas en escritorio, una en el celular.
  const grilla: React.CSSProperties = { display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: 12, marginTop: 12 };
  const dosColumnas: React.CSSProperties = isDesktop ? { gridColumn: 'span 2' } : {};

  // Campo de texto con su label enlazado: el id lo exige el label y lo usan
  // las pruebas para encontrar cada campo por su nombre visible.
  function texto(clave: keyof Formulario, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, caja?: React.CSSProperties) {
    const campoId = `${id}-${clave}`;
    return (
      <div style={caja}>
        <label htmlFor={campoId} style={fieldLabel}>
          {label}
        </label>
        <input
          id={campoId}
          value={f[clave] as string}
          onChange={(e) => set(clave, e.target.value as never)}
          style={inputStyle}
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
      <div style={todoElAncho}>
        <label htmlFor={campoId} style={fieldLabel}>
          {label}
        </label>
        <textarea id={campoId} value={f[clave]} onChange={(e) => set(clave, e.target.value)} maxLength={maxLength} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
    );
  }

  function seccion(n: number, titulo: string, derecha?: React.ReactNode) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 32 }}>
        <h2 style={tituloSeccion}>
          <span aria-hidden="true" style={numeroSeccion}>
            {n}
          </span>
          {titulo}
        </h2>
        {derecha}
      </div>
    );
  }

  const monto = { inputMode: 'numeric' as const, placeholder: '0' };
  const lado = isDesktop ? 40 : 16;

  return (
    <div className="garantia-ficha" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: ANCHO_PAGINA, margin: '0 auto', padding: isDesktop ? `28px ${lado}px 0` : `16px ${lado}px ${BARRA_MOVIL}px` }}>
        <button type="button" className="crm-btn crm-btn-text crm-btn-sm" onClick={cerrar} disabled={ocupado !== null} style={{ marginLeft: -12 }}>
          ← Garantías
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 8, paddingBottom: 'var(--space-6)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>
              {garantia ? garantia.nombre || 'Garantía sin nombre' : 'Nueva garantía'}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              {garantia ? (
                <>
                  N° {garantia.solicitud_id} · {garantia.origen === 'manual' ? 'Agregada a mano' : 'Formulario web'} ·{' '}
                  <span style={{ whiteSpace: 'nowrap' }}>{fmtMomento(garantia.created_at)}</span>
                </>
              ) : (
                'Un caso que no llegó por el formulario de la web: WhatsApp, teléfono o en persona. Completa los cuatro pasos y guarda.'
              )}
            </div>
          </div>
          {garantia && estadoActual && (
            <span style={{ flexShrink: 0, marginTop: 2, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: estadoActual.bg, color: estadoActual.fg }}>
              {estadoActual.label}
            </span>
          )}
          {garantia && !eliminada && garantia.veces_usada > 1 && (
            <span
              title="Solicitudes de esta persona, contando esta"
              style={{ flexShrink: 0, marginTop: 2, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--status-atencion-bg)', color: 'var(--status-atencion-text)' }}
            >
              {garantia.veces_usada}ª vez
            </span>
          )}
        </div>
        {eliminada && garantia && (
          <div className="crm-aviso alerta" style={{ margin: '16px 0 0' }}>
            Eliminada el {fmtMomento(garantia.eliminada_en)}: no aparece en la lista ni en los indicadores. Restáurala para editarla.
          </div>
        )}

        {/* Un fieldset deshabilitado apaga todos los campos de una vez:
            mientras se guarda y en una eliminada. */}
        <fieldset disabled={eliminada || ocupado !== null} className={eliminada ? 'solo-lectura' : undefined} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <div style={{ ...bloque, borderTop: 0, marginTop: 0 }}>
            {seccion(1, 'Cliente')}
            <div style={grilla}>
              {texto('nombre', 'Nombre *', { autoFocus: !editando, maxLength: 80, autoComplete: 'off' }, dosColumnas)}
              {texto('rut', 'RUT', { maxLength: 20, placeholder: '12.345.678-5', autoComplete: 'off', onBlur: () => set('rut', formatearRut(f.rut)) })}
              {texto('telefono', 'Teléfono *', { maxLength: 24, placeholder: '+56 9…', type: 'tel', autoComplete: 'off' })}
              {texto('email', 'Correo', { maxLength: 254, type: 'email', autoComplete: 'off' }, dosColumnas)}
            </div>
          </div>

          <div style={bloque}>
            {seccion(
              2,
              'Despacho',
              !eliminada && (
                <button type="button" className="crm-btn crm-btn-text crm-btn-sm" onClick={() => void copiarDespacho()} aria-live="polite">
                  {copiado === 'si' ? '✓ Copiado' : copiado === 'no' ? 'No se pudo copiar' : 'Copiar datos de envío'}
                </button>
              ),
            )}
            <div style={grilla}>
              {texto('direccion', 'Dirección de despacho', { maxLength: 160, placeholder: 'Calle y número', autoComplete: 'off' }, dosColumnas)}
              {texto('comuna', 'Comuna', { maxLength: 60, autoComplete: 'off' })}
              <div>
                <label htmlFor={`${id}-region`} style={fieldLabel}>
                  Región
                </label>
                <select id={`${id}-region`} value={f.region} onChange={(e) => set('region', e.target.value)} style={inputStyle}>
                  <option value="">Elige…</option>
                  {/* Una región escrita a mano en el formulario web se conserva
                      como opción: editar no la borra. */}
                  {f.region && !REGIONES.includes(f.region) && <option value={f.region}>{f.region}</option>}
                  {REGIONES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              {texto('courier', 'Empresa de transporte', { maxLength: 60, placeholder: 'Ej.: Starken', list: `${id}-couriers`, autoComplete: 'off' })}
              <datalist id={`${id}-couriers`}>
                {COURIERS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {texto('numero_seguimiento', 'N° de seguimiento', { maxLength: 80, autoComplete: 'off' })}
              {texto('fecha_despacho', 'Fecha de despacho', { type: 'date' })}
              {texto('fecha_entrega', 'Recibida por el cliente el', { type: 'date', min: f.fecha_despacho || undefined })}
            </div>
            {garantia?.aviso && (
              <GarantiaAviso
                garantia={garantia}
                aviso={garantia.aviso}
                cambiado={cambiado}
                onEnviando={(si) => setOcupado(si ? 'notificar' : null)}
                onAvisoCambiado={(a) => onAvisoCambiado?.(garantia.solicitud_id, a)}
                onRecargar={() => (onRecargarAviso ? onRecargarAviso(garantia.solicitud_id) : Promise.resolve(null))}
                onVerActual={onVerActual}
              />
            )}
          </div>

          <div style={bloque}>
            {seccion(3, 'Caña')}
            <div style={grilla}>
              {texto('cana', 'Caña *', { maxLength: 80, placeholder: 'Ej.: SKY G', autoComplete: 'off' })}
              {texto('modelo', 'Modelo', { maxLength: 80, placeholder: 'Ej.: 5904', autoComplete: 'off' })}
              <div>
                <label htmlFor={`${id}-tramo`} style={fieldLabel}>
                  Tramo *
                </label>
                <select id={`${id}-tramo`} value={f.tramo} onChange={(e) => set('tramo', e.target.value)} style={inputStyle} {...invalido('tramo')}>
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
          </div>

          <div style={bloque}>
            {seccion(4, 'Estado y pago')}
            <div style={{ ...fieldLabel, marginTop: 12 }} id={`${id}-estado`}>
              Estado
            </div>
            <div role="radiogroup" aria-labelledby={`${id}-estado`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {ESTADOS_GARANTIA.map((e) => {
                const activo = f.estado === e.key;
                return (
                  <label
                    key={e.key}
                    className="garantia-chip"
                    style={{
                      background: activo ? e.bg : 'var(--white)',
                      color: activo ? e.fg : 'var(--text-sub)',
                      borderColor: activo ? 'transparent' : 'var(--border)',
                      fontWeight: activo ? 700 : 500,
                    }}
                  >
                    <input type="radio" name={`${id}-estado`} value={e.key} checked={activo} onChange={() => set('estado', e.key)} />
                    {activo ? '✓ ' : ''}
                    {e.label}
                  </label>
                );
              })}
            </div>
            {fechaAutomatica && !f[fechaAutomatica.campo] && !eliminada && <div style={ayuda}>{fechaAutomatica.texto}</div>}

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
              <label htmlFor={`${id}-pagado`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text)', cursor: 'pointer', padding: '8px 0', alignSelf: 'end' }}>
                <input id={`${id}-pagado`} type="checkbox" checked={f.pagado} onChange={(e) => set('pagado', e.target.checked)} style={{ width: 18, height: 18, margin: 0 }} />
                Pagado
              </label>
              {f.pagado && texto('fecha_pago', 'Fecha de pago', { type: 'date' })}
            </div>
          </div>

          <div style={bloque}>
            <div style={grilla}>{area('nota_interna', 'Nota interna (no la ve el cliente)', 500)}</div>
          </div>
        </fieldset>
      </div>

      {/* Pie fijo: Guardar y Eliminar siempre a la vista, y el error del
          servidor junto a ellos, no al final de 22 campos. */}
      <div
        style={{
          position: 'sticky',
          bottom: isDesktop ? 0 : BARRA_MOVIL,
          marginTop: 'var(--space-8)',
          borderTop: '1px solid var(--border)',
          background: 'var(--white)',
        }}
      >
        <div style={{ maxWidth: ANCHO_PAGINA, margin: '0 auto', padding: `12px ${lado}px` }}>
          {error && !errorCampo && (
            <div role="alert" style={{ fontSize: 13, color: 'var(--status-critico-text)', marginBottom: 10 }}>
              {error}
              {conflicto && onVerActual && (
                <div style={{ marginTop: 6 }}>
                  <button type="button" className="crm-btn crm-btn-tonal crm-btn-sm" onClick={onVerActual}>
                    Descartar mis cambios y ver la versión actual
                  </button>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {editando && !eliminada && onEliminar && (
              <button type="button" className="crm-btn crm-btn-danger" style={{ paddingInline: 12, marginLeft: -12 }} onClick={() => void eliminar()} disabled={ocupado !== null}>
                {ocupado === 'eliminar' ? 'Eliminando…' : 'Eliminar'}
              </button>
            )}
            <span style={{ flex: 1 }} />
            {cambiado && !eliminada && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isDesktop ? 'Cambios sin guardar' : 'Sin guardar'}</span>}
            <button type="button" className="crm-btn crm-btn-text" onClick={cerrar} disabled={ocupado !== null}>
              {eliminada ? 'Volver' : 'Cancelar'}
            </button>
            {eliminada ? (
              onRestaurar && (
                <button type="button" className="crm-btn crm-btn-primary" onClick={() => void restaurar()} disabled={ocupado !== null}>
                  {ocupado === 'restaurar' ? 'Restaurando…' : 'Restaurar'}
                </button>
              )
            ) : (
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => void guardar()}
                disabled={!puedeGuardar}
                title={isDesktop ? 'Guardar (⌘S o Ctrl+S)' : undefined}
              >
                {ocupado === 'guardar' ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar garantía'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
