import { useState, useEffect, useCallback } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import {
  getAgencias,
  getAgencia,
  crearAgencia,
  actualizarAgencia,
  crearAccesoAgencia,
  gestionarAccesoAgencia,
  UnauthorizedError,
} from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { Agencia, AgenciaAcceso } from '../../types';

/**
 * Agencias y tarifas.
 *
 * Es la pantalla donde se define cuánto paga cada agencia por noche y por
 * habitación. Tres decisiones de diseño que conviene no deshacer:
 *
 * - **Una habitación sin precio no se vende.** El campo vacío no significa
 *   "gratis" ni "precio público": significa que esa agencia no puede
 *   reservar esa habitación, y el portal ni se la ofrece. El backend
 *   levanta un error antes que cotizar en cero.
 * - **La clave temporal se muestra una vez.** No se guarda en ningún lado
 *   ni se puede volver a consultar. Si se pierde, se resetea.
 * - **Suspender, no borrar.** Una agencia con reservas cargadas no se
 *   puede eliminar sin dejar reservas reales huérfanas.
 */

function money(valor: number, moneda: string): string {
  return valor.toLocaleString('es-CL', {
    style: 'currency',
    currency: moneda === 'USD' ? 'USD' : 'CLP',
    maximumFractionDigits: 0,
  });
}

function fmtFecha(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ESTADO_ACCESO: Record<string, string> = {
  FORCE_CHANGE_PASSWORD: 'Sin estrenar',
  CONFIRMED: 'Activa',
  RESET_REQUIRED: 'Debe cambiar la clave',
};

const campo: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--white)',
  fontSize: 14,
  color: 'var(--text)',
  fontFamily: 'inherit',
};

const etiqueta: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-sub)',
  marginBottom: 6,
};

function Boton({
  children, onClick, disabled, tono = 'suave',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tono?: 'fuerte' | 'suave' | 'peligro';
}) {
  const paleta = {
    fuerte: { bg: 'var(--text)', fg: 'var(--white)' },
    suave: { bg: 'var(--border)', fg: 'var(--text)' },
    peligro: { bg: 'var(--status-critico-bg)', fg: 'var(--status-critico-dot)' },
  }[tono];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        all: 'unset',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: '9px 16px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13,
        fontWeight: 600,
        textAlign: 'center',
        background: paleta.bg,
        color: paleta.fg,
      }}
    >
      {children}
    </button>
  );
}

