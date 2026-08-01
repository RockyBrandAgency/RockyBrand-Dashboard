// Formas reales devueltas por crm_dashboard_api_lambda.py (Sesion 1) -
// ver /04-codigo/crm_dashboard_api_lambda.py para la fuente de verdad.

export type EstadoSemaforo =
  | 'verde'
  | 'amarillo'
  | 'rojo'
  | 'sin_datos'
  | 'sin_configurar'
  | 'sin_campana_creada'
  | 'sin_campana_enviada'
  | 'sin_channel_manager_conectado';

export interface SemaforoMetric {
  valor: unknown;
  estado: EstadoSemaforo;
  umbral_usado: Record<string, number> | { minimo: number } | null;
  nota?: string;
  campana?: { campaign_id?: string; name?: string };
}

export interface OcupacionMetric extends SemaforoMetric {
  valor: number | null;
}

export interface ReservasNuevasMetric extends SemaforoMetric {
  valor: { cantidad: number; monto_por_moneda: Record<string, number> };
}

export interface LeadsMetric extends SemaforoMetric {
  valor: { cantidad: number };
}

export interface OpenRateMetric extends SemaforoMetric {
  valor: number | null;
}

export interface LlegadasSummaryMetric extends SemaforoMetric {
  valor: { cantidad: number; con_banderas: number };
}

// Reservas con Source == "Directa Web" (el formulario de reservas
// propio del cliente, no un canal externo como Booking.com/Airbnb)
// creadas en los últimos 7 días. Sin semáforo/estado - es un dato
// puramente informativo, no una métrica con umbral.
export interface FormularioReservasMetric {
  cantidad: number;
}

export interface SemaforoResponse {
  client_id: string;
  semaforo: {
    ocupacion_30d: OcupacionMetric;
    reservas_nuevas_7d: ReservasNuevasMetric;
    formulario_reservas_7d: FormularioReservasMetric;
    leads_7d: LeadsMetric;
    open_rate_ultima_campana: OpenRateMetric;
    llegadas_48h: LlegadasSummaryMetric;
    estado_sincronizacion: SemaforoMetric;
  };
}

export interface ArrivalInfo {
  time: string | null;
  transferType: string | null;
  notes: string;
}

export interface LlegadaGuest {
  BookingID: string;
  CheckIn: string;
  GuestID: string;
  FullName: string;
  OriginCountry: string | null;
  ArrivalInfo: ArrivalInfo;
  BookingNotes: string;
  DietaryRestrictions: string[];
  MobilityNotes: string;
  SpecialNotes: string;
  // Sesion 4 (integracion Channex) - valor crudo tal cual esta guardado
  // en el booking (Direct/Booking.com/Airbnb/etc/null). La traduccion a
  // texto humano vive en OriginBadge.tsx, no aca.
  Source: string | null;
}

export interface LlegadasResponse {
  client_id: string;
  llegadas: LlegadaGuest[];
}

export type EstadoCelda = 'ocupado' | 'llegada' | 'salida' | 'libre';

export interface HabitacionDisponibilidad {
  room_id: string;
  estados: EstadoCelda[];
  // Sesion 4 (integracion Channex) - paralelo a estados (mismo indice =
  // mismo dia), valor crudo del Source del booking que ocupa ese dia, o
  // null si esta libre.
  sources: (string | null)[];
}

export interface DisponibilidadResponse {
  client_id: string;
  dias: string[];
  habitaciones: HabitacionDisponibilidad[];
  nota?: string;
}

export type ServiceKey = 'agents' | 'pms' | 'crm' | 'email_marketing';

export type ClientServices = Record<ServiceKey, boolean>;

export interface MeResponse {
  client_id: string;
  display_name: string;
  display_subtitle: string;
  services: ClientServices;
}

export interface ReservaResumenItem {
  BookingID: string;
  RoomID: string;
  CheckIn: string;
  CheckOut: string;
  Status: string;
  Source: string | null;
  GuestName: string;
  TotalAmount: number;
  Currency: string;
  PaymentStatus: string | null;
}

