import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useIsDesktop } from './hooks/useIsDesktop';
import { Sidebar } from './components/Sidebar';
import { MobileBar } from './components/MobileBar';
import { LoginScreen } from './pages/LoginScreen';
import { HomeScreen } from './pages/HomeScreen';
import { DetailScreen } from './pages/DetailScreen';
import { SettingsScreen } from './pages/SettingsScreen';
import { SIDEBAR_W, type Screen } from './screens';

function AuthenticatedShell() {
  const [screen, setScreen] = useState<Screen>('home');
  const isDesktop = useIsDesktop();
  const { userEmail, logout } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {isDesktop ? (
        <>
          <Sidebar screen={screen} setScreen={setScreen} userEmail={userEmail} onLogout={logout} />
          <div style={{ width: SIDEBAR_W, flexShrink: 0 }} />
        </>
      ) : (
        <>
          <MobileBar screen={screen} setScreen={setScreen} userEmail={userEmail} />
          <div style={{ height: 56, flexShrink: 0, width: '100%' }} />
        </>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {screen === 'home' && <HomeScreen onDetail={() => setScreen('detail')} isDesktop={isDesktop} />}
        {screen === 'detail' && <DetailScreen isDesktop={isDesktop} />}
        {screen === 'settings' && <SettingsScreen isDesktop={isDesktop} />}
      </div>
    </div>
  );
}

function Root() {
  const { isAuthenticated, sessionExpiredMessage } = useAuth();
  if (!isAuthenticated) return <LoginScreen sessionExpiredMessage={sessionExpiredMessage} />;
  return <AuthenticatedShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
