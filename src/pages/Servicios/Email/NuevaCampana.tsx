import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  getEmailCampaign, saveEmailCampaign, getEmailTemplates, sendTestEmail, UnauthorizedError,
} from '../../../api/dashboardApi';
import type { EmailCampaign, EmailTemplate } from '../../../types';
import { Card, Boton, Campo, Aviso } from './shared';
import { SubjectField } from './SubjectField';

// Pestaña propia, igual que "Nueva campaña" en el panel principal — no un
// formulario escondido dentro de la lista.
//
// El envío de prueba está acá y no en una pantalla aparte por una razón
// concreta: es el único momento en que alguien ve cómo se lee de verdad el
// correo antes de que salga a miles de personas. Separarlo del formulario
// hace que se salte.
export function NuevaCampana({ campaignId, onGuardada, onCancelar }: {
  campaignId: string | null;
  onGuardada: () => void;
  onCancelar: () => void;
}) {
  const { handleUnauthorized } = useAuth();
  const [campana, setCampana] = useState<Partial<EmailCampaign>>({ name: '', subject: '', html_body: '', template_id: '' });
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [cargando, setCargando] = useState(!!campaignId);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correoPrueba, setCorreoPrueba] = useState('');
  const [avisoPrueba, setAvisoPrueba] = useState<string | null>(null);

  useEffect(() => {
    getEmailTemplates()
      .then((r) => setTemplates(r.templates))
      .catch((e: unknown) => { if (e instanceof UnauthorizedError) handleUnauthorized(); });
  }, [handleUnauthorized]);

  useEffect(() => {
    if (!campaignId) return;
    setCargando(true);
    getEmailCampaign(campaignId)
      .then((r) => setCampana(r.campana))
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        setError(e instanceof Error ? e.message : 'No se pudo cargar la campaña.');
      })
      .finally(() => setCargando(false));
  }, [campaignId, handleUnauthorized]);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await saveEmailCampaign(campana);
      onGuardada();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function enviarPrueba() {
    if (!correoPrueba.includes('@')) { setAvisoPrueba('Ingresa un correo válido.'); return; }
    setAvisoPrueba(null);
    try {
      await sendTestEmail(campana.subject ?? '', campana.html_body ?? '', correoPrueba.trim());
      setAvisoPrueba(`Enviado a ${correoPrueba.trim()}. Revisa cómo se ve antes de mandarlo a tu lista.`);
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setAvisoPrueba(e instanceof Error ? e.message : 'No se pudo enviar la prueba.');
    }
  }

  if (cargando) return <Card><div className="crm-empty">Cargando…</div></Card>;

  return (
    <>
      <Card title={campaignId ? `Retomar: ${campana.name || 'sin nombre'}` : 'Nueva campaña'}>
        {error && <Aviso tono="critico">{error}</Aviso>}

        <Campo label="Nombre interno" hint="Solo lo ves tú, no aparece en el correo.">
          <input className="crm-input" value={campana.name ?? ''} onChange={(e) => setCampana({ ...campana, name: e.target.value })} />
        </Campo>

        <SubjectField value={campana.subject ?? ''} onChange={(v) => setCampana({ ...campana, subject: v })} />

        <Campo
          label="Plantilla"
          hint={templates.length === 0 ? 'Todavía no hay plantillas guardadas. Puedes escribir el contenido directamente abajo.' : undefined}
        >
          <select className="crm-input" value={campana.template_id ?? ''} onChange={(e) => setCampana({ ...campana, template_id: e.target.value })}>
            <option value="">— Sin plantilla, contenido propio —</option>
            {templates.map((t) => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
          </select>
        </Campo>

        <Campo label="Contenido (HTML)" hint="El enlace de baja se agrega automáticamente al enviar.">
          <textarea
            className="crm-input mono"
            style={{ minHeight: 200 }}
            value={campana.html_body ?? ''}
            onChange={(e) => setCampana({ ...campana, html_body: e.target.value })}
          />
        </Campo>

        <div style={{ display: 'flex', gap: 10 }}>
          <Boton tipo="primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar borrador'}
          </Boton>
          <Boton onClick={onCancelar}>Cancelar</Boton>
        </div>
      </Card>

      <Card title="Envío de prueba">
        <Aviso tono="info">
          Mándatelo a ti primero. Es el único momento en que ves cómo se lee de verdad — los enlaces, las imágenes y el
          corte del asunto en el teléfono — antes de que salga a toda tu lista.
        </Aviso>
        <div className="crm-toolbar">
          <input
            className="crm-search"
            placeholder="tu@correo.com"
            value={correoPrueba}
            onChange={(e) => setCorreoPrueba(e.target.value)}
          />
          <Boton onClick={enviarPrueba}>Enviar prueba</Boton>
        </div>
        {avisoPrueba && <Aviso tono={avisoPrueba.startsWith('Enviado') ? 'ok' : 'alerta'}>{avisoPrueba}</Aviso>}
      </Card>
    </>
  );
}
