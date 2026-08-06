import { useState, useEffect, useCallback, useMemo } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { KpiRow } from '../../components/KpiRow';
import { getTiendaResumen, getTiendaPedidos, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { StoreDashboardResumen, StoreOrder, StoreOrderStatus } from '../../types';

function money(clp: number | undefined): string {
  return (clp ?? 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

function fmtWhen(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const ESTADO_LABEL: Record<StoreOrderStatus, string> = {
  pendiente_pago: 'Pendiente de pago',
  pago_iniciado: 'Pago iniciado',
  pagada: 'Pagada',
  pago_rechazado: 'Pago rechazado',
  pago_anulado: 'Pago anulado',
  expirada: 'Expirada',
  revision_monto: 'Revisión manual',
};

const ESTADO_COLOR: Record<StoreOrderStatus, { bg: string; dot: string }> = {
  pagada: { bg: 'var(--status-bien-bg)', dot: 'var(--status-bien-dot)' },
  pendiente_pago: { bg: 'var(--status-neutro-bg)', dot: 'var(--status-neutro-text)' },
  pago_iniciado: { bg: 'var(--status-atencion-bg)', dot: 'var(--status-atencion-dot)' },
  pago_rechazado: { bg: 'var(--status-critico-bg)', dot: 'var(--status-critico-dot)' },
  pago_anulado: { bg: 'var(--status-critico-bg)', dot: 'var(--status-critico-dot)' },
  expirada: { bg: 'var(--status-neutro-bg)', dot: 'var(--status-neutro-text)' },
  revision_monto: { bg: 'var(--status-critico-bg)', dot: 'var(--status-critico-dot)' },
};

const TABS: { key: StoreOrderStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Todas' },
  { key: 'pagada', label: 'Pagadas' },
  { key: 'pendiente_pago', label: 'Pendientes' },
  { key: 'revision_monto', label: 'Revisión' },
];

export function TiendaVentas({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [resumen, setResumen] = useState<StoreDashboardResumen | null>(null);
  const [ordenes, setOrdenes] = useState<StoreOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<StoreOrderStatus | 'ALL'>('ALL');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getTiendaResumen(), getTiendaPedidos()])
      .then(([r, o]) => {
        setResumen(r);
        setOrdenes(o.ordenes);
      })
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setError(e instanceof Error ? e.message : 'Error de red.');
      })
      .finally(() => setLoading(false));
  }, [handleUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const filtradas = useMemo(() => (ordenes ?? []).filter((o) => tab === 'ALL' || o.estado === tab), [ordenes, tab]);

  const col = (w: number, extra?: React.CSSProperties): React.CSSProperties => ({ flexShrink: 0, width: w, ...extra });

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
            paddingBottom: 'var(--space-7)',
            borderBottom: '1px solid var(--border)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Ventas
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Pedidos reales de la tienda, tal como llegan de Webpay.
            </div>
          </div>
        </div>

        <AsyncState loading={loading} error={error} onRetry={load}>
          {resumen && resumen.en_revision_monto.length > 0 && (
            <div
              style={{
                background: 'var(--status-critico-bg)',
                border: '1px solid var(--status-critico-dot)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-7)',
                marginBottom: 'var(--space-7)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-critico-dot)', marginBottom: 8 }}>
                ⚠ {resumen.en_revision_monto.length} pedido{resumen.en_revision_monto.length === 1 ? '' : 's'} en revisión manual
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                Transbank cobró un monto distinto al esperado. El stock no se restaura solo — revisa el pedido antes
                de decidir.
              </div>
            </div>
          )}

          {resumen && (
            <div style={{ marginBottom: 'var(--space-8)' }}>
              <KpiRow
                items={[
                  { label: 'Ventas de la semana', value: resumen.ventas_semana.cantidad, sub: money(resumen.ventas_semana.total_clp) },
                  { label: 'Despachos pendientes', value: resumen.despachos_pendientes.length, sub: 'pagadas sin despachar' },
                  { label: 'Riesgo de quiebre de stock', value: resumen.riesgo_quiebre_stock.length, sub: 'modelos con stock bajo' },
                ]}
              />
            </div>
          )}

          {ordenes && ordenes.length === 0 && (
            <EmptyStateIllustrated
              icon={<span style={{ fontSize: 36 }}>🛒</span>}
              title="Aún no hay pedidos"
              description="Cuando alguien compre en la tienda, sus pedidos van a aparecer acá."
            />
          )}

          {ordenes && ordenes.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 4, background: 'var(--border)', padding: 4, borderRadius: 'var(--radius-md)', width: 'fit-content', marginBottom: 'var(--space-7)' }}>
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    aria-pressed={tab === t.key}
                    style={{
                      all: 'unset',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 13,
                      fontWeight: tab === t.key ? 600 : 500,
                      color: tab === t.key ? 'var(--text)' : 'var(--text-sub)',
                      background: tab === t.key ? 'var(--white)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {filtradas.length === 0 ? (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Ningún pedido coincide con este filtro.
                </div>
              ) : (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {isDesktop && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#f9fafb',
                        borderBottom: '1px solid var(--border)',
                        padding: '12px 24px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-sub)',
                      }}
                    >
                      <span style={col(160)}>Pedido</span>
                      <span style={col(220)}>Cliente</span>
                      <span style={col(150)}>Estado</span>
                      <span style={col(120, { textAlign: 'right' })}>Total</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>Fecha</span>
                    </div>
                  )}
                  {filtradas.map((o) => {
                    const sc = ESTADO_COLOR[o.estado];
                    return (
                      <div
                        key={o.order_id}
                        style={{
                          display: 'flex',
                          flexDirection: isDesktop ? 'row' : 'column',
                          alignItems: isDesktop ? 'center' : 'flex-start',
                          gap: isDesktop ? 0 : 6,
                          padding: isDesktop ? '14px 24px' : '14px 16px',
                          borderBottom: '1px solid var(--border-soft)',
                        }}
                      >
                        <span style={isDesktop ? col(160, { fontWeight: 600, color: 'var(--text)', fontSize: 13 }) : { fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>
                          {o.order_id}
                        </span>
                        <span style={isDesktop ? col(220, { fontSize: 13, color: 'var(--text-sub)' }) : { fontSize: 12, color: 'var(--text-muted)' }}>
                          {o.email || '—'}
                        </span>
                        <span style={isDesktop ? col(150) : { marginTop: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: sc?.bg, color: sc?.dot }}>
                            {ESTADO_LABEL[o.estado] ?? o.estado}
                          </span>
                        </span>
                        <span style={isDesktop ? col(120, { textAlign: 'right', fontWeight: 700, color: 'var(--text)', fontSize: 14 }) : { fontWeight: 700, color: 'var(--text)', fontSize: 14, marginTop: 2 }}>
                          {money(o.total_clp)}
                        </span>
                        <span style={isDesktop ? { flex: 1, textAlign: 'right', fontSize: 13, color: 'var(--text-sub)' } : { fontSize: 12, color: 'var(--text-muted)' }}>
                          {fmtWhen(o.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
