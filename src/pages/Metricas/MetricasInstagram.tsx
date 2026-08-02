import { useState } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { TrendChart } from '../../components/TrendChart';
import { MetricsPageHeader } from '../../components/MetricsPageHeader';
import { MetricNotAvailable } from '../../components/MetricNotAvailable';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import { downloadCsv } from '../../lib/exportCsv';
import type { DateRangeDays } from '../../components/DateRangeControl';
import type { InstagramPost, InstagramInsightPost } from '../../types';

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 6, letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function num(v: number | null): string {
  return v === null ? '—' : v.toLocaleString('es-CL');
}
function signedNum(v: number): string {
  return (v > 0 ? '+' : '') + v.toLocaleString('es-CL');
}

// Miniatura real de Meta (media_url/thumbnail_url) - son URLs FIRMADAS
// que expiran (duración exacta no confirmada por Meta). Si ya venció
// entre la última recolección y ahora, se oculta silenciosamente en vez
// de mostrar un ícono de imagen rota.
function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', flexShrink: 0 }} />;
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
    />
  );
}

function PostRow({ post }: { post: InstagramPost }) {
  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-soft)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Thumb src={post.imagen_url} alt={post.caption ?? post.formato} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {post.formato} · {formatDateShort(post.fecha.slice(0, 10))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {post.caption ?? '—'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, flexShrink: 0, fontSize: 12, color: 'var(--text-sub)', textAlign: 'right' }}>
        <span title="Alcance">👁 {post.alcance !== null ? post.alcance.toLocaleString('es-CL') : '—'}</span>
        <span title="Guardados" style={{ fontWeight: 700, color: 'var(--text)' }}>
          🔖 {post.guardados !== null ? post.guardados.toLocaleString('es-CL') : '—'}
        </span>
        <span title="Compartidos">↗ {post.shares !== null ? post.shares.toLocaleString('es-CL') : '—'}</span>
        <span title="Comentarios">💬 {post.comentarios}</span>
      </div>
    </a>
  );
}

// Insight de la publicación destacada (2026-08-02, pedido explícito de
// Mato) - siempre con datos reales: la variación de seguidores es la
// del MISMO día real (correlación, no una atribución causal inventada).
// Si no hay dato de esa variación para el día, se omite esa frase en
// vez de mostrar un 0 falso.
function InsightBanner({ post }: { post: InstagramInsightPost }) {
  const n = post.seguidores_netos_ese_dia;
  let seguidoresClause = '';
  if (n !== null) {
    if (n > 0) seguidoresClause = ` Ese día ganaste ${n.toLocaleString('es-CL')} seguidor${n === 1 ? '' : 'es'} nuevo${n === 1 ? '' : 's'}.`;
    else if (n < 0) seguidoresClause = ` Ese día perdiste ${Math.abs(n).toLocaleString('es-CL')} seguidor${Math.abs(n) === 1 ? '' : 'es'}.`;
    else seguidoresClause = ' Ese día no hubo cambio neto de seguidores.';
  }

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderLeft: '4px solid #E1306C',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 28,
        textDecoration: 'none',
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
        Tu publicación del {formatDateShort(post.fecha)} ({post.formato.toLowerCase()}) logró el mayor alcance del período:{' '}
        <strong>{post.alcance.toLocaleString('es-CL')} cuentas alcanzadas</strong>
        {post.shares !== null && (
          <>
            {' '}y <strong>{post.shares.toLocaleString('es-CL')} compartidos</strong>
          </>
        )}
        {post.guardados !== null && <>, {post.guardados.toLocaleString('es-CL')} guardados</>}.{seguidoresClause}
      </div>
    </a>
  );
}

// Detalle real de Instagram (meta_snapshot#, campo cuenta) - pedido
// explícito de Mato (2026-08-01): panel ejecutivo por canal. Las 6
// métricas y el orden vienen exactos de su spec; "mensajes iniciados"
// se muestra honesto como no disponible - confirmado en vivo contra la
// API real de Meta (la app no tiene el permiso, error real
// "Application does not have the capability to make this API call").
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
      ['Alcance en no-seguidores (%, últimos 30 días)', ig.alcance_no_seguidores_pct],
      ['Guardados totales', ig.guardados_totales],
      ['Guardados promedio por publicación', ig.guardados_promedio],
      ['Compartidos totales', ig.compartidos_totales],
      ['Clics al enlace del perfil (últimos 30 días)', ig.clics_enlace_perfil_30d],
      ['Mensajes iniciados', 'No disponible - Meta no otorga este permiso a la app hoy'],
      ['Seguidores actuales', ig.seguidores_actuales],
      ['Cambio neto (período)', ig.cambio_neto_periodo],
      ['Cambio neto 7 días', ig.cambio_neto_7d],
      [],
      ['Seguidores en el tiempo'],
      ['Fecha', 'Seguidores'],
      ...ig.snapshots.map((s) => [s.fecha, s.seguidores]),
      [],
      ['Publicaciones ordenadas por guardados'],
      ['Fecha', 'Formato', 'Alcance', 'Guardados', 'Compartidos', 'Comentarios', 'Permalink'],
      ...ig.publicaciones.map((p) => [p.fecha.slice(0, 10), p.formato, p.alcance, p.guardados, p.shares, p.comentarios, p.permalink]),
    ];
    downloadCsv(`metricas-instagram-${days}d.csv`, rows);
  };

  const kpiGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: 12 };

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
              <div style={{ ...kpiGrid, marginBottom: 28 }}>
                <KpiCard label="Seguidores actuales" value={num(ig.seguidores_actuales)} />
                <KpiCard label="Alcance en no-seguidores" value={ig.alcance_no_seguidores_pct !== null ? `${ig.alcance_no_seguidores_pct}%` : '—'} sub="últimos 30 días" />
                <KpiCard
                  label="Guardados por publicación"
                  value={num(ig.guardados_totales)}
                  sub={ig.guardados_promedio !== null ? `promedio ${ig.guardados_promedio}` : undefined}
                />
                <KpiCard label="Compartidos" value={num(ig.compartidos_totales)} />
                <KpiCard label="Clics al enlace del perfil" value={num(ig.clics_enlace_perfil_30d)} sub="últimos 30 días" />
                <MetricNotAvailable label="Mensajes iniciados" reason="Meta no otorga este permiso a la app hoy." />
                <KpiCard label="Seguidores netos" value={signedNum(ig.cambio_neto_periodo)} sub={`7 días: ${signedNum(ig.cambio_neto_7d)}`} />
              </div>

              {ig.insight_post && <InsightBanner post={ig.insight_post} />}

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Seguidores en el tiempo</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Seguidores actuales: {num(ig.seguidores_actuales)}</div>
                <TrendChart
                  points={ig.snapshots.map((s) => ({ fecha: s.fecha, valor: s.seguidores }))}
                  color="#E1306C"
                  formatDate={formatDateShort}
                  compact={!isDesktop}
                  unitLabel="seguidores"
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '18px 16px 6px' }}>Publicaciones — ordenadas por guardados</div>
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
