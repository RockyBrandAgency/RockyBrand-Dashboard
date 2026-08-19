import type { ClientServices, ServiceKey } from './types';

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
  | 'servicio-pms-resumen'
  | 'servicio-pms-reservas'
  | 'servicio-pms-huespedes'
  | 'servicio-pms-itinerarios'
  | 'servicio-pms-housekeeping'
  | 'servicio-email-campanas'
  | 'servicio-contenido-revision'
  | 'tienda-inventario'
  | 'tienda-ventas'
  | 'tienda-garantias'
  | 'agencias-lista'
  | 'agencias-reporte'
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
  // Solo para clientes CON habitaciones (pms_room_views). Housekeeping es
  // el primer item con esta condición: un cliente que vende programas
  // guiados y no alojamiento (Chile Fly Fishing) no tiene habitaciones
  // que limpiar. Mismo gate que ya usa /dashboard/disponibilidad.
  requiereHabitaciones?: boolean;
}

// Visible si CUALQUIERA de los servicios del item está contratado.
// clientServices null (cargando) -> visible, criterio "nunca esconder por
// un falso negativo" de todo el panel; pmsRoomViews es true mientras
// carga por el mismo motivo.
//
// Vivía copiada en App/Sidebar/SidebarRail/MobileBar (4 copias idénticas);
// se centralizó acá al sumar requiereHabitaciones, para que una condición
// nueva no haya que acordarse de replicarla en los 4 lados.
export function isNavLeafVisible(
  item: { serviceKeys: ServiceKey[]; requiereHabitaciones?: boolean },
  clientServices: ClientServices | null,
  pmsRoomViews = true,
): boolean {
  if (item.requiereHabitaciones && !pmsRoomViews) return false;
  return !clientServices || item.serviceKeys.some((key) => clientServices[key]);
}

export const OVERVIEW: NavLeaf = {
  id: 'overview',
  label: 'Overview',
  shortLabel: 'Overview',
  serviceKeys: ['pms'],
};

// Gate de TODAS las pantallas de Métricas (resumen y canales), en un solo
// lugar para que el sidebar y el bloque de canales de MetricasResumen no
// se separen nunca.
//
// Es EXACTAMENTE el gate que el backend ya aplica a /dashboard/metrics-report
// (crm_dashboard_api_lambda.py, "Ni Email Marketing ni Agentes de IA..."):
// email_marketing O agents. Hasta el 2026-08-19 los 5 canales individuales
// pedían solo 'agents', más estricto que el endpoint que los alimenta, con
// una consecuencia real: Alto Castillo quedó con services.agents=false al
// cerrarse el 17-ago-2026 pero con las métricas de RRSS/SEO/sitio vivas a
// propósito (las credenciales de Meta y Search Console siguen en SSM), y aún
// así el panel se las escondía. 'agents' no puede prenderse para destrabarlo:
// ese mismo flag es el freno de costo de los 7 Lambdas de agentes.
//
// Un cliente sin la fuente de datos de un canal no ve un número inventado:
// la página muestra "—" o "No Conectado", que es la respuesta honesta.
export const METRICS_SERVICE_KEYS: ServiceKey[] = ['email_marketing', 'agents'];

export interface NavSection {
  label: string;
  icon: string;
  items: NavLeaf[];
}

