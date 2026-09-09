import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { WebMetrics } from '../../types';

// Qué afirma este archivo: que la pantalla de Sitio web DIBUJA el dato que GA4
// devuelve, y que no dibuja un número cuando GA4 no contestó.
//
// El payload de `CON_DATOS` es la respuesta REAL de la propiedad 553104330 de
// karibu-safari-africa el 2026-09-09, copiada de la salida de
// `ga4_client.get_web_report`, no inventada para que la prueba pase. Tiene un
// solo punto de serie a propósito: el sitio salió a producción el 2026-09-08 y
// ese es exactamente el caso en el que un gráfico de tendencia se rompe.

const CON_DATOS: WebMetrics = {
  usuarios: 9,
  sesiones: 10,
  paginas_vistas: 98,
  visitas_eeuu_7d: 1,
  periodo: '2026-09-08',
  serie_usuarios: [{ fecha: '2026-09-08', usuarios: 9, sesiones: 10 }],
  canales: [
    { canal: 'Direct', sesiones: 9, usuarios: 8 },
    { canal: 'Organic Search', sesiones: 1, usuarios: 1 },
  ],
  paginas: [
    { ruta: '/', vistas: 26, usuarios: 9 },
    { ruta: '/contacto', vistas: 8, usuarios: 2 },
    { ruta: '/programas/7-dias-y-6-noches-en-kenia', vistas: 8, usuarios: 3 },
  ],
  paises: [
    { pais: 'Chile', usuarios: 6 },
    { pais: '(not set)', usuarios: 2 },
    { pais: 'United States', usuarios: 1 },
  ],
  nota: null,
};

const SIN_CONECTAR: WebMetrics = {
  usuarios: null, sesiones: null, paginas_vistas: null, visitas_eeuu_7d: null,
  periodo: null, serie_usuarios: [], canales: [], paginas: [], paises: [],
  nota: "PENDIENTE: no hay propiedad de GA4 configurada para 'karibu-safari-africa'.",
};

let webActual: WebMetrics = CON_DATOS;

vi.mock('../../hooks/useMetricsReport', () => ({
  useMetricsReport: () => ({
    data: { web: webActual },
    loading: false,
    error: null,
    reload: () => {},
  }),
}));

vi.mock('../../hooks/useClientContextLabel', () => ({
  useClientContextLabel: () => 'Karibu Safari Africa',
}));

const { MetricasWeb } = await import('./MetricasWeb');

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeAll(() => {
  // jsdom no implementa getTotalLength; el gráfico la usa para dibujar la
  // línea con GSAP. Sin este stub, la prueba fallaría por el entorno y no por
  // el componente - justo el falso rojo que hace desconfiar de la suite.
  // @ts-expect-error - jsdom no trae la firma completa de SVGGeometryElement
  SVGElement.prototype.getTotalLength = () => 100;

  // Tampoco implementa matchMedia, y medio panel la consulta para respetar
  // `prefers-reduced-motion`. Se responde "no reducido", que es el camino con
  // animaciones: el que más código toca.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

function render(web: WebMetrics): string {
  webActual = web;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(<StrictMode><MetricasWeb isDesktop /></StrictMode>);
  });
  return host.textContent ?? '';
}

describe('MetricasWeb', () => {
  it('dibuja los números que devolvió GA4', () => {
    const texto = render(CON_DATOS);

    // Los tres KPI, con su etiqueta al lado del número: un 9 suelto en el DOM
    // no prueba que sea el de usuarios.
    expect(texto).toContain('Usuarios');
    expect(texto).toContain('9');
    expect(texto).toContain('Sesiones');
    expect(texto).toContain('10');
    expect(texto).toContain('Páginas vistas');
    expect(texto).toContain('98');

    // El período de un solo día no se escribe "2026-09-08 a 2026-09-08".
    expect(texto).toContain('2026-09-08');
    expect(texto).not.toContain('2026-09-08 a 2026-09-08');

    expect(texto).toContain('Direct');
    expect(texto).toContain('Organic Search');
    expect(texto).toContain('Chile');
    expect(texto).toContain('/contacto');
    expect(texto).toContain('/programas/7-dias-y-6-noches-en-kenia');
    // La portada se rotula, no se muestra como una barra "/" suelta.
    expect(texto).toContain('/ (portada)');

    // Ningún número roto llegó a la pantalla. `toLocaleString` de un
    // undefined no explota: escribe "NaN", y eso el cliente lo lee como un
    // dato real de su sitio.
    expect(texto).not.toContain('NaN');
    expect(texto).not.toContain('undefined');
    expect(texto).not.toContain('Infinity');
  });

  it('no inventa un cero cuando GA4 no está conectado', () => {
    const texto = render(SIN_CONECTAR);

    expect(texto).toContain('Google Analytics no está conectado');
    expect(texto).toContain('PENDIENTE');
    // Ni las tablas ni los KPI aparecen: una pantalla a medias con ceros se
    // lee como "tu sitio no tiene visitas", que es una afirmación distinta.
    expect(texto).not.toContain('Páginas más vistas');
    expect(texto).not.toContain('Cómo llegaron');
    expect(texto).not.toContain('NaN');
  });
});
