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
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        padding: 4,
        flexShrink: 0,
      }}
    >
      {PRESETS.map((p) => {
        const active = value === p.days;
        return (
          <button
            key={p.days}
            onClick={() => onChange(p.days)}
            aria-pressed={active}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--text)' : 'var(--text-sub)',
              background: active ? 'var(--white)' : 'transparent',
              boxShadow: active ? '0 1px 1px rgba(0,0,0,0.04)' : 'none',
              cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
