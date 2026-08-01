import type { ServiceKey } from './types';

export type Screen = 'home' | 'detail' | 'settings' | 'login';

export const SIDEBAR_W = 220;

// serviceKey: que servicio de rockybrand-client-config debe tener
// contratado el cliente para ver este item - pedido explicito de Mato
// (2026-08-01): "cada cliente tenga su propio panel dnde solo aparezca
// en el sidebar los servicios de ese cliente". Hoy las 2 pantallas
// dependen del mismo servicio ("crm", el que ya gatea todo este Lambda -
// ver crm_dashboard_api_lambda.py) porque es lo único que existe todavía;
// cuando se agregue una pantalla nueva (ej. PMS de habitaciones), va con
// su propio serviceKey acá, sin tocar el mecanismo de filtrado.
export const NAV: { id: Screen; icon: string; label: string; shortLabel: string; serviceKey: ServiceKey }[] = [
  { id: 'home', icon: '◉', label: 'Estatus Actual', shortLabel: 'Estatus', serviceKey: 'crm' },
  { id: 'detail', icon: '↓', label: 'Próximas llegadas', shortLabel: 'Llegadas', serviceKey: 'crm' },
];
