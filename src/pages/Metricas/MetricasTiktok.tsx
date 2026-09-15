import { useState } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { LineChart } from '../../components/LineChart';
import { MetricsPageHeader } from '../../components/MetricsPageHeader';
import { TiktokIcon } from '../../components/PlatformIcons';
import { useClientContextLabel } from '../../hooks/useClientContextLabel';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import { downloadCsv } from '../../lib/exportCsv';
import type { DateRangeDays } from '../../components/DateRangeControl';
import type { TiktokMes, TiktokMetrics, TiktokVideo } from '../../types';

// Detalle real de TikTok (tiktok_snapshot#), conectado el 2026-09-14 via
// Display API. Hasta esa fecha esta pagina era un estado vacío honesto: no
// había ninguna fuente de datos.
//
// DOS relojes distintos conviven acá y la interfaz tiene que decir cuál es
// cuál, o el gráfico miente sin querer:
//
//   - Seguidores: sale de los snapshots semanales, así que la serie EMPIEZA
//     el día que se conectó la cuenta. Con un solo punto no hay tendencia, y
//     eso se dice con todas sus letras en vez de dibujar una línea plana que
//     se lee como "no creció".
//   - Publicaciones y vistas por mes: sale del historial propio de la cuenta
//     (`create_time` de cada video), así que viene completo desde la primera
//     corrida. Son años de datos reales disponibles de inmediato.
//
// Lo que esta página NO muestra, a propósito: demografía de audiencia (edad,
// país, género) y serie diaria de vistas. Los scopes aprobados
// (user.info.basic, user.info.stats, video.list) no los entregan - viven en
// la API de TikTok Business, que es otro producto y otra revisión. Un gráfico
// aproximado de audiencia sería inventado.
const ROJO = '#FE2C55'; // color de marca de TikTok, igual que el #FF0000 de YouTube
const BARRA = '#d6204a'; // un punto más oscuro para relleno: el de marca sobre blanco se lava

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

function formatMes(mes: string): string {
  const [a, m] = mes.split('-');
  return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
}

const num = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('es-CL');

const pct = (v: number | null | undefined): string =>
  v == null ? '—' : `${v.toLocaleString('es-CL', { maximumFractionDigits: 2 })}%`;

const seg = (v: number | null | undefined): string =>
  v == null ? '—' : `${Math.round(v)} s`;

function Panel({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-8)',
        marginBottom: 'var(--space-6)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: nota ? 4 : 14 }}>{titulo}</div>
      {nota && <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 14 }}>{nota}</div>}
      {children}
    </div>
  );
}

