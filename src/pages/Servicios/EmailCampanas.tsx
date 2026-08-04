import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getEmailContacts,
  upsertEmailContact,
  deleteEmailContact,
  UnauthorizedError,
} from '../../api/dashboardApi';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ResumenEmail } from './Email/Resumen';
import { PendientesEmail } from './Email/Pendientes';
import { CampanasEmail } from './Email/Campanas';
import { CampanaDetalle } from './Email/CampanaDetalle';
import { NuevaCampana } from './Email/NuevaCampana';
import { AudienciasEmail } from './Email/Audiencias';
import { TemplatesEmail } from './Email/Templates';
import { MetricasEmail } from './Email/Metricas';
import { AutomatizacionesEmail } from './Email/Automatizaciones';
import type { EmailContact } from '../../types';

// Plataforma de Email Marketing dentro del panel propio del cliente.
//
// Las pestañas y el orden son EXACTAMENTE los del panel principal
// (05-panel-web/src/pages/EmailCrm/EmailCrmLayout.tsx) — pedido de Mato
// (2026-08-03): la herramienta tiene que ser la misma de los dos lados,
// tomando como referencia el panel principal.
//
// Lo que sigue siendo distinto, a propósito, son dos cosas:
//  - Los colores: cada cliente ve su marca en su panel (regla permanente).
//  - El alcance: acá el client_id sale SIEMPRE del JWT. El panel principal
//    tiene un selector de cliente; este no puede tenerlo ni podría, porque
//    estas pantallas no mandan client_id a ninguna parte.
type Tab = 'resumen' | 'pendientes' | 'campanas' | 'nueva' | 'audiencias' | 'templates' | 'metricas' | 'automatizaciones';

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'campanas', label: 'Campañas' },
  { id: 'nueva', label: 'Nueva campaña' },
  { id: 'audiencias', label: 'Audiencias' },
  { id: 'templates', label: 'Templates' },
  { id: 'metricas', label: 'Métricas' },
  { id: 'automatizaciones', label: 'Automatizaciones' },
];

// Título de cada pestaña, tal cual el archivo real de Figma (frames 11-18)
// — no todas comparten el mismo título genérico.
const TAB_TITLES: Record<Tab, string> = {
  resumen: 'Resumen General',
  pendientes: 'Pendientes de Revisión',
  campanas: 'Campañas Enviadas y Programadas',
  nueva: 'Diseño de Nueva Campaña',
  audiencias: 'Gestión de Campañas y Contactos',
  templates: 'Gestión de Campañas y Contactos',
  metricas: 'Gestión de Campañas y Contactos',
  automatizaciones: 'Gestión de Campañas y Contactos',
};

export function EmailCampanas({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [tab, setTab] = useState<Tab>('resumen');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // El detalle vive DENTRO de la pestaña Campañas, no como pestaña propia:
  // en el panel principal es una ruta hija de campañas, y una pestaña extra
  // que solo tiene sentido con una campaña elegida sobra en la barra.
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const [contacts, setContacts] = useState<EmailContact[] | null>(null);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const loadContacts = useCallback(() => {
    setContactsLoading(true);
    setContactsError(null);
    getEmailContacts()
      .then((res) => setContacts(res.contacts))
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setContactsError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setContactsLoading(false));
  }, [handleUnauthorized]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleAddContact = async (email: string, name: string, tags: string[]) => {
    await upsertEmailContact(email, name, tags);
    loadContacts();
  };

  const handleDeleteContact = async (email: string) => {
    await deleteEmailContact(email);
    loadContacts();
  };

  const irANueva = (campaignId: string | null) => {
    setEditandoId(campaignId);
    setTab('nueva');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 'var(--space-6)' }}>
          <div>
            <div className="crm-desc-label">Email Marketing</div>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 'var(--font-size-3xl)' : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {TAB_TITLES[tab]}
            </h1>
          </div>
        </div>

        <div className="crm-tabbar" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`crm-tab${tab === t.id ? ' active' : ''}`}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); setDetalleId(null); if (t.id !== 'nueva') setEditandoId(null); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Cada sección va envuelta por separado: si una revienta al dibujar,
            se cae ESA y no las otras siete. La pestaña sigue navegable. */}
        <ErrorBoundary nombre={`la sección ${TABS.find((t) => t.id === tab)?.label ?? ''}`} key={tab}>
          {tab === 'resumen' && <ResumenEmail />}
          {tab === 'pendientes' && <PendientesEmail />}
          {tab === 'campanas' && (detalleId
            ? <CampanaDetalle campaignId={detalleId} onVolver={() => setDetalleId(null)} />
            : <CampanasEmail onEditar={irANueva} onNueva={() => irANueva(null)} onVerDetalle={setDetalleId} />)}
          {tab === 'nueva' && (
            <NuevaCampana
              campaignId={editandoId}
              onGuardada={() => { setEditandoId(null); setTab('campanas'); }}
              onCancelar={() => { setEditandoId(null); setTab('campanas'); }}
            />
          )}
          {tab === 'audiencias' && (
            <AudienciasEmail
              contacts={contacts}
              loading={contactsLoading}
              error={contactsError}
              onReload={loadContacts}
              onAdd={handleAddContact}
              onDelete={handleDeleteContact}
            />
          )}
          {tab === 'templates' && <TemplatesEmail />}
          {tab === 'metricas' && <MetricasEmail />}
          {tab === 'automatizaciones' && <AutomatizacionesEmail />}
        </ErrorBoundary>
      </div>
    </div>
  );
}
