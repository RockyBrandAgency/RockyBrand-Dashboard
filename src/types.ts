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

export type ServiceKey = 'agents' | 'pms' | 'crm' | 'email_marketing' | 'content_approval' | 'store' | 'agencias';

// ---------------------------------------------------------------- agencias --
// Portal B2B: agencias de viaje con tarifa negociada propia. Espejo de
// `agencias.vista_para_panel()` en agencias_admin.py — si cambia allá,
// cambia acá.

export type AgenciaEstado = 'ACTIVA' | 'SUSPENDIDA';

export interface AgenciaTemporada {
  nombre: string;
  desde: string;
  hasta: string;
  tarifas: Record<string, number>;
  multiplicador: number | null;
  min_noches: number | null;
}

export interface Agencia {
  agency_id: string;
  nombre: string;
  moneda: 'CLP' | 'USD';
  estado: AgenciaEstado;
  min_noches: number;
  // null = esta agencia no vende media pensión. Un 0 significaría que la
  // regala, que es un error caro; el backend distingue los dos casos.
  suplemento_media_pension: number | null;
  tarifas: Record<string, number>;
  temporadas: AgenciaTemporada[];
  habitaciones: string[];
  contacto: { nombre: string; email: string; telefono: string };
  notas: string;
  actualizado_en: string;
}

export interface AgenciaAcceso {
  email: string;
  // FORCE_CHANGE_PASSWORD = todavía no entró por primera vez.
  estado: string;
  habilitado: boolean;
  creado_en: string;
}

export interface AgenciasResponse {
  agencias: Agencia[];
  habitaciones: string[];
  monedas: string[];
}

export interface AgenciaFila {
  agency_id: string;
  nombre: string;
  estado: string;
  moneda: string;
  reservas: number;
  confirmadas: number;
  canceladas: number;
  noches: number;
  monto_confirmado: number;
  monto_pendiente: number;
  ticket_promedio: number;
  conversion_pct: number;
  ultima_reserva: string;
}

export type ClientServices = Record<ServiceKey, boolean>;

export interface MeResponse {
  client_id: string;
  display_name: string;
  display_subtitle: string;
  // null si el cliente no subió un logo propio todavía (Configuración,
  // 2026-08-03) - el frontend cae a CLIENT_BRANDING/LogoPlaceholder.
  logo_data_url: string | null;
  services: ClientServices;
  // Default true si el backend por algun motivo no lo manda (cliente
  // viejo antes de este campo) - preserva el comportamiento de hoy
  // (mostrar habitaciones) hasta que se apague a proposito.
  pms_room_views: boolean;
}

// Huesped/pescador del PMS (GET /dashboard/huespedes, 2026-08-11 —
// "Huespedes (para alto castillo), Pescadores para ChileFlyFishing").
// El backend recorta el item de DynamoDB: IdentityDocument (pasaporte/RUT
// del registro de pasajeros) NO viaja, esta pantalla no lo muestra.
export interface HuespedItem {
  GuestID: string;
  FullName: string;
  // `Phone` y no solo `WhatsApp`: el formulario de reservas de CFF escribe el
  // teléfono bajo `Phone`. Leerlo con `telefonoDe()` de lib/contactoHuesped.
  Contact: { Email?: string; WhatsApp?: string; Phone?: string };
  OriginCountry?: string | null;
  VIP_Tags: string[];
  DietaryRestrictions: string[];
  MobilityNotes: string;
  SpecialNotes: string;
  TotalLTV: number;
  /** ISO YYYY-MM-DD. Fecha operativa (no la del registro legal de
   * pasajeros, que vive en IdentityDocument y no viaja a este panel). */
  BirthDate?: string | null;
  AnniversaryDate?: string | null;
  UpdatedAt?: string | null;
}

// Tablero de limpieza del día (GET /dashboard/housekeeping, 2026-08-11).
// Lo arma pms_frontdesk.tablero_housekeeping() en el backend, incluida la
// prioridad: el orden no lo decide la UI, para que dos pantallas distintas
// no ordenen la lista distinto.
export type RoomState = 'CLEAN' | 'DIRTY' | 'INSPECTED' | 'OUT_OF_SERVICE';

export interface HousekeepingHabitacion {
  room_id: string;
  estado: RoomState;
  nota: string;
  actualizado?: string | null;
  ocupada_ahora: boolean;
  huesped_actual?: string | null;
  salida_hoy: boolean;
  llegada_hoy: boolean;
  /** 3 urgente · 2 hay que limpiarla hoy · 1 sucia sin apuro · 0 lista */
  prioridad: number;
}

