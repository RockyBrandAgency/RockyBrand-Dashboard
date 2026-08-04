import { TiktokIcon } from '../../components/PlatformIcons';
import { useClientContextLabel } from '../../hooks/useClientContextLabel';

// TikTok - a diferencia de Facebook/Instagram/YouTube/SEO, no hay
// ninguna fuente de datos conectada hoy (sin cron, sin snapshots en
// rockybrand-memory) - confirmado antes de construir, no se inventa un
// número. Estado honesto hasta que se conecte una integración real.
export function MetricasTiktok({ isDesktop }: { isDesktop: boolean }) {
  const contextLabel = useClientContextLabel();
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
            paddingBottom: 'var(--space-7)',
            borderBottom: '1px solid var(--border)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-sub)', marginBottom: 4 }}>
              Métricas &gt; TikTok
            </div>
            {/* 24px, no var(--font-size-3xl)=22px - hallazgo de auditoría
                2026-08-04: ningún canal de detalle en Figma usa ese token,
                todos son 24px reales (Facebook/Instagram/YouTube/SEO). */}
            <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Métricas TikTok
            </h1>
          </div>
          {contextLabel && <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{contextLabel}</div>}
        </div>
        {/* Rediseñado 2026-08-04 (auditoría capa-por-capa): el spec real de
            Figma pide una tarjeta protagonista (padding generoso, borde
            sólido, ícono en círculo de 80px, título 20px) en vez del
            placeholder chico con borde punteado que había antes. Se
            mantiene el logo real de TikTok en vez del ícono genérico de
            Figma (más honesto), y NO se agrega un botón "Conectar
            TikTok": no existe ningún flujo de conexión self-service desde
            el panel (mismo criterio que "Conectar PMS" en los estados
            vacíos) - solo el equipo RockyBrand puede activar esa
            integración. */}
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
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 16 }}>
            Contacta a tu ejecutivo de RockyBrand para activar esta integración.
          </div>
        </div>
      </div>
    </div>
  );
}
