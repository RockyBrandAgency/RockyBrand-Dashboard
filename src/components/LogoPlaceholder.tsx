export function LogoPlaceholder({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'lg' ? 72 : size === 'sm' ? 32 : 48;
  const w = h * 2.6;
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 8,
        border: '1.5px dashed rgba(255,255,255,0.35)',
        background: 'rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <div
        style={{
          fontSize: size === 'lg' ? 13 : size === 'sm' ? 9 : 11,
          fontWeight: 800,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        LOGO
      </div>
      <div style={{ fontSize: size === 'lg' ? 9 : 8, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.08em' }}>
        {size === 'lg' ? '188 × 72 px recomendado' : 'placeholder'}
      </div>
    </div>
  );
}
