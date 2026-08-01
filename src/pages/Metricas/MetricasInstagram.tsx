import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { LineChart } from '../../components/LineChart';
import { useMetricsReport } from '../../hooks/useMetricsReport';
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
  const { data, loading, error, reload } = useMetricsReport();
  const ig = data?.social;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Métricas
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Instagram</h1>
        </div>

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
                <LineChart
                  points={ig.snapshots.map((s) => ({ fecha: s.fecha, valor: s.seguidores }))}
                  color="#E1306C"
                  formatDate={formatDateShort}
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
