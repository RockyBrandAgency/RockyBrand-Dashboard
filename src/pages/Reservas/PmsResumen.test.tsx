import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { hoyLocalISO, sumarDias } from '../../lib/fichaPescador';
import type { ReservaResumenItem } from '../../types';

// Qué afirma (QA 18-oct): en «Reservas activas» y en «Llegan / Se van esta
// semana» el nombre va en su línea (con «…» si no cabe) y el país y el
// programa o la habitación van en la línea siguiente, que puede bajar de línea.
// Antes iban juntos en un span con nowrap y overflow:hidden, y a 320 y 360 px
// el país escondía el badge y en AC dejaba «· Hab 101» fuera de la pantalla.

const { auth, datos } = vi.hoisted(() => ({
  auth: { value: {} as Record<string, unknown> },
  datos: { reservas: [] as ReservaResumenItem[] },
}));
vi.mock('../../api/dashboardApi', () => ({
  getReservasResumen: () => Promise.resolve({ reservas: datos.reservas }),
  getHuespedes: () => Promise.resolve({ huespedes: [] }),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

import { PmsResumen } from './PmsResumen';

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

function reserva(BookingID: string, RoomID: string, GuestOriginCountry: string | null): ReservaResumenItem {
  const CheckIn = hoyLocalISO();
  return {
    BookingID, GuestID: `g_${BookingID}`, Status: 'CONFIRMED', CheckIn, CheckOut: sumarDias(CheckIn, 2), RoomID, Source: 'Directa',
    GuestName: 'Christopher Montgomery-Wellington Fitzgerald', GuestOriginCountry, TotalAmount: 690, Currency: 'USD', PaymentStatus: 'PAID', Companions: [],
  } as ReservaResumenItem;
}

async function render(clientId: string, pmsRoomViews: boolean, reservas: ReservaResumenItem[]) {
  auth.value = { handleUnauthorized: () => {}, clientId, clientDisplayName: clientId, pmsRoomViews, clientTerminologia: null, features: {} };
  datos.reservas = reservas;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<PmsResumen isDesktop={false} />));
  await act(async () => {});
  // Abre «Reservas activas» para tener también DetalleActivas.
  const ver = container.querySelector('button[aria-controls="panel-reservas-activas"]') as HTMLButtonElement;
  await act(async () => ver.click());
}

const celdas = () => Array.from(container.querySelectorAll<HTMLElement>('[data-celda-pescador]'));

describe('PmsResumen: pescador, país y programa', () => {
  it('CFF: país visible y badge de programa en su propia línea, en las dos listas', async () => {
    await render('chile-fly-fishing', false, [reserva('b1', 'FULL_DAY', 'Brazil')]);
    const cs = celdas();
    // «Reservas activas» y «Llegan esta semana» (la salida puede caer la semana siguiente).
    expect(cs.length).toBeGreaterThanOrEqual(2);
    for (const c of cs) {
      const nombre = c.firstElementChild as HTMLElement;
      expect(nombre.textContent).toBe('Christopher Montgomery-Wellington Fitzgerald');
      expect(nombre.style.textOverflow).toBe('ellipsis');
      expect(nombre.getAttribute('title')).toBe('Christopher Montgomery-Wellington Fitzgerald');
      const linea = c.querySelector('[data-pais-programa]') as HTMLElement;
      expect(linea.style.flexWrap).toBe('wrap');
      expect(linea.style.overflow).toBe('');
      expect(linea.querySelector('.pais-pescador')?.textContent).toBe('🇧🇷Brazil');
      expect(linea.querySelector('.badge-programa--fd')?.textContent).toBe('Full Day');
    }
  });

  it('AC: la habitación se ve junto al país; sin país, solo la habitación y sin separador', async () => {
    await render('alto-castillo', true, [reserva('b1', 'Hab 101', 'Canadá'), reserva('b2', 'Hab 105', null)]);
    const lineas = Array.from(container.querySelectorAll<HTMLElement>('[data-pais-programa]'));
    expect(lineas.map((l) => l.textContent)).toContain('🇨🇦Canadá·Hab 101');
    expect(lineas.map((l) => l.textContent)).toContain('Hab 105');
  });
});

// QA 18-oct: PartyMembers llega como texto y «n + "1"» concatenaba («01 personas»).
describe('PmsResumen: personas de la semana con PartyMembers en texto', () => {
  it('suma como número: «1» + «2» = 3 personas, y la fila dice «1 p.»', async () => {
    const a = { ...reserva('b1', 'FULL_DAY', 'Brazil'), PartyMembers: '1' as unknown as number };
    const b = { ...reserva('b2', 'FULL_DAY', null), PartyMembers: '2' as unknown as number };
    await render('chile-fly-fishing', false, [a, b]);
    const tarjeta = Array.from(container.querySelectorAll('.crm-mini-card')).find((c) => c.textContent?.startsWith('Llegan esta semana'))!;
    expect(tarjeta.querySelector('.crm-mini-sub')?.textContent).toBe('3 personas');
    expect(container.querySelector('#panel-reservas-activas')!.textContent).toContain('1 p.');
    expect(container.textContent).not.toMatch(/\b01 personas|12 personas/);
  });
});
