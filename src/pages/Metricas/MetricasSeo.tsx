import { useState } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { LineChart } from '../../components/LineChart';
import { MetricsPageHeader } from '../../components/MetricsPageHeader';
import { useClientContextLabel } from '../../hooks/useClientContextLabel';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import { downloadCsv } from '../../lib/exportCsv';
import type { DateRangeDays } from '../../components/DateRangeControl';
import type { IndexacionEstado } from '../../types';

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

// Los estados llegan de Google en inglés y crudos. Se traducen acá, en la
// capa de presentación, y no en el backend: el snapshot guarda lo que Google
// dijo, palabra por palabra, para que dentro de un año se pueda saber qué
// contestó exactamente. Un estado que Google agregue y no esté en este mapa
// se muestra tal cual, en inglés: peor que un texto en inglés es un texto
// nuestro que adivina lo que significa.
const ESTADO_ES: Record<string, string> = {
  'Submitted and indexed': 'Indexada',
  'Indexed, not submitted in sitemap': 'Indexada (fuera del sitemap)',
  'Discovered - currently not indexed': 'Descubierta, sin indexar',
  'Crawled - currently not indexed': 'Rastreada, sin indexar',
  'URL is unknown to Google': 'Google no la conoce',
  'Duplicate without user-selected canonical': 'Duplicada, sin canónica elegida',
  'Duplicate, Google chose different canonical than user': 'Duplicada, Google eligió otra canónica',
  'Excluded by ‘noindex’ tag': 'Excluida por noindex',
  'Page with redirect': 'Redirige a otra página',
  'Soft 404': 'Error 404 blando',
  'Blocked by robots.txt': 'Bloqueada por robots.txt',
  'Not found (404)': 'No encontrada (404)',
};

function estadoEs(estado: string): string {
  return ESTADO_ES[estado] ?? estado;
}

function IndexacionCard({ idx, isDesktop }: { idx: IndexacionEstado; isDesktop: boolean }) {
  const medidas = idx.inspeccionadas;
  const indexadas = idx.indexadas ?? 0;
  const pct = medidas > 0 ? Math.round((indexadas / medidas) * 100) : 0;

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Páginas en Google</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>medido el {idx.medido_el}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{indexadas}</span>
          <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>de {medidas} páginas</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({pct}%)</span>
        </div>

        <div style={{ background: 'var(--border-soft)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#34A853', borderRadius: 4 }} />
        </div>

        {/* Con cobertura parcial el número es de la muestra y no del sitio.
            Decirlo acá y no en una nota al pie: es la diferencia entre "te
            faltan 3 páginas" y "no medimos 300". */}
        {idx.cobertura_parcial && idx.urls_en_sitemap != null && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
            El sitemap declara {idx.urls_en_sitemap} páginas y esta medición alcanzó a revisar {medidas}.
            El porcentaje es de esas {medidas}, no del sitio completo.
          </div>
        )}
      </div>

      {idx.paginas.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '4px 16px 6px' }}>
            Todavía no están en Google
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>{idx.paginas.length}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ textAlign: 'left', padding: 12, color: 'var(--text-sub)', fontWeight: 700, fontSize: 12 }}>Página</th>
                  <th style={{ textAlign: 'left', padding: 12, color: 'var(--text-sub)', fontWeight: 700, fontSize: 12 }}>Estado según Google</th>
                  <th style={{ textAlign: 'right', padding: 12, color: 'var(--text-sub)', fontWeight: 700, fontSize: 12 }}>Último rastreo</th>
                </tr>
              </thead>
              <tbody>
                {idx.paginas.map((p) => (
                  <tr key={p.url} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', wordBreak: 'break-all' }}>{p.ruta}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-sub)' }}>{estadoEs(p.estado)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{p.ultimo_rastreo ?? 'nunca'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Sin esta línea, una tabla de páginas "que fallan" manda a
              arreglar algo que no está roto. En un dominio nuevo, que Google
              conozca una página y no la haya indexado todavía es el estado
              normal durante semanas. */}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '12px 16px 16px', lineHeight: 1.5, borderTop: '1px solid var(--border-soft)' }}>
            «Descubierta, sin indexar» y «Google no la conoce» no son errores del sitio: en un dominio
            nuevo son el estado normal durante semanas, y se resuelven solos a medida que Google rastrea.
            {isDesktop && ' Para apurar una página concreta, se pide indexación a mano desde Search Console.'}
          </div>
        </>
      )}
    </div>
  );
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
      ['Posición promedio en Google'],
      ['Fecha', 'Posición'],
      ...(seo.posicion_snapshots ?? []).map((s) => [s.fecha, s.posicion]),
      [],
      ['Clics orgánicos'],
      ['Fecha', 'Clics'],
      ...seo.clicks_snapshots.map((s) => [s.fecha, s.clics]),
      [],
      ['Impresiones'],
      ['Fecha', 'Impresiones'],
      ...seo.impressions_snapshots.map((s) => [s.fecha, s.impresiones]),
      [],
      ...(seo.indexacion && !seo.indexacion.nota ? [
        [],
        ['Páginas en Google', `medido el ${seo.indexacion.medido_el}`],
        ['Indexadas', seo.indexacion.indexadas ?? null],
        ['Revisadas', seo.indexacion.inspeccionadas],
        ['Declaradas en el sitemap', seo.indexacion.urls_en_sitemap ?? null],
        ['Todavía no están en Google'],
        ['Página', 'Estado según Google', 'Último rastreo'],
        ...seo.indexacion.paginas.map((p) => [p.ruta, estadoEs(p.estado), p.ultimo_rastreo ?? 'nunca']),
      ] as (string | number | null)[][] : []),
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

              {seo.indexacion && !seo.indexacion.nota && (
                <IndexacionCard idx={seo.indexacion} isDesktop={isDesktop} />
              )}

              {/* La posición va sola y arriba: es la tendencia que dice si el
                  SEO avanza. Clics e impresiones suben y bajan con la
                  estacionalidad de la demanda aunque el sitio no se mueva. */}
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-8)', boxShadow: 'var(--shadow-card)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Posición promedio en Google</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>más arriba es mejor · el eje va invertido</div>
                </div>
                <LineChart
                  points={(seo.posicion_snapshots ?? []).map((s) => ({ fecha: s.fecha, valor: s.posicion }))}
                  color="#C4944E"
                  height={150}
                  menorEsMejor
                  formatValue={(v) => `#${v.toFixed(1)}`}
                  formatDate={formatDateShort}
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
