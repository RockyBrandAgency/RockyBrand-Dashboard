import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HuespedItem, ReservaResumenItem } from '../../types';

// Qué afirma: cancelar pide confirmación dentro de la página, no llama al
// backend hasta el «Sí», «Volver sin cambios» y Escape no cancelan nada y
// devuelven el foco, y la línea del pago solo sale si ya pagó algo.

const { api, auth, Errores } = vi.hoisted(() => ({
  api: { cancelarReserva: vi.fn(), confirmarReserva: vi.fn(), getHuespedes: vi.fn(), actualizarReserva: vi.fn() },
  auth: { features: { pms_ficha_pesca: true, pms_utilidad: false } },
  Errores: {
    ErrorTransitorio: class ErrorTransitorio extends Error {
      delServidor: boolean;
      constructor(m: string, delServidor = false) {
        super(m);
        this.delServidor = delServidor;
      }
    },
    ConflictError: class ConflictError extends Error {},
  },
}));

vi.mock('../../api/dashboardApi', () => ({
  cancelarReserva: (...a: unknown[]) => api.cancelarReserva(...a),
  confirmarReserva: (...a: unknown[]) => api.confirmarReserva(...a),
  getHuespedes: () => api.getHuespedes(),
  actualizarReserva: (...a: unknown[]) => api.actualizarReserva(...a),
  actualizarHuesped: vi.fn(),
  guardarAcompanantes: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ConflictError: Errores.ConflictError,
  ErrorTransitorio: Errores.ErrorTransitorio,
  TimeoutError: class TimeoutError extends Error {},
}));
vi.mock('../../context/AuthContext', () => ({ usePermiso: () => true,
  useAuth: () => ({ handleUnauthorized: vi.fn(), clientId: 'chile-fly-fishing', features: auth.features }),
}));

import REAL from './__fixtures__/ventas-backend-2026-10-17.json';
import { FichaPescador } from './FichaPescador';

const huesped = {
  GuestID: 'gst_1', FullName: 'Ana Pescadora', Contact: { Email: 'ana@example.com' }, OriginCountry: 'Estados Unidos',
  VIP_Tags: [], DietaryRestrictions: [], MobilityNotes: '', SpecialNotes: '', TotalLTV: 0,
} as unknown as HuespedItem;

function reserva(extra: Partial<ReservaResumenItem> = {}): ReservaResumenItem {
  return {
    BookingID: 'bkg_1', GuestID: 'gst_1', Status: 'CONFIRMED', CheckIn: '2026-11-10', CheckOut: '2026-11-15', RoomID: 'ALL_INCLUSIVE',
    Source: 'Directa Web', GuestName: 'Ana Pescadora', TotalAmount: 9800, Currency: 'USD', PaymentStatus: 'PAID', Companions: [], ...extra,
  };
}

let container: HTMLDivElement;
let root: Root;
const onCambio = vi.fn();

async function render(r: ReservaResumenItem) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <StrictMode>
        <FichaPescador bookingId={r.BookingID} reservas={[r]} huesped={huesped} volverA="Calendario de Reservas" isDesktop onVolver={vi.fn()} onCambio={onCambio} />
      </StrictMode>,
    );
  });
}

