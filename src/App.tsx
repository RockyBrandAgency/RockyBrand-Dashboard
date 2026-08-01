import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useIsDesktop } from './hooks/useIsDesktop';
import { Sidebar } from './components/Sidebar';
import { MobileBar } from './components/MobileBar';
import { LoginScreen } from './pages/LoginScreen';
import { EstadoActual } from './pages/EstadoActual';
import { DetailScreen } from './pages/DetailScreen';
import { ReservasResumen } from './pages/Reservas/ReservasResumen';
import { MetricasResumen } from './pages/Metricas/MetricasResumen';
import { MetricasMeta } from './pages/Metricas/MetricasMeta';
import { MetricasGoogle } from './pages/Metricas/MetricasGoogle';
import { SettingsScreen } from './pages/SettingsScreen';
import { ServiceUnavailableScreen } from './pages/ServiceUnavailableScreen';
import { ESTADO_ACTUAL, NAV_SECTIONS, SIDEBAR_W, type NavLeaf, type Screen } from './screens';
import type { ClientServices } from './types';

function isVisible(item: NavLeaf, clientServices: ClientServices | null): boolean {
  return !clientServices || item.serviceKeys.some((key) => clientServices[key]);
}

function AuthenticatedShell() {
  const [screen, setScreen] = useState<Screen>('estado-actual');
  const isDesktop = useIsDesktop();
  const { userEmail, logout, clientServices } = useAuth();
  const anyNavVisible =
    isVisible(ESTADO_ACTUAL, clientServices) || NAV_SECTIONS.some((section) => section.items.some((item) => isVisible(item, clientServices)));
  // clientServices ya cargó y este cliente no tiene ningún servicio de los
  // que arma este dashboard - en vez de caer a una pantalla vacía o un 403
  // crudo, mostramos un estado explícito. Avisos sigue siendo accesible:
  // es 100% local, no depende de ningún servicio.
  const noServiceAvailable = clientServices !== null && !anyNavVisible;

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
            {screen === 'estado-actual' && <EstadoActual onDetail={() => setScreen('llegadas-detalle')} isDesktop={isDesktop} />}
            {screen === 'llegadas-detalle' && <DetailScreen isDesktop={isDesktop} />}
            {screen === 'reservas-resumen' && <ReservasResumen isDesktop={isDesktop} />}
            {screen === 'metricas-resumen' && <MetricasResumen isDesktop={isDesktop} />}
            {screen === 'metricas-meta' && <MetricasMeta isDesktop={isDesktop} />}
            {screen === 'metricas-google' && <MetricasGoogle isDesktop={isDesktop} />}
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
