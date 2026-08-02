import { useState, useEffect, useCallback } from 'react';
import { SectionHead } from '../components/SectionHead';
import { GuestCard, hasAlert } from '../components/GuestCard';
import { AsyncState } from '../components/AsyncState';
import { StatusDot } from '../components/StatusDot';
import { getLlegadas, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import type { LlegadaGuest } from '../types';

export function DetailScreen({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [llegadas, setLlegadas] = useState<LlegadaGuest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getLlegadas()
      .then((r) => setLlegadas(r.llegadas))
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

  const alertG = (llegadas ?? []).filter(hasAlert);
  const clearG = (llegadas ?? []).filter((g) => !hasAlert(g));

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 60px' : '20px 16px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
              Operación
            </div>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Llegadas próximas 48 hrs
            </h1>
          </div>
          {llegadas && (
            <StatusDot status={alertG.length > 0 ? 'atencion' : 'bien'} label={alertG.length > 0 ? `${alertG.length} requieren atención` : 'Sin novedades'} />
          )}
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {llegadas && llegadas.length === 0 && (
            <div
              style={{
                background: 'var(--white)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Sin llegadas en las próximas 48 horas</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Ninguna reserva real hace check-in en esta ventana ahora mismo.</div>
            </div>
          )}

          {llegadas && llegadas.length > 0 && (
            <div
              style={{
                display: isDesktop ? 'grid' : 'flex',
                gridTemplateColumns: isDesktop ? '1fr 1fr' : undefined,
                flexDirection: !isDesktop ? 'column' : undefined,
                gap: isDesktop ? 24 : 14,
                alignItems: 'start',
              }}
            >
              {alertG.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SectionHead>Requieren atención</SectionHead>
                  {alertG.map((g) => (
                    <GuestCard key={g.BookingID} guest={g} isDesktop={isDesktop} />
                  ))}
                </div>
              )}
              {clearG.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SectionHead>Sin novedades</SectionHead>
                  {clearG.map((g) => (
                    <GuestCard key={g.BookingID} guest={g} isDesktop={isDesktop} />
                  ))}
                </div>
              )}
            </div>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
