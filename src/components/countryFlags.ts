// La API solo devuelve el nombre del pais (OriginCountry), no un codigo
// ISO - mapa best-effort para paises comunes de los huespedes reales,
// con globo generico de fallback (nunca inventamos un pais que no vino).
const FLAGS: Record<string, string> = {
  'estados unidos': '🇺🇸',
  eeuu: '🇺🇸',
  usa: '🇺🇸',
  alemania: '🇩🇪',
  francia: '🇫🇷',
  méxico: '🇲🇽',
  mexico: '🇲🇽',
  argentina: '🇦🇷',
  chile: '🇨🇱',
  brasil: '🇧🇷',
  españa: '🇪🇸',
  espana: '🇪🇸',
  japón: '🇯🇵',
  japon: '🇯🇵',
  'reino unido': '🇬🇧',
  canadá: '🇨🇦',
  canada: '🇨🇦',
  italia: '🇮🇹',
  portugal: '🇵🇹',
  holanda: '🇳🇱',
  'países bajos': '🇳🇱',
  paises_bajos: '🇳🇱',
};

export function countryFlag(country: string | null | undefined): string {
  if (!country) return '🌍';
  return FLAGS[country.trim().toLowerCase()] ?? '🌍';
}