export const NAV_SECTIONS: NavSection[] = [
  // PMS con varios accesos (2026-08-11, pedido explícito de Mato: "el PMS
  // en el panel de cada cliente debe ser un servicio con varios accesos:
  // Calendario de Reservas, Huespedes (para alto castillo), Pescadores
  // para ChileFlyFishing"). Sube de una entrada suelta en "Servicios
  // Contratados" a una sección propia con sus dos pantallas — mismo
  // camino que ya había recorrido Tienda, y por eso mismo sale de
  // SERVICE_ENTRY_SCREEN/SERVICE_ORDER: listarlo en los dos lados dejaba
  // un "PMS" duplicado en el sidebar (pasó de verdad con Tienda, ver el
  // comentario de SERVICE_ORDER en Sidebar.tsx).
  //
  // El label del segundo item lo resuelve labelNav() (lib/terminologiaPms.ts)
  // según el cliente logueado; el de acá es el default.
  {
    label: 'PMS',
    icon: '🛎️',
    items: [
      { id: 'servicio-pms-resumen', label: 'Resumen', shortLabel: 'Resumen', serviceKeys: ['pms'] },
      { id: 'servicio-pms-reservas', label: 'Calendario de Reservas', shortLabel: 'Reservas', serviceKeys: ['pms'] },
      { id: 'servicio-pms-huespedes', label: 'Huéspedes', shortLabel: 'Huéspedes', serviceKeys: ['pms'] },
      // Itinerarios (2026-08-17, pedido explícito de Mato): el plan y la
      // bitácora de cada día de una expedición. Va DESPUÉS de personas y
      // antes de Housekeeping: se llega desde una reserva, no desde el
      // calendario. Sin `requiereHabitaciones` - un lodge con habitaciones
      // también hace salidas guiadas, y quien no las haga simplemente no
      // carga nada (la pantalla se explica sola con su estado vacío).
      { id: 'servicio-pms-itinerarios', label: 'Itinerarios', shortLabel: 'Itinerarios', serviceKeys: ['pms'] },
      { id: 'servicio-pms-housekeeping', label: 'Housekeeping', shortLabel: 'Aseo', serviceKeys: ['pms'], requiereHabitaciones: true },
    ],
  },
  {
    label: 'Tienda',
    icon: '📦',
    items: [
      { id: 'tienda-inventario', label: 'Inventario', shortLabel: 'Inventario', serviceKeys: ['store'] },
      { id: 'tienda-ventas', label: 'Ventas', shortLabel: 'Ventas', serviceKeys: ['store'] },
      { id: 'tienda-garantias', label: 'Garantías', shortLabel: 'Garantías', serviceKeys: ['store'] },
    ],
  },
  // Agencias (2026-08-12). Portal B2B: agencias de viaje con tarifa
  // negociada propia, usuario y clave, y un reporte de cuánto produce
  // cada una. Sección propia y no un item dentro de PMS: el precio de
  // agencia es un acuerdo comercial, no una función del calendario.
  //
  // serviceKeys 'agencias' con default FALSE en el backend: un lodge que
  // no vende por agencias no ve esta sección.
  {
    label: 'Agencias',
    icon: '🤝',
    items: [
      { id: 'agencias-lista', label: 'Agencias y tarifas', shortLabel: 'Agencias', serviceKeys: ['agencias'] },
      { id: 'agencias-reporte', label: 'Producción', shortLabel: 'Producción', serviceKeys: ['agencias'] },
    ],
  },
  {
    label: 'Métricas',
    icon: '📊',
    items: [
      // Todas las páginas de Métricas usan METRICS_SERVICE_KEYS: el mismo
      // criterio "OR" que el backend ya aplica en /dashboard/metrics-report.
      // Los canales individuales pedían solo 'agents' hasta el 2026-08-19 -
      // ver el comentario de METRICS_SERVICE_KEYS por qué dejó de ser cierto.
      { id: 'metricas-resumen', label: 'Resumen', shortLabel: 'Métricas', serviceKeys: METRICS_SERVICE_KEYS },
      { id: 'metricas-facebook', label: 'Facebook', shortLabel: 'Facebook', serviceKeys: METRICS_SERVICE_KEYS },
      { id: 'metricas-instagram', label: 'Instagram', shortLabel: 'Instagram', serviceKeys: METRICS_SERVICE_KEYS },
      { id: 'metricas-youtube', label: 'Youtube', shortLabel: 'Youtube', serviceKeys: METRICS_SERVICE_KEYS },
      { id: 'metricas-seo', label: 'SEO', shortLabel: 'SEO', serviceKeys: METRICS_SERVICE_KEYS },
      { id: 'metricas-tiktok', label: 'TikTok', shortLabel: 'TikTok', serviceKeys: METRICS_SERVICE_KEYS },
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
  // 'pms' ya no está acá: pasó a ser una sección propia de NAV_SECTIONS
  // con dos accesos (ver arriba), igual que Tienda. Dejarlo también acá
  // duplicaba la entrada en el sidebar.
  email_marketing: 'servicio-email-campanas',
  // Aprobación de contenido de redes (2026-08-03). Entra como servicio
  // propio y no dentro de "Agentes de IA": es una capacidad que se
  // contrata aparte, y su gate en el backend es services.content_approval.
  content_approval: 'servicio-contenido-revision',
};
