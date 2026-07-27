import type { ReactNode } from 'react';

// El Make no traia ningun estado de carga/error (todo era data estatica
// hardcodeada) - este wrapper es nuevo, necesario para consumir una API
// real que puede tardar o fallar.
export function AsyncState({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--primary)',
            animation: 'dashboard-spin 0.8s linear infinite',
          }}
        />
        <style>{'@keyframes dashboard-spin { to { transform: rotate(360deg); } }'}</style>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Cargando…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '60px 20px',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 28 }}>⚠️</span>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No se pudo cargar la información</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320 }}>{error}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              all: 'unset',
              background: 'var(--primary)',
              color: '#fff',
              borderRadius: 9,
              padding: '10px 22px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
