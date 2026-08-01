// Panel ejecutivo con gráficos de Meta (Facebook + Instagram) - pedido
// explícito de Mato (2026-08-01), fase siguiente del trabajo: hoy esos
// datos solo existen en el panel de staff (get_metrics_report en
// panel_config_api_lambda.py), no hay ruta client-facing todavía. Estado
// honesto en vez de un gráfico con datos inventados.
export function MetricasMeta({ isDesktop }: { isDesktop: boolean }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Métricas
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>META</h1>
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
          <div style={{ fontSize: 28, marginBottom: 12 }}>📘</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Panel ejecutivo de Meta — próximamente</div>
          <div style={{ fontSize: 13, marginTop: 6, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            Gráficos detallados de Facebook e Instagram, en construcción.
          </div>
        </div>
      </div>
    </div>
  );
}
