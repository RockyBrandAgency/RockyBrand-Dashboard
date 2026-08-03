import { useEffect, useState, useCallback } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { useAuth } from '../../../context/AuthContext';
import {
  getEmailCampaigns, getEmailCampaign, saveEmailCampaign, deleteEmailCampaign,
  getEmailTemplates, UnauthorizedError,
} from '../../../api/dashboardApi';
import type { EmailCampaign, EmailTemplate } from '../../../types';
import { Panel, Boton, Campo, inputStyle, Vacio, Aviso, Tabla, td, tdMuted, trStyle, formatFecha } from './shared';
import { SubjectField } from './SubjectField';

// Los estados vienen del backend en inglés porque así los escribe el motor
// de envío. Traducirlos acá y no allá es a propósito: el valor guardado es el
// que consultan las métricas y los journeys, y cambiarlo rompería el
// historial. Lo que no puede pasar es que el cliente lea "sent" en su panel.
const GLOSA_ESTADO: Record<string, string> = {
  draft: 'Borrador',
  sending: 'Enviándose',
  sent: 'Enviada',
  failed: 'Falló',
  paused: 'Pausada',
};

// Crear, ver y editar campañas. Las enviadas se listan pero no se tocan: sus
// estadísticas están atadas a ese contenido, y editarlas convertiría el
// historial en una mentira. El backend lo rechaza igual - acá simplemente no
// se ofrece el botón, para no invitar a un error que después no se puede
// deshacer.
export function CampanasEmail() {
  const { handleUnauthorized } = useAuth();
  const [campanas, setCampanas] = useState<EmailCampaign[] | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Partial<EmailCampaign> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getEmailCampaigns(), getEmailTemplates()])
      .then(([c, t]) => { setCampanas(c.campanas); setTemplates(t.templates); })
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized]);

  useEffect(cargar, [cargar]);

  const abrir = async (c: EmailCampaign) => {
    setErrorForm(null);
    try {
      const res = await getEmailCampaign(c.campaign_id);
      setEditando(res.campana);
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setErrorForm(e instanceof Error ? e.message : 'Error de red.');
    }
  };

  const guardar = async () => {
    if (!editando) return;
    setGuardando(true);
    setErrorForm(null);
    try {
      await saveEmailCampaign(editando);
      setEditando(null);
      cargar();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setErrorForm(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (c: EmailCampaign) => {
    if (!confirm(`¿Borrar el borrador "${c.name || c.subject}"? No se puede deshacer.`)) return;
    try {
      await deleteEmailCampaign(c.campaign_id);
      cargar();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo borrar.');
    }
  };

  if (editando) {
    const esNueva = !editando.campaign_id;
    return (
      <Panel title={esNueva ? 'Nueva campaña' : `Editar: ${editando.name || 'sin nombre'}`}>
        {errorForm && <Aviso tono="critico">{errorForm}</Aviso>}

        <Campo label="Nombre interno" hint="Solo lo ves tú, no aparece en el correo.">
          <input style={inputStyle} value={editando.name ?? ''} onChange={(e) => setEditando({ ...editando, name: e.target.value })} />
        </Campo>

        <SubjectField value={editando.subject ?? ''} onChange={(v) => setEditando({ ...editando, subject: v })} />

        <Campo label="Plantilla" hint={templates.length === 0 ? 'Todavía no hay plantillas guardadas. Puedes escribir el contenido directamente abajo.' : undefined}>
          <select style={inputStyle} value={editando.template_id ?? ''} onChange={(e) => setEditando({ ...editando, template_id: e.target.value })}>
            <option value="">— Sin plantilla, contenido propio —</option>
            {templates.map((t) => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
          </select>
        </Campo>

        <Campo label="Contenido (HTML)" hint="Si eliges una plantilla, esto queda de respaldo. El enlace de baja se agrega automáticamente al enviar.">
          <textarea
            style={{ ...inputStyle, minHeight: 180, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
            value={editando.html_body ?? ''}
            onChange={(e) => setEditando({ ...editando, html_body: e.target.value })}
          />
        </Campo>

        <div style={{ display: 'flex', gap: 10 }}>
          <Boton tipo="primario" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar borrador'}</Boton>
          <Boton onClick={() => { setEditando(null); setErrorForm(null); }}>Cancelar</Boton>
        </div>
      </Panel>
    );
  }

  const borradores = (campanas ?? []).filter((c) => c.status === 'draft');
  const enviadas = (campanas ?? []).filter((c) => c.status !== 'draft');

  return (
    <AsyncState loading={loading} error={error} onRetry={cargar}>
      <Panel
        title={`Borradores (${borradores.length})`}
        right={<Boton tipo="primario" onClick={() => setEditando({ name: '', subject: '', html_body: '', template_id: '' })}>Nueva campaña</Boton>}
        pad={false}
      >
        {borradores.length === 0 ? (
          <Vacio>Sin borradores. Crea una campaña para empezar.</Vacio>
        ) : (
          <Tabla cols={[{ label: 'Campaña' }, { label: 'Modificada' }, { label: '', alinear: 'right' }]}>
            {borradores.map((c) => (
              <tr key={c.campaign_id} style={trStyle}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{c.name || 'Sin nombre'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.subject}</div>
                </td>
                <td style={tdMuted}>{formatFecha(c.updated_at)}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', gap: 8 }}>
                    <Boton onClick={() => abrir(c)}>Editar</Boton>
                    <Boton tipo="peligro" onClick={() => borrar(c)}>Borrar</Boton>
                  </span>
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>

      <Panel title={`Enviadas (${enviadas.length})`} pad={false}>
        {enviadas.length === 0 ? (
          <Vacio>Todavía no se ha enviado ninguna campaña.</Vacio>
        ) : (
          <>
            <div style={{ padding: '12px 16px 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
              Una campaña enviada no se edita ni se borra: sus métricas están atadas a este contenido.
            </div>
            <Tabla cols={[{ label: 'Campaña' }, { label: 'Enviada' }, { label: 'Estado', alinear: 'right' }]}>
              {enviadas.map((c) => (
                <tr key={c.campaign_id} style={trStyle}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{c.name || 'Sin nombre'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.subject}</div>
                  </td>
                  <td style={tdMuted}>{formatFecha(c.sent_at)}</td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--text-muted)' }}>{GLOSA_ESTADO[c.status] ?? c.status}</td>
                </tr>
              ))}
            </Tabla>
          </>
        )}
      </Panel>
    </AsyncState>
  );
}
