import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ReservationCalendar } from './ReservationCalendar';
import type { ReservaResumenItem } from '../types';

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // jsdom no trae matchMedia; AsyncState lo consulta al montar.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const reserva = (BookingID: string, RoomID: string, GuestName: string, GuestOriginCountry?: string) =>
  ({ BookingID, GuestID: `G-${BookingID}`, Status: 'CONFIRMED', CheckIn: '2026-11-10', CheckOut: '2026-11-12', RoomID, GuestName, GuestOriginCountry, Companions: [] }) as unknown as ReservaResumenItem;

async function render(reservas: ReservaResumenItem[]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<ReservationCalendar reservas={reservas} loading={false} error={null} onRetry={() => {}} focusMonth="2026-11" onDayClick={() => {}} />));
}

describe('Calendario de reservas (revisión del 17-oct)', () => {
  it('CFF: las filas dicen el programa como la ficha, no el código', async () => {
    await render([reserva('b1', 'FULL_DAY', 'Pescador USA', 'United States'), reserva('b2', 'ALL_INCLUSIVE', 'Pescador Brasil', 'Brazil')]);
    const texto = container.textContent ?? '';
    // Badge de color con el nombre dentro y bandera del país real (17-oct).
    expect(texto).toContain('🇺🇸(United States)Pescador USA Full Day');
    expect(texto).toContain('🇧🇷(Brazil)Pescador Brasil All Inclusive');
    expect(container.querySelector('.badge-programa--fd')?.textContent).toBe('Full Day');
    expect(container.querySelector('.badge-programa--ai')?.textContent).toBe('All Inclusive');
    for (const b of container.querySelectorAll('.bandera--pescador > span:first-child')) expect(b.getAttribute('aria-hidden')).toBe('true');
    expect(texto).not.toMatch(/FULL_DAY|ALL_INCLUSIVE/);
    const titulo = Array.from(container.querySelectorAll('[title]')).map((e) => e.getAttribute('title')).join('\n');
    expect(titulo).not.toMatch(/FULL_DAY|ALL_INCLUSIVE/);
  });

  it('Alto Castillo: el RoomID queda igual', async () => {
    await render([reserva('b3', 'Suite 1', 'Huésped AC')]);
    expect(container.textContent).toContain('Huésped AC · Suite 1');
    expect(container.querySelector('.badge-programa')).toBeNull();
    expect(container.querySelector('.bandera')).toBeNull();
  });

  it('leyenda, mes y días de la semana sin --text-faint (WCAG 2.2 1.4.3)', async () => {
    await render([]);
    expect(container.innerHTML).not.toContain('text-faint');
    expect(container.textContent).toContain('Disponible');
  });
});
