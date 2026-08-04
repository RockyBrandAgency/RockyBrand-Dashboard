import { useEffect, useState, useCallback } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { useAuth } from '../../../context/AuthContext';
import { getEmailCampaigns, deleteEmailCampaign, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailCampaign } from '../../../types';
import { Boton, Pill, Tabla, formatTasa, formatFecha, estadoCampana } from './shared';
import { SearchIcon, PlusIcon, MailIcon } from '../../../components/icons/RockyIcons';
import { EmptyStateIllustrated } from '../../../components/EmptyStateIllustrated';

// Misma tabla que Campañas del panel principal: buscador arriba, una fila por
// campaña con estado, fecha y las 4 tasas, y las acciones a la derecha.
//
// Una campaña enviada se lista pero no se edita ni se borra: sus métricas
// están atadas a ese contenido, y editarla convertiría el historial en una
// mentira. El backend lo rechaza igual — acá simplemente no se ofrece el
// botón, para no invitar a un error que después no se puede deshacer.
export function CampanasEmail({ onEditar, onNueva, onVerDetalle }: {
  onEditar: (campaignId: string) => void;
  onNueva: () => void;
  onVerDetalle: (campaignId: string) => void;
}) {
  const { handleUnauthorized } = useAuth();
  const [campanas, setCampanas] = useState<EmailCampaign[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 30;

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    getEmailCampaigns()
      .then((r) => setCampanas(r.campanas))
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized]);

  useEffect(cargar, [cargar]);

  async function borrar(c: EmailCampaign) {
    if (!confirm(`¿Eliminar "${c.name || c.subject}"? No se puede deshacer.`)) return;
    try {
      await deleteEmailCampaign(c.campaign_id);
      cargar();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.');
    }
  }

  const listaCompleta = (campanas ?? [])
    .filter((c) => !busqueda || (c.name || '').toLowerCase().includes(busqueda.toLowerCase()))
    .slice()
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  // Spec real de Figma (frame "34 — Volumen: Campañas"): "Mostrando 1-30
  // de N campañas" + Anterior/Siguiente, 30 filas por página. La app real
  // trae la lista completa en una sola llamada (sin paginación de
  // servidor), así que se pagina en el cliente.
  const totalPaginas = Math.max(1, Math.ceil(listaCompleta.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const desde = (paginaSegura - 1) * POR_PAGINA;
  const lista = listaCompleta.slice(desde, desde + POR_PAGINA);

  return (
    <AsyncState loading={loading} error={error} onRetry={cargar}>
      <div className="crm-toolbar">
        <div className="crm-search-wrap">
          <SearchIcon size={14} color="var(--text-sub)" />
          <input
            className="crm-search"
            placeholder="Buscar campañas..."
            aria-label="Buscar campañas"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
          />
        </div>
        <Boton tipo="primary" onClick={onNueva}>
          <PlusIcon size={12} color="#fff" /> Nueva Campaña
        </Boton>
      </div>

      <div className="crm-card">
        <Tabla
          cols={[
            { label: 'Campaña' }, { label: 'Estado' }, { label: 'Fecha' },
            { label: 'Enviados', num: true }, { label: 'Apertura', num: true },
            { label: 'Clics', num: true }, { label: 'Rebotes', num: true }, { label: '' },
          ]}
        >
          {lista.map((c) => {
            const s = c.stats ?? {};
            const enviados = Number(s.enviados ?? 0);
            // Solo se calcula una tasa cuando la campaña salió y hubo a quién
            // enviarle. Sin eso se muestra "—", nunca 0%.
            const tasa = (n: unknown) =>
              c.status === 'sent' && enviados ? formatTasa((Number(n ?? 0) / enviados) * 100) : '—';
            return (
              // La fila entera abre el detalle, igual que en el panel
              // principal. Los botones de la derecha paran la propagación
              // para que "Eliminar" no termine abriendo la campaña.
              // tabIndex+role+onKeyDown: alcanzable por teclado, no solo
              // con mouse (hallazgo de auditoría 2026-08-04).
              <tr
                key={c.campaign_id}
                onClick={() => onVerDetalle(c.campaign_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onVerDetalle(c.campaign_id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalle de la campaña ${c.name || 'sin nombre'}`}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <div className="crm-cell-name">{c.name || 'Sin nombre'}</div>
                  <div className="crm-cell-sub">{c.subject}</div>
                </td>
                <td><Pill estado={c.status}>{estadoCampana(c.status)}</Pill></td>
                <td className="crm-cell-sub">{formatFecha(c.sent_at || c.created_at)}</td>
                <td className="num">{c.status === 'sent' ? enviados.toLocaleString('es-CL') : '—'}</td>
                <td className="num">{tasa(s.aperturas)}</td>
                <td className="num">{tasa(s.clics)}</td>
                <td className="num">{tasa(s.rebotes)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="crm-row-actions">
                    {c.status === 'draft' && <Boton sm onClick={() => onEditar(c.campaign_id)}>Retomar</Boton>}
                    {c.status === 'draft' && <Boton sm tipo="danger" onClick={() => borrar(c)}>Eliminar</Boton>}
                  </div>
                </td>
              </tr>
            );
          })}
        </Tabla>
        {!lista.length && !busqueda && (
          <EmptyStateIllustrated
            icon={<MailIcon size={36} />}
            title="No hay campañas todavía"
            description="Crea tu primera campaña de email para llegar directamente a tus huéspedes."
            cta={{ label: 'Crear primera campaña', onClick: onNueva }}
          />
        )}
        {!lista.length && busqueda && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Sin resultados para "{busqueda}".
          </div>
        )}
        {listaCompleta.length > POR_PAGINA && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-6) var(--space-7)', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
              Mostrando {desde + 1}-{Math.min(desde + POR_PAGINA, listaCompleta.length)} de {listaCompleta.length} campañas
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              <Boton sm disabled={paginaSegura <= 1} onClick={() => setPagina(paginaSegura - 1)}>Anterior</Boton>
              <Boton sm disabled={paginaSegura >= totalPaginas} onClick={() => setPagina(paginaSegura + 1)}>Siguiente</Boton>
            </div>
          </div>
        )}
      </div>
    </AsyncState>
  );
}
