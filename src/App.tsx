import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useIsDesktop } from './hooks/useIsDesktop';
import { Sidebar } from './components/Sidebar';
import { MobileBar } from './components/MobileBar';
import { LoginScreen } from './pages/LoginScreen';
import { HomeScreen } from './pages/HomeScreen';
import { DetailScreen } from './pages/DetailScreen';
import { SettingsScreen } from './pages/SettingsScreen';
import { ServiceUnavailableScreen } from './pages/ServiceUnavailableScreen';
import { NAV, SIDEBAR_W, type Screen } from './screens';

function AuthenticatedShell() {
  const [screen, setScreen] = useState<Screen>('home');
  const isDesktop = useIsDesktop();
  const { userEmail, logout, clientServices } = useAuth();
  const visibleNav = NAV.filter((item) => !clientServices || clientServices[item.serviceKey]);
  // clientServices ya cargó y este cliente no tiene ningún servicio de los
  // que arma este dashboard (hoy, "crm" es el único) - en vez de caer a una
  // pantalla vacía o un 403 crudo, mostramos un estado explícito. Avisos
  // sigue siendo accesible: es 100% local, no depende de ningún servicio.
  const noServiceAvailable = clientServices !== null && visibleNav.length === 0;

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
        {noServiceAvailable && screen !== 'settings' ? (
          <ServiceUnavailableScreen isDesktop={isDesktop} />
        ) : (
          <>
            {screen === 'home' && <HomeScreen onDetail={() => setScreen('detail')} isDesktop={isDesktop} />}
            {screen === 'detail' && <DetailScreen isDesktop={isDesktop} />}
            {screen === 'settings' && <SettingsScreen isDesktop={isDesktop} />}
          </>
        )}
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
