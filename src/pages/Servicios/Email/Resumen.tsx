import { useEffect, useState, useCallback } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { useAuth } from '../../../context/AuthContext';
import { getEmailResumen, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailResumen as Datos } from '../../../types';
import { Vacio, Aviso, formatTasa, formatFecha, saludRebotes, saludQuejas, type Salud } from './shared';

// Misma estructura que Resumen del panel principal: KPIs arriba, actividad
// reciente + salud de envío abajo.
//
// El diseño de Figma (frame 11) muestra "Enviados este Mes / Límite: 5.000"
// y "Reputación del Dominio 99/100 (SPF/DKIM/DMARC)" - ninguno de los dos
// existe en el backend real (no hay contador de envíos por mes con límite,
// no hay score de reputación de dominio). Se reemplazó por datos reales:
// campañas enviadas en vez del límite inventado, y la fila de reputación
// de dominio se omitió en vez de mostrar un 99/100 falso.

function saludLabel(s: Salud): string {
  return { ok: 'Saludable', alerta: 'Atención', critico: 'Crítico', 'sin-datos': 'Sin datos' }[s];
}

function saludBadgeColors(s: Salud): { bg: string; text: string } {
  if (s === 'critico') return { bg: 'var(--status-critico-bg)', text: 'var(--status-critico-dot)' };
  if (s === 'alerta') return { bg: 'var(--status-atencion-bg)', text: 'var(--status-atencion-dot)' };
  if (s === 'sin-datos') return { bg: 'var(--surface-2)', text: 'var(--text-faint)' };
  return { bg: 'var(--status-bien-bg)', text: 'var(--status-bien-dot)' };
}

function KpiCard({ label, value, badge }: { label: string; value: string; badge?: { label: string; bg: string; text: string } }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-7)', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
        {badge && (
          <div style={{ background: badge.bg, color: badge.text, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-xs)' }}>
            {badge.label}
          </div>
        )}
      </div>
    </div>
  );
}

function SaludRow({ label, value, salud, sub }: { label: string; value: string; salud: Salud; sub: string }) {
  const c = saludBadgeColors(salud);
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-sub)' }}>{label}</div>
        <div style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--radius-xs)' }}>
          {saludLabel(salud)}
        </div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

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

          {/* Figma (frame 11) muestra badges de tendencia en 3 de las 4
              tarjetas ("+3.4%", "Saludable", "+0.5%") - EmailResumen no
              trae ningún campo de variación/período anterior
              (types.ts:372-381), así que no hay con qué calcular un
              delta real. KpiCard sí soporta la prop `badge` (para cuando
              exista el dato), pero no se fabrica un número acá. */}
          <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', marginBottom: 'var(--space-7)' }}>
            <KpiCard label="Contactos activos" value={datos.audiencia.activos_marketing.toLocaleString('es-CL')} />
            <KpiCard label="Tasa de apertura promedio" value={formatTasa(datos.open_rate)} />
            <KpiCard label="Tasa de clic promedio" value={formatTasa(datos.click_rate)} />
            <KpiCard label="Campañas enviadas" value={String(datos.campanas_enviadas)} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-7)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '2 1 480px', minWidth: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-8)', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 'var(--space-6)' }}>Actividad Reciente</div>
              {datos.ultimas.length === 0 ? (
                <Vacio>Todavía no hay campañas.</Vacio>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                  {datos.ultimas.map((c) => (
                    <div key={c.campaign_id} style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'center' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--primary)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{c.name || 'Sin nombre'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                          {formatFecha(c.sent_at)} · {formatTasa(c.open_rate)} de apertura
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: '1 1 320px', minWidth: 280, maxWidth: 420, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-8)', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Salud de Envío</div>
              <SaludRow
                label="Tasa de Rebote"
                value={formatTasa(datos.bounce_rate)}
                salud={saludRebotes(datos.bounce_rate, datos.umbrales)}
                sub={`Límite crítico: ${datos.umbrales.rebotes_critico}%`}
              />
              <div style={{ height: 1, background: 'var(--border)' }} />
              <SaludRow
                label="Tasa de Quejas (Spam)"
                value={formatTasa(datos.complaint_rate)}
                salud={saludQuejas(datos.complaint_rate, datos.umbrales)}
                sub={`Límite recomendado: ${datos.umbrales.quejas_alerta}%`}
              />
            </div>
          </div>
        </>
      )}
    </AsyncState>
  );
}
