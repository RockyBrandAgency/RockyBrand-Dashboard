import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReservaResumenItem } from '../../types';

// Qué afirma (QA 17-oct): la tabla de reservas solo se usa si cabe su ancho de
// columnas fijas; si no, filas apiladas. A 768 px no cabía y la página
// desbordaba 286 px.

const { auth } = vi.hoisted(() => ({
  // Objeto estable: un handleUnauthorized nuevo en cada render reharía la carga sin fin.
  auth: { handleUnauthorized: () => {}, clientDisplayName: 'Alto Castillo', clientId: 'alto-castillo', pmsRoomViews: false, clientTerminologia: null, features: {} },
}));
const reservas = [
  { BookingID: 'B1', GuestID: 'G1', GuestName: 'Carlos Rojas', Status: 'CONFIRMED', CheckIn: '2026-11-10', CheckOut: '2026-11-12', RoomID: 'Programa 2 días', Source: 'Directa', TotalAmount: 100000, Currency: 'CLP', PaymentStatus: 'PAID', Companions: [] },
] as ReservaResumenItem[];
vi.mock('../../api/dashboardApi', () => ({
  getReservasResumen: () => Promise.resolve({ client_id: 'alto-castillo', reservas }),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

import { fmtDate, nights, ReservasResumen } from './ReservasResumen';

let container: HTMLDivElement;
let root: Root;
const original = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!;

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Object.defineProperty(Element.prototype, 'clientWidth', original);
});

async function renderConAncho(ancho: number) {
  // jsdom no tiene maqueta: el ancho del contenedor se simula.
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => ancho });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<ReservasResumen isDesktop />));
  await act(async () => {});
}

describe('Calendario de Reservas: tabla solo si cabe', () => {
  it('con ancho bajo la tabla (624 px, como a 768 de ventana): filas apiladas', async () => {
    await renderConAncho(624);
    expect(container.textContent).not.toContain('N° vuelo');
    const fila = container.querySelector('[data-fila="B1"]') as HTMLElement;
    expect(fila.style.flexDirection).toBe('column');
  });

  it('con ancho de sobra (1200 px): tabla con su encabezado', async () => {
    await renderConAncho(1200);
    expect(container.textContent).toContain('N° vuelo');
    const fila = container.querySelector('[data-fila="B1"]') as HTMLElement;
    expect(fila.style.flexDirection).toBe('row');
  });
});

// QA 17-oct: una reserva de Alto Castillo sin CheckOut pintaba «Invalid Date»
// y React avisaba «Received NaN for the children».
describe('Reservas: fechas vacías o inválidas', () => {
  it('fmtDate y nights devuelven «—» y null, nunca Invalid Date ni NaN', () => {
    expect(fmtDate('')).toBe('—');
    expect(fmtDate('2026-13-45')).toBe('—');
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate('2026-11-10')).not.toBe('—');
    expect(nights('2026-11-10', '')).toBeNull();
    expect(nights('', '2026-11-12')).toBeNull();
    expect(nights('2026-11-10', '2026-11-12')).toBe(2);
  });

  it.each([1200, 624])('una fila con CheckOut vacío muestra «—» (ancho %i)', async (ancho) => {
    const err = vi.mocked(console.error);
    err.mockClear();
    reservas.push({ ...reservas[0], BookingID: 'B2', GuestName: 'Sin Salida', CheckOut: '' });
    try {
      await renderConAncho(ancho);
      const fila = container.querySelector('[data-fila="B2"]') as HTMLElement;
      expect(fila.textContent).toContain('—');
      expect(container.textContent).not.toMatch(/Invalid Date|NaN/);
      expect(err.mock.calls.flat().join(' ')).not.toMatch(/NaN/);
    } finally {
      reservas.pop();
    }
  });

  it('un nombre largo se corta con «…» y queda completo en el title', async () => {
    await renderConAncho(1200);
    const nombre = container.querySelector('[data-fila="B1"] span[title="Carlos Rojas"]') as HTMLElement;
    expect(nombre.style.textOverflow).toBe('ellipsis');
    expect(nombre.textContent).toBe('Carlos Rojas');
  });
});

// Decisión del jefe (spec-ventas-mix.md, 17-oct): junto al pescador va la
// bandera más el nombre del país visible, no la bandera sola.
describe('Reservas: país del pescador visible', () => {
  it.each([1200, 624])('bandera oculta a lectores y nombre del país a la vista (ancho %i)', async (ancho) => {
    reservas.push({ ...reservas[0], BookingID: 'B3', GuestName: 'Ana Souza', GuestOriginCountry: 'Brazil' });
    try {
      await renderConAncho(ancho);
      const pais = container.querySelector('[data-fila="B3"] [data-pais] .pais-pescador') as HTMLElement;
      expect(pais.textContent).toBe('🇧🇷Brazil');
      expect(pais.querySelector('[aria-hidden="true"]')?.textContent).toBe('🇧🇷');
      expect(container.querySelector('[data-fila="B1"] [data-pais]')).toBeNull();
    } finally {
      reservas.pop();
    }
  });
});
