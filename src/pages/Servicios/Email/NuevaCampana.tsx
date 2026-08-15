import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  getEmailCampaign, saveEmailCampaign, getEmailTemplates, getEmailTemplate, sendTestEmail,
  sendEmailNow, scheduleEmailCampaign, getEmailContacts, UnauthorizedError,
} from '../../../api/dashboardApi';
import type { EmailCampaign, EmailTemplate, EmailContact, EmailSegment } from '../../../types';
import { htmlDeLaPlantilla } from '../../../lib/plantillaCampos';
import { Card, Boton, Campo, Aviso } from './shared';
import { SubjectField } from './SubjectField';
import { ChevronDownIcon, SearchIcon } from '../../../components/icons/RockyIcons';

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
//
// La "Vista Previa del Email" del diseño de Figma muestra una maqueta
// decorativa (imagen de portada, botón de reserva) que es contenido de
// ejemplo del mockup, no algo que el backend genere. Acá la vista previa
// renderiza el `html_body` REAL de la campaña en un iframe aislado (mismo
// patrón que Templates.tsx) — lo que se ve es lo que de verdad se va a
// mandar, no una maqueta.
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

function SelectConChevron({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        className="crm-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ appearance: 'none', paddingRight: 36 }}
      >
        {children}
      </select>
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-faint)' }}>
        <ChevronDownIcon size={12} />
      </div>
    </div>
  );
}

