import { useState, useEffect, useCallback, useMemo } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { SearchIcon, UsersIcon } from '../../components/icons/RockyIcons';
import { getHuespedes, getReservasResumen, actualizarHuesped, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import { terminologiaPms } from '../../lib/terminologiaPms';
import { telefonoDe, enlaceWhatsapp } from '../../lib/contactoHuesped';
import type { HuespedItem, ReservaResumenItem } from '../../types';

const PAGE_SIZE = 20;

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDiaMes(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' };

// Las notas de perfil son texto libre, igual que las de una reserva - se
// listan con el mismo criterio que BookingDetailModal.tsx.
function enBullets(texto: string): string[] {
  return texto
    .split(/\r?\n|·|;/)
    .map((n) => n.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
}

interface FilaHuesped extends HuespedItem {
  reservas: ReservaResumenItem[];
  proxima: ReservaResumenItem | null;
}

// Segundo acceso del PMS en el panel del cliente (2026-08-11, pedido
// explícito de Mato: "el PMS en el panel de cada cliente debe ser un
// servicio con varios accesos: Calendario de Reservas, Huespedes (para
// alto castillo), Pescadores para ChileFlyFishing"). El nombre de la
// pantalla lo decide terminologiaPms() por client_id.
//
// Cruza dos fuentes REALES: el perfil (GET /dashboard/huespedes, GSI1 de
// rockybrand-pms-core) y las reservas que ya carga el calendario. El
// cruce se hace acá y no en el backend porque las reservas vienen con la
// ventana de días hacia adelante que cada cliente tiene configurada
// (get_pms_lookahead_days) - o sea "sus reservas" acá significa "las
// reservas dentro de esa ventana", y por eso la columna dice "en la
// ventana del panel" y no un total histórico que no estaríamos midiendo.
export function HuespedesLista({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized, clientId, clientDisplayName } = useAuth();
  const t = terminologiaPms(clientId);
  const [huespedes, setHuespedes] = useState<HuespedItem[] | null>(null);
  const [reservas, setReservas] = useState<ReservaResumenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [detalle, setDetalle] = useState<FilaHuesped | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getHuespedes(), getReservasResumen()])
      .then(([h, r]) => {
        setHuespedes(h.huespedes);
        setReservas(r.reservas);
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

  useEffect(() => {
    load();
  }, [load]);

  const hoy = new Date().toISOString().slice(0, 10);

  const filas = useMemo<FilaHuesped[]>(() => {
    const porHuesped = new Map<string, ReservaResumenItem[]>();
    for (const r of reservas) {
      if (!r.GuestID) continue;
      const list = porHuesped.get(r.GuestID) ?? [];
      list.push(r);
      porHuesped.set(r.GuestID, list);
    }
    return (huespedes ?? []).map((h) => {
      const suyas = (porHuesped.get(h.GuestID) ?? []).sort((a, b) => a.CheckIn.localeCompare(b.CheckIn));
      const proxima = suyas.find((r) => r.Status !== 'CANCELLED' && r.CheckIn >= hoy) ?? null;
      return { ...h, reservas: suyas, proxima };
    });
  }, [huespedes, reservas, hoy]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(
      (f) =>
        f.FullName.toLowerCase().includes(q) ||
        (f.Contact.Email ?? '').toLowerCase().includes(q) ||
        (f.OriginCountry ?? '').toLowerCase().includes(q)
    );
  }, [filas, search]);

  const pageCount = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pageItems = filtradas.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const conProxima = filas.filter((f) => f.proxima).length;
  const paises = new Set(filas.map((f) => f.OriginCountry).filter(Boolean)).size;

  const col = (w: number, extra?: React.CSSProperties): React.CSSProperties => ({ flexShrink: 0, width: w, ...extra });

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div
          style={{
            paddingBottom: 'var(--space-7)',
            borderBottom: '1px solid var(--border)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {t.navPersonas}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
            Todas las personas registradas en el {t.navSeccion} de {clientDisplayName ?? 'tu negocio'}.
          </div>
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {huespedes && huespedes.length === 0 && (
            <EmptyStateIllustrated
              icon={<UsersIcon size={36} />}
              title={`Aún no hay ${t.personasMinuscula}`}
              description={`Cada reserva nueva crea su ficha acá con el contacto, el país de origen y las notas del viaje.`}
            />
          )}

          {huespedes && huespedes.length > 0 && (
            <>
              <div className="crm-mini-dash">
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Total registrados</div>
                  <div className="crm-mini-value">{filas.length}</div>
                </div>
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Con llegada próxima</div>
                  <div className="crm-mini-value">{conProxima}</div>
                  <div className="crm-mini-sub">Dentro de la ventana de reservas del panel</div>
                </div>
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Países de origen</div>
                  <div className="crm-mini-value">{paises}</div>
                </div>
              </div>

              <div style={{ marginBottom: 'var(--space-7)' }}>
                <div className="crm-search-wrap" style={{ width: isDesktop ? 320 : '100%' }}>
                  <SearchIcon size={14} color="var(--text-faint)" />
                  <input
                    className="crm-search"
                    placeholder={`Buscar por nombre, email o país…`}
                    aria-label={`Buscar ${t.personasMinuscula}`}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
              </div>

              {filtradas.length === 0 ? (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nadie coincide con la búsqueda.
                </div>
              ) : (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {isDesktop && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#f9fafb',
                        borderBottom: '1px solid var(--border)',
                        padding: '12px 24px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-sub)',
                      }}
                    >
                      <span style={col(190)}>{t.columnaPersona}</span>
                      <span style={col(220)}>Contacto</span>
                      <span style={col(120)}>País</span>
                      <span style={col(120)}>Fechas</span>
                      <span style={col(80, { textAlign: 'center' })}>Reservas</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>Próxima llegada</span>
                    </div>
                  )}
                  {pageItems.map((f) => (
                    <div
                      key={f.GuestID}
                      onClick={() => setDetalle(f)}
                      style={{
                        display: 'flex',
                        flexDirection: isDesktop ? 'row' : 'column',
                        alignItems: isDesktop ? 'center' : 'flex-start',
                        gap: isDesktop ? 0 : 4,
                        padding: isDesktop ? '16px 24px' : '14px 16px',
                        borderBottom: '1px solid var(--border-soft)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={isDesktop ? col(190, { fontWeight: 600, color: 'var(--text)', fontSize: 14 }) : { fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>
                        {f.FullName}
                      </span>
                      <span style={isDesktop ? col(220, { fontSize: 13, color: 'var(--text-sub)' }) : { fontSize: 12, color: 'var(--text-muted)' }}>
                        {f.Contact.Email || telefonoDe(f.Contact) || '—'}
                      </span>
                      <span style={isDesktop ? col(120, { fontSize: 13, color: 'var(--text-sub)' }) : { fontSize: 12, color: 'var(--text-muted)' }}>
                        {f.OriginCountry || '—'}
                      </span>
                      <span style={isDesktop ? col(120, { fontSize: 12, color: 'var(--text-sub)' }) : { fontSize: 12, color: 'var(--text-muted)' }}>
                        {f.BirthDate || f.AnniversaryDate ? (
                          <>
                            {f.BirthDate && <span title="Cumpleaños">🎂 {fmtDiaMes(f.BirthDate)}</span>}
                            {f.BirthDate && f.AnniversaryDate && ' '}
                            {f.AnniversaryDate && <span title="Aniversario">💛 {fmtDiaMes(f.AnniversaryDate)}</span>}
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-faint)' }}>—</span>
                        )}
                      </span>
                      <span style={isDesktop ? col(80, { fontSize: 14, color: 'var(--text-sub)', textAlign: 'center' }) : { fontSize: 12, color: 'var(--text-muted)' }}>
                        {isDesktop ? f.reservas.length : `${f.reservas.length} reserva${f.reservas.length === 1 ? '' : 's'}`}
                      </span>
                      <span
                        style={
                          isDesktop
                            ? { flex: 1, textAlign: 'right', fontSize: 13, color: f.proxima ? 'var(--text)' : 'var(--text-muted)', fontWeight: f.proxima ? 600 : 400 }
                            : { fontSize: 12, color: 'var(--text-muted)' }
                        }
                      >
                        {f.proxima ? fmtDate(f.proxima.CheckIn) : '—'}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-7)' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                      Mostrando {pageSafe * PAGE_SIZE + 1}–{Math.min(filtradas.length, pageSafe * PAGE_SIZE + PAGE_SIZE)} de {filtradas.length}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="crm-btn crm-btn-ghost crm-btn-sm"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={pageSafe === 0}
                      >
                        Anterior
                      </button>
                      <button
                        className="crm-btn crm-btn-ghost crm-btn-sm"
                        onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                        disabled={pageSafe >= pageCount - 1}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </AsyncState>
      </div>

      {detalle && (
        <DetalleHuesped
          fila={detalle}
          onClose={() => setDetalle(null)}
          onGuardado={() => {
            setDetalle(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function DetalleHuesped({ fila, onClose, onGuardado }: { fila: FilaHuesped; onClose: () => void; onGuardado: () => void }) {
  const { handleUnauthorized } = useAuth();
  const [editando, setEditando] = useState(false);
  const [birth, setBirth] = useState(fila.BirthDate ?? '');
  const [anniv, setAnniv] = useState(fila.AnniversaryDate ?? '');
  const [guardando, setGuardando] = useState(false);
  const [errorFechas, setErrorFechas] = useState('');

  async function guardarFechas() {
    setGuardando(true);
    setErrorFechas('');
    try {
      await actualizarHuesped(fila.GuestID, { BirthDate: birth, AnniversaryDate: anniv });
      onGuardado();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setErrorFechas(e instanceof Error ? e.message : 'No se pudieron guardar las fechas.');
    } finally {
      setGuardando(false);
    }
  }

  const notas = [
    ...fila.DietaryRestrictions.map((d) => `Alimentación: ${d}`),
    ...(fila.MobilityNotes ? [`Movilidad: ${fila.MobilityNotes}`] : []),
    ...(fila.SpecialNotes ? enBullets(fila.SpecialNotes) : []),
  ];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
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
        style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-card-hover)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{fila.FullName}</h2>
            {fila.VIP_Tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {fila.VIP_Tags.map((tag) => (
                  <span key={tag} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--status-neutro-bg)', color: 'var(--status-neutro-text)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ all: 'unset', cursor: 'pointer', fontSize: 22, color: 'var(--text-faint)', lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
          <div>
            <div style={fieldLabel}>Email</div>
            <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 4, wordBreak: 'break-all' }}>{fila.Contact.Email || '—'}</div>
          </div>
          <div>
            <div style={fieldLabel}>WhatsApp</div>
            <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 4 }}>
              {enlaceWhatsapp(fila.Contact) ? (
                <a href={enlaceWhatsapp(fila.Contact)!} target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                  {telefonoDe(fila.Contact)}
                </a>
              ) : (telefonoDe(fila.Contact) || '—')}
            </div>
          </div>
          <div>
            <div style={fieldLabel}>País de origen</div>
            <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 4 }}>{fila.OriginCountry || '—'}</div>
          </div>
          <div>
            <div style={fieldLabel}>Reservas en el panel</div>
            <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 4 }}>{fila.reservas.length}</div>
          </div>
        </div>


        <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={fieldLabel}>Fechas importantes</div>
            {!editando && (
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setEditando(true)}>
                {fila.BirthDate || fila.AnniversaryDate ? 'Editar' : 'Agregar'}
              </button>
            )}
          </div>

          {editando ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                <div>
                  <label style={fieldLabel} htmlFor="hu-birth">Cumpleaños</label>
                  <input
                    id="hu-birth"
                    type="date"
                    value={birth}
                    onChange={(e) => setBirth(e.target.value)}
                    style={{ width: '100%', marginTop: 4, fontSize: 14, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', fontFamily: 'inherit', background: 'var(--white)', color: 'var(--text)' }}
                  />
                </div>
                <div>
                  <label style={fieldLabel} htmlFor="hu-anniv">Aniversario</label>
                  <input
                    id="hu-anniv"
                    type="date"
                    value={anniv}
                    onChange={(e) => setAnniv(e.target.value)}
                    style={{ width: '100%', marginTop: 4, fontSize: 14, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', fontFamily: 'inherit', background: 'var(--white)', color: 'var(--text)' }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
                El año queda guardado pero no se usa para avisar: cada año la fecha vuelve a aparecer sola en el
                Resumen. Dejar el campo vacío borra la fecha.
              </div>
              {errorFechas && <div style={{ fontSize: 12, color: 'var(--status-critico-dot)', marginTop: 8 }}>{errorFechas}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => void guardarFechas()} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  className="crm-btn crm-btn-ghost crm-btn-sm"
                  onClick={() => {
                    setEditando(false);
                    setBirth(fila.BirthDate ?? '');
                    setAnniv(fila.AnniversaryDate ?? '');
                    setErrorFechas('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 8, fontSize: 14, color: 'var(--text)' }}>
              <span>🎂 Cumpleaños: {fila.BirthDate ? fmtDate(fila.BirthDate) : <span style={{ color: 'var(--text-faint)' }}>sin cargar</span>}</span>
              <span>💛 Aniversario: {fila.AnniversaryDate ? fmtDate(fila.AnniversaryDate) : <span style={{ color: 'var(--text-faint)' }}>sin cargar</span>}</span>
            </div>
          )}
        </div>

        {notas.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)' }}>
            <div style={fieldLabel}>Notas</div>
            <ul style={{ fontSize: 14, color: 'var(--text)', margin: '8px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.5 }}>
              {notas.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {fila.reservas.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)' }}>
            <div style={fieldLabel}>Sus reservas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {fila.reservas.map((r) => (
                <div key={r.BookingID} style={{ display: 'flex', gap: 10, fontSize: 13, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 100 }}>{fmtDate(r.CheckIn)}</span>
                  <span style={{ flex: 1, color: 'var(--text-sub)' }}>{r.RoomID}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.Status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
