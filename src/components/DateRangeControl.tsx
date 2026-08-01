export type DateRangeDays = 7 | 30 | 90;

const PRESETS: { days: DateRangeDays; label: string }[] = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

// Presets, no un date-picker de rango libre: el backend
// (compute_metrics_report) solo acepta un numero de dias hacia atras
// desde hoy, no un rango arbitrario - un selector de fechas prometeria
// precision que la API no tiene.
export function DateRangeControl({ value, onChange }: { value: DateRangeDays; onChange: (days: DateRangeDays) => void }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      {PRESETS.map((p) => {
        const active = value === p.days;
        return (
          <button
            key={p.days}
            onClick={() => onChange(p.days)}
            style={{
              all: 'unset',
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              color: active ? '#fff' : 'var(--text-muted)',
              background: active ? 'var(--primary)' : 'var(--white)',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