const boton = (texto: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
  api.cancelarReserva.mockReset().mockResolvedValue({});
  api.actualizarReserva.mockReset();
  onCambio.mockReset();
  auth.features = { pms_ficha_pesca: true, pms_utilidad: false };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Ficha del pescador: cancelar', () => {
  it('pide confirmación en la página y no cancela hasta el «Sí»', async () => {
    await render(reserva({ PaidAmount: 2000 }));
    await act(async () => boton('Cancelar reserva')!.click());

    const dialogo = container.querySelector('[role="alertdialog"]');
    expect(dialogo?.textContent).toContain('¿Cancelar la reserva de Ana Pescadora?');
    expect(dialogo?.textContent).toContain('Ya pagó USD 2.000. Cancelar no devuelve el dinero');
    expect(document.activeElement).toBe(boton('Volver sin cambios'));
    expect(api.cancelarReserva).not.toHaveBeenCalled();

    await act(async () => boton('Sí, cancelar la reserva')!.click());
    expect(api.cancelarReserva).toHaveBeenCalledWith('bkg_1');
    expect(onCambio).toHaveBeenCalled();
    expect(container.textContent).toContain('Cancelaste la reserva de Ana Pescadora.');
  });

  it('«Volver sin cambios» y Escape cierran sin cancelar y devuelven el foco', async () => {
    await render(reserva({ PaidAmount: 0 }));
    await act(async () => boton('Cancelar reserva')!.click());
    expect(container.textContent).not.toContain('Ya pagó');

    await act(async () => boton('Volver sin cambios')!.click());
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(boton('Cancelar reserva'));

    await act(async () => boton('Cancelar reserva')!.click());
    await act(async () => {
      container.querySelector('[role="alertdialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(api.cancelarReserva).not.toHaveBeenCalled();
  });

  it('con la confirmación abierta, los campos quedan bloqueados', async () => {
    await render(reserva());
    expect(container.querySelector('fieldset')!.disabled).toBe(false);
    await act(async () => boton('Cancelar reserva')!.click());
    expect(container.querySelector('fieldset')!.disabled).toBe(true);
    await act(async () => boton('Volver sin cambios')!.click());
    expect(container.querySelector('fieldset')!.disabled).toBe(false);
  });

  it('una reserva cancelada no ofrece cancelar de nuevo', async () => {
    await render(reserva({ Status: 'CANCELLED' }));
    expect(boton('Cancelar reserva')).toBeUndefined();
    expect(container.textContent).toContain('Esta reserva está cancelada.');
  });
});

describe('Ficha del pescador: guardar', () => {
  async function marcarEquipoYGuardar() {
    await render(reserva({ BringsOwnGear: null }));
    const si = container.querySelector('[role="group"][aria-label="Trae equipo"] button') as HTMLButtonElement;
    await act(async () => si.click());
    await act(async () => boton('Guardar cambios')!.click());
  }

  it('con eco del servidor: lo da por guardado', async () => {
    api.actualizarReserva.mockResolvedValue({ BookingID: 'bkg_1', message: 'ok', BringsOwnGear: true });
    await marcarEquipoYGuardar();
    expect(api.actualizarReserva).toHaveBeenCalledWith('bkg_1', { BringsOwnGear: true });
    expect(container.textContent).toContain('Guardaste los cambios de Ana Pescadora.');
    expect(boton('Guardar cambios')).toBeUndefined();
  });

  it('sin eco (Lambda anterior): avisa que no se guardó y deja el cambio en pantalla', async () => {
    api.actualizarReserva.mockResolvedValue({ BookingID: 'bkg_1', message: 'ok' });
    await marcarEquipoYGuardar();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('No se guardó si trae equipo: el servidor todavía no acepta ese dato.');
    expect(container.textContent).not.toContain('Guardaste los cambios');
    expect(boton('Guardar cambios')).toBeDefined();
  });

  it('sin la bandera pms_utilidad no muestra el bloque de utilidad', async () => {
    await render(reserva());
    expect(container.textContent).not.toContain('Utilidad');
    expect(container.textContent).not.toContain('Ganancia');
    expect(container.textContent).not.toContain('Costo del guía');
    // CA-F5: sin Costo Guillermo ni Margen; Venta, Pagado y Saldo en la fila B.
    expect(container.textContent).not.toContain('Costo Guillermo');
    expect(container.textContent).not.toContain('Margen');
    const resumen = container.querySelector('[data-tarjeta="resumen-venta"]');
    expect(Array.from(resumen?.querySelectorAll('.dato__valor--cifra') ?? []).map((e) => e.parentElement?.getAttribute('data-dato'))).toEqual(['Venta', 'Pagado', 'Saldo']);
    expect(container.querySelector('[data-tarjeta="licencia"]')).not.toBeNull();
    expect(container.querySelector('[data-tarjeta="costos"]')).toBeNull();
  });

  it('Full Day sin Units: no muestra jornadas ni noches', async () => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    await render(reserva({ RoomID: 'FULL_DAY', CheckIn: '2026-11-10', CheckOut: '2026-11-12', Profit: undefined }));
    const llega = container.querySelector('[data-dato="Llega – Se va"]')?.textContent ?? '';
    expect(llega).toBe('Llega – Se va10 nov – 12 nov');
    expect(llega).not.toMatch(/jornada|noche|día/);
  });

  it('All Inclusive: la estadía va en noches', async () => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    await render(reserva({ RoomID: 'ALL_INCLUSIVE', CheckIn: '2026-11-10', CheckOut: '2026-11-17' }));
    expect(container.querySelector('[data-dato="Llega – Se va"]')?.textContent).toContain('7 noches');
    expect(container.textContent).not.toMatch(/\d+ días?/);
  });

  it('CA-F2: tarjetas en orden y sin círculos numerados', async () => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    await render(reserva());
    expect(Array.from(container.querySelectorAll('[data-tarjeta]')).map((e) => e.getAttribute('data-tarjeta'))).toEqual([
      'cabecera', 'resumen-venta', 'viaje', 'pescador', 'costos', 'acompanantes', 'notas', 'ids',
    ]);
    expect(Array.from(container.querySelectorAll('h2')).map((h) => h.textContent)).toEqual([
      'Resumen de la venta', 'Viaje', 'Pescador', 'Cómo se calculó la ganancia', 'Acompañantes', 'Notas de la reserva',
    ]);
    expect(container.querySelector('[data-tarjeta="ids"]')?.className).toContain('tarjeta--plana');
    // §7.2: el resumen de la venta va en <dl>; ícono y etiqueta en <dt>, valor en <dd>.
    const filas = Array.from(container.querySelectorAll('[data-tarjeta="resumen-venta"] [data-fila-dato]'));
    expect(filas.length).toBeGreaterThan(0);
    for (const f of filas) {
      expect(f.parentElement?.tagName).toBe('DL');
      expect(f.children[0].tagName).toBe('DT');
      expect(Array.from(f.children).slice(1).every((h) => h.tagName === 'DD')).toBe(true);
    }
  });

  it('cancelada: el aviso va dentro de la cabecera', async () => {
    await render(reserva({ Status: 'CANCELLED' }));
    expect(container.querySelector('[data-tarjeta="cabecera"] .crm-aviso.critico')?.textContent).toContain('Esta reserva está cancelada.');
  });

  async function moverLlegadaYGuardar() {
    await render(reserva());
    const llega = container.querySelector('input[type="date"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(llega, '2026-11-12');
      llega.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => boton('Guardar cambios')!.click());
  }

  it('fechas con 400: muestra el mensaje del servidor y deja el cambio en pantalla', async () => {
    api.actualizarReserva.mockRejectedValue(new Error('La llegada no puede ser después de la salida'));
    await moverLlegadaYGuardar();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'No pudimos guardar las fechas del viaje. La llegada no puede ser después de la salida. Tus cambios siguen en pantalla.',
    );
    expect(boton('Guardar cambios')).toBeDefined();
  });

  it('fechas con 409: muestra el mensaje del servidor', async () => {
    api.actualizarReserva.mockRejectedValue(new Errores.ConflictError('Otra persona cambió esta reserva.'));
    await moverLlegadaYGuardar();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Otra persona cambió esta reserva.');
  });

  it('fechas con error transitorio: no muestra el texto técnico, pide reintentar', async () => {
    api.actualizarReserva.mockRejectedValue(new Errores.ErrorTransitorio('HTTP 503'));
    await moverLlegadaYGuardar();
    const alerta = container.querySelector('[role="alert"]')?.textContent ?? '';
    expect(alerta).toBe('No pudimos guardar las fechas del viaje. Tus cambios siguen en pantalla: vuelve a intentarlo.');
  });

  it('503 con mensaje del servidor: lo muestra y el botón pasa a «Reintentar»', async () => {
    api.actualizarReserva.mockRejectedValue(new Errores.ErrorTransitorio('No pudimos leer la configuración. Intenta de nuevo.', true));
    await moverLlegadaYGuardar();
    const alerta = container.querySelector('[role="alert"]')?.textContent ?? '';
    expect(alerta).toBe('No pudimos guardar las fechas del viaje. No pudimos leer la configuración. Intenta de nuevo. Tus cambios siguen en pantalla.');
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Reintentar')).toBe(true);
  });
});

