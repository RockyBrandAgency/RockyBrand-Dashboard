import { useMemo, useState } from 'react';
import type { EmailContact, EmailSegment } from '../../types';

function subscribedCount(contacts: EmailContact[], segment: EmailSegment): number {
  return contacts.filter((c) => {
    if (c.status !== 'subscribed') return false;
    if (segment.type === 'tag') return (c.tags ?? []).includes(segment.value ?? '');
    return true;
  }).length;
}

// Enviar un email manual desde el propio panel del cliente - pedido
// explícito de Mato (2026-08-01). Compone asunto+cuerpo, elige a quién
// (todos o un segmento real derivado de los tags que el cliente ya puso
// en Público), puede mandarse una prueba primero, y confirma antes de
// mandar de verdad - un envío real no tiene deshacer.
export function EmailEnviar({
  contacts,
  onSendTest,
  onSendNow,
}: {
  contacts: EmailContact[] | null;
  onSendTest: (subject: string, htmlBody: string, testEmail: string) => Promise<void>;
  onSendNow: (subject: string, htmlBody: string, segment: EmailSegment, name: string) => Promise<void>;
}) {
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [segmentType, setSegmentType] = useState<'all' | 'tag'>('all');
  const [segmentTag, setSegmentTag] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    (contacts ?? []).forEach((c) => (c.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [contacts]);

  const segment: EmailSegment = segmentType === 'tag' ? { type: 'tag', value: segmentTag } : { type: 'all' };
  const recipientCount = contacts ? subscribedCount(contacts, segment) : null;

  const validCompose = subject.trim() && htmlBody.trim() && (segmentType === 'all' || segmentTag);

  const handleTest = async () => {
    setFormError(null);
    setTestResult(null);
    if (!subject.trim() || !htmlBody.trim()) {
      setFormError('Completa asunto y contenido antes de mandar la prueba.');
      return;
    }
    if (!testEmail.trim() || !testEmail.includes('@')) {
      setFormError('Ingresa un email válido para la prueba.');
      return;
    }
    setSendingTest(true);
    try {
      await onSendTest(subject, htmlBody, testEmail.trim());
      setTestResult(`Prueba enviada a ${testEmail.trim()}.`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo enviar la prueba.');
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendNow = async () => {
    setFormError(null);
    setSending(true);
    try {
      await onSendNow(subject, htmlBody, segment, subject);
      setSendResult(`Envío disparado a ${recipientCount ?? '—'} contacto(s).`);
      setConfirming(false);
      setSubject('');
      setHtmlBody('');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo enviar el correo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px', maxWidth: 640 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Enviar email manual</div>

      <label htmlFor="email-enviar-asunto" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>Asunto</label>
      <input
        id="email-enviar-asunto"
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Ej: Novedades de la temporada"
        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', marginBottom: 14 }}
      />

      <label htmlFor="email-enviar-contenido" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>Contenido (HTML simple)</label>
      <textarea
        id="email-enviar-contenido"
        value={htmlBody}
        onChange={(e) => setHtmlBody(e.target.value)}
        placeholder="<p>Hola {{name}}, ...</p>"
        rows={8}
        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box', marginBottom: 14, resize: 'vertical' }}
      />

      <label htmlFor="email-enviar-segmento" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>Enviar a</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select
          id="email-enviar-segmento"
          value={segmentType}
          onChange={(e) => setSegmentType(e.target.value as 'all' | 'tag')}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
        >
          <option value="all">Todos los suscritos</option>
          <option value="tag">Un segmento específico</option>
        </select>
        {segmentType === 'tag' && (
          <select
            value={segmentTag}
            onChange={(e) => setSegmentTag(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          >
            <option value="">Elegir segmento…</option>
            {availableTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {recipientCount !== null && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
            {recipientCount} contacto{recipientCount === 1 ? '' : 's'} recibirían este envío
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
        <input
          type="email"
          placeholder="Mandarme una prueba a…"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
        />
        <button
          onClick={handleTest}
          disabled={sendingTest}
          style={{
            all: 'unset',
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text)',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: sendingTest ? 'default' : 'pointer',
            boxSizing: 'border-box',
            flexShrink: 0,
          }}
        >
          {sendingTest ? 'Enviando…' : 'Enviar prueba'}
        </button>
      </div>
      {testResult && <div style={{ fontSize: 12, color: '#1E7B3C', marginBottom: 10 }}>{testResult}</div>}
      {formError && <div style={{ fontSize: 12, color: '#B3261E', marginBottom: 10 }}>{formError}</div>}
      {sendResult && <div style={{ fontSize: 12, color: '#1E7B3C', marginBottom: 10 }}>{sendResult}</div>}

      {!confirming ? (
        <button
          onClick={() => {
            setFormError(null);
            if (!validCompose) {
              setFormError('Completa asunto, contenido y el segmento antes de enviar.');
              return;
            }
            setConfirming(true);
          }}
          className="crm-btn crm-btn-primary"
        >
          Enviar ahora
        </button>
      ) : (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            ¿Confirmas el envío a {recipientCount ?? '—'} contacto{recipientCount === 1 ? '' : 's'}?
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Esta acción no se puede deshacer.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSendNow}
              disabled={sending}
              style={{
                all: 'unset',
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                background: sending ? 'var(--border)' : '#B3261E',
                borderRadius: 8,
                cursor: sending ? 'default' : 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {sending ? 'Enviando…' : 'Sí, enviar'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={sending}
              style={{
                all: 'unset',
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
