import type { EstadoSemaforo } from '../types';

export type Status = 'bien' | 'atencion' | 'critico' | 'neutro';

export const STATUS: Record<Status, { dot: string; label: string; tagBg: string; tagText: string }> = {
  bien: { dot: 'var(--status-bien-dot)', label: 'Bien', tagBg: 'var(--status-bien-bg)', tagText: 'var(--status-bien-text)' },
  atencion: { dot: 'var(--status-atencion-dot)', label: 'Requiere atención', tagBg: 'var(--status-atencion-bg)', tagText: 'var(--status-atencion-text)' },
  critico: { dot: 'var(--status-critico-dot)', label: 'Crítico / Urgente', tagBg: 'var(--status-critico-bg)', tagText: 'var(--status-critico-text)' },
  neutro: { dot: 'var(--status-neutro-dot)', label: 'Sin datos', tagBg: 'var(--status-neutro-bg)', tagText: 'var(--status-neutro-text)' },
};

// El backend devuelve verde/amarillo/rojo para metricas con umbral real, y
// varios estados honestos ("sin_campana_enviada", etc.) cuando no hay dato
// que calcular todavia - esos NUNCA se fuerzan a un color de semaforo,
// siempre van a "neutro" con su mensaje literal.
const ESTADO_A_STATUS: Record<EstadoSemaforo, Status> = {
  verde: 'bien',
  amarillo: 'atencion',
  rojo: 'critico',
  sin_datos: 'neutro',
  sin_configurar: 'neutro',
  sin_campana_creada: 'neutro',
  sin_campana_enviada: 'neutro',
  sin_channel_manager_conectado: 'neutro',
};

export function estadoToStatus(estado: EstadoSemaforo): Status {
  return ESTADO_A_STATUS[estado] ?? 'neutro';
}

const ESTADO_HONESTO_LABEL: Partial<Record<EstadoSemaforo, string>> = {
  sin_datos: 'Sin datos suficientes todavía',
  sin_configurar: 'Falta configurar este tenant',
  sin_campana_creada: 'Sin campañas creadas',
  sin_campana_enviada: 'Sin campaña enviada aún',
  sin_channel_manager_conectado: 'Sin channel manager conectado',
};

export function estadoLabel(estado: EstadoSemaforo): string | null {
  return ESTADO_HONESTO_LABEL[estado] ?? null;
}
