import { useState, useEffect, useCallback } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import { useAuth } from '../../context/AuthContext';
import {
  getEmailContacts,
  upsertEmailContact,
  deleteEmailContact,
  sendTestEmail,
  sendEmailNow,
  UnauthorizedError,
} from '../../api/dashboardApi';
import { EmailPublico } from './EmailPublico';
import { EmailEnviar } from './EmailEnviar';
import type { EmailContact, EmailSegment } from '../../types';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pct(part: number, total: number): string {
  if (total <= 0) return '—';
  return `${((part / total) * 100).toFixed(1)}%`;
}

type Tab = 'resumen' | 'publico' | 'enviar';

// Plataforma de Email Marketing dentro del propio panel del cliente -
// pedido explícito de Mato (2026-08-01): "vea las métricas y un botón
// donde solo vea el panel de administración... enviar un email manual...
// agregar manualmente un público y segmentarlo". Alcance confirmado: se
// construye DENTRO del panel del cliente (nunca acceso a 05-panel-web,
// la herramienta de staff) - mismo aislamiento de siempre, client_id
// siempre del JWT en el backend.
export function EmailCampanas({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [tab, setTab] = useState<Tab>('resumen');
  const { data, loading, error, reload } = useMetricsReport();
  const email = data?.email;

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

  const TABS: { id: Tab; label: string }[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'publico', label: 'Público' },
    { id: 'enviar', label: 'Enviar' },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Servicios Contratados
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Email Marketing</h1>
        </div>

        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
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
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'resumen' && (
          <AsyncState loading={loading} error={error} onRetry={reload}>
            {email && (
              <>
                <div style={{ marginBottom: 28 }}>
                  <KpiRow
                    items={[
                      { label: 'Enviados', value: email.enviados },
                      { label: 'Aperturas', value: email.aperturas },
                      { label: 'Clics', value: email.clics },
                      { label: 'Rebotes', value: email.rebotes },
                    ]}
                  />
                </div>

                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '18px 16px 6px' }}>Campañas</div>
                  {email.campaigns.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Sin campañas en el rango</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Campaña</th>
                            <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Fecha</th>
                            <th style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Enviados</th>
                            <th style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Open rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {email.campaigns.map((c, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                              <td style={{ padding: '10px 16px', color: 'var(--text)' }}>{c.name ?? 'Sin nombre'}</td>
                              <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{formatDate(c.sent_at)}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)' }}>{c.enviados}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontWeight: 700 }}>{pct(c.aperturas, c.enviados)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </AsyncState>
        )}

        {tab === 'publico' && (
          <EmailPublico
            contacts={contacts}
            loading={contactsLoading}
            error={contactsError}
            onReload={loadContacts}
            onAdd={handleAddContact}
            onDelete={handleDeleteContact}
          />
        )}

        {tab === 'enviar' && <EmailEnviar contacts={contacts} onSendTest={handleSendTest} onSendNow={handleSendNow} />}
      </div>
    </div>
  );
}
