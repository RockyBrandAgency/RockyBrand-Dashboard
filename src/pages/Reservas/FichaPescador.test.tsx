import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HuespedItem, ReservaResumenItem } from '../../types';

// Qué afirma: cancelar pide confirmación dentro de la página, no llama al
// backend hasta el «Sí», «Volver sin cambios» y Escape no cancelan nada y
// devuelven el foco, y la línea del pago solo sale si ya pagó algo.

const { api, auth, sesion, Errores } = vi.hoisted(() => {
  const auth = { features: { pms_ficha_pesca: true, pms_utilidad: false } as Record<string, boolean>, puede: true, handleUnauthorized: () => {} };
  // useAuth estable: un objeto nuevo por render rehace los useCallback (memoria del panel 06).
  const sesion = { handleUnauthorized: () => auth.handleUnauthorized(), clientId: 'chile-fly-fishing', get features() { return auth.features; } };
  return {
    api: { cancelarReserva: vi.fn(), confirmarReserva: vi.fn(), getHuespedes: vi.fn(), actualizarReserva: vi.fn(), getPagosReserva: vi.fn() },
    auth,
    sesion,
    Errores: {
      ErrorTransitorio: class ErrorTransitorio extends Error {
        delServidor: boolean;
        constructor(m: string, delServidor = false) {
          super(m);
          this.delServidor = delServidor;
        }
      },
      ConflictError: class ConflictError extends Error {
        code?: string;
        constructor(m?: string, code?: string) {
          super(m);
          this.code = code;
        }
      },
    },
  };
});

vi.mock('../../api/dashboardApi', () => ({
  cancelarReserva: (...a: unknown[]) => api.cancelarReserva(...a),
  confirmarReserva: (...a: unknown[]) => api.confirmarReserva(...a),
  getHuespedes: () => api.getHuespedes(),
  actualizarReserva: (...a: unknown[]) => api.actualizarReserva(...a),
  getPagosReserva: (...a: unknown[]) => api.getPagosReserva(...a),
  actualizarHuesped: vi.fn(),
  guardarAcompanantes: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ConflictError: Errores.ConflictError,
  esReservaModificada: (e: unknown) => e instanceof Errores.ConflictError && (e as { code?: string }).code === 'reserva_modificada',
  MENSAJE_RESERVA_MODIFICADA: 'Alguien cambió esta reserva mientras la editabas. Recarga para ver lo último; tus cambios no se guardaron.',
  ErrorTransitorio: Errores.ErrorTransitorio,
  TimeoutError: class TimeoutError extends Error {},
}));
vi.mock('../../context/AuthContext', () => ({ usePermiso: () => auth.puede,
  useAuth: () => sesion,
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

const onVolver = vi.fn();
const arbol = (r: ReservaResumenItem) => (
  <StrictMode>
    <FichaPescador bookingId={r.BookingID} reservas={[r]} huesped={huesped} volverA="Calendario de Reservas" isDesktop onVolver={onVolver} onCambio={onCambio} />
  </StrictMode>
);

async function render(r: ReservaResumenItem) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(arbol(r));
  });
}

// La pantalla recargó: llega un objeto de reserva nuevo (lo que hace onCambio en la app).
async function recargar(r: ReservaResumenItem) {
  await act(async () => {
    root.render(arbol(r));
  });
}

