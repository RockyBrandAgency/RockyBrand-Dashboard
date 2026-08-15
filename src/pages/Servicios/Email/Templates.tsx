import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { useAuth } from '../../../context/AuthContext';
import { getEmailTemplates, getEmailTemplate, saveEmailTemplate, deleteEmailTemplate, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailTemplate, EmailTemplateCampo } from '../../../types';
import { htmlDeLaPlantilla, paraVistaPrevia, porGrupo } from '../../../lib/plantillaCampos';
import { Card, Boton, Campo, Vacio, Aviso, formatFecha } from './shared';

// Ver, editar, borrar, agregar y previsualizar plantillas.
//
// La vista previa va en un <iframe> con sandbox y srcDoc, no con
// dangerouslySetInnerHTML: el HTML de una plantilla puede traer scripts o
// estilos que se escapen y rompan el panel entero. El iframe lo encierra.
//
// --- Dos formas de editar, y por qué ---
// Una plantilla de campaña son 30 KB de tablas anidadas y VML para Outlook.
// El texto que de verdad se cambia son 25 líneas. Por eso una plantilla puede
// traer `campos`: la lista de textos editables, cada uno con su etiqueta, y un
// `html_source` con {{clave}} donde va cada uno (ver 04-codigo/plantilla_campos.py).
//
//   con campos  → pestaña "Contenido": un formulario. Es lo normal.
//   sin campos  → pestaña "HTML": el textarea de siempre. Las plantillas
//                 viejas y las que se crean a mano siguen funcionando igual.
//
// El HTML que se GUARDA lo arma el backend a partir del molde y los campos.
// Acá se renderiza solo para la vista previa (`lib/plantillaCampos.ts`).
//
// La vista previa es un panel PERSISTENTE al costado y se actualiza mientras
// se escribe — era el pendiente de la auditoría pixel-por-pixel del 2026-08-04.
// Va con 400 ms de espera: redibujar 30 KB y 10 imágenes remotas en cada tecla
// hace parpadear el panel entero.
export function TemplatesEmail({ isDesktop = true, onUsarEnCampana }: {
  isDesktop?: boolean;
  onUsarEnCampana?: (templateId: string) => void;
}) {
  const { handleUnauthorized } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Partial<EmailTemplate> | null>(null);
  const [vista, setVista] = useState<'contenido' | 'html'>('contenido');
  const [ancho, setAncho] = useState<'escritorio' | 'movil'>('escritorio');
  const [guardando, setGuardando] = useState(false);
  const [abriendo, setAbriendo] = useState<string | null>(null);
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
    setAbriendo(t.template_id);
    try {
      const res = await getEmailTemplate(t.template_id);
      setVista(res.template.campos?.length ? 'contenido' : 'html');
      setEditando(res.template);
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setErrorForm(e instanceof Error ? e.message : 'Error de red.');
    } finally {
      setAbriendo(null);
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

  const cambiarCampo = (clave: string, valor: string) => {
    setEditando((prev) => {
      if (!prev?.campos) return prev;
      return { ...prev, campos: prev.campos.map((c) => (c.clave === clave ? { ...c, valor } : c)) };
    });
  };

  if (editando) {
    const tieneCampos = !!editando.campos?.length;
    const html = htmlDeLaPlantilla(editando);
    const tieneBaja = html.includes('{{unsubscribe_link}}') || html.includes('{{link_baja}}');
    const pesoKb = new Blob([html]).size / 1024;

    const formulario = (
      <>
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

        <Campo label="Nombre de la plantilla" hint="Solo se ve acá adentro. No sale en el correo.">
          <input className="crm-input" value={editando.name ?? ''} onChange={(e) => setEditando({ ...editando, name: e.target.value })} />
        </Campo>

        <Campo label="Asunto sugerido" hint="El punto de partida. Al crear la campaña se puede cambiar sin tocar la plantilla.">
          <input className="crm-input" value={editando.subject ?? ''} onChange={(e) => setEditando({ ...editando, subject: e.target.value })} />
        </Campo>

        {tieneCampos && (
          <div className="crm-row-actions" style={{ marginBottom: 'var(--space-5)' }}>
            <Boton tipo={vista === 'contenido' ? 'primary' : 'ghost'} sm onClick={() => setVista('contenido')}>Contenido</Boton>
            <Boton tipo={vista === 'html' ? 'primary' : 'ghost'} sm onClick={() => setVista('html')}>HTML avanzado</Boton>
          </div>
        )}

        {tieneCampos && vista === 'contenido' ? (
          <CamposEditor campos={editando.campos as EmailTemplateCampo[]} onCambio={cambiarCampo} />
        ) : (
          <Campo
            label={tieneCampos ? 'Molde HTML' : 'HTML'}
            hint={tieneCampos
              ? 'Es el molde: los {{marcadores}} se rellenan con los textos de la pestaña Contenido. Tocarlo puede romper el correo.'
              : 'Marcadores disponibles: {{name}} · {{unsubscribe_link}}'}
          >
            <textarea
              className="crm-input mono" style={{ minHeight: 320 }}
              value={(tieneCampos ? editando.html_source : editando.html_body) ?? ''}
              onChange={(e) => setEditando(tieneCampos
                ? { ...editando, html_source: e.target.value }
                : { ...editando, html_body: e.target.value })}
            />
          </Campo>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Boton tipo="primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
          <Boton onClick={() => { setEditando(null); setErrorForm(null); }}>Cancelar</Boton>
          {onUsarEnCampana && editando.template_id && (
            <Boton onClick={() => onUsarEnCampana(editando.template_id as string)}>Usar en una campaña</Boton>
          )}
        </div>
      </>
    );

    const previa = (
      <VistaPrevia html={html} ancho={ancho} onAncho={setAncho} isDesktop={isDesktop} />
    );

    return (
      <Card title={editando.template_id ? `Editar: ${editando.name}` : 'Nueva plantilla'}>
        {isDesktop ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: 'var(--space-6)', alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>{formulario}</div>
            <div style={{ position: 'sticky', top: 12 }}>{previa}</div>
          </div>
        ) : (
          <>
            {previa}
            {formulario}
          </>
        )}
      </Card>
    );
  }

  return (
    <AsyncState loading={loading} error={error} onRetry={cargar}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-sub)' }}>
          Galería de Plantillas Personalizadas {templates?.length ? `(${templates.length})` : ''}
        </div>
        <Boton tipo="primary" onClick={() => { setVista('html'); setEditando({ name: '', html_body: '' }); }}>
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
                  {!!t.campos_editables && (
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                      {t.campos_editables} textos editables sin tocar el HTML
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="crm-btn crm-btn-sm" disabled={abriendo === t.template_id} onClick={() => abrir(t)} style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)', color: 'var(--primary)' }}>
                    {abriendo === t.template_id ? 'Abriendo…' : 'Abrir'}
                  </button>
                  {onUsarEnCampana && (
                    <button type="button" className="crm-btn crm-btn-sm" onClick={() => onUsarEnCampana(t.template_id)}>
                      Enviar
                    </button>
                  )}
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

function CamposEditor({ campos, onCambio }: {
  campos: EmailTemplateCampo[];
  onCambio: (clave: string, valor: string) => void;
}) {
  const grupos = useMemo(() => porGrupo(campos), [campos]);
  return (
    <div>
      {grupos.map((g, i) => (
        <div key={`${g.grupo}-${i}`} style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 'var(--space-4)' }}>
            {g.grupo}
          </div>
          {g.campos.map((c) => (
            <Campo key={c.clave} label={c.etiqueta} hint={c.ayuda}>
              {c.tipo === 'texto_largo' ? (
                <textarea className="crm-input" style={{ minHeight: 96 }} value={c.valor}
                  onChange={(e) => onCambio(c.clave, e.target.value)} />
              ) : (
                <input className="crm-input" value={c.valor}
                  onChange={(e) => onCambio(c.clave, e.target.value)} />
              )}
            </Campo>
          ))}
        </div>
      ))}
    </div>
  );
}

function VistaPrevia({ html, ancho, onAncho, isDesktop }: {
  html: string;
  ancho: 'escritorio' | 'movil';
  onAncho: (a: 'escritorio' | 'movil') => void;
  isDesktop: boolean;
}) {
  // 400 ms de espera: sin esto el iframe se rearma en cada tecla y vuelve a
  // pedir las 10 imágenes remotas, así que el panel parpadea mientras se
  // escribe.
  const [diferido, setDiferido] = useState(html);
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; setDiferido(html); return; }
    const t = setTimeout(() => setDiferido(html), 400);
    return () => clearTimeout(t);
  }, [html]);

  const anchoIframe = ancho === 'movil' ? 375 : '100%';

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>Vista previa</div>
        <span className="crm-row-actions">
          <Boton tipo={ancho === 'escritorio' ? 'primary' : 'ghost'} sm onClick={() => onAncho('escritorio')}>Escritorio</Boton>
          <Boton tipo={ancho === 'movil' ? 'primary' : 'ghost'} sm onClick={() => onAncho('movil')}>Móvil</Boton>
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: ancho === 'movil' ? 12 : 0 }}>
        <iframe
          title="Vista previa de la plantilla"
          sandbox=""
          srcDoc={paraVistaPrevia(diferido)}
          style={{ width: anchoIframe, height: isDesktop ? 620 : 420, border: 0, borderRadius: 'var(--radius-md)', background: 'var(--white)' }}
        />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        Los marcadores se muestran con valores de ejemplo y el enlace de baja va a “#”: el real se firma
        para cada contacto en el momento del envío. Cada cliente de correo renderiza distinto: esto es una
        referencia, no un espejo exacto.
      </div>
    </div>
  );
}