export function NuevaCampana({ campaignId, plantillaInicial, onGuardada, onCancelar }: {
  campaignId: string | null;
  /** Plantilla con la que se llega desde la galería ("Enviar"). */
  plantillaInicial?: string | null;
  onGuardada: () => void;
  onCancelar: () => void;
}) {
  const { handleUnauthorized, clientDisplayName, userEmail } = useAuth();
  const [campana, setCampana] = useState<Partial<EmailCampaign>>({ name: '', subject: '', html_body: '', template_id: '' });
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [cargando, setCargando] = useState(!!campaignId);
  const [error, setError] = useState<string | null>(null);
  const [correoPrueba, setCorreoPrueba] = useState('');
  const [avisoPrueba, setAvisoPrueba] = useState<string | null>(null);
  const [contactos, setContactos] = useState<EmailContact[]>([]);
  const [audiencia, setAudiencia] = useState('all');
  const [cargandoPlantilla, setCargandoPlantilla] = useState(false);
  const [modoEnvio, setModoEnvio] = useState<'ahora' | 'programar'>('programar');
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [horaProgramada, setHoraProgramada] = useState('');
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

  // Elegir una plantilla trae SU CONTENIDO. Antes el select solo guardaba el
  // template_id y dejaba el textarea vacío: la campaña salía con el id de la
  // plantilla anotado y el cuerpo en blanco, o con lo que hubiera escrito
  // antes. El HTML que de verdad se manda es este `html_body`, no la plantilla
  // — send-email-campaign no lee la tabla de plantillas.
  const aplicarPlantilla = async (templateId: string) => {
    if (!templateId) { setCampana((c) => ({ ...c, template_id: '' })); return; }
    setError(null);
    setCargandoPlantilla(true);
    try {
      const { template } = await getEmailTemplate(templateId);
      setCampana((c) => ({
        ...c,
        template_id: templateId,
        html_body: htmlDeLaPlantilla(template),
        // El asunto de la plantilla es una sugerencia: no pisa lo que ya
        // haya escrito para esta campaña.
        subject: c.subject?.trim() ? c.subject : (template.subject ?? ''),
        name: c.name?.trim() ? c.name : template.name,
      }));
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo cargar la plantilla.');
    } finally {
      setCargandoPlantilla(false);
    }
  };

  // Llegada desde la galería de plantillas con el botón "Enviar".
  const plantillaAplicada = useRef<string | null>(null);
  useEffect(() => {
    if (campaignId || !plantillaInicial) return;
    if (plantillaAplicada.current === plantillaInicial) return;
    plantillaAplicada.current = plantillaInicial;
    void aplicarPlantilla(plantillaInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantillaInicial, campaignId]);

  const programarPara = fechaProgramada && horaProgramada ? `${fechaProgramada}T${horaProgramada}` : '';
  const sinEnlaceDeBaja = !!campana.html_body?.trim()
    && !campana.html_body.includes('{{unsubscribe_link}}')
    && !campana.html_body.includes('{{link_baja}}');

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

  const accionPrimaria = modoEnvio === 'ahora' ? 'enviar' : 'programar';
  const ocupadoPrimaria = ocupado === accionPrimaria;

  return (
    <>
      <Card>
        {error && <Aviso tono="critico">{error}</Aviso>}

        <Campo label="Nombre Interno de la Campaña" hint={`Solo visible para administradores de ${clientDisplayName ?? 'tu cuenta'}.`}>
          <input className="crm-input" value={campana.name ?? ''} onChange={(e) => setCampana({ ...campana, name: e.target.value })} />
        </Campo>

        <SubjectField value={campana.subject ?? ''} onChange={(v) => setCampana({ ...campana, subject: v })} />

        <Campo
          label="Plantilla"
          hint={templates.length === 0
            ? 'Todavía no hay plantillas guardadas. Puedes escribir el contenido directamente abajo.'
            : cargandoPlantilla ? 'Cargando el contenido de la plantilla…' : 'Al elegirla se copia su contenido acá abajo. Editarlo no toca la plantilla.'}
        >
          <SelectConChevron value={campana.template_id ?? ''} onChange={(v) => { void aplicarPlantilla(v); }}>
            <option value="">— Sin plantilla, contenido propio —</option>
            {templates.map((t) => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
          </SelectConChevron>
        </Campo>

        <Campo label="Segmento / Audiencia Destinataria" hint="Solo entran los que pueden recibir marketing: los suscritos confirmados.">
          <SelectConChevron value={audiencia} onChange={setAudiencia}>
            {opciones.map((o) => (
              <option key={o.key} value={o.key}>{o.label}{o.key.startsWith('tag:') ? ` — ${o.cuantos}` : ''}</option>
            ))}
          </SelectConChevron>
        </Campo>

        {/* El motor NO agrega un enlace de baja: reemplaza el marcador
            {{unsubscribe_link}} por el link firmado de cada contacto. Si el
            marcador no está, el correo sale sin baja — y sin los encabezados
            List-Unsubscribe que Gmail y Yahoo exigen a quien manda en volumen.
            El aviso va acá, que es cuando todavía se puede arreglar. */}
        {sinEnlaceDeBaja && (
          <Aviso tono="alerta">
            El contenido no tiene el marcador <code>{'{{unsubscribe_link}}'}</code>. El sistema no lo agrega
            solo: si se envía así, el correo sale sin enlace de baja y sin los encabezados de
            desuscripción de un clic.
          </Aviso>
        )}

        <Campo label="Contenido (HTML)" hint="Donde va {{unsubscribe_link}} se pone el enlace de baja firmado de cada destinatario.">
          <textarea
            className="crm-input mono"
            style={{ minHeight: 200 }}
            value={campana.html_body ?? ''}
            onChange={(e) => setCampana({ ...campana, html_body: e.target.value })}
          />
        </Campo>

        <div className="crm-field-label">Programación del Envío</div>
        <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
          {(['ahora', 'programar'] as const).map((modo) => (
            <button
              key={modo}
              type="button"
              onClick={() => setModoEnvio(modo)}
              style={{
                all: 'unset',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${modoEnvio === modo ? 'var(--primary)' : 'var(--border)'}`,
                background: 'var(--white)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: modoEnvio === modo ? 600 : 500,
                color: modoEnvio === modo ? 'var(--primary)' : 'var(--text-sub)',
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: `1.5px solid ${modoEnvio === modo ? 'var(--primary)' : 'var(--text-faint)'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {modoEnvio === modo && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />}
              </span>
              {modo === 'ahora' ? 'Enviar Ahora' : 'Programar Fecha y Hora'}
            </button>
          ))}
        </div>
        {modoEnvio === 'programar' && (
          <div style={{ display: 'flex', gap: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
            <input className="crm-input" type="date" value={fechaProgramada} onChange={(e) => setFechaProgramada(e.target.value)} style={{ flex: 1 }} />
            <input className="crm-input" type="time" value={horaProgramada} onChange={(e) => setHoraProgramada(e.target.value)} style={{ flex: 1 }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 'var(--space-4)' }}>
          <Boton tipo="primary" onClick={() => ejecutar(accionPrimaria)} disabled={!!ocupado || (modoEnvio === 'programar' && !programarPara)}>
            {ocupadoPrimaria
              ? (modoEnvio === 'ahora' ? 'Enviando…' : 'Programando…')
              : (modoEnvio === 'ahora' ? `Enviar Ahora a ${alcanceActual}` : 'Programar Envío')}
          </Boton>
          <Boton onClick={() => ejecutar('guardar')} disabled={!!ocupado}>
            {ocupado === 'guardar' ? 'Guardando…' : 'Guardar Borrador'}
          </Boton>
          <Boton onClick={onCancelar} disabled={!!ocupado}>Cancelar</Boton>
        </div>
      </Card>

      <Card title="Vista Previa del Email" right={<span className="crm-tag">Móvil y Desktop</span>}>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-6)', fontSize: 12, color: 'var(--text-sub)', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 'var(--space-6)' }}>
          <div><strong style={{ color: 'var(--text)' }}>De:</strong> {clientDisplayName ?? 'RockyBrand Client'}</div>
          <div><strong style={{ color: 'var(--text)' }}>Para:</strong> {userEmail} (prueba)</div>
          <div><strong style={{ color: 'var(--text)' }}>Asunto:</strong> {campana.subject || '(sin asunto)'}</div>
        </div>
        <iframe
          title="Vista previa de la campaña"
          sandbox=""
          srcDoc={campana.html_body || '<p style="font-family:sans-serif;color:#a1a1aa;text-align:center;padding:40px">Escribe el contenido arriba para ver la vista previa.</p>'}
          style={{ width: '100%', height: 460, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--white)' }}
        />
      </Card>

      <Card title="Envío de prueba">
        <Aviso tono="info">
          Mándatelo a ti primero. Es el único momento en que ves cómo se lee de verdad — los enlaces, las imágenes y el
          corte del asunto en el teléfono — antes de que salga a toda tu lista.
        </Aviso>
        <div className="crm-toolbar">
          <div className="crm-search-wrap">
            <SearchIcon size={14} color="var(--text-sub)" />
            <input
              className="crm-search"
              placeholder="tu@correo.com"
              aria-label="Correo para el envío de prueba"
              value={correoPrueba}
              onChange={(e) => setCorreoPrueba(e.target.value)}
            />
          </div>
          <Boton onClick={enviarPrueba}>Enviar prueba</Boton>
        </div>
        {avisoPrueba && <Aviso tono={avisoPrueba.startsWith('Enviado') ? 'ok' : 'alerta'}>{avisoPrueba}</Aviso>}
      </Card>
    </>
  );
}
