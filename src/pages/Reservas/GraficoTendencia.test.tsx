import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tendenciaDe, type Tendencia, type Tramo } from '../../lib/tendenciaVentas';
import type { VentasReserva } from '../../types';
import { GraficoTendencia } from './GraficoTendencia';

// Qué afirma: la tendencia en líneas (pedido de Mato, 19-oct) nunca queda
// vacía en un período corto: con un solo tramo se ve el punto, y con un solo
// tramo con ventas la línea sube a ese tramo y el máximo queda marcado.

const clientWidthOriginal = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!;
let container: HTMLDivElement;
let root: Root;

function tramo(desde: string, fd: number, otros = 0): Tramo {
  return { desde, hasta: desde, ai: 0, fd, otros, total: fd + otros, reservas: fd + otros > 0 ? 1 : 0 };
}

function tendencia(tramos: Tramo[]): Tendencia {
  const maximo = tramos.reduce<Tramo | null>((m, t) => (t.total > 0 && (!m || t.total > m.total) ? t : m), null);
  return { escala: 'dia', tramos, total: tramos.reduce((a, t) => a + t.total, 0), reservas: tramos.reduce((a, t) => a + t.reservas, 0), sinFecha: 0, maximo, empatados: 0, conAno: false };
}

const reserva = (FechaConfirmacion: string, Pescadores: number, Programa: VentasReserva['Programa'] = 'FULL_DAY'): VentasReserva =>
  ({ BookingID: `b-${FechaConfirmacion}-${Programa}`, GuestID: 'g', GuestName: 'x', Programa, Mercado: 'USA', CheckIn: '2026-11-01', CheckOut: '2026-11-02', Pescadores, Jornadas: 1, Moneda: 'USD', Venta: null, Costo: null, Utilidad: null, Porcentaje: null, Reason: null, FechaConfirmacion }) as VentasReserva;

/** La y de cada punto de un path «M x y L x y …». */
const ysDe = (p: SVGPathElement) => p.getAttribute('d')!.split(/[ML]/).filter(Boolean).map((s) => Number(s.trim().split(/\s+/)[1]));

async function render(t: Tendencia) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<GraficoTendencia tendencia={t} />));
}

beforeEach(() => {
  // jsdom no tiene maqueta: el lienzo mide 300 px, como un teléfono.
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => 300 });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Object.defineProperty(Element.prototype, 'clientWidth', clientWidthOriginal);
});

describe('GraficoTendencia en líneas', () => {
  it('un solo tramo en el período: la serie se ve como un punto marcado, nunca vacía', async () => {
    await render(tendencia([tramo('2026-10-14', 4)]));
    const paths = Array.from(container.querySelectorAll<SVGPathElement>('path[data-serie]'));
    // Una sola serie: sin línea de total, que sería la misma.
    expect(paths.map((p) => p.dataset.serie)).toEqual(['fd']);
    expect(paths[0].getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+$/);
    expect(container.querySelector('[data-marcadores="fd"]')!.children).toHaveLength(1);
    expect(container.querySelector<SVGGElement>('[data-maximo]')!.dataset.tramo).toBe('2026-10-14');
    expect(container.querySelector('[data-detalle-grafico]')!.textContent).toBe('Una sola venta en el período: 14 oct, 4 pescadores (Full Day 4). Con una venta todavía no hay tendencia.');
    expect(Array.from(container.querySelectorAll('.solo-lector li')).map((li) => li.textContent)).toEqual(['14 oct: 4 pescadores (Full Day 4).']);
  });

  it('un solo tramo con ventas entre días en 0: la línea sube a ese día, el máximo queda marcado y hay total con dos series', async () => {
    await render(tendencia([tramo('2026-10-12', 0), tramo('2026-10-13', 0), tramo('2026-10-14', 4, 1), tramo('2026-10-15', 0)]));
    const paths = Array.from(container.querySelectorAll<SVGPathElement>('path[data-serie]'));
    expect(paths.map((p) => p.dataset.serie)).toEqual(['total', 'fd', 'otros']);
    for (const p of paths) expect(p.getAttribute('d')!.split(/[ML]/).filter(Boolean)).toHaveLength(4);
    // El total va más marcado que las series.
    expect(Number(paths[0].getAttribute('stroke-width'))).toBeGreaterThan(Number(paths[1].getAttribute('stroke-width')));
    const max = container.querySelectorAll<SVGGElement>('[data-maximo]');
    expect(max).toHaveLength(1);
    expect(max[0].dataset.tramo).toBe('2026-10-14');
    expect(max[0].dataset.total).toBe('5');
    expect(Array.from(container.querySelectorAll('[data-eje-y]')).map((x) => x.textContent)).toEqual(['5', '0']);
    // El Total es la suma: en cada tramo, su punto queda a la altura de ai+fd+otros
    // en la escala del eje Y (0 en la base, el máximo arriba).
    const yCero = Number(container.querySelector('[data-eje-y="0"]')!.getAttribute('y'));
    const yTope = Number(container.querySelector('[data-eje-y="max"]')!.getAttribute('y'));
    const yDe = (v: number) => yCero - (v / 5) * (yCero - yTope);
    const tramos = [[0, 0, 0], [0, 0, 0], [0, 4, 1], [0, 0, 0]];
    const [total, ...series] = paths.map(ysDe);
    total.forEach((y, i) => expect(y).toBeCloseTo(yDe(tramos[i][0] + tramos[i][1] + tramos[i][2]), 6));
    total.forEach((y, i) => expect(yCero - y).toBeCloseTo(series.reduce((a, ys) => a + (yCero - ys[i]), 0), 6));
    // Y no es ninguna de las series: el 14-oct el total (5) va más alto que FD (4).
    expect(total[2]).toBeLessThan(series[0][2]);
    // Las fechas del eje X: la primera y la última, sin encimarse.
    const fechas = Array.from(container.querySelectorAll<SVGTextElement>('[data-eje-x]')).map((x) => x.dataset.ejeX);
    expect(fechas[0]).toBe('2026-10-12');
    expect(fechas[fechas.length - 1]).toBe('2026-10-15');
  });

  it('empate: dos días con el mismo total; el máximo marcado es el primero y la frase dice que empata', async () => {
    const t = tendenciaDe([reserva('2026-10-01', 2), reserva('2026-10-03', 5, 'ALL_INCLUSIVE'), reserva('2026-10-07', 5)], { desde: '2026-10-01', hasta: '2026-10-10' }, '30d');
    await render(t);
    const max = container.querySelectorAll<SVGGElement>('[data-maximo]');
    expect(max).toHaveLength(1);
    expect(max[0].dataset.tramo).toBe('2026-10-03');
    expect(max[0].dataset.total).toBe('5');
    const frase = container.querySelector('[data-detalle-grafico]')!.textContent;
    expect(frase).toContain('empata');
    expect(frase).toBe('Mejor día: 3 oct, 5 pescadores (All Inclusive 5; empata con otro).');
  });

  it('sin ventas: no hay lienzo, solo la frase', async () => {
    await render(tendencia([tramo('2026-10-12', 0)]));
    expect(container.querySelector('svg.tendencia__svg')).toBeNull();
    expect(container.querySelector('[data-detalle-grafico]')!.textContent).toBe('Sin ventas con fecha de confirmación en este período.');
  });
});
