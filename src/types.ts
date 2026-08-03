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

export interface EmailContact {
  client_id: string;
  email: string;
  name?: string;
  tags?: string[];
  status: string;
  created_at?: string;
}

export interface EmailSegment {
  type: 'all' | 'tag';
  value?: string;
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
  imagen_url: string | null;
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
  // 4 campos nuevos (2026-08-01) - confirmados en vivo contra la API real
  // de Meta antes de agregarlos. Ventana fija de 30 días (así los expone
  // Meta), no respetan el selector de rango de la página.
  alcance_no_seguidores_pct: number | null;
  clics_enlace_perfil_30d: number | null;
  guardados_totales: number | null;
  guardados_promedio: number | null;
  compartidos_totales: number | null;
  // Publicación destacada del período (2026-08-02, pedido explícito de
  // Mato) - la de mayor alcance real, con la variación real de
  // seguidores del mismo día. null si ninguna publicación del rango
  // tiene dato de alcance.
  insight_post: InstagramInsightPost | null;
}

export interface InstagramInsightPost {
  media_id: string;
  fecha: string;
  permalink: string;
  formato: string;
  alcance: number;
  shares: number | null;
  guardados: number | null;
  seguidores_netos_ese_dia: number | null;
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
  // Meta deprecó el delta directo de seguidores de Página - se calcula
  // con nuestro propio historial diario (ver dashboard_metrics.py).
  cambio_neto_7d: number | null;
  cambio_neto_30d: number | null;
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

// --- Email Marketing: las 6 secciones (2026-08-03) -------------------------
//
// Las tasas son `number | null`, no `number`. El backend devuelve null cuando
// no hay denominador, y esa distincion es el punto: un 0% con denominador 0
// se lee como "malisimo" cuando en realidad es "todavia no se sabe".
export interface SubjectCheck {
  largo: number;
  estado: 'vacio' | 'corto' | 'optimo' | 'largo' | 'problema';
  avisos: string[];
  optimo: [number, number];
  visible_movil?: number;
}

export interface EmailAudiencia {
  total: number;
  activos_marketing: number;
  por_estado: Record<string, number>;
  etiquetas: { tag: string; contactos: number }[];
  pendientes_confirmacion: number;
}

export interface EmailCampaignStats {
  campaign_id: string;
  name: string;
  subject: string;
  sent_at: string;
  enviados: number;
  open_rate: number | null;
  click_rate: number | null;
  bounce_rate: number | null;
  complaint_rate: number | null;
}

export interface EmailUmbrales {
  quejas_alerta: number;
  quejas_critico: number;
  rebotes_alerta: number;
  rebotes_critico: number;
}

export interface EmailResumen {
  audiencia: EmailAudiencia;
  campanas_enviadas: number;
  open_rate: number | null;
  click_rate: number | null;
  bounce_rate: number | null;
  complaint_rate: number | null;
  umbrales: EmailUmbrales;
  ultimas: EmailCampaignStats[];
}

export interface EmailCampaign {
  campaign_id: string;
  name: string;
  subject: string;
  html_body: string;
  template_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  sent_at: string;
  segment?: EmailSegment;
  consent_type?: string;
  stats?: Record<string, number>;
}

export interface EmailTemplate {
  template_id: string;
  name: string;
  html_body?: string;
  updated_at: string;
  tiene_unsubscribe: boolean;
}

export interface EmailMetrics {
  campanas_enviadas: number;
  totales: { enviados: number; aperturas: number; clics: number; rebotes: number; quejas: number };
  open_rate: number | null;
  click_rate: number | null;
  bounce_rate: number | null;
  complaint_rate: number | null;
  umbrales: EmailUmbrales;
  por_campana: EmailCampaignStats[];
}

// `suficiente: false` NO trae mejor_hora. La ausencia del campo es
// deliberada del backend: recomendar un horario con 9 aperturas seria
// inventar. La pantalla tiene que mostrar la nota, no un horario.
export interface EmailInsights {
  horario: {
    aperturas_analizadas: number;
    minimo_necesario: number;
    suficiente: boolean;
    nota?: string;
    por_hora: { hora: number; aperturas: number }[];
    mejor_hora?: number;
    mejor_dia?: string;
  };
  asunto_guia: { min: number; optimo_max: number; visible_movil: number; max_duro: number };
}

export interface EmailJourneyStep {
  step_id: string;
  tipo: string;
  template: string | null;
  subject: string | null;
  delay_horas: number | null;
  categoria: string | null;
  descripcion: string | null;
  next_step: string | null;
  if_true: string | null;
  if_false: string | null;
  condition_field: string | null;
}

export interface EmailJourney {
  track_id: string;
  descripcion: string | null;
  trigger_event: string;
  activo: boolean;
  correos: number;
  pasos: EmailJourneyStep[];
}

// `configurado: false` no es lo mismo que `journeys: []`. Uno significa "este
// cliente nunca monto automatizaciones", el otro "las monto y no queda
// ninguna". Decirle "sin automatizaciones" al primero es mentirle.
export interface EmailJourneysResponse {
  configurado: boolean;
  version?: string;
  actualizado?: string;
  journeys: EmailJourney[];
}

export interface EmailImportResult {
  vista_previa?: boolean;
  importados?: number;
  ya_existian?: number;
  confirmaciones_encoladas?: number;
  nota?: string;
  muestra?: { email: string; name: string; tags: string[] }[];
  informe: {
    leidas: number;
    validas: number;
    descartadas: number;
    email_invalido: string[];
    duplicadas_en_archivo: string[];
    sin_email: number;
    truncado: boolean;
  };
}

// Pendientes de gestion: el MISMO calculo que ve el equipo de RockyBrand en
// su panel (email_crm_service.pendientes en el backend). `horas_restantes_sla`
// es `number | null`: null significa que el contacto no tiene fecha de
// creacion, no que le queden 0 horas.
export interface PendienteSinResponder {
  email: string;
  name: string;
  created_at: string;
  horas_restantes_sla: number | null;
  vencido: boolean;
}

export interface EmailPendientes {
  sin_responder: PendienteSinResponder[];
  sin_confirmar: { email: string; name: string; tipo_programa: string; fecha_llegada: string }[];
  sin_registrar_vuelo: { email: string; name: string; fecha_llegada: string }[];
  por_cerrar: { email: string; name: string; fecha_salida: string }[];
  totales: {
    sin_responder: number;
    vencidos_sla: number;
    sin_confirmar: number;
    sin_registrar_vuelo: number;
    por_cerrar: number;
  };
}

// Un destinatario del registro de envios (rockybrand-email-send-log): la
// evidencia por persona de que salio, se abrio y se clickeo.
export interface CampaignRecipient {
  contact_email: string;
  sent_at?: string;
  opened?: boolean;
  opened_at?: string;
  clicked?: boolean;
  clicked_at?: string;
  clicked_links?: string[];
  bounced?: boolean;
}

export interface EmailCampaignDetalle {
  campana: EmailCampaign;
  destinatarios: CampaignRecipient[];
}
