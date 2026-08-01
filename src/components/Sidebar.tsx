import { OVERVIEW, NAV_SECTIONS, SERVICE_ENTRY_SCREEN, SIDEBAR_W, type NavLeaf, type Screen } from '../screens';
import { useAuth } from '../context/AuthContext';
import type { ClientServices, ServiceKey } from '../types';

// Pedido explícito de Mato (2026-08-01): que el cliente vea qué servicios
// tiene contratados con RockyBrand, en su propio sidebar. Los que ya
// tienen página propia (PMS, Email Marketing) son navegables; los que no
// (CRM, Agentes de IA) quedan informativos - no se inventa una página
// vacía. Mismos labels/iconos que ya usa 05-panel-web
// (ServicesToggleCard.tsx), para que un mismo servicio se vea igual en
// ambos paneles.
const SERVICE_META: Record<ServiceKey, { label: string; icon: string }> = {
  agents: { label: 'Agentes de IA', icon: '◈' },
  pms: { label: 'PMS', icon: '⌂' },
  crm: { label: 'CRM', icon: '☎' },
  email_marketing: { label: 'Email Marketing', icon: '✉' },
};
const SERVICE_ORDER: ServiceKey[] = ['agents', 'pms', 'crm', 'email_marketing'];

// Visible si CUALQUIERA de los servicios del item está contratado.
// clientServices null (cargando) -> visible, mismo criterio de "nunca
// esconder por un falso negativo" de todo el panel.
function isVisible(item: NavLeaf, clientServices: ClientServices | null): boolean {
  return !clientServices || item.serviceKeys.some((key) => clientServices[key]);
}

export function Sidebar({
  screen,
  setScreen,
  userEmail,
  onLogout,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  userEmail: string;
  onLogout: () => void;
}) {
  const { clientDisplayName, clientDisplaySubtitle, clientServices, clientLogoSrc } = useAuth();
  const showOverview = isVisible(OVERVIEW, clientServices);
  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isVisible(item, clientServices)),
  })).filter((section) => section.items.length > 0);
  const contractedServices = clientServices ? SERVICE_ORDER.filter((key) => clientServices[key]) : [];

  return (
    <aside
      style={{
        width: SIDEBAR_W,
        flexShrink: 0,
        background: 'var(--primary)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        boxShadow: '2px 0 16px rgba(0,0,0,0.14)',
        zIndex: 40,
      }}
    >
      <div style={{ padding: '24px 18px 18px', borderBottom: '1px solid rgba(255,255,255,0.10)', textAlign: 'center' }}>
        {clientLogoSrc && (
          <img
            src={clientLogoSrc}
            alt={clientDisplayName ?? ''}
            style={{ height: 100, width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto 12px' }}
          />
        )}
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {clientDisplayName ?? '…'}
        </div>
        {clientDisplaySubtitle && (
          <div style={{ fontSize: 10, color: 'var(--sage)', letterSpacing: '0.10em', textTransform: 'uppercase', marginTop: 3 }}>
            {clientDisplaySubtitle}
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
        {showOverview && (
          <button
            onClick={() => setScreen(OVERVIEW.id)}
            style={{
              all: 'unset',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              boxSizing: 'border-box',
              padding: '11px 12px',
              borderRadius: 8,
              marginBottom: 2,
              background: screen === OVERVIEW.id ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: screen === OVERVIEW.id ? '#fff' : 'var(--sage)',
              fontSize: 14,
              fontWeight: screen === OVERVIEW.id ? 700 : 500,
              cursor: 'pointer',
              borderLeft: screen === OVERVIEW.id ? '3px solid #fff' : '3px solid transparent',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>◉</span>
            {OVERVIEW.label}
          </button>
        )}

        {visibleSections.map((section) => (
          <div key={section.label} style={{ marginTop: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 12px 6px',
                fontSize: 10,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
              }}
            >
              <span>{section.icon}</span>
              {section.label}
            </div>
            {section.items.map((item) => {
              const active = screen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  style={{
                    all: 'unset',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px 10px 24px',
                    borderRadius: 8,
                    marginBottom: 2,
                    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: active ? '#fff' : 'var(--sage)',
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    borderLeft: active ? '3px solid #fff' : '3px solid transparent',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}

        {contractedServices.length > 0 && (
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--sage)',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                padding: '0 12px 8px',
              }}
            >
              Servicios Contratados
            </div>
            {contractedServices.map((key) => {
              const meta = SERVICE_META[key];
              const entryScreen = SERVICE_ENTRY_SCREEN[key];
              if (entryScreen) {
                const active = screen === entryScreen;
                return (
                  <button
                    key={key}
                    onClick={() => setScreen(entryScreen)}
                    style={{
                      all: 'unset',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 12px',
                      borderRadius: 8,
                      marginBottom: 2,
                      background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: active ? '#fff' : 'var(--sage)',
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                      borderLeft: active ? '3px solid #fff' : '3px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{meta.icon}</span>
                    {meta.label}
                    <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>→</span>
                  </button>
                );
              }
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{meta.icon}</span>
                  {meta.label}
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => setScreen('settings')}
          style={{
            all: 'unset',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 12px',
            borderRadius: 8,
            marginTop: 4,
            background: screen === 'settings' ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: screen === 'settings' ? '#fff' : 'var(--sage)',
            fontSize: 14,
            fontWeight: screen === 'settings' ? 700 : 500,
            cursor: 'pointer',
            borderLeft: screen === 'settings' ? '3px solid #fff' : '3px solid transparent',
          }}
        >
          <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>🔔</span>
          Avisos
        </button>
      </nav>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)', flexShrink: 0 }}>
        <button
          onClick={onLogout}
          style={{
            all: 'unset',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            boxSizing: 'border-box',
            padding: '14px 20px',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: 'rgba(255,255,255,0.15)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 800,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </div>
            <div style={{ fontSize: 10, color: 'var(--sage)', letterSpacing: '0.04em' }}>Cerrar sesión</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
