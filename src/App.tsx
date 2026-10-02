import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { initButtonHoverGsap } from './lib/buttonHoverGsap';
import { useBreakpoint } from './hooks/useBreakpoint';
import { SkeletonRows } from './components/Skeleton';
import { Sidebar } from './components/Sidebar';
import { SidebarRail } from './components/SidebarRail';
import { MobileBar } from './components/MobileBar';
import { LoginScreen } from './pages/LoginScreen';
import { PerfilNoDisponibleScreen } from './pages/PerfilNoDisponibleScreen';
import { Overview } from './pages/Overview';
import { DetailScreen } from './pages/DetailScreen';
import { ReservasResumen } from './pages/Reservas/ReservasResumen';
import { HuespedesLista } from './pages/Reservas/HuespedesLista';
import { Housekeeping } from './pages/Reservas/Housekeeping';
import { PmsResumen } from './pages/Reservas/PmsResumen';
import { Itinerarios } from './pages/Reservas/Itinerarios';
import { RevisionContenido } from './pages/Contenido/RevisionContenido';
import { PublicacionReels } from './pages/Publicacion/PublicacionReels';
import { EmailCampanas } from './pages/Servicios/EmailCampanas';
import { MetricasResumen } from './pages/Metricas/MetricasResumen';
import { MetricasFacebook } from './pages/Metricas/MetricasFacebook';
import { MetricasInstagram } from './pages/Metricas/MetricasInstagram';
import { MetricasYoutube } from './pages/Metricas/MetricasYoutube';
import { MetricasSeo } from './pages/Metricas/MetricasSeo';
import { MetricasWeb } from './pages/Metricas/MetricasWeb';
import { MetricasTiktok } from './pages/Metricas/MetricasTiktok';
import { TiendaInventario } from './pages/Tienda/TiendaInventario';
import { TiendaVentas } from './pages/Tienda/TiendaVentas';
import { TiendaGarantias } from './pages/Tienda/TiendaGarantias';
import { AgenciasLista } from './pages/Agencias/AgenciasLista';
import { AgenciasReporte } from './pages/Agencias/AgenciasReporte';
import { SettingsScreen } from './pages/SettingsScreen';
import { ServiceUnavailableScreen } from './pages/ServiceUnavailableScreen';
import { OVERVIEW, NAV_SECTIONS, SERVICE_ENTRY_SCREEN, SIDEBAR_W, isNavLeafVisible, type NavGate, type Screen } from './screens';
import type { ClientServices } from './types';

function isServiceEntryVisible(screen: Screen, clientServices: ClientServices | null): boolean {
  if (!clientServices) return true;
  return (Object.keys(SERVICE_ENTRY_SCREEN) as (keyof typeof SERVICE_ENTRY_SCREEN)[]).some(
    (key) => SERVICE_ENTRY_SCREEN[key] === screen && clientServices[key],
  );
}

// 'overview' es el default inicial (mismo criterio de siempre: se ve todo
// mientras clientServices carga). Pero un cliente real puede no tener
// 'pms' (ej. Chile Fly Fishing, que gestiona expediciones, no
// habitaciones) - una vez que clientServices carga, si la pantalla activa
// ya no es visible para este cliente, hay que moverse a la primera que sí
// lo sea, nunca dejarlo parado en una pantalla rota/vacía sin salida en
// el sidebar.
function isScreenVisible(screen: Screen, gate: NavGate): boolean {
  if (screen === 'settings') return true;
  if (screen === 'overview' || screen === 'llegadas-detalle') return isNavLeafVisible(OVERVIEW, gate);
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((i) => i.id === screen);
    if (item) return isNavLeafVisible(item, gate);
  }
  if (screen === 'servicio-pms-reservas' || screen === 'servicio-email-campanas' || screen === 'servicio-contenido-revision' || screen === 'publicacion-reels') return isServiceEntryVisible(screen, gate.services);
  return true;
}