export interface HousekeepingResponse {
  fecha: string;
  habitaciones: HousekeepingHabitacion[];
}

export interface HuespedesResponse {
  huespedes: HuespedItem[];
}

export interface ReservaResumenItem {
  BookingID: string;
  RoomID: string;
  CheckIn: string;
  CheckOut: string;
  Status: string;
  Source: string | null;
  GuestID?: string;
  GuestName: string;
  // Vacío ({}) si el huésped no se encontró — nunca null. Agregado
  // 2026-08-06 (detalle al click, pedido explícito de Mato).
  GuestContact?: { Email?: string; WhatsApp?: string; Phone?: string };
  GuestOriginCountry?: string | null;
  PartyMembers?: number;
  BookingNotes?: string;
  // Lo manda el propio huésped por WhatsApp contestando el correo de
  // confirmación, así que está vacío hasta que lo haga: llega DESPUÉS de
  // pagar, no al reservar. Opcional a propósito - tratarlo como obligatorio
  // haría que una reserva recién creada pareciera incompleta.
  FlightNumber?: string;
  FlightReportedAt?: string;
  TotalAmount: number;
  Currency: string;
  PaymentStatus: string | null;
}

export interface ReservasResumenResponse {
  client_id: string;
  reservas: ReservaResumenItem[];
}

// Reserva manual (llamada/mail/walk-in) - 2026-08-06, pedido explícito de
// Mato, para todos los clientes. GuestID debe ser de un huésped ya
// existente (ver NuevaHuespedPayload si es nuevo).
export interface NuevaReservaPayload {
  GuestID: string;
  RoomID: string;
  CheckIn: string;
  CheckOut: string;
  PartyMembers: number;
  Financials: { Currency: string; TotalAmount: number; PaymentStatus: string };
}

