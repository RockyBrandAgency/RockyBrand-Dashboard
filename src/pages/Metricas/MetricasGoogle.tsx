// Gráficos de YouTube + posicionamiento en Google (SEO) - pedido explícito
// de Mato (2026-08-01), fase siguiente del trabajo. Mismo criterio que
// MetricasMeta.tsx: estado honesto, sin datos inventados.
export function MetricasGoogle({ isDesktop }: { isDesktop: boolean }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Métricas
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Google</h1>
        </div>
        <div
          style={{
            background: 'var(--white)',
            border: '1px dashed var(--border)',
            borderRadius: 12,
            padding: '60px 24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>YouTube y posicionamiento — próximamente</div>
          <div style={{ fontSize: 13, marginTop: 6, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            Gráficos de YouTube y SEO/Google Search Console, en construcción.
          </div>
        </div>
      </div>
    </div>
  );
}
