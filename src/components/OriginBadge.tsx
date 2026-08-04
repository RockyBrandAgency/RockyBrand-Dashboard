// Sesion 4 (integracion Channex) - badge de origen de una reserva. Mismo
// patron de tabla de lookup que status.ts/RoomGrid.tsx (CELL): el valor
// crudo de Source se traduce a texto humano aca, nunca en el backend.
// Sin convencion de color por OTA todavia (no existe en status.ts) - un
// solo estilo "reconocido" para cualquier canal real, y un estilo
// distinto, deliberadamente menos prominente, para "Origen no
// registrado" (nunca se muestra "Directa" por default si no hay dato).

const ORIGIN_LABEL: Record<string, string> = {
  Direct: 'Directa',
  OTA_Headless: 'OTA',
  'Booking.com': 'Booking.com',
  Airbnb: 'Airbnb',
  Expedia: 'Expedia',
  VRBO: 'VRBO',
  'Booking CRS': 'Booking CRS',
};

export function originLabel(source: string | null | undefined): string {
  if (!source) return 'Origen no registrado';
  return ORIGIN_LABEL[source] ?? source;
}

// Color por canal (Figma frame "19 — Reservas Resumen") - solo los 2
// canales que el frame real mostraba con color propio (Booking.com,
// Directo). El resto de los canales reconocidos (Airbnb/Expedia/VRBO/
// OTA_Headless/Booking CRS) sigue con el estilo neutro de siempre - no se
// inventa un color que el Figma nunca especificó para ellos.
const ORIGIN_COLOR: Partial<Record<string, { bg: string; text: string }>> = {
  'Booking.com': { bg: '#e0e7ff', text: '#4338ca' },
  Direct: { bg: '#e0f2fe', text: '#0369a1' },
  Airbnb: { bg: '#ffedd5', text: '#c2410c' },
};

export function OriginBadge({ source }: { source: string | null | undefined }) {
  const label = originLabel(source);
  const known = Boolean(source && ORIGIN_LABEL[source]);
  const color = source ? ORIGIN_COLOR[source] : undefined;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: 20,
        background: color ? color.bg : known ? 'var(--status-neutro-bg)' : 'transparent',
        color: color ? color.text : known ? 'var(--status-neutro-text)' : 'var(--text-muted)',
        border: !color && !known ? '1px solid var(--status-neutro-dot)' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
