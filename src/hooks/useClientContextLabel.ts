import { useAuth } from '../context/AuthContext';
import { CLIENT_LOCATION } from '../branding';

// "Pucón, Chile · Martes 15 de Octubre" - el mismo texto de contexto que
// ya arman a mano SettingsScreen.tsx/ReservasResumen.tsx/
// RevisionContenido.tsx. Extraído acá porque las 6 pantallas de Métricas
// lo necesitaban también (hallazgo de auditoría 2026-08-04: el prop
// contextLabel de MetricsPageHeader existía pero ningún caller se lo
// pasaba) - null si el cliente no tiene ubicación real configurada en
// CLIENT_LOCATION (branding.ts), nunca un string inventado.
export function useClientContextLabel(): string | null {
  const { clientId } = useAuth();
  const location = clientId ? CLIENT_LOCATION[clientId] : undefined;
  if (!location) return null;
  const fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  return `${location.label}, Chile · ${fechaCap}`;
}
