import { describe, expect, it } from 'vitest';
import fixture from '../pages/Reservas/__fixtures__/ventas-mix-2026-10-17.json';
import type { VentasResponse, VentasSegmento } from '../types';
import { cuadra, fraseMix, masVendido, mercadosDelMes, mercadosOrdenados, mixDe, pctMix, type Mix } from './ventasMix';

const datos = fixture as unknown as VentasResponse;
const periodo = datos.periodo;
const EN_TEMPORADA = '2026-10-17';
const mixFixture = mixDe(datos)!;

/** Mix armado a mano desde segmentos [programa, mercado, reservas, pescadores]. */
function mixCon(segs: [VentasSegmento['programa'], VentasSegmento['mercado'], number, number][]): Mix {
  const segmentos: VentasSegmento[] = segs.map(([programa, mercado, reservas, pescadores]) => ({ programa, mercado, reservas, pescadores, unidades: programa ? pescadores : null, unidad: programa === 'FULL_DAY' ? 'jornada' : programa ? 'pescador' : null }));
  const clas = segmentos.filter((s) => s.programa && s.mercado);
  const suma = (l: VentasSegmento[]) => l.reduce((a, s) => ({ reservas: a.reservas + s.reservas, pescadores: a.pescadores + s.pescadores }), { reservas: 0, pescadores: 0 });
  return {
    segmentos,
    mercados: (['USA', 'BR', 'CL'] as const).map((m) => ({ mercado: m, ...suma(clas.filter((s) => s.mercado === m)) })),
    programas: (['FULL_DAY', 'ALL_INCLUSIVE'] as const).map((p) => {
      const t = suma(clas.filter((s) => s.programa === p));
      return { programa: p, ...t, unidades: t.pescadores, unidad: p === 'FULL_DAY' ? ('jornada' as const) : ('pescador' as const) };
    }),
  };
}

describe('mixDe', () => {
  it('lee el mix del fixture real', () => {
    expect(mixFixture.segmentos).toHaveLength(6);
  });
  it('null con la Lambda anterior (sin los bloques)', () => {
    expect(mixDe({})).toBeNull();
    expect(mixDe({ segmentos: [], mercados: [] })).toBeNull();
    expect(mixDe(null)).toBeNull();
  });
  it('null si un conteo viene mal', () => {
    expect(mixDe({ segmentos: [{ reservas: -1, pescadores: 0 }], mercados: [], programas: [] })).toBeNull();
  });
});

describe('frase (spec §6)', () => {
  it('F4 con el fixture: la frase exacta de la spec', () => {
    expect(fraseMix(mixFixture, periodo, EN_TEMPORADA)).toBe(
      'Esta temporada lidera USA y otros: 6 de 13 pescadores (46\u00a0%). Lo que más se vende es Full Day USA y otros: 5 pescadores en 3 reservas.',
    );
  });
  it('F0: sin reservas no hay frase', () => {
    expect(fraseMix(mixCon([]), periodo, EN_TEMPORADA)).toBeNull();
    expect(fraseMix(mixCon([['FULL_DAY', 'USA', 0, 0]]), periodo, EN_TEMPORADA)).toBeNull();
  });
  it('F1: reservas sin pescadores', () => {
    expect(fraseMix(mixCon([['FULL_DAY', 'USA', 2, 0]]), periodo, EN_TEMPORADA)).toBe('Esta temporada hay 2 reservas confirmadas, pero ninguna tiene número de pescadores.');
  });
  it('F2: menos de 10 pescadores (M3), con singular', () => {
    expect(fraseMix(mixCon([['FULL_DAY', 'USA', 1, 1]]), periodo, EN_TEMPORADA)).toBe('Esta temporada llevas 1 pescador en 1 reserva. Con menos de 10 todavía no se puede decir qué se vende más.');
    expect(fraseMix(mixCon([['FULL_DAY', 'USA', 3, 5], ['ALL_INCLUSIVE', 'BR', 1, 4]]), periodo, EN_TEMPORADA)).toContain('llevas 9 pescadores en 4 reservas. Con menos de 10');
  });
  it('F3: un solo segmento (M2)', () => {
    expect(fraseMix(mixCon([['FULL_DAY', 'USA', 6, 12]]), periodo, EN_TEMPORADA)).toBe('Esta temporada, todos los pescadores son de Full Day USA y otros: 12 en 6 reservas.');
  });
  it('F4: empate de dos mercados y de dos segmentos (M4)', () => {
    const mix = mixCon([['FULL_DAY', 'USA', 2, 5], ['FULL_DAY', 'BR', 2, 5], ['ALL_INCLUSIVE', 'CL', 1, 2]]);
    expect(fraseMix(mix, periodo, EN_TEMPORADA)).toBe(
      'Esta temporada empatan USA y otros, y Brasil: 5 pescadores cada uno, de 12. Lo que más se vende: Full Day USA y otros, y Full Day Brasil, con 5 pescadores cada uno.',
    );
  });
  it('F4: la coma va si cualquiera de los dos nombres trae «y» (no solo el primero)', () => {
    const mix = mixCon([['FULL_DAY', 'BR', 2, 5], ['ALL_INCLUSIVE', 'USA', 2, 5], ['FULL_DAY', 'CL', 1, 2]]);
    expect(fraseMix(mix, periodo, EN_TEMPORADA)).toBe(
      'Esta temporada empatan USA y otros, y Brasil: 5 pescadores cada uno, de 12. Lo que más se vende: Full Day Brasil, y All Inclusive USA y otros, con 5 pescadores cada uno.',
    );
    const sinY = mixCon([['FULL_DAY', 'BR', 2, 5], ['FULL_DAY', 'CL', 2, 5], ['ALL_INCLUSIVE', 'USA', 1, 2]]);
    expect(fraseMix(sinY, periodo, EN_TEMPORADA)).toContain('empatan Brasil y Chile: 5 pescadores cada uno');
    expect(fraseMix(sinY, periodo, EN_TEMPORADA)).toContain('Lo que más se vende: Full Day Brasil y Full Day Chile, con');
  });
  it('F4: empate de tres mercados; con tres segmentos empatados se omite la frase B', () => {
    const mix = mixCon([['FULL_DAY', 'USA', 2, 4], ['FULL_DAY', 'BR', 2, 4], ['ALL_INCLUSIVE', 'CL', 1, 4]]);
    expect(fraseMix(mix, periodo, EN_TEMPORADA)).toBe('Esta temporada empatan los tres mercados: 4 pescadores cada uno.');
  });
  it('M8: temporada pasada empieza con «En la temporada»', () => {
    expect(fraseMix(mixFixture, periodo, '2027-06-01')).toMatch(/^En la temporada 2026-27 lidera USA y otros/);
  });
  it('sin pescadores clasificados no hay frase A (ni B): null', () => {
    expect(fraseMix(mixCon([[null, null, 3, 12]]), periodo, EN_TEMPORADA)).toBeNull();
    expect(fraseMix(mixCon([[null, 'USA', 2, 6], ['FULL_DAY', null, 2, 6]]), periodo, EN_TEMPORADA)).toBeNull();
  });
  it('con algo clasificado, la frase A cuenta sobre todos los pescadores', () => {
    expect(fraseMix(mixCon([[null, null, 3, 12], ['FULL_DAY', 'BR', 1, 2]]), periodo, EN_TEMPORADA)).toBe(
      'Esta temporada lidera Brasil: 2 de 14 pescadores (14\u00a0%). Lo que más se vende es Full Day Brasil: 2 pescadores en 1 reserva.',
    );
  });
  it('el % va pegado a la cifra con espacio no separable (U+00A0), sin espacio común', () => {
    const f = fraseMix(mixFixture, periodo, EN_TEMPORADA)!;
    expect(f).toContain('46\u00a0%');
    expect(f).not.toMatch(/ %/);
  });
  it('sin dinero ni tendencias', () => {
    expect(fraseMix(mixFixture, periodo, EN_TEMPORADA)).not.toMatch(/USD|CLP|\$|sube|baja|más que/);
  });
});

