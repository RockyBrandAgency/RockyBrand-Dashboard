import { useState, useEffect, useCallback } from 'react';
import { getMetricsReport, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import type { MetricsReportResponse } from '../types';

// Hook compartido por las 6 páginas de Métricas (Resumen + 5 canales) -
// una sola llamada real, mismo patrón de loading/error que el resto del
// panel. `days` fijo en 90 (no hay selector de rango todavía en este
// panel - queda como mejora futura si Mato lo pide).
export function useMetricsReport(days = 90) {
  const { handleUnauthorized } = useAuth();
  const [data, setData] = useState<MetricsReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMetricsReport(days)
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized, days]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
