import { describe, expect, it } from 'vitest';
import FIXTURE from '../pages/Reservas/__fixtures__/ventas-ventanas-2026-10-18.json';
import {
  bajoLista,
  barrasDe,
  detalleBarra,
  cajaMasVendida,
  cajasVisibles,
  claveCaja,
  estadoCaja,
  fraseVentana,
  margenListaDe,
  ORDEN_CAJAS,
  ordenarMontos,
  reservasConPlata,
  sectoresDe,
  textoEstadoPeriodo,
  textoSinFecha,
  totalesVentana,
  ventanasDe,
} from './ventanasVentas';
import type { VentasResponse, VentasVentana } from '../types';

// Qué afirma: la lógica de Ventas por período (spec-ventas-cajas, 18-oct)
// con la respuesta del cálculo real de 04-codigo (generar_fixtures.py, hoy
// 2026-10-18): validación de `ventanas`, totales, estado de cada caja, margen
// contra lista, frase, «Más vendido», barras, dona y textos del período.

const D = FIXTURE as unknown as VentasResponse;
const V = ventanasDe(D)!;
const copia = () => JSON.parse(JSON.stringify(D)) as VentasResponse & { ventanas: Record<string, unknown> };
const caja = (v: VentasVentana, k: string) => v.cajas.find((c) => claveCaja(c) === k)!;

describe('ventanasDe: sin ventanas válidas la página queda la de antes', () => {
  it('lee las tres ventanas del fixture real, con las cajas en el orden fijo', () => {
    expect(V).not.toBeNull();
    expect(V.hoy).toBe('2026-10-18');
    for (const p of ['30d', '90d', 'temporada'] as const) expect(V[p].cajas.map(claveCaja)).toEqual(ORDEN_CAJAS);
  });
  it('null sin `ventanas`, sin una de las tres claves o con una caja de menos', () => {
    expect(ventanasDe({})).toBeNull();
    expect(ventanasDe(null)).toBeNull();
    const sin90 = copia();
    delete (sin90.ventanas as Record<string, unknown>)['90d'];
    expect(ventanasDe(sin90)).toBeNull();
    const cuatro = copia();
    (cuatro.ventanas['30d'] as VentasVentana).cajas.pop();
    expect(ventanasDe(cuatro)).toBeNull();
  });
  it('null con una caja repetida, un conteo que no es entero o un monto que no es número', () => {
    const rep = copia();
    const c = (rep.ventanas.temporada as VentasVentana).cajas;
    c[1] = c[0];
    expect(ventanasDe(rep)).toBeNull();
    const mal = copia();
    (mal.ventanas['30d'] as VentasVentana).cajas[0].pescadores = 1.5;
    expect(ventanasDe(mal)).toBeNull();
    const nan = copia();
    const conMonto = (nan.ventanas.temporada as VentasVentana).cajas.find((x) => x.montos.length > 0)!;
    (conMonto.montos[0] as { venta: unknown }).venta = 'mil';
    expect(ventanasDe(nan)).toBeNull();
  });
  it('reordena cajas que llegan en otro orden', () => {
    const d = copia();
    (d.ventanas.temporada as VentasVentana).cajas.reverse();
    expect(ventanasDe(d)!.temporada.cajas.map(claveCaja)).toEqual(ORDEN_CAJAS);
  });
});

