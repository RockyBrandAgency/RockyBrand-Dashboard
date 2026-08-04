import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getEmailCampaignDetalle, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailCampaignDetalle } from '../../../types';
import { Card, Boton, MiniDash, Vacio, Pill, Tabla, formatTasa, formatFecha, estadoCampana } from './shared';

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

      <Card title={`Destinatarios (${datos.destinatarios.length})`} pad={false}>
        {datos.destinatarios.length === 0 ? (
          <Vacio>
            {c.status === 'sent'
              ? 'Sin datos de destinatarios todavía — los eventos de envío pueden tardar unos minutos en llegar.'
              : 'Esta campaña todavía no se ha enviado.'}
          </Vacio>
        ) : (
          <Tabla cols={[{ label: 'Contacto' }, { label: 'Enviado' }, { label: 'Apertura' }, { label: 'Clic' }, { label: 'Enlaces' }, { label: 'Rebotó' }]}>
            {datos.destinatarios
              .slice()
              .sort((a, b) => (a.contact_email || '').localeCompare(b.contact_email || ''))
              .map((r) => (
                <tr key={r.contact_email}>
                  <td className="crm-cell-name">{r.contact_email}</td>
                  <td className="crm-cell-sub">{formatFecha(r.sent_at) }</td>
                  <td className="crm-cell-sub">{r.opened ? formatFecha(r.opened_at) || 'Sí' : '—'}</td>
                  <td className="crm-cell-sub">{r.clicked ? formatFecha(r.clicked_at) || 'Sí' : '—'}</td>
                  <td className="crm-cell-sub">{r.clicked_links?.length ? r.clicked_links.join(', ') : '—'}</td>
                  <td className="crm-cell-sub">{r.bounced ? 'Sí' : '—'}</td>
                </tr>
              ))}
          </Tabla>
        )}
      </Card>
    </>
  );
}
