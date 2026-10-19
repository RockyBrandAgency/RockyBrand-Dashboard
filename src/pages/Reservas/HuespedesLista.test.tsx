import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hoyLocalISO, sumarDias } from '../../lib/fichaPescador';
import type { HuespedItem, ReservaResumenItem } from '../../types';

// Qué afirma este archivo (5.0.0): en CFF, Pescadores lista solo a quien tiene
// una reserva confirmada; la fila es un botón que abre la ficha del pescador
// como página, con los acompañantes de ese viaje; al volver, el foco queda en
// la fila que se abrió.

const { api, handleUnauthorized } = vi.hoisted(() => ({
  api: { getHuespedes: vi.fn(), getReservasResumen: vi.fn(), guardarAcompanantes: vi.fn() },
  handleUnauthorized: vi.fn(),
}));

vi.mock('../../api/dashboardApi', () => ({
  getHuespedes: () => api.getHuespedes(),
  getReservasResumen: () => api.getReservasResumen(),
  guardarAcompanantes: (...args: unknown[]) => api.guardarAcompanantes(...args),
  actualizarHuesped: vi.fn(),
  actualizarReserva: vi.fn(),
  cancelarReserva: vi.fn(),
  confirmarReserva: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ConflictError: class ConflictError extends Error {},
  ErrorTransitorio: class ErrorTransitorio extends Error {},
  TimeoutError: class TimeoutError extends Error {},
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ handleUnauthorized, clientId: 'chile-fly-fishing', clientDisplayName: 'Chile Fly Fishing', clientTerminologia: null, features: { pms_ficha_pesca: true } }),
}));

import { HuespedesLista } from './HuespedesLista';

function huesped(GuestID: string, FullName: string): HuespedItem {
  return {
    GuestID, FullName, Contact: { Email: `${GuestID}@example.com` }, OriginCountry: 'Estados Unidos',
    VIP_Tags: [], DietaryRestrictions: [], MobilityNotes: '', SpecialNotes: '', TotalLTV: 0,
  } as HuespedItem;
}

function reserva(BookingID: string, GuestID: string, Status: string, CheckIn: string, GuestName: string): ReservaResumenItem {
  return {
    BookingID, GuestID, Status, CheckIn, CheckOut: sumarDias(CheckIn, 5), RoomID: 'ALL_INCLUSIVE', Source: 'Directa Web',
    GuestName, TotalAmount: 6500, Currency: 'USD', PaymentStatus: 'PAID', Companions: [],
  };
}

let container: HTMLDivElement;
let root: Root;
const llegada = sumarDias(hoyLocalISO(), 15);

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

const filas = () => Array.from(container.querySelectorAll<HTMLButtonElement>('button[data-fila]'));
const boton = (texto: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(texto));

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  api.getHuespedes.mockResolvedValue({
    huespedes: [huesped('gst_1', 'Ana Pescadora'), huesped('gst_2', 'Beto Cancelado'), huesped('gst_3', 'Carla Pendiente')],
  });
  api.getReservasResumen.mockResolvedValue({
    reservas: [
      reserva('bkg_1', 'gst_1', 'CONFIRMED', llegada, 'Ana Pescadora'),
      reserva('bkg_2', 'gst_2', 'CANCELLED', llegada, 'Beto Cancelado'),
      reserva('bkg_3', 'gst_3', 'PENDING', llegada, 'Carla Pendiente'),
    ],
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Pescadores (CFF)', () => {
  it('lista solo a quien tiene una reserva confirmada, con filas que son botones', async () => {
    await render();
    expect(filas().map((f) => f.textContent)).toEqual([expect.stringContaining('Ana Pescadora')]);
    expect(container.textContent).not.toContain('Beto Cancelado');
    expect(container.textContent).not.toContain('Carla Pendiente');
  });

  it('la fila abre la ficha con los acompañantes del viaje, y volver deja el foco en la fila', async () => {
    await render();
    await act(async () => filas()[0].click());
    expect(container.querySelector('h1')?.textContent).toBe('Ana Pescadora');
    expect(Array.from(container.querySelectorAll('h2')).map((h) => h.textContent)).toContain('Acompañantes');
    expect(boton('Agregar acompañante')).toBeDefined();

    await act(async () => boton('← Pescadores')!.click());
    expect(document.activeElement).toBe(filas()[0]);
  });

  it('sin confirmados muestra el estado vacío y no lista pendientes', async () => {
    api.getHuespedes.mockResolvedValue({ huespedes: [huesped('gst_3', 'Carla Pendiente')] });
    await render();
    expect(container.textContent).toContain('Todavía no hay pescadores con reserva confirmada.');
    expect(filas()).toHaveLength(0);
  });
});