describe('selección de período: cada ventana trae sus propias cifras', () => {
  it('N y R = Σ cajas + otros', () => {
    expect(totalesVentana(V['30d'])).toEqual({ pescadores: 7, reservas: 5 });
    expect(totalesVentana(V['90d']).pescadores).toBe(9);
    expect(totalesVentana(V.temporada)).toEqual({ pescadores: 13, reservas: 10 });
  });
  it('All Inclusive Brasil solo se ve con reservas', () => {
    expect(cajasVisibles(V['30d']).map(claveCaja)).not.toContain('ALL_INCLUSIVE:BR');
    expect(cajasVisibles(V.temporada).map(claveCaja)).toContain('ALL_INCLUSIVE:BR');
  });
  it('texto del lector y línea sin fecha según el período', () => {
    expect(textoEstadoPeriodo('30d', '2026-27', V['30d'])).toBe('Mostrando los últimos 30 días: 5 reservas, 7 pescadores.');
    expect(textoEstadoPeriodo('temporada', '2026-27', V.temporada)).toBe('Mostrando toda la temporada 2026-27: 10 reservas, 13 pescadores.');
    expect(textoSinFecha('30d', V['30d'])).toBe('1 reserva confirmada no tiene fecha de confirmación: solo entra en «Temporada».');
    expect(textoSinFecha('temporada', V['30d'])).toBeNull();
  });
  it('frase: con menos de 10 no hay líder; en temporada empieza con «Esta temporada»', () => {
    expect(fraseVentana(V['30d'], '30d', D.periodo, '2026-10-18')).toMatch(/^En los últimos 30 días: 7 pescadores en 5 reservas\. Con menos de 10/);
    expect(cajaMasVendida(V['30d'])).toBeNull();
    expect(fraseVentana(V.temporada, 'temporada', D.periodo, '2026-10-18')).toMatch(/^Esta temporada/);
  });
  it('período sin reservas: sin frase', () => {
    const v = { ...V['30d'], cajas: V['30d'].cajas.map((c) => ({ ...c, reservas: 0, pescadores: 0, jornadas: null, montos: [], sin_calcular: 0 })), otros: { reservas: 0, pescadores: 0 }, mercados: [], programas: [] };
    expect(fraseVentana(v, '30d', D.periodo, '2026-10-18')).toBeNull();
  });
});

describe('estado de cada caja', () => {
  it('caja en 0, sin plata, parcial y completa', () => {
    expect(estadoCaja(caja(V['30d'], 'FULL_DAY:CL'))).toBe('cero');
    expect(estadoCaja(caja(V.temporada, 'FULL_DAY:BR'))).toBe('parcial');
    expect(reservasConPlata(caja(V.temporada, 'FULL_DAY:BR'))).toBe(1);
    expect(caja(V.temporada, 'FULL_DAY:BR').sin_calcular).toBe(2);
    expect(estadoCaja(caja(V['30d'], 'FULL_DAY:USA'))).toBe('completa');
    expect(estadoCaja({ ...caja(V.temporada, 'FULL_DAY:BR'), montos: [] })).toBe('sin-plata');
  });
  it('USD antes que CLP, nunca sumados', () => {
    const m = ordenarMontos([
      { moneda: 'CLP', reservas: 1, venta: 1, costo: 1, ganancia: 0, margen: 0 },
      { moneda: 'USD', reservas: 1, venta: 1, costo: 1, ganancia: 0, margen: 0 },
    ]);
    expect(m.map((x) => x.moneda)).toEqual(['USD', 'CLP']);
  });
});

describe('margen contra la lista', () => {
  it('Full Day USA 26,6 % contra 29,0 % de lista: bajo lista', () => {
    const lista = margenListaDe(D.tarifas, 'FULL_DAY', 'USA', 'USD');
    expect(lista).toBe(29);
    expect(bajoLista(caja(V.temporada, 'FULL_DAY:USA').montos[0].margen, lista)).toBe(true);
  });
  it('igual a la lista no es bajo lista; se compara con 1 decimal', () => {
    expect(bajoLista(16.7, 16.7)).toBe(false);
    expect(bajoLista(16.66, 16.7)).toBe(false);
    expect(bajoLista(null, 16.7)).toBe(false);
  });
  it('Full Day Brasil (precio en USD, costo en CLP) no compara', () => {
    expect(margenListaDe(D.tarifas, 'FULL_DAY', 'BR', 'USD')).toBeNull();
  });
});

