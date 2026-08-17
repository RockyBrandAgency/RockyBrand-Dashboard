import { useState, type ReactElement } from 'react';
import { OVERVIEW, NAV_SECTIONS, SERVICE_ENTRY_SCREEN, isNavLeafVisible, type Screen } from '../screens';
import { useAuth } from '../context/AuthContext';
import type { ServiceKey } from '../types';
import { labelSeccion } from '../lib/terminologiaPms';
import { LayoutGridIcon, ChartColumnIcon, ShoppingBagIcon, CalendarIcon, CalendarRangeIcon, ImageIcon, MailIcon, SettingsIcon } from './icons/RockyIcons';
import { ClientLogo } from './ClientLogo';
import { Sidebar } from './Sidebar';

const SERVICE_ICON: Partial<Record<ServiceKey, (size: number) => ReactElement>> = {
  pms: (size) => <CalendarIcon size={size} />,
  email_marketing: (size) => <MailIcon size={size} />,
  content_approval: (size) => <ImageIcon size={size} />,
};

// Icono por seccion de NAV_SECTIONS, mismo criterio que Sidebar.tsx.
const SECTION_ICON: Record<string, (size: number) => ReactElement> = {
  PMS: (size) => <CalendarRangeIcon size={size} />,
  Tienda: (size) => <ShoppingBagIcon size={size} />,
  Métricas: (size) => <ChartColumnIcon size={size} />,
};

// Nav-rail de 64px (Figma frame "25 — Tablet: Overview") - entre el ancho
// mobile y el desktop (768-1023px) no existía NINGÚN layout propio antes:
// el breakpoint viejo (useIsDesktop, corte único en 1024px) caía directo
// a MobileBar en ese rango. El hamburguesa expande al Sidebar completo
// como panel superpuesto - mismo componente, sin duplicar la lista de
// navegación real (con submenú de Métricas y "Servicios Contratados"
// informativos) que el rail comprimido no puede mostrar con solo íconos.
export function SidebarRail({ screen, setScreen, userEmail, onLogout }: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  userEmail: string;
  onLogout: () => void;
}) {
  const { clientDisplayName, clientServices, clientLogoSrcLight, pmsRoomViews, clientId } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const showOverview = isNavLeafVisible(OVERVIEW, clientServices, pmsRoomViews);
  // Una entrada por SECCION (antes asumia que NAV_SECTIONS[0] era siempre
  // Metricas - real hasta que Tienda se sumo como primera seccion 2026-08-05
  // y quedo mostrando/ocultando el rail de Metricas segun el servicio de
  // Tienda). Cada seccion navega a su primer item visible, mismo criterio
  // que "entrar por la primera pantalla" que ya usa el resto del panel.
  const railSections = NAV_SECTIONS.map((section) => {
    const firstVisible = section.items.find((i) => isNavLeafVisible(i, clientServices, pmsRoomViews));
    return firstVisible ? { section, firstVisible } : null;
  }).filter((s) => s !== null);
  const serviceEntries = (Object.keys(SERVICE_ENTRY_SCREEN) as ServiceKey[]).filter(
    (key) => clientServices ? clientServices[key] : false,
  );

  return (
    <>
      <aside
        style={{
          width: 64,
          flexShrink: 0,
          background: 'var(--white)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          padding: '20px 0',
          boxSizing: 'border-box',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Cerrar navegación' : 'Abrir navegación'}
            aria-expanded={expanded}
            style={{ all: 'unset', display: 'flex', padding: 8, borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-sub)' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2.25 4.5H15.75M2.25 9H15.75M2.25 13.5H15.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <div style={{ height: 1, width: 32, background: 'var(--border)' }} />
          <RailItem active={screen === 'overview'} onClick={() => setScreen('overview')} visible={showOverview} label="Overview">
            <LayoutGridIcon size={16} />
          </RailItem>
          {railSections.map(({ section, firstVisible }) => (
            <RailItem
              key={section.label}
              active={section.items.some((i) => i.id === screen)}
              onClick={() => setScreen(firstVisible.id)}
              visible
              label={labelSeccion(section, clientId)}
            >
              {(SECTION_ICON[section.label] ?? ((s: number) => <ChartColumnIcon size={s} />))(16)}
            </RailItem>
          ))}
          {serviceEntries.map((key) => {
            const target = SERVICE_ENTRY_SCREEN[key];
            if (!target) return null;
            return (
              <RailItem key={key} active={screen === target} onClick={() => setScreen(target)} visible label={key}>
                {SERVICE_ICON[key]?.(16)}
              </RailItem>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
          <RailItem active={screen === 'settings'} onClick={() => setScreen('settings')} visible label="Configuración">
            <SettingsIcon size={16} />
          </RailItem>
          <div style={{ height: 1, width: 32, background: 'var(--border)' }} />
          <ClientLogo src={clientLogoSrcLight} displayName={clientDisplayName} size={32} />
        </div>
      </aside>

      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 45 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, height: '100vh', boxShadow: '4px 0 16px rgba(0,0,0,0.12)' }}>
            <Sidebar
              screen={screen}
              setScreen={(s) => { setScreen(s); setExpanded(false); }}
              userEmail={userEmail}
              onLogout={onLogout}
            />
          </div>
        </div>
      )}
    </>
  );
}

function RailItem({ active, onClick, visible, label, children }: {
  active: boolean;
  onClick: () => void;
  visible: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={label}
      style={{
        all: 'unset',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        background: active ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--text-sub)',
      }}
    >
      {children}
    </button>
  );
}
