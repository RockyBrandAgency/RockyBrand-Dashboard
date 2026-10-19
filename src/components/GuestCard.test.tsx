import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { LlegadaGuest } from '../types';
import { GuestCard } from './GuestCard';

// Qué afirma (18-oct): la tarjeta de llegadas usa la misma fuente de banderas
// que el resto del panel (lib/banderas), con la bandera oculta a lectores de
// pantalla y el país escrito a la vista; nunca adivina una bandera.

let container: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(OriginCountry: string | null) {
  const guest = {
    BookingID: 'B1', CheckIn: '2026-11-10', GuestID: 'G1', FullName: 'Ana Souza', OriginCountry,
    ArrivalInfo: { time: null, transferType: null, notes: '' },
    BookingNotes: '', DietaryRestrictions: [], MobilityNotes: '', SpecialNotes: '', Source: 'Directa',
  } as unknown as LlegadaGuest;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<GuestCard guest={guest} isDesktop={false} />));
}

const banderas = () => Array.from(container.querySelectorAll('[aria-hidden="true"]')).map((e) => e.textContent).filter((t) => /\p{RI}/u.test(t ?? ''));

describe('GuestCard: país del pescador', () => {
  it('país conocido: bandera oculta a lectores y el nombre del país a la vista', () => {
    render('Brazil');
    expect(banderas()).toEqual(['🇧🇷']);
    expect(container.textContent).toContain('Brazil');
  });

  it('país fuera de la lista: solo el nombre, sin bandera ni globo', () => {
    render('Atlantis');
    expect(banderas()).toEqual([]);
    expect(container.textContent).toContain('Atlantis');
    expect(container.textContent).not.toContain('🌍');
  });

  it('sin país: «País no informado» y sin bandera', () => {
    render(null);
    expect(banderas()).toEqual([]);
    expect(container.textContent).toContain('País no informado');
  });
});
