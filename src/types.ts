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
}

export interface LlegadasResponse {
  client_id: string;
  llegadas: LlegadaGuest[];
}
