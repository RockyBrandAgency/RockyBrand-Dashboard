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

// Detalle real de SEO/Search Console (seo_snapshot#, search_console_snapshot#)
// - pedido explícito de Mato (2026-08-01). "Website" y "SEO" son la misma
// fuente de datos real (confirmado con Mato) - un solo canal, no dos
// páginas separadas.
export function MetricasSeo({ isDesktop }: { isDesktop: boolean }) {
  const [days, setDays] = useState<DateRangeDays>(30);
  const { data, loading, error, reload } = useMetricsReport(days);
  const seo = data?.seo;

  const handleExport = () => {
    if (!seo) return;
    const rows: (string | number | null)[][] = [
      ['SEO', `últimos ${days} días`],
      [],
      ['Posición promedio', seo.posicion_actual],
      ['Clics orgánicos (último dato)', seo.clics_organicos_actual],
      [],
      ['Clics orgánicos'],
      ['Fecha', 'Clics'],
      ...seo.clicks_snapshots.map((s) => [s.fecha, s.clics]),
      [],
      ['Impresiones'],
      ['Fecha', 'Impresiones'],
      ...seo.impressions_snapshots.map((s) => [s.fecha, s.impresiones]),
      [],
      ['Keywords'],
      ['Keyword', 'Posición', 'Cambio', 'Impresiones'],
      ...seo.keyword_matrix.map((row) => [row.keyword, row.posicion_actual, row.delta, row.impresiones]),
    ];
    downloadCsv(`metricas-seo-${days}d.csv`, rows);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <MetricsPageHeader
          breadcrumb="Métricas > SEO"
          title="SEO"
          isDesktop={isDesktop}
          days={days}
          onDaysChange={setDays}
          onExport={handleExport}
          exportDisabled={!seo}
        />

        <AsyncState loading={loading} error={error} onRetry={reload}>
          {seo && (
            <>
              <div style={{ marginBottom: 28 }}>
                <KpiRow
                  items={[
                    { label: 'Posición promedio', value: seo.posicion_actual, sub: seo.keyword ?? undefined },
                    { label: 'Clics orgánicos (último dato)', value: seo.clics_organicos_actual },
                  ]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 20 }}>
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Clics orgánicos</div>
                  <LineChart
                    points={seo.clicks_snapshots.map((s) => ({ fecha: s.fecha, valor: s.clics }))}
                    color="#34A853"
                    formatDate={formatDateShort}
                  />
                </div>
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Impresiones</div>
                  <LineChart
                    points={seo.impressions_snapshots.map((s) => ({ fecha: s.fecha, valor: s.impresiones }))}
                    color="#4285F4"
                    formatDate={formatDateShort}
                  />
                </div>
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '18px 16px 6px' }}>Keywords</div>
                {seo.keyword_matrix.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Sin keywords registradas todavía</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Keyword</th>
                          <th style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Posición</th>
                          <th style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Cambio</th>
                          <th style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Impresiones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seo.keyword_matrix.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                            <td style={{ padding: '10px 16px', color: 'var(--text)' }}>{row.keyword}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)' }}>{row.posicion_actual ?? '—'}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: row.delta && row.delta > 0 ? 'var(--status-bien-text)' : row.delta && row.delta < 0 ? 'var(--status-critico-text)' : 'var(--text-muted)' }}>
                              {row.delta !== null ? (row.delta > 0 ? `+${row.delta}` : row.delta) : '—'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)' }}>{row.impresiones ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
