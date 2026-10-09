import { describe, expect, it } from 'vitest';
import type { StoreGarantia } from '../../types';
import { SIN_FILTROS, anioDe, filtrarGarantias, formatearRut, lineaAviso, opcionesDe, rutValido } from './garantias';

// Qué afirma este archivo: que el RUT se valida con el dígito verificador y
// se guarda siempre con puntos y guion, y que los filtros del listado agrupan
// una misma región o caña aunque esté escrita distinto.

describe('RUT', () => {
  it.each(['12345678-5', '12.345.678-5', '123456785', ' 12.345.678-5 '])('acepta «%s» y lo deja como 12.345.678-5', (t) => {
    expect(rutValido(t)).toBe(true);
    expect(formatearRut(t)).toBe('12.345.678-5');
  });

  it('acepta la K en minúscula y cuerpos de 7 dígitos', () => {
    expect(formatearRut('8888888-k')).toBe('8.888.888-K');
    expect(formatearRut('1234567-4')).toBe('1.234.567-4');
  });

  it.each(['12.345.678-9', '123-4', '', 'abc', '1234567890-1'])('rechaza «%s» y no lo toca', (t) => {
    expect(rutValido(t)).toBe(false);
    expect(formatearRut(t)).toBe(t.trim());
  });
});

const BASE: StoreGarantia = {
  solicitud_id: 'GAR-1',
  estado: 'recibida',
  origen: 'web',
  created_at: '2026-10-01T15:00:00+00:00',
  actualizada_en: '',
  nombre: 'Ana',
  rut: '',
  email: 'ana@example.cl',
  telefono: '',
  direccion: '',
  direccion_calle: '',
  comuna: '',
  region: 'Aysén',
  cana: 'SKY G',
  modelo: '',
  tramo: '1',
  descripcion: '',
  costo_clp: 50000,
  costo_despacho_clp: null,
  costo_douglas_clp: null,
  pagado: false,
  fecha_pago: '',
  courier: '',
  numero_seguimiento: '',
  fecha_despacho: '',
  fecha_entrega: '',
  persona: 'ana@example.cl',
  veces_usada: 1,
  nota_interna: '',
};

const LISTA: StoreGarantia[] = [
  BASE,
  { ...BASE, solicitud_id: 'GAR-2', cana: ' sky g ', region: 'Los Lagos', created_at: '2025-12-31T23:30:00+00:00', veces_usada: 2 },
  { ...BASE, solicitud_id: 'GAR-3', cana: 'DXF', region: 'aysén', created_at: '2025-03-01T10:00:00+00:00' },
  { ...BASE, solicitud_id: 'GAR-4', cana: 'DXF', region: '', created_at: '2026-01-01T10:00:00+00:00' },
];

describe('filtros del listado', () => {
  it('el año es el de la solicitud', () => {
    expect(anioDe(BASE)).toBe('2026');
    // GAR-2 es del 31 de diciembre a las 23:30 UTC: cuenta en 2025, como
    // dice created_at. A igual cantidad, el orden es alfabético.
    expect(opcionesDe(LISTA, anioDe).map((o) => [o.valor, o.cuantas])).toEqual([
      ['2025', 2],
      ['2026', 2],
    ]);
  });

  it('agrupa la misma caña o región escrita distinto, de más a menos casos', () => {
    expect(opcionesDe(LISTA, (g) => g.cana)).toEqual([
      { valor: 'dxf', label: 'DXF', cuantas: 2 },
      { valor: 'sky g', label: 'SKY G', cuantas: 2 },
    ]);
    expect(opcionesDe(LISTA, (g) => g.region).map((o) => o.label)).toEqual(['Aysén', 'Los Lagos']);
  });

  it('filtra por año, región y caña a la vez, y por reincidentes', () => {
    const ids = (f: Partial<typeof SIN_FILTROS>) => filtrarGarantias(LISTA, { ...SIN_FILTROS, ...f }).map((g) => g.solicitud_id);
    expect(ids({})).toEqual(['GAR-1', 'GAR-2', 'GAR-3', 'GAR-4']);
    expect(ids({ region: 'aysén' })).toEqual(['GAR-1', 'GAR-3']);
    expect(ids({ anio: '2025', cana: 'dxf' })).toEqual(['GAR-3']);
    expect(ids({ soloReincidentes: true })).toEqual(['GAR-2']);
    expect(ids({ anio: '2026', cana: 'sky g' })).toEqual(['GAR-1']);
  });
});

describe('lineaAviso', () => {
  const base = { estado: 'despachada' } as StoreGarantia;
  const aviso = (extra: Partial<NonNullable<StoreGarantia['aviso']>>) =>
    ({ ...base, aviso: { accion: 'notificar', estado: '', cambio_desde_aviso: false, recepcion: null, ...extra } }) as StoreGarantia;

  it('sin aviso del backend no dice nada', () => {
    expect(lineaAviso(base)).toBeNull();
  });

  it('una despachada sin avisar se marca', () => {
    expect(lineaAviso(aviso({}))).toEqual({ texto: 'Sin avisar', tono: 'alerta' });
  });

  it('una sin despachar no se marca', () => {
    expect(lineaAviso({ ...aviso({ accion: '' }), estado: 'recibida' })).toBeNull();
  });

  it('el rechazo, la duda y lo desactualizado se distinguen', () => {
    expect(lineaAviso(aviso({ estado: 'fallido' }))?.tono).toBe('critico');
    expect(lineaAviso(aviso({ estado: 'incierto', accion: 'reenviar' }))?.texto).toBe('Aviso sin confirmar');
    expect(lineaAviso(aviso({ estado: 'leido', accion: 'reenviar', cambio_desde_aviso: true }))?.texto).toBe('Aviso desactualizado');
  });

  it('la recepción manda sobre todo lo demás', () => {
    expect(lineaAviso(aviso({ estado: 'leido', accion: '', recepcion: { confirmada_en: 'x', via: 'whatsapp' } }))).toEqual({ texto: 'Confirmó que lo recibió', tono: 'bien' });
  });
});
