import { useEffect, useState, useCallback } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { useAuth } from '../../../context/AuthContext';
import { getEmailPendientes, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailPendientes as Datos } from '../../../types';
import { Card, MiniDash, Vacio, Tabla, formatFecha } from './shared';

// Lo que hay que hacer a mano para que las automatizaciones avancen.
//
// Mismo cálculo que ve el equipo de RockyBrand en su panel — literalmente el
// mismo módulo del backend. Antes de compartirlo, cada panel lo calculaba por
// su cuenta y un mismo contacto podía salir vencido en uno y a tiempo en el
// otro.
//
// Nunca inventa: si un contacto no tiene fecha de creación, aparece igual
// pero con el reloj vacío. Un "0 horas restantes" falso haría correr a
// alguien por nada.
export function PendientesEmail() {
  const { handleUnauthorized } = useAuth();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    getEmailPendientes()
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
          <MiniDash
            items={[
              {
                label: 'Sin responder',
                value: datos.totales.sin_responder,
                sub: datos.totales.vencidos_sla ? `${datos.totales.vencidos_sla} fuera de plazo` : 'todos dentro de plazo',
                tono: datos.totales.vencidos_sla > 0 ? 'critico' : undefined,
              },
              { label: 'Reservas sin pago', value: datos.totales.sin_confirmar, tono: datos.totales.sin_confirmar > 0 ? 'alerta' : undefined },
              { label: 'Sin datos de vuelo', value: datos.totales.sin_registrar_vuelo },
              { label: 'Viajes por cerrar', value: datos.totales.por_cerrar },
            ]}
          />

          <Card title="Consultas sin responder" pad={false}>
            {datos.sin_responder.length === 0 ? (
              <Vacio>Nada pendiente de responder.</Vacio>
            ) : (
              <Tabla cols={[{ label: 'Contacto' }, { label: 'Llegó' }, { label: 'Plazo', num: true }]}>
                {datos.sin_responder.map((c) => (
                  <tr key={c.email}>
                    <td>
                      <div className="crm-cell-name">{c.name || '(sin nombre)'}</div>
                      <div className="crm-cell-sub">{c.email}</div>
                    </td>
                    <td className="crm-cell-sub">{formatFecha(c.created_at)}</td>
                    <td className="num" style={{ color: c.vencido ? '#b42318' : undefined, fontWeight: c.vencido ? 700 : undefined }}>
                      {c.horas_restantes_sla === null
                        ? 'sin fecha de creación'
                        : c.vencido
                          ? `vencido hace ${Math.abs(Math.round(c.horas_restantes_sla))} h`
                          : `quedan ${Math.round(c.horas_restantes_sla)} h`}
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Card>

          <Card title="Reservas sin pago registrado" pad={false}>
            {datos.sin_confirmar.length === 0 ? (
              <Vacio>Nada pendiente de cobro.</Vacio>
            ) : (
              <Tabla cols={[{ label: 'Contacto' }, { label: 'Programa' }, { label: 'Llegada' }]}>
                {datos.sin_confirmar.map((c) => (
                  <tr key={c.email}>
                    <td>
                      <div className="crm-cell-name">{c.name || '(sin nombre)'}</div>
                      <div className="crm-cell-sub">{c.email}</div>
                    </td>
                    <td>{c.tipo_programa || '—'}</td>
                    <td className="crm-cell-sub">{c.fecha_llegada || '—'}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Card>

          <Card title="Sin datos de vuelo" pad={false}>
            {datos.sin_registrar_vuelo.length === 0 ? (
              <Vacio>Todos los que ya pagaron tienen su vuelo registrado.</Vacio>
            ) : (
              <Tabla cols={[{ label: 'Contacto' }, { label: 'Llegada' }]}>
                {datos.sin_registrar_vuelo.map((c) => (
                  <tr key={c.email}>
                    <td>
                      <div className="crm-cell-name">{c.name || '(sin nombre)'}</div>
                      <div className="crm-cell-sub">{c.email}</div>
                    </td>
                    <td className="crm-cell-sub">{c.fecha_llegada || '—'}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Card>

          <Card title="Viajes por cerrar" pad={false}>
            {datos.por_cerrar.length === 0 ? (
              <Vacio>Nada por cerrar.</Vacio>
            ) : (
              <Tabla cols={[{ label: 'Contacto' }, { label: 'Salida' }]}>
                {datos.por_cerrar.map((c) => (
                  <tr key={c.email}>
                    <td>
                      <div className="crm-cell-name">{c.name || '(sin nombre)'}</div>
                      <div className="crm-cell-sub">{c.email}</div>
                    </td>
                    <td className="crm-cell-sub">{c.fecha_salida || '—'}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Card>
        </>
      )}
    </AsyncState>
  );
}
