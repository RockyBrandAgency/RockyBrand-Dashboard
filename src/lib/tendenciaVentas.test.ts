import { describe, expect, it } from 'vitest';
import { escalaDe, etiquetaTramo, fraseTendencia, lunesDe, tendenciaDe, textoTramo } from './tendenciaVentas';
import type { VentasReserva } from '../types';

const r = (FechaConfirmacion: string | null, Pescadores: number | null, Programa: VentasReserva['Programa'] = 'FULL_DAY', Mercado: VentasReserva['Mercado'] = 'USA'): VentasReserva =>
  ({ BookingID: `b${Math.random()}`, GuestID: 'g', GuestName: 'x', Programa, Mercado, CheckIn: '2026-11-01', CheckOut: '2026-11-02', Pescadores, Jornadas: 1, Moneda: 'USD', Venta: null, Costo: null, Utilidad: null, Porcentaje: null, Reason: null, FechaConfirmacion }) as VentasReserva;

describe('tendencia por fecha de confirmación (hora de Chile)', () => {
  it('30 días va por día; 90 días y Temporada, por semana', () => {
    expect(escalaDe('30d')).toBe('dia');
    expect(escalaDe('90d')).toBe('semana');
    expect(escalaDe('temporada')).toBe('semana');
  });

  it('por día: un tramo por cada día del período, con los dos extremos, y suma pescadores por día', () => {
    const t = tendenciaDe([r('2026-09-19', 1), r('2026-10-14', 1), r('2026-10-14', 3, 'ALL_INCLUSIVE'), r('2026-10-18', 2), r('2026-09-18', 5), r('2026-10-19', 5)], { desde: '2026-09-19', hasta: '2026-10-18' }, '30d');
    expect(t.tramos).toHaveLength(30);
    expect(t.tramos[0]).toMatchObject({ desde: '2026-09-19', hasta: '2026-09-19', total: 1 });
    expect(t.tramos[29]).toMatchObject({ desde: '2026-10-18', total: 2 });
    const d14 = t.tramos.find((x) => x.desde === '2026-10-14')!;
    expect(d14).toMatchObject({ ai: 3, fd: 1, total: 4, reservas: 2 });
    // Lo confirmado fuera del período (18-sep y 19-oct) no entra.
    expect(t.total).toBe(7);
    expect(t.reservas).toBe(4);
  });

  it('por semana: de lunes a domingo (ISO 8601), recortada al período', () => {
    expect(lunesDe('2026-10-18')).toBe('2026-10-12'); // domingo → su lunes
    expect(lunesDe('2026-10-19')).toBe('2026-10-19'); // lunes
    expect(lunesDe('2026-01-01')).toBe('2025-12-29'); // cruza el año
    const t = tendenciaDe([r('2026-10-18', 2), r('2026-10-19', 1), r('2026-07-21', 1)], { desde: '2026-07-21', hasta: '2026-10-19' }, '90d');
    expect(t.tramos[0]).toMatchObject({ desde: '2026-07-21', hasta: '2026-07-26', total: 1 });
    const fin = t.tramos.at(-1)!;
    expect(fin).toMatchObject({ desde: '2026-10-19', hasta: '2026-10-19', total: 1 });
    expect(t.tramos.find((x) => x.desde === '2026-10-12')).toMatchObject({ hasta: '2026-10-18', total: 2 });
    expect(t.total).toBe(4);
  });

  it('el día viene ya en hora de Chile: no se corre con la zona del navegador', () => {
    // vitest.config.ts fija TZ=America/Santiago (test.env): si no se aplicara, esto falla.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Santiago');
    expect(new Date('2026-10-01').getDate()).toBe(30); // medianoche UTC = 30-sep en Chile
    // 1 de octubre a medianoche: con new Date('2026-10-01') en una zona al oeste de UTC caería el 30-sep.
    const t = tendenciaDe([r('2026-10-01', 1)], { desde: '2026-10-01', hasta: '2026-10-01' }, '30d');
    expect(t.tramos[0]).toMatchObject({ desde: '2026-10-01', total: 1 });
    expect(etiquetaTramo({ desde: '2026-10-01', hasta: '2026-10-01' })).toBe('1 oct');
    expect(etiquetaTramo({ desde: '2026-09-28', hasta: '2026-10-04' })).toBe('28 sept – 4 oct');
    expect(etiquetaTramo({ desde: '2026-10-12', hasta: '2026-10-18' })).toBe('12–18 oct');
  });

  it('Temporada: parte en la primera confirmación y deja fuera, contadas, las reservas sin fecha', () => {
    const t = tendenciaDe([r('2025-12-20', 1), r('2026-10-14', 4), r(null, 1), r('mal', 1)], { desde: null, hasta: '2026-10-18' }, 'temporada');
    expect(t.tramos[0].desde).toBe('2025-12-20');
    expect(t.sinFecha).toBe(2);
    expect(t.total).toBe(5);
    expect(t.conAno).toBe(true);
    expect(fraseTendencia(t)).toBe('Mejor semana: 12–18 oct 2026, 4 pescadores (Full Day 4).');
  });

  it('el máximo: el tramo con más pescadores; si empata, el primero y cuántos empatan', () => {
    const t = tendenciaDe([r('2026-10-01', 2), r('2026-10-03', 5, 'ALL_INCLUSIVE'), r('2026-10-07', 5)], { desde: '2026-10-01', hasta: '2026-10-10' }, '30d');
    expect(t.maximo).toMatchObject({ desde: '2026-10-03', total: 5 });
    expect(t.empatados).toBe(1);
    expect(fraseTendencia(t)).toBe('Mejor día: 3 oct, 5 pescadores (All Inclusive 5; empata con otro).');
    expect(textoTramo(t.maximo!, false)).toBe('3 oct: 5 pescadores (All Inclusive 5).');
  });

  it('una sola venta: lo dice y no la llama tendencia', () => {
    const t = tendenciaDe([r('2026-10-14', 3)], { desde: '2026-09-19', hasta: '2026-10-18' }, '30d');
    expect(t.maximo?.desde).toBe('2026-10-14');
    expect(fraseTendencia(t)).toBe('Una sola venta en el período: 14 oct, 3 pescadores (Full Day 3). Con una venta todavía no hay tendencia.');
  });

  it('vacío: sin ventas, sin máximo y con su frase', () => {
    const a = tendenciaDe([], { desde: '2026-09-19', hasta: '2026-10-18' }, '30d');
    expect(a.maximo).toBeNull();
    expect(a.total).toBe(0);
    expect(fraseTendencia(a)).toBe('Sin ventas con fecha de confirmación en este período.');
    const b = tendenciaDe([r(null, 2)], { desde: null, hasta: '2026-10-18' }, 'temporada');
    expect(b.tramos).toEqual([]);
    expect(b.sinFecha).toBe(1);
    expect(b.maximo).toBeNull();
  });

  it('semana ISO que cruza el año: 31-dic y 2-ene caen en la semana del lunes 29-dic, y la etiqueta lleva los dos años', () => {
    const t = tendenciaDe([r('2025-12-31', 1), r('2026-01-02', 2), r('2026-01-05', 1)], { desde: '2025-12-24', hasta: '2026-01-10' }, '90d');
    const s = t.tramos.find((x) => x.desde === '2025-12-29')!;
    expect(s).toMatchObject({ hasta: '2026-01-04', total: 3, reservas: 2 });
    expect(t.tramos.map((x) => x.desde)).toEqual(['2025-12-24', '2025-12-29', '2026-01-05']);
    expect(t.conAno).toBe(true);
    expect(etiquetaTramo(s, t.conAno)).toBe('29 dic 2025 – 4 ene 2026');
    expect(fraseTendencia(t)).toBe('Mejor semana: 29 dic 2025 – 4 ene 2026, 3 pescadores (Full Day 3).');
  });

  it('mismo criterio que las barras: AI Chile y lo que no tiene programa o mercado van a «Otros»', () => {
    const t = tendenciaDe(
      [r('2026-10-14', 1, 'ALL_INCLUSIVE', 'CL'), r('2026-10-14', 2, 'ALL_INCLUSIVE', null), r('2026-10-14', 4, 'ALL_INCLUSIVE', 'BR'), r('2026-10-14', 3, 'FULL_DAY', 'CL'), r('2026-10-14', 5, 'FULL_DAY', null), r('2026-10-14', 6, null, 'USA')],
      { desde: '2026-10-14', hasta: '2026-10-14' },
      '30d',
    );
    expect(t.tramos[0]).toMatchObject({ ai: 4, fd: 3, otros: 14, total: 21, reservas: 6 });
    expect(textoTramo(t.tramos[0], false)).toBe('14 oct: 21 pescadores (All Inclusive 4, Full Day 3, Otros 14).');
  });

  it('ventas sin pescadores informados: no dice «Sin ventas», dice cuántas hubo', () => {
    const una = tendenciaDe([r('2026-10-14', 0)], { desde: '2026-09-19', hasta: '2026-10-18' }, '30d');
    expect(una).toMatchObject({ total: 0, reservas: 1, maximo: null });
    expect(fraseTendencia(una)).toBe('1 venta en el período, sin pescadores informados.');
    const tres = tendenciaDe([r('2026-10-14', 0), r('2026-10-15', null), r('2026-10-16', -2)], { desde: '2026-09-19', hasta: '2026-10-18' }, '30d');
    expect(fraseTendencia(tres)).toBe('3 ventas en el período, sin pescadores informados.');
  });
});
