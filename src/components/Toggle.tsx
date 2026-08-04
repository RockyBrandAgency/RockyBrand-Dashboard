// Interruptor genérico — geometría exacta del spec de Figma (37 — Spec:
// Estados Botones, "Toggles/Switches"). 'sm' (40x20) es el tamaño real que
// usan TANTO la tabla de Automatizaciones COMO la pantalla de
// Configuración (confirmado en el frame real "05 — Configuración",
// 2026-08-03 - el comentario original asumía 'md' ahí a partir de la spec
// sheet abstracta, sin haber mirado todavía el frame real). 'md' (44x24)
// queda disponible para si aparece otro lugar que sí lo use.
//
// Colores: --toggle-on/--toggle-off, NO var(--primary)/var(--text-faint).
// Antes usaba --primary, que sigue el theme de marca de cada cliente real
// (branding.ts) - un cliente con su propio verde/charcoal mostraba el
// switch en SU color en vez del verde fijo del spec (#2D5A3D). Encontrado
// por Mato en vivo, 2026-08-03: "los switch cuando están activos deben
// ser #2D5A3D y cuando están inactivos #E4E4E7". Corregido a los 2 tokens
// fijos (ver index.css) que no dependen del cliente logueado.
export function Toggle({
  on,
  onToggle,
  size = 'md',
  disabled,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  // Nombre accesible del switch (hallazgo de auditoría 2026-08-04:
  // role="switch"+aria-checked estaban bien, pero sin esto un lector de
  // pantalla anuncia "switch, activado" sin decir de qué). Opcional para
  // no romper el único uso que hoy no tiene un texto natural a mano
  // (Automatizaciones.tsx - se le suma en un commit aparte si hace falta).
  label?: string;
}) {
  const w = size === 'sm' ? 40 : 44;
  const h = size === 'sm' ? 20 : 24;
  const knob = size === 'sm' ? 16 : 20;
  const inset = 2;
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      style={{
        all: 'unset',
        width: w,
        height: h,
        borderRadius: h / 2,
        cursor: disabled ? 'default' : 'pointer',
        background: on ? 'var(--toggle-on)' : 'var(--toggle-off)',
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
