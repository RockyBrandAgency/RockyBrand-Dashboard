export function SectionHead({ children, icon }: { children: string; icon?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-6)' }}>
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.005em' }}>{children}</h2>
    </div>
  );
}
