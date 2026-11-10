import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReservaResumenItem } from '../../types';
import type { FichaPescadorProps } from './FichaPescador';

// Qué afirma (10-nov, «Borrar definitivamente»): cuando la ficha avisa que la
// reserva se borró, el Calendario de Reservas cierra la ficha, la saca de su
// lista SIN volver a pedirla al servidor y muestra un aviso breve.

const { auth, api } = vi.hoisted(() => ({
  auth: { handleUnauthorized: () => {}, clientDisplayName: 'Chile Fly Fishing', clientId: 'chile-fly-fishing', pmsRoomViews: false, clientTerminologia: null, features: { pms_ficha_pesca: true } },
  api: { getReservasResumen: vi.fn() },
}));
const reservas = [
  { BookingID: 'B1', GuestID: 'G1', GuestName: 'Carlos Rojas', Status: 'CANCELLED', CheckIn: '2026-11-10', CheckOut: '2026-11-12', RoomID: 'FULL_DAY', Source: 'Directa', TotalAmount: 690, Currency: 'USD', PaymentStatus: 'PENDING', Companions: [] },
  { BookingID: 'B2', GuestID: 'G2', GuestName: 'Ana Soto', Status: 'CONFIRMED', CheckIn: '2026-11-20', CheckOut: '2026-11-22', RoomID: 'FULL_DAY', Source: 'Directa', TotalAmount: 690, Currency: 'USD', PaymentStatus: 'PAID', Companions: [] },
] as ReservaResumenItem[];
vi.mock('../../api/dashboardApi', () => ({
  getReservasResumen: () => api.getReservasResumen(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth, usePermiso: () => true }));
// La ficha real se prueba en FichaPescador.test.tsx: aquí solo importa qué
// hace la lista con onBorrada.
vi.mock('./FichaPescador', () => ({
  FichaPescador: (p: FichaPescadorProps) => (
    <button type="button" onClick={() => p.onBorrada?.(p.bookingId, 'Borraste definitivamente la reserva Full Day del 10 nov al 12 nov.')}>
      simular borrado
    </button>
  ),
}));

import { ReservasResumen } from './ReservasResumen';

let container: HTMLDivElement;
let root: Root;

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
});

describe('Calendario de Reservas: después de borrar definitivamente', () => {
  it('cierra la ficha, saca la reserva de la lista sin recargar y muestra el aviso', async () => {
    api.getReservasResumen.mockReset().mockResolvedValue({ client_id: 'chile-fly-fishing', reservas });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<ReservasResumen isDesktop />));
    await act(async () => {});
    expect(api.getReservasResumen).toHaveBeenCalledTimes(1);

    await act(async () => (container.querySelector('[data-fila="B1"]') as HTMLElement).click());
    const simular = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'simular borrado')!;
    await act(async () => simular.click());

    expect(container.textContent).not.toContain('simular borrado');
    expect(container.querySelector('[data-fila="B1"]')).toBeNull();
    expect(container.querySelector('[data-fila="B2"]')).not.toBeNull();
    // La fila que abrió la ficha ya no existe: el foco va al título de la lista.
    expect(document.activeElement?.tagName).toBe('H1');
    expect(document.activeElement?.hasAttribute('data-titulo-lista')).toBe(true);
    expect(container.querySelector('[role="status"].aviso-flotante')?.textContent).toContain('Borraste definitivamente la reserva Full Day');
    expect(api.getReservasResumen).toHaveBeenCalledTimes(1);
  });
});
