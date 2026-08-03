import { useEffect, useState, useCallback } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { KpiRow } from '../../../components/KpiRow';
import { useAuth } from '../../../context/AuthContext';
import { getEmailResumen, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailResumen as Datos } from '../../../types';
import { Panel, Vacio, Aviso, Tabla, td, tdMuted, trStyle, formatTasa, formatFecha, saludRebotes, saludQuejas, colorSalud } from './shared';

// Lo primero que ve el cliente al entrar: cuánta gente le puede escribir de
// verdad, cómo vienen sus últimas campañas y si hay algo que atender.
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
          {/* Los rebotes y las quejas se avisan arriba de todo porque la
              cuenta de envío es compartida entre todos los clientes: una
              lista sucia de uno le arruina la entrega a los demás. */}
          {saludRebotes(datos.bounce_rate, datos.umbrales) === 'critico' && (
            <Aviso tono="critico">
              <strong>Rebotes en {formatTasa(datos.bounce_rate)}.</strong> Sobre {datos.umbrales.rebotes_critico}% el proveedor
              puede suspender el envío. Casi siempre viene de una base importada con direcciones viejas o mal escritas.
            </Aviso>
          )}
          {saludQuejas(datos.complaint_rate, datos.umbrales) !== 'ok' && saludQuejas(datos.complaint_rate, datos.umbrales) !== 'sin-datos' && (
            <Aviso tono={saludQuejas(datos.complaint_rate, datos.umbrales) === 'critico' ? 'critico' : 'alerta'}>
              <strong>Quejas de spam en {formatTasa(datos.complaint_rate)}.</strong> El límite sano es {datos.umbrales.quejas_alerta}%.
              Suele significar que se está escribiendo a gente que no recuerda haberse suscrito.
            </Aviso>
          )}
          {datos.audiencia.pendientes_confirmacion > 0 && (
            <Aviso tono="info">
              {datos.audiencia.pendientes_confirmacion} {datos.audiencia.pendientes_confirmacion === 1 ? 'persona' : 'personas'} sin
              confirmar la suscripción. No reciben campañas hasta que confirmen.
            </Aviso>
          )}

          <div style={{ marginBottom: 20 }}>
            <KpiRow
              items={[
                { label: 'Pueden recibir marketing', value: datos.audiencia.activos_marketing, sub: `${datos.audiencia.total} en total` },
                { label: 'Campañas enviadas', value: datos.campanas_enviadas },
                { label: 'Aperturas', value: formatTasa(datos.open_rate) },
                { label: 'Clics', value: formatTasa(datos.click_rate) },
              ]}
            />
          </div>

          <Panel title="Salud de envío">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
              {[
                { label: 'Rebotes', v: datos.bounce_rate, salud: saludRebotes(datos.bounce_rate, datos.umbrales), limite: `alerta sobre ${datos.umbrales.rebotes_alerta}%` },
                { label: 'Quejas de spam', v: datos.complaint_rate, salud: saludQuejas(datos.complaint_rate, datos.umbrales), limite: `alerta sobre ${datos.umbrales.quejas_alerta}%` },
              ].map((m) => (
                <div key={m.label}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: colorSalud(m.salud), marginTop: 4 }}>{formatTasa(m.v)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {m.salud === 'sin-datos' ? 'todavía sin envíos que medir' : m.limite}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Últimas campañas" pad={false}>
            {datos.ultimas.length === 0 ? (
              <Vacio>Todavía no se ha enviado ninguna campaña.</Vacio>
            ) : (
              <Tabla cols={[{ label: 'Campaña' }, { label: 'Enviada' }, { label: 'Enviados', alinear: 'right' }, { label: 'Aperturas', alinear: 'right' }, { label: 'Clics', alinear: 'right' }]}>
                {datos.ultimas.map((c) => (
                  <tr key={c.campaign_id} style={trStyle}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{c.name || 'Sin nombre'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.subject}</div>
                    </td>
                    <td style={tdMuted}>{formatFecha(c.sent_at)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{c.enviados.toLocaleString('es-CL')}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{formatTasa(c.open_rate)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{formatTasa(c.click_rate)}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Panel>
        </>
      )}
    </AsyncState>
  );
}
