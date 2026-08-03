import { useState } from 'react';
import { OVERVIEW, NAV_SECTIONS, SERVICE_ENTRY_SCREEN, SIDEBAR_W, type NavLeaf, type Screen } from '../screens';
import { useAuth } from '../context/AuthContext';
import type { ClientServices, ServiceKey } from '../types';
import { TreePineIcon, LayoutGridIcon, ChartColumnIcon, ChevronDownIcon, SettingsIcon } from './icons/RockyIcons';

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
};
const SERVICE_ORDER: ServiceKey[] = ['pms', 'email_marketing', 'content_approval', 'agents', 'crm'];

// Visible si CUALQUIERA de los servicios del item está contratado.
// clientServices null (cargando) -> visible, mismo criterio de "nunca
// esconder por un falso negativo" de todo el panel.
function isVisible(item: NavLeaf, clientServices: ClientServices | null): boolean {
  return !clientServices || item.serviceKeys.some((key) => clientServices[key]);
}

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
  const { clientDisplayName, clientServices } = useAuth();
  const showOverview = isVisible(OVERVIEW, clientServices);
  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isVisible(item, clientServices)),
  })).filter((section) => section.items.length > 0);
  const contractedServices = clientServices ? SERVICE_ORDER.filter((key) => clientServices[key]) : [];

  const metricsActive = visibleSections.some((s) => s.items.some((i) => i.id === screen));
  const [metricsOpen, setMetricsOpen] = useState(metricsActive);
  const isMetricsScreenNow = visibleSections.some((s) => s.items.some((i) => i.id === screen));

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
        <div
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TreePineIcon size={18} color="#fff" />
        </div>
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
        {showOverview && (
          <button
            onClick={() => setScreen(OVERVIEW.id)}
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

        {visibleSections.map((section) => (
          <div key={section.label}>
            <button
              onClick={() => setMetricsOpen((v) => !v)}
              style={{
                all: 'unset',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                width: '100%',
                padding: 'var(--space-4) var(--space-5)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: isMetricsScreenNow ? 'var(--primary)' : 'var(--text-sub)',
                fontSize: 14,
                fontWeight: isMetricsScreenNow ? 600 : 500,
              }}
            >
              <ChartColumnIcon size={16} />
              <span style={{ flex: 1, textAlign: 'left' }}>{section.label}</span>
              <span
                style={{
                  display: 'inline-flex',
                  transform: metricsOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              >
                <ChevronDownIcon size={12} color="var(--text-faint)" />
              </span>
            </button>
            {metricsOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', paddingLeft: 'var(--space-8)', marginTop: 'var(--space-1)' }}>
                {section.items.map((item) => {
                  const active = screen === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setScreen(item.id)}
                      style={{
                        all: 'unset',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: 'var(--space-2) var(--space-5)',
                        borderRadius: 'var(--radius-sm)',
                        background: active ? activeTint : 'transparent',
                        color: active ? 'var(--primary)' : 'var(--text-sub)',
                        fontSize: 13,
                        fontWeight: active ? 600 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
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