export function AgenciasLista({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [agencias, setAgencias] = useState<Agencia[] | null>(null);
  const [habitaciones, setHabitaciones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAgencias()
      .then((r) => {
        setAgencias(r.agencias);
        setHabitaciones(r.habitaciones);
      })
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized]);

  useEffect(() => { load(); }, [load]);

  function reemplazar(actualizada: Agencia) {
    setAgencias((prev) => (prev ?? []).map((a) => (a.agency_id === actualizada.agency_id ? actualizada : a)));
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end',
            gap: 12, paddingBottom: 'var(--space-7)', borderBottom: '1px solid var(--border)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Agencias y tarifas
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              El precio por noche que ve cada agencia cuando entra a reservar. Una habitación sin precio
              no se le ofrece.
            </div>
          </div>
          {!creando && <Boton tono="fuerte" onClick={() => setCreando(true)}>Nueva agencia</Boton>}
        </div>

        {creando && (
          <FormularioNueva
            habitaciones={habitaciones}
            onCancelar={() => setCreando(false)}
            onCreada={(a) => {
              setAgencias((prev) => [...(prev ?? []), a].sort((x, y) => x.nombre.localeCompare(y.nombre)));
              setCreando(false);
              setAbierta(a.agency_id);
            }}
          />
        )}

        <AsyncState loading={loading} error={error} onRetry={load}>
          {agencias && agencias.length === 0 && !creando && (
            <EmptyStateIllustrated
              icon={<span style={{ fontSize: 36 }}>🤝</span>}
              title="Todavía no hay agencias cargadas"
              description="Al crear una, se le fija su precio por habitación y se le entrega un acceso propio. Desde ahí reserva con su tarifa, no con la publicada en el sitio."
            />
          )}

          {agencias && agencias.map((agencia) => (
            <FilaAgencia
              key={agencia.agency_id}
              agencia={agencia}
              habitaciones={habitaciones}
              abierta={abierta === agencia.agency_id}
              onToggle={() => setAbierta(abierta === agencia.agency_id ? null : agencia.agency_id)}
              onActualizada={reemplazar}
              isDesktop={isDesktop}
            />
          ))}
        </AsyncState>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ alta --

function FormularioNueva({
  habitaciones, onCancelar, onCreada,
}: {
  habitaciones: string[];
  onCancelar: () => void;
  onCreada: (a: Agencia) => void;
}) {
  const { handleUnauthorized } = useAuth();
  const [nombre, setNombre] = useState('');
  const [moneda, setMoneda] = useState<'CLP' | 'USD'>('CLP');
  const [email, setEmail] = useState('');
  const [tarifas, setTarifas] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const precios: Record<string, number> = {};
      for (const [room, valor] of Object.entries(tarifas)) {
        // Vacío = esta agencia no vende esa habitación. No se manda 0: un
        // 0 la vendería gratis.
        if (valor.trim() !== '') precios[room] = Number(valor);
      }
      const r = await crearAgencia({
        Nombre: nombre.trim(),
        Moneda: moneda,
        Contacto: { Email: email.trim() },
        Tarifas: precios,
      });
      onCreada(r.agencia);
    } catch (e: unknown) {
      if (e instanceof UnauthorizedError) { handleUnauthorized(); return; }
      setError(e instanceof Error ? e.message : 'No se pudo crear la agencia.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 24, marginBottom: 'var(--space-8)' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>Nueva agencia</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={etiqueta}>Nombre de la agencia</label>
          <input style={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Andes Travel" />
        </div>
        <div>
          <label style={etiqueta}>Moneda del acuerdo</label>
          <select style={campo} value={moneda} onChange={(e) => setMoneda(e.target.value as 'CLP' | 'USD')}>
            <option value="CLP">CLP — pesos</option>
            <option value="USD">USD — dólares</option>
          </select>
        </div>
        <div>
          <label style={etiqueta}>Correo de contacto (opcional)</label>
          <input style={campo} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="reservas@agencia.cl" />
        </div>
      </div>

      <TablaTarifas habitaciones={habitaciones} valores={tarifas} onCambio={setTarifas} moneda={moneda} />

      {error && <div style={{ fontSize: 13, color: 'var(--status-critico-dot)', marginTop: 14 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <Boton tono="fuerte" onClick={guardar} disabled={guardando || !nombre.trim()}>
          {guardando ? 'Creando…' : 'Crear agencia'}
        </Boton>
        <Boton onClick={onCancelar}>Cancelar</Boton>
      </div>
    </div>
  );
}

function TablaTarifas({
  habitaciones, valores, onCambio, moneda,
}: {
  habitaciones: string[];
  valores: Record<string, string>;
  onCambio: (v: Record<string, string>) => void;
  moneda: string;
}) {
  return (
    <div>
      <label style={etiqueta}>Precio por noche, en {moneda} — dejar vacío para no ofrecer esa habitación</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {habitaciones.map((room) => (
          <div key={room} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{room}</span>
            <input
              style={{ ...campo, width: 110, textAlign: 'right' }}
              inputMode="numeric"
              value={valores[room] ?? ''}
              onChange={(e) => onCambio({ ...valores, [room]: e.target.value.replace(/[^\d.]/g, '') })}
              placeholder="—"
            />
          </div>
        ))}
      </div>
      {habitaciones.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--status-atencion-dot)' }}>
          Este lodge todavía no tiene su catálogo de habitaciones cargado, así que no se pueden fijar precios.
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- una fila --

function FilaAgencia({
  agencia, habitaciones, abierta, onToggle, onActualizada, isDesktop,
}: {
  agencia: Agencia;
  habitaciones: string[];
  abierta: boolean;
  onToggle: () => void;
  onActualizada: (a: Agencia) => void;
  isDesktop: boolean;
}) {
  const activa = agencia.estado === 'ACTIVA';
  const conPrecio = Object.keys(agencia.tarifas).length;

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 12, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        aria-expanded={abierta}
        style={{
          all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
          width: '100%', boxSizing: 'border-box', padding: isDesktop ? '18px 24px' : '16px',
        }}
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: activa ? 'var(--status-bien-dot)' : 'var(--status-critico-dot)',
          }}
          aria-hidden
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{agencia.nombre}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
            {activa ? 'Activa' : 'Suspendida'} · {agencia.moneda} · {conPrecio} de {habitaciones.length} habitaciones con precio
          </span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>{abierta ? 'Cerrar' : 'Editar'}</span>
      </button>

      {abierta && <DetalleAgencia agencia={agencia} habitaciones={habitaciones} onActualizada={onActualizada} />}
    </div>
  );
}

function DetalleAgencia({
  agencia, habitaciones, onActualizada,
}: {
  agencia: Agencia;
  habitaciones: string[];
  onActualizada: (a: Agencia) => void;
}) {
  const { handleUnauthorized } = useAuth();
  const [tarifas, setTarifas] = useState<Record<string, string>>(() =>
    Object.fromEntries(habitaciones.map((r) => [r, agencia.tarifas[r] != null ? String(agencia.tarifas[r]) : ''])),
  );
  const [suplemento, setSuplemento] = useState(
    agencia.suplemento_media_pension != null ? String(agencia.suplemento_media_pension) : '',
  );
  const [minNoches, setMinNoches] = useState(String(agencia.min_noches));
  const [contacto, setContacto] = useState(agencia.contacto?.email ?? '');
  const [notas, setNotas] = useState(agencia.notas ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [accesos, setAccesos] = useState<AgenciaAcceso[] | null>(null);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [claveNueva, setClaveNueva] = useState<{ email: string; clave: string } | null>(null);
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargarAccesos = useCallback(() => {
    getAgencia(agencia.agency_id)
      .then((r) => setAccesos(r.accesos))
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) { handleUnauthorized(); return; }
        setAccesos([]);
      });
  }, [agencia.agency_id, handleUnauthorized]);

  useEffect(() => { cargarAccesos(); }, [cargarAccesos]);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      const precios: Record<string, number> = {};
      for (const [room, valor] of Object.entries(tarifas)) {
        if (valor.trim() !== '') precios[room] = Number(valor);
      }
      const r = await actualizarAgencia(agencia.agency_id, {
        Tarifas: precios,
        MinNoches: Number(minNoches) || 1,
        // Vacío = no vende media pensión (null), no "la regala" (0).
        SuplementoMediaPension: suplemento.trim() === '' ? null : Number(suplemento),
        Contacto: { Email: contacto.trim() },
        Notas: notas,
      });
      onActualizada(r.agencia);
      setOk(true);
    } catch (e: unknown) {
      if (e instanceof UnauthorizedError) { handleUnauthorized(); return; }
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado() {
    const nuevo = agencia.estado === 'ACTIVA' ? 'SUSPENDIDA' : 'ACTIVA';
    setGuardando(true);
    setError(null);
    try {
      const r = await actualizarAgencia(agencia.agency_id, { Estado: nuevo });
      onActualizada(r.agencia);
    } catch (e: unknown) {
      if (e instanceof UnauthorizedError) { handleUnauthorized(); return; }
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.');
    } finally {
      setGuardando(false);
    }
  }

  async function crearAcceso() {
    setOcupado(true);
    setErrorAcceso(null);
    try {
      const r = await crearAccesoAgencia(agencia.agency_id, nuevoEmail.trim());
      setClaveNueva({ email: r.email, clave: r.clave_temporal });
      setNuevoEmail('');
      cargarAccesos();
    } catch (e: unknown) {
      if (e instanceof UnauthorizedError) { handleUnauthorized(); return; }
      setErrorAcceso(e instanceof Error ? e.message : 'No se pudo crear el acceso.');
    } finally {
      setOcupado(false);
    }
  }

  async function gestionar(email: string, accion: 'resetear' | 'deshabilitar' | 'habilitar') {
    setOcupado(true);
    setErrorAcceso(null);
    try {
      const r = await gestionarAccesoAgencia(agencia.agency_id, email, accion);
      if (r.clave_temporal) setClaveNueva({ email: r.email, clave: r.clave_temporal });
      cargarAccesos();
    } catch (e: unknown) {
      if (e instanceof UnauthorizedError) { handleUnauthorized(); return; }
      setErrorAcceso(e instanceof Error ? e.message : 'No se pudo aplicar el cambio.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: 24, background: '#fcfcfd' }}>
      <TablaTarifas habitaciones={habitaciones} valores={tarifas} onCambio={setTarifas} moneda={agencia.moneda} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginTop: 20 }}>
        <div>
          <label style={etiqueta}>Media pensión, por noche</label>
          <input
            style={campo}
            inputMode="numeric"
            value={suplemento}
            onChange={(e) => setSuplemento(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="Vacío = no la vende"
          />
        </div>
        <div>
          <label style={etiqueta}>Mínimo de noches</label>
          <input style={campo} inputMode="numeric" value={minNoches} onChange={(e) => setMinNoches(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div>
          <label style={etiqueta}>Correo de contacto</label>
          <input style={campo} value={contacto} onChange={(e) => setContacto(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={etiqueta}>Notas internas — la agencia no las ve</label>
        <textarea style={{ ...campo, minHeight: 60, resize: 'vertical' }} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>

      {error && <div style={{ fontSize: 13, color: 'var(--status-critico-dot)', marginTop: 14 }}>{error}</div>}
      {ok && <div style={{ fontSize: 13, color: 'var(--status-bien-dot)', marginTop: 14 }}>Guardado.</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
        <Boton tono="fuerte" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Boton>
        <Boton tono={agencia.estado === 'ACTIVA' ? 'peligro' : 'suave'} onClick={cambiarEstado} disabled={guardando}>
          {agencia.estado === 'ACTIVA' ? 'Suspender agencia' : 'Reactivar agencia'}
        </Boton>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 8 }}>
        Suspender corta la venta al instante y conserva su historial. Última edición: {fmtFecha(agencia.actualizado_en)}.
      </div>

      {/* ------------------------------------------------------ accesos -- */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Accesos de la agencia</div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 16 }}>
          Cada persona entra con su propio correo y ve solo las reservas de esta agencia.
        </div>

        {claveNueva && (
          <div
            style={{
              background: 'var(--status-atencion-bg)', borderRadius: 'var(--radius-sm)',
              padding: 14, marginBottom: 16, fontSize: 13, color: 'var(--text)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Clave temporal para {claveNueva.email}</div>
            <code style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.04em' }}>{claveNueva.clave}</code>
            <div style={{ marginTop: 8, color: 'var(--text-sub)' }}>
              Entrégasela por un canal seguro. No se guarda en ningún lado y no la vas a poder ver de nuevo:
              si se pierde, se resetea. Al entrar por primera vez, la agencia debe cambiarla.
            </div>
            <div style={{ marginTop: 10 }}>
              <Boton onClick={() => setClaveNueva(null)}>Ya la copié</Boton>
            </div>
          </div>
        )}

        {accesos && accesos.map((acceso) => (
          <div
            key={acceso.email}
            style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
              padding: '10px 0', borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ flex: 1, minWidth: 180, fontSize: 13, color: 'var(--text)' }}>
              {acceso.email}
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>
                {acceso.habilitado ? (ESTADO_ACCESO[acceso.estado] ?? acceso.estado) : 'Deshabilitada'}
              </span>
            </span>
            <Boton onClick={() => gestionar(acceso.email, 'resetear')} disabled={ocupado}>Resetear clave</Boton>
            <Boton
              tono={acceso.habilitado ? 'peligro' : 'suave'}
              onClick={() => gestionar(acceso.email, acceso.habilitado ? 'deshabilitar' : 'habilitar')}
              disabled={ocupado}
            >
              {acceso.habilitado ? 'Deshabilitar' : 'Habilitar'}
            </Boton>
          </div>
        ))}

        {accesos && accesos.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>
            Todavía no tiene ningún acceso creado.
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          <input
            style={{ ...campo, flex: 1, minWidth: 200, width: 'auto' }}
            value={nuevoEmail}
            onChange={(e) => setNuevoEmail(e.target.value)}
            placeholder="correo@agencia.cl"
          />
          <Boton tono="fuerte" onClick={crearAcceso} disabled={ocupado || !nuevoEmail.trim()}>Crear acceso</Boton>
        </div>
        {errorAcceso && <div style={{ fontSize: 13, color: 'var(--status-critico-dot)', marginTop: 10 }}>{errorAcceso}</div>}
      </div>

      {Object.keys(agencia.tarifas).length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 20 }}>
          Precio más bajo hoy: {money(Math.min(...Object.values(agencia.tarifas)), agencia.moneda)} por noche.
        </div>
      )}
    </div>
  );
}
