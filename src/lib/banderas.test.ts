import { describe, expect, it } from 'vitest';
import fixture from '../pages/Reservas/__fixtures__/ventas-backend-2026-10-17.json';
import { banderaDeMercado, banderaDePais, codigoPais, emojiBandera } from './banderas';

describe('banderas (17-oct)', () => {
  it('arma la bandera con los regional indicators del código ISO', () => {
    expect(emojiBandera('US')).toBe('\u{1F1FA}\u{1F1F8}');
    expect(emojiBandera('CL')).toBe('🇨🇱');
    expect(emojiBandera('us')).toBeNull();
    expect(emojiBandera('USA')).toBeNull();
  });

  it('reconoce el nombre en inglés del formulario, en español y el código', () => {
    expect(banderaDePais('United States')).toBe('🇺🇸');
    expect(banderaDePais('Estados Unidos')).toBe('🇺🇸');
    expect(banderaDePais('EEUU')).toBe('🇺🇸');
    expect(banderaDePais('Brazil')).toBe('🇧🇷');
    expect(banderaDePais('  brasil ')).toBe('🇧🇷');
    expect(banderaDePais('Chile')).toBe('🇨🇱');
    expect(banderaDePais('España')).toBe('🇪🇸');
    expect(banderaDePais('México')).toBe('🇲🇽');
    expect(codigoPais('United  Kingdom')).toBe('GB');
  });

  it('sin país o país desconocido: sin bandera, nunca se adivina', () => {
    for (const p of [null, undefined, '', '   ', 'Atlantis', 'no', 'constructor']) expect(banderaDePais(p)).toBeNull();
  });

  it('todos los países del fixture real tienen bandera', () => {
    const paises = new Set<string>();
    JSON.stringify(fixture, (k, v) => {
      if (k === 'GuestOriginCountry' && typeof v === 'string') paises.add(v);
      return v;
    });
    expect([...paises].sort()).toEqual(['Brazil', 'Chile', 'United States']);
    for (const p of paises) expect(banderaDePais(p)).not.toBeNull();
  });

  it('mercados de tarifa: USA, Chile y Brasil', () => {
    expect(banderaDeMercado('USA')).toBe('🇺🇸');
    expect(banderaDeMercado('CL')).toBe('🇨🇱');
    expect(banderaDeMercado('BR')).toBe('🇧🇷');
    expect(banderaDeMercado('AR')).toBeNull();
    expect(banderaDeMercado(null)).toBeNull();
  });
});
