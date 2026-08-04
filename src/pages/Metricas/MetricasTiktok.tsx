import { TiktokIcon } from '../../components/PlatformIcons';

// TikTok - a diferencia de Facebook/Instagram/YouTube/SEO, no hay
// ninguna fuente de datos conectada hoy (sin cron, sin snapshots en
// rockybrand-memory) - confirmado antes de construir, no se inventa un
// número. Estado honesto hasta que se conecte una integración real.
export function MetricasTiktok({ isDesktop }: { isDesktop: boolean }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ paddingBottom: 'var(--space-7)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-8)' }}>
          <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-sub)', marginBottom: 4 }}>
            Métricas &gt; TikTok
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 'var(--font-size-3xl)' : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            TikTok
          </h1>
        </div>
        <div
          style={{
            background: 'var(--white)',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '60px 24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <TiktokIcon size={32} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>TikTok — sin conectar todavía</div>
          <div style={{ fontSize: 13, marginTop: 6, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            No hay una integración real de TikTok para este cliente todavía.
          </div>
        </div>
      </div>
    </div>
  );
}
