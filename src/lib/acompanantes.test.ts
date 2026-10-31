import { describe, expect, it } from 'vitest';
import {
  BORRADOR_VACIO,
  DOCUMENTO_VACIO,
  documentoABorrador,
  edad,
  errorDeAcompanante,
  errorDeDocumento,
  isoLocal,
  nombreCompleto,
  normalizarBorrador,
  normalizarDocumento,
  tieneDocumento,
} from './acompanantes';

// Qué afirma este archivo: que el panel rechaza antes de mandar lo mismo que
// rechaza pms_models.validar_acompanantes, con un mensaje que entiende quien
// opera el lodge, y que la edad no se corre un año por la zona horaria.

const HOY = new Date(2026, 9, 5); // 5 de octubre de 2026, hora local
const base = { ...BORRADOR_VACIO, FirstName: 'Mary' };

describe('errorDeAcompanante', () => {
  it('acepta un acompañante con solo el nombre', () => {
    expect(errorDeAcompanante(base, HOY)).toBeNull();
  });

  it('exige el nombre, aunque vengan solo espacios', () => {
    expect(errorDeAcompanante({ ...base, FirstName: '   ' }, HOY)).toBe('Falta el nombre.');
  });

  it('exige el detalle si marcó alergia, y no si marcó que no', () => {
    expect(errorDeAcompanante({ ...base, FoodAllergy: true, FoodAllergyDetail: ' ' }, HOY)).toBe('Indica a qué tiene alergia.');
    expect(errorDeAcompanante({ ...base, FoodAllergy: true, FoodAllergyDetail: 'Maní' }, HOY)).toBeNull();
    expect(errorDeAcompanante({ ...base, FoodAllergy: false, FoodAllergyDetail: '' }, HOY)).toBeNull();
  });

  it('rechaza fechas futuras, inexistentes o anteriores a 1900, y acepta hoy', () => {
    expect(errorDeAcompanante({ ...base, BirthDate: '2026-10-06' }, HOY)).toMatch(/posterior a hoy/);
    expect(errorDeAcompanante({ ...base, BirthDate: '1980-02-30' }, HOY)).toMatch(/no es válida/);
    expect(errorDeAcompanante({ ...base, BirthDate: '1899-12-31' }, HOY)).toMatch(/no es válida/);
    expect(errorDeAcompanante({ ...base, BirthDate: '2026-10-05' }, HOY)).toBeNull();
  });

  it('respeta los mismos topes de largo que el servidor', () => {
    expect(errorDeAcompanante({ ...base, LastName: 'x'.repeat(81) }, HOY)).toMatch(/80/);
    expect(errorDeAcompanante({ ...base, Notes: 'x'.repeat(1001) }, HOY)).toMatch(/1000/);
    expect(errorDeAcompanante({ ...base, FoodAllergy: true, FoodAllergyDetail: 'x'.repeat(301) }, HOY)).toMatch(/300/);
  });
});

describe('normalizarBorrador', () => {
  it('recorta espacios y descarta el detalle de una alergia marcada en No', () => {
    expect(
      normalizarBorrador({ ...base, FirstName: ' Mary ', LastName: ' Smith ', FoodAllergy: false, FoodAllergyDetail: 'Maní', Notes: ' no pesca ' }),
    ).toEqual({ FirstName: 'Mary', LastName: 'Smith', BirthDate: null, FoodAllergy: false, FoodAllergyDetail: '', Notes: 'no pesca' });
  });

  it('conserva el CompanionID de uno existente y no inventa uno para uno nuevo', () => {
    expect(normalizarBorrador({ ...base, CompanionID: 'cmp_0123456789ab' }).CompanionID).toBe('cmp_0123456789ab');
    expect('CompanionID' in normalizarBorrador(base)).toBe(false);
  });
});

describe('edad', () => {
  it('cuenta el cumpleaños recién cuando llega', () => {
    expect(edad('1980-10-05', HOY)).toBe(46);
    expect(edad('1980-10-06', HOY)).toBe(45);
    expect(edad(null, HOY)).toBeNull();
    expect(edad('no-es-fecha', HOY)).toBeNull();
  });
});

describe('isoLocal y nombreCompleto', () => {
  it('usa la fecha local, no la de UTC', () => {
    // 23:30 del 5 en Chile ya es el 6 en UTC: el máximo del selector no puede saltar al 6.
    expect(isoLocal(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05');
  });

  it('no deja un espacio colgando si no hay apellido', () => {
    expect(nombreCompleto({ FirstName: 'Mary', LastName: '' })).toBe('Mary');
    expect(nombreCompleto({ FirstName: 'Mary', LastName: 'Smith' })).toBe('Mary Smith');
  });
});

describe('documento del acompañante', () => {
  const doc = { ...DOCUMENTO_VACIO, Type: 'PASSPORT' as const, Number: 'X1' };

  it('en blanco es válido y no se manda', () => {
    expect(errorDeDocumento(DOCUMENTO_VACIO)).toBeNull();
    expect(normalizarDocumento(DOCUMENTO_VACIO, '1980-03-12')).toBeNull();
  });

  it('si viene, exige tipo y número (como validar_documento)', () => {
    expect(errorDeDocumento({ ...DOCUMENTO_VACIO, Nationality: 'USA' })).toBe('Elige el tipo de documento.');
    expect(errorDeDocumento({ ...doc, Number: '   ' })).toBe('Falta el número del documento.');
    expect(errorDeDocumento({ ...doc, EntryDate: '2027-02-30' })).toBe('La fecha de ingreso no es válida.');
    expect(errorDeDocumento(doc)).toBeNull();
  });

  it('normaliza: recorta, nacionalidad en mayúsculas, sin fechas vacías', () => {
    expect(normalizarDocumento({ ...doc, Number: ' X1 ', Nationality: ' bra ' }, null)).toEqual({ Type: 'PASSPORT', Number: 'X1', Nationality: 'BRA' });
    expect(normalizarDocumento({ ...doc, EntryDate: '2027-01-10' }, '1980-03-12')).toEqual({
      Type: 'PASSPORT',
      Number: 'X1',
      Nationality: '',
      BirthDate: '1980-03-12',
      EntryDate: '2027-01-10',
    });
  });

  it('sin fecha del acompañante conserva la que ya traía el documento', () => {
    const anterior = { Type: 'RUT' as const, Number: '1-9', Nationality: 'CHL', BirthDate: '1975-05-01' };
    expect(normalizarDocumento({ ...doc, Type: 'RUT', Number: '1-9' }, null, anterior)?.BirthDate).toBe('1975-05-01');
  });

  it('null, {} o la clave ausente no son documento', () => {
    expect(tieneDocumento(null)).toBe(false);
    expect(tieneDocumento({})).toBe(false);
    expect(tieneDocumento(undefined)).toBe(false);
    expect(documentoABorrador({})).toEqual(DOCUMENTO_VACIO);
    expect(documentoABorrador({ Type: 'DNI', Number: '30111222', Nationality: 'ARG' })).toEqual({
      Type: 'DNI',
      Number: '30111222',
      Nationality: 'ARG',
      EntryDate: '',
    });
  });
});
