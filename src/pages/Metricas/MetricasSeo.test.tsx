import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { IndexacionEstado, SeoMetrics } from '../../types';

// Lo que afirma este archivo es sobre el bloque de indexación: que el conteo
// que muestra es el que vino de Google, que la lista de páginas que faltan no
// se lee como una lista de errores, y que una medición parcial lo declara.
//
// Los datos son la respuesta REAL de la propiedad de karibu-safari-africa el
// 2026-09-09: 36 URLs en el sitemap, 17 indexadas.

const INDEXACION: IndexacionEstado = {
  propiedad: 'https://www.karibusafariafrica.cl/',
  urls_en_sitemap: 36,
  inspeccionadas: 36,
  indexadas: 17,
  no_indexadas: 19,
  por_estado: {
    'Submitted and indexed': 17,
    'Discovered - currently not indexed': 15,
    'URL is unknown to Google': 4,
  },
  paginas: [
    { url: 'https://www.karibusafariafrica.cl/en', ruta: '/en', estado: 'Discovered - currently not indexed', veredicto: 'NEUTRAL', ultimo_rastreo: null },
    { url: 'https://www.karibusafariafrica.cl/en/africa', ruta: '/en/africa', estado: 'URL is unknown to Google', veredicto: 'NEUTRAL', ultimo_rastreo: null },
  ],
  cobertura_parcial: false,
  nota: null,
  medido_el: '2026-09-09',
};

const SEO_BASE: SeoMetrics = {
  posicion_actual: null,
  posicion_periodo: null,
  keywords_contadas: null,
  keyword: null,
  keyword_matrix: [],
  clicks_snapshots: [],
  impressions_snapshots: [],
  posicion_snapshots: [],
  clics_organicos_actual: 0,
  indexacion: INDEXACION,
} as unknown as SeoMetrics;

let seoActual: SeoMetrics = SEO_BASE;

vi.mock('../../hooks/useMetricsReport', () => ({
  useMetricsReport: () => ({ data: { seo: seoActual }, loading: false, error: null, reload: () => {} }),
}));
vi.mock('../../hooks/useClientContextLabel', () => ({
  useClientContextLabel: () => 'Karibu Safari Africa',
}));

const { MetricasSeo } = await import('./MetricasSeo');

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeAll(() => {
  // @ts-expect-error - jsdom no trae la firma completa de SVGGeometryElement
  SVGElement.prototype.getTotalLength = () => 100;
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

function render(seo: SeoMetrics): string {
  seoActual = seo;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(<StrictMode><MetricasSeo isDesktop /></StrictMode>); });
  return host.textContent ?? '';
}

describe('MetricasSeo · indexación', () => {
  it('muestra el conteo que devolvió Google y traduce sus estados', () => {
    const texto = render(SEO_BASE);

    expect(texto).toContain('Páginas en Google');
    expect(texto).toContain('17');
    expect(texto).toContain('de 36 páginas');
    expect(texto).toContain('(47%)');
    expect(texto).toContain('medido el 2026-09-09');

    expect(texto).toContain('/en');
    expect(texto).toContain('Descubierta, sin indexar');
    expect(texto).toContain('Google no la conoce');
    // El estado crudo de Google no llega a la pantalla del cliente.
    expect(texto).not.toContain('Discovered - currently not indexed');

    // Sin esta frase, la tabla se lee como una lista de fallas y manda a
    // arreglar algo que no está roto.
    expect(texto).toContain('no son errores del sitio');

    expect(texto).not.toContain('NaN');
    expect(texto).not.toContain('undefined');
  });

  it('declara cuando midió solo una parte del sitio', () => {
    const texto = render({
      ...SEO_BASE,
      indexacion: { ...INDEXACION, urls_en_sitemap: 900, inspeccionadas: 128, indexadas: 100, cobertura_parcial: true },
    } as SeoMetrics);

    expect(texto).toContain('El sitemap declara 900 páginas');
    expect(texto).toContain('alcanzó a revisar 128');
    expect(texto).toContain('no del sitio completo');
  });

  it('no dibuja el bloque cuando no se pudo medir', () => {
    const texto = render({
      ...SEO_BASE,
      indexacion: { ...INDEXACION, indexadas: null, inspeccionadas: 0, paginas: [], nota: 'No se pudo medir la indexacion.' },
    } as SeoMetrics);

    // Ni un cero ni una barra vacía: un 0% se lee como "tu sitio no está en
    // Google", que es una afirmación distinta de "no se pudo medir".
    expect(texto).not.toContain('Páginas en Google');
    expect(texto).not.toContain('0%');
  });

  it('no dibuja nada de indexación si el cliente todavía no tiene captura', () => {
    const texto = render({ ...SEO_BASE, indexacion: null } as SeoMetrics);
    expect(texto).not.toContain('Páginas en Google');
  });
});
