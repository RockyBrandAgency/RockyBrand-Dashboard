// Se muestra cuando el cliente logueado no tiene ningún servicio habilitado
// de los que arma este dashboard (rockybrand-client-config.services) - hoy
// "crm" es el único, así que en la práctica esto es "CRM apagado para este
// cliente". No es un error: es un estado real y esperable.
export function ServiceUnavailableScreen({ isDesktop }: { isDesktop: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: isDesktop ? '80px 40px' : '60px 20px',
        textAlign: 'center',
        background: 'var(--bg)',
      }}
    >
      <span style={{ fontSize: 32 }}>🔒</span>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Este panel no está habilitado todavía</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 340 }}>
        Contacta a tu agencia para activar el servicio correspondiente.
      </div>
    </div>
  );
}
