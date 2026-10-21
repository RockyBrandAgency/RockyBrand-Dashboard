import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReservaResumenItem, VentasReserva, VentasResponse, VentasSegmento, VentasTarifa } from '../../types';

// Qué afirma: Ventas muestra lo vendido, el total y los meses con USD y CLP
// por separado (nunca sumados), los estados vacío y error, y que tocar una
// reserva abre la ficha y volver deja el foco en esa fila.

const { api, auth, Errores } = vi.hoisted(() => ({
  Errores: {
    UnauthorizedError: class UnauthorizedError extends Error {},
    ConflictError: class ConflictError extends Error {},
    SolicitudInvalidaError: class SolicitudInvalidaError extends Error {},
    SinPermisoError: class SinPermisoError extends Error {},
    NoEncontradoError: class NoEncontradoError extends Error {},
    ErrorTransitorio: class ErrorTransitorio extends Error {
      delServidor: boolean;
      constructor(m: string, delServidor = false) {
        super(m);
        this.delServidor = delServidor;
      }
    },
    TimeoutError: class TimeoutError extends Error {},
  },
  api: { getVentas: vi.fn(), getReservasResumen: vi.fn() },
  // Objeto estable: un handleUnauthorized nuevo en cada render reharía la carga sin fin.
  auth: { handleUnauthorized: () => {}, clientId: 'chile-fly-fishing', clientDisplayName: 'Chile Fly Fishing', clientTerminologia: null, features: { pms_ficha_pesca: true, pms_utilidad: true } },
}));

vi.mock('../../api/dashboardApi', () => ({
  getVentas: (...a: unknown[]) => api.getVentas(...a),
  getReservasResumen: (...a: unknown[]) => api.getReservasResumen(...a),
  getHuespedes: () => Promise.resolve({ huespedes: [] }),
  cancelarReserva: vi.fn(),
  confirmarReserva: vi.fn(),
  actualizarReserva: vi.fn(),
  actualizarHuesped: vi.fn(),
  guardarAcompanantes: vi.fn(),
  ...Errores,
}));
vi.mock('../../context/AuthContext', () => ({ usePermiso: () => true,
  useAuth: () => auth,
}));

import REAL from './__fixtures__/ventas-backend-2026-10-17.json';
import MIX from './__fixtures__/ventas-mix-2026-10-17.json';
import VENTANAS from './__fixtures__/ventas-ventanas-2026-10-18.json';
import { barrasDe, ventanasDe } from '../../lib/ventanasVentas';
import { ANCHO_TABLAS, motivoRegla, sinCalcularPorMoneda, textoSinCalcular, VentasLodge } from './VentasLodge';

const PROV = 'Río Baker Guías';
const costos: VentasResponse['costos_fijos'] = [
  { desde: '2026-10-12', proveedor: PROV, programa: 'ALL_INCLUSIVE', mercado: 'USA', unidad: 'pescador', monto: 4200, moneda: 'USD', incluye_licencia: true },
  { desde: '2026-10-12', proveedor: PROV, programa: 'FULL_DAY', mercado: 'CL', unidad: 'jornada', pescadores_por_jornada: 2, monto: 300000, moneda: 'CLP' },
];

function datos(extra: Partial<VentasResponse> = {}): VentasResponse {
  return {
    client_id: 'chile-fly-fishing',
    periodo: { temporada: '2026-27', desde: '2026-10-12', hasta: '2027-04-30' },
    temporadas: ['2026-27', '2025-26'],
    costos_fijos: costos,
    resumen: { full_day: { reservas: 3, jornadas: 4, pescadores: 6 }, all_inclusive: { reservas: 2, pescadores: 3 }, pendientes: { reservas: 1 } },
    totales: { USD: { venta: 52200, costo: 18270, utilidad: 33930, porcentaje: 65 }, CLP: { venta: 700000, costo: 300000, utilidad: 400000, porcentaje: 57.1 } },
    meses: [
      // Mes vacío: el servidor manda todo el período y USD y CLP en 0.
      {
        mes: '2026-10',
        full_day: { reservas: 0, jornadas: 0 },
        all_inclusive: { reservas: 0, pescadores: 0 },
        por_moneda: { USD: { venta: 0, costo: 0, utilidad: 0, porcentaje: null }, CLP: { venta: 0, costo: 0, utilidad: 0, porcentaje: null } },
        reservas: [],
      },
      {
        mes: '2026-11',
        full_day: { reservas: 1, jornadas: 1 },
        all_inclusive: { reservas: 1, pescadores: 2 },
        por_moneda: { CLP: { venta: 700000, costo: 300000, utilidad: 400000, porcentaje: 57.1 }, USD: { venta: 19600, costo: 8400, utilidad: 11200, porcentaje: 57.1 } },
        reservas: [
          { BookingID: 'B1', GuestID: 'G1', GuestName: 'John Carter', Programa: 'ALL_INCLUSIVE', Mercado: 'USA', CheckIn: '2026-11-10', CheckOut: '2026-11-17', Pescadores: 2, Jornadas: null, Moneda: 'USD', Venta: 19600, Costo: 8400, Utilidad: 11200, Porcentaje: 57.1, Reason: null },
          { BookingID: 'B7', GuestID: 'G7', GuestName: 'Juan Pérez', Programa: 'FULL_DAY', Mercado: 'CL', CheckIn: '2026-11-20', CheckOut: '2026-11-21', Pescadores: 1, Jornadas: 1, Moneda: 'USD', Venta: 450, Costo: null, Utilidad: null, Porcentaje: null, Reason: 'MONEDA_DISTINTA' },
          { BookingID: 'B9', GuestID: 'G10', GuestName: 'Carlos Rojas', Programa: 'FULL_DAY', Mercado: 'CL', CheckIn: '2026-11-12', CheckOut: '2026-11-13', Pescadores: 2, Jornadas: 1, Moneda: 'CLP', Venta: 700000, Costo: 300000, Utilidad: 400000, Porcentaje: 57.1, Reason: null },
        ],
      },
    ],
    sin_calcular: [
      { BookingID: 'B7', GuestName: 'Juan Pérez', Reason: 'MONEDA_DISTINTA' },
      { BookingID: 'B12', GuestName: 'Ana Silva', Reason: 'SIN_FECHAS' },
    ],
    ...extra,
  };
}

const reservaB1 = {
  BookingID: 'B1', GuestID: 'G1', Status: 'CONFIRMED', CheckIn: '2026-11-10', CheckOut: '2026-11-17', RoomID: 'ALL_INCLUSIVE',
  Source: 'Directa Web', GuestName: 'John Carter', TotalAmount: 19600, Currency: 'USD', PaymentStatus: 'PAID', Companions: [],
} as ReservaResumenItem;

let container: HTMLDivElement;
let root: Root;

const clientWidthOriginal = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!;

// Tablas o tarjetas se deciden por el ancho del contenido (useAnchoContenido).
// jsdom no tiene maqueta: el ancho se simula, 1080 px en escritorio (1440 con
// la barra lateral) y 300 px en teléfono.
async function render(isDesktop = false, ancho = isDesktop ? 1080 : 300) {
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => ancho });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<VentasLodge isDesktop={isDesktop} tablas={isDesktop} />));
  await act(async () => {});
}

