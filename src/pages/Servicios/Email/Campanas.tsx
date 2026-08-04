import { useEffect, useState, useCallback } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { useAuth } from '../../../context/AuthContext';
import { getEmailCampaigns, deleteEmailCampaign, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailCampaign } from '../../../types';
import { Boton, Vacio, Pill, Tabla, formatTasa, formatFecha, estadoCampana } from './shared';
import { SearchIcon, PlusIcon } from '../../../components/icons/RockyIcons';

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

  const lista = (campanas ?? [])
    .filter((c) => !busqueda || (c.name || '').toLowerCase().includes(busqueda.toLowerCase()))
    .slice()
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  return (
    <AsyncState loading={loading} error={error} onRetry={cargar}>
      <div className="crm-toolbar">
        <div className="crm-search-wrap">
          <SearchIcon size={14} color="var(--text-sub)" />
          <input
            className="crm-search"
            placeholder="Buscar campañas..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
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
              <tr
                key={c.campaign_id}
                onClick={() => onVerDetalle(c.campaign_id)}
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
        {!lista.length && <Vacio>Todavía no hay campañas — crea la primera desde "+ Nueva campaña".</Vacio>}
      </div>
    </AsyncState>
  );
}