// Barras mensuales. Sin librería, mismo criterio que LineChart/DailyBarsChart.
// Los meses en cero se dibujan igual (una línea de base visible): un mes sin
// publicar es información —se dejó de publicar— y saltárselo dibujaría una
// continuidad que no existió.
function BarrasMensuales({ meses, campo, unidad }: { meses: TiktokMes[]; campo: 'vistas' | 'videos'; unidad: string }) {
  const [activo, setActivo] = useState<number | null>(null);
  const max = Math.max(...meses.map((m) => m[campo]), 1);
  const alto = 140;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: alto, position: 'relative' }}>
        {meses.map((m, i) => {
          const valor = m[campo];
          // 2px de piso para que un mes en cero se vea como cero y no como
          // ausencia de barra.
          const h = valor > 0 ? Math.max(3, (valor / max) * alto) : 2;
          return (
            <div
              key={m.mes}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', cursor: 'default' }}
            >
              <div
                style={{
                  height: h,
                  background: valor > 0 ? BARRA : 'var(--border)',
                  opacity: activo === null || activo === i ? 1 : 0.45,
                  borderRadius: '2px 2px 0 0',
                  transition: 'opacity 120ms',
                }}
              />
            </div>
          );
        })}
        {activo !== null && (
          <div
            style={{
              position: 'absolute',
              top: -6,
              left: `${((activo + 0.5) / meses.length) * 100}%`,
              transform: 'translate(-50%, -100%)',
              background: 'var(--text)',
              color: 'var(--white)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            {formatMes(meses[activo].mes)} · {num(meses[activo][campo])} {unidad}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
        {meses.map((m, i) => (
          <div key={m.mes} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--text-faint)', overflow: 'hidden' }}>
            {/* Una etiqueta cada 3 meses: 24 rótulos seguidos se pisan y no se
                leen ninguno. */}
            {i % 3 === 0 ? formatMes(m.mes) : ' '}
          </div>
        ))}
      </div>
    </div>
  );
}

function TablaVideos({ titulo, videos, isDesktop }: { titulo: string; videos: TiktokVideo[]; isDesktop: boolean }) {
  if (videos.length === 0) return null;
  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '18px 16px 10px' }}>{titulo}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: isDesktop ? 0 : 560 }}>
          <thead>
            <tr style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-sub)' }}>
              <th style={{ textAlign: 'left', padding: '8px 16px', fontWeight: 500 }}>Video</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Vistas</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Likes</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Com.</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Comp.</th>
              <th style={{ textAlign: 'right', padding: '8px 16px', fontWeight: 500 }}>Engag.</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
                <td style={{ padding: '10px 16px', color: 'var(--text)' }}>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text)', textDecoration: 'none', display: 'block', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {v.titulo || 'Sin descripción'}
                  </a>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    {formatDateShort(v.fecha)} · {seg(v.duracion_seg)}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text)', fontWeight: 600 }}>{num(v.vistas)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{num(v.likes)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{num(v.comentarios)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{num(v.compartidos)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>{pct(v.engagement_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SinConectar() {
  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '80px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          background: 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <TiktokIcon size={40} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>TikTok aún no está conectado</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 8, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', color: 'var(--text-sub)' }}>
        No hay una integración real de TikTok para este cliente todavía.
      </div>
      {/* Sin botón "Conectar TikTok": no existe un flujo self-service desde el
          panel (mismo criterio que "Conectar PMS"). Autorizar una cuenta exige
          una app revisada por TikTok y el canje del código con el client_secret,
          que nunca toca el navegador. */}
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 16 }}>
        Contacta a tu ejecutivo de RockyBrand para activar esta integración.
      </div>
    </div>
  );
}

