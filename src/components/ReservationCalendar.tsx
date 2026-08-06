import { useMemo, useState } from 'react';
import { AsyncState } from './AsyncState';
import type { ReservaResumenItem } from '../types';

const STATUS_COLOR: Record<string, { bg: string; dot: string }> = {
  CONFIRMED: { bg: 'var(--status-bien-bg)', dot: 'var(--status-bien-dot)' },
  PENDING: { bg: 'var(--status-atencion-bg)', dot: 'var(--status-atencion-dot)' },
  CANCELLED: { bg: 'var(--status-critico-bg)', dot: 'var(--status-critico-dot)' },
};
const STATUS_LABEL: Record<string, string> = { CONFIRMED: 'Confirmada', PENDING: 'Pendiente', CANCELLED: 'Cancelada' };

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

// Grilla lunes-a-domingo (convención es-CL) para el mes visible. Cada
// celda es un día real (o null de relleno antes/después del mes) - las
// reservas se agrupan por CheckIn, no por el rango completo de la
// estadía/programa: lo que este calendario responde es "¿qué día llega
// gente?", no ocupación noche a noche (eso es RoomGrid, que no aplica acá).
function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0 = lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function fmtDateLarga(d: Date): string {
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Reservas reales confirmadas por la web (Directa Web), agrupadas en un
// calendario mensual - reemplaza la "Ocupación de Habitaciones" para un
// cliente que vende programas guiados (Chile Fly Fishing), no cabañas:
// no hay noches que ocupar, hay salidas que agendar.
//
// seasonStart/seasonEnd son opcionales (2026-08-06, pedido explícito de
// Mato: "el PMS debiera siempre mostrar el calendario... para ver que
// fechas disponibles quedan en la temporada") - cuando vienen, el
// calendario arranca en el mes vigente de la temporada (o en su inicio si
// hoy cae fuera de ella) y la navegación no deja salirse de esos límites.
// Sin esos props el componente se comporta exactamente igual que antes
// (mes actual, navegación libre) - no es una restricción nueva para
// ningún otro cliente.
export function ReservationCalendar({
  reservas,
  loading,
  error,
  onRetry,
  seasonStart,
  seasonEnd,
}: {
  reservas: ReservaResumenItem[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  seasonStart?: Date;
  seasonEnd?: Date;
}) {
  const today = new Date();
  const dentroDeTemporada = !seasonStart || !seasonEnd || (today >= seasonStart && today <= seasonEnd);
  const inicial = seasonStart && !dentroDeTemporada ? seasonStart : today;
  const [year, setYear] = useState(inicial.getFullYear());
  const [month, setMonth] = useState(inicial.getMonth());
  const todayKey = today.toISOString().slice(0, 10);

  const porDia = useMemo(() => {
    const map = new Map<string, ReservaResumenItem[]>();
    for (const r of reservas ?? []) {
      if (r.Status === 'CANCELLED') continue;
      const list = map.get(r.CheckIn) ?? [];
      list.push(r);
      map.set(r.CheckIn, list);
    }
    return map;
  }, [reservas]);

  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const visibleKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const delMes = (reservas ?? [])
    .filter((r) => r.Status !== 'CANCELLED' && monthKey(r.CheckIn) === visibleKey)
    .sort((a, b) => a.CheckIn.localeCompare(b.CheckIn));

  const monthLabel = new Date(year, month, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const puedeAnterior = !seasonStart || new Date(year, month - 1, 1) >= new Date(seasonStart.getFullYear(), seasonStart.getMonth(), 1);
  const puedeSiguiente = !seasonEnd || new Date(year, month, 1) < new Date(seasonEnd.getFullYear(), seasonEnd.getMonth(), 1);

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  return (
    <AsyncState loading={loading} error={error} onRetry={onRetry}>
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-7)', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{monthLabelCap}</div>
            {seasonStart && seasonEnd && (
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                Temporada {fmtDateLarga(seasonStart)} – {fmtDateLarga(seasonEnd)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => shiftMonth(-1)}
              disabled={!puedeAnterior}
              aria-label="Mes anterior"
              style={{ all: 'unset', cursor: puedeAnterior ? 'pointer' : 'default', opacity: puedeAnterior ? 1 : 0.3, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-sub)' }}
            >
              ←
            </button>
            <button
              onClick={() => shiftMonth(1)}
              disabled={!puedeSiguiente}
              aria-label="Mes siguiente"
              style={{ all: 'unset', cursor: puedeSiguiente ? 'pointer' : 'default', opacity: puedeSiguiente ? 1 : 0.3, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-sub)' }}
            >
              →
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase' }}>
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {weeks.flatMap((week, wi) =>
            week.map((day, di) => {
              if (!day) return <div key={`${wi}-${di}`} />;
              const key = day.toISOString().slice(0, 10);
              const items = porDia.get(key) ?? [];
              const isToday = key === todayKey;
              const fueraDeTemporada = !!(seasonStart && seasonEnd) && (day < seasonStart || day > seasonEnd);
              const disponible = !fueraDeTemporada && items.length === 0;
              return (
                <div
                  key={key}
                  title={
                    fueraDeTemporada
                      ? 'Fuera de temporada'
                      : items.length
                        ? items.map((r) => `${r.GuestName} · ${r.RoomID}`).join('\n')
                        : 'Disponible'
                  }
                  style={{
                    aspectRatio: '1',
                    borderRadius: 'var(--radius-sm)',
                    border: isToday ? '1.5px solid var(--primary)' : '1px solid var(--border-soft)',
                    background: fueraDeTemporada
                      ? 'var(--surface-2, transparent)'
                      : items.length
                        ? 'var(--status-atencion-bg)'
                        : 'var(--status-bien-bg)',
                    opacity: fueraDeTemporada ? 0.35 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    padding: 2,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--primary)' : 'var(--text-sub)' }}>{day.getDate()}</span>
                  {items.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--status-atencion-dot)' }}>{items.length}</span>
                  )}
                  {disponible && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--status-bien-dot)' }}>libre</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--text-faint)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--status-bien-bg)', border: '1px solid var(--status-bien-dot)', display: 'inline-block' }} />
            Disponible
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--status-atencion-bg)', border: '1px solid var(--status-atencion-dot)', display: 'inline-block' }} />
            Con reserva
          </span>
          {seasonStart && seasonEnd && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--surface-2, transparent)', opacity: 0.35, border: '1px solid var(--border-soft)', display: 'inline-block' }} />
              Fuera de temporada
            </span>
          )}
        </div>

        <div style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--border-soft)', paddingTop: 'var(--space-6)' }}>
          {delMes.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin reservas de la web para {monthLabelCap.toLowerCase()}.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {delMes.map((r) => {
                const sc = STATUS_COLOR[r.Status];
                return (
                  <div key={r.BookingID} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 90 }}>{fmtDate(r.CheckIn)}</span>
                    <span style={{ color: 'var(--text)', flex: 1 }}>
                      {r.GuestName} · {r.RoomID}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: sc?.bg ?? 'var(--status-neutro-bg)', color: sc?.dot ?? 'var(--status-neutro-text)' }}>
                      {STATUS_LABEL[r.Status] ?? r.Status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AsyncState>
  );
}
