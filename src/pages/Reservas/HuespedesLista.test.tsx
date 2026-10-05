import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HuespedItem, ReservaResumenItem } from '../../types';

// Qué afirma este archivo: el camino que pidió Mato (Lodge → Pescadores → tocar
// a un pescador confirmado) termina en la sección de acompañantes de ESE viaje,
// y una reserva cancelada no ofrece agregar a nadie.

const { api, handleUnauthorized } = vi.hoisted(() => ({
  api: { getHuespedes: vi.fn(), getReservasResumen: vi.fn(), guardarAcompanantes: vi.fn() },
  handleUnauthorized: vi.fn(),
}));

vi.mock('../../api/dashboardApi', () => ({
  getHuespedes: () => api.getHuespedes(),
  getReservasResumen: () => api.getReservasResumen(),
  guardarAcompanantes: (...args: unknown[]) => api.guardarAcompanantes(...args),
  actualizarHuesped: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ handleUnauthorized, clientId: 'chile-fly-fishing', clientDisplayName: 'Chile Fly Fishing', clientTerminologia: null }),
}));

import { HuespedesLista } from './HuespedesLista';

function huesped(GuestID: string, FullName: string): HuespedItem {
  return {
    GuestID, FullName, Contact: { Email: `${GuestID}@example.com` }, OriginCountry: 'Estados Unidos',
    VIP_Tags: [], DietaryRestrictions: [], MobilityNotes: '', SpecialNotes: '', TotalLTV: 0,
  } as HuespedItem;
}

function reserva(BookingID: string, GuestID: string, Status: string, CheckIn: string): ReservaResumenItem {
  return {
    BookingID, GuestID, Status, CheckIn, CheckOut: CheckIn, RoomID: 'ALL_INCLUSIVE', Source: 'Directa Web',
    GuestName: '', TotalAmount: 6500, Currency: 'USD', PaymentStatus: 'PAID', Companions: [],
  };
}

let container: HTMLDivElement;
let root: Root;

async function render() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <StrictMode>
        <HuespedesLista isDesktop />
      </StrictMode>,
    );
  });
}

async function abrirFicha(nombre: string) {
  const fila = Array.from(container.querySelectorAll<HTMLDivElement>('div[style*="cursor: pointer"]')).find((d) =>
    d.textContent?.includes(nombre),
  );
  await act(async () => {
    fila!.click();
  });
}

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // jsdom no trae matchMedia; AsyncState lo consulta al montar (mismo arreglo que App.test.tsx).
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  api.getHuespedes.mockResolvedValue({ huespedes: [huesped('gst_1', 'Ana Pescadora'), huesped('gst_2', 'Beto Cancelado')] });
  api.getReservasResumen.mockResolvedValue({
    reservas: [reserva('bkg_1', 'gst_1', 'CONFIRMED', '2026-10-31'), reserva('bkg_2', 'gst_2', 'CANCELLED', '2026-11-08')],
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Pescadores → ficha del pescador', () => {
  it('un pescador confirmado muestra los acompañantes de su viaje y deja agregar', async () => {
    await render();
    await abrirFicha('Ana Pescadora');
    expect(container.textContent).toContain('Acompañantes · viaje del 31 oct 2026');
    const agregar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Agregar acompañante'));
    expect(agregar).toBeDefined();
  });

  it('una reserva cancelada no ofrece acompañantes', async () => {
    await render();
    await abrirFicha('Beto Cancelado');
    expect(container.textContent).not.toContain('Acompañantes · viaje');
  });
});