describe('Ficha del pescador: costo del proveedor', () => {
  const profit = { SupplierCost: 2400, Amount: 7300, Percent: 74.5, Currency: 'USD', Reason: null };

  // Rótulo único «Costo de Guía» (QA del 17-oct), con o sin Supplier.
  it.each([['con', 'Río Baker Guías'], ['sin', null]])('%s Supplier el rótulo es «Costo de Guía»', async (_c, supplier) => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    await render(reserva({ Profit: { ...profit, Supplier: supplier } }));
    expect(container.textContent).toContain('Costo de GuíaUSD 2.400');
    expect(container.textContent).not.toContain('Costo del guía');
    expect(container.textContent).not.toContain('Costo de Río');
  });
});

describe('Ficha del pescador: costo por programa', () => {
  const PROV = 'Río Baker Guías';

  it('All Inclusive: costo por pescador y licencia incluida, sin la pregunta', async () => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    await render(reserva({ FishingLicensePurchased: null, PartyMembers: 2, TotalAmount: 19600, Profit: {
      SupplierCost: 8400, Amount: 11200, Percent: 57.1, Currency: 'USD', Reason: null, Supplier: PROV,
      Programa: 'ALL_INCLUSIVE', Mercado: 'USA', MercadoAsumido: false, UnitCost: 4200, Units: 2, Unit: 'pescador', IncluyeLicencia: true } }));
    expect(container.textContent).toContain('Costo de GuíaUSD 4.200 × 2 pescadores = USD 8.400');
    expect(container.textContent).toContain('Licencia de pescaIncluida, la compra el guía');
    expect(container.querySelector('[role="group"][aria-label="¿La compramos nosotros?"]')).toBeNull();
    expect(container.textContent).not.toContain('Mercado asumido');
  });

  it('All Inclusive de Chile sin tarifa propia: dice que usó la tarifa USA', async () => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    await render(reserva({ PartyMembers: 1, TotalAmount: 9800, Profit: {
      SupplierCost: 4200, Amount: 5600, Percent: 57.1, Currency: 'USD', Reason: null, Supplier: PROV,
      Programa: 'ALL_INCLUSIVE', Mercado: 'CL', MercadoCosto: 'USA', MercadoAsumido: false, UnitCost: 4200, Units: 1, Unit: 'pescador', IncluyeLicencia: true } }));
    expect(container.textContent).toContain('🇨🇱MercadoChileCosto con tarifa USA y otros (no hay tarifa propia para Chile)');
  });

  it('MONEDA_DISTINTA: sin monto, pero con las jornadas', async () => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    await render(reserva({ RoomID: 'Full Day', PartyMembers: 1, TotalAmount: 450, Profit: {
      SupplierCost: null, Amount: null, Percent: null, Currency: 'CLP', Reason: 'MONEDA_DISTINTA', Supplier: PROV,
      Programa: 'FULL_DAY', Mercado: 'CL', Units: 1, Unit: 'jornada' } }));
    expect(container.textContent).toContain('Costo de Guía1 jornada · sin monto');
    expect(container.textContent).toContain('La reserva está en USD; los costos están en CLP');
  });

  it('Full Day: costo por jornada, mercado asumido y la pregunta de la licencia sin tocar la utilidad', async () => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    await render(reserva({ RoomID: 'Full Day', FishingLicensePurchased: true, PartyMembers: 3, TotalAmount: 9000, Profit: {
      SupplierCost: 980, Amount: 8020, Percent: 89.1, Currency: 'USD', Reason: null, Supplier: PROV,
      Programa: 'FULL_DAY', Mercado: 'USA', MercadoAsumido: true, UnitCost: 490, Units: 2, Unit: 'jornada', IncluyeLicencia: false } }));
    expect(container.textContent).toContain('USD 490 × 2 jornadas = USD 980');
    expect(container.textContent).toContain('MercadoMercado asumido: USA y otros (sin país)');
    expect(container.querySelector('[role="group"][aria-label="¿La compramos nosotros?"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Incluida');
    expect(container.textContent).not.toMatch(/costo de la licencia|resta/i);
    expect(container.textContent).toContain('GananciaUSD 8.020Margen89,1\u00a0%');
  });
});