export interface NuevoHuespedPayload {
  FullName: string;
  Contact: { Email?: string; WhatsApp?: string };
  OriginCountry?: string;
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

// Forma real de dashboard_metrics.compute_metrics_report()'s "email" -
// distinta de EmailMetrics de abajo (la de email_crm_service.metricas(),
// que consume getEmailMetrics()/Metricas.tsx). Antes las dos se llamaban
// "EmailMetrics" - TypeScript fusiona interfaces del mismo nombre, así
// que el tipo resultante exigía los 2 conjuntos de campos a la vez,
// cosa que ningún endpoint real cumple (hallazgo de auditoría 2026-08-04,
// hoy dormido porque nada leía report.email todavía).
export interface EmailReportSummary {
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

// Una fila = una consulta real de Search Console del ultimo periodo
// capturado (dashboard_metrics.keyword_matrix_desde_gsc). `clics` y `ctr`
// solo existen en el camino nuevo: el respaldo, que se arma con el reporte
// del modelo cuando no hay snapshot crudo, no los trae.
export interface SeoKeywordRow {
  keyword: string | null;
  posicion_actual: number | null;
  posicion_anterior: number | null;
  delta: number | null;
  impresiones: number | null;
  clics?: number | null;
  ctr?: number | null;
  periodo: string | null;
  landing_page: string | null;
  accion_recomendada?: string | null;
}

export interface SeoClicksPoint {
  fecha: string;
  clics: number;
}

export interface SeoImpressionsPoint {
  fecha: string;
  impresiones: number;
}

// Posición promedio en Google a lo largo del tiempo. Menos es mejor: se
// grafica con el eje invertido (LineChart, prop `menorEsMejor`).
export interface SeoPosicionPoint {
  fecha: string;
  posicion: number;
}

export interface SeoMetrics {
  snapshots: SeoSnapshotPoint[];
  // Promedio ponderado por impresiones sobre TODAS las consultas del
  // periodo, no la posicion de la mejor keyword (que es lo que este campo
  // traia hasta el 2026-08-12 bajo la misma etiqueta).
  posicion_actual: number | null;
  keyword: string | null;
  posicion_periodo?: string | null;
  keywords_contadas?: number | null;
  keyword_matrix: SeoKeywordRow[];
  clicks_snapshots: SeoClicksPoint[];
  impressions_snapshots: SeoImpressionsPoint[];
  posicion_snapshots?: SeoPosicionPoint[];
  clics_organicos_actual: number | null;
}

// GA4 real (2026-08-07) - visitas_eeuu_7d es null cuando falta la
// propiedad/credencial o la consulta falló (ver `nota`), y 0 cuando GA4
// consultó bien pero de verdad no hubo ningún usuario de Estados Unidos
// en la ventana - dos casos distintos, nunca se confunden en la UI.
export interface WebMetrics {
  visitas_eeuu_7d: number | null;
  nota: string | null;
}

export interface MetricsReportResponse {
  client_id: string;
  range: { from: string; to: string; days: number };
  email: EmailReportSummary;
  social: SocialMetrics;
  facebook: FacebookMetrics;
  youtube: YoutubeMetrics;
  seo: SeoMetrics;
  web: WebMetrics;
}

// --- Email Marketing: las 6 secciones (2026-08-03) -------------------------
//
// Las tasas son `number | null`, no `number`. El backend devuelve null cuando
// no hay denominador, y esa distincion es el punto: un 0% con denominador 0
// se lee como "malisimo" cuando en realidad es "todavia no se sabe".
export interface SubjectCheck {
  largo: number;
  // 'corto'/'largo' nunca los produce el backend real (evaluar_asunto,
  // email_crm_service.py) - y sí produce 'revisar', que faltaba acá.
  // Hallazgo de auditoría 2026-08-04, hoy dormido porque nada consume la
  // respuesta real de este campo todavía (NuevaCampana.tsx la descarta;
  // la UI usa su propia evaluación local en SubjectField.tsx).
  estado: 'vacio' | 'optimo' | 'revisar' | 'problema';
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
  scheduled_at?: string;
  planificada_at?: string;
  segment?: EmailSegment;
  consent_type?: string;
  stats?: Record<string, number>;
  // Solo cuando el cortacircuito frenó la campaña por tasa de rebote.
  detenida_at?: string;
  detenida_motivo?: string;
}

// Un texto editable de una plantilla. El molde (`html_source`) trae {{clave}}
// donde va cada uno; ver 04-codigo/plantilla_campos.py.
export interface EmailTemplateCampo {
  clave: string;
  etiqueta: string;
  tipo: 'texto' | 'texto_largo' | 'url';
  valor: string;
  grupo?: string;
  ayuda?: string;
}

export interface EmailTemplate {
  template_id: string;
  name: string;
  // Asunto sugerido de la plantilla. La campaña puede pisarlo: el asunto que
  // sale es el de la campaña, este es el punto de partida.
  subject?: string;
  html_body?: string;
  // Molde y campos: solo vienen en el detalle, nunca en el listado (pesan lo
  // mismo que el html_body y la galería no los usa).
  html_source?: string;
  campos?: EmailTemplateCampo[];
  // Derivado en el backend al listar: cuántos campos editables tiene.
  campos_editables?: number;
  tamano_bytes?: number;
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


// --------------------------------------- aprobación de contenido de redes --
// Espeja el esquema real de rockybrand-content-pieces. Solo cubre contenido
// PUBLICABLE que producen Dave y Jimi: los reportes de Neil/Slash/Cameron y
// las directivas de Rox son informes internos y no pasan por acá.

export interface AdvertenciaPieza {
  regla: string;
  plataforma: string;
  formato: string;
  limite: number | null;
  valor: number | string;
  exceso: number | null;
  mensaje: string;
}

export interface ActivoVisual {
  activos: { nombre_archivo: string; justificacion: string | null }[];
  formato_generado?: string;
  generado_at?: string;
  nota?: string;
}

export interface Adaptacion {
  plataforma: string;
  formato: string;
  headline: string;
  cuerpo: string;
  cta?: string;
  hashtags?: string[];
  duracion_seg?: number;
  nota_visual_para_art_director?: string;
  advertencias?: AdvertenciaPieza[];
  activo_visual?: ActivoVisual | null;
}

export interface RevisionEntry {
  quien: string;
  cuando: string;
  decision: 'aprobada' | 'rechazada';
  comentario: string;
}

export type EstadoPieza = 'pendiente' | 'aprobada' | 'rechazada' | 'publicada';

export interface ContentPiece {
  client_id: string;
  piece_id: string;
  generado_por: string;
  generated_at: string;
  fecha_publicacion_propuesta: string;
  objetivo: string;
  concepto: string;
  estado: EstadoPieza;
  adaptaciones: Adaptacion[];
  historial_revision: RevisionEntry[];
  arte_generado_at?: string;
  pilar?: string;
  validacion?: {
    advertencias_total: number;
    reglas_sin_verificar: string[];
    specs_actualizadas_en: string | null;
  };
}

export interface ContentPiecesResponse {
  piezas: ContentPiece[];
  total: number;
  pendientes: number;
}

// Siempre la misma forma, con o sin datos suficientes. `hay_recomendacion`
// es lo primero que hay que mirar: cuando es false, `mensaje` ya trae el
// texto honesto con el N real y la vista no redacta nada.
export interface HorarioSugerido {
  hay_recomendacion: boolean;
  publicaciones_analizadas: number;
  minimo_requerido?: number;
  mensaje?: string;
  franja?: string;
  publicaciones_en_la_franja?: number;
  rendimiento_promedio_franja?: number;
  rendimiento_promedio_resto?: number;
  diferencia_pct?: number | null;
  detalle_por_franja?: { franja: string; publicaciones: number; rendimiento_promedio: number }[];
  metrica?: string;
  fuente?: string;
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
  // El backend ya lo devuelve; faltaba tiparlo. Una queja de spam no es lo
  // mismo que un rebote y pesa mucho más en la reputación del dominio.
  complained?: boolean;
}

export interface EmailCampaignDetalle {
  campana: EmailCampaign;
  destinatarios: CampaignRecipient[];
}

// ===== Tienda (Chile Fly Fishing Co.) =====
// Mismos nombres de campo reales que escribe store_orders_lambda.py /
// store_admin_lambda.py (ver ARQUITECTURA-TIENDA-CFF.md) - no una
// convencion inventada acá. `activo` es el unico campo nuevo respecto de
// lo que ya usa 05-panel-web: es lo que store_catalog_lambda.py (el
// endpoint publico que lee la tienda) usa para excluir un SKU de
// /public/productos por completo.

export interface StoreProduct {
  sku: string;
  nombre: string;
  slug?: string;
  familia?: string;
  precio_clp: number;
  stock: number;
  activo: boolean;
  // Ya vivía en Dynamo (specs.linea = "Línea {n}", cargado por
  // store_seed_products.py) pero nunca se tipó ni se mostraba en el
  // panel - 2026-08-07, pedido explícito de Mato. Solo las cañas lo
  // tienen; el resto del catálogo (moscas, reels, accesorios) queda sin
  // este campo, nunca se inventa un "N/A".
  specs?: { largo?: string; linea?: string; tramos?: string; peso?: string };
}

export type StoreOrderStatus =
  | 'pendiente_pago'
  | 'pago_iniciado'
  | 'pagada'
  | 'pago_rechazado'
  | 'pago_anulado'
  | 'expirada'
  | 'revision_monto';

export interface StoreOrderItem {
  sku: string;
  cantidad: number;
  nombre: string;
  precio_unitario_clp?: number;
  total_linea_clp?: number;
}

export interface StoreOrderCliente {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  region: string;
  notas?: string;
}

export interface StoreOrder {
  order_id: string;
  estado: StoreOrderStatus;
  email?: string;
  cliente?: StoreOrderCliente;
  items?: StoreOrderItem[];
  subtotal_clp?: number;
  despacho_clp?: number | null;
  despacho_estado?: string;
  total_clp?: number;
  pago?: string;
  webpay_token?: string;
  created_at?: string;
  numero_seguimiento?: string | null;
  despachado_en?: string | null;
}

/** Solicitud de garantia (reposicion de un tramo de cana Douglas).
 *
 *  Viene YA aplanada del backend: la direccion llega armada en un solo campo
 *  y `veces_usada` calculado. Esta pantalla no rearma nada, solo muestra.
 */
/** Los cuatro estados por los que pasa una garantía. Son cuatro y no más:
 *  cada uno corresponde a algo que la tienda de verdad hace distinto. Espejo
 *  exacto de ESTADOS_GARANTIA en store_admin_lambda.py. */
export type StoreGarantiaEstado = 'recibida' | 'en_revision' | 'despachada' | 'rechazada';

export interface StoreGarantia {
  solicitud_id: string;
  estado: StoreGarantiaEstado;
  created_at: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  cana: string;
  modelo: string;
  /** "1" a "4". El 1 es la punta. */
  tramo: string;
  descripcion: string;
  costo_clp: number;
  /** Cuantas solicitudes lleva ESE correo en total, contando esta. */
  veces_usada: number;
  /** Nota de la tienda. No la ve el cliente. */
  nota_interna: string;
}

export interface StoreDashboardResumen {
  ventas_semana: { cantidad: number; total_clp: number };
  riesgo_quiebre_stock: StoreProduct[];
  despachos_pendientes: StoreOrder[];
  en_revision_monto: StoreOrder[];
}
