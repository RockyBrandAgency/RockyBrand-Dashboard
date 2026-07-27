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

export function OriginBadge({ source }: { source: string | null | undefined }) {
  const label = originLabel(source);
  const known = Boolean(source && ORIGIN_LABEL[source]);
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: 20,
        background: known ? 'var(--status-neutro-bg)' : 'transparent',
        color: known ? 'var(--status-neutro-text)' : 'var(--text-muted)',
        border: known ? 'none' : '1px solid var(--status-neutro-dot)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
