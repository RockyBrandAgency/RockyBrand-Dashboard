import { useState } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { LineChart } from '../../components/LineChart';
import { MetricsPageHeader } from '../../components/MetricsPageHeader';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import { downloadCsv } from '../../lib/exportCsv';
import type { DateRangeDays } from '../../components/DateRangeControl';

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

// Detalle real de YouTube (youtube_snapshot#) - pedido explícito de Mato
// (2026-08-01): panel ejecutivo por canal.
export function MetricasYoutube({ isDesktop }: { isDesktop: boolean }) {
  const [days, setDays] = useState<DateRangeDays>(30);
  const { data, loading, error, reload } = useMetricsReport(days);
  const yt = data?.youtube;

  const handleExport = () => {
    if (!yt) return;
    const rows: (string | number | null)[][] = [
      ['Youtube', `últimos ${days} días`],
      [],
      ['Suscriptores actuales', yt.suscriptores_actuales],
      ['Netos 7 días', yt.suscriptores_netos_7d],
      ['Vistas (período)', yt.vistas_periodo],
      ['Minutos vistos', yt.minutos_vistos_periodo],
      [],
      ['Suscriptores en el tiempo'],
      ['Fecha', 'Suscriptores'],
      ...yt.snapshots.map((s) => [s.fecha, s.suscriptores]),
      [],
      ['Videos con más watch time'],
      ['Título', 'Vistas'],
      ...yt.top_videos.map((v) => [typeof v.titulo === 'string' ? v.titulo : '', typeof v.vistas === 'number' ? v.vistas : '']),
    ];
    downloadCsv(`metricas-youtube-${days}d.csv`, rows);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <MetricsPageHeader
          breadcrumb="Métricas > YouTube"
          title="YouTube"
          isDesktop={isDesktop}
          days={days}
          onDaysChange={setDays}
          onExport={handleExport}
          exportDisabled={!yt}
        />

        <AsyncState loading={loading} error={error} onRetry={reload}>
          {yt && (
            <>
              <div style={{ marginBottom: 28 }}>
                <KpiRow
                  items={[
                    { label: 'Suscriptores actuales', value: yt.suscriptores_actuales },
                    { label: 'Netos 7 días', value: yt.suscriptores_netos_7d, signed: true },
                    { label: 'Vistas (período)', value: yt.vistas_periodo },
                    { label: 'Minutos vistos', value: yt.minutos_vistos_periodo },
                  ]}
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-8)', marginBottom: 'var(--space-6)', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Suscriptores en el tiempo</div>
                <LineChart
                  points={yt.snapshots.map((s) => ({ fecha: s.fecha, valor: s.suscriptores }))}
                  color="#FF0000"
                  formatDate={formatDateShort}
                />
              </div>

              {yt.top_videos.length > 0 && (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '18px 16px 6px' }}>Videos con más watch time</div>
                  {yt.top_videos.map((v, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-soft)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }}>
                        {typeof v.titulo === 'string' ? v.titulo : `Video ${i + 1}`}
                      </span>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        {typeof v.vistas === 'number' ? `${v.vistas.toLocaleString('es-CL')} vistas` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
