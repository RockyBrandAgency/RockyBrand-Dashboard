import { Toggle } from './Toggle';

// Fila de notificación de Configuración (Figma frame "05 — Configuración",
// node 4:658 y hermanos) - sin borde entre filas, el espaciado lo da el
// gap:16px del contenedor (SettingsScreen.tsx), no un padding+border-bottom
// por fila. El toggle es 'sm' (40x20): la pantalla real de Configuración
// usa la MISMA geometría que la tabla de Automatizaciones, no la de 44x24
// que asumía un comentario viejo basado solo en la spec sheet abstracta.
export function ToggleRow({ label, sub, on, toggle }: { label: string; sub?: string; on: boolean; toggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>{sub}</div>}
      </div>
      <Toggle on={on} onToggle={toggle} size="sm" label={label} />
    </div>
  );
}