const boton = (texto: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
  api.cancelarReserva.mockReset().mockResolvedValue({});
  api.actualizarReserva.mockReset();
  api.getPagosReserva.mockReset().mockResolvedValue({ payments: [] });
  onCambio.mockReset();
  auth.features = { pms_ficha_pesca: true, pms_utilidad: false };
  auth.puede = true;
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
    // CA-F5: sin Costo Guillermo ni Margen ni bloque Guillermo; Venta, Pagó y Por cobrar en el grupo Cliente.
    expect(container.textContent).not.toContain('Costo Guillermo');
    expect(container.textContent).not.toContain('Guillermo');
    expect(container.textContent).not.toContain('Margen');
    const resumen = container.querySelector('[data-tarjeta="resumen-venta"]');
    expect(Array.from(resumen?.querySelectorAll('.dato__valor--cifra') ?? []).map((e) => e.parentElement?.getAttribute('data-dato'))).toEqual(['Venta', 'Pagó', 'Por cobrar']);
    expect(Array.from(resumen?.querySelectorAll('h3') ?? []).map((h) => h.textContent)).toEqual(['Cliente']);
    expect(resumen?.querySelector('[data-grupo="guillermo"]')).toBeNull();
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
    expect(container.textContent).toContain('GananciaUSD 8.020USD 9.000 − USD 980Margen89,1\u00a0%');
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
    expect(t).toContain('GananciaUSD 56,12USD 900 − USD 843,88Margen6,2\u00a0%');
    expect(t).toContain('Fórmula de la ganancia(900 − 843,88) ÷ 900 = 6,2\u00a0%');
    // Costo convertido con el dólar: sin margen de lista comparable.
    expect(t).not.toContain('De lista');
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
    expect(container.textContent).toContain('Ganancia−USD 43,88USD 800 − USD 843,88PérdidaMargen−5,5\u00a0%');
  });

  it('CA-F7: Full Day Chile bajo lista muestra margen, margen de lista y chip neutro', async () => {
    await ver({
      Currency: 'CLP', TotalAmount: 350000,
      Profit: { ...base, Mercado: 'CL', Units: 1, Currency: 'CLP', SupplierCost: 300000, UnitCost: 300000, Amount: 50000, Percent: 14.3, Reason: null, ListPrice: 360000, BelowList: true },
    });
    const margen = container.querySelector('[data-tarjeta="resumen-venta"] [data-dato="Margen"]');
    expect(margen?.textContent).toBe('Margen14,3\u00a0%De lista: 16,7\u00a0%Bajo lista');
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
    expect(t).toContain('GananciaUSD 43,53USD 450 − USD 406,47Margen9,7\u00a0%');
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

// Orden financiero del resumen (30-oct, ficha-finanzas-reserva). Caso real
// de Mato: All Inclusive, 31 oct – 7 nov, 2 pescadores, USA.
describe('Ficha del pescador: resumen en orden financiero (30-oct, revisión UX)', () => {
  const N = ' ';
  const profitReal = {
    SupplierCost: 8400, Amount: 4450, Percent: 34.6, Currency: 'USD', Reason: null, Supplier: 'Guillermo',
    Programa: 'ALL_INCLUSIVE', Mercado: 'USA', MercadoAsumido: false, UnitCost: 4200, Units: 2, Unit: 'pescador', IncluyeLicencia: true,
    // Precio de lista del caso real: USD 6.500 × 2 = USD 13.000.
    ListPrice: 13000, BelowList: true,
    SupplierRate: 981, SupplierCostCLP: 8240400, SupplierPaidCLP: 5356260, SupplierDueCLP: 2884140,
  } as const;
  const pagosGuia = [
    { PaymentID: 'sp_2', Date: '2026-10-29', Amount: 4120200, Notes: '70 % Mark + 30 % Laura' },
    { PaymentID: 'sp_1', Date: '2026-10-15', Amount: 1236060, Notes: '30 % Mark' },
  ];
  const real = (extra: Partial<ReservaResumenItem> = {}) =>
    reserva({
      RoomID: 'ALL_INCLUSIVE', CheckIn: '2026-10-31', CheckOut: '2026-11-07', PartyMembers: 2, GuestOriginCountry: 'Estados Unidos',
      TotalAmount: 12850, PaidAmount: 12850, BalanceDue: 0, SupplierRate: 981, SupplierPayments: pagosGuia, Profit: { ...profitReal }, ...extra,
    });
  const pagosCliente = [
    { PaymentID: 'p_2', Amount: '6500', Currency: 'USD', Method: 'WETRAVEL', Status: 'COMPLETED', PaidAt: '2026-10-14T15:00:00Z', Reference: 'wt-2', Notes: 'Laura' },
    { PaymentID: 'p_1', Amount: 6350, Currency: 'USD', Method: 'WETRAVEL', Status: 'COMPLETED', PaidAt: '2026-05-07T15:00:00Z', Reference: 'wt-1', Notes: 'Mark' },
    { PaymentID: 'p_3', Amount: 100, Currency: 'USD', Method: 'WETRAVEL', Status: 'FAILED', PaidAt: '2026-05-01T15:00:00Z', Reference: 'wt-0', Notes: 'Intento' },
  ];
  const fila = (n: string) => container.querySelector(`[data-tarjeta="resumen-venta"] [data-dato="${n}"]`) as HTMLElement | null;
  const dato = (n: string) => fila(n)?.textContent ?? null;
  const color = (n: string) => (fila(n)?.querySelector('dd') as HTMLElement | null)?.style.color ?? null;
  const conUtilidad = () => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
  };

  it('hechos y resultado a todo el ancho; Cliente y Guillermo como columnas que se leen de arriba abajo', async () => {
    conUtilidad();
    await render(real());
    const resumen = container.querySelector('[data-tarjeta="resumen-venta"]')!;
    expect(Array.from(resumen.querySelectorAll('h3')).map((h) => h.textContent)).toEqual(['Cliente', 'Guillermo (costo fijo)', 'Resultado']);
    const columnas = resumen.querySelector('.ficha-resumen__columnas')!;
    expect(Array.from(columnas.children).map((c) => c.getAttribute('data-grupo'))).toEqual(['cliente', 'guillermo']);
    expect(columnas.querySelector('[data-grupo="resultado"]')).toBeNull();
    const orden = (g: string) => Array.from(resumen.querySelectorAll(`[data-grupo="${g}"] [data-dato]`)).map((e) => e.getAttribute('data-dato'));
    expect(orden('cliente')).toEqual(['Venta', 'Pagó', 'Por cobrar']);
    expect(orden('guillermo')).toEqual(['Costo', 'Dólar acordado', 'Total CLP', 'Le pagamos', 'Por pagar']);
    expect(orden('resultado')).toEqual(['Ganancia', 'Margen']);
    // Filas de cierre: divisor y cifra.
    expect(Array.from(resumen.querySelectorAll('.fila-dato--cierre')).map((e) => e.getAttribute('data-dato'))).toEqual(['Por cobrar', 'Por pagar']);
    expect(fila('Por cobrar')!.querySelector('.dato__valor--cifra')).not.toBeNull();
    expect(fila('Por pagar')!.querySelector('.dato__valor--cifra')).not.toBeNull();
    // Concepto propio para el total en CLP (Lucide Sigma).
    expect(fila('Total CLP')!.querySelector('svg.lucide-sigma')).not.toBeNull();
    expect(resumen.querySelector('[data-grupo="resultado"] .resultado')).not.toBeNull();
  });

  it('caso real: cifras, detalles y pagos con fecha corta y nota', async () => {
    conUtilidad();
    api.getPagosReserva.mockResolvedValue({ BookingID: 'bkg_1', payments: pagosCliente });
    await render(real());
    expect(api.getPagosReserva).toHaveBeenCalledWith('bkg_1');
    expect(dato('Venta')).toBe('VentaUSD 12.850');
    // Dos pagos que cuentan (el FAILED no), en orden de pago; año solo si no es el del viaje.
    expect(dato('Pagó')).toBe('PagóUSD 12.8507 may · MarkUSD 6.35014 oct · LauraUSD 6.500');
    expect(dato('Por cobrar')).toBe('Por cobrarUSD 0Pagado completo');
    expect(dato('Costo')).toBe('CostoUSD 8.400USD 4.200 × 2 pescadores');
    expect(dato('Dólar acordado')).toBe('Dólar acordadoCLP 981');
    expect(dato('Total CLP')).toBe('Total CLPCLP 8.240.400USD 8.400 × 981');
    expect(dato('Le pagamos')).toBe(`Le pagamosCLP 5.356.26015 oct · 30${N}% MarkCLP 1.236.06029 oct · 70${N}% Mark + 30${N}% LauraCLP 4.120.200`);
    expect(dato('Por pagar')).toBe('Por pagarCLP 2.884.140Falta pagarle');
    expect(color('Por pagar')).toBe('var(--status-atencion-text)');
    expect(dato('Ganancia')).toBe('GananciaUSD 4.450USD 12.850 − USD 8.400');
    expect(dato('Margen')).toBe(`Margen34,6${N}%De lista: 35,4${N}%Bajo lista`);
    // Cada pago es una fila de dos celdas: detalle a la izquierda, monto a la derecha.
    const pago = fila('Le pagamos')!.querySelector('[data-lista="pagos-guillermo"] li')!;
    expect(Array.from(pago.children).map((c) => c.className)).toEqual(['ficha-resumen__pago-detalle', 'ficha-resumen__pago-monto']);
    expect(container.textContent).not.toContain('Dólar usado');
    expect(container.textContent).not.toMatch(/undefined|NaN/);
  });

  it('pago de otro año que el del viaje: la fecha lleva el año', async () => {
    conUtilidad();
    api.getPagosReserva.mockResolvedValue({ payments: [{ ...pagosCliente[1], PaidAt: '2025-12-20T15:00:00Z' }, pagosCliente[0]] });
    await render(real());
    expect(dato('Pagó')).toContain('20 dic 2025 · Mark');
    expect(dato('Pagó')).toContain('14 oct · Laura');
  });

  it('Guillermo, tres estados: falta, cero y de más (sin signo)', async () => {
    conUtilidad();
    await render(real({ Profit: { ...profitReal, SupplierPaidCLP: 8240400, SupplierDueCLP: 0 } }));
    expect(dato('Por pagar')).toBe('Por pagarCLP 0Pagado completo');
    expect(color('Por pagar')).toBe('var(--status-bien-text)');
    act(() => root.unmount());
    container.remove();
    await render(real({ Profit: { ...profitReal, SupplierPaidCLP: 8340400, SupplierDueCLP: -100000 } }));
    expect(fila('Por pagar')).toBeNull();
    expect(dato('Pagado de más')).toBe('Pagado de másCLP 100.000Le pagamos CLP 100.000 de más');
    expect(color('Pagado de más')).toBe('var(--status-atencion-text)');
    expect(fila('Pagado de más')!.classList.contains('fila-dato--cierre')).toBe(true);
  });

  it('cliente, tres estados: falta, cero y de más (sin signo)', async () => {
    conUtilidad();
    await render(real({ PaidAmount: 6350, BalanceDue: 6500 }));
    expect(dato('Por cobrar')).toBe('Por cobrarUSD 6.500Falta cobrarle');
    expect(color('Por cobrar')).toBe('var(--status-atencion-text)');
    act(() => root.unmount());
    container.remove();
    await render(real({ PaidAmount: 13050, BalanceDue: -200 }));
    expect(fila('Por cobrar')).toBeNull();
    expect(dato('Pagó de más')).toBe('Pagó de másUSD 200Revisa si corresponde devolución');
    expect(color('Pagó de más')).toBe('var(--status-atencion-text)');
    act(() => root.unmount());
    container.remove();
    await render(real());
    expect(color('Por cobrar')).toBe('var(--status-bien-text)');
  });

  it('sin dólar acordado ni pagos: «Sin acordar», «—» con el motivo y «Sin pagos todavía»', async () => {
    conUtilidad();
    await render(real({
      SupplierRate: null,
      SupplierPayments: [],
      Profit: { ...profitReal, SupplierRate: null, SupplierCostCLP: null, SupplierPaidCLP: 0, SupplierDueCLP: null },
    }));
    expect(dato('Dólar acordado')).toBe('Dólar acordadoSin acordar');
    expect(color('Dólar acordado')).toBe('var(--status-atencion-text)');
    expect(dato('Total CLP')).toBe('Total CLP—Falta el dólar acordado');
    expect(dato('Le pagamos')).toBe('Le pagamosCLP 0Sin pagos todavía');
    expect(dato('Por pagar')).toBe('Por pagar—Falta el dólar acordado');
    expect(boton('Editar dólar y pagos')).toBeDefined();
  });

  it('un solo pago del cliente, o la ruta de pagos caída: sin desglose y sin aviso', async () => {
    conUtilidad();
    api.getPagosReserva.mockResolvedValue({ payments: [pagosCliente[1]] });
    await render(real());
    expect(dato('Pagó')).toBe('PagóUSD 12.850');
    act(() => root.unmount());
    container.remove();
    api.getPagosReserva.mockReset().mockRejectedValue(new Error('No encontrado'));
    await render(real());
    expect(dato('Pagó')).toBe('PagóUSD 12.850');
    expect(container.querySelector('[data-tarjeta="resumen-venta"] [role="alert"]')).toBeNull();
  });

  it('una devolución resta en el desglose, sin sumar monedas', async () => {
    conUtilidad();
    api.getPagosReserva.mockResolvedValue({ payments: [pagosCliente[1], { ...pagosCliente[0], Status: 'REFUNDED', Notes: 'Reembolso' }] });
    await render(real({ PaidAmount: -150, BalanceDue: 13000 }));
    expect(dato('Pagó')).toContain('7 may · MarkUSD 6.35014 oct · Devolución · Reembolso−USD 6.500');
  });

  it('CA-F5 con rol sin costos: sin Guillermo ni Margen aunque el servidor mande los campos nuevos', async () => {
    await render(real());
    const t = container.querySelector('[data-tarjeta="resumen-venta"]')?.textContent ?? '';
    expect(t).not.toContain('Guillermo');
    expect(t).not.toContain('Margen');
    expect(t).not.toContain('CLP');
    expect(boton('Editar dólar y pagos')).toBeUndefined();
  });

  it('servidor anterior (sin SupplierCostCLP): sin Total, Le pagamos ni Por pagar, con el aviso', async () => {
    conUtilidad();
    const { SupplierRate: _r, SupplierCostCLP: _c, SupplierPaidCLP: _p, SupplierDueCLP: _d, ...viejo } = profitReal;
    await render(reserva({ RoomID: 'ALL_INCLUSIVE', PartyMembers: 2, TotalAmount: 12850, PaidAmount: 12850, BalanceDue: 0, Profit: { ...viejo } }));
    expect(dato('Costo')).toBe('CostoUSD 8.400USD 4.200 × 2 pescadores');
    expect(dato('Dólar acordado')).toBe('Dólar acordado—');
    expect(fila('Total CLP')).toBeNull();
    expect(fila('Le pagamos')).toBeNull();
    expect(fila('Por pagar')).toBeNull();
    const aviso = container.querySelector('[data-grupo="guillermo"] [data-aviso="servidor"]');
    expect(aviso?.textContent).toBe('El total en CLP y los pagos a Guillermo aparecen cuando se actualice el servidor.');
    expect(aviso?.className).toBe('ficha-resumen__motivo');
    expect(boton('Editar dólar y pagos')).toBeUndefined();
    expect(container.textContent).not.toMatch(/undefined|NaN|Sin acordar/);
  });

  it('números como texto (default=str del backend): se leen igual', async () => {
    conUtilidad();
    await render(real({
      SupplierPayments: [{ Date: '2026-10-15', Amount: '4120200' as unknown as number, Notes: '' }],
      Profit: { ...profitReal, SupplierRate: '981' as unknown as number, SupplierCostCLP: '8240400' as unknown as number, SupplierPaidCLP: '4120200' as unknown as number, SupplierDueCLP: '4120200' as unknown as number },
    }));
    expect(dato('Dólar acordado')).toBe('Dólar acordadoCLP 981');
    expect(dato('Le pagamos')).toBe('Le pagamosCLP 4.120.20015 octCLP 4.120.200');
  });

  describe('editar dólar y pagos', () => {
    const escribir = async (input: HTMLInputElement, valor: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      await act(async () => {
        setter.call(input, valor);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    const editor = () => container.querySelector('[data-editor="guillermo"]') as HTMLElement;
    const campo = (etiqueta: string, n = 0) => {
      const labels = Array.from(editor().querySelectorAll('label')).filter((l) => l.textContent === etiqueta);
      return editor().querySelector(`#${CSS.escape(labels[n].htmlFor)}`) as HTMLInputElement;
    };
    const porEtiqueta = (aria: string) => editor().querySelector(`[aria-label="${aria}"]`) as HTMLButtonElement;
    const vista = (n: string) => editor().querySelector(`[data-vista="${n}"]`)?.textContent ?? null;
    const abrirEditor = async () => act(async () => boton('Editar dólar y pagos')!.click());
    const tecla = async (key: string) => act(async () => {
      (document.activeElement ?? editor()).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });

    it('recién abierto: pagos cerrados como filas de lectura; solo uno abierto a la vez', async () => {
      conUtilidad();
      await render(real());
      await abrirEditor();
      expect(document.activeElement).toBe(campo('Dólar acordado (CLP por 1 USD)'));
      expect(editor().querySelectorAll('input[type="date"]')).toHaveLength(0);
      const filas = Array.from(editor().querySelectorAll('.editor-guillermo__pago--cerrado')).map((f) => f.textContent);
      expect(filas).toEqual([`15 oct · CLP 1.236.06030${N}% MarkEditarQuitar`, `29 oct · CLP 4.120.20070${N}% Mark + 30${N}% LauraEditarQuitar`]);
      await act(async () => porEtiqueta('Editar el pago 1').click());
      expect(editor().querySelectorAll('input[type="date"]')).toHaveLength(1);
      expect(document.activeElement).toBe(campo('Fecha'));
      // «Quitar» va en la línea del título del pago abierto.
      expect(editor().querySelector('.editor-guillermo__pago-cabecera')?.textContent).toBe('Pago 1Quitar');
      await act(async () => porEtiqueta('Editar el pago 2').click());
      expect(editor().querySelectorAll('input[type="date"]')).toHaveLength(1);
      expect(campo('Monto (CLP)').value).toBe('4.120.200');
    });

    it('vista previa local: costo en CLP, un pescador, suma y lo que queda; aviso si se pasa, sin bloquear', async () => {
      conUtilidad();
      api.actualizarReserva.mockImplementation((_id, c) => Promise.resolve({ BookingID: 'bkg_1', message: 'ok', ...c }));
      await render(real());
      await abrirEditor();
      expect(vista('costo')).toBe('Costo: USD 8.400 × 981 = CLP 8.240.400Un pescador: CLP 4.120.200');
      expect(vista('suma')).toBe('Suma de pagos: CLP 5.356.260Queda por pagar: CLP 2.884.140');
      expect(editor().querySelector('[aria-live]')).toBeNull();
      await escribir(campo('Dólar acordado (CLP por 1 USD)'), '985');
      expect(vista('costo')).toBe('Costo: USD 8.400 × 985 = CLP 8.274.000Un pescador: CLP 4.137.000');
      await act(async () => boton('Agregar pago')!.click());
      await escribir(campo('Fecha'), '2026-11-07');
      await escribir(campo('Monto (CLP)'), '4.000.000');
      expect(vista('queda')).toBeNull();
      expect(vista('de-mas')).toBe('Con estos pagos le pagas CLP 1.082.260 de más.');
      expect(boton('Guardar pagos')!.disabled).toBe(false);
      await act(async () => boton('Guardar pagos')!.click());
      expect(api.actualizarReserva).toHaveBeenCalledTimes(1);
    });

    it('agrega y quita pagos, y guarda la lista entera con el PUT (sin cambios de contrato)', async () => {
      conUtilidad();
      api.actualizarReserva.mockImplementation((_id, c) => Promise.resolve({ BookingID: 'bkg_1', message: 'ok', ...c }));
      await render(real());
      await abrirEditor();
      await escribir(campo('Dólar acordado (CLP por 1 USD)'), '985');
      await act(async () => boton('Agregar pago')!.click());
      expect(document.activeElement).toBe(campo('Fecha'));
      await escribir(campo('Fecha'), '2026-11-07');
      await escribir(campo('Monto (CLP)'), '2.884.140');
      await escribir(campo('Nota'), ' Saldo final ');
      await act(async () => porEtiqueta('Quitar el pago 2').click());
      await act(async () => boton('Guardar pagos')!.click());
      expect(api.actualizarReserva).toHaveBeenCalledWith('bkg_1', {
        SupplierRate: 985,
        SupplierPayments: [
          { PaymentID: 'sp_1', Date: '2026-10-15', Amount: 1236060, Notes: '30 % Mark' },
          { Date: '2026-11-07', Amount: 2884140, Notes: 'Saldo final' },
        ],
      });
      expect(onCambio).toHaveBeenCalled();
      expect(editor()).toBeNull();
      expect(container.textContent).toContain('Guardaste los pagos a Guillermo.');
      expect(document.activeElement).toBe(boton('Editar dólar y pagos'));
    });

    it('tras «Quitar», el foco va al «Quitar» siguiente y, si no queda, a «Agregar pago»', async () => {
      conUtilidad();
      await render(real());
      await abrirEditor();
      await act(async () => porEtiqueta('Quitar el pago 1').click());
      expect(document.activeElement).toBe(porEtiqueta('Quitar el pago 1'));
      expect(editor().querySelector('.editor-guillermo__pago--cerrado')?.textContent).toContain('29 oct');
      await act(async () => porEtiqueta('Quitar el pago 1').click());
      expect(document.activeElement).toBe(boton('Agregar pago'));
      expect(editor().textContent).toContain('Sin pagos a Guillermo.');
    });

    it('valida antes de guardar y abre el pago con el error', async () => {
      conUtilidad();
      await render(real({ SupplierPayments: [] }));
      await abrirEditor();
      await act(async () => boton('Agregar pago')!.click());
      await act(async () => boton('Guardar pagos')!.click());
      expect(editor().querySelector('[role="alert"]')?.textContent).toBe('Falta la fecha del pago 1.');
      expect(document.activeElement).toBe(campo('Fecha'));
      await escribir(campo('Fecha'), '2026-10-20');
      await escribir(campo('Monto (CLP)'), '1.236.060,5');
      await act(async () => boton('Guardar pagos')!.click());
      expect(editor().querySelector('[role="alert"]')?.textContent).toBe('El monto del pago 1 tiene que ser un número entero de pesos mayor que cero.');
      expect(campo('Monto (CLP)').getAttribute('aria-invalid')).toBe('true');
      expect(api.actualizarReserva).not.toHaveBeenCalled();
    });

    it('sin eco del servidor: avisa que no se guardó y deja el editor abierto', async () => {
      conUtilidad();
      api.actualizarReserva.mockResolvedValue({ BookingID: 'bkg_1', message: 'ok' });
      await render(real());
      await abrirEditor();
      await act(async () => boton('Guardar pagos')!.click());
      expect(editor().querySelector('[role="alert"]')?.textContent).toBe('No se guardó: el servidor todavía no acepta los pagos a Guillermo.');
      expect(onCambio).not.toHaveBeenCalled();
    });

    it('«Cancelar» o Escape sin cambios cierra y devuelve el foco', async () => {
      conUtilidad();
      await render(real());
      await abrirEditor();
      await act(async () => boton('Cancelar')!.click());
      expect(editor()).toBeNull();
      expect(document.activeElement).toBe(boton('Editar dólar y pagos'));
      await abrirEditor();
      await tecla('Escape');
      expect(editor()).toBeNull();
      expect(api.actualizarReserva).not.toHaveBeenCalled();
    });

    it('con cambios, «Cancelar» y Escape piden confirmar en línea: «Seguir editando» o «Descartar»', async () => {
      conUtilidad();
      await render(real());
      await abrirEditor();
      await escribir(campo('Dólar acordado (CLP por 1 USD)'), '990');
      await act(async () => boton('Cancelar')!.click());
      expect(editor().textContent).toContain('¿Descartar los cambios en los pagos?');
      expect(document.activeElement).toBe(boton('Seguir editando'));
      await act(async () => boton('Seguir editando')!.click());
      expect(editor().textContent).not.toContain('¿Descartar');
      expect(campo('Dólar acordado (CLP por 1 USD)').value).toBe('990');
      expect(document.activeElement).toBe(boton('Cancelar'));
      await tecla('Escape');
      expect(editor().textContent).toContain('¿Descartar los cambios en los pagos?');
      await act(async () => boton('Descartar')!.click());
      expect(editor()).toBeNull();
      expect(api.actualizarReserva).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(boton('Editar dólar y pagos'));
    });

    it('rol Lectura y reserva cancelada: se ve, pero no se edita', async () => {
      conUtilidad();
      auth.puede = false;
      await render(real());
      expect(dato('Por pagar')).toBe('Por pagarCLP 2.884.140Falta pagarle');
      expect(boton('Editar dólar y pagos')).toBeUndefined();
      act(() => root.unmount());
      container.remove();
      auth.puede = true;
      await render(real({ Status: 'CANCELLED' }));
      expect(dato('Total CLP')).toBe('Total CLPCLP 8.240.400USD 8.400 × 981');
      expect(boton('Editar dólar y pagos')).toBeUndefined();
    });

    it('manda ExpectedUpdatedAt con el UpdatedAt que trajo la reserva', async () => {
      conUtilidad();
      api.actualizarReserva.mockImplementation((_id, c) => Promise.resolve({ BookingID: 'bkg_1', message: 'ok', ...c }));
      await render(real({ UpdatedAt: '2026-10-30T12:00:00.000Z' }));
      await abrirEditor();
      await act(async () => boton('Guardar pagos')!.click());
      expect(api.actualizarReserva.mock.calls[0][1]).toMatchObject({ SupplierRate: 981, ExpectedUpdatedAt: '2026-10-30T12:00:00.000Z' });
    });

    it('409 reserva_modificada: avisa, conserva lo escrito, no deja reintentar y «Recargar» vuelve a cargar', async () => {
      conUtilidad();
      api.actualizarReserva.mockRejectedValue(new Errores.ConflictError('La reserva cambió.', 'reserva_modificada'));
      await render(real({ UpdatedAt: '2026-10-30T12:00:00.000Z' }));
      await abrirEditor();
      await escribir(campo('Dólar acordado (CLP por 1 USD)'), '990');
      await act(async () => boton('Guardar pagos')!.click());
      const aviso = editor().querySelector('[data-aviso="reserva-modificada"]');
      expect(aviso?.querySelector('[role="alert"]')?.textContent).toBe(
        'Alguien cambió esta reserva mientras la editabas. Recarga para ver lo último; tus cambios no se guardaron.',
      );
      expect(document.activeElement).toBe(boton('Recargar'));
      expect(campo('Dólar acordado (CLP por 1 USD)').value).toBe('990');
      expect(boton('Guardar pagos')!.disabled).toBe(true);
      expect(onCambio).not.toHaveBeenCalled();
      await act(async () => boton('Recargar')!.click());
      expect(onCambio).toHaveBeenCalledTimes(1);
      expect(editor()).toBeNull();
      expect(document.activeElement).toBe(boton('Editar dólar y pagos'));
    });

    it('un 409 sin el código reserva_modificada es un error común, sin «Recargar»', async () => {
      conUtilidad();
      api.actualizarReserva.mockRejectedValue(new Errores.ConflictError('Otro conflicto.'));
      await render(real());
      await abrirEditor();
      await act(async () => boton('Guardar pagos')!.click());
      expect(editor().querySelector('[role="alert"]')?.textContent).toBe('No pudimos guardar los pagos. Otro conflicto.');
      expect(boton('Recargar')).toBeUndefined();
    });

    it('dólar con convención chilena: «1.000» es mil, más de 2 decimales se rechaza y fuera de rango avisa sin bloquear', async () => {
      conUtilidad();
      api.actualizarReserva.mockImplementation((_id, c) => Promise.resolve({ BookingID: 'bkg_1', message: 'ok', ...c }));
      await render(real());
      await abrirEditor();
      const dolar = () => campo('Dólar acordado (CLP por 1 USD)');
      await escribir(dolar(), '1.000');
      expect(vista('costo')).toContain('Costo: USD 8.400 × 1.000 = CLP 8.400.000');
      expect(vista('dolar-rango')).toBeNull();
      await escribir(dolar(), '981,555');
      await act(async () => boton('Guardar pagos')!.click());
      expect(editor().querySelector('[role="alert"]')?.textContent).toBe('Máximo 2 decimales');
      expect(document.activeElement).toBe(dolar());
      expect(api.actualizarReserva).not.toHaveBeenCalled();
      await escribir(dolar(), '98,5');
      expect(vista('dolar-rango')).toBe('Revisa el dólar: CLP 98,5 por 1 USD parece fuera de rango');
      expect(dolar().getAttribute('aria-describedby')).toContain(editor().querySelector('[data-vista="dolar-rango"]')!.id);
      await act(async () => boton('Guardar pagos')!.click());
      expect(api.actualizarReserva.mock.calls[0][1]).toMatchObject({ SupplierRate: 98.5 });
    });

    it('con la confirmación de cancelar abierta, «Editar dólar y pagos» queda bloqueado', async () => {
      conUtilidad();
      await render(real());
      await act(async () => boton('Cancelar reserva')!.click());
      expect(boton('Editar dólar y pagos')!.disabled).toBe(true);
    });

    // Ronda 4 (30-oct): un PUT solo lleva ExpectedUpdatedAt=V si lo editado es
    // exactamente lo del servidor en V. El editor toma lista y versión juntas.
    describe('versión con recargas (ronda 4)', () => {
      const V1 = '2026-10-30T12:00:00.000Z';
      const V2 = '2026-10-30T12:05:00.000Z';
      const V3 = '2026-10-30T12:10:00.000Z';
      const X = { PaymentID: 'sp_x', Date: '2026-10-30', Amount: 500000, Notes: 'Pago de B' };
      const guardarPagos = () =>
        Array.from(editor().querySelectorAll('button')).find((b) => ['Guardar pagos', 'Actualizando…', 'Guardando…'].includes(b.textContent ?? ''))!;
      const filas = () => Array.from(editor().querySelectorAll('.editor-guillermo__pago--cerrado')).map((f) => f.textContent ?? '');
      const equipo = (n: 0 | 1) => container.querySelectorAll('[role="group"][aria-label="Trae equipo"] button')[n] as HTMLButtonElement;
      const conflicto = () => new Errores.ConflictError('La reserva cambió.', 'reserva_modificada');

      it('B agregó X; A guarda «trae equipo» con el editor editado: el PUT de pagos lleva la versión vieja, da 409 y no borra X', async () => {
        conUtilidad();
        api.actualizarReserva.mockImplementation((_id, c: Record<string, unknown>) =>
          c.SupplierPayments ? Promise.reject(conflicto()) : Promise.resolve({ BookingID: 'bkg_1', message: 'ok', ...c, UpdatedAt: V3 }),
        );
        await render(real({ UpdatedAt: V1, BringsOwnGear: null }));
        await abrirEditor();
        await escribir(campo('Dólar acordado (CLP por 1 USD)'), '990');
        await act(async () => equipo(0).click());
        await act(async () => boton('Guardar cambios')!.click());
        expect(api.actualizarReserva.mock.calls[0][1]).toEqual({ BringsOwnGear: true, ExpectedUpdatedAt: V1 });
        expect(onCambio).toHaveBeenCalledTimes(1);
        // Recarga pendiente: el editor no guarda.
        expect(guardarPagos().textContent).toBe('Actualizando…');
        expect(guardarPagos().disabled).toBe(true);

        await recargar(real({ UpdatedAt: V3, BringsOwnGear: true, SupplierPayments: [X, ...pagosGuia] }));
        expect(campo('Dólar acordado (CLP por 1 USD)').value).toBe('990');
        expect(filas().some((f) => f.includes('CLP 500.000'))).toBe(false);
        expect(guardarPagos().textContent).toBe('Guardar pagos');

        await act(async () => guardarPagos().click());
        const put = api.actualizarReserva.mock.calls[1][1] as { ExpectedUpdatedAt?: string; SupplierPayments: { PaymentID?: string }[] };
        expect(put.ExpectedUpdatedAt).toBe(V1);
        expect(put.SupplierPayments.map((p) => p.PaymentID)).not.toContain('sp_x');
        expect(editor().querySelector('[data-aviso="reserva-modificada"] [role="alert"]')?.textContent).toBe(
          'Alguien cambió esta reserva mientras la editabas. Recarga para ver lo último; tus cambios no se guardaron.',
        );
        expect(onCambio).toHaveBeenCalledTimes(1);
      });

      it('recarga sin cambios en el editor: lo rearma con lo del servidor y guarda con la versión nueva', async () => {
        conUtilidad();
        api.actualizarReserva.mockImplementation((_id, c) => Promise.resolve({ BookingID: 'bkg_1', message: 'ok', ...c, UpdatedAt: '2026-10-30T12:20:00.000Z' }));
        await render(real({ UpdatedAt: V1 }));
        await abrirEditor();
        expect(filas()).toHaveLength(2);
        await recargar(real({ UpdatedAt: V3, SupplierPayments: [X, ...pagosGuia] }));
        expect(filas()).toHaveLength(3);
        expect(filas()[2]).toContain('30 oct · CLP 500.000');
        await act(async () => guardarPagos().click());
        const put = api.actualizarReserva.mock.calls[0][1] as { ExpectedUpdatedAt?: string; SupplierPayments: { PaymentID?: string }[] };
        expect(put.ExpectedUpdatedAt).toBe(V3);
        expect(put.SupplierPayments.map((p) => p.PaymentID)).toContain('sp_x');
      });

      it('recarga con cambios en el editor: conserva lo escrito, la lista y la versión con que se abrió', async () => {
        conUtilidad();
        api.actualizarReserva.mockRejectedValue(conflicto());
        await render(real({ UpdatedAt: V1 }));
        await abrirEditor();
        await escribir(campo('Dólar acordado (CLP por 1 USD)'), '990');
        await recargar(real({ UpdatedAt: V3, SupplierPayments: [X, ...pagosGuia] }));
        expect(campo('Dólar acordado (CLP por 1 USD)').value).toBe('990');
        expect(filas()).toHaveLength(2);
        await act(async () => guardarPagos().click());
        expect(api.actualizarReserva.mock.calls[0][1]).toMatchObject({ SupplierRate: 990, ExpectedUpdatedAt: V1 });
        expect(editor().querySelector('[data-aviso="reserva-modificada"]')).not.toBeNull();
      });

      it('dos guardados propios seguidos de pagos: el segundo espera la recarga y va con la versión nueva, sin 409', async () => {
        conUtilidad();
        api.actualizarReserva
          .mockImplementationOnce((_id, c) => Promise.resolve({ BookingID: 'bkg_1', message: 'ok', ...c, UpdatedAt: V2 }))
          .mockImplementationOnce((_id, c) => Promise.resolve({ BookingID: 'bkg_1', message: 'ok', ...c, UpdatedAt: V3 }));
        await render(real({ UpdatedAt: V1 }));
        await abrirEditor();
        await escribir(campo('Dólar acordado (CLP por 1 USD)'), '985');
        await act(async () => guardarPagos().click());
        expect(api.actualizarReserva.mock.calls[0][1]).toMatchObject({ SupplierRate: 985, ExpectedUpdatedAt: V1 });
        expect(editor()).toBeNull();
        await abrirEditor();
        expect(guardarPagos().disabled).toBe(true);
        expect(guardarPagos().textContent).toBe('Actualizando…');
        await recargar(real({ UpdatedAt: V2, SupplierRate: 985, Profit: { ...profitReal, SupplierRate: 985 } }));
        expect(guardarPagos().disabled).toBe(false);
        await escribir(campo('Dólar acordado (CLP por 1 USD)'), '990');
        await act(async () => guardarPagos().click());
        expect(api.actualizarReserva).toHaveBeenCalledTimes(2);
        expect(api.actualizarReserva.mock.calls[1][1]).toMatchObject({ SupplierRate: 990, ExpectedUpdatedAt: V2 });
        expect(container.textContent).toContain('Guardaste los pagos a Guillermo.');
      });

      it('dos guardados propios seguidos en la ficha: el segundo va con la versión que devolvió el primero', async () => {
        conUtilidad();
        api.actualizarReserva
          .mockImplementationOnce((_id, c) => Promise.resolve({ BookingID: 'bkg_1', message: 'ok', ...c, UpdatedAt: V2 }))
          .mockImplementationOnce((_id, c) => Promise.resolve({ BookingID: 'bkg_1', message: 'ok', ...c, UpdatedAt: V3 }));
        await render(real({ UpdatedAt: V1, BringsOwnGear: null }));
        await act(async () => equipo(0).click());
        await act(async () => boton('Guardar cambios')!.click());
        await act(async () => equipo(1).click());
        // Antes de que llegue la recarga, la ficha tampoco guarda.
        expect(boton('Actualizando…')!.disabled).toBe(true);
        await recargar(real({ UpdatedAt: V2, BringsOwnGear: true }));
        await act(async () => boton('Guardar cambios')!.click());
        expect(api.actualizarReserva.mock.calls.map((c) => c[1])).toEqual([
          { BringsOwnGear: true, ExpectedUpdatedAt: V1 },
          { BringsOwnGear: false, ExpectedUpdatedAt: V2 },
        ]);
        expect(container.querySelector('[data-aviso="reserva-modificada"]')).toBeNull();
      });

      it('PUT de la ficha con 409: mismo mensaje, foco en «Recargar», no reintenta y «Recargar» descarta y vuelve a cargar', async () => {
        api.actualizarReserva.mockRejectedValue(conflicto());
        await render(reserva({ UpdatedAt: V1, BringsOwnGear: null }));
        await act(async () => equipo(0).click());
        await act(async () => boton('Guardar cambios')!.click());
        expect(api.actualizarReserva).toHaveBeenCalledWith('bkg_1', { BringsOwnGear: true, ExpectedUpdatedAt: V1 });
        const aviso = container.querySelector('[data-aviso="reserva-modificada"]');
        expect(aviso?.querySelector('[role="alert"]')?.textContent).toBe(
          'Alguien cambió esta reserva mientras la editabas. Recarga para ver lo último; tus cambios no se guardaron.',
        );
        expect(document.activeElement).toBe(boton('Recargar'));
        expect(boton('Guardar cambios')!.disabled).toBe(true);
        expect(onCambio).not.toHaveBeenCalled();
        await act(async () => boton('Recargar')!.click());
        expect(onCambio).toHaveBeenCalledTimes(1);
        expect(container.querySelector('[data-aviso="reserva-modificada"]')).toBeNull();
        expect(equipo(0).getAttribute('aria-pressed')).not.toBe('true');
      });
    });
  });
});

describe('Dólar acordado: lectura chilena (30-oct)', () => {
  it('«.» es miles y «,» decimal; más de 2 decimales y el punto decimal se rechazan', async () => {
    const { leerDolar, errorDolar, avisoDolar } = await import('./PagosGuillermo');
    expect(leerDolar('981')).toBe(981);
    expect(leerDolar(' 981,5 ')).toBe(981.5);
    expect(leerDolar('981,50')).toBe(981.5);
    expect(leerDolar('1.000')).toBe(1000);
    expect(leerDolar('1.000,25')).toBe(1000.25);
    expect(leerDolar('')).toBeNull();
    expect(leerDolar('981.5')).toBeNaN();
    expect(leerDolar('1.00')).toBeNaN();
    expect(leerDolar('0')).toBeNaN();
    expect(errorDolar('981,555')).toBe('Máximo 2 decimales');
    expect(errorDolar('981.5')).toBe('El dólar acordado tiene que ser un número mayor que cero, por ejemplo 981 o 981,50.');
    expect(errorDolar('abc')).toBe('El dólar acordado tiene que ser un número mayor que cero, por ejemplo 981 o 981,50.');
    expect(errorDolar('')).toBeNull();
    expect(avisoDolar(981)).toBeNull();
    expect(avisoDolar(100)).toBeNull();
    expect(avisoDolar(5000)).toBeNull();
    expect(avisoDolar(99.99)).toBe('Revisa el dólar: CLP 99,99 por 1 USD parece fuera de rango');
    expect(avisoDolar(9810)).toBe('Revisa el dólar: CLP 9.810 por 1 USD parece fuera de rango');
    expect(avisoDolar(null)).toBeNull();
  });
});

describe('Ficha del pescador: rol Lectura sin IdentityDocument (30-oct)', () => {
  it('acompañantes sin la clave del documento: se ven, sin «undefined»; el bloque financiero se ve sin editar', async () => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    auth.puede = false;
    const companero = { CompanionID: 'cmp_1', FirstName: 'Laura', LastName: 'Ríos', BirthDate: '1985-02-01', FoodAllergy: false, FoodAllergyDetail: '', Notes: '' };
    await render(reserva({ Companions: [companero], UpdatedAt: '2026-10-30T12:00:00.000Z' }));
    const t = container.querySelector('[data-tarjeta="acompanantes"]')?.textContent ?? '';
    expect(t).toContain('Laura Ríos');
    expect(container.querySelector('[data-tarjeta="acompanantes"] [data-dato="documento"]')).toBeNull();
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(container.querySelector('[data-tarjeta="resumen-venta"] [data-grupo="resultado"]')).not.toBeNull();
    expect(boton('Editar dólar y pagos')).toBeUndefined();
  });
});
