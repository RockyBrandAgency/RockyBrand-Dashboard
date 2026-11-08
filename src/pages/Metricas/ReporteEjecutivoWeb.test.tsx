import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { WebMetrics, WebReporteEjecutivo } from '../../types';
import { formatoDuracion, ReporteEjecutivoWeb } from './ReporteEjecutivoWeb';

// Qué afirma: que el reporte ejecutivo dice la respuesta de cada pregunta, que
// marca la mayor caída del formulario y que sin datos no dibuja un cero.
//
// `EJECUTIVO` es la salida REAL de `ga4_client.get_reporte_ejecutivo` para
// chile-fly-fishing, últimos 30 días, medida el 2026-11-07 (recortada a tres
// ciudades). La propiedad todavía no tiene registrada `paso_numero`, así que
// el embudo viene sin detalle por paso: el caso que hoy ve el cliente.
// `BASE` (totales de la pantalla de arriba) es ilustrativo, no medido.

const EJECUTIVO: WebReporteEjecutivo = {
  origen: {
    usuarios: 345,
    paises: [
      { pais: 'United States', usuarios: 124 }, { pais: 'Chile', usuarios: 102 },
      { pais: 'Singapore', usuarios: 55 }, { pais: 'China', usuarios: 18 }, { pais: 'Canada', usuarios: 9 },
    ],
  },
  eeuu: {
    usuarios: 124,
    duracion_media_s: 312.4,
    ciudades: [
      { ciudad: 'Sin ciudad', usuarios: 26, duracion_media_s: 134.6 },
      { ciudad: 'Council Bluffs', usuarios: 13, duracion_media_s: 0 },
      { ciudad: 'New York', usuarios: 5, duracion_media_s: 25.5 },
    ],
    excluye: ['Boardman'],
  },
  formulario: {
    etapas: [
      { clave: 'booking_start', etapa: 'Abrieron el formulario', usuarios: 35 },
      { clave: 'booking_step', etapa: 'Pasaron del primer paso', usuarios: 11 },
      { clave: 'booking_request', etapa: 'Enviaron solicitud o consulta', usuarios: 5 },
      { clave: 'begin_checkout', etapa: 'Abrieron el pago', usuarios: 4 },
      { clave: 'purchase', etapa: 'Pagaron', usuarios: 0 },
    ],
    solicitudes: 4,
    consultas: 1,
    detalle_por_paso: false,
    nota_pasos: 'El detalle de cada paso aparece cuando el sitio publique la medición por paso del formulario. Cuenta desde ese día.',
  },
  sesion: { duracion_media_s: 216.1, tiempo_activo_s: 49.3, sesiones: 425, sesiones_con_interaccion: 163 },
  nota: null,
};

const BASE: WebMetrics = {
  usuarios: 200, sesiones: 425, paginas_vistas: 900, visitas_eeuu_7d: 20, periodo: '2026-10-08 a 2026-11-06',
  serie_usuarios: [], canales: [], paginas: [],
  paises: [{ pais: 'United States', usuarios: 128 }, { pais: 'Chile', usuarios: 40 }],
  nota: null,
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

function render(web: WebMetrics): HTMLDivElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(<StrictMode><ReporteEjecutivoWeb web={web} isDesktop /></StrictMode>); });
  return host;
}

