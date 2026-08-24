import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getEmailContacts,
  upsertEmailContact,
  deleteEmailContact,
  UnauthorizedError,
} from '../../api/dashboardApi';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { TabsWithIndicator } from '../../components/TabsWithIndicator';
import { ConsultasEmail } from './Email/Consultas';
import { useClientContextLabel } from '../../hooks/useClientContextLabel';
import { ResumenEmail } from './Email/Resumen';
import { PendientesEmail } from './Email/Pendientes';
import { CampanasEmail } from './Email/Campanas';
import { CampanaDetalle } from './Email/CampanaDetalle';
import { NuevaCampana } from './Email/NuevaCampana';
import { AudienciasEmail } from './Email/Audiencias';
import { TemplatesEmail } from './Email/Templates';
import { MetricasEmail } from './Email/Metricas';
import { AutomatizacionesEmail } from './Email/Automatizaciones';
import type { EmailContact, EmailFeatureKey } from '../../types';

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
type Tab = 'resumen' | 'consultas' | 'pendientes' | 'campanas' | 'nueva' | 'audiencias' | 'templates' | 'metricas' | 'automatizaciones';

// `featureKey`: qué bandera de client-config enciende esta pestaña. Se
// administran una por una desde el panel de staff (2026-08-19) - hay
// clientes a los que le entregamos el canal completo y otros a los que solo
// les mostramos las métricas de lo que enviamos por ellos.
const TABS: { id: Tab; label: string; featureKey: EmailFeatureKey }[] = [
  { id: 'resumen', label: 'Resumen', featureKey: 'email_resumen' },
  { id: 'consultas', label: 'Consultas', featureKey: 'email_consultas' },
  { id: 'pendientes', label: 'Pendientes', featureKey: 'email_pendientes' },
  { id: 'campanas', label: 'Campañas', featureKey: 'email_campanas' },
  { id: 'nueva', label: 'Nueva campaña', featureKey: 'email_nueva_campana' },
  { id: 'audiencias', label: 'Audiencias', featureKey: 'email_audiencias' },
  { id: 'templates', label: 'Templates', featureKey: 'email_templates' },
  { id: 'metricas', label: 'Métricas', featureKey: 'email_metricas' },
  { id: 'automatizaciones', label: 'Automatizaciones', featureKey: 'email_automatizaciones' },
];

// Título de cada pestaña, tal cual el archivo real de Figma (frames 11-18)
// — no todas comparten el mismo título genérico.
const TAB_TITLES: Record<Tab, string> = {
  resumen: 'Resumen General',
  consultas: 'Consultas del Formulario de Contacto',
  pendientes: 'Pendientes de Revisión',
  campanas: 'Campañas Enviadas y Programadas',
  nueva: 'Diseño de Nueva Campaña',
  audiencias: 'Gestión de Campañas y Contactos',
  templates: 'Gestión de Campañas y Contactos',
  metricas: 'Gestión de Campañas y Contactos',
  automatizaciones: 'Gestión de Campañas y Contactos',
};

export function EmailCampanas({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized, features } = useAuth();
  const contextLabel = useClientContextLabel();
  const [tab, setTab] = useState<Tab>('resumen');
  // `features` null = todavía no sé (cargando, o backend anterior a las
  // banderas): se ven TODAS. Nunca esconder por un dato que no llegó, el
  // mismo criterio que el sidebar.
  // useMemo para que la identidad del array no cambie en cada render: es
  // dependencia del efecto que corrige la pestaña activa.
  const visibleTabs = useMemo(() => TABS.filter((t) => !features || features[t.featureKey]), [features]);
  const puedeCrearCampana = !features || features.email_nueva_campana;
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // El detalle vive DENTRO de la pestaña Campañas, no como pestaña propia:
  // en el panel principal es una ruta hija de campañas, y una pestaña extra
  // que solo tiene sentido con una campaña elegida sobra en la barra.
  const [detalleId, setDetalleId] = useState<string | null>(null);
  // Plantilla con la que se llega a "Nueva campaña" desde la galería.
  const [plantillaInicial, setPlantillaInicial] = useState<string | null>(null);

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

  // Si la pestaña abierta dejó de estar habilitada (o si 'resumen', que es
  // el default, está apagada para este cliente), saltar a la primera que sí
  // lo esté. Sin esto el cliente vería la barra sin esa pestaña pero con su
  // contenido debajo.
  useEffect(() => {
    if (!visibleTabs.length) return;
    if (visibleTabs.some((t) => t.id === tab)) return;
    setTab(visibleTabs[0].id);
    setDetalleId(null);
    setEditandoId(null);
  }, [visibleTabs, tab]);

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
    setPlantillaInicial(null);
    setTab('nueva');
  };

  const irANuevaConPlantilla = (templateId: string) => {
    setEditandoId(null);
    setPlantillaInicial(templateId);
    setTab('nueva');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 'var(--space-6)' }}>
          <div>
            <div className="crm-desc-label">Email Marketing</div>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {TAB_TITLES[tab]}
            </h1>
          </div>
          {contextLabel && <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{contextLabel}</div>}
        </div>

        {!visibleTabs.length && (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-sub)', fontSize: 14 }}>
            Este cliente tiene Email Marketing contratado pero ninguna de sus
            pestañas habilitada. Se administran desde el panel de RockyBrand.
          </div>
        )}

        <TabsWithIndicator
          tabs={visibleTabs}
          active={tab}
          onChange={(id) => { setTab(id); setDetalleId(null); if (id !== 'nueva') setEditandoId(null); }}
        />

        {/* Cada sección va envuelta por separado: si una revienta al dibujar,
            se cae ESA y no las otras siete. La pestaña sigue navegable. */}
        {!!visibleTabs.length && (
        <ErrorBoundary nombre={`la sección ${TABS.find((t) => t.id === tab)?.label ?? ''}`} key={tab}>
          {tab === 'resumen' && <ResumenEmail />}
          {tab === 'consultas' && <ConsultasEmail />}
          {tab === 'pendientes' && <PendientesEmail />}
          {tab === 'campanas' && (detalleId
            ? <CampanaDetalle campaignId={detalleId} onVolver={() => setDetalleId(null)} />
            : <CampanasEmail
                onEditar={puedeCrearCampana ? irANueva : undefined}
                onNueva={puedeCrearCampana ? () => irANueva(null) : undefined}
                onVerDetalle={setDetalleId}
              />)}
          {tab === 'nueva' && (
            <NuevaCampana
              campaignId={editandoId}
              plantillaInicial={plantillaInicial}
              onGuardada={() => { setEditandoId(null); setPlantillaInicial(null); setTab('campanas'); }}
              onCancelar={() => { setEditandoId(null); setPlantillaInicial(null); setTab('campanas'); }}
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
          {tab === 'templates' && (
            <TemplatesEmail
              isDesktop={isDesktop}
              onUsarEnCampana={puedeCrearCampana ? irANuevaConPlantilla : undefined}
            />
          )}
          {tab === 'metricas' && <MetricasEmail />}
          {tab === 'automatizaciones' && <AutomatizacionesEmail />}
        </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
