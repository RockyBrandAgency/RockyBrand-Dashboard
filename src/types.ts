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

export interface SemaforoResponse {
  client_id: string;
  semaforo: {
    ocupacion_30d: OcupacionMetric;
    reservas_nuevas_7d: ReservasNuevasMetric;
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
