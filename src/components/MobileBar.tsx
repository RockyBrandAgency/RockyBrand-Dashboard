import type { Screen } from '../screens';

export function MobileBar({
  screen,
  setScreen,
  userEmail,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  userEmail: string;
}) {
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
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Alto Castillo Lodge</div>
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
        }}
      >
        {[
          { id: 'home' as Screen, icon: '◉', label: 'Estatus' },
          { id: 'detail' as Screen, icon: '↓', label: 'Llegadas' },
          { id: 'settings' as Screen, icon: '🔔', label: 'Avisos' },
        ].map((item) => {
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              style={{
                all: 'unset',
                flex: 1,
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
