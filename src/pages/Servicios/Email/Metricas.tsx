import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { AsyncState } from '../../../components/AsyncState';
import { useAuth } from '../../../context/AuthContext';
import { getEmailMetrics, getEmailInsights, getEmailContacts, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailMetrics as Datos, EmailInsights, EmailContact } from '../../../types';
import { Card, MiniDash, Vacio, Aviso, Tabla, formatTasa, formatFecha, saludRebotes, saludQuejas } from './shared';

// El embudo: mismo componente que en el panel principal. Muestra la caída de
// enviados → aperturas → clics en una sola mirada, que es lo que una tabla de
// porcentajes no deja ver.
function FilaEmbudo({ label, valor, max, orden = 0 }: { label: string; valor: number; max: number; orden?: number }) {
  const pct = max ? (valor / max) * 100 : 0;
  const pctLabel = `${pct.toFixed(0)}%`;
  // Con la barra muy angosta el % no entra adentro (se corta) - en vez de
  // ocultarlo (bug real de auditoría 2026-08-04: la fila de Clics con
  // 4.8% quedaba sin ningún número visible), se muestra afuera, a la
  // derecha de la barra, en texto oscuro.
  const cabeAdentro = pct >= 12;
  const anchoFinal = `${Math.max(pct, 8)}%`;
  const barraRef = useRef<HTMLDivElement>(null);

  // La barra crece desde cero al aparecer (2026-08-18, pedido de Mato: usar
  // GSAP para los gráficos de datos). El `orden` escalona las filas de arriba
  // hacia abajo, que es la dirección en la que se lee un embudo: primero
  // cuántos salieron, después cuántos abrieron, después cuántos clickearon.
  //
  // El tween se guarda y se mata en el cleanup, y el ancho final se deja
  // puesto: sin eso, StrictMode (activo en este panel) monta dos veces y un
  // desmontaje a mitad de animación dejaba la barra congelada a medio crecer
  // - la misma trampa ya documentada en LineChart.tsx.
  useEffect(() => {
    const el = barraRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { width: anchoFinal });
      return;
    }
    const tween = gsap.fromTo(
      el,
      { width: '0%' },
      { width: anchoFinal, duration: 0.85, delay: orden * 0.08, ease: 'power2.out' },
    );
    return () => {
      tween.kill();
      gsap.set(el, { width: anchoFinal });
    };
  }, [anchoFinal, orden]);

  return (
    <div className="crm-funnel-row">
      <span className="crm-funnel-label">{label}</span>
      <div className="crm-funnel-track">
        <div ref={barraRef} className="crm-funnel-fill" style={{ width: anchoFinal }}>
          {cabeAdentro && <span className="crm-funnel-pct">{pctLabel}</span>}
        </div>
        {!cabeAdentro && <span className="crm-funnel-pct-outside">{pctLabel}</span>}
      </div>
      <span className="crm-funnel-value">{valor.toLocaleString('es-CL')}</span>
    </div>
  );
}

const colorSalud = (s: ReturnType<typeof saludRebotes>) =>
  ({ ok: 'var(--status-bien-dot)', alerta: 'var(--status-atencion-dot)', critico: 'var(--status-critico-dot)', 'sin-datos': 'var(--text-muted)' })[s];

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// Cuánto abre y clickea la gente por campaña, y a qué hora abre ESTA
// audiencia. Lo segundo solo se muestra cuando hay datos suficientes: el
// backend no devuelve una hora recomendada por debajo del mínimo, y la
// pantalla no la inventa por su cuenta.
export function MetricasEmail() {
  const { handleUnauthorized } = useAuth();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [insights, setInsights] = useState<EmailInsights | null>(null);
  const [contactos, setContactos] = useState<EmailContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getEmailMetrics(), getEmailInsights(), getEmailContacts()])
      .then(([m, i, c]) => { setDatos(m); setInsights(i); setContactos(c.contacts); })
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized]);

  useEffect(cargar, [cargar]);

  const h = insights?.horario;

  // Base de contactos por estado, y el desglose por etiqueta: los mismos
  // números que muestra el panel principal.
  const suscritos = contactos.filter((c) => c.status === 'subscribed').length;
  const desuscritos = contactos.filter((c) => c.status === 'unsubscribed').length;
  const rebotados = contactos.filter((c) => c.status === 'bounced').length;
  const porEtiqueta = Array.from(new Set(contactos.flatMap((c) => c.tags || [])))
    .map((tag) => ({ tag, cuantos: contactos.filter((c) => (c.tags || []).includes(tag)).length }))
    .sort((a, b) => b.cuantos - a.cuantos);

  // Rebote PROMEDIO MENSUAL: se agrupan las campañas por mes, se calcula la
  // tasa de cada mes y se promedian los meses con envíos. No es lo mismo que
  // el rebote acumulado — un mes malo se nota acá y se diluye en el total.
  const porMes = new Map<string, { enviados: number; rebotes: number }>();
  (datos?.por_campana ?? []).forEach((c) => {
    const mes = (c.sent_at || '').slice(0, 7);
    if (!mes) return;
    const acc = porMes.get(mes) || { enviados: 0, rebotes: 0 };
    acc.enviados += c.enviados;
    acc.rebotes += Math.round((c.bounce_rate ?? 0) / 100 * c.enviados);
    porMes.set(mes, acc);
  });
  const tasasMensuales = Array.from(porMes.values()).filter((m) => m.enviados > 0)
    .map((m) => (m.rebotes / m.enviados) * 100);
  const reboteMensual = tasasMensuales.length
    ? tasasMensuales.reduce((a, b) => a + b, 0) / tasasMensuales.length
    : null;
  const maxAperturas = h ? Math.max(1, ...h.por_hora.map((p) => p.aperturas)) : 1;

  return (
    <AsyncState loading={loading} error={error} onRetry={cargar}>
      {datos && (
        <>
          <MiniDash
            items={[
              { label: 'Suscritos activos', value: suscritos.toLocaleString('es-CL'), sub: `de ${contactos.length.toLocaleString('es-CL')} en la base total` },
              { label: 'Base total', value: contactos.length.toLocaleString('es-CL'), sub: 'todos los estados' },
              { label: 'Desuscritos', value: desuscritos.toLocaleString('es-CL'), sub: `${rebotados} marcados como rebotados` },
              {
                label: 'Rebote promedio mensual',
                value: formatTasa(reboteMensual),
                sub: tasasMensuales.length ? `${tasasMensuales.length} mes(es) con envíos` : 'Sin envíos todavía',
              },
            ]}
          />

          <Card title="Embudo de Desempeño">
            {datos.totales.enviados === 0 ? (
              <Vacio>Todavía no hay envíos que medir.</Vacio>
            ) : (
              <>
                <FilaEmbudo label="Enviados" valor={datos.totales.enviados} max={datos.totales.enviados} orden={0} />
                <FilaEmbudo label="Aperturas" valor={datos.totales.aperturas} max={datos.totales.enviados} orden={1} />
                <FilaEmbudo label="Clics" valor={datos.totales.clics} max={datos.totales.enviados} orden={2} />
              </>
            )}
          </Card>

          <Card title="Desglose por etiqueta" pad={false}>
            {porEtiqueta.length === 0 ? (
              <Vacio>Ningún contacto tiene etiquetas asignadas todavía.</Vacio>
            ) : (
              <Tabla cols={[{ label: 'Etiqueta' }, { label: 'Contactos', num: true }]}>
                {porEtiqueta.map((t) => (
                  <tr key={t.tag}>
                    <td className="crm-cell-name">{t.tag}</td>
                    <td className="num">{t.cuantos.toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Card>

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
