import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getEmailContacts,
  upsertEmailContact,
  deleteEmailContact,
  sendTestEmail,
  sendEmailNow,
  UnauthorizedError,
} from '../../api/dashboardApi';
import { EmailEnviar } from './EmailEnviar';
import { ResumenEmail } from './Email/Resumen';
import { CampanasEmail } from './Email/Campanas';
import { AudienciasEmail } from './Email/Audiencias';
import { TemplatesEmail } from './Email/Templates';
import { MetricasEmail } from './Email/Metricas';
import { AutomatizacionesEmail } from './Email/Automatizaciones';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import type { EmailContact, EmailSegment } from '../../types';

type Tab = 'resumen' | 'campanas' | 'audiencias' | 'templates' | 'metricas' | 'automatizaciones' | 'enviar';

// Plataforma de Email Marketing dentro del propio panel del cliente - pedido
// explícito de Mato (2026-08-01, ampliado a las 6 secciones el 2026-08-03).
// Se construye DENTRO del panel del cliente: nunca acceso a 05-panel-web, que
// es la herramienta de staff. El aislamiento no depende de esta pantalla -
// el client_id sale siempre del JWT en el backend, y estas pantallas no
// pueden mandar uno aunque quisieran.
const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'campanas', label: 'Campañas' },
  { id: 'audiencias', label: 'Audiencias' },
  { id: 'templates', label: 'Plantillas' },
  { id: 'metricas', label: 'Métricas' },
  { id: 'automatizaciones', label: 'Automatizaciones' },
  { id: 'enviar', label: 'Enviar' },
];

export function EmailCampanas({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [tab, setTab] = useState<Tab>('resumen');

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

  const handleAddContact = async (contactEmail: string, name: string, tags: string[]) => {
    await upsertEmailContact(contactEmail, name, tags);
    loadContacts();
  };

  const handleDeleteContact = async (contactEmail: string) => {
    await deleteEmailContact(contactEmail);
    loadContacts();
  };

  const handleSendTest = async (subject: string, htmlBody: string, testEmail: string) => {
    await sendTestEmail(subject, htmlBody, testEmail);
  };

  const handleSendNow = async (subject: string, htmlBody: string, segment: EmailSegment, name: string) => {
    await sendEmailNow(subject, htmlBody, segment, name);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Servicios Contratados
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Email Marketing</h1>
        </div>

        {/* Con 7 pestañas ya no entran en una fila en móvil: se dejan
            desbordar horizontalmente en su propio contenedor en vez de
            empujar el ancho de la página. */}
        <div style={{ overflowX: 'auto', marginBottom: 24, paddingBottom: 2 }}>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    all: 'unset',
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#fff' : 'var(--text-muted)',
                    background: active ? 'var(--primary)' : 'var(--white)',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cada sección va envuelta por separado: si una revienta al dibujar,
            se cae ESA y no las otras seis. La pestaña sigue navegable. */}
        <ErrorBoundary nombre={`la sección ${TABS.find((t) => t.id === tab)?.label ?? ''}`} key={tab}>
        {tab === 'resumen' && <ResumenEmail />}
        {tab === 'campanas' && <CampanasEmail />}
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
        {tab === 'enviar' && <EmailEnviar contacts={contacts} onSendTest={handleSendTest} onSendNow={handleSendNow} />}
        </ErrorBoundary>
      </div>
    </div>
  );
}
