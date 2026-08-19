import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getEmailCampaignDetalle, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailCampaignDetalle, EmailSegment } from '../../../types';
import { Card, Boton, MiniDash, Vacio, Pill, Tabla, formatTasa, formatFecha, formatFechaHora, estadoCampana } from './shared';

// A quién se le mandó, en palabras. El campo crudo dice {"type":"tag",
// "value":"spring-2026-lote-1"}, que no le dice nada a quien lee el panel.
function describirBase(seg: EmailSegment | undefined): string {
  if (!seg || seg.type === 'all') return 'Toda la base suscrita';
  if (seg.type === 'tag' && seg.value) return `Contactos con la etiqueta "${seg.value}"`;
  return '—';
}

function Fila({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ minWidth: 150, fontSize: 13, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-word' }}>{children}</div>
    </div>
  );
}

// Detalle de una campaña enviada, igual que en el panel principal.
//
// Dos cosas del panel principal que se conservan tal cual porque son
// criterio, no diseño:
//
//  - El CLIC es la métrica principal, no la apertura. Apple Mail carga las
//    imágenes de todos los correos por privacidad, así que marca aperturas
//    que nadie hizo. Un clic, en cambio, lo hace una persona.
//  - Se listan los destinatarios uno por uno. Una tasa promedio esconde
//    quién no recibió; esta tabla lo muestra.
export function CampanaDetalle({ campaignId, onVolver }: { campaignId: string; onVolver: () => void }) {
  const { handleUnauthorized } = useAuth();
  const [datos, setDatos] = useState<EmailCampaignDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verCorreo, setVerCorreo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    getEmailCampaignDetalle(campaignId)
      .then((d) => { if (!cancelado) setDatos(d); })
      .catch((e: unknown) => {
        if (cancelado) return;
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        setError(e instanceof Error ? e.message : 'No se pudo cargar la campaña.');
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [campaignId, handleUnauthorized]);

  if (cargando) return <Card><Vacio>Cargando…</Vacio></Card>;
  if (error || !datos) return <Card><Vacio>{error || 'Campaña no encontrada.'}</Vacio></Card>;

  const c = datos.campana;
  const s = c.stats ?? {};
  const enviados = Number(s.enviados ?? 0);
  // Sin denominador no se calcula: "—", nunca 0%.
  const tasa = (n: unknown) => (enviados ? formatTasa((Number(n ?? 0) / enviados) * 100) : '—');

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Boton onClick={onVolver}>← Volver a campañas</Boton>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div className="crm-desc-label">Campaña</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--text)' }}>
          {c.name || 'Sin nombre'}
        </h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{c.subject}</span>
          <Pill estado={c.status}>{estadoCampana(c.status)}</Pill>
          {c.sent_at && <span>· {formatFecha(c.sent_at)}</span>}
        </div>
      </div>

      <MiniDash
        items={[
          { label: 'Clics (métrica principal)', value: tasa(s.clics), sub: `${Number(s.clics ?? 0)} de ${enviados} enviados` },
          { label: 'Aperturas', value: tasa(s.aperturas), sub: 'Referencial — Apple Mail infla este número automáticamente' },
          { label: 'Enviados', value: enviados.toLocaleString('es-CL') },
          { label: 'Rebotes', value: tasa(s.rebotes), sub: `${Number(s.rebotes ?? 0)} de ${enviados} enviados` },
        ]}
      />

      {c.detenida_motivo && (
        <Card title="Esta campaña se detuvo sola">
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            El motor de envío la frenó el {formatFechaHora(c.detenida_at)} porque {c.detenida_motivo}.
            Los destinatarios que quedaban sin enviar no recibieron el correo. Frenar a tiempo protege
            la reputación del dominio: por encima del 5% de rebotes AWS pone la cuenta en revisión.
          </div>
        </Card>
      )}

      <Card title="Detalle del envío">
        <Fila label="Asunto">{c.subject || '—'}</Fila>
        <Fila label={c.sent_at ? 'Enviada el' : 'Programada para'}>
          {formatFechaHora(c.sent_at || c.scheduled_at)}
        </Fila>
        <Fila label="Base">{describirBase(c.segment)}</Fila>
        <Fila label="Creada el">{formatFechaHora(c.created_at)}</Fila>
      </Card>

      <Card
        title={`Destinatarios (${datos.destinatarios.length})`}
        pad={false}
        right={<Boton sm onClick={() => setVerCorreo((v) => !v)}>{verCorreo ? 'Ocultar el correo' : 'Ver el correo enviado'}</Boton>}
      >
        {verCorreo && c.html_body && (
          // sandbox="" sin permisos: es HTML que se compuso en otra pantalla y
          // acá solo se mira. Sin scripts, sin formularios, sin navegación.
          <iframe
            title="Vista previa del correo enviado"
            srcDoc={c.html_body}
            sandbox=""
            style={{ width: '100%', height: 480, border: 0, borderBottom: '1px solid var(--border)', background: '#fff' }}
          />
        )}
        {datos.destinatarios.length === 0 ? (
          <Vacio>
            {c.status === 'sent'
              ? 'Sin datos de destinatarios todavía — los eventos de envío pueden tardar unos minutos en llegar.'
              : 'Esta campaña todavía no se ha enviado.'}
          </Vacio>
        ) : (
          <Tabla cols={[{ label: 'Contacto' }, { label: 'Enviado' }, { label: 'Apertura' }, { label: 'Clic' }, { label: 'Enlaces' }, { label: 'Resultado' }]}>
            {datos.destinatarios
              .slice()
              .sort((a, b) => (a.contact_email || '').localeCompare(b.contact_email || ''))
              .map((r) => (
                <tr key={r.contact_email}>
                  <td className="crm-cell-name">{r.contact_email || '—'}</td>
                  <td className="crm-cell-sub crm-cell-fecha">{formatFechaHora(r.sent_at)}</td>
                  <td className="crm-cell-sub crm-cell-fecha">{r.opened ? formatFechaHora(r.opened_at) : '—'}</td>
                  <td className="crm-cell-sub crm-cell-fecha">{r.clicked ? formatFechaHora(r.clicked_at) : '—'}</td>
                  {/* Con 3+ enlaces, unirlos con coma revienta el ancho de la
                      tabla. Se muestra el conteo y la lista va en el title. */}
                  <td className="crm-cell-sub crm-cell-enlace" title={r.clicked_links?.join('\n')}>
                    {!r.clicked_links?.length
                      ? '—'
                      : r.clicked_links.length === 1
                        ? r.clicked_links[0]
                        : `${r.clicked_links.length} enlaces`}
                  </td>
                  {/* Una queja de spam y un rebote no son lo mismo y no pueden
                      leerse igual: la queja es lo único que Gmail castiga de
                      verdad. */}
                  <td className="crm-cell-sub crm-cell-fecha">
                    {r.complained ? 'Marcó spam' : r.bounced ? 'Rebotó' : 'Entregado'}
                  </td>
                </tr>
              ))}
          </Tabla>
        )}
      </Card>
    </>
  );
}
