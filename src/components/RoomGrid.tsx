import { useState, useEffect, useCallback } from 'react';
import { Card } from './Card';
import { AsyncState } from './AsyncState';
import { getDisponibilidad, UnauthorizedError } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import { originLabel } from './OriginBadge';
import type { EstadoCelda, DisponibilidadResponse } from '../types';

// Definicion de color/icono aprobada (reemplaza la del Make - ver plan de
// Sesion 2.5). "Libre" es blanco con borde, NUNCA gris, para que se lea
// como vendible. Las flechas van DENTRO de la celda, nunca color solo.
// "ocupado" tenía iconAlign:'none' sin ícono - se distinguía de "salida"
// (mismo tono de verde, más claro) solo por el matiz de color, en contra
// del propio criterio de este archivo (hallazgo de auditoría 2026-08-04).
// "●" centrado marca "ocupado toda la noche", distinto de las flechas de
// borde de "llegada"/"salida" y del blanco vacío de "libre".
const CELL: Record<EstadoCelda, { bg: string; border?: string; icon?: string; iconColor?: string; iconAlign: 'left' | 'right' | 'none' }> = {
  ocupado: { bg: '#2F4A28', iconColor: 'rgba(255,255,255,0.55)', iconAlign: 'none', icon: '●' },
  llegada: { bg: '#7A9070', iconColor: '#fff', iconAlign: 'left', icon: '→' },
  salida: { bg: '#B9C4B1', iconColor: '#2F4A28', iconAlign: 'right', icon: '←' },
  libre: { bg: '#FFFFFF', border: '#D8D4CC', iconAlign: 'none' },
};

const LEGEND: { estado: EstadoCelda; label: string }[] = [
  { estado: 'ocupado', label: '● Ocupado' },
  { estado: 'llegada', label: 'Llegada →' },
  { estado: 'salida', label: '← Salida' },
  { estado: 'libre', label: 'Libre' },
];

function RoomCell({ estado, source }: { estado: EstadoCelda; source?: string | null }) {
  const c = CELL[estado];
  // Sesion 4: tooltip nativo (sin libreria nueva) con el origen real de
  // la celda ocupada/llegada/salida - solo si hay dato, nunca en "libre".
  const title = estado !== 'libre' ? originLabel(source) : undefined;
  return (
    <div
      title={title}
      style={{
        height: 26,
        borderRadius: 4,
        background: c.bg,
        border: c.border ? `1px solid ${c.border}` : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: c.iconAlign === 'left' ? 'flex-start' : c.iconAlign === 'right' ? 'flex-end' : 'center',
        padding: c.icon ? '0 5px' : undefined,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {c.icon && <span style={{ fontSize: 11, fontWeight: 800, color: c.iconColor, lineHeight: 1 }}>{c.icon}</span>}
      {title && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: c.iconColor ?? '#fff',
            opacity: 0.55,
          }}
        />
      )}
    </div>
  );
}

function RoomGridContent({ data, isDesktop }: { data: DisponibilidadResponse; isDesktop: boolean }) {
  if (data.habitaciones.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: 14 }}>
        {data.nota ?? 'Sin habitaciones registradas todavía.'}
      </div>
    );
  }

  const dias = data.dias.map((iso) => new Date(iso + 'T00:00:00'));

  return (
    <div style={{ minWidth: isDesktop ? 0 : 560 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(15, 1fr)', gap: 3, marginBottom: 6 }}>
        <div />
        {dias.map((d, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {d.toLocaleDateString('es-CL', { weekday: 'short' })}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? 'var(--primary)' : 'var(--text)' }}>{d.getDate()}</div>
          </div>
        ))}
      </div>
      {data.habitaciones.map((h) => (
        <div key={h.room_id} style={{ display: 'grid', gridTemplateColumns: '120px repeat(15, 1fr)', gap: 3, marginBottom: 5 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', paddingRight: 8 }}>
            {h.room_id}
          </div>
          {h.estados.map((estado, i) => (
            <RoomCell key={i} estado={estado} source={h.sources[i]} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function RoomGrid({ isDesktop }: { isDesktop: boolean }) {
  const { handleUnauthorized } = useAuth();
  const [data, setData] = useState<DisponibilidadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getDisponibilidad()
      .then(setData)
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

  const rango = data && data.dias.length > 0
    ? `${new Date(data.dias[0] + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })} – ${new Date(data.dias[data.dias.length - 1] + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}`
    : '';

  return (
    <Card style={{ padding: '20px 18px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Disponibilidad — próximos 15 días</div>
          {rango && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{rango}</div>}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {LEGEND.map((l) => (
            <div key={l.estado} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                style={{
                  width: 18,
                  height: 11,
                  borderRadius: 2,
                  background: CELL[l.estado].bg,
                  border: CELL[l.estado].border ? `1px solid ${CELL[l.estado].border}` : undefined,
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <AsyncState loading={loading} error={error} onRetry={load}>
        {data && <RoomGridContent data={data} isDesktop={isDesktop} />}
      </AsyncState>
    </Card>
  );
}
