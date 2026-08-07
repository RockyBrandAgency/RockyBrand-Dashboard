import type { ServiceKey } from './types';

// Estructura de navegación 2026-08-01, pedido explícito de Mato (2 rondas
// de mensajes, sintetizadas acá):
// - "Overview" (antes "Estado Actual", mismo contenido - resumen
//   ejecutivo operativo, sin métricas de marketing).
// - "Métricas": Resumen general + una página de detalle real por canal
//   (Facebook/Instagram/YouTube/SEO/TikTok) con gráficos.
// - "Servicios Contratados": lista de los servicios reales del cliente,
//   navegable - cada servicio con una página propia entra ahí (PMS →
//   Reservas, Email Marketing → Campañas). Los que todavía no tienen
//   contenido propio real (CRM, Agentes de IA) se listan pero no son
//   clickeables - no se inventa una página vacía.
export type Screen =
  | 'overview'
  | 'llegadas-detalle'
  | 'metricas-resumen'
  | 'metricas-facebook'
  | 'metricas-instagram'
  | 'metricas-youtube'
  | 'metricas-seo'
  | 'metricas-tiktok'
  | 'servicio-pms-reservas'
  | 'servicio-email-campanas'
  | 'servicio-contenido-revision'
  | 'tienda-inventario'
  | 'tienda-ventas'
  | 'tienda-garantias'
  | 'settings'
  | 'login';

export const SIDEBAR_W = 280;

// serviceKeys: de qué servicio(s) depende ver este item - visible si
// CUALQUIERA de los listados está contratado (mismo criterio "OR" que ya
// usa el backend, ej. el semáforo mezclando pms/email_marketing).
export interface NavLeaf {
  id: Screen;
  label: string;
  shortLabel: string;
  serviceKeys: ServiceKey[];
}

export const OVERVIEW: NavLeaf = {
  id: 'overview',
  label: 'Overview',
  shortLabel: 'Overview',
  serviceKeys: ['pms'],
};

export interface NavSection {
  label: string;
  icon: string;
  items: NavLeaf[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Tienda',
    icon: '📦',
    items: [
      { id: 'tienda-inventario', label: 'Inventario', shortLabel: 'Inventario', serviceKeys: ['store'] },
      { id: 'tienda-ventas', label: 'Ventas', shortLabel: 'Ventas', serviceKeys: ['store'] },
      { id: 'tienda-garantias', label: 'Garantías', shortLabel: 'Garantías', serviceKeys: ['store'] },
    ],
  },
  {
    label: 'Métricas',
    icon: '📊',
    items: [
      // "Resumen" combina Email Marketing + lo que gestionan los Agentes
      // de IA (redes/SEO) - visible con cualquiera de los 2. Los canales
      // individuales son todos del lado de Agentes de IA (son ellos
      // quienes gestionan redes/SEO), TikTok incluido aunque hoy sea un
      // stub honesto (sin fuente de datos conectada todavía).
      { id: 'metricas-resumen', label: 'Resumen', shortLabel: 'Métricas', serviceKeys: ['email_marketing', 'agents'] },
      { id: 'metricas-facebook', label: 'Facebook', shortLabel: 'Facebook', serviceKeys: ['agents'] },
      { id: 'metricas-instagram', label: 'Instagram', shortLabel: 'Instagram', serviceKeys: ['agents'] },
      { id: 'metricas-youtube', label: 'Youtube', shortLabel: 'Youtube', serviceKeys: ['agents'] },
      { id: 'metricas-seo', label: 'SEO', shortLabel: 'SEO', serviceKeys: ['agents'] },
      { id: 'metricas-tiktok', label: 'TikTok', shortLabel: 'TikTok', serviceKeys: ['agents'] },
    ],
  },
];

// Servicios Contratados: a diferencia de NAV_SECTIONS (donde cada item
// tiene su propia página garantizada), acá cada ServiceKey real puede o
// no tener una página propia todavía - SERVICE_ENTRY_SCREEN solo cubre
// los que sí (PMS, Email Marketing). CRM y Agentes de IA se listan en el
// sidebar (informativo, ya contratado) pero sin entrar a ningún lado -
// no existe contenido propio real para ellos todavía, no se inventa uno.
export const SERVICE_ENTRY_SCREEN: Partial<Record<ServiceKey, Screen>> = {
  pms: 'servicio-pms-reservas',
  email_marketing: 'servicio-email-campanas',
  // Aprobación de contenido de redes (2026-08-03). Entra como servicio
  // propio y no dentro de "Agentes de IA": es una capacidad que se
  // contrata aparte, y su gate en el backend es services.content_approval.
  content_approval: 'servicio-contenido-revision',
};
