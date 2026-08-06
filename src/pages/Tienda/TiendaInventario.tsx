import { useState, useEffect, useCallback } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { getTiendaProductos, actualizarTiendaProducto, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import type { StoreProduct } from '../../types';

function money(clp: number): string {
  return clp.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
}

type Campo = 'precio_clp' | 'stock';

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 14,
  color: 'var(--text)',
  background: 'var(--white)',
  border: '1px solid var(--primary)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 8px',
  fontFamily: 'inherit',
};

export function TiendaInventario({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [productos, setProductos] = useState<StoreProduct[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ sku: string; campo: Campo } | null>(null);
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getTiendaProductos()
      .then((r) => setProductos(r.productos))
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

  function empezarEdicion(sku: string, campo: Campo, actual: number) {
    setEditando({ sku, campo });
    setValor(String(actual));
    setSaveError('');
  }

  async function guardarCampo() {
    if (!editando) return;
    const numero = Math.round(Number(valor.replace(',', '.')));
    if (!Number.isFinite(numero) || numero < 0) {
      setSaveError('Ingresa un número válido.');
      return;
    }
    setGuardando(editando.sku);
    setSaveError('');
    try {
      await actualizarTiendaProducto(editando.sku, { [editando.campo]: numero });
      setEditando(null);
      load();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(null);
    }
  }

  async function toggleActivo(p: StoreProduct) {
    setGuardando(p.sku);
    setSaveError('');
    try {
      await actualizarTiendaProducto(p.sku, { activo: !p.activo });
      load();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(null);
    }
  }

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
              Inventario
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Precio y stock se editan acá, en vivo. No hay forma de eliminar un modelo por completo — solo hay
              historial que preservar (órdenes que lo referencian): desactivarlo lo saca de la tienda al toque.
            </div>
          </div>
        </div>

        {saveError && (
          <div style={{ fontSize: 13, color: 'var(--status-critico-dot)', marginBottom: 14 }}>{saveError}</div>
        )}

        <AsyncState loading={loading} error={error} onRetry={load}>
          {productos && productos.length === 0 && (
            <EmptyStateIllustrated
              icon={<span style={{ fontSize: 36 }}>📦</span>}
              title="Sin productos cargados"
              description="Todavía no hay modelos en el catálogo."
            />
          )}

          {productos && productos.length > 0 && (
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
                  <span style={col(280)}>Modelo</span>
                  <span style={col(120)}>SKU</span>
                  <span style={col(150, { textAlign: 'right' })}>Precio</span>
                  <span style={col(110, { textAlign: 'right' })}>Stock</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Estado</span>
                </div>
              )}
              {productos.map((p) => {
                const busy = guardando === p.sku;
                return (
                  <div
                    key={p.sku}
                    style={{
                      display: 'flex',
                      flexDirection: isDesktop ? 'row' : 'column',
                      alignItems: isDesktop ? 'center' : 'flex-start',
                      gap: isDesktop ? 0 : 8,
                      padding: isDesktop ? '14px 24px' : '14px 16px',
                      borderBottom: '1px solid var(--border-soft)',
                      opacity: p.activo ? 1 : 0.55,
                    }}
                  >
                    <span style={isDesktop ? col(280, { fontWeight: 600, color: 'var(--text)', fontSize: 14 }) : { fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>
                      {p.nombre}
                      {p.familia && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {p.familia}</span>}
                    </span>
                    <span style={isDesktop ? col(120, { fontSize: 13, color: 'var(--text-sub)' }) : { fontSize: 12, color: 'var(--text-muted)' }}>{p.sku}</span>

                    <span style={isDesktop ? col(150, { textAlign: 'right' }) : { marginTop: 2 }}>
                      {editando?.sku === p.sku && editando.campo === 'precio_clp' ? (
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            autoFocus
                            value={valor}
                            inputMode="numeric"
                            onChange={(e) => setValor(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void guardarCampo();
                              if (e.key === 'Escape') setEditando(null);
                            }}
                            style={{ ...inputStyle, width: 110 }}
                          />
                          <button
                            onClick={() => void guardarCampo()}
                            disabled={busy}
                            style={{ all: 'unset', background: 'var(--primary)', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          >
                            OK
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => empezarEdicion(p.sku, 'precio_clp', p.precio_clp)}
                          style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: 'var(--text)', fontSize: 14, borderBottom: '1px dashed var(--border)' }}
                        >
                          {money(p.precio_clp)}
                        </button>
                      )}
                    </span>

                    <span style={isDesktop ? col(110, { textAlign: 'right' }) : { marginTop: 2 }}>
                      {editando?.sku === p.sku && editando.campo === 'stock' ? (
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            autoFocus
                            value={valor}
                            inputMode="numeric"
                            onChange={(e) => setValor(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void guardarCampo();
                              if (e.key === 'Escape') setEditando(null);
                            }}
                            style={{ ...inputStyle, width: 70 }}
                          />
                          <button
                            onClick={() => void guardarCampo()}
                            disabled={busy}
                            style={{ all: 'unset', background: 'var(--primary)', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          >
                            OK
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => empezarEdicion(p.sku, 'stock', p.stock)}
                          style={{
                            all: 'unset',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 14,
                            borderBottom: '1px dashed var(--border)',
                            color: p.stock <= 2 ? 'var(--status-critico-dot)' : 'var(--text)',
                          }}
                        >
                          {p.stock}
                        </button>
                      )}
                    </span>

                    <span style={isDesktop ? { flex: 1, textAlign: 'right' } : { marginTop: 4 }}>
                      <button
                        onClick={() => void toggleActivo(p)}
                        disabled={busy}
                        style={{
                          all: 'unset',
                          cursor: busy ? 'wait' : 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: p.activo ? 'var(--status-bien-bg)' : 'var(--status-neutro-bg)',
                          color: p.activo ? 'var(--status-bien-dot)' : 'var(--text-muted)',
                        }}
                      >
                        {p.activo ? 'Activo · Desactivar' : 'Inactivo · Reactivar'}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
