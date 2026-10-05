import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Acompanante } from '../types';

// Qué afirma este archivo: que la sección de acompañantes manda al servidor
// exactamente lo que se cargó, muestra lo que el servidor devolvió (no lo que
// se tipeó), y no finge haber guardado cuando la Lambda desplegada todavía no
// conoce el campo.

const { guardar, handleUnauthorized } = vi.hoisted(() => ({ guardar: vi.fn(), handleUnauthorized: vi.fn() }));

vi.mock('../api/dashboardApi', () => ({
  guardarAcompanantes: (...args: unknown[]) => guardar(...args),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ handleUnauthorized }) }));

import { AcompanantesReserva } from './AcompanantesReserva';

const MARY: Acompanante = {
  CompanionID: 'cmp_0123456789ab',
  FirstName: 'Mary',
  LastName: 'Smith',
  BirthDate: '1980-03-12',
  FoodAllergy: true,
  FoodAllergyDetail: 'Mariscos',
  Notes: 'No pesca',
};
const JOHN: Acompanante = { ...MARY, CompanionID: 'cmp_ba9876543210', FirstName: 'John', FoodAllergy: false, FoodAllergyDetail: '', Notes: '' };

let container: HTMLDivElement;
let root: Root;
let onCambio: Mock<() => void>;
let onEditando: Mock<(editando: boolean) => void>;

function render(inicial: Acompanante[] = [], editable = true) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <StrictMode>
        <AcompanantesReserva bookingId="bkg_abc" inicial={inicial} editable={editable} onCambio={onCambio} onEditando={onEditando} />
      </StrictMode>,
    );
  });
  return container;
}

function boton(texto: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(texto));
}

function campo(etiqueta: string): HTMLInputElement | HTMLTextAreaElement {
  const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim().startsWith(etiqueta));
  return document.getElementById(label!.htmlFor) as HTMLInputElement | HTMLTextAreaElement;
}

function escribir(el: HTMLInputElement | HTMLTextAreaElement, valor: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function radio(texto: 'Sí' | 'No'): HTMLInputElement {
  const label = Array.from(container.querySelectorAll('fieldset label')).find((l) => l.textContent?.trim() === texto);
  return label!.querySelector('input')!;
}

async function clickAsync(b: HTMLElement | undefined) {
  await act(async () => {
    b!.click();
  });
}

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T15:00:00Z'));
});

beforeEach(() => {
  guardar.mockReset();
  onCambio = vi.fn<() => void>();
  onEditando = vi.fn<(editando: boolean) => void>();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('AcompanantesReserva', () => {
  it('sin acompañantes lo dice y ofrece agregar', () => {
    const el = render();
    expect(el.textContent).toContain('Sin acompañantes registrados.');
    expect(boton('Agregar acompañante')).toBeDefined();
  });

  it('agrega uno, manda lo cargado y muestra lo que devolvió el servidor', async () => {
    guardar.mockResolvedValue({ BookingID: 'bkg_abc', message: 'ok', Companions: [MARY] });
    render();
    act(() => boton('Agregar acompañante')!.click());
    expect(onEditando).toHaveBeenLastCalledWith(true);

    escribir(campo('Nombre'), '  Mary ');
    escribir(campo('Apellido'), 'Smith');
    escribir(campo('Fecha de nacimiento'), '1980-03-12');
    act(() => radio('Sí').click());
    escribir(campo('¿A qué tiene alergia?'), 'Mariscos');
    escribir(campo('Notas'), 'No pesca');
    await clickAsync(boton('Guardar acompañante'));

    expect(guardar).toHaveBeenCalledWith('bkg_abc', [
      { FirstName: 'Mary', LastName: 'Smith', BirthDate: '1980-03-12', FoodAllergy: true, FoodAllergyDetail: 'Mariscos', Notes: 'No pesca' },
    ]);
    expect(container.textContent).toContain('Mary Smith');
    expect(container.textContent).toContain('Alergia alimentaria: Mariscos');
    expect(container.textContent).toContain('46 años');
    expect(boton('Guardar acompañante')).toBeUndefined();
    expect(onCambio).toHaveBeenCalledTimes(1);
    expect(onEditando).toHaveBeenLastCalledWith(false);
  });

  it('no manda nada si falta el nombre o el detalle de la alergia', async () => {
    render();
    act(() => boton('Agregar acompañante')!.click());
    await clickAsync(boton('Guardar acompañante'));
    expect(container.textContent).toContain('Falta el nombre.');

    escribir(campo('Nombre'), 'Mary');
    act(() => radio('Sí').click());
    await clickAsync(boton('Guardar acompañante'));
    expect(container.textContent).toContain('Indica a qué tiene alergia.');
    expect(guardar).not.toHaveBeenCalled();
  });

  it('si la Lambda no devuelve la lista, avisa y no muestra un guardado falso', async () => {
    guardar.mockResolvedValue({ BookingID: 'bkg_abc', message: 'Reserva actualizada.' });
    render();
    act(() => boton('Agregar acompañante')!.click());
    escribir(campo('Nombre'), 'Mary');
    await clickAsync(boton('Guardar acompañante'));

    expect(container.textContent).toContain('El servidor todavía no guarda acompañantes');
    expect(boton('Guardar acompañante')).toBeDefined();
    expect(onCambio).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor tal cual', async () => {
    guardar.mockRejectedValue(new Error('Acompañante 1: la fecha de nacimiento no es válida.'));
    render();
    act(() => boton('Agregar acompañante')!.click());
    escribir(campo('Nombre'), 'Mary');
    await clickAsync(boton('Guardar acompañante'));
    expect(container.textContent).toContain('Acompañante 1: la fecha de nacimiento no es válida.');
  });

  it('editar conserva el CompanionID y no toca a los demás', async () => {
    guardar.mockResolvedValue({ BookingID: 'bkg_abc', message: 'ok', Companions: [{ ...MARY, Notes: 'Vegetariana' }, JOHN] });
    render([MARY, JOHN]);
    act(() => boton('Editar')!.click());
    escribir(campo('Notas'), 'Vegetariana');
    await clickAsync(boton('Guardar acompañante'));

    expect(guardar).toHaveBeenCalledWith('bkg_abc', [{ ...MARY, Notes: 'Vegetariana' }, JOHN]);
    expect(container.textContent).toContain('Vegetariana');
  });

  it('quitar pide confirmación y manda la lista sin esa persona', async () => {
    guardar.mockResolvedValue({ BookingID: 'bkg_abc', message: 'ok', Companions: [JOHN] });
    render([MARY, JOHN]);
    await clickAsync(boton('Quitar'));

    expect(window.confirm).toHaveBeenCalled();
    expect(guardar).toHaveBeenCalledWith('bkg_abc', [JOHN]);
    expect(container.textContent).not.toContain('Mary Smith');
  });

  it('en una reserva cancelada se ven, pero no se editan', () => {
    const el = render([MARY], false);
    expect(el.textContent).toContain('Mary Smith');
    expect(boton('Agregar acompañante')).toBeUndefined();
    expect(boton('Editar')).toBeUndefined();
    expect(boton('Quitar')).toBeUndefined();
  });
});
