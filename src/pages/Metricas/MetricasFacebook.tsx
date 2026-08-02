import { useState } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { TrendChart } from '../../components/TrendChart';
import { MetricsPageHeader } from '../../components/MetricsPageHeader';
import { MetricNotAvailable } from '../../components/MetricNotAvailable';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import { downloadCsv } from '../../lib/exportCsv';
import type { DateRangeDays } from '../../components/DateRangeControl';

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 6, letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function signedOrDash(v: number | null): string {
  if (v === null) return '—';
  return (v > 0 ? '+' : '') + v.toLocaleString('es-CL');
}

// Detalle real de Facebook (misma fuente que ya usa el panel de staff -
// meta_snapshot#, campo pagina_facebook) - pedido explícito de Mato
// (2026-08-01): solo 3 métricas, sin inflar. "Clics al sitio web" y
// "mensajes recibidos" se muestran honestos como no disponibles -
// confirmado en vivo contra la API real de Meta (deprecó las métricas
// de clic-a-botón; mensajería requiere el permiso pages_messaging, que
// no tenemos).
export function MetricasFacebook({ isDesktop }: { isDesktop: boolean }) {
  const [days, setDays] = useState<DateRangeDays>(30);
  const { data, loading, error, reload } = useMetricsReport(days);
  const fb = data?.facebook;

  const handleExport = () => {
    if (!fb) return;
    const rows: (string | number | null)[][] = [
      ['Facebook', `últimos ${days} días`],
      [],
      ['Seguidores actuales', fb.seguidores_actuales],
      ['Cambio neto 7 días', fb.cambio_neto_7d],
      ['Cambio neto 30 días', fb.cambio_neto_30d],
      ['Clics al sitio web desde la Página', 'No disponible - Meta deprecó esta métrica'],
      ['Mensajes recibidos', 'No disponible - requiere permiso pages_messaging'],
      [],
      ['Seguidores en el tiempo'],
      ['Fecha', 'Seguidores'],
      ...fb.snapshots.map((s) => [s.fecha, s.seguidores]),
      [],
      ['Visualizaciones de página'],
      ['Fecha', 'Visualizaciones'],
      ...fb.visualizaciones_snapshots.map((s) => [s.fecha, s.visualizaciones]),
    ];
    downloadCsv(`metricas-facebook-${days}d.csv`, rows);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <MetricsPageHeader
          title="Facebook"
          subtitle={fb?.nombre_pagina}
          isDesktop={isDesktop}
          days={days}
          onDaysChange={setDays}
          onExport={handleExport}
          exportDisabled={!fb}
        />

        <AsyncState loading={loading} error={error} onRetry={reload}>
          {fb && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(1, 1fr)', gap: 12, marginBottom: 28 }}>
                <KpiCard
                  label="Seguidores netos de la Página"
                  value={signedOrDash(fb.cambio_neto_7d)}
                  sub={`30 días: ${signedOrDash(fb.cambio_neto_30d)} · actuales: ${fb.seguidores_actuales?.toLocaleString('es-CL') ?? '—'}`}
                />
                <MetricNotAvailable label="Clics al sitio web desde la Página" reason="Meta deprecó esta métrica para Páginas." />
                <MetricNotAvailable label="Mensajes recibidos" reason="Requiere el permiso pages_messaging, que no tenemos hoy." />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Seguidores en el tiempo</div>
                <TrendChart
                  points={fb.snapshots.map((s) => ({ fecha: s.fecha, valor: s.seguidores }))}
                  color="#1877F2"
                  formatDate={formatDateShort}
                  compact={!isDesktop}
                  unitLabel="seguidores"
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Visualizaciones de página</div>
                <TrendChart
                  points={fb.visualizaciones_snapshots.map((s) => ({ fecha: s.fecha, valor: s.visualizaciones }))}
                  color="#42A5F5"
                  formatDate={formatDateShort}
                  compact={!isDesktop}
                  unitLabel="visualizaciones"
                />
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
