import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReservaResumenItem } from '../types';

// Qué afirma (16-oct, decisión de Mato): con utilidad (CFF) el programa se
// elige entre All Inclusive y Full Day y viaja con su código; la moneda se
// manda tal cual se eligió. Los demás clientes siguen con texto libre.

const { api, auth } = vi.hoisted(() => ({
  api: { crearReserva: vi.fn(), crearHuesped: vi.fn() },
  auth: { handleUnauthorized: () => {}, features: {} as Record<string, boolean> },
}));
vi.mock('../api/dashboardApi', () => ({
  crearReserva: (...a: unknown[]) => api.crearReserva(...a),
  crearHuesped: (...a: unknown[]) => api.crearHuesped(...a),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

import { NewBookingModal } from './NewBookingModal';

const reservas = [{ BookingID: 'B1', GuestID: 'G1', GuestName: 'Carlos Rojas', Status: 'CONFIRMED', CheckIn: '2026-11-01', CheckOut: '2026-11-02', RoomID: 'FULL_DAY', Source: 'Direct', TotalAmount: 1, Currency: 'CLP', PaymentStatus: 'PAID', Companions: [] }] as ReservaResumenItem[];

let container: HTMLDivElement;
let root: Root;

function valor(el: HTMLInputElement | HTMLSelectElement, v: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}
const campo = (etiqueta: string) => {
  const l = Array.from(container.querySelectorAll('label')).find((x) => x.textContent === etiqueta)!;
  return (l.htmlFor ? container.querySelector(`#${CSS.escape(l.htmlFor)}`) : l.nextElementSibling) as HTMLInputElement | HTMLSelectElement;
};

async function render() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<NewBookingModal reservas={reservas} roomViews={false} onClose={() => {}} onCreado={() => {}} />));
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  api.crearReserva.mockReset().mockResolvedValue({});
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Nueva reserva: programa', () => {
  it('con utilidad: selector con los dos códigos y la moneda elegida', async () => {
    auth.features = { pms_utilidad: true };
    await render();
    const programa = campo('Programa') as HTMLSelectElement;
    expect(programa.tagName).toBe('SELECT');
    expect(Array.from(programa.options).map((o) => [o.value, o.textContent])).toEqual([
      ['', 'Elige el programa'], ['ALL_INCLUSIVE', 'All Inclusive'], ['FULL_DAY', 'Full Day'],
    ]);
    await act(async () => {
      valor(programa, 'FULL_DAY');
      valor(campo('Check-in'), '2026-11-10');
      valor(campo('Check-out'), '2026-11-11');
      valor(campo('Moneda'), 'CLP');
    });
    const crear = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Crear reserva')!;
    expect(crear.disabled).toBe(false);
    await act(async () => crear.click());
    expect(api.crearReserva).toHaveBeenCalledWith(expect.objectContaining({ RoomID: 'FULL_DAY', Financials: expect.objectContaining({ Currency: 'CLP' }) }));
  });

  it('sin utilidad: el texto libre de siempre', async () => {
    auth.features = {};
    await render();
    expect(campo('Programa').tagName).toBe('INPUT');
  });
});

