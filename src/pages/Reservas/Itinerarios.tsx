import { useState, useEffect, useCallback, useMemo } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { TabsWithIndicator } from '../../components/TabsWithIndicator';
import { CalendarRangeIcon } from '../../components/icons/RockyIcons';
import { DiaItinerarioModal } from '../../components/DiaItinerarioModal';
import { getItinerarios, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import { terminologiaPms } from '../../lib/terminologiaPms';
import { isoLocal } from '../../lib/fechasImportantes';
import type { ItinerarioDia, ItinerarioReserva, TipoDeAgua } from '../../types';

const AGUA_LABEL: Record<TipoDeAgua, string> = { '': '', rio: 'Río', lago: 'Lago', laguna: 'Laguna' };

type Vista = 'expediciones' | 'dias';

function fmtDiaCorto(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDiaLargo(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtCorta(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

// Un día "tiene algo" con los mismos criterios que pms_itinerario.tiene_registro.
// Vive acá además del backend porque la pantalla lo necesita por fila y pedirlo
// por fila sería una llamada por día; la regla es la misma y es de una sola línea.
function tieneRegistro(d: ItinerarioDia): boolean {
  return Boolean(d.Guia || d.Agua.Tipo || d.Agua.Nombre || d.HoraSalida || d.HoraRegreso || d.Notas || d.TruchasPescadas !== null);
}

function aguaTexto(d: ItinerarioDia): string {
  const tipo = AGUA_LABEL[d.Agua.Tipo] || '';
  if (d.Agua.Nombre && tipo) return `${d.Agua.Nombre} · ${tipo}`;
  return d.Agua.Nombre || tipo;
}

function horarioTexto(d: ItinerarioDia): string {
  if (d.HoraSalida && d.HoraRegreso) return `${d.HoraSalida} → ${d.HoraRegreso}`;
  if (d.HoraSalida) return `Sale ${d.HoraSalida}`;
  if (d.HoraRegreso) return `Vuelve ${d.HoraRegreso}`;
  return '';
}

const vacio = <span style={{ color: 'var(--text-faint)' }}>—</span>;

// Itinerarios: el plan de cada jornada y lo que de verdad pasó (2026-08-17,
// pedido explícito de Mato: "plan + bitácora por día y por reserva — guía,
// agua, hora de salida, hora de regreso, truchas pescadas, notas").
//
// Hoy lo carga UNA sola persona desde el panel. No hay roles de guía ni
// usuarios de guías en Cognito y no se van a crear ahora: es una decisión,
// no una omisión. El día que existan, esta pantalla no cambia.
//
// Las DOS vistas responden preguntas distintas y por eso son dos y no una:
// "¿cómo viene esta expedición?" se contesta agrupando por reserva; "¿quién
// sale hoy y a qué río?" se contesta agrupando por fecha. Los mismos datos,
// leídos por los dos ejes que se usan de verdad.
export function Itinerarios({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized, clientId } = useAuth();
  const t = terminologiaPms(clientId);
  const [itinerarios, setItinerarios] = useState<ItinerarioReserva[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('expediciones');
  const [editando, setEditando] = useState<{ reserva: ItinerarioReserva; dia: ItinerarioDia } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getItinerarios()
      .then((r) => setItinerarios(r.itinerarios))
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

  const hoyIso = useMemo(() => isoLocal(new Date()), []);
  const lista = itinerarios ?? [];

  // Vista "Día a día": una fila por (fecha, expedición), ordenada por fecha.
  // Se arma sobre lo mismo que la otra vista, no sobre otra llamada.
  const porDia = useMemo(() => {
    const mapa = new Map<string, { reserva: ItinerarioReserva; dia: ItinerarioDia }[]>();
    for (const r of lista) {
      for (const d of r.dias) {
        const fila = mapa.get(d.Fecha) ?? [];
        fila.push({ reserva: r, dia: d });
        mapa.set(d.Fecha, fila);
      }
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [lista]);

  const totalDias = lista.reduce((n, r) => n + r.resumen.dias_totales, 0);
  const totalCargados = lista.reduce((n, r) => n + r.resumen.dias_cargados, 0);
  const totalTruchas = lista.reduce((n, r) => n + r.resumen.truchas, 0);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ paddingBottom: 'var(--space-7)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-8)' }}>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Itinerarios
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4, lineHeight: 1.5 }}>
            El plan de cada jornada y lo que de verdad pasó: guía, agua, horarios, truchas y notas.
          </div>
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {itinerarios && lista.length === 0 && (
            <EmptyStateIllustrated
              icon={<CalendarRangeIcon size={36} />}
              title="Todavía no hay expediciones que anotar"
              description="Cada reserva activa aparece acá con sus días, listos para cargar. Cuando entre la primera, vas a poder anotar quién guió, en qué agua estuvieron y cómo estuvo el día."
            />
          )}

          {itinerarios && lista.length > 0 && (
            <>
              <div className="crm-mini-dash">
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Expediciones</div>
                  <div className="crm-mini-value">{lista.length}</div>
                  <div className="crm-mini-sub">Reservas activas en la ventana del panel</div>
                </div>
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Jornadas anotadas</div>
                  <div className={`crm-mini-value ${totalCargados === totalDias ? 'ok' : ''}`}>
                    {totalCargados}
                    <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-faint)' }}> / {totalDias}</span>
                  </div>
                  <div className="crm-mini-sub">
                    {totalDias - totalCargados === 0 ? 'No queda ninguna en blanco' : `${totalDias - totalCargados} sin anotar`}
                  </div>
                </div>
                <div className="crm-mini-card">
                  <div className="crm-mini-label">Truchas registradas</div>
                  <div className="crm-mini-value">{totalTruchas}</div>
                  {/* El total suma SOLO los días con conteo. Un día sin
                      registrar no vale cero: vale "todavía no sabemos", y
                      decirlo evita leer el número como una mala temporada. */}
                  <div className="crm-mini-sub">Sobre las jornadas que ya se contaron</div>
                </div>
              </div>

              <TabsWithIndicator<Vista>
                tabs={[
                  { id: 'expediciones', label: 'Por expedición' },
                  { id: 'dias', label: 'Día a día' },
                ]}
                active={vista}
                onChange={setVista}
              />

              {vista === 'expediciones' &&
                lista.map((r) => (
                  <ExpedicionCard
                    key={r.BookingID}
                    reserva={r}
                    hoyIso={hoyIso}
                    isDesktop={isDesktop}
                    personaLabel={t.columnaPersona}
                    onEditar={(dia) => setEditando({ reserva: r, dia })}
                  />
                ))}

              {vista === 'dias' && (
                <DiaADia dias={porDia} hoyIso={hoyIso} isDesktop={isDesktop} onEditar={(reserva, dia) => setEditando({ reserva, dia })} />
              )}
            </>
          )}
        </AsyncState>
      </div>

      {editando && (
        <DiaItinerarioModal
          reserva={editando.reserva}
          dia={editando.dia}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------ por expedición --

function ExpedicionCard({
  reserva,
  hoyIso,
  isDesktop,
  personaLabel,
  onEditar,
}: {
  reserva: ItinerarioReserva;
  hoyIso: string;
  isDesktop: boolean;
  personaLabel: string;
  onEditar: (dia: ItinerarioDia) => void;
}) {
  const { resumen } = reserva;
  const completa = resumen.dias_cargados === resumen.dias_totales;

  return (
    <div className="crm-card">
      <div className="crm-card-head">
        <div>
          <div className="crm-card-title" style={{ fontSize: 15 }}>
            {reserva.GuestName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 3 }}>
            {reserva.RoomID} · {fmtCorta(reserva.CheckIn)} al {fmtCorta(reserva.CheckOut)}
            {reserva.PartyMembers ? ` · ${reserva.PartyMembers} ${personaLabel.toLowerCase()}${reserva.PartyMembers === 1 ? '' : 's'}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={`crm-pill${completa ? ' sent' : ' pending'}`}>
            {resumen.dias_cargados} de {resumen.dias_totales} jornadas
          </span>
          {resumen.dias_con_conteo > 0 && (
            <span className="crm-pill">
              {resumen.truchas} trucha{resumen.truchas === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <div className="crm-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table className="crm-table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>Jornada</th>
              <th style={{ width: 130 }}>Guía</th>
              <th style={{ width: 170 }}>Agua</th>
              <th style={{ width: 130 }}>Horario</th>
              <th className="num" style={{ width: 80 }}>
                Truchas
              </th>
              {isDesktop && <th>Notas</th>}
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {reserva.dias.map((d) => {
              const cargado = tieneRegistro(d);
              const esHoy = d.Fecha === hoyIso;
              return (
                <tr key={d.Fecha}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: esHoy ? 700 : 500, color: 'var(--text)' }}>{fmtDiaCorto(d.Fecha)}</span>
                    {esHoy && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: 'var(--primary)',
                        }}
                      >
                        Hoy
                      </span>
                    )}
                  </td>
                  <td>{d.Guia || vacio}</td>
                  <td>{aguaTexto(d) || vacio}</td>
                  <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{horarioTexto(d) || vacio}</td>
                  {/* Cero se muestra como cero y el vacío como guión: un día
                      sin pique y un día sin anotar no son lo mismo. */}
                  <td className="num" style={{ fontWeight: d.TruchasPescadas ? 700 : 400 }}>
                    {d.TruchasPescadas === null ? vacio : d.TruchasPescadas}
                  </td>
                  {isDesktop && (
                    <td style={{ color: d.Notas ? 'var(--text-sub)' : 'var(--text-faint)', maxWidth: 260 }}>
                      {d.Notas || '—'}
                    </td>
                  )}
                  <td style={{ textAlign: 'right' }}>
                    <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onEditar(d)}>
                      {cargado ? 'Editar' : 'Anotar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ día a día --

function DiaADia({
  dias,
  hoyIso,
  isDesktop,
  onEditar,
}: {
  dias: [string, { reserva: ItinerarioReserva; dia: ItinerarioDia }[]][];
  hoyIso: string;
  isDesktop: boolean;
  onEditar: (reserva: ItinerarioReserva, dia: ItinerarioDia) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {dias.map(([fecha, filas]) => {
        const esHoy = fecha === hoyIso;
        const pasado = fecha < hoyIso;
        return (
          <div key={fecha} className="crm-card" style={esHoy ? { borderColor: 'var(--primary)' } : undefined}>
            <div className="crm-card-head">
              <div className="crm-card-title" style={{ color: pasado && !esHoy ? 'var(--text-sub)' : 'var(--text)' }}>
                {fmtDiaLargo(fecha)}
                {esHoy && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)' }}>
                    Hoy
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {filas.length} expedición{filas.length === 1 ? '' : 'es'} en el agua
              </span>
            </div>
            <div style={{ padding: 'var(--space-6) var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {filas.map(({ reserva, dia }) => (
                <div
                  key={reserva.BookingID}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: isDesktop ? 16 : 8,
                    fontSize: 13,
                    paddingBottom: 'var(--space-5)',
                    borderBottom: '1px solid var(--border-soft)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 150 }}>{reserva.GuestName}</span>
                  <span style={{ color: 'var(--text-sub)', minWidth: 120 }}>{dia.Guia ? `Guía ${dia.Guia}` : 'Sin guía asignado'}</span>
                  <span style={{ color: 'var(--text-sub)', flex: 1, minWidth: 150 }}>{aguaTexto(dia) || 'Agua sin definir'}</span>
                  {horarioTexto(dia) && (
                    <span style={{ color: 'var(--text-sub)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{horarioTexto(dia)}</span>
                  )}
                  {dia.TruchasPescadas !== null && (
                    <span className="crm-pill sent">
                      {dia.TruchasPescadas} trucha{dia.TruchasPescadas === 1 ? '' : 's'}
                    </span>
                  )}
                  <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onEditar(reserva, dia)}>
                    {tieneRegistro(dia) ? 'Editar' : 'Anotar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