export function MetricasTiktok({ isDesktop }: { isDesktop: boolean }) {
  const [days, setDays] = useState<DateRangeDays>(30);
  const { data, loading, error, reload } = useMetricsReport(days);
  const tt: TiktokMetrics | undefined = data?.tiktok;
  const contextLabel = useClientContextLabel();

  const conectado = !!tt?.conectado;
  // La ventana que corresponde EXACTAMENTE al selector, calculada en el
  // backend sobre todos los videos. Si por lo que sea no viniera, se cae a
  // resumen_periodo y la etiqueta dice sus días reales - nunca se rotula 30
  // un número que son 90.
  const ventana = tt?.resumen_por_ventana?.[String(days)] ?? tt?.resumen_periodo ?? {};
  const diasVentana = ventana.dias ?? days;

  const handleExport = () => {
    if (!tt) return;
    const rows: (string | number | null)[][] = [
      ['TikTok', tt.display_name ?? ''],
      ['Medido el', tt.medido_el ?? ''],
      [],
      ['Seguidores', tt.seguidores_actuales],
      ['Likes totales', tt.likes_totales],
      ['Videos publicados', tt.videos_totales],
      ['Siguiendo', tt.siguiendo],
      [],
      [`Últimos ${diasVentana} días`],
      ['Videos', ventana.videos ?? 0],
      ['Vistas', ventana.vistas ?? 0],
      ['Likes', ventana.likes ?? 0],
      ['Engagement %', ventana.engagement_pct ?? null],
      [],
      ['Publicaciones y vistas por mes'],
      ['Mes', 'Videos', 'Vistas', 'Likes'],
      ...tt.serie_mensual.map((m) => [m.mes, m.videos, m.vistas, m.likes]),
      [],
      ['Top videos por vistas'],
      ['Fecha', 'Título', 'Vistas', 'Likes', 'Comentarios', 'Compartidos', 'Engagement %', 'Duración (s)', 'URL'],
      ...tt.top_videos.map((v) => [v.fecha, v.titulo, v.vistas, v.likes, v.comentarios, v.compartidos, v.engagement_pct, v.duracion_seg, v.url]),
    ];
    downloadCsv(`metricas-tiktok-${days}d.csv`, rows);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <MetricsPageHeader
          breadcrumb="Métricas > TikTok"
          title="Métricas TikTok"
          contextLabel={contextLabel}
          isDesktop={isDesktop}
          days={days}
          onDaysChange={setDays}
          onExport={handleExport}
          exportDisabled={!conectado}
        />

        <AsyncState loading={loading} error={error} onRetry={reload}>
          {!conectado && <SinConectar />}
          {conectado && tt && (
            <>
              <div style={{ marginBottom: 12 }}>
                <KpiRow
                  items={[
                    { label: 'Seguidores', value: tt.seguidores_actuales },
                    { label: 'Likes totales', value: tt.likes_totales },
                    { label: 'Videos publicados', value: tt.videos_totales },
                    { label: 'Vistas acumuladas', value: tt.acumulado.vistas ?? null, sub: `sobre ${num(tt.cobertura.videos_leidos)} videos` },
                  ]}
                />
              </div>
              <div style={{ marginBottom: 28 }}>
                <KpiRow
                  items={[
                    { label: `Videos (${diasVentana} días)`, value: ventana.videos ?? 0 },
                    { label: `Vistas (${diasVentana} días)`, value: ventana.vistas ?? 0 },
                    { label: `Engagement (${diasVentana} días)`, value: ventana.engagement_pct == null ? null : pct(ventana.engagement_pct) },
                    { label: 'Duración mediana', value: ventana.duracion_mediana_seg == null ? null : seg(ventana.duracion_mediana_seg) },
                  ]}
                />
              </div>

              <Panel
                titulo="Seguidores en el tiempo"
                nota={
                  tt.snapshots.length < 2
                    ? 'La serie empieza el día que se conectó la cuenta: todavía no hay dos mediciones que comparar. Se llena sola con cada corrida semanal.'
                    : undefined
                }
              >
                {tt.snapshots.length >= 2 ? (
                  <LineChart
                    points={tt.snapshots.map((s) => ({ fecha: s.fecha, valor: s.seguidores }))}
                    color={ROJO}
                    formatDate={formatDateShort}
                  />
                ) : (
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                    {num(tt.seguidores_actuales)}
                    <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-sub)', marginLeft: 8 }}>
                      seguidores {tt.medido_el ? `al ${formatDateShort(tt.medido_el)}` : ''}
                    </span>
                  </div>
                )}
              </Panel>

              <Panel
                titulo="Vistas por mes"
                nota="Sale del historial propio de la cuenta, no de los snapshots: por eso cubre años desde la primera corrida. Un mes sin barra es un mes sin publicar."
              >
                <BarrasMensuales meses={tt.serie_mensual} campo="vistas" unidad="vistas" />
              </Panel>

              <Panel titulo="Publicaciones por mes" nota="Cuántos videos se subieron cada mes. Es el dato que explica la mayoría de las subidas y caídas del gráfico anterior.">
                <BarrasMensuales meses={tt.serie_mensual} campo="videos" unidad="videos" />
              </Panel>

              <TablaVideos titulo="Top videos por vistas" videos={tt.top_videos} isDesktop={isDesktop} />
              <TablaVideos titulo="Publicaciones recientes" videos={tt.videos_recientes} isDesktop={isDesktop} />

              {/* Pie de página con la letra chica REAL. La API no entrega todos
                  los videos que el perfil declara (privados, borrados y posts de
                  fotos quedan fuera), así que se dice sobre cuántos está
                  calculado en vez de dar a entender que son todos. */}
              <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6 }}>
                Medido el {tt.medido_el ?? '—'}. Agregados calculados sobre {num(tt.cobertura.videos_leidos)} de{' '}
                {num(tt.cobertura.videos_declarados)} videos que declara el perfil
                {tt.cobertura.videos_no_entregados
                  ? ` (${num(tt.cobertura.videos_no_entregados)} no los entrega la API: privados, borrados o publicaciones de fotos)`
                  : ''}
                {tt.cobertura.desde ? `, desde ${tt.cobertura.desde}` : ''}.
                <br />
                TikTok no entrega demografía de audiencia ni vistas por día con los permisos de esta integración.
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
