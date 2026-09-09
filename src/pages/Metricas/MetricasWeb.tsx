import { useState } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { LineChart } from '../../components/LineChart';
import { MetricsPageHeader } from '../../components/MetricsPageHeader';
import { useClientContextLabel } from '../../hooks/useClientContextLabel';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import { downloadCsv } from '../../lib/exportCsv';
import type { DateRangeDays } from '../../components/DateRangeControl';

// Tráfico del sitio según GA4 (2026-09-09). Hasta hoy lo único que el panel
// sabía de Google Analytics era "visitas desde Estados Unidos, 7 días": un
// KPI que se pidió para Chile Fly Fishing, que le vende a pescadores gringos,
// y que para un operador que le vende a chilenos puede quedarse en 0 toda la
// vida con el sitio funcionando perfecto. Esta pantalla responde las tres
// preguntas que sí sirven en cualquier caso: cuánta gente entró, por qué
// puerta entró y qué miró.
//
// Ningún número se calcula acá: todo viene de GA4 vía /dashboard/metrics-report.
// Si falta la propiedad o la credencial, el backend manda `nota` y esta
// pantalla muestra esa nota - nunca un cero que se lea como una medición.

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

const CARD: React.CSSProperties = {
  background: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-card)',
};

// Barra proporcional al mayor de la tabla, no al total: con 8 canales el
// porcentaje sobre el total deja todas las barras invisibles y la
// comparación entre ellas es justamente lo que se está mirando.
function Barra({ valor, maximo, color }: { valor: number; maximo: number; color: string }) {
  const ancho = maximo > 0 ? Math.max(2, Math.round((valor / maximo) * 100)) : 0;
  return (
    <div style={{ background: 'var(--border-soft)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
      <div style={{ width: `${ancho}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  );
}

export function MetricasWeb({ isDesktop }: { isDesktop: boolean }) {
  const [days, setDays] = useState<DateRangeDays>(30);
  const { data, loading, error, reload } = useMetricsReport(days);
  const web = data?.web;
  const contextLabel = useClientContextLabel();

  const canales = web?.canales ?? [];
  const paginas = web?.paginas ?? [];
  const paises = web?.paises ?? [];
  const serie = web?.serie_usuarios ?? [];
  const maxCanal = canales.reduce((m, c) => Math.max(m, c.sesiones), 0);
  const maxPais = paises.reduce((m, p) => Math.max(m, p.usuarios), 0);

  const handleExport = () => {
    if (!web) return;
    const rows: (string | number | null)[][] = [
      ['Tráfico del sitio (GA4)', web.periodo ?? `últimos ${days} días`],
      [],
      ['Usuarios', web.usuarios],
      ['Sesiones', web.sesiones],
      ['Páginas vistas', web.paginas_vistas],
      [],
      ['Usuarios por día'],
      ['Fecha', 'Usuarios', 'Sesiones'],
      ...serie.map((s) => [s.fecha, s.usuarios, s.sesiones]),
      [],
      ['Cómo llegaron'],
      ['Canal', 'Sesiones', 'Usuarios'],
      ...canales.map((c) => [c.canal, c.sesiones, c.usuarios]),
      [],
      ['Páginas más vistas'],
      ['Ruta', 'Vistas', 'Usuarios'],
      ...paginas.map((p) => [p.ruta, p.vistas, p.usuarios]),
      [],
      ['Desde dónde entraron'],
      ['País', 'Usuarios'],
      ...paises.map((p) => [p.pais, p.usuarios]),
    ];
    downloadCsv(`metricas-web-${days}d.csv`, rows);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <MetricsPageHeader
          breadcrumb="Métricas > Sitio web"
          title="Tráfico del sitio"
          contextLabel={contextLabel}
          isDesktop={isDesktop}
          days={days}
          onDaysChange={setDays}
          onExport={handleExport}
          exportDisabled={!web || !!web.nota}
        />

        <AsyncState loading={loading} error={error} onRetry={reload}>
          {web && web.nota && (
            <div style={{ ...CARD, border: '1px dashed var(--border)', padding: '28px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 6 }}>
                Google Analytics no está conectado
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{web.nota}</div>
            </div>
          )}

          {web && !web.nota && (
            <>
              <div style={{ marginBottom: 28 }}>
                <KpiRow
                  items={[
                    { label: 'Usuarios', value: web.usuarios, sub: web.periodo ?? undefined },
                    // Sesiones y páginas vistas van al lado de usuarios a
                    // propósito: usuarios NO es la suma de la serie diaria
                    // (quien entra tres días es un usuario, no tres), y verlas
                    // juntas es lo que evita leer mal cualquiera de las tres.
                    { label: 'Sesiones', value: web.sesiones },
                    { label: 'Páginas vistas', value: web.paginas_vistas },
                  ]}
                />
              </div>

              <div style={{ ...CARD, padding: 'var(--space-8)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Usuarios por día</div>
                  {/* El rango termina AYER: el día en curso está a medio medir
                      y su caída se lee como una caída real del sitio. */}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>hasta ayer · el día en curso no se grafica</div>
                </div>
                <LineChart
                  points={serie.map((s) => ({ fecha: s.fecha, valor: s.usuarios }))}
                  color="#C4944E"
                  height={150}
                  formatDate={formatDateShort}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 20 }}>
                <div style={{ ...CARD, padding: 'var(--space-8)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Cómo llegaron</div>
                  {canales.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin sesiones en el período</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 14 }}>
                      {canales.map((c) => (
                        <div key={c.canal}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                            <span style={{ color: 'var(--text)' }}>{c.canal}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{c.sesiones.toLocaleString('es-CL')}</span>
                          </div>
                          <Barra valor={c.sesiones} maximo={maxCanal} color="#4285F4" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ ...CARD, padding: 'var(--space-8)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Desde dónde entraron</div>
                  {paises.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin usuarios en el período</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 14 }}>
                      {paises.map((p) => (
                        <div key={p.pais}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                            <span style={{ color: 'var(--text)' }}>{p.pais}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{p.usuarios.toLocaleString('es-CL')}</span>
                          </div>
                          <Barra valor={p.usuarios} maximo={maxPais} color="#34A853" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ ...CARD, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '18px 16px 6px' }}>
                  Páginas más vistas
                  {web.periodo && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>{web.periodo}</span>
                  )}
                </div>
                {paginas.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Sin páginas registradas en el período</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6' }}>
                          <th style={{ textAlign: 'left', padding: 12, color: 'var(--text-sub)', fontWeight: 700, fontSize: 12 }}>Página</th>
                          <th style={{ textAlign: 'right', padding: 12, color: 'var(--text-sub)', fontWeight: 700, fontSize: 12 }}>Vistas</th>
                          <th style={{ textAlign: 'right', padding: 12, color: 'var(--text-sub)', fontWeight: 700, fontSize: 12 }}>Usuarios</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginas.map((p) => (
                          <tr key={p.ruta} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                            <td style={{ padding: '10px 16px', color: 'var(--text)', wordBreak: 'break-all' }}>
                              {p.ruta === '/' ? '/ (portada)' : p.ruta}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)' }}>{p.vistas.toLocaleString('es-CL')}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)' }}>{p.usuarios.toLocaleString('es-CL')}</td>
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
