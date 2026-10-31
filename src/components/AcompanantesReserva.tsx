import { useEffect, useId, useRef, useState } from 'react';
import { esReservaModificada, getReservasResumen, guardarAcompanantes, MENSAJE_RESERVA_MODIFICADA, UnauthorizedError } from '../api/dashboardApi';
import { useAuth, usePermiso } from '../context/AuthContext';
import {
  BORRADOR_VACIO,
  DOCUMENTO_VACIO,
  LIMITES_ACOMPANANTE,
  documentoABorrador,
  edad,
  errorDeAcompanante,
  errorDeDocumento,
  etiquetaTipoDocumento,
  isoLocal,
  nombreCompleto,
  normalizarBorrador,
  normalizarDocumento,
  tieneDocumento,
  type BorradorDocumento,
} from '../lib/acompanantes';
import type { Acompanante, BorradorAcompanante } from '../types';
import { CamposDocumento } from './CamposDocumento';

const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' };
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

function fmtNacimiento(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Acompañantes de la estadía, dentro de la ficha de la reserva (2026-10-05,
// pedido de Mato). Se guarda cada alta, edición o baja apenas se confirma, sin
// cerrar la ficha: quien carga a un matrimonio suele agregar a la segunda
// persona enseguida. Se manda la lista entera y se reemplaza la local por la
// que devuelve el servidor, que trae los CompanionID asignados allá.
//
// `editable` en false (reserva cancelada) deja ver a quienes ya estaban sin
// permitir cambios. `onCambio` avisa que la ficha que abrió la página ya no
// coincide con lo guardado; `onEditando` avisa que hay un formulario abierto,
// para no cerrar la ficha con un acompañante a medio cargar.
//
// Se usa en dos fichas: la de la reserva (BookingDetailModal) y la del
// pescador en Lodge → Pescadores (HuespedesLista), que muestra una sección por
// viaje activo. `titulo` dice de qué viaje es; `separacion` sigue la
// convención de margen de cada ficha.
export function AcompanantesReserva({
  bookingId,
  inicial,
  actualizadaEn = null,
  actualizando = false,
  editable,
  onCambio,
  onEditando,
  titulo = 'Acompañantes',
  separacion = 'abajo',
  encabezado,
}: {
  bookingId: string;
  inicial: Acompanante[];
  /** UpdatedAt de la reserva que se leyó: va como ExpectedUpdatedAt (409 si cambió). */
  actualizadaEn?: string | null;
  /** Recarga pendiente tras un guardado propio de la ficha: no se guarda. */
  actualizando?: boolean;
  editable: boolean;
  onCambio: () => void;
  onEditando: (editando: boolean) => void;
  titulo?: string;
  separacion?: 'arriba' | 'abajo';
  /** Reemplaza la etiqueta del título (la ficha del pescador usa su
   *  encabezado numerado). Recibe cuántos acompañantes hay. */
  encabezado?: (cantidad: number) => React.ReactNode;
}) {
  const { handleUnauthorized } = useAuth();
  // Con rol de lectura la lista se ve, pero no se edita (lib/permisos.ts).
  const puedeOperar = usePermiso('pms.operar');
  const ids = useId();
  const [lista, setLista] = useState<Acompanante[]>(inicial);
  // 'nuevo', el CompanionID que se está editando, o null.
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<BorradorAcompanante>(BORRADOR_VACIO);
  const [documento, setDocumento] = useState<BorradorDocumento>(DOCUMENTO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // 409 reserva_modificada (30-oct): lo escrito queda hasta que se recargue.
  const [modificada, setModificada] = useState(false);
  const [recargando, setRecargando] = useState(false);
  // Concurrencia (30-oct, ronda 4): `esperado` es la versión del servidor que
  // corresponde EXACTAMENTE a `lista`; se mueven juntas, nunca una sola. Tras
  // un PUT propio pasa a ser la de la respuesta (o ninguna, si no la trae: no
  // se manda una versión que no calce con lo guardado).
  const esperado = useRef<string | null>(actualizadaEn);
  const inicialRef = useRef(inicial);
  inicialRef.current = inicial;
  // Lo que tenía el formulario al abrirse, para saber si hay cambios sin guardar.
  const abiertoCon = useRef('');
  const huellaForm = JSON.stringify([borrador, documento]);
  const conCambios = useRef(false);
  const editandoActual = useRef(editando);
  editandoActual.current = editando;
  conCambios.current = editando !== null && huellaForm !== abiertoCon.current;
  // Llegó otra versión de la reserva: sin cambios sin guardar, la lista (y el
  // formulario abierto) se rearman con lo nuevo; con cambios, se conserva la
  // versión de lo que se editó y el servidor responde 409 si alguien cambió.
  useEffect(() => {
    if (!actualizadaEn || actualizadaEn === esperado.current || conCambios.current) return;
    esperado.current = actualizadaEn;
    const nueva = inicialRef.current;
    setLista(nueva);
    setModificada(false);
    const ed = editandoActual.current;
    if (ed === null || ed === 'nuevo') return;
    const a = nueva.find((x) => x.CompanionID === ed);
    if (!a) {
      setEditando(null);
      return;
    }
    const b = { ...a };
    const d = documentoABorrador(a.IdentityDocument);
    abiertoCon.current = JSON.stringify([b, d]);
    setBorrador(b);
    setDocumento(d);
    // Solo la versión dispara el rearmado: la lista llega con ella.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualizadaEn]);

  // En un ref para que el efecto dependa solo de `editando`: quien pasa una
  // flecha nueva en cada render no dispara un aviso (y un render) por render.
  const onEditandoRef = useRef(onEditando);
  onEditandoRef.current = onEditando;
  useEffect(() => {
    onEditandoRef.current(editando !== null);
  }, [editando]);

  function abrir(a: Acompanante | null) {
    const b = a ? { ...a } : BORRADOR_VACIO;
    const d = documentoABorrador(a?.IdentityDocument);
    abiertoCon.current = JSON.stringify([b, d]);
    setBorrador(b);
    setDocumento(d);
    setEditando(a ? a.CompanionID : 'nuevo');
    setError('');
  }

  function cerrarFormulario() {
    setEditando(null);
    setBorrador(BORRADOR_VACIO);
    setDocumento(DOCUMENTO_VACIO);
    setError('');
  }

  // `conDocumento`: posición del acompañante al que se le mandó documento. Si
  // la respuesta no lo trae, el servidor desplegado todavía no lo guarda.
  async function persistir(nueva: BorradorAcompanante[], conDocumento: number | null = null): Promise<boolean> {
    setGuardando(true);
    setError('');
    try {
      // ExpectedUpdatedAt solo si la reserva lo trajo (el servidor anterior no lo manda).
      const res = esperado.current ? await guardarAcompanantes(bookingId, nueva, esperado.current) : await guardarAcompanantes(bookingId, nueva);
      if (!Array.isArray(res.Companions)) {
        // La Lambda desplegada respondió 200 pero no conoce el campo: no se
        // guardó nada. Decirlo es mejor que mostrar un acompañante que al
        // recargar ya no está.
        throw new Error('El servidor todavía no guarda acompañantes. No se guardó el cambio.');
      }
      setLista(res.Companions);
      esperado.current = typeof res.UpdatedAt === 'string' && res.UpdatedAt ? res.UpdatedAt : null;
      onCambio();
      if (conDocumento !== null && !tieneDocumento(res.Companions[conDocumento]?.IdentityDocument)) {
        // El resto sí quedó guardado: se cierra el formulario y se avisa.
        setEditando(null);
        setError('Se guardó el acompañante, pero el servidor todavía no guarda su documento.');
        return false;
      }
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
        return false;
      }
      if (esReservaModificada(e)) {
        setModificada(true);
        return false;
      }
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  // Trae la reserva de nuevo (la misma ruta que abre una ficha por booking_id)
  // y reemplaza lo local: recién ahí se pierde lo escrito.
  async function recargar() {
    setRecargando(true);
    try {
      const { reservas } = await getReservasResumen({ bookingId });
      const r = reservas.find((x) => x.BookingID === bookingId);
      if (!r) throw new Error('Sin la reserva');
      setLista(r.Companions ?? []);
      esperado.current = r.UpdatedAt ?? null;
      cerrarFormulario();
      setModificada(false);
      onCambio();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError('No pudimos recargar la reserva. Vuelve a intentarlo.');
    } finally {
      setRecargando(false);
    }
  }

  async function guardar() {
    if (modificada || actualizando) return;
    const problema = errorDeAcompanante(borrador) ?? errorDeDocumento(documento);
    if (problema) {
      setError(problema);
      return;
    }
    const anterior = lista.find((a) => a.CompanionID === editando);
    const doc = normalizarDocumento(documento, borrador.BirthDate || null, anterior?.IdentityDocument);
    // La clave va solo si hay documento o si había uno que se borró: así el
    // acompañante sin documento viaja igual que antes.
    const limpio: BorradorAcompanante = {
      ...normalizarBorrador(borrador),
      ...(doc || tieneDocumento(anterior?.IdentityDocument) ? { IdentityDocument: doc } : {}),
    };
    const nueva =
      editando === 'nuevo'
        ? [...lista, limpio]
        : lista.map((a) => (a.CompanionID === editando ? { ...limpio, CompanionID: a.CompanionID } : a));
    const posicion = editando === 'nuevo' ? nueva.length - 1 : lista.findIndex((a) => a.CompanionID === editando);
    if (await persistir(nueva, doc ? posicion : null)) cerrarFormulario();
  }

  async function quitar(a: Acompanante) {
    if (actualizando) return;
    if (!confirm(`¿Quitar a ${nombreCompleto(a)} de los acompañantes de esta reserva?`)) return;
    await persistir(lista.filter((x) => x.CompanionID !== a.CompanionID));
  }

  const puedeAgregar = puedeOperar && editable && editando === null && lista.length < LIMITES_ACOMPANANTE.maxPorReserva;

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-soft)',
        paddingTop: 'var(--space-6)',
        ...(separacion === 'arriba' ? { marginTop: 'var(--space-6)' } : { marginBottom: 'var(--space-6)' }),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {encabezado ? (
          encabezado(lista.length)
        ) : (
          <div style={fieldLabel}>
            {titulo}
            {lista.length > 0 ? ` (${lista.length})` : ''}
          </div>
        )}
        {puedeAgregar && (
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => abrir(null)} disabled={guardando}>
            + Agregar acompañante
          </button>
        )}
      </div>

      {lista.length === 0 && editando === null && (
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>Sin acompañantes registrados.</div>
      )}

      {lista.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {lista.map((a) =>
            editando === a.CompanionID ? null : (
              <div
                key={a.CompanionID}
                style={{ border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{nombreCompleto(a)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 2 }}>
                      {a.BirthDate ? (
                        <>
                          Nació el {fmtNacimiento(a.BirthDate)}
                          {edad(a.BirthDate) !== null && ` · ${edad(a.BirthDate)} años`}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>Fecha de nacimiento sin cargar</span>
                      )}
                    </div>
                  </div>
                  {puedeOperar && editable && editando === null && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="crm-btn crm-btn-text crm-btn-sm" onClick={() => abrir(a)} disabled={guardando}>
                        Editar
                      </button>
                      <button className="crm-btn crm-btn-danger crm-btn-sm" onClick={() => void quitar(a)} disabled={guardando || actualizando}>
                        Quitar
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 8 }}>
                  {a.FoodAllergy ? (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--status-atencion-bg)',
                        color: 'var(--status-atencion-dot)',
                        display: 'inline-block',
                      }}
                    >
                      Alergia alimentaria: {a.FoodAllergyDetail}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin alergias alimentarias</span>
                  )}
                </div>
                {tieneDocumento(a.IdentityDocument) && (
                  <div data-dato="documento" style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 8, overflowWrap: 'anywhere' }}>
                    {etiquetaTipoDocumento(a.IdentityDocument.Type)} {a.IdentityDocument.Number}
                    {a.IdentityDocument.Nationality && ` · ${a.IdentityDocument.Nationality}`}
                    {a.IdentityDocument.EntryDate && ` · Ingresó el ${fmtNacimiento(a.IdentityDocument.EntryDate)}`}
                  </div>
                )}
                {a.Notes && (
                  <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{a.Notes}</div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {editando !== null && (
        <div
          style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-5)', marginTop: 10 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={fieldLabel} htmlFor={`${ids}-nombre`}>
                Nombre *
              </label>
              <input
                id={`${ids}-nombre`}
                value={borrador.FirstName}
                maxLength={LIMITES_ACOMPANANTE.nombre}
                autoFocus
                onChange={(e) => setBorrador({ ...borrador, FirstName: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={fieldLabel} htmlFor={`${ids}-apellido`}>
                Apellido
              </label>
              <input
                id={`${ids}-apellido`}
                value={borrador.LastName}
                maxLength={LIMITES_ACOMPANANTE.nombre}
                onChange={(e) => setBorrador({ ...borrador, LastName: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={fieldLabel} htmlFor={`${ids}-nacimiento`}>
                Fecha de nacimiento
              </label>
              <input
                id={`${ids}-nacimiento`}
                type="date"
                value={borrador.BirthDate ?? ''}
                min="1900-01-01"
                max={isoLocal(new Date())}
                onChange={(e) => setBorrador({ ...borrador, BirthDate: e.target.value || null })}
                style={inputStyle}
              />
            </div>
          </div>

          <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
            <legend style={{ ...fieldLabel, padding: 0 }}>¿Tiene alguna alergia alimentaria?</legend>
            <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 14, color: 'var(--text)' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, minWidth: 44, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`${ids}-alergia`}
                  checked={!borrador.FoodAllergy}
                  onChange={() => setBorrador({ ...borrador, FoodAllergy: false })}
                  style={{ margin: 0 }}
                />
                No
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, minWidth: 44, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`${ids}-alergia`}
                  checked={borrador.FoodAllergy}
                  onChange={() => setBorrador({ ...borrador, FoodAllergy: true })}
                  style={{ margin: 0 }}
                />
                Sí
              </label>
            </div>
          </fieldset>

          {borrador.FoodAllergy && (
            <div style={{ marginTop: 12 }}>
              <label style={fieldLabel} htmlFor={`${ids}-alergia-detalle`}>
                ¿A qué tiene alergia? *
              </label>
              <input
                id={`${ids}-alergia-detalle`}
                value={borrador.FoodAllergyDetail}
                maxLength={LIMITES_ACOMPANANTE.alergia}
                placeholder="Ej.: mariscos, maní, gluten"
                onChange={(e) => setBorrador({ ...borrador, FoodAllergyDetail: e.target.value })}
                style={inputStyle}
              />
            </div>
          )}

          <CamposDocumento idBase={ids} valor={documento} onChange={setDocumento} estiloEtiqueta={fieldLabel} estiloCampo={inputStyle} />

          <div style={{ marginTop: 12 }}>
            <label style={fieldLabel} htmlFor={`${ids}-notas`}>
              Notas
            </label>
            <textarea
              id={`${ids}-notas`}
              value={borrador.Notes}
              maxLength={LIMITES_ACOMPANANTE.notas}
              rows={3}
              placeholder="Ej.: no pesca, le interesa cabalgar"
              onChange={(e) => setBorrador({ ...borrador, Notes: e.target.value })}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {error && <div style={{ fontSize: 12, color: 'var(--status-critico-dot)', marginTop: 10 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', justifyContent: 'flex-end' }}>
            <button className="crm-btn crm-btn-text crm-btn-sm" onClick={cerrarFormulario} disabled={guardando}>
              Cancelar
            </button>
            <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => void guardar()} disabled={guardando || modificada || actualizando}>
              {guardando ? 'Guardando…' : actualizando ? 'Actualizando…' : 'Guardar acompañante'}
            </button>
          </div>
        </div>
      )}

      {/* El error de quitar no tiene formulario donde mostrarse. */}
      {editando === null && error && <div style={{ fontSize: 12, color: 'var(--status-critico-dot)', marginTop: 10 }}>{error}</div>}

      {modificada && (
        <div data-aviso="reserva-modificada" style={{ marginTop: 10 }}>
          <p role="alert" style={{ fontSize: 12, color: 'var(--status-critico-dot)', margin: 0 }}>
            {MENSAJE_RESERVA_MODIFICADA}
          </p>
          <button type="button" className="crm-btn crm-btn-primary crm-btn-sm" style={{ marginTop: 8 }} onClick={() => void recargar()} disabled={recargando}>
            {recargando ? 'Recargando…' : 'Recargar'}
          </button>
        </div>
      )}
    </div>
  );
}
