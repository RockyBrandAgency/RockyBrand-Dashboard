import { NAV, SIDEBAR_W, type Screen } from '../screens';

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
      <div style={{ padding: '28px 22px 20px', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
        <div style={{ marginTop: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            Alto Castillo Lodge
          </div>
          <div style={{ fontSize: 10, color: 'var(--sage)', letterSpacing: '0.10em', textTransform: 'uppercase', marginTop: 3 }}>
            Patagonia · Chile
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
        {NAV.map((item) => {
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
                padding: '11px 12px',
                borderRadius: 8,
                marginBottom: 2,
                background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: active ? '#fff' : 'var(--sage)',
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                borderLeft: active ? '3px solid #fff' : '3px solid transparent',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}

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
