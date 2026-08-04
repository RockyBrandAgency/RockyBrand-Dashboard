// Interruptor genérico — geometría exacta del spec de Figma (37 — Spec:
// Estados Botones, "Toggles/Switches"; y la tabla de Automatizaciones).
// 'sm' = fila de tabla (40x20), 'md' = pantalla de Configuración (44x24).
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
