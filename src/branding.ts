// Logos reales por cliente (2026-08-01, pedido explícito de Mato) - mismos
// archivos que ya usa 05-panel-web (PROJECT_LOGO en constants.ts), copiados
// acá porque son apps/builds separados. Si un client_id no está acá, no se
// inventa un logo - LoginScreen/Sidebar caen a su fallback ya existente
// (LogoPlaceholder / solo texto).
export const CLIENT_BRANDING: Record<string, { logoSrc: string; logoAlt: string }> = {
  'alto-castillo': { logoSrc: '/logo-alto-castillo.png', logoAlt: 'Alto Castillo Lodge' },
  'chile-fly-fishing': { logoSrc: '/logo-chile-fly-fishing.png', logoAlt: 'Chile Fly Fishing' },
};

// Regla permanente (2026-08-01, pedido explícito de Mato): todo panel de
// cliente, actual o futuro, usa SUS colores oficiales de manual de marca -
// nunca un color inventado ni el de otro cliente. Hasta este cambio,
// index.css tenía hardcodeado el Verde Bosque de Alto Castillo como único
// `--primary` de toda la app (comentario propio del archivo: "Paleta real
// portada desde el Figma Make... Verde Bosque / Verde Salvia") - Chile Fly
// Fishing heredaba ese verde por error, nunca tuvo su propio color.
//
// Hex exactos, con su fuente real (nunca inventados):
// - alto-castillo: clientes/alto-castillo/01-knowledge-base/brand-guidelines-extracto.md
//   (Figma "Brand Guidelines v1.0 2025") - Verde Bosque #425327 / Verde Salvia #BCC2B3.
//   Mismos valores ya portados 1:1 en el sitio real (alto-castillo-lodge/src/styles/tokens.css).
// - chile-fly-fishing: clientes/chile-fly-fishing/01-knowledge-base/brand-guidelines-extracto.md
//   (PDF oficial) - Corporate Blue #006DC6 / Luxury Gold #7B541C, confirmados por conteo de
//   uso real en los 22 templates de email (templates-v2/*.html).
//   `sage`/`sageMid` no tienen un equivalente literal en su guideline (esas 2 claves son un
//   rol de UI - texto muted sobre el fondo primario -, no un color de marca en sí) - se
//   derivaron de Luxury Gold (mismo matiz, luminosidad/saturación de las claves sage de Alto
//   Castillo) en vez de inventar un gris o un azul fuera de paleta.
export interface ClientTheme {
  primary: string;
  primaryHover: string;
  sage: string;
  sageMid: string;
}

export const CLIENT_THEME: Record<string, ClientTheme> = {
  'alto-castillo': { primary: '#425327', primaryHover: '#344219', sage: '#bcc2b3', sageMid: '#a8b09a' },
  'chile-fly-fishing': { primary: '#006dc6', primaryHover: '#005194', sage: '#c2bcb3', sageMid: '#b0a79a' },
};

// Aplica el theme del cliente sobre las custom properties de :root. Sin
// client_id conocido, restaura los defaults neutros de RockyBrand
// (index.css) - nunca se deja "pegado" el color de un cliente anterior ni
// se cae de vuelta al verde de Alto Castillo como default silencioso (esa
// era exactamente la falla que este cambio corrige).
export function applyClientTheme(clientId: string | null): void {
  const root = document.documentElement.style;
  const theme = clientId ? CLIENT_THEME[clientId] : null;
  if (!theme) {
    root.removeProperty('--primary');
    root.removeProperty('--primary-hov');
    root.removeProperty('--sage');
    root.removeProperty('--sage-mid');
    return;
  }
  root.setProperty('--primary', theme.primary);
  root.setProperty('--primary-hov', theme.primaryHover);
  root.setProperty('--sage', theme.sage);
  root.setProperty('--sage-mid', theme.sageMid);
}

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
