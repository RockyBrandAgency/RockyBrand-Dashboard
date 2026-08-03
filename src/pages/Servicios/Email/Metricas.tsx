import { useEffect, useState, useCallback } from 'react';
import { AsyncState } from '../../../components/AsyncState';
import { useAuth } from '../../../context/AuthContext';
import { getEmailMetrics, getEmailInsights, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailMetrics as Datos, EmailInsights } from '../../../types';
import { Card, Vacio, Aviso, Tabla, formatTasa, formatFecha, saludRebotes, saludQuejas } from './shared';

const colorSalud = (s: ReturnType<typeof saludRebotes>) =>
  ({ ok: '#216b35', alerta: '#8a6116', critico: '#b42318', 'sin-datos': 'var(--text-muted)' })[s];

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// Cuánto abre y clickea la gente por campaña, y a qué hora abre ESTA
// audiencia. Lo segundo solo se muestra cuando hay datos suficientes: el
// backend no devuelve una hora recomendada por debajo del mínimo, y la
// pantalla no la inventa por su cuenta.
export function MetricasEmail() {
  const { handleUnauthorized } = useAuth();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [insights, setInsights] = useState<EmailInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getEmailMetrics(), getEmailInsights()])
      .then(([m, i]) => { setDatos(m); setInsights(i); })
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized]);

  useEffect(cargar, [cargar]);

  const h = insights?.horario;
  const maxAperturas = h ? Math.max(1, ...h.por_hora.map((p) => p.aperturas)) : 1;

  return (
    <AsyncState loading={loading} error={error} onRetry={cargar}>
      {datos && (
        <>
          <Card title="Acumulado de todas las campañas enviadas">
            {datos.campanas_enviadas === 0 ? (
              <Vacio>Todavía no hay campañas enviadas, así que no hay nada que medir.</Vacio>
            ) : (
              <div className="crm-import-cifras">
                {[
                  { l: 'Enviados', v: datos.totales.enviados.toLocaleString('es-CL'), c: 'var(--text)' },
                  { l: 'Aperturas', v: formatTasa(datos.open_rate), c: 'var(--text)' },
                  { l: 'Clics', v: formatTasa(datos.click_rate), c: 'var(--text)' },
                  { l: 'Rebotes', v: formatTasa(datos.bounce_rate), c: colorSalud(saludRebotes(datos.bounce_rate, datos.umbrales)) },
                  { l: 'Quejas', v: formatTasa(datos.complaint_rate), c: colorSalud(saludQuejas(datos.complaint_rate, datos.umbrales)) },
                ].map((m) => (
                  <div key={m.l}>
                    <div className="crm-mini-label">{m.l}</div>
                    <div className="crm-import-num" style={{ color: m.c }}>{m.v}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Cuándo abre tu audiencia">
            {!h ? (
              <Vacio>Sin datos.</Vacio>
            ) : !h.suficiente ? (
              <>
                <Aviso tono="info">
                  {h.nota ?? `Se necesitan al menos ${h.minimo_necesario} aperturas para sacar una conclusión.`}
                </Aviso>
                <BarrasPorHora porHora={h.por_hora} max={maxAperturas} atenuado />
              </>
            ) : (
              <>
                <Aviso tono="ok">
                  Tu audiencia abre más alrededor de las <strong>{String(h.mejor_hora).padStart(2, '0')}:00</strong>
                  {h.mejor_dia !== undefined && <> los <strong>{DIAS[Number(h.mejor_dia)] ?? h.mejor_dia}</strong></>}.
                  Calculado sobre {h.aperturas_analizadas.toLocaleString('es-CL')} aperturas reales de tus propias campañas.
                </Aviso>
                <BarrasPorHora porHora={h.por_hora} max={maxAperturas} destacar={h.mejor_hora} />
              </>
            )}
          </Card>

          <Card title="Campaña por campaña" pad={false}>
            {datos.por_campana.length === 0 ? (
              <Vacio>Sin campañas enviadas.</Vacio>
            ) : (
              <Tabla cols={[{ label: 'Campaña' }, { label: 'Enviada' }, { label: 'Enviados', num: true }, { label: 'Aperturas', num: true }, { label: 'Clics', num: true }, { label: 'Rebotes', num: true }]}>
                {datos.por_campana.map((c) => (
                  <tr key={c.campaign_id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name || 'Sin nombre'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.subject}</div>
                    </td>
                    <td className="crm-cell-sub">{formatFecha(c.sent_at)}</td>
                    <td className="num">{c.enviados.toLocaleString('es-CL')}</td>
                    <td className="num">{formatTasa(c.open_rate)}</td>
                    <td className="num">{formatTasa(c.click_rate)}</td>
                    <td className="num" style={{ color: colorSalud(saludRebotes(c.bounce_rate, datos.umbrales)) }}>{formatTasa(c.bounce_rate)}</td>
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

// Las barras se muestran igual cuando no alcanzan los datos, pero atenuadas y
// sin conclusión: los datos que hay son reales y verlos no hace daño; lo que
// haría daño es leerlos como una recomendación.
function BarrasPorHora({ porHora, max, destacar, atenuado }: {
  porHora: { hora: number; aperturas: number }[]; max: number; destacar?: number; atenuado?: boolean;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110, opacity: atenuado ? 0.45 : 1 }}>
        {porHora.map((p) => (
          <div key={p.hora} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }} title={`${String(p.hora).padStart(2, '0')}:00 — ${p.aperturas} aperturas`}>
            <div style={{
              height: `${Math.max(2, (p.aperturas / max) * 100)}%`,
              background: destacar === p.hora ? 'var(--primary)' : 'var(--border)',
              borderRadius: '3px 3px 0 0',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6 }}>
        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Hora de Chile continental.</div>
    </div>
  );
}
