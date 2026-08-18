import type { ReactNode } from 'react';

// Patrón real de Figma ("illustrated-empty-state", frames 29-33): círculo
// de ícono 72px sobre --primary al 8%, título 16px/600, descripción
// 13px/1.5, botón primario opcional. Reusado en vez de copiado por
// pantalla, para que las 5 apariciones queden consistentes.
//
// A diferencia del mockup, acá NUNCA se ofrece un botón que implique una
// acción de self-service que no existe en el backend real (ej. "Conectar
// PMS" - la integración la hace el equipo RockyBrand, no un flujo desde
// el panel). El CTA solo se pasa cuando la acción es genuinamente real
// (ej. "Crear primera campaña", que sí dispara el flujo real de Nueva
// Campaña).
export function EmptyStateIllustrated({
  icon,
  title,
  description,
  cta,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  cta?: { label: string; onClick: () => void };
}) {
  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary)',
        }}
      >
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>{description}</div>
      </div>
      {cta && (
        <button className="crm-btn crm-btn-primary" onClick={cta.onClick}>
          {cta.label}
        </button>
      )}
    </div>
  );
}
