import { useEffect, useState, useCallback } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { useAuth } from '../../../context/AuthContext';
import { getEmailTemplates, getEmailTemplate, saveEmailTemplate, deleteEmailTemplate, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailTemplate } from '../../../types';
import { Panel, Boton, Campo, inputStyle, Vacio, Aviso, Tabla, td, tdMuted, trStyle, formatFecha } from './shared';

// Ver, editar, borrar, agregar y previsualizar plantillas.
//
// La vista previa va en un <iframe> con sandbox y srcDoc, no con
// dangerouslySetInnerHTML: el HTML de una plantilla puede traer scripts o
// estilos que se escapen y rompan el panel entero. El iframe lo encierra.
export function TemplatesEmail() {
  const { handleUnauthorized } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Partial<EmailTemplate> | null>(null);
  const [vista, setVista] = useState<'editor' | 'previa'>('editor');
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    getEmailTemplates()
      .then((r) => setTemplates(r.templates))
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized]);

  useEffect(cargar, [cargar]);

  const abrir = async (t: EmailTemplate) => {
    setErrorForm(null);
    setVista('editor');
    try {
      const res = await getEmailTemplate(t.template_id);
      setEditando(res.template);
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
      await saveEmailTemplate(editando);
      setEditando(null);
      cargar();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setErrorForm(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (t: EmailTemplate) => {
    if (!confirm(`¿Borrar la plantilla "${t.name}"? No se puede deshacer.`)) return;
    try {
      await deleteEmailTemplate(t.template_id);
      cargar();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo borrar.');
    }
  };

  if (editando) {
    const html = editando.html_body ?? '';
    const tieneBaja = html.includes('{{unsubscribe_link}}') || html.includes('{{link_baja}}');
    const pesoKb = new Blob([html]).size / 1024;

    return (
      <Panel
        title={editando.template_id ? `Editar: ${editando.name}` : 'Nueva plantilla'}
        right={
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <Boton tipo={vista === 'editor' ? 'primario' : 'normal'} onClick={() => setVista('editor')}>Editor</Boton>
            <Boton tipo={vista === 'previa' ? 'primario' : 'normal'} onClick={() => setVista('previa')}>Vista previa</Boton>
          </span>
        }
      >
        {errorForm && <Aviso tono="critico">{errorForm}</Aviso>}

        {/* El enlace de baja es obligatorio por ley en la mayoría de los
            mercados y es lo primero que mira un filtro de spam. Se avisa acá,
            no al enviar, que es cuando ya no se puede corregir. */}
        {!tieneBaja && html.length > 0 && (
          <Aviso tono="alerta">
            Esta plantilla no tiene el enlace de baja (<code>{'{{unsubscribe_link}}'}</code>). Es obligatorio en
            los correos de marketing y su ausencia dispara los filtros de spam.
          </Aviso>
        )}
        {pesoKb > 100 && (
          <Aviso tono="critico">Pesa {pesoKb.toFixed(0)} KB. Gmail recorta sobre ~102 KB y el enlace de baja suele quedar fuera del corte.</Aviso>
        )}

        <Campo label="Nombre">
          <input style={inputStyle} value={editando.name ?? ''} onChange={(e) => setEditando({ ...editando, name: e.target.value })} />
        </Campo>

        {vista === 'editor' ? (
          <Campo label="HTML" hint="Marcadores disponibles: {{name}} · {{unsubscribe_link}}">
            <textarea
              style={{ ...inputStyle, minHeight: 320, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
              value={html}
              onChange={(e) => setEditando({ ...editando, html_body: e.target.value })}
            />
          </Campo>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Vista previa</div>
            <iframe
              title="Vista previa de la plantilla"
              sandbox=""
              srcDoc={html.replace(/\{\{name\}\}/g, 'Nombre de ejemplo').replace(/\{\{unsubscribe_link\}\}/g, '#')}
              style={{ width: '100%', height: 460, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Los marcadores se muestran con valores de ejemplo. Cada cliente de correo renderiza distinto: esto es una referencia, no un espejo exacto.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Boton tipo="primario" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
          <Boton onClick={() => { setEditando(null); setErrorForm(null); }}>Cancelar</Boton>
        </div>
      </Panel>
    );
  }

  return (
    <AsyncState loading={loading} error={error} onRetry={cargar}>
      <Panel
        title={`Plantillas (${templates?.length ?? 0})`}
        right={<Boton tipo="primario" onClick={() => { setVista('editor'); setEditando({ name: '', html_body: '' }); }}>Nueva plantilla</Boton>}
        pad={false}
      >
        {!templates || templates.length === 0 ? (
          <Vacio>Sin plantillas todavía.</Vacio>
        ) : (
          <Tabla cols={[{ label: 'Plantilla' }, { label: 'Modificada' }, { label: 'Enlace de baja' }, { label: '', alinear: 'right' }]}>
            {templates.map((t) => (
              <tr key={t.template_id} style={trStyle}>
                <td style={{ ...td, fontWeight: 600 }}>{t.name}</td>
                <td style={tdMuted}>{formatFecha(t.updated_at)}</td>
                <td style={td}>
                  <span style={{ color: t.tiene_unsubscribe ? '#216b35' : '#b42318', fontWeight: 600, fontSize: 12 }}>
                    {t.tiene_unsubscribe ? 'Sí' : 'Falta'}
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', gap: 8 }}>
                    <Boton onClick={() => abrir(t)}>Abrir</Boton>
                    <Boton tipo="peligro" onClick={() => borrar(t)}>Borrar</Boton>
                  </span>
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>
    </AsyncState>
  );
}
