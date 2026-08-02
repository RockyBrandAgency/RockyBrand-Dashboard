// Estado honesto para una métrica pedida que Meta no nos da con los
// permisos actuales - confirmado en vivo contra la API real
// (2026-08-01), nunca un cero ni un valor sustituto. REGLA MÁXIMA de
// Mato: si un dato no viene de la API real, se muestra el estado
// honesto explícito.
export function MetricNotAvailable({ label, reason }: { label: string; reason: string }) {
  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px dashed var(--border)',
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sub)' }}>No disponible</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{reason}</span>
    </div>
  );
}