// Revisión de QA del 17-oct: es un diálogo modal de verdad (WAI-ARIA APG).
describe('Nueva reserva: diálogo accesible', () => {
  async function renderCon(onClose: () => void, abridor?: HTMLButtonElement) {
    container = document.createElement('div');
    document.body.appendChild(container);
    abridor?.focus();
    root = createRoot(container);
    await act(async () => root.render(<NewBookingModal reservas={reservas} roomViews={false} onClose={onClose} onCreado={() => {}} />));
  }
  const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  it('tiene role=dialog, aria-modal y su título; cada campo tiene etiqueta', async () => {
    auth.features = {};
    await renderCon(() => {});
    const dlg = container.querySelector('[role="dialog"]')!;
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dlg.getAttribute('aria-labelledby')!)?.textContent).toBe('Nueva reserva');
    for (const el of Array.from(dlg.querySelectorAll('input, select'))) {
      const conLabel = el.id && dlg.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      expect(Boolean(conLabel || el.getAttribute('aria-labelledby'))).toBe(true);
    }
  });

  it('Escape sin datos cierra directo', async () => {
    const onClose = vi.fn();
    const confirmar = vi.spyOn(window, 'confirm');
    await renderCon(onClose);
    await act(async () => escape());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirmar).not.toHaveBeenCalled();
    confirmar.mockRestore();
  });

  it('Escape con datos pregunta antes; si dice que no, el modal sigue', async () => {
    const onClose = vi.fn();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await renderCon(onClose);
    await act(async () => valor(campo('Total'), '450'));
    await act(async () => escape());
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => escape());
    expect(onClose).toHaveBeenCalledTimes(1);
    confirmar.mockRestore();
  });

  it('el foco entra al abrir, Tab no sale y vuelve al botón que lo abrió', async () => {
    const abridor = document.createElement('button');
    abridor.textContent = 'Nueva reserva';
    document.body.appendChild(abridor);
    await renderCon(() => {}, abridor);
    const dlg = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(dlg.contains(document.activeElement)).toBe(true);
    const enfocables = Array.from(dlg.querySelectorAll<HTMLElement>('button:not([disabled]), input, select'));
    enfocables[enfocables.length - 1].focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => document.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(enfocables[0]);
    act(() => root.unmount());
    expect(document.activeElement).toBe(abridor);
    // afterEach vuelve a desmontar: se deja una raíz vacía para eso.
    root = createRoot(container);
    abridor.remove();
  });

  it('con «Creando…» ni Escape, ni el fondo, ni la ×, ni Cancelar lo cierran (evita reservas duplicadas)', async () => {
    auth.features = {};
    api.crearReserva.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    await renderCon(onClose);
    await act(async () => {
      valor(campo('Programa'), 'Programa 2 días');
      valor(campo('Check-in'), '2026-11-10');
      valor(campo('Check-out'), '2026-11-12');
    });
    const crear = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Crear reserva')!;
    await act(async () => crear.click());
    expect(crear.textContent).toBe('Creando…');
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => escape());
    const fondo = container.firstElementChild as HTMLElement;
    await act(async () => fondo.click());
    await act(async () => (container.querySelector('button[aria-label="Cerrar"]') as HTMLButtonElement).click());
    const cancelar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Cancelar')!;
    expect(cancelar.disabled).toBe(true);
    await act(async () => cancelar.click());
    expect(onClose).not.toHaveBeenCalled();
    confirmar.mockRestore();
  });
});

describe('Nueva reserva: moneda por defecto', () => {
  it('CFF (pms_ficha_pesca) parte en USD', async () => {
    auth.features = { pms_ficha_pesca: true, pms_utilidad: true };
    await render();
    expect(campo('Moneda').value).toBe('USD');
  });

  it('Alto Castillo (sin ficha de pesca) sigue en CLP', async () => {
    auth.features = {};
    await render();
    expect(campo('Moneda').value).toBe('CLP');
  });
});

describe('Nueva reserva: revisión del 17-oct', () => {
  const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  async function montar(onClose: () => void = () => {}) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<NewBookingModal reservas={reservas} roomViews={false} onClose={onClose} onCreado={() => {}} />));
  }

  it('al fallar, el error es role=alert y recibe el foco', async () => {
    auth.features = {};
    api.crearReserva.mockRejectedValue(new Error('Las fechas chocan con otra reserva.'));
    await montar();
    await act(async () => {
      valor(campo('Programa'), 'Suite 1');
      valor(campo('Check-in'), '2026-11-10');
      valor(campo('Check-out'), '2026-11-12');
    });
    const crear = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Crear reserva')!;
    expect(crear.disabled).toBe(false);
    await act(async () => crear.click());
    const alerta = container.querySelector('[role="alert"]');
    expect(alerta?.textContent).toBe('Las fechas chocan con otra reserva.');
    expect(document.activeElement).toBe(alerta);
  });

  it.each([
    ['Moneda', 'USD'],
    ['Personas', '3'],
    ['Estado de pago', 'PAID'],
  ])('Escape pregunta si cambió %s', async (etiqueta, nuevo) => {
    auth.features = {};
    const onClose = vi.fn();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await montar(onClose);
    await act(async () => valor(campo(etiqueta), nuevo));
    await act(async () => escape());
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    confirmar.mockRestore();
  });

  it('si las funciones del cliente llegan después, la moneda pasa a USD; si ya la eligió, no', async () => {
    auth.features = {};
    await montar();
    expect(campo('Moneda').value).toBe('CLP');
    auth.features = { pms_ficha_pesca: true };
    await act(async () => root.render(<NewBookingModal reservas={reservas} roomViews={false} onClose={() => {}} onCreado={() => {}} />));
    expect(campo('Moneda').value).toBe('USD');

    act(() => root.unmount());
    container.remove();
    auth.features = {};
    await montar();
    await act(async () => valor(campo('Moneda'), 'CLP'));
    auth.features = { pms_ficha_pesca: true };
    await act(async () => root.render(<NewBookingModal reservas={reservas} roomViews={false} onClose={() => {}} onCreado={() => {}} />));
    expect(campo('Moneda').value).toBe('CLP');
  });
});
