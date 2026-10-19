import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hoyLocalISO, sumarDias } from '../lib/fichaPescador';
import type { ReservaResumenItem } from '../types';

// Qué afirma (5.0.0): en CFF (sin habitaciones) el Overview ya no dibuja el
// calendario ni «Reservas nuevas esta semana» / «Sincronización de reservas»,
// y empieza por «Llegan en los próximos 30 días»; un cliente con habitaciones
// sigue viendo el calendario igual que antes.

const { api, auth } = vi.hoisted(() => ({
  api: { getSemaforo: vi.fn(), getReservasResumen: vi.fn() },
  auth: { value: {} as Record<string, unknown> },
}));

vi.mock('../api/dashboardApi', () => ({
  getSemaforo: () => api.getSemaforo(),
  getReservasResumen: () => api.getReservasResumen(),
  getHuespedes: () => Promise.resolve({ huespedes: [] }),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ConflictError: class ConflictError extends Error {},
  ErrorTransitorio: class ErrorTransitorio extends Error {},
  TimeoutError: class TimeoutError extends Error {},
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));
vi.mock('../components/ReservationCalendar', () => ({ ReservationCalendar: () => <div data-testid="calendario" /> }));
vi.mock('../components/RoomGrid', () => ({ RoomGrid: () => <div data-testid="grilla" /> }));
vi.mock('../components/WeatherWidget', () => ({ WeatherWidget: () => null }));

import { Overview } from './Overview';

const semaforo = {
  semaforo: {
    llegadas_48h: { estado: 'verde', valor: { cantidad: 1, con_banderas: 0 } },
    formulario_reservas_7d: { cantidad: 2 },
    ocupacion_30d: { estado: 'verde', valor: 50, umbral_usado: null },
    reservas_nuevas_7d: { estado: 'verde', valor: { cantidad: 3, monto_por_moneda: {} } },
    estado_sincronizacion: { estado: 'sin_datos' },
  },
};

function reserva(BookingID: string, Status: string, dias: number, GuestName: string): ReservaResumenItem {
  const CheckIn = sumarDias(hoyLocalISO(), dias);
  return {
    BookingID, GuestID: `g_${BookingID}`, Status, CheckIn, CheckOut: sumarDias(CheckIn, 5), RoomID: 'ALL_INCLUSIVE', Source: 'Directa Web',
    GuestName, TotalAmount: 6500, Currency: 'USD', PaymentStatus: Status === 'CONFIRMED' ? 'PAID' : 'PENDING', Companions: [],
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
        <Overview onDetail={vi.fn()} isDesktop onNavigate={vi.fn()} />
      </StrictMode>,
    );
  });
}

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  api.getSemaforo.mockResolvedValue(semaforo);
  api.getReservasResumen.mockResolvedValue({
    reservas: [reserva('b1', 'CONFIRMED', 3, 'Ana Pescadora'), reserva('b2', 'PENDING', 4, 'Carla Pendiente'), reserva('b3', 'CONFIRMED', 60, 'Luis Lejano')],
    kpis: { arrivals_next_30_days: 1, bookings_this_month: 4, bookings_this_month_pending: 1, month: '2026-10' },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Overview', () => {
  it('CFF: sin calendario, con llegadas de 30 días primero y la tarjeta del mes desde kpis', async () => {
    auth.value = { handleUnauthorized: vi.fn(), clientId: 'chile-fly-fishing', clientDisplayName: 'Chile Fly Fishing', pmsRoomViews: false, clientTerminologia: null, features: { pms_ficha_pesca: true } };
    await render();
    expect(container.querySelector('[data-testid="calendario"]')).toBeNull();
    expect(container.textContent).not.toContain('Reservas nuevas esta semana');
    expect(container.textContent).not.toContain('Sincronización de reservas');
    expect(container.textContent).toContain('Llegan en los próximos 30 días');
    const filas = Array.from(container.querySelectorAll('button[data-fila]')).map((b) => b.textContent);
    expect(filas).toEqual([expect.stringContaining('Ana Pescadora')]);
    expect(container.textContent).toContain('Además, 1 reserva sin pagar llega en este plazo.');
    expect(container.textContent).toContain('Reservas de octubre4llegadas confirmadas · 1 sin pagar');
  });

  it('CFF: la llegada muestra el país del pescador con su nombre, no solo la bandera', async () => {
    auth.value = { handleUnauthorized: vi.fn(), clientId: 'chile-fly-fishing', clientDisplayName: 'Chile Fly Fishing', pmsRoomViews: false, clientTerminologia: null, features: { pms_ficha_pesca: true } };
    api.getReservasResumen.mockResolvedValue({
      reservas: [{ ...reserva('b1', 'CONFIRMED', 3, 'Ana Pescadora'), GuestOriginCountry: 'United States' }],
      kpis: { arrivals_next_30_days: 1, bookings_this_month: 1, bookings_this_month_pending: 0, month: '2026-10' },
    });
    await render();
    const pais = container.querySelector('button[data-fila="b1"] [data-pais] .pais-pescador') as HTMLElement;
    expect(pais.textContent).toBe('🇺🇸United States');
    expect(pais.querySelector('[aria-hidden="true"]')?.textContent).toBe('🇺🇸');
  });

  it('CFF: «1 persona» en singular aunque el backend mande PartyMembers como texto (QA 18-oct)', async () => {
    auth.value = { handleUnauthorized: vi.fn(), clientId: 'chile-fly-fishing', clientDisplayName: 'Chile Fly Fishing', pmsRoomViews: false, clientTerminologia: null, features: { pms_ficha_pesca: true } };
    // El backend real serializa el Decimal de DynamoDB con default=str: llega «"1"».
    api.getReservasResumen.mockResolvedValue({
      reservas: [
        { ...reserva('b1', 'CONFIRMED', 3, 'Ana Pescadora'), PartyMembers: '1' as unknown as number },
        { ...reserva('b2', 'CONFIRMED', 4, 'Bruno Pescador'), PartyMembers: 3 },
        { ...reserva('b3', 'CONFIRMED', 5, 'Carla Pescadora'), PartyMembers: '' as unknown as number },
      ],
      kpis: { arrivals_next_30_days: 3, bookings_this_month: 3, bookings_this_month_pending: 0, month: '2026-10' },
    });
    await render();
    const fila = (id: string) => container.querySelector(`button[data-fila="${id}"]`)!.textContent!;
    expect(fila('b1')).toContain('1 persona');
    expect(fila('b1')).not.toContain('1 personas');
    expect(fila('b2')).toContain('3 personas');
    expect(fila('b3')).not.toMatch(/persona|NaN/);
  });

  it('CFF: la fila abre la ficha del pescador en la misma pantalla', async () => {
    auth.value = { handleUnauthorized: vi.fn(), clientId: 'chile-fly-fishing', clientDisplayName: 'Chile Fly Fishing', pmsRoomViews: false, clientTerminologia: null, features: { pms_ficha_pesca: true } };
    await render();
    await act(async () => (container.querySelector('button[data-fila="b1"]') as HTMLButtonElement).click());
    expect(container.querySelector('h1')?.textContent).toBe('Ana Pescadora');
    expect(container.textContent).toContain('← Overview');
  });

  it('cliente con habitaciones: el calendario y las tarjetas de siempre siguen', async () => {
    auth.value = { handleUnauthorized: vi.fn(), clientId: 'alto-castillo', clientDisplayName: 'Alto Castillo', pmsRoomViews: true, clientTerminologia: null, features: { pms_ficha_pesca: true } };
    await render();
    expect(container.querySelector('[data-testid="calendario"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="grilla"]')).not.toBeNull();
    expect(container.textContent).toContain('Reservas nuevas esta semana');
    expect(container.textContent).toContain('Sincronización de reservas');
    expect(container.textContent).not.toContain('Llegan en los próximos 30 días');
  });

  it('sin habitaciones y sin la bandera pms_ficha_pesca: el Overview de antes', async () => {
    auth.value = { handleUnauthorized: vi.fn(), clientId: 'otro-cliente', clientDisplayName: 'Otro', pmsRoomViews: false, clientTerminologia: null, features: {} };
    await render();
    expect(container.querySelector('[data-testid="calendario"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="grilla"]')).toBeNull();
    expect(container.textContent).toContain('Reservas nuevas esta semana');
    expect(container.textContent).toContain('Sincronización de reservas');
    expect(container.textContent).not.toContain('Llegan en los próximos 30 días');
    expect(container.querySelector('button[data-fila]')).toBeNull();
  });
});
