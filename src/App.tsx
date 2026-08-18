import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { initButtonHoverGsap } from './lib/buttonHoverGsap';
import { useBreakpoint } from './hooks/useBreakpoint';
import { SkeletonRows } from './components/Skeleton';
import { Sidebar } from './components/Sidebar';
import { SidebarRail } from './components/SidebarRail';
import { MobileBar } from './components/MobileBar';
import { LoginScreen } from './pages/LoginScreen';
import { BrainIntro } from './pages/BrainIntro';
import { Overview } from './pages/Overview';
import { DetailScreen } from './pages/DetailScreen';
import { ReservasResumen } from './pages/Reservas/ReservasResumen';
import { HuespedesLista } from './pages/Reservas/HuespedesLista';
import { Housekeeping } from './pages/Reservas/Housekeeping';
import { PmsResumen } from './pages/Reservas/PmsResumen';
import { Itinerarios } from './pages/Reservas/Itinerarios';
import { RevisionContenido } from './pages/Contenido/RevisionContenido';
import { EmailCampanas } from './pages/Servicios/EmailCampanas';
import { MetricasResumen } from './pages/Metricas/MetricasResumen';
import { MetricasFacebook } from './pages/Metricas/MetricasFacebook';
import { MetricasInstagram } from './pages/Metricas/MetricasInstagram';
import { MetricasYoutube } from './pages/Metricas/MetricasYoutube';
import { MetricasSeo } from './pages/Metricas/MetricasSeo';
import { MetricasTiktok } from './pages/Metricas/MetricasTiktok';
import { TiendaInventario } from './pages/Tienda/TiendaInventario';
import { TiendaVentas } from './pages/Tienda/TiendaVentas';
import { TiendaGarantias } from './pages/Tienda/TiendaGarantias';
import { AgenciasLista } from './pages/Agencias/AgenciasLista';
import { AgenciasReporte } from './pages/Agencias/AgenciasReporte';
import { SettingsScreen } from './pages/SettingsScreen';
import { ServiceUnavailableScreen } from './pages/ServiceUnavailableScreen';
import { OVERVIEW, NAV_SECTIONS, SERVICE_ENTRY_SCREEN, SIDEBAR_W, isNavLeafVisible, type Screen } from './screens';
import { CLIENT_ACCENT_ON_DARK, CLIENTES_SIN_INTRO, clientIdFromHostname } from './branding';
import { agentsForClient } from './agents';
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
function isScreenVisible(screen: Screen, clientServices: ClientServices | null, pmsRoomViews: boolean): boolean {
  if (screen === 'settings') return true;
  if (screen === 'overview' || screen === 'llegadas-detalle') return isNavLeafVisible(OVERVIEW, clientServices, pmsRoomViews);
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((i) => i.id === screen);
    if (item) return isNavLeafVisible(item, clientServices, pmsRoomViews);
  }
  if (screen === 'servicio-pms-reservas' || screen === 'servicio-email-campanas' || screen === 'servicio-contenido-revision') return isServiceEntryVisible(screen, clientServices);
  return true;
}

function firstVisibleScreen(clientServices: ClientServices | null, pmsRoomViews: boolean): Screen | null {
  if (isNavLeafVisible(OVERVIEW, clientServices, pmsRoomViews)) return OVERVIEW.id;
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((i) => isNavLeafVisible(i, clientServices, pmsRoomViews));
    if (item) return item.id;
  }
  if (isServiceEntryVisible('servicio-pms-reservas', clientServices)) return 'servicio-pms-reservas';
  if (isServiceEntryVisible('servicio-email-campanas', clientServices)) return 'servicio-email-campanas';
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
  const { userEmail, logout, clientServices, pmsRoomViews } = useAuth();
  const anyNavVisible =
    isNavLeafVisible(OVERVIEW, clientServices, pmsRoomViews) ||
    NAV_SECTIONS.some((section) => section.items.some((item) => isNavLeafVisible(item, clientServices, pmsRoomViews))) ||
    isServiceEntryVisible('servicio-pms-reservas', clientServices) ||
    isServiceEntryVisible('servicio-email-campanas', clientServices);
  // clientServices ya cargó y este cliente no tiene ningún servicio de los
  // que arma este dashboard - en vez de caer a una pantalla vacía o un 403
  // crudo, mostramos un estado explícito. Avisos sigue siendo accesible:
  // es 100% local, no depende de ningún servicio.
  const noServiceAvailable = clientServices !== null && !anyNavVisible;

  useEffect(() => {
    if (clientServices === null) return;
    if (isScreenVisible(screen, clientServices, pmsRoomViews)) return;
    const fallback = firstVisibleScreen(clientServices, pmsRoomViews);
    if (fallback) setScreen(fallback);
  }, [clientServices, pmsRoomViews, screen]);

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
            {screen === 'metricas-tiktok' && <MetricasTiktok isDesktop={isDesktop} />}
            {screen === 'servicio-pms-resumen' && <PmsResumen isDesktop={isDesktop} />}
            {screen === 'servicio-pms-reservas' && <ReservasResumen isDesktop={isDesktop} />}
            {screen === 'servicio-pms-huespedes' && <HuespedesLista isDesktop={isDesktop} />}
            {screen === 'servicio-pms-itinerarios' && <Itinerarios isDesktop={isDesktop} />}
            {screen === 'servicio-pms-housekeeping' && <Housekeeping isDesktop={isDesktop} />}
            {screen === 'servicio-email-campanas' && <EmailCampanas isDesktop={isDesktop} />}
            {screen === 'servicio-contenido-revision' && <RevisionContenido isDesktop={isDesktop} />}
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