describe('Ficha del pescador: dólar y precio de lista (17-oct)', () => {
  const PROV = 'Río Baker Guías';
  const base = {
    Supplier: PROV, Programa: 'FULL_DAY', Mercado: 'BR', MercadoAsumido: false, Units: 2, Unit: 'jornada', IncluyeLicencia: false, Currency: 'USD',
  } as const;
  const convertida = {
    ...base, SupplierCost: 843.88, Amount: 56.12, Percent: 6.2, Reason: null, UnitCost: 400000,
    SupplierCostOriginal: 800000, SupplierCurrencyOriginal: 'CLP', ExchangeRate: { Value: 948, Date: '2026-11-14', Source: 'Banco Central' },
    ConfirmedAt: '2026-11-14', ListPrice: 900, BelowList: false,
  };
  const ver = (r: Partial<ReservaResumenItem>) => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    return render(reserva({ RoomID: 'Full Day', PartyMembers: 1, TotalAmount: 900, ...r }));
  };

  it('con conversión: costo en CLP, su equivalente en USD, el dólar usado y la ganancia', async () => {
    await ver({ Profit: convertida });
    const t = container.textContent ?? '';
    expect(t).toContain('Cómo se calculó la ganancia');
    expect(t).toContain('CobradoUSD 900');
    expect(t).toContain('Precio de lista2 jornadas × USD 450 = USD 900');
    expect(t).toContain('Costo de GuíaCLP 400.000 × 2 jornadas = CLP 800.000= USD 843,88');
    expect(t).toContain('Dólar usado1 USD = CLP 948,00Dólar observado del 14 nov 2026, día en que se confirmó la reserva (Banco Central).');
    expect(t).toContain('GananciaUSD 56,12Margen6,2\u00a0%');
    expect(t).toContain('Fórmula de la ganancia(900 − 843,88) ÷ 900 = 6,2\u00a0%');
    // Costo convertido con el dólar: sin margen de lista comparable.
    expect(t).not.toContain('lista 6');
    expect(t).not.toContain('Bajo lista');
    expect(t).not.toContain('Utilidad');
  });

  it('dólar de otro día: nombra ambas fechas con el día de la semana', async () => {
    await ver({ Profit: { ...convertida, ExchangeRate: { Value: 948, Date: '2026-11-13', Source: 'Banco Central' }, ConfirmedAt: '2026-11-15' } });
    expect(container.textContent).toContain('Dólar observado del vie 13 nov 2026 (Banco Central). La reserva se confirmó el dom 15 nov 2026.');
  });

  it('bajo lista: el aviso es texto, con la diferencia', async () => {
    await ver({ TotalAmount: 800, Profit: { ...convertida, Amount: -43.88, Percent: -5.5, BelowList: true } });
    const nota = container.querySelector('[role="note"]');
    expect(nota?.textContent).toBe('Bajo listaSe cobró USD 100 menos que la lista.');
    expect(container.textContent).toContain('Pierde USD 43,88');
    expect(container.textContent).toContain('Ganancia−USD 43,88PérdidaMargen−5,5\u00a0%');
  });

  it('CA-F7: Full Day Chile bajo lista muestra margen, margen de lista y chip neutro', async () => {
    await ver({
      Currency: 'CLP', TotalAmount: 350000,
      Profit: { ...base, Mercado: 'CL', Units: 1, Currency: 'CLP', SupplierCost: 300000, UnitCost: 300000, Amount: 50000, Percent: 14.3, Reason: null, ListPrice: 360000, BelowList: true },
    });
    const margen = container.querySelector('[data-tarjeta="resumen-venta"] [data-dato="Margen"]');
    expect(margen?.textContent).toBe('Margen14,3\u00a0%lista 16,7\u00a0%Bajo lista');
    const chip = margen?.querySelector('[data-bajo-lista]') as HTMLElement;
    expect(chip.className).toBe('chip'); // neutro: .chip usa --status-neutro-text; .chip--critico solo en pérdida
  });

  it('confirmada sin dólar: «—» en el dólar y en la ganancia, con el motivo', async () => {
    await ver({ Profit: { ...base, SupplierCost: null, Amount: null, Percent: null, Reason: 'SIN_DOLAR', ConfirmedAt: '2026-11-14', ExchangeRate: null, ListPrice: 900, BelowList: false } });
    const t = container.textContent ?? '';
    expect(t).toContain('Dólar usado—');
    expect(t).toContain('Ganancia—Margen—Falta el dólar observado del 14 nov 2026: la ganancia no se calcula');
  });

  it('pendiente: el dólar se fija al confirmar', async () => {
    await ver({ Status: 'PENDING', Profit: { ...base, SupplierCost: null, Amount: null, Percent: null, Reason: 'SIN_FECHA_CONFIRMACION', ConfirmedAt: null, ExchangeRate: null, ListPrice: 900, BelowList: null } });
    const t = container.textContent ?? '';
    expect(t).toContain('Dólar usadoSe fija al confirmar.');
    expect(t).toContain('Ganancia—Margen—Se calcula al confirmar la reserva, con el dólar observado de ese día.');
  });

  it('sin precio de lista en la moneda de la reserva lo dice; servidor antiguo no muestra el dato', async () => {
    await ver({ Profit: { ...convertida, ListPrice: null, BelowList: null } });
    expect(container.textContent).toContain('Precio de listaSin precio de lista para esa fecha.');
    act(() => root.unmount());
    container.remove();
    await ver({ Profit: { ...base, SupplierCost: 980, Amount: -80, Percent: -8.9, Reason: null, UnitCost: 490 } });
    const t = container.textContent ?? '';
    expect(t).not.toContain('Precio de lista');
    expect(t).not.toContain('Dólar usado');
    expect(t).not.toMatch(/undefined|NaN/);
  });
});

