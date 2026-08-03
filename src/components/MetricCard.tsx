import { useState } from 'react';
import { StatusDot } from './StatusDot';
import { estadoToStatus, estadoLabel } from './status';
import type { EstadoSemaforo } from '../types';

interface MetricCardProps {
  title: string;
  estado: EstadoSemaforo;
  value: string;
  sub?: string;
  delta?: string;
  onClick?: () => void;
}

// A diferencia del Make (que solo conocia bien/atencion/critico), esta
// version tiene que poder mostrar los estados honestos que la API real
// devuelve (sin_campana_enviada, sin_channel_manager_conectado, etc.) -
// nunca se fuerzan a un color de semaforo ni a un numero inventado.
export function MetricCard({ title, estado, value, sub, delta, onClick }: MetricCardProps) {
  const [hov, setHov] = useState(false);
  const status = estadoToStatus(estado);
  const honestLabel = estadoLabel(estado);
  const displayValue = honestLabel ?? value;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        all: 'unset',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-7)',
        width: '100%',
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease',
        boxShadow: hov && onClick ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.3, letterSpacing: '0.02em' }}>
          {title}
        </span>
        <StatusDot status={status} />
      </div>
      <div>
        <div
          style={{
            fontSize: honestLabel ? 15 : 30,
            fontWeight: honestLabel ? 700 : 800,
            color: honestLabel ? 'var(--text-muted)' : 'var(--text)',
            lineHeight: 1.3,
            letterSpacing: honestLabel ? 'normal' : '-0.02em',
          }}
        >
          {displayValue}
        </div>
        {!honestLabel && sub && <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 5, lineHeight: 1.4 }}>{sub}</div>}
        {!honestLabel && delta && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginTop: 3 }}>{delta}</div>}
      </div>
      {onClick && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Ver detalle →
        </div>
      )}
    </button>
  );
}
