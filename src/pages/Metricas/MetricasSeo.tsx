import { useState } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { LineChart } from '../../components/LineChart';
import { MetricsPageHeader } from '../../components/MetricsPageHeader';
import { useClientContextLabel } from '../../hooks/useClientContextLabel';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import { downloadCsv } from '../../lib/exportCsv';
import type { DateRangeDays } from '../../components/DateRangeControl';

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

// Solo la ruta: la landing page va debajo de la búsqueda como pista de qué
// página la está atendiendo, y el dominio se repite en las 25 filas.
function rutaDe(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname === '/' ? '/ (portada)' : pathname;
  } catch {
    return url;
  }
}

// Detalle real de SEO/Search Console (seo_snapshot#, search_console_snapshot#)
// - pedido explícito de Mato (2026-08-01). "Website" y "SEO" son la misma
// fuente de datos real (confirmado con Mato) - un solo canal, no dos
// páginas separadas.
export function MetricasSeo({ isDesktop }: { isDesktop: boolean }) {
  const [days, setDays] = useState<DateRangeDays>(30);
  const { data, loading, error, reload } = useMetricsReport(days);
  const seo = data?.seo;
  const contextLabel = useClientContextLabel();
  // El período de la tabla es el de Search Console (la ventana de 7 días que
  // capturó el último snapshot), no el rango que elige el usuario arriba.
  // Decirlo evita leer las 25 filas como si fueran de los 30 días pedidos.
  const periodoTabla = seo?.keyword_matrix[0]?.periodo ?? null;

  const handleExport = () => {
    if (!seo) return;
    const rows: (string | number | null)[][] = [
      ['SEO', `últimos ${days} días`],
      [],
      ['Posición promedio', seo.posicion_actual],
      ['Período medido', seo.posicion_periodo ?? null],
      ['Consultas medidas', seo.keywords_contadas ?? null],
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
      ['Búsquedas en Google', periodoTabla ?? ''],
      ['Búsqueda', 'Posición', 'Cambio', 'Clics', 'Impresiones', 'Página'],
      ...seo.keyword_matrix.map((row) => [
        row.keyword, row.posicion_actual, row.delta,
        row.clics ?? null, row.impresiones, row.landing_page ?? null,
      ]),
    ];
    downloadCsv(`metricas-seo-${days}d.csv`, rows);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <MetricsPageHeader
          breadcrumb="Métricas > SEO"
          title="Métricas SEO"
          contextLabel={contextLabel}
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
                    {
                      label: 'Posición promedio',
                      value: seo.posicion_actual,
                      // El subtítulo dice sobre qué está promediado. Antes
                      // mostraba una keyword acá, y eso hacía leer el número
                      // como "la posición de esa keyword".
                      sub: seo.posicion_periodo
                        ? `${seo.keywords_contadas ?? 0} consultas · ${seo.posicion_periodo}`
                        : (seo.keyword ?? undefined),
                    },
                    { label: 'Clics orgánicos (último dato)', value: seo.clics_organicos_actual },
                  ]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 20 }}>
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-8)', boxShadow: 'var(--shadow-card)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Clics orgánicos</div>
                  <LineChart
                    points={seo.clicks_snapshots.map((s) => ({ fecha: s.fecha, valor: s.clics }))}
                    color="#34A853"
                    formatDate={formatDateShort}
                  />
                </div>
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-8)', boxShadow: 'var(--shadow-card)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Impresiones</div>
                  <LineChart
                    points={seo.impressions_snapshots.map((s) => ({ fecha: s.fecha, valor: s.impresiones }))}
                    color="#4285F4"
                    formatDate={formatDateShort}
                  />
                </div>
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '18px 16px 6px' }}>
                  Búsquedas en Google
                  {periodoTabla && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>{periodoTabla}</span>
                  )}
                </div>
                {seo.keyword_matrix.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Sin keywords registradas todavía</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6' }}>
                          <th style={{ textAlign: 'left', padding: 12, color: 'var(--text-sub)', fontWeight: 700, fontSize: 12 }}>Búsqueda</th>
                          <th style={{ textAlign: 'right', padding: 12, color: 'var(--text-sub)', fontWeight: 700, fontSize: 12 }}>Posición</th>
                          <th style={{ textAlign: 'right', padding: 12, color: 'var(--text-sub)', fontWeight: 700, fontSize: 12 }}>Cambio</th>
                          <th style={{ textAlign: 'right', padding: 12, color: 'var(--text-sub)', fontWeight: 700, fontSize: 12 }}>Clics</th>
                          <th style={{ textAlign: 'right', padding: 12, color: 'var(--text-sub)', fontWeight: 700, fontSize: 12 }}>Impresiones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seo.keyword_matrix.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                            <td style={{ padding: '10px 16px', color: 'var(--text)' }}>
                              <div>{row.keyword}</div>
                              {row.landing_page && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, wordBreak: 'break-all' }}>
                                  {rutaDe(row.landing_page)}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)' }}>{row.posicion_actual ?? '—'}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: row.delta && row.delta > 0 ? 'var(--status-bien-text)' : row.delta && row.delta < 0 ? 'var(--status-critico-text)' : 'var(--text-muted)' }}>
                              {row.delta !== null ? (row.delta > 0 ? `+${row.delta}` : row.delta) : '—'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)' }}>{row.clics ?? '—'}</td>
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
