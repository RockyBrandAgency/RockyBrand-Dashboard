import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getEmailResumen, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailContact, EmailAudiencia } from '../../../types';
import { EmailPublico } from '../EmailPublico';
import { ImportarCsv } from './ImportarCsv';
import { Panel, Aviso } from './shared';

// El público, con dos cosas que antes no estaban: de dónde salió cada
// contacto (estado de suscripción) y una vía para cargar una base entera.
//
// La distinción entre "total" y "puede recibir marketing" es el número que
// más importa de esta pantalla. Alguien que está en la lista pero no confirmó
// su suscripción NO recibe campañas, y mostrar solo el total haría creer que
// el alcance es mayor de lo que es.

const GLOSA_ESTADO: Record<string, { label: string; nota: string; color: string }> = {
  subscribed: { label: 'Suscritos', nota: 'reciben campañas', color: '#216b35' },
  pending: { label: 'Sin confirmar', nota: 'no reciben campañas hasta confirmar', color: '#8a6116' },
  unsubscribed: { label: 'Dados de baja', nota: 'pidieron no recibir más', color: 'var(--text-muted)' },
  bounced: { label: 'Rebotados', nota: 'la dirección no existe o rechaza', color: '#b42318' },
  complained: { label: 'Marcaron spam', nota: 'nunca se les vuelve a escribir', color: '#b42318' },
};

export function AudienciasEmail({
  contacts, loading, error, onReload, onAdd, onDelete,
}: {
  contacts: EmailContact[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onAdd: (email: string, name: string, tags: string[]) => Promise<void>;
  onDelete: (email: string) => Promise<void>;
}) {
  const { handleUnauthorized } = useAuth();
  const [audiencia, setAudiencia] = useState<EmailAudiencia | null>(null);

  const cargarResumen = useCallback(() => {
    getEmailResumen()
      .then((r) => setAudiencia(r.audiencia))
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) handleUnauthorized();
        // Un fallo acá no debe tapar la lista de contactos, que es lo
        // principal de la pantalla: se omite el resumen y ya.
      });
  }, [handleUnauthorized]);

  useEffect(cargarResumen, [cargarResumen]);

  const recargarTodo = () => { onReload(); cargarResumen(); };

  return (
    <>
      {audiencia && (
        <Panel title="Estado del público">
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>Pueden recibir marketing</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{audiencia.activos_marketing.toLocaleString('es-CL')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>de {audiencia.total.toLocaleString('es-CL')} en la lista</div>
            </div>
            {Object.entries(audiencia.por_estado).map(([estado, n]) => {
              const g = GLOSA_ESTADO[estado] ?? { label: estado, nota: '', color: 'var(--text)' };
              return (
                <div key={estado}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{g.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: g.color, marginTop: 4 }}>{n.toLocaleString('es-CL')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{g.nota}</div>
                </div>
              );
            })}
          </div>

          {audiencia.pendientes_confirmacion > 0 && (
            <Aviso tono="info">
              {audiencia.pendientes_confirmacion} {audiencia.pendientes_confirmacion === 1 ? 'persona recibió' : 'personas recibieron'} el
              correo de confirmación y todavía no {audiencia.pendientes_confirmacion === 1 ? 'lo confirma' : 'lo confirman'}.
              Hasta que lo hagan no entran en ninguna campaña.
            </Aviso>
          )}

          {audiencia.etiquetas.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Etiquetas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {audiencia.etiquetas.map((t) => (
                  <span key={t.tag} style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 20,
                    background: 'var(--border-soft)', color: 'var(--text-sub)', fontWeight: 600,
                  }}>
                    {t.tag} · {t.contactos}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                Las etiquetas sirven para segmentar a quién le llega cada campaña.
              </div>
            </div>
          )}
        </Panel>
      )}

      <ImportarCsv onImportado={recargarTodo} />

      <EmailPublico
        contacts={contacts}
        loading={loading}
        error={error}
        onReload={recargarTodo}
        onAdd={async (e, n, t) => { await onAdd(e, n, t); cargarResumen(); }}
        onDelete={async (e) => { await onDelete(e); cargarResumen(); }}
      />
    </>
  );
}
