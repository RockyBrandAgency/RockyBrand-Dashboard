import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RendimientoRedes } from './RendimientoRedes';
import type { RendimientoRedes as Datos } from '../../types';
import CFF from './__fixtures__/rendimiento-cff-2026-10-02.json';

// Qué afirma este archivo: que la vista no dice lo que no sabe.
//
// - Un dato que la red no entrega (alcance de Facebook y de YouTube) se ve
//   "—", nunca 0, y la tarjeta dice por qué falta.
// - Lo que tiene menos de 7 días se marca "madurando" y no recibe un "vs.
//   normal": todavía junta vistas.
// - Filtrar por red muestra solo esa red.
//
// El fixture es la salida REAL de `panel_rrss.py` del 2026-10-02 para
// chile-fly-fishing: 3 publicaciones por red, sin miniaturas (son URLs
// firmadas que vencen) y 3 de los insights calculados.

const DATOS = CFF as unknown as Datos;
let container: HTMLDivElement;
let root: Root;

function render(datos: Datos | null, isDesktop = true) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <StrictMode>
        <RendimientoRedes datos={datos} isDesktop={isDesktop} />
      </StrictMode>,
    );
  });
  return container;
}

function filas(el: HTMLElement) {
  return Array.from(el.querySelectorAll('tbody tr'));
}

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // El período se cuenta desde "ahora": se fija al día siguiente de la medición.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('RendimientoRedes con la medición real de chile-fly-fishing', () => {
  it('muestra las cuatro redes y las doce publicaciones', () => {
    const el = render(DATOS);
    for (const red of ['Instagram', 'Facebook', 'YouTube', 'TikTok']) {
      expect(el.textContent).toContain(red);
    }
    expect(filas(el)).toHaveLength(12);
  });

  it('el alcance que la red no entrega es "—" y la tarjeta dice por qué', () => {
    const el = render(DATOS);
    expect(el.textContent).toContain('Meta no entrega el alcance de los reels');
    expect(el.textContent).toContain('La API de YouTube no entrega alcance');
    const facebook = filas(el).filter((f) => f.textContent?.includes('Mid-December'));
    expect(facebook).toHaveLength(1);
    const alcance = facebook[0].querySelectorAll('td')[2];
    expect(alcance.textContent).toBe('—');
  });

  it('lo que tiene menos de 7 días va marcado y sin comparación', () => {
    const el = render(DATOS);
    const madurando = DATOS.publicaciones.filter((p) => p.madurando).length;
    const marcadas = filas(el).filter((f) => f.textContent?.includes('madurando'));
    expect(marcadas).toHaveLength(madurando);
    for (const f of marcadas) {
      expect(f.querySelectorAll('td')[7].textContent).toBe('—');
    }
  });

  it('filtrar por TikTok deja solo TikTok', () => {
    const el = render(DATOS);
    const boton = Array.from(el.querySelectorAll('button')).find((b) => b.textContent === 'TikTok');
    act(() => boton!.click());
    expect(filas(el)).toHaveLength(3);
  });

  it('muestra los insights tal como llegan', () => {
    const el = render(DATOS);
    expect(el.textContent).toContain(DATOS.insights.numeros[0].titulo);
    expect(el.textContent).toContain(DATOS.insights.vigentes[0].hallazgo);
  });

  it('en el celular dibuja tarjetas, no tabla', () => {
    const el = render(DATOS, false);
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('Alcance');
  });

  it('muestra de a 20 y ofrece el resto', () => {
    const muchas = { ...DATOS, publicaciones: Array.from({ length: 25 }, (_, i) => ({ ...DATOS.publicaciones[4], id: `x${i}` })) };
    const el = render(muchas);
    expect(filas(el)).toHaveLength(20);
    const mas = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Ver 5 más'));
    act(() => mas!.click());
    expect(filas(el)).toHaveLength(25);
  });

  it('sin medición, lo dice en vez de dibujar ceros', () => {
    const el = render(null);
    expect(el.textContent).toContain('Todavía no hay mediciones de lo publicado');
    expect(el.querySelector('table')).toBeNull();
  });
});
