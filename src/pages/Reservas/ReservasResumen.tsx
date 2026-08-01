import { useState, useEffect, useCallback } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { OriginBadge } from '../../components/OriginBadge';
import { getReservasResumen, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { ReservaResumenItem } from '../../types';

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelada',
};

function formatDateRange(checkIn: string, checkOut: string): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  };
  return `${fmt(checkIn)} → ${fmt(checkOut)}`;
}

// "Reservas → Resumen": detalle de las reservas al día (pedido explícito
// de Mato, 2026-08-01) - distinto de "Estado Actual", que es un resumen
// ejecutivo. Esto es el listado/bitácora completo dentro de la ventana
// real que trae el backend (compute_reservas_resumen).
export function ReservasResumen({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [reservas, setReservas] = useState<ReservaResumenItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getReservasResumen()
      .then((r) => setReservas(r.reservas))
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

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Reservas
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Resumen</h1>
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {reservas && reservas.length === 0 && (
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Sin reservas en el período reciente</div>
            </div>
          )}

          {reservas && reservas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reservas.map((r) => (
                <div
                  key={r.BookingID}
                  style={{
                    display: 'flex',
                    flexDirection: isDesktop ? 'row' : 'column',
                    alignItems: isDesktop ? 'center' : 'flex-start',
                    justifyContent: 'space-between',
                    gap: 10,
                    background: 'var(--white)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{r.GuestName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {r.RoomID} · {formatDateRange(r.CheckIn, r.CheckOut)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <OriginBadge source={r.Source} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: r.Status === 'CANCELLED' ? 'var(--status-critico-bg)' : r.Status === 'CONFIRMED' ? 'var(--status-bien-bg)' : 'var(--status-atencion-bg)',
                        color: r.Status === 'CANCELLED' ? 'var(--status-critico-text)' : r.Status === 'CONFIRMED' ? 'var(--status-bien-text)' : 'var(--status-atencion-text)',
                      }}
                    >
                      {STATUS_LABEL[r.Status] ?? r.Status}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', minWidth: 90, textAlign: 'right' }}>
                      {r.Currency} {r.TotalAmount.toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
