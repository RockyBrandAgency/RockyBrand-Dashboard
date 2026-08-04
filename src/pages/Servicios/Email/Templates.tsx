import { useEffect, useState, useCallback } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { useAuth } from '../../../context/AuthContext';
import { getEmailTemplates, getEmailTemplate, saveEmailTemplate, deleteEmailTemplate, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailTemplate } from '../../../types';
import { Card, Boton, Campo, Vacio, Aviso, formatFecha } from './shared';

// Ver, editar, borrar, agregar y previsualizar plantillas.
//
// La vista previa va en un <iframe> con sandbox y srcDoc, no con
// dangerouslySetInnerHTML: el HTML de una plantilla puede traer scripts o
// estilos que se escapen y rompan el panel entero. El iframe lo encierra.
//
// Pendiente, documentado en la auditoría pixel-por-pixel 2026-08-04: el
// Figma real (frame 16) muestra un panel de previsualización de 360px
// PERSISTENTE al costado (se actualiza en vivo mientras se edita), y 3
// acciones por tarjeta de plantilla en vez de las 2 actuales. Ambos son
// una reestructuración real de layout, no un ajuste de token/valor -
// intentarlo apurado en la misma sesión que el resto de esta auditoría
// arriesgaba un layout a medio terminar. Queda para una sesión propia.
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
      <Card
        title={editando.template_id ? `Editar: ${editando.name}` : 'Nueva plantilla'}
        right={
          <span className="crm-row-actions">
            <Boton tipo={vista === 'editor' ? 'primary' : 'ghost'} onClick={() => setVista('editor')}>Editor</Boton>
            <Boton tipo={vista === 'previa' ? 'primary' : 'ghost'} onClick={() => setVista('previa')}>Vista previa</Boton>
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
          <input className="crm-input" value={editando.name ?? ''} onChange={(e) => setEditando({ ...editando, name: e.target.value })} />
        </Campo>

        {vista === 'editor' ? (
          <Campo label="HTML" hint="Marcadores disponibles: {{name}} · {{unsubscribe_link}}">
            <textarea
              className="crm-input mono" style={{ minHeight: 320 }}
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
              style={{ width: '100%', height: 460, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--white)' }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Los marcadores se muestran con valores de ejemplo. Cada cliente de correo renderiza distinto: esto es una referencia, no un espejo exacto.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Boton tipo="primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
          <Boton onClick={() => { setEditando(null); setErrorForm(null); }}>Cancelar</Boton>
        </div>
      </Card>
    );
  }

  return (
    <AsyncState loading={loading} error={error} onRetry={cargar}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-sub)' }}>
          Galería de Plantillas Personalizadas {templates?.length ? `(${templates.length})` : ''}
        </div>
        <Boton tipo="primary" onClick={() => { setVista('editor'); setEditando({ name: '', html_body: '' }); }}>
          + Nuevo template
        </Boton>
      </div>

      {!templates || templates.length === 0 ? (
        <Vacio>Sin plantillas todavía.</Vacio>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-6)' }}>
          {templates.map((t) => (
            <div key={t.template_id} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
              {/* Sin thumbnail falso: el backend guarda HTML, no una imagen
                  renderizada de la plantilla - una barra con la inicial es
                  honesta, un mockup de imagen no lo sería. */}
              <div style={{ height: 80, background: 'color-mix(in srgb, var(--primary) 10%, var(--surface-2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>{(t.name || '?').charAt(0).toUpperCase()}</span>
              </div>
              <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                    Modificada {formatFecha(t.updated_at)} · Baja:{' '}
                    <span style={{ color: t.tiene_unsubscribe ? 'var(--status-bien-dot)' : 'var(--status-critico-dot)', fontWeight: 600 }}>
                      {t.tiene_unsubscribe ? 'Sí' : 'Falta'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="crm-btn crm-btn-sm" onClick={() => abrir(t)} style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)', color: 'var(--primary)' }}>
                    Abrir
                  </button>
                  <button type="button" className="crm-btn crm-btn-sm" onClick={() => borrar(t)} style={{ background: 'var(--status-critico-bg)', color: 'var(--status-critico-dot)' }}>
                    Borrar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AsyncState>
  );
}