// Una vez por sesión de navegador, no por navegación ni por render: la
// bienvenida se ve al entrar y no vuelve a aparecer hasta el próximo login en
// una pestaña nueva. sessionStorage y no localStorage a propósito - que se vea
// de nuevo mañana está bien; que se vea 8 veces en la misma tarde, no.
const BRAIN_INTRO_KEY = 'rockybrand.brainIntroSeen';

function Root() {
  const { isAuthenticated, sessionExpiredMessage, clientId, clientServices, clientLogoSrcDark, clientDisplayName } = useAuth();
  const [introSeen, setIntroSeen] = useState(() => sessionStorage.getItem(BRAIN_INTRO_KEY) === '1');

  const dismissIntro = useCallback(() => {
    sessionStorage.setItem(BRAIN_INTRO_KEY, '1');
    setIntroSeen(true);
  }, []);

  const agents = agentsForClient(clientId);
  const accent = clientId ? CLIENT_ACCENT_ON_DARK[clientId] : undefined;
  // Solo con datos REALES: el cliente tiene el servicio de agentes contratado,
  // tiene equipo definido y tiene un acento documentado en su manual de marca.
  // Si falta cualquiera de los tres, no se muestra - antes que inventarle un
  // color o un equipo a un cliente, entra derecho al panel.
  //
  // `clientServices?.agents` y no `clientServices !== null && clientServices.agents`:
  // si /dashboard/me alguna vez responde sin el campo `services`, lo segundo
  // tira un TypeError acá arriba de todo el árbol y tumba el panel entero por
  // una pantalla de bienvenida (pasó de verdad probando esto). Con optional
  // chaining, un payload raro simplemente no muestra la bienvenida.
  const servicesLoaded = clientServices !== null;
  // Y además: que el cliente no esté en la lista de los que entran derecho
  // (CLIENTES_SIN_INTRO en branding.ts, con el porqué de cada uno).
  //
  // Se mira el clientId real y, mientras /dashboard/me no responde, el
  // subdominio - que es el mismo indicio que LoginScreen ya usa para pintar el
  // theme antes del login. Sirve solo para saltarse la espera oscura de abajo:
  // si el hostname dijera un cliente y el JWT otro, lo único que pasa es que la
  // bienvenida aparece un instante tarde. Ninguna decisión de datos cuelga de
  // acá; el aislamiento sigue saliendo del claim del JWT, nunca del hostname.
  const sinIntro = CLIENTES_SIN_INTRO.has(clientId ?? clientIdFromHostname(window.location.hostname) ?? '');
  const canShowIntro = !sinIntro && !!clientServices?.agents && agents.length > 0 && !!accent;

  // Mientras /dashboard/me carga todavía no se sabe si corresponde mostrarla.
  // En vez de mostrar el panel y que la bienvenida aparezca encima medio
  // segundo después, se espera con la misma superficie oscura sobre la que va a
  // dibujarse el cerebro: sin salto, y sin afirmar nada del cliente todavía.
  // Para quien no la ve nunca, esa espera es una pantalla negra gratis.
  if (!isAuthenticated) return <LoginScreen sessionExpiredMessage={sessionExpiredMessage} />;
  // La espera oscura sobre la que después se dibuja el cerebro. Lleva un
  // punto que respira: sin él, en el primer ingreso de la pestaña -el único
  // caso en que esto se ve, porque desde el segundo el perfil viene recordado
  // (api/perfilCache.ts)- la pantalla negra y quieta se lee como "se colgó",
  // que fue textual lo que reportó Mato el 2026-08-18.
  if (!introSeen && !servicesLoaded && !sinIntro) {
    return (
      <div className="brain-screen">
        <div className="brain-espera" role="status" aria-label="Cargando" />
      </div>
    );
  }
  if (!introSeen && canShowIntro && accent) {
    return (
      <BrainIntro
        agents={agents}
        accent={accent}
        logoSrc={clientLogoSrcDark}
        logoAlt={clientDisplayName ?? 'Logo del cliente'}
        onEnter={dismissIntro}
      />
    );
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