// Fichas REALES del backend (17-oct): `Profit` tal como lo calcula 04-codigo.
describe('Ficha del pescador con la respuesta real del backend (17-oct)', () => {
  const fichas = REAL.fichas_por_booking_id as unknown as Record<string, { reservas: ReservaResumenItem[] }>;
  const C = REAL.casos;
  const verReal = (id: string) => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    const r = fichas[id].reservas.find((x) => x.BookingID === id)!;
    return render(r);
  };

  it('Brasil: dólar del viernes y confirmación del sábado, costo CLP pasado a USD', async () => {
    await verReal(C.fd_br);
    const t = container.textContent ?? '';
    expect(t).toContain('CLP 400.000 × 1 jornada = CLP 400.000= USD 406,47');
    expect(t).toContain('1 USD = CLP 984,09');
    expect(t).toContain('Dólar observado del vie 16 oct 2026 (Banco Central de Chile vía mindicador.cl). La reserva se confirmó el sáb 17 oct 2026.');
    expect(t).toContain('GananciaUSD 43,53Margen9,7\u00a0%');
    expect(t).toContain('ProgramaFull Day');
    expect(t).not.toContain('FULL_DAY');
  });

  it('bajo lista: aviso con la diferencia contra la lista', async () => {
    await verReal(C.bajo_lista);
    expect(container.querySelector('[role="note"]')?.textContent).toBe('Bajo listaSe cobró USD 90 menos que la lista.');
    expect(container.textContent).not.toContain('Dólar usado');
  });

  it('sin dólar y sin fecha de confirmación: «—» con su motivo', async () => {
    await verReal(C.sin_dolar);
    expect(container.textContent).toContain('Ganancia—Margen—Falta el dólar observado del 20 dic 2025: la ganancia no se calcula');
    expect(container.textContent).toContain('Dólar usado—');
    act(() => root.unmount());
    container.remove();
    await verReal(C.sin_confirmed_at);
    expect(container.textContent).toContain('Falta la fecha de confirmación: sin ella no se sabe qué dólar usar');
  });

  it('All Inclusive de Chile (SIN_TARIFA): «sin tarifa», no «en USD», y sin códigos crudos', async () => {
    await verReal(C.ai_cl);
    const t = container.textContent ?? '';
    expect(t).toContain('Precio de listaSin tarifa para este programa y mercado.');
    expect(t).not.toContain('en USD para esta reserva');
    expect(t).not.toMatch(/undefined|NaN|SIN_TARIFA|ALL_INCLUSIVE|FULL_DAY/);
    expect(t).toContain('ProgramaAll Inclusive');
  });

  // QA del 17-oct: sin dólar o sin fecha de confirmación decía «1 jornada · sin monto».
  it.each([['sin dólar', C.sin_dolar], ['sin fecha de confirmación', C.sin_confirmed_at]])('%s: el costo va en CLP × jornadas, sin convertir', async (_c, id) => {
    await verReal(id);
    const t = container.textContent ?? '';
    expect(t).toContain('Costo de GuíaCLP 400.000 × 1 jornada = CLP 400.000');
    expect(t).not.toContain('sin monto');
    // Sin conversión: debajo del costo no va «= USD …».
    expect(t).not.toContain('CLP 400.000= USD');
  });
});
