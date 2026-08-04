// Interruptor genérico — geometría exacta del spec de Figma (37 — Spec:
// Estados Botones, "Toggles/Switches"). 'sm' (40x20) es el tamaño real que
// usan TANTO la tabla de Automatizaciones COMO la pantalla de
// Configuración (confirmado en el frame real "05 — Configuración",
// 2026-08-03 - el comentario original asumía 'md' ahí a partir de la spec
// sheet abstracta, sin haber mirado todavía el frame real). 'md' (44x24)
// queda disponible para si aparece otro lugar que sí lo use.
export function Toggle({ on, onToggle, size = 'md', disabled }: { on: boolean; onToggle: () => void; size?: 'sm' | 'md'; disabled?: boolean }) {
  const w = size === 'sm' ? 40 : 44;
  const h = size === 'sm' ? 20 : 24;
  const knob = size === 'sm' ? 16 : 20;
  const inset = 2;
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      disabled={disabled}
      style={{
        all: 'unset',
        width: w,
        height: h,
        borderRadius: h / 2,
        cursor: disabled ? 'default' : 'pointer',
        background: on ? 'var(--primary)' : 'var(--text-faint)',
        position: 'relative',
        transition: 'background 0.18s',
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: inset,
          left: on ? w - knob - inset : inset,
          width: knob,
          height: knob,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.18s',
        }}
      />
    </button>
  );
}
