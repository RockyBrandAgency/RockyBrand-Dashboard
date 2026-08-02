import { useState } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { TrendChart } from '../../components/TrendChart';
import { MetricsPageHeader } from '../../components/MetricsPageHeader';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import { downloadCsv } from '../../lib/exportCsv';
import type { DateRangeDays } from '../../components/DateRangeControl';
import type { InstagramPost } from '../../types';

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

function PostRow({ post }: { post: InstagramPost }) {
  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-soft)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {post.formato} · {formatDateShort(post.fecha.slice(0, 10))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
          {post.caption ?? '—'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexShrink: 0, fontSize: 12, color: 'var(--text-sub)' }}>
        <span>❤️ {post.likes}</span>
        <span>💬 {post.comentarios}</span>
        {post.engagement_rate_sobre_alcance_pct !== null && <span style={{ fontWeight: 700, color: 'var(--text)' }}>{post.engagement_rate_sobre_alcance_pct}% eng.</span>}
      </div>
    </a>
  );
}

// Detalle real de Instagram (meta_snapshot#, campo cuenta) - pedido
// explícito de Mato (2026-08-01): panel ejecutivo por canal.
export function MetricasInstagram({ isDesktop }: { isDesktop: boolean }) {
  const [days, setDays] = useState<DateRangeDays>(30);
  const { data, loading, error, reload } = useMetricsReport(days);
  const ig = data?.social;

  const handleExport = () => {
    if (!ig) return;
    const rows: (string | number | null)[][] = [
      ['Instagram', `últimos ${days} días`],
      [],
      ['Seguidores actuales', ig.seguidores_actuales],
      ['Cambio neto (período)', ig.cambio_neto_periodo],
      ['Cambio neto 7 días', ig.cambio_neto_7d],
      ['Engagement promedio (%)', ig.engagement_promedio_pct],
      [],
      ['Seguidores en el tiempo'],
      ['Fecha', 'Seguidores'],
      ...ig.snapshots.map((s) => [s.fecha, s.seguidores]),
      [],
      ['Publicaciones recientes'],
      ['Fecha', 'Formato', 'Likes', 'Comentarios', 'Engagement %', 'Permalink'],
      ...ig.publicaciones.map((p) => [p.fecha.slice(0, 10), p.formato, p.likes, p.comentarios, p.engagement_rate_sobre_alcance_pct, p.permalink]),
    ];
    downloadCsv(`metricas-instagram-${days}d.csv`, rows);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <MetricsPageHeader
          title="Instagram"
          isDesktop={isDesktop}
          days={days}
          onDaysChange={setDays}
          onExport={handleExport}
          exportDisabled={!ig}
        />

        <AsyncState loading={loading} error={error} onRetry={reload}>
          {ig && (
            <>
              <div style={{ marginBottom: 28 }}>
                <KpiRow
                  items={[
                    { label: 'Seguidores actuales', value: ig.seguidores_actuales },
                    { label: 'Cambio neto (período)', value: ig.cambio_neto_periodo, signed: true },
                    { label: 'Cambio neto 7 días', value: ig.cambio_neto_7d, signed: true },
                    { label: 'Engagement promedio', value: ig.engagement_promedio_pct !== null ? `${ig.engagement_promedio_pct}%` : null },
                  ]}
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Seguidores en el tiempo</div>
                <TrendChart
                  points={ig.snapshots.map((s) => ({ fecha: s.fecha, valor: s.seguidores }))}
                  color="#E1306C"
                  formatDate={formatDateShort}
                  compact={!isDesktop}
                  unitLabel="seguidores"
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '18px 16px 6px' }}>Publicaciones recientes</div>
                {ig.publicaciones.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Sin publicaciones en el rango</div>
                ) : (
                  ig.publicaciones.map((p) => <PostRow key={p.media_id} post={p} />)
                )}
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