describe('gráficos: pescadores, nunca plata', () => {
  it('barras con la misma escala y «Otros» al final', () => {
    const b = barrasDe(V['30d']);
    expect(b.total).toBe(7);
    expect(b.grupos.flatMap((g) => g.filas).find((f) => f.clave === 'FULL_DAY:USA')!.pct).toBeGreaterThan(0);
    // `otros` de 30d = All Inclusive Chile: va en «Otros», no en la cabecera de AI.
    expect(b.otros?.pescadores).toBe(1);
    expect(b.grupos.find((g) => g.programa === 'ALL_INCLUSIVE')!.pescadores).toBe(0);
    expect(b.grupos.flatMap((g) => g.filas).map((f) => f.clave)).not.toContain('ALL_INCLUSIVE:BR');
  });
  const cuadre = (v: VentasVentana) => {
    const b = barrasDe(v);
    for (const g of b.grupos) {
      // Cabecera = Σ de sus filas (opción A del coordinador, 18-oct).
      expect(g.pescadores).toBe(g.filas.reduce((a, f) => a + f.pescadores, 0));
      expect(g.reservas).toBe(g.filas.reduce((a, f) => a + f.reservas, 0));
    }
    const otros = b.otros?.pescadores ?? 0;
    expect(b.grupos.reduce((a, g) => a + g.pescadores, 0) + otros).toBe(b.total);
    const pct = b.grupos.reduce((a, g) => a + g.pct, 0) + (b.otros?.pct ?? 0);
    expect(Math.abs(pct - 100)).toBeLessThanOrEqual(1);
    return b;
  };
  it.each(['30d', '90d', 'temporada'] as const)('sin doble conteo en %s (fixture real): Σ cabeceras + Otros = N y Σ %% ≈ 100', (k) => {
    cuadre(V[k]);
  });
  it('sin doble conteo con AI Chile y sin clasificar a la vez', () => {
    // Temporada real con `otros` = AI Chile (1) + 2 reservas sin programa (2).
    const b = cuadre({ ...V.temporada, otros: { reservas: 3, pescadores: 3 } });
    expect(b.total).toBe(15);
    expect(b.grupos.find((g) => g.programa === 'ALL_INCLUSIVE')!.pescadores).toBe(3);
    expect(b.otros).toMatchObject({ pescadores: 3, reservas: 3 });
    expect(detalleBarra(b.otros!)).toBe('Otros: 3 pescadores en 3 reservas (All Inclusive Chile y sin programa) · 20\u00a0% de los pescadores del período.');
  });
  it('«Más vendido»: N ≥ 10 en total y sin empate (spec §5 y §8.2); bajo 10 no se nombra', () => {
    expect(V['30d'].cajas.reduce((a, c) => a + c.pescadores, 0) + V['30d'].otros.pescadores).toBe(7);
    expect(cajaMasVendida(V['30d'])).toBeNull();
    expect(cajaMasVendida(V['90d'])).toBeNull();
    // Temporada: N = 13, Full Day USA 5 es el único máximo.
    expect(cajaMasVendida(V.temporada)).toBe('FULL_DAY:USA');
    const empate = { ...V.temporada, cajas: V.temporada.cajas.map((c) => (c.programa === 'FULL_DAY' && c.mercado === 'BR' ? { ...c, pescadores: 5 } : c)) };
    expect(cajaMasVendida(empate)).toBeNull();
  });
  it('la dona suma N; «Sin mercado» aparece si los mercados no llegan a N', () => {
    const s = sectoresDe(V.temporada);
    expect(s.reduce((a, x) => a + x.pescadores, 0)).toBe(13);
    expect(s.map((x) => x.clave)).toEqual(['USA', 'BR', 'CL']);
    const corto = sectoresDe({ ...V.temporada, mercados: V.temporada.mercados.map((m) => (m.mercado === 'CL' ? { ...m, pescadores: 0 } : m)) });
    expect(corto.at(-1)).toMatchObject({ clave: 'sin', pescadores: 2 });
    expect(corto.reduce((a, x) => a + x.largo, 0)).toBeCloseTo(1);
  });
});
