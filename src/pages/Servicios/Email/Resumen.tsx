import { useEffect, useState, useCallback } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { useAuth } from '../../../context/AuthContext';
import { getEmailResumen, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailResumen as Datos } from '../../../types';
import { Card, MiniDash, Pill, Vacio, Aviso, formatTasa, formatFecha, saludRebotes, saludQuejas, tonoDe } from './shared';

// Misma estructura que Resumen del panel principal: 4 tarjetas arriba y la
// actividad reciente abajo. Se agregan los avisos de salud de envío porque el
// cliente no tiene a nadie mirando la consola por él.
export function ResumenEmail() {
  const { handleUnauthorized } = useAuth();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    getEmailResumen()
      .then(setDatos)
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized]);

  useEffect(cargar, [cargar]);

  return (
    <AsyncState loading={loading} error={error} onRetry={cargar}>
      {datos && (
        <>
          {/* Rebotes y quejas van arriba de todo: la cuenta de envío es
              compartida entre todos los clientes, así que una lista sucia de
              uno le arruina la entrega a los demás. */}
          {saludRebotes(datos.bounce_rate, datos.umbrales) === 'critico' && (
            <Aviso tono="critico">
              <strong>Rebotes en {formatTasa(datos.bounce_rate)}.</strong> Sobre {datos.umbrales.rebotes_critico}% el
              proveedor puede suspender el envío. Casi siempre viene de una base importada con direcciones viejas o mal escritas.
            </Aviso>
          )}
          {['alerta', 'critico'].includes(saludQuejas(datos.complaint_rate, datos.umbrales)) && (
            <Aviso tono={saludQuejas(datos.complaint_rate, datos.umbrales) === 'critico' ? 'critico' : 'alerta'}>
              <strong>Quejas de spam en {formatTasa(datos.complaint_rate)}.</strong> El límite sano es{' '}
              {datos.umbrales.quejas_alerta}%. Suele significar que se está escribiendo a gente que no recuerda haberse suscrito.
            </Aviso>
          )}
          {datos.audiencia.pendientes_confirmacion > 0 && (
            <Aviso tono="info">
              {datos.audiencia.pendientes_confirmacion}{' '}
              {datos.audiencia.pendientes_confirmacion === 1 ? 'persona' : 'personas'} sin confirmar la suscripción. No
              reciben campañas hasta que confirmen.
            </Aviso>
          )}

          <MiniDash
            items={[
              { label: 'Contactos activos', value: datos.audiencia.activos_marketing.toLocaleString('es-CL'), sub: `${datos.audiencia.total.toLocaleString('es-CL')} en la lista` },
              { label: 'Tasa de apertura promedio', value: formatTasa(datos.open_rate) },
              { label: 'Campañas enviadas', value: datos.campanas_enviadas },
              { label: 'Tasa de rebote', value: formatTasa(datos.bounce_rate), tono: tonoDe(saludRebotes(datos.bounce_rate, datos.umbrales)) },
            ]}
          />

          <Card title="Actividad reciente">
            {datos.ultimas.length === 0 ? (
              <Vacio>Todavía no hay campañas.</Vacio>
            ) : (
              datos.ultimas.map((c) => (
                <div className="crm-timeline-item" key={c.campaign_id}>
                  <div>
                    <div className="crm-timeline-text">{c.name || 'Sin nombre'}</div>
                    <div className="crm-timeline-when">{formatFecha(c.sent_at)}</div>
                  </div>
                  <Pill estado="sent">{formatTasa(c.open_rate)} apertura</Pill>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </AsyncState>
  );
}
