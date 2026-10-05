import { useEffect, useId, useState } from 'react';
import { guardarAcompanantes, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import {
  BORRADOR_VACIO,
  LIMITES_ACOMPANANTE,
  edad,
  errorDeAcompanante,
  isoLocal,
  nombreCompleto,
  normalizarBorrador,
} from '../lib/acompanantes';
import type { Acompanante, BorradorAcompanante } from '../types';

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
export function AcompanantesReserva({
  bookingId,
  inicial,
  editable,
  onCambio,
  onEditando,
}: {
  bookingId: string;
  inicial: Acompanante[];
  editable: boolean;
  onCambio: () => void;
  onEditando: (editando: boolean) => void;
}) {
  const { handleUnauthorized } = useAuth();
  const ids = useId();
  const [lista, setLista] = useState<Acompanante[]>(inicial);
  // 'nuevo', el CompanionID que se está editando, o null.
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<BorradorAcompanante>(BORRADOR_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onEditando(editando !== null);
  }, [editando, onEditando]);

  function abrir(a: Acompanante | null) {
    setBorrador(a ? { ...a } : BORRADOR_VACIO);
    setEditando(a ? a.CompanionID : 'nuevo');
    setError('');
  }

  function cerrarFormulario() {
    setEditando(null);
    setBorrador(BORRADOR_VACIO);
    setError('');
  }

  async function persistir(nueva: BorradorAcompanante[]): Promise<boolean> {
    setGuardando(true);
    setError('');
    try {
      const res = await guardarAcompanantes(bookingId, nueva);
      if (!Array.isArray(res.Companions)) {
        // La Lambda desplegada respondió 200 pero no conoce el campo: no se
        // guardó nada. Decirlo es mejor que mostrar un acompañante que al
        // recargar ya no está.
        throw new Error('El servidor todavía no guarda acompañantes. No se guardó el cambio.');
      }
      setLista(res.Companions);
      onCambio();
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
        return false;
      }
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardar() {
    const problema = errorDeAcompanante(borrador);
    if (problema) {
      setError(problema);
      return;
    }
    const limpio = normalizarBorrador(borrador);
    const nueva =
      editando === 'nuevo'
        ? [...lista, limpio]
        : lista.map((a) => (a.CompanionID === editando ? { ...limpio, CompanionID: a.CompanionID } : a));
    if (await persistir(nueva)) cerrarFormulario();
  }

  async function quitar(a: Acompanante) {
    if (!confirm(`¿Quitar a ${nombreCompleto(a)} de los acompañantes de esta reserva?`)) return;
    await persistir(lista.filter((x) => x.CompanionID !== a.CompanionID));
  }

  const puedeAgregar = editable && editando === null && lista.length < LIMITES_ACOMPANANTE.maxPorReserva;

  return (
    <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={fieldLabel}>Acompañantes{lista.length > 0 ? ` (${lista.length})` : ''}</div>
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
                  {editable && editando === null && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="crm-btn crm-btn-text crm-btn-sm" onClick={() => abrir(a)} disabled={guardando}>
                        Editar
                      </button>
                      <button className="crm-btn crm-btn-danger crm-btn-sm" onClick={() => void quitar(a)} disabled={guardando}>
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
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`${ids}-alergia`}
                  checked={!borrador.FoodAllergy}
                  onChange={() => setBorrador({ ...borrador, FoodAllergy: false })}
                  style={{ margin: 0 }}
                />
                No
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
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
            <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => void guardar()} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar acompañante'}
            </button>
          </div>
        </div>
      )}

      {/* El error de quitar no tiene formulario donde mostrarse. */}
      {editando === null && error && <div style={{ fontSize: 12, color: 'var(--status-critico-dot)', marginTop: 10 }}>{error}</div>}
    </div>
  );
}
