import type { ReactNode } from 'react';
import type { EmailUmbrales } from '../../../types';

// Piezas compartidas de Email Marketing en el panel del cliente.
//
// Usan las MISMAS clases que el panel principal (ver el bloque "Email
// Marketing" en index.css): Card, Pill, Tabla, MiniCard, toolbar, segmentos.
// La estructura y los gestos son idénticos en los dos paneles — lo único que
// cambia es el color, porque cada cliente ve su propia marca.
//
// Lo que NO se homologa es la honestidad de los números: una tasa sin
// denominador se muestra "—", nunca "0%". Un 0% se lee como "malísimo"
// cuando en realidad es "todavía no se sabe".

export function Card({ title, right, children, pad = true }: {
  title?: string; right?: ReactNode; children: ReactNode; pad?: boolean;
}) {
  return (
    <div className="crm-card">
      {title && (
        <div className="crm-card-head">
          <div className="crm-card-title">{title}</div>
          {right}
        </div>
      )}
      <div className={pad ? 'crm-card-pad' : undefined}>{children}</div>
    </div>
  );
}

export function Boton({ children, onClick, tipo = 'ghost', disabled, sm }: {
  children: ReactNode; onClick?: () => void; tipo?: 'ghost' | 'primary' | 'danger'; disabled?: boolean; sm?: boolean;
}) {
  return (
    <button
      type="button"
      className={`crm-btn crm-btn-${tipo}${sm ? ' crm-btn-sm' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function Campo({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="crm-field">
      <span className="crm-field-label">{label}</span>
      {children}
      {hint && <span className="crm-hint">{hint}</span>}
    </label>
  );
}

export function Aviso({ tono, children }: { tono: 'info' | 'ok' | 'alerta' | 'critico'; children: ReactNode }) {
  return <div className={`crm-aviso ${tono}`}>{children}</div>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="crm-empty">{children}</div>;
}

export function Pill({ estado, children }: { estado: string; children: ReactNode }) {
  return (
    <span className={`crm-pill ${estado}`}>
      <span className="crm-pill-dot" />
      {children}
    </span>
  );
}

export function MiniDash({ items }: { items: { label: string; value: ReactNode; sub?: string; tono?: 'ok' | 'alerta' | 'critico' }[] }) {
  return (
    <div className="crm-mini-dash">
      {items.map((k) => (
        <div className="crm-mini-card" key={k.label}>
          <div className="crm-mini-label">{k.label}</div>
          <div className={`crm-mini-value${k.tono ? ' ' + k.tono : ''}`}>{k.value}</div>
          {k.sub && <div className="crm-mini-sub">{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function Tabla({ cols, children }: { cols: { label: string; num?: boolean }[]; children: ReactNode }) {
  return (
    <div className="crm-table-wrap">
      <table className="crm-table">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={`${c.label}-${i}`} className={c.num ? 'num' : undefined}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// --- números ---------------------------------------------------------------

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

export function tonoDe(s: Salud): 'ok' | 'alerta' | 'critico' | undefined {
  return s === 'sin-datos' ? undefined : s;
}

// El backend escribe todas sus fechas con `datetime.utcnow().isoformat()`, o
// sea SIN zona: "2026-08-12T16:03:28.073686". `new Date()` interpreta un ISO
// con hora y sin zona como hora LOCAL, así que en Chile (UTC-4) ese envío se
// leía cuatro horas antes de cuando ocurrió. No fallaba, no avisaba: mostraba
// una hora equivocada con total confianza. Acá se le agrega la Z que le falta.
//
// Una fecha SIN hora ("2026-08-14") es el caso contrario: el estándar la
// interpreta como medianoche UTC, que en Chile cae el día anterior a las 20:00
// y se muestra corrida un día. Por eso esa se parsea explícitamente como local.
function parseFecha(iso: string): Date | null {
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.exec(iso);
  if (soloFecha) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
  }
  const tieneZona = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const d = new Date(tieneZona ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = parseFecha(iso);
  if (!d) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Con hora y minuto. En el detalle de una campaña el día no alcanza: todos los
// destinatarios comparten el mismo, y lo que se quiere leer es cuánto tardó
// cada persona en abrir o clickear.
export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = parseFecha(iso);
  if (!d) return iso;
  return d.toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Mismas etiquetas que crmUtils.ts en el panel principal. Se repiten porque
// son dos apps distintas, pero tienen que decir lo mismo: si un panel dice
// "Sin confirmar" y el otro "pending", son la misma persona leyendo dos
// cosas distintas sobre el mismo contacto.
export function estadoContacto(status: string): string {
  return ({
    subscribed: 'Suscrito',
    pending: 'Sin confirmar',
    unsubscribed: 'No suscrito',
    bounced: 'Rebotado',
    complained: 'Marcó spam',
  } as Record<string, string>)[status] || status;
}

export function estadoCampana(status: string): string {
  return ({
    sent: 'Enviada',
    sending: 'Enviando',
    draft: 'Borrador',
    scheduled: 'Programada',
    failed: 'Falló',
    paused: 'Pausada',
    // La frena el cortacircuito del motor de envío cuando la tasa de rebote
    // pasa el umbral. No es "Falló": salió bien, se decidió no seguir.
    detenida_por_rebotes: 'Detenida por rebotes',
  } as Record<string, string>)[status] || status;
}
