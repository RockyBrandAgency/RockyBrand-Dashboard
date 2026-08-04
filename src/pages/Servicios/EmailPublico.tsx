import { useState } from 'react';
import { AsyncState } from '../../components/AsyncState';
import type { EmailContact } from '../../types';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    subscribed: { label: 'Suscrito', bg: '#E3F5E8', text: '#1E7B3C' },
    // `pending` lo introdujo la importación con doble opt-in (2026-08-03) y
    // este mapa se quedó sin él: el cliente veía la palabra "pending" cruda
    // en su propia pantalla. Ámbar y no verde a propósito - todavía NO recibe
    // campañas, y pintarlo como suscrito haría creer que sí.
    pending: { label: 'Sin confirmar', bg: '#FBF3E2', text: '#8A6116' },
    unsubscribed: { label: 'Dado de baja', bg: '#F2F2F2', text: '#6B6B6B' },
    bounced: { label: 'Rebotado', bg: '#FDECEC', text: '#B3261E' },
    complained: { label: 'Marcó como spam', bg: '#FDECEC', text: '#B3261E' },
  };
  const m = map[status] ?? { label: status || 'Sin estado', bg: '#F2F2F2', text: '#6B6B6B' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: m.bg, color: m.text, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

// Público de Email Marketing: ver contactos reales, agregar uno a mano y
// etiquetarlo (segmento) - pedido explícito de Mato (2026-08-01). Reusa
// exactamente la misma tabla que ya usa el panel de staff
// (rockybrand-email-contacts), acotada al client_id del cliente logueado.
export function EmailPublico({
  contacts,
  loading,
  error,
  onReload,
  onAdd,
  onDelete,
}: {
  contacts: EmailContact[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onAdd: (email: string, name: string, tags: string[]) => Promise<void>;
  onDelete: (email: string) => Promise<void>;
}) {
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formTags, setFormTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const email = formEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setFormError('Ingresa un email válido.');
      return;
    }
    const tags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      await onAdd(email, formName.trim(), tags);
      setFormEmail('');
      setFormName('');
      setFormTags('');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo guardar el contacto.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (email: string) => {
    setDeletingEmail(email);
    try {
      await onDelete(email);
    } finally {
      setDeletingEmail(null);
    }
  };

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Agregar contacto</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
          <input
            type="email"
            placeholder="Email"
            aria-label="Email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
          />
          <input
            type="text"
            placeholder="Nombre (opcional)"
            aria-label="Nombre (opcional)"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
          />
          <input
            type="text"
            placeholder="Segmentos, separados por coma (ej: VIP, newsletter)"
            aria-label="Segmentos, separados por coma"
            value={formTags}
            onChange={(e) => setFormTags(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>
        {formError && <div style={{ fontSize: 12, color: '#B3261E', marginBottom: 10 }}>{formError}</div>}
        <button
          type="submit"
          disabled={saving}
          style={{
            all: 'unset',
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
            background: saving ? 'var(--border)' : 'var(--primary)',
            borderRadius: 8,
            cursor: saving ? 'default' : 'pointer',
            boxSizing: 'border-box',
          }}
        >
          {saving ? 'Guardando…' : 'Agregar'}
        </button>
      </form>

      <AsyncState loading={loading} error={error} onRetry={onReload}>
        {contacts && (
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '18px 16px 6px' }}>
              Público ({contacts.length})
            </div>
            {contacts.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Sin contactos todavía</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Nombre</th>
                      <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Segmentos</th>
                      <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Estado</th>
                      <th style={{ padding: '10px 16px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.email} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--text)' }}>{c.email}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{c.name || '—'}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{(c.tags ?? []).join(', ') || '—'}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <StatusBadge status={c.status} />
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDelete(c.email)}
                            disabled={deletingEmail === c.email}
                            style={{ all: 'unset', fontSize: 12, color: '#B3261E', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {deletingEmail === c.email ? 'Eliminando…' : 'Eliminar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </AsyncState>
    </div>
  );
}
