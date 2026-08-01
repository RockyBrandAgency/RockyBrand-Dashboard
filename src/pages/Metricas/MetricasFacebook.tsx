import { useState } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { KpiRow } from '../../components/KpiRow';
import { LineChart } from '../../components/LineChart';
import { MetricsPageHeader } from '../../components/MetricsPageHeader';
import { useMetricsReport } from '../../hooks/useMetricsReport';
import { downloadCsv } from '../../lib/exportCsv';
import type { DateRangeDays } from '../../components/DateRangeControl';

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

// Detalle real de Facebook (misma fuente que ya usa el panel de staff -
// meta_snapshot#, campo pagina_facebook) - pedido explícito de Mato
// (2026-08-01): panel ejecutivo por canal, con gráficos reales.
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
      ['Visualizaciones (último dato)', fb.visualizaciones_actual],
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
              <div style={{ marginBottom: 28 }}>
                <KpiRow
                  items={[
                    { label: 'Seguidores actuales', value: fb.seguidores_actuales },
                    { label: 'Visualizaciones (último dato)', value: fb.visualizaciones_actual },
                  ]}
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Seguidores en el tiempo</div>
                <LineChart
                  points={fb.snapshots.map((s) => ({ fecha: s.fecha, valor: s.seguidores }))}
                  color="#1877F2"
                  formatDate={formatDateShort}
                />
              </div>

              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Visualizaciones de página</div>
                <LineChart
                  points={fb.visualizaciones_snapshots.map((s) => ({ fecha: s.fecha, valor: s.visualizaciones }))}
                  color="#42A5F5"
                  formatDate={formatDateShort}
                />
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
