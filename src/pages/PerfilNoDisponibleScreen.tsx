// Lo que ve el cliente cuando /dashboard/me falla y no hay perfil recordado
// (2026-09-28). Antes de esto el panel se quedaba en el spinner para siempre:
// sin el perfil no se sabe qué contrató el cliente, y nada lo volvía a pedir.
// Mismo molde que ServiceUnavailableScreen, con salida en los dos sentidos:
// reintentar, o cerrar sesión si el problema es la cuenta.
export function PerfilNoDisponibleScreen({
  mensaje,
  onRetry,
  onLogout,
}: {
  mensaje: string;
  onRetry: () => void;
  onLogout: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '60px 20px',
        textAlign: 'center',
        background: 'var(--bg)',
      }}
    >
      <span style={{ fontSize: 32 }}>⚠️</span>
      <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>No pudimos cargar tu panel</h1>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 340 }}>{mensaje}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="crm-btn crm-btn-primary" onClick={onRetry}>
          Reintentar
        </button>
        <button className="crm-btn crm-btn-ghost" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
