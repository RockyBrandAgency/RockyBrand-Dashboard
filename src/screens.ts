import type { ServiceKey } from './types';

// Estructura de navegación 2026-08-01, pedido explícito de Mato: "Estado
// actual" es un resumen ejecutivo (sin métricas de marketing) y aparte hay
// 2 secciones con sub-páginas propias (Reservas, Métricas). "detail"
// (llegadas 48h con el detalle completo por huésped) deja de ser un item
// de nav propio - sigue existiendo como drill-down ("Ver detalle") desde
// Estado Actual, no se pierde contenido, solo deja de competir por un
// lugar en el sidebar.
export type Screen =
  | 'estado-actual'
  | 'llegadas-detalle'
  | 'reservas-resumen'
  | 'metricas-resumen'
  | 'metricas-meta'
  | 'metricas-google'
  | 'settings'
  | 'login';

export const SIDEBAR_W = 220;

// serviceKeys: de qué servicio(s) de rockybrand-client-config depende ver
// este item - visible si CUALQUIERA de los servicios listados está
// contratado (mismo criterio "OR" que ya usa el backend para el
// semáforo, que mezcla datos de pms y de email_marketing). Un cliente sin
// ninguno de los servicios listados no ve el item - pedido explícito de
// Mato: "si le asigno Email Marketing, PMS, CRM o Agentes, le debe
// aparecer disponible", controlado desde el Panel Global.
export interface NavLeaf {
  id: Screen;
  label: string;
  shortLabel: string;
  serviceKeys: ServiceKey[];
}

export const ESTADO_ACTUAL: NavLeaf = {
  id: 'estado-actual',
  label: 'Estado Actual',
  shortLabel: 'Estado',
  serviceKeys: ['pms'],
};

export interface NavSection {
  label: string;
  icon: string;
  items: NavLeaf[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Reservas',
    icon: '📋',
    items: [{ id: 'reservas-resumen', label: 'Resumen', shortLabel: 'Reservas', serviceKeys: ['pms'] }],
  },
  {
    label: 'Métricas',
    icon: '📊',
    items: [
      // "Resumen" combina Email Marketing + canales que gestionan los
      // Agentes de IA (redes/SEO) - visible con cualquiera de los 2, cada
      // bloque interno de la página se muestra u oculta aparte según el
      // servicio real (ver MetricasResumen.tsx).
      { id: 'metricas-resumen', label: 'Resumen', shortLabel: 'Métricas', serviceKeys: ['email_marketing', 'agents'] },
      { id: 'metricas-meta', label: 'META', shortLabel: 'META', serviceKeys: ['agents'] },
      { id: 'metricas-google', label: 'Google', shortLabel: 'Google', serviceKeys: ['agents'] },
    ],
  },
];
