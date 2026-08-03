import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  getEmailCampaign, saveEmailCampaign, getEmailTemplates, sendTestEmail,
  sendEmailNow, scheduleEmailCampaign, getEmailContacts, UnauthorizedError,
} from '../../../api/dashboardApi';
import type { EmailCampaign, EmailTemplate, EmailContact, EmailSegment } from '../../../types';
import { Card, Boton, Campo, Aviso } from './shared';
import { SubjectField } from './SubjectField';

// Pestaña propia, igual que "Nueva campaña" en el panel principal — no un
// formulario escondido dentro de la lista.
//
// El envío de prueba está acá y no en una pantalla aparte por una razón
// concreta: es el único momento en que alguien ve cómo se lee de verdad el
// correo antes de que salga a miles de personas. Separarlo del formulario
// hace que se salte.
// La audiencia se arma desde las etiquetas REALES de los contactos, no de
// una lista fija: una etiqueta que no existe es una campaña que sale a cero
// personas sin que nadie lo note hasta después.
function opcionesDeAudiencia(contactos: EmailContact[]) {
  const tags = new Set<string>();
  contactos.forEach((c) => (c.tags || []).forEach((t) => tags.add(t)));
  const activos = contactos.filter((c) => c.status === 'subscribed');
  return [
    { key: 'all', label: `Toda la lista (${activos.length} pueden recibir)`, cuantos: activos.length },
    ...Array.from(tags).sort().map((t) => ({
      key: `tag:${t}`,
      label: `Etiqueta "${t}"`,
      cuantos: activos.filter((c) => (c.tags || []).includes(t)).length,
    })),
  ];
}

function segmentoDesde(key: string): EmailSegment {
  return key.startsWith('tag:') ? { type: 'tag', value: key.slice(4) } : { type: 'all' };
}

export function NuevaCampana({ campaignId, onGuardada, onCancelar }: {
  campaignId: string | null;
  onGuardada: () => void;
  onCancelar: () => void;
}) {
  const { handleUnauthorized } = useAuth();
  const [campana, setCampana] = useState<Partial<EmailCampaign>>({ name: '', subject: '', html_body: '', template_id: '' });
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [cargando, setCargando] = useState(!!campaignId);
  const [error, setError] = useState<string | null>(null);
  const [correoPrueba, setCorreoPrueba] = useState('');
  const [avisoPrueba, setAvisoPrueba] = useState<string | null>(null);
  const [contactos, setContactos] = useState<EmailContact[]>([]);
  const [audiencia, setAudiencia] = useState('all');
  const [programarPara, setProgramarPara] = useState('');
  const [ocupado, setOcupado] = useState<'guardar' | 'programar' | 'enviar' | null>(null);

  useEffect(() => {
    getEmailContacts()
      .then((r) => setContactos(r.contacts))
      .catch((e: unknown) => { if (e instanceof UnauthorizedError) handleUnauthorized(); });
  }, [handleUnauthorized]);

  useEffect(() => {
    getEmailTemplates()
      .then((r) => setTemplates(r.templates))
      .catch((e: unknown) => { if (e instanceof UnauthorizedError) handleUnauthorized(); });
  }, [handleUnauthorized]);

  useEffect(() => {
    if (!campaignId) return;
    setCargando(true);
    getEmailCampaign(campaignId)
      .then((r) => {
        setCampana(r.campana);
        const seg = r.campana.segment;
        setAudiencia(seg?.type === 'tag' && seg.value ? `tag:${seg.value}` : 'all');
      })
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        setError(e instanceof Error ? e.message : 'No se pudo cargar la campaña.');
      })
      .finally(() => setCargando(false));
  }, [campaignId, handleUnauthorized]);

  async function ejecutar(accion: 'guardar' | 'programar' | 'enviar') {
    const alcance = opciones.find((o) => o.key === audiencia)?.cuantos ?? 0;

    // Confirmación explícita antes de un envío real. No es ceremonia: un
    // correo a cientos de personas no se puede deshacer, y el número de
    // destinatarios es justo lo que nadie mira antes de apretar.
    if (accion === 'enviar' && !confirm(`Se va a enviar AHORA a ${alcance} ${alcance === 1 ? 'persona' : 'personas'}.\n\nNo se puede deshacer. ¿Seguro?`)) return;
    if (accion === 'programar' && !programarPara) { setError('Elige la fecha y hora de envío.'); return; }

    setOcupado(accion);
    setError(null);
    try {
      const conSegmento = { ...campana, segment: segmentoDesde(audiencia) };

      if (accion === 'enviar') {
        await sendEmailNow(conSegmento.subject ?? '', conSegmento.html_body ?? '', segmentoDesde(audiencia), conSegmento.name);
        onGuardada();
        return;
      }

      const res = await saveEmailCampaign(conSegmento);
      if (accion === 'programar') {
        await scheduleEmailCampaign(res.campaign_id, new Date(programarPara).toISOString());
      }
      onGuardada();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setOcupado(null);
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

  const opciones = opcionesDeAudiencia(contactos);
  const alcanceActual = opciones.find((o) => o.key === audiencia)?.cuantos ?? 0;

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

        <Campo label="A quién se le envía" hint="Solo entran los que pueden recibir marketing: los suscritos confirmados.">
          <select className="crm-input" value={audiencia} onChange={(e) => setAudiencia(e.target.value)}>
            {opciones.map((o) => (
              <option key={o.key} value={o.key}>{o.label}{o.key.startsWith('tag:') ? ` — ${o.cuantos}` : ''}</option>
            ))}
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

        <Campo label="Programar para (opcional)" hint="Déjalo vacío para guardar como borrador o enviar ahora.">
          <input
            className="crm-input"
            type="datetime-local"
            value={programarPara}
            onChange={(e) => setProgramarPara(e.target.value)}
          />
        </Campo>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Boton tipo="primary" onClick={() => ejecutar('guardar')} disabled={!!ocupado}>
            {ocupado === 'guardar' ? 'Guardando…' : 'Guardar borrador'}
          </Boton>
          <Boton onClick={() => ejecutar('programar')} disabled={!!ocupado || !programarPara}>
            {ocupado === 'programar' ? 'Programando…' : 'Programar'}
          </Boton>
          <Boton tipo="danger" onClick={() => ejecutar('enviar')} disabled={!!ocupado}>
            {ocupado === 'enviar' ? 'Enviando…' : `Enviar ahora a ${alcanceActual}`}
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
