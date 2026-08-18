import type { ReactNode } from 'react';
import { OVERVIEW, NAV_SECTIONS, SERVICE_ENTRY_SCREEN, isNavLeafVisible, type Screen } from '../screens';
import { useAuth } from '../context/AuthContext';
import { labelNav } from '../lib/terminologiaPms';
import { HomeIcon, ChartColumnIcon, BellIcon } from './icons/RockyIcons';
import { ClientLogo } from './ClientLogo';
import type { ServiceKey } from '../types';

const SERVICE_META: Record<ServiceKey, { label: string; icon: string }> = {
  agents: { label: 'Agentes de IA', icon: '◈' },
  // Misma etiqueta e icono que Sidebar.tsx. Faltaba desde el commit 6cca3d3,
  // que agrego 'content_approval' a ServiceKey pero no actualizo este Record:
  // el tipo lo exige, asi que el build de main quedo roto para todos.
  content_approval: { label: 'Revisión de Contenido', icon: '✓' },
  pms: { label: 'PMS', icon: '⌂' },
  crm: { label: 'CRM', icon: '☎' },
  email_marketing: { label: 'Email Marketing', icon: '✉' },
  store: { label: 'Tienda', icon: '▤' },
  agencias: { label: 'Agencias', icon: '⇄' },
};
// Sin 'pms' desde 2026-08-11: dejo de tener una entrada unica en
// SERVICE_ENTRY_SCREEN (ahora es una seccion con dos accesos), asi que
// listarlo aca no agregaba nada.
const SERVICE_ORDER: ServiceKey[] = ['agents', 'content_approval', 'crm', 'email_marketing', 'store'];

// Rediseño 2026-08-03 contra Figma (frames "21 — Mobile: Overview" y
// hermanos): el mockup muestra exactamente 4 tabs fijos (Inicio/Métricas/
// Servicios/Config), cada uno como landing page de su propia sección. La
// app real tiene más pantallas hoja de las que esos 4 tabs cubren sin
// ambigüedad (Métricas son 6 pantallas reales, Servicios son 3 páginas
// propias más 2 solo informativas) - colapsar la navegación a esa
// estructura de 4 tabs es un cambio de arquitectura de información, no
// un ajuste visual, y no está confirmado con Mato. Se aplicó el lenguaje
// visual nuevo (fondo claro, tokens, iconos reales donde había un ícono
// exacto de Figma para reusar) sin tocar el modelo de navegación real -
// la barra sigue siendo la lista plana de siempre, para no arriesgar que
// una pantalla real deje de ser alcanzable desde el celular.
export function MobileBar({
  screen,
  setScreen,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
}) {
  const { clientDisplayName, clientServices, clientLogoSrcLight, clientId, pmsRoomViews } = useAuth();

  // clientServices null = /dashboard/me todavia no contesto. Mismo criterio
  // que Sidebar.tsx (2026-08-18): mientras no se sabe que contrato este
  // cliente NO se dibuja ningun acceso, en vez de dibujarlos todos y sacar
  // los que sobran unos segundos despues. Desde la segunda carga de la
  // pestaña esto ni se nota: el perfil viene recordado (api/perfilCache.ts).
  const bottomItems: { id: Screen; icon: ReactNode; label: string }[] = [];
  if (clientServices !== null && isNavLeafVisible(OVERVIEW, clientServices, pmsRoomViews)) {
    bottomItems.push({ id: OVERVIEW.id, icon: <HomeIcon size={18} />, label: OVERVIEW.shortLabel });
  }
  for (const section of clientServices === null ? [] : NAV_SECTIONS) {
    for (const item of section.items) {
      if (isNavLeafVisible(item, clientServices, pmsRoomViews)) {
        bottomItems.push({ id: item.id, icon: <ChartColumnIcon size={18} />, label: labelNav(item, clientId, true) });
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
  bottomItems.push({ id: 'settings', icon: <BellIcon size={18} />, label: 'Avisos' });

  return (
    <>
      <header
        style={{
          background: 'var(--white)',
          borderBottom: '1px solid var(--border)',
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <ClientLogo src={clientLogoSrcLight} displayName={clientDisplayName} size={32} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {clientDisplayName ?? '…'}
          </div>
        </div>
        <button
          onClick={() => setScreen('settings')}
          aria-label="Avisos"
          style={{
            all: 'unset',
            width: 36,
            height: 36,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer',
            color: 'var(--text-sub)',
          }}
        >
          <BellIcon size={20} />
        </button>
      </header>
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'var(--white)',
          borderTop: '1px solid var(--border)',
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
              aria-current={active ? 'page' : undefined}
              style={{
                all: 'unset',
                flex: bottomItems.length > 5 ? '0 0 72px' : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                cursor: 'pointer',
                color: active ? 'var(--primary)' : 'var(--text-faint)',
                borderTop: active ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: 17, lineHeight: 1, display: 'flex' }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
