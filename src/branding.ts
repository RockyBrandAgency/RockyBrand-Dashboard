// Logos reales por cliente (2026-08-01, pedido explícito de Mato) - mismos
// archivos que ya usa 05-panel-web (PROJECT_LOGO en constants.ts), copiados
// acá porque son apps/builds separados. Si un client_id no está acá, no se
// inventa un logo - LoginScreen/Sidebar caen a su fallback ya existente
// (LogoPlaceholder / solo texto).
export const CLIENT_BRANDING: Record<string, { logoSrc: string; logoAlt: string }> = {
  'alto-castillo': { logoSrc: '/logo-alto-castillo.png', logoAlt: 'Alto Castillo Lodge' },
  'chile-fly-fishing': { logoSrc: '/logo-chile-fly-fishing.png', logoAlt: 'Chile Fly Fishing' },
};

// Antes de loguearse no hay ningún dato de identidad todavía (sin sesión,
// sin JWT) - el único indicio real de qué cliente es este es el
// subdominio real (nombredelcliente.panel.rockybrand.cl, ver
// AI_Agency/infra/rockybrand_infra/dashboard_stack.py). En localhost o en
// la URL default de Amplify (sin subdominio propio) no hay forma de saber
// - se devuelve null a propósito, nunca se adivina un cliente.
export function clientIdFromHostname(hostname: string): string | null {
  const parts = hostname.split('.');
  if (parts.length >= 4 && parts[1] === 'panel' && parts[2] === 'rockybrand') {
    return parts[0];
  }
  return null;
}