const texto = () => container.textContent ?? '';
const boton = (t: string | RegExp) => Array.from(container.querySelectorAll('button')).find((b) => (typeof t === 'string' ? b.textContent?.trim() === t : t.test(b.textContent ?? '')));

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // jsdom no trae matchMedia; AsyncState y las animaciones lo consultan al montar.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});
beforeEach(() => {
  api.getVentas.mockReset().mockResolvedValue(datos());
  // La lista con ventana de fechas NO trae a B1 (llega fuera de la ventana):
  // la ficha tiene que abrir igual, pidiéndola por booking_id.
  api.getReservasResumen.mockReset().mockImplementation((o?: { bookingId?: string }) =>
    Promise.resolve({ client_id: 'chile-fly-fishing', reservas: o?.bookingId === 'B1' ? [reservaB1] : [] }),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Object.defineProperty(Element.prototype, 'clientWidth', clientWidthOriginal);
});

describe('Ventas del lodge', () => {
  it('muestra lo vendido, las pendientes aparte y los costos fijos en lenguaje simple', async () => {
    await render();
    expect(texto()).toContain('Full Day vendidos4jornadasEn 3 reservas · 6 pescadores');
    // All Inclusive se cuenta en pescadores: el precio y el costo son por pescador.
    expect(texto()).toContain('All Inclusive vendidos3pescadoresEn 2 reservas');
    expect(texto()).toContain('Además hay 1 reserva pendiente de confirmar: no entra en estas cifras.');
    expect(texto()).toContain(`Costos fijos de ${PROV}`);
    expect(texto()).toContain('All Inclusive 🇺🇸USA y otros · USD 4.200 por pescador · Licencia: Incluida, la compra el guía');
    expect(texto()).toContain('Full Day 🇨🇱Chile · CLP 300.000 por jornada, hasta 2 pescadores');
    expect(texto()).toContain('Full Day🇨🇱ChileJuan PérezLa reserva está en USD; los costos están en CLP');
    // Badge de color por programa y bandera del mercado, decorativa (17-oct).
    expect(document.querySelectorAll('.badge-programa--fd').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.badge-programa--ai').length).toBeGreaterThan(0);
    for (const b of document.querySelectorAll('.con-bandera > .bandera')) expect(b.getAttribute('aria-hidden')).toBe('true');
    expect(texto()).toContain('Una venta web se cobra siempre en USD.');
    expect(texto()).toContain('Ana SilvaFaltan las fechas de llegada o salida');
  });

  it('respeta el orden de temporadas del servidor y lee «—» cuando no hubo venta', async () => {
    await render(true);
    const opciones = Array.from(container.querySelectorAll('option')).map((o) => o.value);
    expect(opciones).toEqual(['2026-27', '2025-26']);
    // Octubre está vacío: aparece, sin filas de USD 0 ni CLP 0.
    const octubre = Array.from(container.querySelectorAll('tbody')).find((tb) => tb.textContent?.includes('Octubre 2026'))!;
    expect(octubre).toBeTruthy();
    expect(octubre.textContent).not.toMatch(/USD 0|CLP 0/);
    expect(octubre.textContent).toContain('—');
  });

  it('409: dice que falta configurar la temporada, sin hablar de conexión', async () => {
    api.getVentas.mockRejectedValue(new Errores.ConflictError('temporada no configurada'));
    await render();
    expect(texto()).toContain('Falta configurar las fechas de la temporada.');
    expect(texto()).not.toContain('conexión');
    expect(boton(/Reintentar/)).toBeUndefined();
  });

  it('400: avisa que la temporada no es válida', async () => {
    api.getVentas.mockRejectedValue(new Errores.SolicitudInvalidaError('temporada inválida'));
    await render();
    expect(texto()).toContain('Esa temporada no es válida.');
    expect(texto()).not.toContain('conexión');
  });

  it('USD y CLP van por separado: ninguna tarjeta mezcla monedas ni suma', async () => {
    await render();
    const totales = Array.from(container.querySelectorAll<HTMLElement>('[data-total-moneda]'));
    expect(totales.map((t) => t.dataset.totalMoneda)).toEqual(['USD', 'CLP']);
    expect(totales[0].textContent).toContain('USD 52.200');
    expect(totales[0].textContent).toContain('Ganancia en USDUSD 33.930');
    expect(totales[0].textContent).toContain('CostoUSD 18.270');
    expect(totales[0].textContent).not.toContain('CLP');
    expect(totales[1].textContent).toContain('CLP 700.000');
    expect(totales[1].textContent).not.toContain('USD');
    expect(totales.map((t) => t.textContent)).not.toContain('USD 0');
    expect(texto()).not.toContain('752.200');
    expect(texto()).not.toContain('719.600');
  });

  it('sin reservas confirmadas muestra el estado vacío', async () => {
    api.getVentas.mockResolvedValue(datos({ meses: [], totales: {}, sin_calcular: [], resumen: { full_day: { reservas: 0, jornadas: 0, pescadores: 0 }, all_inclusive: { reservas: 0, pescadores: 0 }, pendientes: { reservas: 0 } } }));
    await render();
    expect(texto()).toContain('Todavía no hay reservas confirmadas en la temporada 2026-27.');
    expect(texto()).not.toContain('Full Day vendidos');
  });

  it('si falla, lo dice y deja reintentar', async () => {
    api.getVentas.mockRejectedValue(new Error('HTTP 500'));
    await render();
    expect(texto()).toContain('No pudimos cargar las ventas. Revisa tu conexión y vuelve a intentarlo.');
    expect(texto()).not.toContain('HTTP 500');
  });

  it('cambiar la temporada vuelve a pedir con ese parámetro', async () => {
    await render();
    const sel = container.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      sel.value = '2025-26';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(api.getVentas).toHaveBeenLastCalledWith('2025-26');
  });

  it.each([false, true])('el mes despliega sus reservas y una reserva abre la ficha (escritorio: %s)', async (isDesktop) => {
    await render(isDesktop);
    const mes = boton(/Noviembre 2026/)!;
    expect(mes.getAttribute('aria-expanded')).toBe('false');
    await act(async () => mes.click());
    expect(mes.getAttribute('aria-expanded')).toBe('true');
    const fila = container.querySelector('[data-fila="B1"]') as HTMLButtonElement;
    // §16.4 (CA-U3/CA-U4): badge y mercado → nombre → meta con íconos → plata.
    const partes = Array.from(fila.querySelectorAll<HTMLElement>(':scope > [data-parte]')).map((p) => p.dataset.parte);
    expect(partes).toEqual(['badge', 'titulo', 'detalle', 'detalle']);
    expect(fila.querySelector('[data-parte="titulo"]')?.textContent).toBe('John Carter');
    const fd = Array.from(container.querySelectorAll<HTMLElement>('[data-fila]')).find((f) => f.querySelector('[data-parte="badge"] .badge-programa')?.textContent === 'Full Day')!;
    const [badge, , meta] = Array.from(fd.querySelectorAll<HTMLElement>(':scope > [data-parte]'));
    expect(badge.textContent).toBe('Full Day🇨🇱Chile');
    expect(meta.textContent).toContain('2 pescadores');
    expect(meta.textContent).toContain('1 jornada');
    for (const d of fila.querySelectorAll('[data-fila-dato]')) expect(d.querySelectorAll('svg[data-icono][aria-hidden="true"]').length).toBe(1);
    await act(async () => fila.click());
    expect(container.querySelector('h1')?.textContent).toBe('John Carter');
    await act(async () => boton('← Ventas')!.click());
    expect(container.querySelector('h1')?.textContent).toBe('Ventas');
    expect(document.activeElement).toBe(container.querySelector('[data-fila="B1"]'));
    expect(api.getReservasResumen).toHaveBeenCalledWith({ bookingId: 'B1' });
  });

  async function abrirB1() {
    await render();
    await act(async () => boton(/Noviembre 2026/)!.click());
    await act(async () => (container.querySelector('[data-fila="B1"]') as HTMLButtonElement).click());
    await act(async () => {});
  }

  it('si pedir la reserva falla (500), muestra el error con «Reintentar» y reintenta', async () => {
    let falla = true;
    api.getReservasResumen.mockImplementation((o?: { bookingId?: string }) =>
      o?.bookingId && falla ? Promise.reject(new Error('HTTP 500')) : Promise.resolve({ client_id: 'x', reservas: o?.bookingId ? [reservaB1] : [] }),
    );
    await abrirB1();
    expect(texto()).toContain('No pudimos abrir la reserva. Revisa tu conexión y vuelve a intentarlo.');
    expect(texto()).not.toContain('no existe');
    falla = false;
    await act(async () => boton(/Reintentar/)!.click());
    await act(async () => {});
    expect(container.querySelector('h1')?.textContent).toBe('John Carter');
  });

  it('404 al pedir la reserva: dice que no existe', async () => {
    api.getReservasResumen.mockImplementation((o?: { bookingId?: string }) =>
      o?.bookingId ? Promise.reject(new Errores.NoEncontradoError('no existe')) : Promise.resolve({ client_id: 'x', reservas: [] }),
    );
    await abrirB1();
    expect(texto()).toContain('Esta reserva no existe.');
    expect(boton(/Reintentar/)).toBeUndefined();
  });

  it('403: dice que Ventas no está activa, sin hablar de conexión', async () => {
    api.getVentas.mockRejectedValue(new Errores.SinPermisoError('forbidden'));
    await render();
    expect(texto()).toContain('Ventas no está activa para esta cuenta.');
    expect(texto()).not.toContain('conexión');
  });

  it('reglas descartadas: avisa cuántas y por qué, con texto genérico si el código es desconocido', async () => {
    api.getVentas.mockResolvedValue(datos({ reglas_descartadas: [
      { indice: 2, motivo: 'MONTO_INVALIDO', programa: 'FULL_DAY', proveedor: PROV },
      { indice: 4, motivo: 'CODIGO_NUEVO_X' },
    ] }));
    await render();
    expect(texto()).toContain('2 reglas de costo no se usan porque tienen un error en la configuración:');
    expect(texto()).toContain('Regla 3 (Full Day): el monto está mal escrito o es negativo.');
    expect(texto()).toContain('Regla 5: tiene un dato que falta o está mal escrito.');
    expect(texto()).not.toContain('CODIGO_NUEVO_X');
  });

  it('una regla con campos faltantes no pinta undefined ni NaN', async () => {
    const rota = { proveedor: PROV, programa: 'FULL_DAY' } as unknown as VentasResponse['costos_fijos'][number];
    api.getVentas.mockResolvedValue(datos({ costos_fijos: [...costos, rota] }));
    await render();
    expect(texto()).not.toMatch(/undefined|NaN|null/);
    expect(texto()).toContain('Full Day · monto sin dato');
  });

  it('jornadas incompletas: la tarjeta de Full Day lo dice', async () => {
    const d = datos();
    d.resumen.full_day.jornadas_incompletas = 2;
    api.getVentas.mockResolvedValue(d);
    await render();
    expect(texto()).toContain('2 reservas sin fechas: sus jornadas no se cuentan.');
  });

  // --- Revisión de QA del 17-oct ---

  const MSG_503 = 'No pudimos leer la configuración. Intenta de nuevo.';

  it('503 en Ventas: muestra el mensaje del servidor y «Reintentar»', async () => {
    api.getVentas.mockRejectedValueOnce(new Errores.ErrorTransitorio(MSG_503, true)).mockResolvedValue(datos());
    await render();
    expect(texto()).toContain(MSG_503);
    await act(async () => boton(/Reintentar/)!.click());
    await act(async () => {});
    expect(texto()).toContain('Full Day vendidos');
  });

  it.each([
    ['403', () => new Errores.SinPermisoError('forbidden'), 'No tienes acceso a esta reserva desde esta cuenta.', false],
    ['400', () => new Errores.SolicitudInvalidaError('El booking_id no es válido.'), 'El booking_id no es válido.', false],
    ['409', () => new Errores.ConflictError('La temporada no tiene fechas configuradas.'), 'La temporada no tiene fechas configuradas.', false],
    ['503', () => new Errores.ErrorTransitorio(MSG_503, true), MSG_503, true],
    ['corte de red', () => new Errores.ErrorTransitorio('No se pudo conectar con el panel.', false), 'No pudimos abrir la reserva. Revisa tu conexión y vuelve a intentarlo.', true],
  ])('ficha desde Ventas, %s: muestra el motivo, deja el foco en él y «Reintentar» solo si sirve', async (_n, error, mensaje, reintentar) => {
    api.getReservasResumen.mockImplementation((o?: { bookingId?: string }) =>
      o?.bookingId ? Promise.reject(error()) : Promise.resolve({ client_id: 'x', reservas: [] }),
    );
    await abrirB1();
    const alerta = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alerta.textContent).toBe(mensaje);
    expect(document.activeElement).toBe(alerta);
    expect(Boolean(boton(/Reintentar/))).toBe(reintentar);
  });

  it('mientras abre la ficha, el foco queda en «← Ventas» y no en BODY', async () => {
    api.getReservasResumen.mockImplementation((o?: { bookingId?: string }) =>
      o?.bookingId ? new Promise(() => {}) : Promise.resolve({ client_id: 'x', reservas: [] }),
    );
    await abrirB1();
    expect(document.activeElement).toBe(boton('← Ventas'));
  });

  it('cambiar la temporada no saca el foco del select: no se deshabilita, avisa con aria-busy', async () => {
    await render();
    let soltar: (d: VentasResponse) => void = () => {};
    api.getVentas.mockImplementation(() => new Promise<VentasResponse>((r) => (soltar = r)));
    const sel = container.querySelector('select') as HTMLSelectElement;
    sel.focus();
    await act(async () => {
      sel.value = '2025-26';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(sel.disabled).toBe(false);
    expect(sel.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(sel);
    await act(async () => soltar(datos({ periodo: { temporada: '2025-26', desde: '2025-10-12', hasta: '2026-04-30' } })));
    expect(document.activeElement).toBe(container.querySelector('select'));
    expect(sel.getAttribute('aria-busy')).toBe('false');
  });

  it('una respuesta vieja de temporada no pisa la última elegida', async () => {
    await render();
    const pendientes: Record<string, (d: VentasResponse) => void> = {};
    api.getVentas.mockImplementation((t: string) => new Promise<VentasResponse>((r) => (pendientes[t] = r)));
    const sel = container.querySelector('select') as HTMLSelectElement;
    for (const t of ['2025-26', '2026-27']) {
      await act(async () => {
        sel.value = t;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    await act(async () => pendientes['2026-27'](datos()));
    await act(async () => pendientes['2025-26'](datos({ periodo: { temporada: '2025-26', desde: '2025-10-12', hasta: '2026-04-30' } })));
    expect(texto()).toContain('Temporada 2026-27 ·');
    expect(sel.value).toBe('2026-27');
  });

  it('400 al cambiar de temporada: el select y el aviso hablan de la misma', async () => {
    await render();
    api.getVentas.mockRejectedValue(new Errores.SolicitudInvalidaError('temporada inválida'));
    const sel = container.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      sel.value = '2025-26';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {});
    expect(sel.value).toBe('2025-26');
    expect(texto()).toContain('La temporada 2025-26 no es válida.');
    expect(texto()).not.toContain('Temporada 2026-27 ·');
  });

  it('carrera A→B: la respuesta tardía de A no pisa la ficha de B', async () => {
    const reservaB9 = { ...reservaB1, BookingID: 'B9', GuestID: 'G10', GuestName: 'Carlos Rojas', RoomID: 'FULL_DAY' } as ReservaResumenItem;
    let soltarA: (v: unknown) => void = () => {};
    api.getReservasResumen.mockImplementation((o?: { bookingId?: string }) => {
      if (o?.bookingId === 'B1') return new Promise((r) => (soltarA = r));
      if (o?.bookingId === 'B9') return Promise.resolve({ client_id: 'x', reservas: [reservaB9] });
      return Promise.resolve({ client_id: 'x', reservas: [] });
    });
    await abrirB1();
    await act(async () => boton('← Ventas')!.click());
    await act(async () => (container.querySelector('[data-fila="B9"]') as HTMLButtonElement).click());
    await act(async () => {});
    expect(container.querySelector('h1')?.textContent).toBe('Carlos Rojas');
    await act(async () => soltarA({ client_id: 'x', reservas: [reservaB1] }));
    await act(async () => {});
    expect(container.querySelector('h1')?.textContent).toBe('Carlos Rojas');
  });

  it('refresco silencioso: si la lista falla, la ficha conserva los otros viajes', async () => {
    const pendiente = { ...reservaB1, Status: 'PENDING', PaymentStatus: 'PENDING' } as ReservaResumenItem;
    const otroViaje = { ...reservaB1, BookingID: 'B20', CheckIn: '2027-01-05', CheckOut: '2027-01-08' } as ReservaResumenItem;
    let listaFalla = false;
    api.getReservasResumen.mockImplementation((o?: { bookingId?: string }) => {
      if (o?.bookingId === 'B1') return Promise.resolve({ client_id: 'x', reservas: [pendiente] });
      return listaFalla ? Promise.reject(new Errores.ErrorTransitorio('No se pudo conectar con el panel.')) : Promise.resolve({ client_id: 'x', reservas: [otroViaje] });
    });
    await abrirB1();
    expect(texto()).toContain('Viajes cercanos:');
    listaFalla = true;
    await act(async () => boton('Ya pagó')!.click());
    await act(async () => boton('Sí, confirmar')!.click());
    await act(async () => {});
    expect(container.querySelector('h1')?.textContent).toBe('John Carter');
    expect(texto()).toContain('Viajes cercanos:');
    expect(container.querySelector('[role="group"][aria-label="Viajes cercanos de este pescador"]')?.querySelectorAll('button').length).toBe(2);
  });

  // --- Ventas v2 (spec-ventas-v2.md y diseno-dolar-precios.md, 17-oct) ---

  const DOLAR = { valor: 948, fecha: '2026-10-17', fuente: 'Banco Central de Chile vía mindicador.cl' };
  const tarifa = (extra: Partial<VentasTarifa>): VentasTarifa => ({
    programa: 'FULL_DAY', mercado: 'USA', unidad: 'jornada', pescadores_por_jornada: 2, desde: '2026-10-12', hasta: null,
    precio: { moneda: 'USD', monto: 690 }, costo: { moneda: 'USD', monto: 490 }, costo_convertido: null, dolar: null,
    ganancia: 200, margen: 29, dolar_equilibrio: null, vendidas: { reservas: 3, unidades: 8 }, reason: null, ...extra,
  });
  // Llegan desordenadas: la pantalla las pone en el orden de la spec.
  const tarifas: VentasTarifa[] = [
    tarifa({ programa: 'ALL_INCLUSIVE', mercado: 'BR', unidad: 'pescador', pescadores_por_jornada: null, precio: { moneda: 'USD', monto: 6500 }, costo: { moneda: 'USD', monto: 3200 }, ganancia: 3300, margen: 50.8, vendidas: { reservas: 1, unidades: 1 } }),
    tarifa({ mercado: 'CL', precio: { moneda: 'CLP', monto: 360000 }, costo: { moneda: 'CLP', monto: 300000 }, ganancia: 60000, margen: 16.7, vendidas: { reservas: 1, unidades: 1 } }),
    tarifa({}),
    tarifa({ mercado: 'BR', precio: { moneda: 'USD', monto: 450 }, costo: { moneda: 'CLP', monto: 400000 }, costo_convertido: 421.94, dolar: DOLAR, ganancia: 28.06, margen: 6.2, dolar_equilibrio: 888.89, vendidas: { reservas: 2, unidades: 3 } }),
    tarifa({ programa: 'ALL_INCLUSIVE', unidad: 'pescador', pescadores_por_jornada: null, precio: { moneda: 'USD', monto: 6500 }, costo: { moneda: 'USD', monto: 4200 }, ganancia: 2300, margen: 35.4, vendidas: { reservas: 2, unidades: 4 } }),
  ];
  const brasilConvertida: VentasReserva = {
    BookingID: 'B30', GuestID: 'G30', GuestName: 'João Lima', Programa: 'FULL_DAY', Mercado: 'BR', CheckIn: '2026-11-14', CheckOut: '2026-11-16', Pescadores: 3, Jornadas: 2,
    Moneda: 'USD', Venta: 900, Costo: 843.88, Utilidad: 56.12, Porcentaje: 6.2, Reason: null,
    PrecioLista: 900, CostoOriginal: { moneda: 'CLP', monto: 800000 }, Dolar: { ...DOLAR, fecha: '2026-11-14' }, FechaConfirmacion: '2026-11-14', BajoLista: false,
  };
  const brasilSinDolar: VentasReserva = { ...brasilConvertida, BookingID: 'B31', GuestName: 'Pedro Souza', CheckIn: '2026-11-20', CheckOut: '2026-11-21', Costo: null, Utilidad: null, Porcentaje: null, Reason: 'SIN_DOLAR', CostoOriginal: null, Dolar: null, FechaConfirmacion: '2026-11-14', BajoLista: false };
  const bajoListaConPerdida: VentasReserva = {
    BookingID: 'B32', GuestID: 'G32', GuestName: 'Mary Stone', Programa: 'FULL_DAY', Mercado: 'USA', CheckIn: '2026-11-25', CheckOut: '2026-11-27', Pescadores: 2, Jornadas: 2,
    Moneda: 'USD', Venta: 1200, Costo: 1540, Utilidad: -340, Porcentaje: -28.3, Reason: null, PrecioLista: 1380, CostoOriginal: null, Dolar: null, FechaConfirmacion: '2026-11-01', BajoLista: true,
  };

  function datosV2(extra: Partial<VentasResponse> = {}): VentasResponse {
    const d = datos({ tarifas, ...extra });
    if (!extra.meses) d.meses[1].reservas = [...d.meses[1].reservas, brasilConvertida, brasilSinDolar, bajoListaConPerdida];
    if (!extra.sin_calcular) d.sin_calcular = [...d.sin_calcular, { BookingID: 'B31', GuestName: 'Pedro Souza', Reason: 'SIN_DOLAR' }];
    return d;
  }
  const filaTexto = (bookingId: string) => (container.querySelector(`[data-fila="${bookingId}"]`) as HTMLElement).textContent ?? '';
  const titulos2 = () => Array.from(container.querySelectorAll('h2')).map((h) => h.textContent);

  it('orden fijo de bloques sin mix (Lambda anterior): resumen, por mes, por venta, sin calcular y cómo se calcula', async () => {
    api.getVentas.mockResolvedValue(datosV2());
    await render();
    expect(titulos2()).toEqual(['Resumen', 'Por mes', 'Cuánto ganamos por venta', 'Sin calcular (3)', 'Cómo se calcula']);
  });

  it.each([false, true])('cuánto ganamos por venta: orden de la spec y Brasil con su dólar (tabla: %s)', async (tabla) => {
    api.getVentas.mockResolvedValue(datosV2());
    await render(tabla);
    const filas = Array.from(container.querySelectorAll<HTMLElement>('[data-tarifa]'));
    expect(filas.map((f) => f.dataset.tarifa)).toEqual(['FULL_DAY:USA', 'FULL_DAY:BR', 'FULL_DAY:CL', 'ALL_INCLUSIVE:USA', 'ALL_INCLUSIVE:BR']);
    const usa = filas[0].textContent;
    expect(usa).toContain('Full Day 🇺🇸USA y otros');
    expect(usa).toContain('por jornada, hasta 2 pescadores');
    expect(usa).toMatch(/USD 690.*USD 490.*USD 200.*29,0\u00a0%.*8 jornadas/);
    const br = filas[1].textContent;
    expect(br).toContain('USD 421,94');
    expect(br).toContain('CLP 400.000 al dólar de CLP 948,00');
    expect(br).toContain('USD 28,06');
    expect(br).toContain('Dólar observado del 17 oct 2026 (Banco Central de Chile vía mindicador.cl). Cada reserva usa el dólar del día en que se confirmó. Si el dólar baja de CLP 888,89, esta venta pierde plata.');
    expect(filas[3].textContent).toContain('por pescador');
    expect(filas[3].textContent).toContain('4 pescadores');
    if (tabla) {
      expect(container.querySelector('caption')?.textContent).toBe('Precio, costo y ganancia por unidad vendida');
      expect(filas[1].querySelector('th[scope="row"]')?.textContent).toContain('Full Day 🇧🇷Brasil');
    } else {
      expect(filas[1].querySelector('h3')?.textContent).toBe('Full Day 🇧🇷Brasil');
    }
  });

  it('CA7: sin dólar, Brasil Full Day muestra el costo en CLP y «—» en ganancia y margen', async () => {
    const sinDolar = tarifas.map((f) => (f.mercado === 'BR' && f.programa === 'FULL_DAY' ? { ...f, dolar: null, costo_convertido: null, ganancia: null, margen: null, reason: 'SIN_DOLAR' } : f));
    api.getVentas.mockResolvedValue(datosV2({ tarifas: sinDolar }));
    await render(true);
    const br = container.querySelector('[data-tarifa="FULL_DAY:BR"]')!;
    const celdas = Array.from(br.querySelectorAll('tr:first-child td')).map((c) => c.textContent);
    expect(celdas).toEqual(['USD 450', 'CLP 400.000', '—', '—', '3 jornadas']);
    expect(br.textContent).toContain('No hay dólar observado disponible: la ganancia no se calcula. Vuelve a cargar más tarde.');
    expect(br.textContent).not.toContain('USD 421');
  });

  it('dos reglas para la misma línea: cada fila dice cuándo rige', async () => {
    const dos = [tarifa({ hasta: '2026-11-30' }), tarifa({ desde: '2026-12-01', precio: { moneda: 'USD', monto: 750 }, ganancia: 260, margen: 34.7 })];
    api.getVentas.mockResolvedValue(datosV2({ tarifas: dos }));
    await render();
    const filas = Array.from(container.querySelectorAll('[data-tarifa="FULL_DAY:USA"]')).map((f) => f.textContent);
    expect(filas[0]).toContain('hasta el 30 nov 2026');
    expect(filas[1]).toContain('desde el 1 dic 2026');
  });

  it('CA4: la ganancia de cada tarjeta es la del «Total temporada», moneda por moneda', async () => {
    api.getVentas.mockResolvedValue(datosV2());
    for (const tabla of [true, false]) {
      await render(tabla);
      for (const mon of ['USD', 'CLP']) {
        const tarjeta = container.querySelector(`[data-total-moneda="${mon}"] [data-ganancia]`)!.textContent;
        const total = container.querySelector(`[data-total-temporada] [data-moneda="${mon}"]`)!.textContent;
        expect(total).toContain(tarjeta);
      }
      expect(container.querySelector('[data-total-temporada]')!.textContent).toContain('Total temporada');
      act(() => root.unmount());
      container.remove();
    }
    await render();
  });

  it('CA2: sin confirmadas se ve el mensaje y cuánto ganamos por venta, sin tarjetas en 0 ni tabla por mes', async () => {
    const resumen = { full_day: { reservas: 0, jornadas: 0, pescadores: 0 }, all_inclusive: { reservas: 0, pescadores: 0 }, pendientes: { reservas: 0 } };
    api.getVentas.mockResolvedValue(datos({ tarifas, meses: [], totales: {}, sin_calcular: [], resumen }));
    await render(true);
    expect(texto()).toContain('Todavía no hay reservas confirmadas en la temporada 2026-27.');
    expect(titulos2()).toEqual(['Resumen', 'Cuánto ganamos por venta', 'Cómo se calcula']);
    expect(texto()).not.toContain('Full Day vendidos');
    expect(texto()).not.toContain('Ganancia en');
  });

  it('CA3: sin confirmadas y con 2 pendientes, lo dice con el número', async () => {
    const resumen = { full_day: { reservas: 0, jornadas: 0, pescadores: 0 }, all_inclusive: { reservas: 0, pescadores: 0 }, pendientes: { reservas: 2 } };
    api.getVentas.mockResolvedValue(datos({ tarifas, meses: [], totales: {}, sin_calcular: [], resumen }));
    await render();
    expect(texto()).toContain('Además hay 2 reservas pendientes de confirmar: no entran en estas cifras.');
  });

  it('CA5: el aviso cuenta las sin calcular y «Ver cuáles» deja el foco en su título', async () => {
    await render();
    expect(texto()).toContain('2 reservas sin calcular no suman plata.');
    const enlace = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'Ver cuáles')!;
    await act(async () => enlace.click());
    expect(document.activeElement?.textContent).toBe('Sin calcular (2)');
    expect(document.activeElement?.tagName).toBe('H2');
  });

  it('CA8: reglas descartadas avisan en el resumen y «Ver detalle» lleva a cuánto ganamos por venta', async () => {
    api.getVentas.mockResolvedValue(datosV2({ reglas_descartadas: [{ indice: 3, motivo: 'PRECIO_INVALIDO', programa: 'FULL_DAY' }] }));
    await render();
    const resumen = container.querySelector('section')!;
    expect(resumen.querySelector('h2')?.textContent).toBe('Resumen');
    expect(resumen.textContent).toContain('1 regla de costo tiene un error y no se usa: sus reservas quedan sin calcular.');
    const enlace = Array.from(resumen.querySelectorAll('a')).find((a) => a.textContent === 'Ver detalle')!;
    await act(async () => enlace.click());
    expect(document.activeElement?.textContent).toBe('Cuánto ganamos por venta');
    expect(texto()).toContain('Regla 4 (Full Day): el precio de lista está mal escrito o no es mayor que 0.');
  });

  it('textos de los descartes nuevos de precio', () => {
    expect(motivoRegla('PRECIO_INVALIDO')).toBe('el precio de lista está mal escrito o no es mayor que 0');
    expect(motivoRegla('MONEDA_PRECIO_INVALIDA')).toBe('falta la moneda del precio de lista o no es un código de tres letras, como USD o CLP');
    expect(motivoRegla('OTRO')).toBe('tiene un dato que falta o está mal escrito');
  });

  it.each([false, true])('CA6 y CA9: sin dólar no muestra costo ni ganancia en USD; bajo lista y pérdida con texto (tabla: %s)', async (tabla) => {
    api.getVentas.mockResolvedValue(datosV2());
    await render(tabla);
    await act(async () => boton(/Noviembre 2026/)!.click());
    const sinDolar = filaTexto('B31');
    // Tarjeta de venta (§15.2): Ganancia y Margen «—» con el motivo debajo; nunca un costo en USD inventado.
    expect(sinDolar).toContain('CobradoUSD 900');
    expect(sinDolar).toContain('Ganancia—');
    expect(sinDolar).toContain('Margen—');
    expect(sinDolar).toContain('Falta el dólar observado del 14 nov 2026: la ganancia no se calcula');
    expect(sinDolar).not.toMatch(/Costo USD|CLP/);
    expect(container.querySelector('[data-fila="sin:B31"]')!.textContent).toContain('Falta el dólar observado del 14 nov 2026');
    expect(texto()).toContain('Si ese día no hay dólar, la ganancia no se calcula.');
    const perdida = filaTexto('B32');
    expect(perdida).toContain('Bajo lista');
    expect(perdida).toContain('Lista USD 1.380 · se cobró USD 180 menos');
    expect(perdida).toContain('Pérdida');
    expect(perdida).toContain('−USD 340');
    const convertida = filaTexto('B30');
    expect(convertida).toContain('Costo CLP 800.000 · dólar CLP 948,00 del 14 nov 2026');
    expect(convertida).not.toContain('Bajo lista');
    expect(convertida).toMatch(/Cobrado.*USD 900.*Costo.*USD 843,88.*Ganancia.*USD 56,12.*Margen.*6,2\u00a0%/);
    // Por llegada: John (10) → Carlos (12) → João (14) → Juan (20) → Pedro (20) → Mary (25).
    const orden = Array.from(container.querySelectorAll<HTMLElement>(`[id$="-mes-2026-11"] [data-fila]`)).map((b) => b.dataset.fila);
    expect(orden.indexOf('B30')).toBeLessThan(orden.indexOf('B32'));
    expect(orden[0]).toBe('B1');
  });

  it('la tarjeta de ganancia avisa cuando incluye costos convertidos con el dólar', async () => {
    api.getVentas.mockResolvedValue(datosV2());
    await render();
    expect(container.querySelector('[data-total-moneda="USD"]')!.textContent).toContain('Incluye costos pasados de CLP a USD con el dólar de cada reserva.');
    expect(container.querySelector('[data-total-moneda="CLP"]')!.textContent).not.toContain('Incluye costos');
  });

  it('CA10: con un servidor anterior (sin tarifas ni precio de lista) sigue la lista de costos, sin undefined ni NaN', async () => {
    await render(true);
    await act(async () => boton(/Noviembre 2026/)!.click());
    expect(texto()).toContain(`Costos fijos de ${PROV}`);
    expect(texto()).not.toContain('Cuánto ganamos por venta');
    expect(texto()).not.toContain('Bajo lista');
    expect(texto()).not.toMatch(/undefined|NaN|null/);
  });

  it('CA12: sin conexión lo dice y vuelve a cargar cuando vuelve la red', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    api.getVentas.mockRejectedValueOnce(new Errores.ErrorTransitorio('No se pudo conectar con el panel.')).mockResolvedValue(datos());
    try {
      await render();
      expect(texto()).toContain('Sin conexión. Las ventas se cargan cuando vuelva la conexión.');
      expect(boton(/Reintentar/)).toBeTruthy();
      onLine.mockReturnValue(true);
      await act(async () => window.dispatchEvent(new Event('online')));
      await act(async () => {});
      expect(texto()).toContain('Full Day vendidos');
    } finally {
      onLine.mockRestore();
    }
  });

  it('CA13 y CA14: 403 sin «Reintentar»; 409 deja el selector operable', async () => {
    api.getVentas.mockRejectedValue(new Errores.SinPermisoError('forbidden'));
    await render();
    expect(boton(/Reintentar/)).toBeUndefined();
    act(() => root.unmount());
    container.remove();
    api.getVentas.mockResolvedValueOnce(datos()).mockRejectedValue(new Errores.ConflictError('sin fechas'));
    await render();
    const sel = container.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      sel.value = '2025-26';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(texto()).toContain('Falta configurar las fechas de la temporada.');
    expect(sel.disabled).toBe(false);
    expect(container.querySelector('select')).toBe(sel);
  });

  it('CA20 y CA21: sin --text-faint; tablas con scope y meses que anuncian si están abiertos', async () => {
    api.getVentas.mockResolvedValue(datosV2());
    await render(true);
    expect(container.innerHTML).not.toContain('text-faint');
    const tablaMes = Array.from(container.querySelectorAll('table')).find((t) => t.textContent?.includes('Total temporada'))!;
    expect(Array.from(tablaMes.querySelectorAll('thead th')).map((th) => [th.textContent, th.getAttribute('scope')])).toEqual(
      ['Mes', 'Full Day', 'All Inclusive', 'Cobrado con ganancia calculada', 'Costo', 'Ganancia', 'Margen'].map((h) => [h, 'col']),
    );
    expect(tablaMes.querySelector('tbody th[scope="row"] button[aria-expanded="false"]')).toBeTruthy();
    expect(tablaMes.querySelector('tfoot th[scope="row"]')?.textContent).toBe('Total temporada');
  });
});

// Salida REAL del backend (generar_fixtures.py sobre 04-codigo, 17-oct, dólar
// fijo 984,09): el contrato final, no datos armados a mano.
describe('Ventas con la respuesta real del backend (17-oct)', () => {
  const real = () => structuredClone(REAL.ventas_2026_27) as unknown as VentasResponse;
  const C = REAL.casos;
  const fila = (id: string) => (container.querySelector(`[data-fila="${id}"]`) as HTMLElement | null)?.textContent ?? '';

  it.each([false, true])('por venta: orden del contrato y Brasil con el dólar de la fuente (tabla: %s)', async (tabla) => {
    api.getVentas.mockResolvedValue(real());
    await render(tabla);
    const filas = Array.from(container.querySelectorAll<HTMLElement>('[data-tarifa]'));
    expect(filas.map((f) => f.dataset.tarifa)).toEqual(['FULL_DAY:USA', 'FULL_DAY:BR', 'FULL_DAY:CL', 'ALL_INCLUSIVE:USA', 'ALL_INCLUSIVE:BR']);
    const br = filas[1].textContent ?? '';
    expect(br).toContain('USD 406,47');
    expect(br).toContain('CLP 400.000 al dólar de CLP 984,09');
    expect(br).toContain('USD 43,53');
    expect(br).toContain('9,7\u00a0%');
    expect(br).toContain('Dólar observado del 16 oct 2026 (Banco Central de Chile vía mindicador.cl).');
    expect(br).toContain('Si el dólar baja de CLP 888,89, esta venta pierde plata.');
  });

  it.each([false, true])('reservas: bajo lista, conversión y sin calcular con su motivo, sin códigos crudos (tabla: %s)', async (tabla) => {
    api.getVentas.mockResolvedValue(real());
    await render(tabla);
    for (const mes of [/Octubre 2026/, /Noviembre 2026/, /Diciembre 2026/]) await act(async () => boton(mes)!.click());
    expect(fila(C.bajo_lista)).toContain('Bajo lista');
    expect(fila(C.bajo_lista)).toContain('Lista USD 690 · se cobró USD 90 menos');
    expect(fila(C.fd_br)).toContain('Costo CLP 400.000 · dólar CLP 984,09 del 16 oct 2026');
    expect(fila(C.fd_usa_1)).not.toContain('Bajo lista');
    expect(fila(`sin:${C.sin_confirmed_at}`)).toContain('Falta la fecha de confirmación');
    expect(fila(`sin:${C.sin_dolar}`)).toContain('Falta el dólar observado');
    expect(fila(`sin:${C.ai_cl}`)).not.toBe('');
    expect(texto()).not.toMatch(/undefined|NaN|\bnull\b|SIN_DOLAR|SIN_FECHA_CONFIRMACION|SIN_TARIFA|SIN_PRECIO_LISTA|FULL_DAY|ALL_INCLUSIVE/);
    expect(container.querySelector('[data-total-moneda="USD"] [data-ganancia]')?.textContent).toContain('USD 9.653,53');
  });

  // Revisión del 17-oct: «Vendido USD 22.620» se leía como todo lo vendido.
  it.each([false, true])('lo cobrado dice que solo trae ganancia calculada y las sin calcular suman aparte, por moneda (tabla: %s)', async (tabla) => {
    api.getVentas.mockResolvedValue(real());
    await render(tabla);
    const usd = container.querySelector('[data-total-moneda="USD"]')!;
    expect(usd.textContent).toContain('Cobrado con ganancia calculada');
    expect(usd.textContent).toContain('USD 22.620');
    expect(usd.querySelector('[data-sin-calcular="USD"]')?.textContent).toBe('+ 3 reservas sin calcular: USD 7.400');
    expect(container.querySelector('[data-total-moneda="CLP"] [data-sin-calcular]')).toBeNull();
    expect(texto()).not.toMatch(/\bVendido\b/);
    const mes = (m: string) => container.querySelector(`[data-mes="${m}"]`)!;
    expect(mes('2026-12').querySelector('[data-sin-calcular="USD"]')?.textContent).toBe('+ 2 reservas sin calcular: USD 900');
    expect(mes('2026-11').querySelector('[data-sin-calcular="USD"]')?.textContent).toBe('+ 1 reserva sin calcular: USD 6.500');
    expect(mes('2026-10').querySelector('[data-sin-calcular]')).toBeNull();
    expect(container.querySelector('[data-total-temporada] [data-sin-calcular="USD"]')?.textContent).toBe('+ 3 reservas sin calcular: USD 7.400');
    if (tabla) {
      // Diciembre ya no muestra una fila de «—»: solo la de sin calcular.
      expect(mes('2026-12').querySelector('tr[data-moneda]')).toBeNull();
      expect(mes('2026-12').querySelector('th[scope="row"]')?.getAttribute('rowspan')).toBe('1');
      expect(mes('2026-11').querySelector('th[scope="row"]')?.getAttribute('rowspan')).toBe('2'); // USD + sin calcular
    }
  });
});

describe('Ventas: tablas según el ancho del contenido, no de la ventana', () => {
  it.each([
    [664, false], // 1024 px con la barra lateral
    [ANCHO_TABLAS - 1, false],
    [ANCHO_TABLAS, true],
    [1080, true],
  ])('contenido de %i px: tablas = %s, aunque el breakpoint diga escritorio', async (ancho, conTablas) => {
    api.getVentas.mockResolvedValue(structuredClone(REAL.ventas_2026_27) as unknown as VentasResponse);
    await render(true, ancho);
    expect(container.querySelectorAll('table').length).toBe(conTablas ? 2 : 0);
    expect(container.querySelectorAll('[data-tarifa]').length).toBeGreaterThan(0);
  });
});

describe('sinCalcularPorMoneda', () => {
  const r = (Moneda: string, Venta: number | null, Utilidad: number | null) => ({ Moneda, Venta, Utilidad }) as VentasReserva;
  it('cuenta solo las sin ganancia, cada moneda aparte y sin inventar un monto', () => {
    const s = sinCalcularPorMoneda([r('USD', 450, null), r('USD', 690, 200), r('CLP', 360000, null), r('CLP', null, null), r('USD', 450, null)]);
    expect(s).toEqual({ USD: { n: 2, venta: 900, conMonto: 2 }, CLP: { n: 2, venta: 360000, conMonto: 1 } });
    expect(textoSinCalcular('CLP', s.CLP)).toBe('+ 2 reservas sin calcular: CLP 360.000');
    expect(textoSinCalcular('USD', { n: 1, venta: 0, conMonto: 0 })).toBe('+ 1 reserva sin calcular');
  });
});

describe('Ventas: «Qué se vende» con el mix del servidor (spec-ventas-mix, 17-oct)', () => {
  const FRASE = 'Esta temporada lidera USA y otros: 6 de 13 pescadores (46\u00a0%). Lo que más se vende es Full Day USA y otros: 5 pescadores en 3 reservas.';
  const mixReal = () => structuredClone(MIX) as unknown as VentasResponse;
  /** El fixture con otro mix, y el resumen igual al mix para que cuadre. */
  function conMix(segs: [VentasSegmento['programa'], VentasSegmento['mercado'], number, number][]): VentasResponse {
    const d = mixReal();
    const segmentos: VentasSegmento[] = segs.map(([programa, mercado, reservas, pescadores]) => ({ programa, mercado, reservas, pescadores, unidades: programa ? pescadores : null, unidad: programa === 'FULL_DAY' ? 'jornada' : programa ? 'pescador' : null }));
    const clas = segmentos.filter((x) => x.programa && x.mercado);
    const suma = (l: VentasSegmento[]) => l.reduce((a, x) => ({ reservas: a.reservas + x.reservas, pescadores: a.pescadores + x.pescadores }), { reservas: 0, pescadores: 0 });
    d.segmentos = segmentos;
    d.mercados = (['USA', 'BR', 'CL'] as const).map((m) => ({ mercado: m, ...suma(clas.filter((x) => x.mercado === m)) }));
    d.programas = (['FULL_DAY', 'ALL_INCLUSIVE'] as const).map((p) => {
      const t = suma(clas.filter((x) => x.programa === p));
      return { programa: p, ...t, unidades: t.pescadores, unidad: p === 'FULL_DAY' ? ('jornada' as const) : ('pescador' as const) };
    });
    const fd = d.programas[0];
    const ai = d.programas[1];
    d.resumen = { ...d.resumen, full_day: { ...d.resumen.full_day, reservas: fd.reservas, pescadores: fd.pescadores, jornadas: fd.unidades }, all_inclusive: { reservas: ai.reservas, pescadores: ai.pescadores } };
    return d;
  }
  const frase = () => container.querySelector('[data-frase-mix]')?.textContent ?? null;
  const bloque = () => container.querySelector('section.mix') as HTMLElement | null;
  const titulos2 = () => Array.from(container.querySelectorAll('h2')).map((h) => h.textContent);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it.each([false, true])('con el fixture: frase, orden de bloques y sin las tarjetas de programa en el resumen (tabla: %s)', async (tabla) => {
    api.getVentas.mockResolvedValue(mixReal());
    await render(tabla);
    expect(frase()).toBe(FRASE);
    expect(titulos2()).toEqual(['Resumen', 'Qué se vende', 'Por mes', 'Cuánto ganamos por venta', 'Sin calcular (6)', 'Cómo se calcula'].map((h) => (h.startsWith('Sin calcular') ? titulos2().find((x) => x?.startsWith('Sin calcular')) : h)));
    expect(texto()).toContain('Temporada 2026-27 · solo reservas confirmadas, por mes de llegada.');
    expect(texto()).not.toContain('vendidos');
    const reservas = container.querySelectorAll('section')[0].textContent ?? '';
    expect(reservas).toContain('Reservas confirmadas10reservas13 pescadores');
    // La frase va antes de las tarjetas (CA1: arriba, sin desplazar).
    const p = container.querySelector('[data-frase-mix]')!;
    expect(p.compareDocumentPosition(container.querySelector('[data-total-moneda="USD"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('CA3: parte A en orden USA, Brasil, Chile con «6 · 46 %», «5 · 38 %», «2 · 15 %»; se lee con «pescadores»', async () => {
    api.getVentas.mockResolvedValue(mixReal());
    await render();
    const filas = Array.from(bloque()!.querySelectorAll<HTMLElement>('[data-mix="mercados"] li'));
    expect(filas.map((f) => f.dataset.mercado)).toEqual(['USA', 'BR', 'CL']);
    expect(filas.map((f) => f.querySelector('.mix-cifra [aria-hidden]')!.textContent)).toEqual(['6 · 46\u00a0%', '5 · 38\u00a0%', '2 · 15\u00a0%']);
    expect(filas[0].textContent).toContain('USA y otros');
    expect(filas[0].querySelector('.solo-lector')!.textContent).toBe(', 6 pescadores, 46\u00a0%');
    expect(bloque()!.textContent).toContain('Los porcentajes están redondeados.');
  });

  it('CA4 y CA5: un solo «Más vendido» en Full Day USA, AI Chile «sin tarifa», barras sobre el total de pescadores', async () => {
    api.getVentas.mockResolvedValue(mixReal());
    await render();
    const chips = bloque()!.querySelectorAll('.mix-chip');
    expect(chips.length).toBe(1);
    expect(chips[0].closest('li')!.getAttribute('data-segmento')).toBe('FULL_DAY:USA');
    const seg = (k: string) => bloque()!.querySelector(`[data-segmento="${k}"]`) as HTMLElement;
    expect(seg('ALL_INCLUSIVE:CL').textContent).toContain('1 reserva · sin tarifa');
    expect(seg('FULL_DAY:CL').textContent).not.toContain('sin tarifa');
    // Todas las barras miden la participación sobre los 13 pescadores de la temporada.
    const ancho = (el: Element) => parseFloat((el.querySelector('.mix-barra') as HTMLElement).style.width);
    expect(ancho(seg('FULL_DAY:USA'))).toBeCloseTo((5 / 13) * 100, 3); // 38 %
    expect(ancho(seg('FULL_DAY:CL'))).toBeCloseTo((1 / 13) * 100, 3); // 8 %
    const mercado = (m: string) => bloque()!.querySelector(`[data-mercado="${m}"]`)!;
    expect(['USA', 'BR', 'CL'].map((m) => Math.round(ancho(mercado(m))))).toEqual([46, 38, 15]);
    expect(seg('FULL_DAY:USA').querySelector('.mix-riel')!.getAttribute('aria-hidden')).toBe('true');
    const cab = Array.from(bloque()!.querySelectorAll('[data-cabecera-programa]')).map((c) => c.textContent);
    expect(cab).toEqual(['9 pescadores · 8 jornadas · 7 reservas · 69\u00a0%', '4 pescadores · 3 reservas · 31\u00a0%']);
    expect(bloque()!.querySelectorAll('button, a, input, select').length).toBe(0);
    expect(bloque()!.textContent).not.toMatch(/USD|CLP/);
  });

  it('CA6: columna «Mercados» en la tabla por mes, «—» sin pescadores y total de la temporada', async () => {
    api.getVentas.mockResolvedValue(mixReal());
    await render(true);
    const ths = Array.from(container.querySelectorAll('[data-mes]')[0].closest('table')!.querySelectorAll('thead th')).map((t) => t.textContent);
    expect(ths.slice(0, 4)).toEqual(['Mes', 'Full Day', 'All Inclusive', 'Mercados']);
    const celdaMes = (m: string) => container.querySelector(`[data-mes="${m}"] [data-mercados-mes]`)!.textContent;
    expect(celdaMes('2026-10')).toBe('🇺🇸USA y otros 4 · 🇧🇷Brasil 1 · 🇨🇱Chile 1');
    expect(celdaMes('2026-12')).toBe('🇧🇷Brasil 2');
    expect(celdaMes('2027-01')).toBe('—');
    expect(container.querySelector('[data-total-temporada] [data-mercados-mes]')!.textContent).toBe('🇺🇸USA y otros 6 · 🇧🇷Brasil 5 · 🇨🇱Chile 2');
    await act(async () => boton(/Octubre 2026/)!.click());
    expect(container.querySelector('[data-mes="2026-10"] td[colspan]')!.getAttribute('colspan')).toBe('8');
  });

  it('CA6 en teléfono: línea tenue «Pescadores: …» y nada en meses sin pescadores', async () => {
    api.getVentas.mockResolvedValue(mixReal());
    await render(false);
    expect(container.querySelector('[data-mes="2026-10"] [data-mercados-mes]')!.textContent).toBe('Pescadores: 🇺🇸USA y otros 4 · 🇧🇷Brasil 1 · 🇨🇱Chile 1');
    expect(container.querySelector('[data-mes="2027-01"] [data-mercados-mes]')).toBeNull();
    expect(container.querySelector('[data-total-temporada] [data-mercados-mes]')!.textContent).toBe('Pescadores: 🇺🇸USA y otros 6 · 🇧🇷Brasil 5 · 🇨🇱Chile 2');
  });

  it('Lambda anterior (sin segmentos): sin mix, sin columna y con las tarjetas de programa de antes', async () => {
    api.getVentas.mockResolvedValue(structuredClone(REAL.ventas_2026_27) as unknown as VentasResponse);
    await render(true);
    expect(bloque()).toBeNull();
    expect(frase()).toBeNull();
    expect(texto()).toContain('vendidos');
    expect(container.querySelector('[data-mercados-mes]')).toBeNull();
  });

  it('M1: con 0 reservas no hay «Qué se vende» ni frase', async () => {
    const d = conMix([]);
    d.sin_calcular = [];
    d.meses = d.meses.map((m) => ({ ...m, reservas: [] }));
    api.getVentas.mockResolvedValue(d);
    await render();
    expect(titulos2()).not.toContain('Qué se vende');
    expect(texto()).not.toMatch(/Esta temporada/);
  });

  it('M2: un solo segmento → F3; la parte A muestra 3 filas y All Inclusive dice «Sin ventas todavía.»', async () => {
    api.getVentas.mockResolvedValue(conMix([['FULL_DAY', 'USA', 6, 12]]));
    await render();
    expect(frase()).toBe('Esta temporada, todos los pescadores son de Full Day USA y otros: 12 en 6 reservas.');
    expect(bloque()!.querySelectorAll('[data-mix="mercados"] li').length).toBe(3);
    expect(bloque()!.querySelector('[data-mercado="CL"] .mix-cifra [aria-hidden]')!.textContent).toBe('0 · 0\u00a0%');
    expect(bloque()!.querySelector('[data-mercado="CL"] .mix-barra')).toBeNull();
    const ai = bloque()!.querySelector('[data-programa-mix="ALL_INCLUSIVE"]')!;
    expect(ai.textContent).toBe('All Inclusive 0 pescadoresSin ventas todavía.');
  });

  it('M3: con menos de 10 pescadores, frase F2 y sin «Más vendido»', async () => {
    api.getVentas.mockResolvedValue(conMix([['FULL_DAY', 'USA', 2, 3], ['ALL_INCLUSIVE', 'BR', 1, 1]]));
    await render();
    expect(frase()).toContain('Con menos de 10');
    expect(bloque()!.querySelectorAll('.mix-chip').length).toBe(0);
  });

  it('M4: empate de mercados → «empatan» y sin «Más vendido»', async () => {
    api.getVentas.mockResolvedValue(conMix([['FULL_DAY', 'USA', 3, 5], ['FULL_DAY', 'BR', 3, 5], ['ALL_INCLUSIVE', 'CL', 1, 2]]));
    await render();
    expect(frase()).toContain('Esta temporada empatan USA y otros, y Brasil: 5 pescadores cada uno, de 12');
    expect(bloque()!.querySelectorAll('.mix-chip').length).toBe(0);
  });

  it('M5: lo sin clasificar va en su línea, cuenta en el % y no compite por «Más vendido»', async () => {
    api.getVentas.mockResolvedValue(conMix([['FULL_DAY', 'USA', 3, 5], ['FULL_DAY', 'BR', 3, 3], ['ALL_INCLUSIVE', 'CL', 1, 2], [null, null, 1, 6]]));
    await render();
    expect(bloque()!.querySelector('[data-sin-clasificar]')!.textContent).toBe('Sin programa o mercado: 6 pescadores en 1 reserva.');
    // N = 16 (con los 6 sin clasificar): USA 5 → 31 %.
    expect(bloque()!.querySelector('[data-mercado="USA"] .mix-cifra [aria-hidden]')!.textContent).toBe('5 · 31\u00a0%');
    expect(bloque()!.querySelectorAll('.mix-chip').length).toBe(1);
    expect(bloque()!.querySelector('.mix-chip')!.closest('li')!.getAttribute('data-segmento')).toBe('FULL_DAY:USA');
  });

  it('M6: si el mix no cuadra con el resumen, el aviso y «Reintentar» en lugar de la frase y del bloque', async () => {
    const d = mixReal();
    d.resumen = { ...d.resumen, full_day: { ...d.resumen.full_day, pescadores: 8 } };
    api.getVentas.mockResolvedValue(d);
    await render();
    expect(frase()).toBeNull();
    expect(bloque()).toBeNull();
    expect(container.querySelector('.mix-barra')).toBeNull();
    expect(container.querySelector('[data-mix-no-cuadra]')!.textContent).toContain('No pudimos repartir las ventas por mercado: los conteos no coinciden con el total. Las demás cifras de la pantalla están bien.');
    const llamadas = api.getVentas.mock.calls.length;
    await act(async () => (container.querySelector('[data-mix-no-cuadra] button') as HTMLButtonElement).click());
    expect(api.getVentas.mock.calls.length).toBe(llamadas + 1);
  });

  it.each([
    [2, '+ 2 reservas sin jornadas calculadas (falta la fecha de llegada o de salida)'],
    [1, '+ 1 reserva sin jornadas calculadas (falta la fecha de llegada o de salida)'],
  ])('Full Day con %i reservas sin jornadas: nota tenue junto a las jornadas', async (k, nota) => {
    const d = mixReal();
    d.programas = d.programas!.map((p) => (p.programa === 'FULL_DAY' ? { ...p, jornadas_incompletas: k } : p));
    api.getVentas.mockResolvedValue(d);
    await render();
    const fd = bloque()!.querySelector('[data-programa-mix="FULL_DAY"]')!;
    expect(fd.querySelector('[data-jornadas-incompletas]')!.textContent).toBe(nota);
    expect(bloque()!.querySelector('[data-programa-mix="ALL_INCLUSIVE"] [data-jornadas-incompletas]')).toBeNull();
  });

  it('jornadas_incompletas en 0 o ausente (backend anterior): sin nota', async () => {
    const d = mixReal();
    expect(d.programas!.every((p) => p.jornadas_incompletas === 0)).toBe(true);
    api.getVentas.mockResolvedValue(d);
    await render();
    expect(container.querySelector('[data-jornadas-incompletas]')).toBeNull();
    act(() => root.unmount());
    container.remove();
    const sinClave = mixReal();
    sinClave.programas = sinClave.programas!.map(({ jornadas_incompletas: _j, ...p }) => p);
    sinClave.segmentos = sinClave.segmentos!.map(({ jornadas_incompletas: _j, ...x }) => x);
    api.getVentas.mockResolvedValue(sinClave);
    await render();
    expect(bloque()).not.toBeNull();
    expect(container.querySelector('[data-jornadas-incompletas]')).toBeNull();
  });

  it('M7: con un error de carga no aparece «Qué se vende»', async () => {
    api.getVentas.mockRejectedValue(new Error('caída'));
    await render();
    expect(titulos2()).not.toContain('Qué se vende');
  });

  it('M8: fuera de las fechas de la temporada la frase empieza con «En la temporada»', async () => {
    vi.setSystemTime(new Date('2027-06-01T15:00:00Z'));
    api.getVentas.mockResolvedValue(mixReal());
    await render();
    expect(frase()).toMatch(/^En la temporada 2026-27 lidera USA y otros/);
  });
});

// Ventas por período (spec-ventas-cajas, 18-oct), con la respuesta del
// cálculo real de 04-codigo: filtro, cajas con margen y la página de antes
// cuando `ventanas` no viene.
describe('Ventas por período', () => {
  const conVentanas = () => JSON.parse(JSON.stringify(VENTANAS)) as VentasResponse & { ventanas: Record<string, { cajas: { programa: string; mercado: string; montos: { ganancia: number; margen: number | null }[] }[] }> };
  const radio = (nombre: string) => Array.from(container.querySelectorAll<HTMLInputElement>('input[type=radio]')).find((r) => r.parentElement?.textContent?.trim() === nombre)!;
  const cajas = () => Array.from(container.querySelectorAll<HTMLElement>('[data-caja]'));
  const cajaDe = (k: string) => container.querySelector<HTMLElement>(`[data-caja="${k}"]`)!;
  const estado = () => container.querySelector('[role=status].solo-lector')?.textContent;
  async function elegir(nombre: string) {
    await act(async () => radio(nombre).click());
  }

  it('Temporada por defecto, con las 5 cajas en orden y margen en todas', async () => {
    api.getVentas.mockResolvedValue(conVentanas());
    await render();
    expect(container.querySelector('fieldset legend')?.textContent).toBe('Período');
    expect(radio('Temporada').checked).toBe(true);
    expect(cajas().map((c) => c.dataset.caja)).toEqual(['ALL_INCLUSIVE:USA', 'ALL_INCLUSIVE:BR', 'FULL_DAY:CL', 'FULL_DAY:BR', 'FULL_DAY:USA']);
    for (const c of cajas()) expect(c.querySelector('[data-margen]')).not.toBeNull();
    for (const m of Array.from(container.querySelectorAll('[data-caja] [data-moneda]'))) expect(m.querySelector('[data-margen]')).not.toBeNull();
    for (const c of cajas()) expect(c.textContent).not.toMatch(/Total/);
    // Las tarjetas y «Qué se vende» de antes ya no están.
    expect(container.querySelector('[data-total-moneda]')).toBeNull();
    expect(texto()).not.toContain('Qué se vende');
  });

  it('cambiar de período no pide nada nuevo y anuncia las cifras', async () => {
    api.getVentas.mockResolvedValue(conVentanas());
    await render();
    const pedidos = api.getVentas.mock.calls.length;
    await elegir('30 días');
    expect(api.getVentas.mock.calls.length).toBe(pedidos);
    expect(estado()).toBe('Mostrando los últimos 30 días: 5 reservas, 7 pescadores.');
    expect(cajas()).toHaveLength(4);
    expect(container.querySelector('[data-frase-mix]')?.textContent).toMatch(/^En los últimos 30 días: 7 pescadores en 5 reservas\. Con menos de 10/);
    expect(texto()).toContain('1 reserva confirmada no tiene fecha de confirmación');
    // «Ver temporada» vuelve a Temporada y deja el foco en su radio.
    await act(async () => boton('Ver temporada')!.click());
    expect(radio('Temporada').checked).toBe(true);
    expect(document.activeElement).toBe(radio('Temporada'));
    expect(api.getVentas.mock.calls.length).toBe(pedidos);
  });

  it('orden de la pantalla: All Inclusive, Full Day por país, barras, dona y tendencia; la grilla de cajas no fija columnas y no hay gráficos lado a lado', async () => {
    api.getVentas.mockResolvedValue(conVentanas());
    await render();
    const seq = Array.from(container.querySelectorAll<HTMLElement>('[data-caja], [data-grafico]')).map((e) => e.dataset.caja ?? e.dataset.grafico);
    expect(seq).toEqual(['ALL_INCLUSIVE:USA', 'ALL_INCLUSIVE:BR', 'FULL_DAY:CL', 'FULL_DAY:BR', 'FULL_DAY:USA', 'barras', 'dona', 'tendencia']);
    expect(container.querySelector<HTMLElement>('.cajas')?.style.gridTemplateColumns).toBe('');
    expect(container.querySelector('.graficos--lado')).toBeNull();
  });

  it('tendencia: cuenta pescadores por fecha de confirmación, marca el máximo y lo resume para lector de pantalla', async () => {
    api.getVentas.mockResolvedValue(conVentanas());
    await render();
    const t = () => container.querySelector<HTMLElement>('[data-grafico="tendencia"]')!;
    expect(t().querySelector('h3')?.textContent).toBe('Pescadores por fecha de venta');
    expect(t().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    // Temporada: semana del 12 al 18 de octubre = FD 4 (14-oct) + FD 1 (17-oct) + AI Chile 1 (13-oct, «Otros»
    // como en las barras) = 6; la reserva sin fecha no entra.
    expect(t().querySelector('[data-detalle-grafico]')?.textContent).toBe('Mejor semana: 12–18 oct 2026, 6 pescadores (Full Day 5 · Otros 1).');
    expect(t().textContent).toContain('1 reserva sin fecha de confirmación no entra en este gráfico.');
    // Líneas (pedido de Mato, 19-oct): un path por serie más el total, todos con un punto por tramo.
    const paths = Array.from(t().querySelectorAll<SVGPathElement>('path[data-serie]'));
    expect(paths.map((x) => x.dataset.serie)).toEqual(['total', 'ai', 'fd', 'otros']);
    const tramos = paths[0].getAttribute('d')!.split(/[ML]/).filter(Boolean).length;
    expect(tramos).toBeGreaterThan(1);
    expect(paths.every((x) => x.getAttribute('d')!.split(/[ML]/).filter(Boolean).length === tramos)).toBe(true);
    // WCAG 1.4.1: cada serie con su trazo (continuo, guiones o punteado), no solo con su color, y la leyenda.
    expect(new Set(paths.map((x) => x.getAttribute('stroke-dasharray') ?? 'continuo')).size).toBe(4);
    expect(Array.from(t().querySelectorAll<HTMLElement>('[data-leyenda]')).map((l) => l.textContent)).toEqual(['Total', 'All Inclusive', 'Full Day', 'Otros']);
    // El Total es la suma: en cada tramo, su punto queda a la altura de ai+fd+otros (escala lineal desde la base).
    const yCero = Number(t().querySelector('[data-eje-y="0"]')!.getAttribute('y'));
    const ysDe = (p: SVGPathElement) => p.getAttribute('d')!.split(/[ML]/).filter(Boolean).map((x) => Number(x.trim().split(/\s+/)[1]));
    const [yTotal, ...ySeries] = paths.map(ysDe);
    yTotal.forEach((y, i) => expect(yCero - y).toBeCloseTo(ySeries.reduce((a, ys) => a + (yCero - ys[i]), 0), 6));
    expect(yTotal.some((y, i) => ySeries.every((ys) => ys[i] !== y))).toBe(true);
    // El máximo: un solo punto destacado, en la semana del 12-oct, y el eje Y va de 0 a 6.
    const max = t().querySelectorAll<SVGGElement>('[data-maximo]');
    expect(max).toHaveLength(1);
    expect(max[0].dataset.tramo).toBe('2026-10-12');
    expect(max[0].dataset.total).toBe('6');
    expect(Array.from(t().querySelectorAll('[data-eje-y]')).map((x) => x.textContent)).toEqual(['6', '0']);
    expect(t().querySelectorAll('[data-eje-x]').length).toBeGreaterThanOrEqual(2);
    expect(t().querySelector('[data-anim-trazo]')).not.toBeNull();
    expect(t().querySelector('rect[data-anim-columna], [data-anim-columna]')).toBeNull();
    const lista = Array.from(t().querySelectorAll('.solo-lector li')).map((li) => li.textContent);
    expect(lista).toContain('12–18 oct 2026: 6 pescadores (Full Day 5, Otros 1).');
    const suma = lista.reduce((a, l) => a + Number(/: (\d+) pescador/.exec(l ?? '')![1]), 0);
    // Total = N de las barras de Temporada menos lo que no tiene fecha de confirmación, ambos del mismo fixture.
    const fixture = conVentanas();
    const nBarras = barrasDe(ventanasDe(fixture)!.temporada).total;
    const sinFecha = fixture.meses.flatMap((m) => m.reservas).filter((x) => !x.FechaConfirmacion).reduce((a, x) => a + (x.Pescadores ?? 0), 0);
    expect(sinFecha).toBeGreaterThan(0);
    expect(suma).toBe(nBarras - sinFecha);
    await elegir('30 días');
    expect(t().dataset.escala).toBe('dia');
    expect(t().querySelector('[data-detalle-grafico]')?.textContent).toBe('Mejor día: 14 oct, 4 pescadores (Full Day 4).');
  });

  it('CA-U3/U4/U5: cada caja va badge → título → detalle, con un ícono por fila de dato', async () => {
    api.getVentas.mockResolvedValue(conVentanas());
    await render();
    expect(cajas().length).toBeGreaterThan(0);
    for (const c of cajas()) {
      const partes = Array.from(c.querySelectorAll<HTMLElement>(':scope > [data-parte]')).map((p) => p.dataset.parte);
      expect(partes.slice(0, 3)).toEqual(['badge', 'titulo', 'detalle']);
      expect(partes.slice(3).every((p) => p === 'detalle')).toBe(true);
      expect(c.querySelector('[data-parte="badge"] .badge-programa')).not.toBeNull();
      expect(c.querySelector('[data-parte="titulo"] [data-ranura-bandera]')?.getAttribute('aria-hidden')).toBe('true');
      for (const d of c.querySelectorAll('[data-fila-dato]')) {
        const svgs = d.querySelectorAll('svg[data-icono]');
        expect(svgs.length).toBe(1);
        expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
        expect(svgs[0].getAttribute('width')).toBe('18');
      }
    }
  });

  it('§7.2/CA-V20: filas en <dl> (ícono y etiqueta en <dt>, valor en <dd>), rótulo según monedas y h3 con el programa', async () => {
    // Una caja con dos monedas en cada ventana, para probar los dos rótulos.
    const d = conVentanas();
    for (const v of Object.values(d.ventanas)) {
      if (!v || !Array.isArray(v.cajas)) continue; // «hoy» es la fecha, no una ventana
      const c = v.cajas.find((k) => k.montos.length === 1) as unknown as { montos: Record<string, unknown>[] } | undefined;
      if (c) c.montos.push({ ...c.montos[0], moneda: c.montos[0].moneda === 'USD' ? 'CLP' : 'USD' });
    }
    api.getVentas.mockResolvedValue(d);
    await render();
    let una = 0;
    let varias = 0;
    for (const c of cajas()) {
      for (const d of c.querySelectorAll('[data-fila-dato]')) {
        expect(d.parentElement?.tagName).toBe('DL');
        const hijos = Array.from(d.children).map((h) => h.tagName);
        expect(hijos).toEqual(['DT', 'DD']);
        expect(d.querySelector('dt svg[data-icono]')).not.toBeNull();
      }
      const monedas = Array.from(c.querySelectorAll<HTMLElement>('[data-moneda]'));
      for (const m of monedas) {
        const rotulo = m.querySelector('.caja__rotulo')!.textContent;
        if (monedas.length === 1) {
          una++;
          expect(rotulo).toBe(`En ${m.dataset.moneda}`);
        } else {
          varias++;
          expect(rotulo).toMatch(new RegExp(`^En ${m.dataset.moneda} · \\d+ reservas?$`));
        }
      }
      const programa = c.dataset.caja!.split(':')[0] === 'FULL_DAY' ? 'Full Day' : 'All Inclusive';
      const h3 = c.querySelector('h3')!;
      expect(h3.querySelector('.solo-lector')?.textContent).toBe(`${programa} `);
      expect(c.getAttribute('aria-labelledby')).toBe(h3.id);
    }
    expect(una).toBeGreaterThan(0);
    expect(varias).toBeGreaterThan(0);
  });

  it('caja en 0: sin ventas en este período y margen «—»', async () => {
    api.getVentas.mockResolvedValue(conVentanas());
    await render();
    await elegir('30 días');
    const c = cajaDe('FULL_DAY:CL');
    // Una sola vez, como motivo bajo «Margen —» (QA 18-oct).
    expect(c.textContent?.match(/sin ventas en este período/gi)?.length).toBe(1);
    expect(c.querySelector('[data-margen]')?.getAttribute('data-margen')).toBe('Margen —');
    expect(c.textContent).toContain('sin ventas en este período');
  });

  it('parcial: margen «parcial» y cuántas suman; el motivo se lee en la caja, sin botón a una sección que ya no está', async () => {
    api.getVentas.mockResolvedValue(conVentanas());
    await render();
    const c = cajaDe('FULL_DAY:BR');
    expect(c.querySelector('[data-margen]')?.getAttribute('data-margen')).toBe('Margen 9,7\u00a0% parcial');
    expect(c.querySelector('[data-sin-calcular="2"]')?.textContent).toContain('suman 1 de 3 reservas: 2 sin calcular, por falta de un dato de la reserva o del costo.');
    expect(c.textContent).toContain('Costo pagado en CLP, pasado a USD con el dólar del día de cada confirmación.');
    expect(Array.from(c.querySelectorAll('button')).map((b) => b.textContent)).not.toEqual(expect.arrayContaining(['Ver cuáles']));
    expect(Array.from(c.querySelectorAll('button')).map((b) => b.textContent)).not.toEqual(expect.arrayContaining(['Ver dólar y equilibrio']));
  });

  it('bajo lista con chip neutro; la lista no se compara en Full Day Brasil', async () => {
    api.getVentas.mockResolvedValue(conVentanas());
    await render();
    const usa = cajaDe('FULL_DAY:USA');
    expect(usa.querySelector('[data-bajo-lista]')?.textContent).toBe('Bajo lista');
    expect(usa.textContent).toContain('lista 29,0\u00a0%');
    expect(usa.textContent).toContain('margen 26,6\u00a0% contra 29,0\u00a0% de lista');
    expect(cajaDe('FULL_DAY:CL').querySelector('[data-bajo-lista]')).toBeNull();
    expect(cajaDe('FULL_DAY:BR').textContent).not.toContain('lista');
    expect(usa.textContent).not.toContain('Pérdida');
  });

  it('pérdida: chip «Pérdida» y nunca «Bajo lista» a la vez', async () => {
    const d = conVentanas();
    const c = d.ventanas.temporada.cajas.find((x) => x.programa === 'FULL_DAY' && x.mercado === 'USA')!;
    c.montos[0].ganancia = -120;
    c.montos[0].margen = -4.5;
    api.getVentas.mockResolvedValue(d);
    await render();
    const usa = cajaDe('FULL_DAY:USA');
    expect(usa.textContent).toContain('Pérdida');
    expect(usa.querySelector('[data-bajo-lista]')).toBeNull();
    expect(usa.querySelector('[data-margen]')?.getAttribute('data-margen')).toBe('Margen \u22124,5\u00a0%');
  });

  it('sin `ventanas`, o sin la clave 90d, queda la página de antes', async () => {
    const sin = conVentanas() as Partial<VentasResponse>;
    delete sin.ventanas;
    api.getVentas.mockResolvedValue(sin);
    await render();
    expect(container.querySelector('fieldset')).toBeNull();
    expect(container.querySelector('[data-caja]')).toBeNull();
    expect(container.querySelector('[data-total-moneda]')).not.toBeNull();
    // La vista antigua conserva sus secciones, y sus enlaces llevan a un título que existe.
    const h2 = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent ?? '');
    expect(h2).toEqual(expect.arrayContaining(['Por mes', 'Cómo se calcula']));
    expect(h2.some((h) => h === 'Cuánto ganamos por venta' || h.startsWith('Costos fijos'))).toBe(true);
    expect(h2.some((h) => /^Sin calcular \(\d+\)$/.test(h))).toBe(true);
    act(() => root.unmount());
    container.remove();
    const sin90 = conVentanas();
    delete (sin90.ventanas as Record<string, unknown>)['90d'];
    api.getVentas.mockResolvedValue(sin90);
    await render();
    expect(container.querySelector('fieldset')).toBeNull();
    expect(container.querySelector('[data-total-moneda]')).not.toBeNull();
  });

  it('vista CFF con temporada vacía y 1 regla descartada: la regla se explica en el aviso, sin «Ver detalle» a una sección que no está', async () => {
    const d = conVentanas();
    d.resumen.full_day.reservas = 0;
    d.resumen.all_inclusive.reservas = 0;
    d.sin_calcular = [];
    (d as VentasResponse).reglas_descartadas = [{ indice: 3, motivo: 'PRECIO_INVALIDO', programa: 'FULL_DAY' }] as VentasResponse['reglas_descartadas'];
    api.getVentas.mockResolvedValue(d);
    await render();
    expect(container.querySelector('[data-caja]')).toBeNull(); // rama de temporada vacía
    expect(texto()).toContain('1 regla de costo tiene un error y no se usa: sus reservas quedan sin calcular.');
    expect(texto()).toContain('Regla 4 (Full Day): el precio de lista está mal escrito o no es mayor que 0.');
    expect(texto()).not.toContain('Ver detalle');
    expect(container.querySelectorAll('a[href^="#"]')).toHaveLength(0);
    expect(Array.from(container.querySelectorAll('h2')).map((h) => h.textContent)).not.toContain('Cuánto ganamos por venta');
  });

  it('vista CFF (con `ventanas`): termina en el resumen, sin «Por mes», «Cuánto ganamos por venta», «Sin calcular» ni «Cómo se calcula», y sin enlaces a ellas', async () => {
    const d = conVentanas();
    (d as VentasResponse).reglas_descartadas = [{ indice: 3, motivo: 'PRECIO_INVALIDO', programa: 'FULL_DAY' }] as VentasResponse['reglas_descartadas'];
    api.getVentas.mockResolvedValue(d);
    await render(true);
    expect(Array.from(container.querySelectorAll('h2')).map((h) => h.textContent)).toEqual(['Resumen']);
    expect(container.querySelector('[data-mes], table')).toBeNull();
    for (const t of ['Por mes', 'Cuánto ganamos por venta', 'Sin calcular (', 'Cómo se calcula', 'Ver cuáles', 'Ver dólar y equilibrio', 'Ver detalle']) expect(texto()).not.toContain(t);
    expect(container.querySelectorAll('a[href^="#"]')).toHaveLength(0);
    // La regla descartada se explica en el mismo aviso, porque no hay sección a la que llevar.
    expect(texto()).toContain('1 regla de costo tiene un error y no se usa: sus reservas quedan sin calcular.');
    expect(texto()).toContain('Regla 4 (Full Day): el precio de lista está mal escrito o no es mayor que 0.');
    // El margen sigue visible en cada caja.
    for (const c of cajas()) expect(c.querySelector('[data-margen]')).not.toBeNull();
  });

  describe('animación de las líneas de la tendencia (clip-path)', () => {
    const mmOriginal = () => window.matchMedia;
    /** matchMedia que responde como un sistema con o sin «reducir movimiento». */
    const conMovimiento = (reducir: boolean) =>
      ((query: string) => ({
        matches: query.includes('no-preference') ? !reducir : query.includes('reduced-motion: reduce') ? reducir : false,
        media: query, onchange: null,
        addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
      })) as typeof window.matchMedia;
    /** Registra todo valor de style que tuvo cada trazo, también los que duraron un instante. */
    function espiarClips() {
      const vistos: string[] = [];
      const obs = new MutationObserver((rs) => {
        for (const r of rs) {
          const el = r.target as Element;
          if (!el.hasAttribute('data-anim-trazo')) continue;
          vistos.push(r.oldValue ?? '', el.getAttribute('style') ?? '');
        }
      });
      obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'], attributeOldValue: true });
      return { vistos, cortar: () => { vistos.push(...obs.takeRecords().flatMap((r) => [r.oldValue ?? '', (r.target as Element).getAttribute('style') ?? ''])); obs.disconnect(); } };
    }
    const clipDe = (el: Element) => (el as SVGGElement).style.clipPath || (el.getAttribute('style') ?? '').includes('clip-path');

    it('con «reducir movimiento» nunca se aplica un recorte a las líneas', async () => {
      const original = mmOriginal();
      window.matchMedia = conMovimiento(true);
      const espia = espiarClips();
      try {
        api.getVentas.mockResolvedValue(conVentanas());
        await render();
        expect(container.querySelectorAll('[data-anim-trazo]').length).toBeGreaterThan(0);
        await elegir('30 días');
        await elegir('90 días');
        espia.cortar();
        expect(espia.vistos.filter((v) => v.includes('clip-path'))).toEqual([]);
        for (const g of container.querySelectorAll('[data-anim-trazo]')) expect(clipDe(g)).toBeFalsy();
      } finally {
        espia.cortar();
        window.matchMedia = original;
      }
    });

    it('sin preferencia: el recorte se aplica, y un revert a mitad (cambio de período o desmontaje) no lo deja pegado', async () => {
      const original = mmOriginal();
      window.matchMedia = conMovimiento(false);
      const espia = espiarClips();
      try {
        api.getVentas.mockResolvedValue(conVentanas());
        await render();
        const trazos = Array.from(container.querySelectorAll('[data-anim-trazo]'));
        expect(trazos.length).toBeGreaterThan(0);
        // Control: la entrada sí recorta (si no, el espía no probaría nada).
        expect(trazos.some(clipDe)).toBe(true);
        // Cambio de período a mitad de la entrada: el contexto anterior se revierte y
        // el nuevo vuelve a partir desde el recorte inicial, nunca desde uno a medias.
        await elegir('30 días');
        const nuevos = Array.from(container.querySelectorAll('[data-anim-trazo]'));
        for (const g of nuevos) {
          const c = (g as SVGGElement).style.clipPath;
          if (c) expect(c).toBe('inset(0% 100% 0% 0%)');
        }
        // Desmontaje a mitad de la animación: ningún trazo queda recortado.
        act(() => root.unmount());
        for (const g of [...trazos, ...nuevos]) expect(clipDe(g)).toBeFalsy();
        espia.cortar();
        expect(espia.vistos.some((v) => v.includes('clip-path'))).toBe(true);
      } finally {
        espia.cortar();
        window.matchMedia = original;
        // El afterEach desmonta otra vez: un root nuevo y vacío lo deja en paz.
        root = createRoot(container);
      }
    });
  });
});