describe('ReporteEjecutivoWeb', () => {
  it('responde las cuatro preguntas con los números de GA4', () => {
    const t = render({ ...BASE, ejecutivo: EJECUTIVO }).textContent ?? '';
    expect(t).toContain('Reporte ejecutivo');
    expect(t).toContain('Estados Unidos: 36 % de las personas');
    expect(t).toContain('Singapur');
    expect(t).toContain('124 personas');
    expect(t).toContain('New York');
    expect(t).toContain('No cuenta Boardman');
    expect(t).toContain('Donde más se caen: el primer paso');
    expect(t).toContain('Enviaron: 4 solicitudes de reserva y 1 consulta');
    expect(t).toContain('por eso las cifras difieren');
    expect(t).toContain('Visitas con interacción');
    expect(t).toContain('49 s de atención por visita');
    expect(t).toContain('3 min 36 s');
    expect(t).toContain('163 de 425');
  });

  it('marca la etapa donde más gente se queda, y solo esa', () => {
    const h = render({ ...BASE, ejecutivo: EJECUTIVO });
    const marcadas = [...h.querySelectorAll('[data-etapa]')].filter((e) => e.textContent?.includes('Mayor caída'));
    // 35 abrieron y 11 pasaron: 24 se quedaron en el primer paso.
    expect(marcadas.map((e) => e.getAttribute('data-etapa'))).toEqual(['booking_start']);
    expect(h.textContent).toContain('Mayor caída · 24 se quedaron aquí (69 %)');
  });

  it('las consultas no cuentan como caída antes del pago', () => {
    const h = render({ ...BASE, ejecutivo: EJECUTIVO });
    // 5 enviaron, 1 era consulta y 4 abrieron el pago: nadie se quedó ahí.
    const enviaron = h.querySelector('[data-etapa="booking_request"]');
    expect(enviaron?.textContent).not.toContain('se quedaron');
  });

  it('con medición por paso muestra cada paso, qué pide y desde cuándo', () => {
    const etapas = [
      { clave: 'booking_start', etapa: 'Paso 1 · Programa', usuarios: 20, que_pide: 'Elegir el programa' },
      { clave: 'paso_2', etapa: 'Paso 2 · Objetivo', usuarios: 12, que_pide: 'Qué quiere pescar (opcional)' },
      { clave: 'paso_3', etapa: 'Paso 3 · Fechas', usuarios: 10, que_pide: 'Elegir la semana o el día' },
      { clave: 'paso_4', etapa: 'Paso 4 · Datos', usuarios: 8, que_pide: 'Nombre, email…' },
      { clave: 'paso_5', etapa: 'Paso 5 · Revisión', usuarios: 3, que_pide: 'Revisar y pagar' },
      { clave: 'booking_request', etapa: 'Enviaron solicitud o consulta', usuarios: 2, que_pide: null },
      { clave: 'begin_checkout', etapa: 'Abrieron el pago', usuarios: 1, que_pide: null },
      { clave: 'purchase', etapa: 'Pagaron', usuarios: 0, que_pide: null },
    ];
    const ej = { ...EJECUTIVO, formulario: {
      ...EJECUTIVO.formulario, etapas, solicitudes: 1, consultas: 1, detalle_por_paso: true,
      desde: '2026-11-09', nota_pasos: null } };
    const h = render({ ...BASE, ejecutivo: ej });
    const t = h.textContent ?? '';
    expect(t).toContain('Donde más se caen: «Paso 1 · Programa»');
    expect(t).toContain('Qué quiere pescar (opcional)');
    expect(t).toMatch(/Desde el 9 nov\.? 2026/);
    // Paso 4 → 5 pierde 5 de 8; el paso 1 pierde 8 de 20 y es el mayor.
    expect(h.querySelector('[data-etapa="paso_4"]')?.textContent).toContain('5 se quedaron aquí (63 %)');
  });

  it('con nota del backend no inventa ceros', () => {
    const t = render({ ...BASE, ejecutivo: { nota: 'Error real consultando GA4: timeout' } }).textContent ?? '';
    expect(t).toContain('Error real consultando GA4');
    expect(t).not.toContain('lo abrieron');
  });

  it('sin desglose de consultas mantiene el texto de solicitud', () => {
    const { solicitudes: _s, consultas: _c, ...formulario } = EJECUTIVO.formulario;
    const t = render({ ...BASE, ejecutivo: { ...EJECUTIVO, formulario } }).textContent ?? '';
    expect(t).not.toContain('Enviaron:');
    // Sin el desglose no se sabe cuántas eran consultas: se muestra la resta tal cual.
    expect(t).toContain('1 se quedó aquí (20 %)');
  });

  it('sin el bloque (backend anterior) avisa que no está disponible', () => {
    const t = render(BASE).textContent ?? '';
    expect(t).toContain('todavía no está disponible');
  });

  it('formatea la duración en segundos y minutos', () => {
    expect(formatoDuracion(49.3)).toBe('49 s');
    expect(formatoDuracion(216.1)).toBe('3 min 36 s');
    expect(formatoDuracion(120)).toBe('2 min');
    expect(formatoDuracion(null)).toBe('—');
  });
});