describe('cuadra (M6)', () => {
  it('el fixture cuadra con su resumen', () => {
    expect(cuadra(mixFixture, datos.resumen)).toBe(true);
  });
  it('no cuadra si el resumen dice otra cosa', () => {
    const resumen = { ...datos.resumen, full_day: { ...datos.resumen.full_day, pescadores: 10 } };
    expect(cuadra(mixFixture, resumen)).toBe(false);
  });
  it('no cuadra si los mercados no suman lo de los programas', () => {
    const mix = { ...mixFixture, mercados: mixFixture.mercados.map((m) => (m.mercado === 'CL' ? { ...m, pescadores: 9 } : m)) };
    expect(cuadra(mix, datos.resumen)).toBe(false);
  });
});

describe('orden, % y «Más vendido»', () => {
  it('parte A: USA 6 · 46 %, Brasil 5 · 38 %, Chile 2 · 15 %', () => {
    expect(mercadosOrdenados(mixFixture).map((m) => [m.mercado, m.pescadores, pctMix(m.pescadores, 13)])).toEqual([
      ['USA', 6, 46],
      ['BR', 5, 38],
      ['CL', 2, 15],
    ]);
  });
  it('empate de mercados: orden fijo USA, BR, CL', () => {
    expect(mercadosOrdenados(mixCon([['FULL_DAY', 'CL', 1, 3], ['FULL_DAY', 'BR', 1, 3]])).map((m) => m.mercado)).toEqual(['BR', 'CL', 'USA']);
  });
  it('pctMix con total 0 da 0', () => {
    expect(pctMix(3, 0)).toBe(0);
  });
  it('«Más vendido»: FD USA con el fixture; nada con N < 10, con empate (M4) ni para lo sin clasificar (M5)', () => {
    expect(masVendido(mixFixture)).toMatchObject({ programa: 'FULL_DAY', mercado: 'USA' });
    expect(masVendido(mixCon([['FULL_DAY', 'USA', 3, 9]]))).toBeNull();
    expect(masVendido(mixCon([['FULL_DAY', 'USA', 2, 5], ['FULL_DAY', 'BR', 2, 5]]))).toBeNull();
    expect(masVendido(mixCon([['FULL_DAY', 'USA', 2, 4], [null, null, 3, 8]]))).toMatchObject({ programa: 'FULL_DAY', mercado: 'USA' });
  });
  it('mercados del mes: orden fijo y sin los que están en 0', () => {
    const oct = datos.meses.find((m) => m.mes === '2026-10')!;
    expect(mercadosDelMes(oct.mercados).map((m) => `${m.mercado} ${m.pescadores}`)).toEqual(['USA 4', 'BR 1', 'CL 1']);
    const ene = datos.meses.find((m) => m.mes === '2027-01')!;
    expect(mercadosDelMes(ene.mercados)).toEqual([]);
    expect(mercadosDelMes(undefined)).toEqual([]);
  });
});