export interface ReservasResumenResponse {
  client_id: string;
  reservas: ReservaResumenItem[];
}

// Formas reales devueltas por dashboard_metrics.compute_metrics_report -
// mismo cálculo que ya usa el panel de staff (get_metrics_report), ver
// panel_config_api_lambda.py:handle_get_metrics_report para la fuente de
// verdad original.
export interface EmailCampaignSummary {
  name: string | null;
  sent_at: string | null;
  enviados: number;
  aperturas: number;
}

export interface EmailMetrics {
  enviados: number;
  aperturas: number;
  clics: number;
  rebotes: number;
  campaigns: EmailCampaignSummary[];
}

export interface SocialSnapshotPoint {
  fecha: string;
  seguidores: number | null;
}

export interface InstagramPost {
  media_id: string;
  fecha: string;
  tipo: string;
  formato: string;
  permalink: string;
  caption: string | null;
  likes: number;
  comentarios: number;
  alcance: number | null;
  impresiones: number | null;
  reproducciones: number | null;
  shares: number | null;
  guardados: number | null;
  interacciones_totales_meta: number | null;
  engagement_rate_sobre_alcance_pct: number | null;
  engagement_rate_sobre_seguidores_pct: number | null;
}

export interface SocialMetrics {
  snapshots: SocialSnapshotPoint[];
  seguidores_actuales: number | null;
  cambio_neto_periodo: number;
  cambio_neto_7d: number;
  engagement_promedio_pct: number | null;
  publicaciones: InstagramPost[];
}

export interface FacebookVisualizacionPoint {
  fecha: string;
  visualizaciones: number | null;
}

export interface FacebookMetrics {
  snapshots: SocialSnapshotPoint[];
  seguidores_actuales: number | null;
  nombre_pagina: string | null;
  visualizaciones_actual: number | null;
  visualizaciones_snapshots: FacebookVisualizacionPoint[];
}

export interface YoutubeSnapshotPoint {
  fecha: string;
  suscriptores: number | null;
}

export interface YoutubeTopVideo {
  titulo?: string;
  vistas?: number;
  watch_time_minutos?: number;
  [key: string]: unknown;
}

export interface YoutubeMetrics {
  snapshots: YoutubeSnapshotPoint[];
  suscriptores_actuales: number | null;
  suscriptores_ganados_periodo: number;
  suscriptores_perdidos_periodo: number;
  suscriptores_netos_7d: number;
  vistas_periodo: number;
  minutos_vistos_periodo: number | null;
  duracion_promedio_vista_seg: number | null;
  fuentes_de_trafico: { fuente?: string; vistas?: number }[];
  top_videos: YoutubeTopVideo[];
}

export interface SeoSnapshotPoint {
  fecha: string;
  keyword: string | null;
  posicion: number | null;
}

export interface SeoKeywordRow {
  keyword: string | null;
  posicion_actual: number | null;
  posicion_anterior: number | null;
  delta: number | null;
  impresiones: number | null;
  periodo: string | null;
  landing_page: string | null;
}

export interface SeoClicksPoint {
  fecha: string;
  clics: number;
}

export interface SeoImpressionsPoint {
  fecha: string;
  impresiones: number;
}

export interface SeoMetrics {
  snapshots: SeoSnapshotPoint[];
  posicion_actual: number | null;
  keyword: string | null;
  keyword_matrix: SeoKeywordRow[];
  clicks_snapshots: SeoClicksPoint[];
  impressions_snapshots: SeoImpressionsPoint[];
  clics_organicos_actual: number | null;
}

export interface MetricsReportResponse {
  client_id: string;
  range: { from: string; to: string; days: number };
  email: EmailMetrics;
  social: SocialMetrics;
  facebook: FacebookMetrics;
  youtube: YoutubeMetrics;
  seo: SeoMetrics;
}
