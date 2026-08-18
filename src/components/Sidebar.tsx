import { useEffect, useRef } from 'react';
import { OVERVIEW, NAV_SECTIONS, SERVICE_ENTRY_SCREEN, SIDEBAR_W, isNavLeafVisible, type Screen } from '../screens';
import { useAuth } from '../context/AuthContext';
import { labelNav, labelSeccion } from '../lib/terminologiaPms';
import { startSkeletonPulse } from '../lib/skeletonGsap';
import type { ServiceKey } from '../types';
import { LayoutGridIcon, ChartColumnIcon, SettingsIcon, ShoppingBagIcon, CalendarRangeIcon } from './icons/RockyIcons';

// Icono por seccion de NAV_SECTIONS (screens.ts) - por label porque
// NavSection.icon hoy es un emoji sin uso real en el desktop/tablet (solo
// SERVICE_META.icon, otra lista, se usa para el rail/mobile). Agregar acá
// cuando se sume una seccion nueva.
const SECTION_ICON: Record<string, (size: number) => import('react').ReactElement> = {
  PMS: (size) => <CalendarRangeIcon size={size} />,
  Tienda: (size) => <ShoppingBagIcon size={size} />,
  Métricas: (size) => <ChartColumnIcon size={size} />,
};
import { ClientLogo } from './ClientLogo';

// Pedido explícito de Mato (2026-08-01): que el cliente vea qué servicios
// tiene contratados con RockyBrand, en su propio sidebar. Los que ya
// tienen página propia (PMS, Email Marketing) son navegables; los que no
// (CRM, Agentes de IA) quedan informativos - no se inventa una página
// vacía. Mismos labels que ya usa 05-panel-web (ServicesToggleCard.tsx).
const SERVICE_META: Record<ServiceKey, { label: string }> = {
  agents: { label: 'Agentes de IA' },
  pms: { label: 'PMS' },
  crm: { label: 'CRM' },
  email_marketing: { label: 'Email Marketing' },
  content_approval: { label: 'Revisión de Contenido' },
  store: { label: 'Tienda' },
  agencias: { label: 'Agencias' },
};
// 'store' queda afuera a proposito: a diferencia de PMS/Email/Revision de
// Contenido (que solo tienen esta entrada informativa o, si tienen pagina
// propia, UNA sola via SERVICE_ENTRY_SCREEN), Tienda ya tiene su propia
// seccion completa arriba en NAV_SECTIONS (Inventario + Ventas) - listarla
// tambien aca era una "Tienda" duplicada, no cliqueable, justo debajo de
// la Tienda real y cliqueable. Encontrado en vivo (captura real de Mato).
// 'pms' sale de esta lista por el mismo motivo que 'store' (2026-08-11):
// desde que tiene sus dos accesos propios en NAV_SECTIONS, listarlo
// tambien aca dejaba un "PMS" duplicado y no clickeable debajo del PMS
// real.
const SERVICE_ORDER: ServiceKey[] = ['email_marketing', 'content_approval', 'agents', 'crm'];

