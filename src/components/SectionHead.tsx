// `count` = badge tipo pill con el conteo real (Figma frame 3, "03 —
// Llegadas Detalle": "Requieren atención" trae un badge ambar "2 alertas"
// junto al título) - opcional para no afectar los otros 2 usos existentes
// (Overview, MetricasResumen) que no llevan badge.
export function SectionHead({
  children,
  icon,
  count,
}: {
  children: string;
  icon?: string;
  count?: { label: string; tone: 'atencion' | 'bien' };
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-6)' }}>
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.005em' }}>{children}</h2>
      {count && (
        <span
          style={{
            background: `var(--status-${count.tone}-bg)`,
            color: `var(--status-${count.tone}-dot)`,
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {count.label}
        </span>
      )}
    </div>
  );
}
