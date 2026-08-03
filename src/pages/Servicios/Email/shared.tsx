import type { ReactNode } from 'react';
import type { EmailUmbrales } from '../../../types';

// Piezas compartidas por las 6 secciones de Email Marketing.
//
// La razón de que vivan acá y no repetidas en cada pantalla es una sola: la
// forma de mostrar una tasa. El backend devuelve `null` cuando no hay
// denominador, y si cada pantalla decide por su cuenta qué hacer con eso,
// tarde o temprano alguna pinta un 0% rojo donde en realidad todavía no hay
// nada que medir.

export function Panel({ title, right, children, pad = true }: { title?: string; right?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      {title && (
        // flexWrap es lo que evita que las acciones se corten en móvil: sin
        // él, la fila de botones se salía del panel (que tiene overflow
        // hidden) y "Borrar" quedaba a medias, imposible de tocar. Se vio en
        // una captura a 390px, no midiendo el ancho de la página - la página
        // no desbordaba, el recorte pasaba dentro del panel.
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '16px 16px 12px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          {right}
        </div>
      )}
      <div style={{ padding: pad ? 16 : 0 }}>{children}</div>
    </div>
  );
}

export function Boton({ children, onClick, tipo = 'normal', disabled, type }: {
  children: ReactNode; onClick?: () => void; tipo?: 'normal' | 'primario' | 'peligro'; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const estilos = {
    normal: { background: 'var(--white)', color: 'var(--text)', border: '1px solid var(--border)' },
    primario: { background: 'var(--primary)', color: '#fff', border: '1px solid var(--primary)' },
    peligro: { background: 'var(--white)', color: '#b42318', border: '1px solid #f0c4c0' },
  }[tipo];
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      style={{
        all: 'unset', boxSizing: 'border-box', padding: '8px 14px', borderRadius: 8,
        fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, textAlign: 'center', ...estilos,
      }}
    >
      {children}
    </button>
  );
}

export function Campo({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{hint}</div>}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit',
  color: 'var(--text)', background: 'var(--white)',
};

export function Vacio({ children }: { children: ReactNode }) {
  return <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{children}</div>;
}

export function Aviso({ tono, children }: { tono: 'info' | 'alerta' | 'critico' | 'ok'; children: ReactNode }) {
  const c = {
    info: { bg: '#eef4fb', bd: '#cfe0f3', fg: '#1c4e80' },
    ok: { bg: '#eef7f0', bd: '#cde6d4', fg: '#216b35' },
    alerta: { bg: '#fdf6e8', bd: '#f0dfb8', fg: '#8a6116' },
    critico: { bg: '#fdf0ef', bd: '#f2ccc8', fg: '#b42318' },
  }[tono];
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.bd}`, color: c.fg, borderRadius: 8, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>
      {children}
    </div>
  );
}

// --- tasas -----------------------------------------------------------------

// `null` = el backend no tiene denominador todavía. Se muestra "—", nunca
// "0%": son cosas distintas y confundirlas hace que alguien crea que su
// campaña anduvo pésimo cuando en realidad todavía no salió.
export function formatTasa(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(1)}%`;
}

export type Salud = 'ok' | 'alerta' | 'critico' | 'sin-datos';

// Los umbrales vienen del backend, no están escritos acá: son los mismos que
// usa el motor de envío para decidir si frena una campaña.
export function saludRebotes(v: number | null | undefined, u: EmailUmbrales): Salud {
  if (v === null || v === undefined) return 'sin-datos';
  if (v >= u.rebotes_critico) return 'critico';
  if (v >= u.rebotes_alerta) return 'alerta';
  return 'ok';
}

export function saludQuejas(v: number | null | undefined, u: EmailUmbrales): Salud {
  if (v === null || v === undefined) return 'sin-datos';
  if (v >= u.quejas_critico) return 'critico';
  if (v >= u.quejas_alerta) return 'alerta';
  return 'ok';
}

export function colorSalud(s: Salud): string {
  return { ok: '#216b35', alerta: '#8a6116', critico: '#b42318', 'sin-datos': 'var(--text-muted)' }[s];
}

export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function Tabla({ cols, children }: { cols: { label: string; alinear?: 'left' | 'right' }[]; children: ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {cols.map((c) => (
              <th key={c.label} style={{ textAlign: c.alinear ?? 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const td: React.CSSProperties = { padding: '10px 16px', color: 'var(--text)' };
export const tdMuted: React.CSSProperties = { ...td, color: 'var(--text-muted)' };
export const trStyle: React.CSSProperties = { borderBottom: '1px solid var(--border-soft)' };