const activeTint = 'color-mix(in srgb, var(--primary) 8%, transparent)';

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
  const { clientDisplayName, clientServices, clientLogoSrcLight, clientId, pmsRoomViews } = useAuth();
  // clientServices null = /dashboard/me todavia no contesto. Antes se
  // dibujaba el menu COMPLETO en ese hueco (isNavLeafVisible devuelve true
  // sin datos) y al llegar la respuesta desaparecian las secciones que este
  // cliente no tiene: es exactamente el "carga el panel con otras funciones y
  // a los segundos muestra las que corresponden" que reporto Mato el
  // 2026-08-18. Mostrar de mas y despues retractarse es peor que no mostrar
  // todavia: el cliente alcanza a leer -y a hacer click en- menus que no son
  // suyos. Mientras no se sabe, va un esqueleto.
  const cargando = clientServices === null;
  const showOverview = isNavLeafVisible(OVERVIEW, clientServices, pmsRoomViews);
  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isNavLeafVisible(item, clientServices, pmsRoomViews)),
  })).filter((section) => section.items.length > 0);
  const contractedServices = clientServices ? SERVICE_ORDER.filter((key) => clientServices[key]) : [];

  return (
    <aside
      style={{
        width: SIDEBAR_W,
        flexShrink: 0,
        background: 'var(--white)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        padding: 'var(--space-8) var(--space-8) 0',
        boxSizing: 'border-box',
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-9)' }}>
        <ClientLogo src={clientLogoSrcLight} displayName={clientDisplayName} size={32} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {clientDisplayName ?? '…'}
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            RockyBrand Client
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {cargando && <NavSkeleton />}

        {!cargando && showOverview && (
          <button
            onClick={() => setScreen(OVERVIEW.id)}
            aria-current={screen === OVERVIEW.id ? 'page' : undefined}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              width: '100%',
              padding: 'var(--space-4) var(--space-5)',
              borderRadius: 'var(--radius-sm)',
              background: screen === OVERVIEW.id ? activeTint : 'transparent',
              color: screen === OVERVIEW.id ? 'var(--primary)' : 'var(--text-sub)',
              fontSize: 14,
              fontWeight: screen === OVERVIEW.id ? 600 : 500,
              cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            <LayoutGridIcon size={16} />
            {OVERVIEW.label}
          </button>
        )}

        {/* Secciones SIEMPRE desplegadas (2026-08-18, pedido explícito de
            Mato: "en el panel sidebar izquierdo quiero que aparezca todo
            desplegado, es decir, Lodge como titulo y todos sus enlaces hacia
            abajo"). El encabezado deja de ser un botón que abre y cierra y
            pasa a ser lo que dice el pedido: un título. Con eso se va también
            el estado openSections y su chevron - no queda un control que no
            controla nada.

            "Lodge" es lo que Chile Fly Fishing ve donde otro cliente lee
            "PMS": el texto visible lo resuelve labelSeccion() por cliente,
            section.label sigue siendo la identidad interna (ícono y key). */}
        {!cargando && visibleSections.map((section) => (
          <div key={section.label} style={{ marginTop: 'var(--space-3)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: '0 var(--space-5) var(--space-2)',
                color: 'var(--text-faint)',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {(SECTION_ICON[section.label] ?? ((s: number) => <ChartColumnIcon size={s} />))(14)}
              <span style={{ flex: 1, textAlign: 'left' }}>{labelSeccion(section, clientId)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {section.items.map((item) => {
                const active = screen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setScreen(item.id)}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      all: 'unset',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      padding: 'var(--space-3) var(--space-5)',
                      paddingLeft: 'var(--space-8)',
                      borderRadius: 'var(--radius-sm)',
                      background: active ? activeTint : 'transparent',
                      color: active ? 'var(--primary)' : 'var(--text-sub)',
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {labelNav(item, clientId)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {contractedServices.length > 0 && (
          <div style={{ marginTop: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Servicios Contratados
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {contractedServices.map((key) => {
                const meta = SERVICE_META[key];
                const entryScreen = SERVICE_ENTRY_SCREEN[key];
                if (entryScreen) {
                  const active = screen === entryScreen;
                  return (
                    <button
                      key={key}
                      onClick={() => setScreen(entryScreen)}
                      aria-current={active ? 'page' : undefined}
                      style={{
                        all: 'unset',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        width: '100%',
                        padding: 'var(--space-2) var(--space-5)',
                        borderRadius: 'var(--radius-sm)',
                        background: active ? activeTint : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--status-bien-dot)',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: active ? 'var(--primary)' : 'var(--text-sub)' }}>
                        {meta.label}
                      </span>
                    </button>
                  );
                }
                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-2) var(--space-5)',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-faint)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-faint)' }}>{meta.label}</span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'var(--surface-2)',
                        borderRadius: 'var(--radius-xs)',
                        padding: '2px 6px',
                      }}
                    >
                      INFO
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div style={{ paddingBottom: 'var(--space-8)', paddingTop: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <button
          onClick={() => setScreen('settings')}
          aria-current={screen === 'settings' ? 'page' : undefined}
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            width: '100%',
            padding: 'var(--space-4) var(--space-5)',
            borderRadius: 'var(--radius-sm)',
            background: screen === 'settings' ? activeTint : 'transparent',
            color: screen === 'settings' ? 'var(--primary)' : 'var(--text-sub)',
            fontSize: 14,
            fontWeight: screen === 'settings' ? 600 : 500,
            cursor: 'pointer',
          }}
        >
          <SettingsIcon size={14} />
          Configuración
        </button>

        <div style={{ height: 1, background: 'var(--border)', width: '100%' }} />

        <button
          onClick={onLogout}
          title="Cerrar sesión"
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            width: '100%',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: activeTint,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>{userEmail.charAt(0).toUpperCase()}</span>
          </div>
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>Cerrar sesión</div>
          </div>
        </button>
      </div>
    </aside>
  );
}

// Silueta del menú mientras /dashboard/me no contesta. Tiene la forma real
// del sidebar ya armado (un acceso suelto arriba, dos secciones con sus
// enlaces) para que al llegar la respuesta el contenido ocupe el mismo lugar
// y no salte. Deliberadamente NO dice ningún nombre de sección: mientras no
// se sabe qué contrató este cliente, cualquier texto sería una afirmación
// sobre él que todavía no está respaldada por nada.
//
// Mismo pulso GSAP que el resto de los esqueletos del panel
// (lib/skeletonGsap.ts, spec 44 de Figma) - respeta prefers-reduced-motion.
function NavSkeleton() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return startSkeletonPulse(Array.from(el.querySelectorAll<HTMLElement>('[data-skeleton-bar]')));
  }, []);

  const barra = (width: string, height: number, sangria = 0) => (
    <div data-skeleton-bar style={{ padding: `0 var(--space-5)`, paddingLeft: sangria ? 'var(--space-8)' : 'var(--space-5)' }}>
      <div style={{ width, height, borderRadius: 6, background: 'var(--surface-2)' }} />
    </div>
  );

  return (
    <div ref={ref} aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {barra('55%', 14)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
        {barra('38%', 10)}
        {barra('62%', 12, 1)}
        {barra('72%', 12, 1)}
        {barra('50%', 12, 1)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-5)' }}>
        {barra('30%', 10)}
        {barra('58%', 12, 1)}
        {barra('66%', 12, 1)}
      </div>
    </div>
  );
}
