import { Fragment, useEffect, useState, useCallback } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { Toggle } from '../../../components/Toggle';
import { useAuth } from '../../../context/AuthContext';
import { getEmailJourneys, toggleEmailJourney, deleteEmailJourney, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailJourney, EmailJourneysResponse, EmailJourneyStep } from '../../../types';
import { Card, Vacio, Aviso, formatFecha } from './shared';

// Los correos que salen solos cuando pasa algo (alguien manda el formulario,
// confirma una reserva, termina un viaje).
//
// El interruptor de cada automatización escribe `activo` en el flujo que lee
// el motor de envío, no un estado de pantalla: apagarla acá la apaga de
// verdad. Se verificó contra el motor, no contra la interfaz.
//
// El diseño de Figma (frame 18) muestra columnas "Última Ejecución" y
// "Envíos Totales" — ese dato no existe en el backend real
// (EmailJourney no trae timestamp de última corrida ni contador de envíos
// por automatización, solo `correos` = cantidad de pasos de envío en el
// flujo). Se adaptó la tabla al layout del diseño pero con datos reales:
// "Correos en el flujo" en vez de un número de envíos inventado.

const GLOSA_TRIGGER: Record<string, string> = {
  form_submitted: 'Cuando alguien envía el formulario del sitio',
  booking_started: 'Cuando alguien empieza una reserva',
  booking_confirmed: 'Cuando una reserva queda confirmada',
  booking_started_not_completed: 'Cuando alguien empieza una reserva y no la termina',
  trip_ended: 'Cuando termina el viaje',
};

const GLOSA_PASO: Record<string, string> = {
  send_email: 'Envía un correo',
  delay: 'Espera',
  condition: 'Se fija en algo antes de seguir',
  internal_alert: 'Avisa al equipo',
};

function esperaLegible(horas: number | null): string {
  if (horas === null || horas === undefined) return '';
  if (horas === 0) return 'de inmediato';
  if (horas < 24) return `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.round(horas / 24);
  return `${dias} ${dias === 1 ? 'día' : 'días'}`;
}

export function AutomatizacionesEmail() {
  const { handleUnauthorized } = useAuth();
  const [datos, setDatos] = useState<EmailJourneysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    getEmailJourneys()
      .then(setDatos)
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized]);

  useEffect(cargar, [cargar]);

  const alternar = async (j: EmailJourney) => {
    setOcupada(j.track_id);
    try {
      await toggleEmailJourney(j.track_id, !j.activo);
      cargar();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo cambiar.');
    } finally {
      setOcupada(null);
    }
  };

  const borrar = async (j: EmailJourney) => {
    if (!confirm(`¿Borrar la automatización "${j.track_id}"? Se pierden sus ${j.pasos.length} pasos y no se puede deshacer.\n\nSi solo quieres que deje de enviar, apágala en vez de borrarla.`)) return;
    setOcupada(j.track_id);
    try {
      await deleteEmailJourney(j.track_id);
      cargar();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo borrar.');
    } finally {
      setOcupada(null);
    }
  };

  return (
    <AsyncState loading={loading} error={error} onRetry={cargar}>
      {datos && !datos.configurado && (
        // "No configurado" y "configurado pero vacío" son cosas distintas.
        // Decirle "sin automatizaciones" a quien nunca montó ninguna suena a
        // que se borraron.
        <Card title="Automatizaciones">
          <Vacio>
            Todavía no hay automatizaciones montadas para esta cuenta.
            <div style={{ marginTop: 8, fontSize: 12 }}>Se configuran junto con el equipo de RockyBrand al activar el servicio.</div>
          </Vacio>
        </Card>
      )}

      {datos?.configurado && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-sub)' }}>
              Campañas Automatizadas por Eventos
              {datos.actualizado && (
                <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 8 }}>
                  · última modificación {formatFecha(datos.actualizado)}
                </span>
              )}
            </div>
          </div>

          {datos.journeys.length === 0 ? (
            <div className="crm-empty">No queda ninguna automatización activa ni apagada.</div>
          ) : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Nombre de Automatización / Trigger</th>
                    <th style={{ width: 100 }}>Estado</th>
                    <th style={{ width: 170 }}>Correos en el flujo</th>
                    <th style={{ width: 170, textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.journeys.map((j) => (
                    <Fragment key={j.track_id}>
                      <tr>
                        <td>
                          <div className="crm-cell-name">{j.track_id}</div>
                          <div className="crm-cell-sub">Trigger: {GLOSA_TRIGGER[j.trigger_event] ?? j.trigger_event}</div>
                        </td>
                        <td>
                          <Toggle size="sm" on={j.activo} onToggle={() => alternar(j)} disabled={ocupada === j.track_id} />
                        </td>
                        <td>
                          {j.correos} {j.correos === 1 ? 'correo' : 'correos'} · {j.pasos.length} {j.pasos.length === 1 ? 'paso' : 'pasos'}
                        </td>
                        <td>
                          <div className="crm-row-actions">
                            <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setAbierta(abierta === j.track_id ? null : j.track_id)}>
                              {abierta === j.track_id ? 'Ocultar' : 'Ver pasos'}
                            </button>
                            <button
                              type="button"
                              className="crm-btn crm-btn-sm"
                              onClick={() => borrar(j)}
                              disabled={ocupada === j.track_id}
                              style={{ background: 'var(--status-critico-bg)', color: 'var(--status-critico-dot)' }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                      {!j.activo && (
                        <tr>
                          <td colSpan={4} style={{ padding: '0 var(--space-6) var(--space-4)' }}>
                            <Aviso tono="alerta">Apagada: nadie nuevo entra a esta automatización. Los pasos se conservan.</Aviso>
                          </td>
                        </tr>
                      )}
                      {abierta === j.track_id && (
                        <tr>
                          <td colSpan={4} style={{ padding: 'var(--space-2) var(--space-6) var(--space-6)', background: 'var(--bg)' }}>
                            {j.pasos.map((p, i) => <Paso key={p.step_id} paso={p} numero={i + 1} />)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AsyncState>
  );
}

function Paso({ paso, numero }: { paso: EmailJourneyStep; numero: number }) {
  return (
    <div className="crm-step">
      <div className="crm-step-num">{numero}</div>
      <div className="crm-step-body">
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
          {GLOSA_PASO[paso.tipo] ?? paso.tipo}
          {paso.tipo === 'delay' && <span style={{ fontWeight: 500 }}> {esperaLegible(paso.delay_horas)}</span>}
        </div>

        {paso.tipo === 'send_email' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text)' }}>«{paso.subject}»</div>
            {/* Qué plantilla usa cada paso: Mato lo pidió explícitamente.
                Sin esto, saber qué texto recibe la persona obliga a abrir S3. */}
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              Plantilla: <code>{paso.template}</code>
              {paso.delay_horas ? <> · se envía {esperaLegible(paso.delay_horas)} después</> : null}
              {paso.categoria === 'transactional' && <> · transaccional (llega aunque no tenga marketing activado)</>}
            </div>
          </div>
        )}

        {paso.tipo === 'condition' && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
            Mira <code>{paso.condition_field}</code> · si sí → {paso.if_true ?? 'termina'} · si no → {paso.if_false ?? 'termina'}
          </div>
        )}

        {paso.descripcion && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>{paso.descripcion}</div>}
      </div>
    </div>
  );
}
