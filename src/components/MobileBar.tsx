import { OVERVIEW, NAV_SECTIONS, SERVICE_ENTRY_SCREEN, type Screen } from '../screens';
import { useAuth } from '../context/AuthContext';
import type { ClientServices, ServiceKey } from '../types';
import type { NavLeaf } from '../screens';

const SERVICE_META: Record<ServiceKey, { label: string; icon: string }> = {
  agents: { label: 'Agentes de IA', icon: '◈' },
  pms: { label: 'PMS', icon: '⌂' },
  crm: { label: 'CRM', icon: '☎' },
  email_marketing: { label: 'Email Marketing', icon: '✉' },
};
const SERVICE_ORDER: ServiceKey[] = ['agents', 'pms', 'crm', 'email_marketing'];

function isVisible(item: NavLeaf, clientServices: ClientServices | null): boolean {
  return !clientServices || item.serviceKeys.some((key) => clientServices[key]);
}

export function MobileBar({
  screen,
  setScreen,
  userEmail,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  userEmail: string;
}) {
  const { clientDisplayName, clientServices, clientLogoSrc } = useAuth();

  const bottomItems: { id: Screen; icon: string; label: string }[] = [];
  if (isVisible(OVERVIEW, clientServices)) {
    bottomItems.push({ id: OVERVIEW.id, icon: '◉', label: OVERVIEW.shortLabel });
  }
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (isVisible(item, clientServices)) {
        bottomItems.push({ id: item.id, icon: section.icon, label: item.shortLabel });
      }
    }
  }
  if (clientServices) {
    for (const key of SERVICE_ORDER) {
      const entryScreen = SERVICE_ENTRY_SCREEN[key];
      if (entryScreen && clientServices[key]) {
        bottomItems.push({ id: entryScreen, icon: SERVICE_META[key].icon, label: SERVICE_META[key].label });
      }
    }
  }
  bottomItems.push({ id: 'settings', icon: '🔔', label: 'Avisos' });

  return (
    <>
      <header
        style={{
          background: 'var(--primary)',
          padding: '0 16px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {clientLogoSrc && (
            <img src={clientLogoSrc} alt={clientDisplayName ?? ''} style={{ height: 26, width: 'auto', maxWidth: 90, objectFit: 'contain', display: 'block' }} />
          )}
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{clientDisplayName ?? '…'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setScreen('settings')}
            style={{
              all: 'unset',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.10)',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--sage)',
              fontSize: 15,
            }}
          >
            🔔
          </button>
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
              fontSize: 12,
              fontWeight: 800,
              color: '#fff',
            }}
          >
            {userEmail.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'var(--primary)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          height: 60,
          overflowX: bottomItems.length > 5 ? 'auto' : 'visible',
        }}
      >
        {bottomItems.map((item) => {
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              style={{
                all: 'unset',
                flex: bottomItems.length > 5 ? '0 0 72px' : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                cursor: 'pointer',
                color: active ? '#fff' : 'var(--sage)',
                borderTop: active ? '2px solid #fff' : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: 17 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