function firstVisibleScreen(gate: NavGate): Screen | null {
  if (isNavLeafVisible(OVERVIEW, gate)) return OVERVIEW.id;
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((i) => isNavLeafVisible(i, gate));
    if (item) return item.id;
  }
  if (isServiceEntryVisible('servicio-pms-reservas', gate.services)) return 'servicio-pms-reservas';
  if (isServiceEntryVisible('servicio-email-campanas', gate.services)) return 'servicio-email-campanas';
  if (isServiceEntryVisible('publicacion-reels', gate.services)) return 'publicacion-reels';
  return null;
}

function AuthenticatedShell() {
  const [screen, setScreen] = useState<Screen>('overview');
  const breakpoint = useBreakpoint();
  // El contenido de cada pantalla solo distingue mobile vs. "no-mobile" -
  // tablet reutiliza el layout de contenido de desktop (grillas de 2
  // columnas, tipografía 24px), tal cual lo muestra el propio frame
  // tablet de Figma. Lo único que cambia en tablet es el nav (rail
  // angosto en vez del Sidebar completo), no el contenido.
  const isDesktop = breakpoint !== 'mobile';
  const { userEmail, logout, clientServices, pmsRoomViews, features } = useAuth();
  const gate: NavGate = { services: clientServices, pmsRoomViews, features };
  const anyNavVisible =
    isNavLeafVisible(OVERVIEW, gate) ||
    NAV_SECTIONS.some((section) => section.items.some((item) => isNavLeafVisible(item, gate))) ||
    isServiceEntryVisible('servicio-pms-reservas', clientServices) ||
    isServiceEntryVisible('servicio-email-campanas', clientServices) ||
    isServiceEntryVisible('publicacion-reels', clientServices);
  // clientServices ya cargó y este cliente no tiene ningún servicio de los
  // que arma este dashboard - en vez de caer a una pantalla vacía o un 403
  // crudo, mostramos un estado explícito. Avisos sigue siendo accesible:
  // es 100% local, no depende de ningún servicio.
  const noServiceAvailable = clientServices !== null && !anyNavVisible;

  useEffect(() => {
    if (clientServices === null) return;
    if (isScreenVisible(screen, { services: clientServices, pmsRoomViews, features })) return;
    const fallback = firstVisibleScreen({ services: clientServices, pmsRoomViews, features });
    if (fallback) setScreen(fallback);
    // `features` entra a las dependencias: si el cliente está parado en una
    // pantalla que el panel de staff acaba de apagar, este efecto lo saca
    // apenas llega el perfil nuevo, en vez de dejarlo en una pantalla sin
    // acceso en el menú.
  }, [clientServices, pmsRoomViews, features, screen]);

  return (
    <div style={{ display: 'flex', flexDirection: breakpoint === 'mobile' ? 'column' : 'row', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {breakpoint === 'desktop' && (
        <>
          <Sidebar screen={screen} setScreen={setScreen} userEmail={userEmail} onLogout={logout} />
          <div style={{ width: SIDEBAR_W, flexShrink: 0 }} />
        </>
      )}
      {breakpoint === 'tablet' && (
        <>
          <SidebarRail screen={screen} setScreen={setScreen} userEmail={userEmail} onLogout={logout} />
          <div style={{ width: 64, flexShrink: 0 }} />
        </>
      )}
      {breakpoint === 'mobile' && (
        <>
          <MobileBar screen={screen} setScreen={setScreen} />
          <div style={{ height: 56, flexShrink: 0, width: '100%' }} />
        </>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Mientras /dashboard/me no contesta no se sabe qué contrató este
            cliente, y 'overview' es solo el default de arranque. Dibujar esa
            pantalla igual era la otra mitad de lo que reportó Mato el
            2026-08-18 ("carga el panel con otras funciones y a los segundos
            muestra las que corresponden a chile fly fishing"): se pintaba el
            Overview de un lodge con habitaciones, se disparaban sus llamadas,
            y al llegar la respuesta el useEffect de acá arriba saltaba a otra
            pantalla. Ahora ese hueco es un esqueleto, y desde la segunda carga
            de la pestaña ni siquiera aparece: el perfil viene recordado
            (api/perfilCache.ts) y clientServices ya no es null en el primer
            render. */}
        {clientServices === null ? (
          <div style={{ padding: isDesktop ? 'var(--space-9)' : 'var(--space-6)' }}>
            <SkeletonRows rows={3} />
          </div>
        ) : noServiceAvailable && screen !== 'settings' ? (
          <ServiceUnavailableScreen isDesktop={isDesktop} />
        ) : (
          <>
            {screen === 'overview' && <Overview onDetail={() => setScreen('llegadas-detalle')} isDesktop={isDesktop} />}
            {screen === 'llegadas-detalle' && <DetailScreen isDesktop={isDesktop} />}
            {screen === 'metricas-resumen' && <MetricasResumen isDesktop={isDesktop} onNavigate={setScreen} />}
            {screen === 'metricas-facebook' && <MetricasFacebook isDesktop={isDesktop} />}
            {screen === 'metricas-instagram' && <MetricasInstagram isDesktop={isDesktop} />}
            {screen === 'metricas-youtube' && <MetricasYoutube isDesktop={isDesktop} />}
            {screen === 'metricas-seo' && <MetricasSeo isDesktop={isDesktop} />}
            {screen === 'metricas-web' && <MetricasWeb isDesktop={isDesktop} />}
            {screen === 'metricas-tiktok' && <MetricasTiktok isDesktop={isDesktop} />}
            {screen === 'servicio-pms-resumen' && <PmsResumen isDesktop={isDesktop} />}
            {screen === 'servicio-pms-reservas' && <ReservasResumen isDesktop={isDesktop} />}
            {screen === 'servicio-pms-huespedes' && <HuespedesLista isDesktop={isDesktop} />}
            {screen === 'servicio-pms-itinerarios' && <Itinerarios isDesktop={isDesktop} />}
            {screen === 'servicio-pms-housekeeping' && <Housekeeping isDesktop={isDesktop} />}
            {screen === 'servicio-email-campanas' && <EmailCampanas isDesktop={isDesktop} />}
            {screen === 'servicio-contenido-revision' && <RevisionContenido isDesktop={isDesktop} />}
            {screen === 'publicacion-reels' && <PublicacionReels isDesktop={isDesktop} />}
            {screen === 'tienda-inventario' && <TiendaInventario isDesktop={isDesktop} />}
            {screen === 'tienda-ventas' && <TiendaVentas isDesktop={isDesktop} />}
            {screen === 'tienda-garantias' && <TiendaGarantias isDesktop={isDesktop} />}
            {screen === 'agencias-lista' && <AgenciasLista isDesktop={isDesktop} />}
            {screen === 'agencias-reporte' && <AgenciasReporte isDesktop={isDesktop} />}
            {screen === 'settings' && <SettingsScreen isDesktop={isDesktop} />}
          </>
        )}
      </div>
    </div>
  );
}

function Root() {
  const { isAuthenticated, sessionExpiredMessage, clientServices, perfilError, reintentarPerfil, logout } = useAuth();

  // La bienvenida con el cerebro de marca y el equipo de agentes (BrainIntro)
  // se eliminó el 2026-10-02 por pedido de Mato: «no quiero que vuelva a
  // aparecer». El login lleva directo al panel.
  if (!isAuthenticated) return <LoginScreen sessionExpiredMessage={sessionExpiredMessage} />;
  // Sin perfil no hay qué pantallas mostrar: si /dashboard/me falló, se dice y
  // se ofrece reintentar, en vez del spinner o el esqueleto eternos.
  if (clientServices === null && perfilError) {
    return <PerfilNoDisponibleScreen mensaje={perfilError} onRetry={reintentarPerfil} onLogout={logout} />;
  }
  return <AuthenticatedShell />;
}

export default function App() {
  // Un solo listener global para el hover de TODOS los botones (ver
  // buttonHoverGsap.ts) - vive acá, en el componente raíz montado una
  // sola vez para toda la sesión (login incluido, LoginScreen también
  // tiene botones), no en cada pantalla.
  useEffect(() => initButtonHoverGsap(), []);

  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
