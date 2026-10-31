import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Acompanante } from '../types';

// Qué afirma este archivo: que la sección de acompañantes manda al servidor
// exactamente lo que se cargó, muestra lo que el servidor devolvió (no lo que
// se tipeó), y no finge haber guardado cuando la Lambda desplegada todavía no
// conoce el campo.

const { guardar, recargarReserva, handleUnauthorized, permiso, Conflicto } = vi.hoisted(() => ({
  guardar: vi.fn(),
  recargarReserva: vi.fn(),
  handleUnauthorized: vi.fn(),
  permiso: { operar: true },
  Conflicto: class ConflictError extends Error {
    code?: string;
    constructor(m?: string, code?: string) {
      super(m);
      this.code = code;
    }
  },
}));

vi.mock('../api/dashboardApi', () => ({
  guardarAcompanantes: (...args: unknown[]) => guardar(...args),
  getReservasResumen: (...args: unknown[]) => recargarReserva(...args),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ConflictError: Conflicto,
  esReservaModificada: (e: unknown) => e instanceof Conflicto && e.code === 'reserva_modificada',
  MENSAJE_RESERVA_MODIFICADA: 'Alguien cambió esta reserva mientras la editabas. Recarga para ver lo último; tus cambios no se guardaron.',
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ handleUnauthorized }), usePermiso: () => permiso.operar }));

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

function arbol(inicial: Acompanante[], editable: boolean, actualizadaEn: string | null, actualizando = false) {
  return (
    <StrictMode>
      <AcompanantesReserva
        bookingId="bkg_abc"
        inicial={inicial}
        actualizadaEn={actualizadaEn}
        actualizando={actualizando}
        editable={editable}
        onCambio={onCambio}
        onEditando={onEditando}
      />
    </StrictMode>
  );
}

function render(inicial: Acompanante[] = [], editable = true, actualizadaEn: string | null = null) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(arbol(inicial, editable, actualizadaEn));
  });
  return container;
}

// La ficha recargó (o está esperando la recarga): props nuevas sobre el mismo árbol.
function actualizar(inicial: Acompanante[], actualizadaEn: string | null, actualizando = false) {
  act(() => {
    root.render(arbol(inicial, true, actualizadaEn, actualizando));
  });
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
  recargarReserva.mockReset();
  permiso.operar = true;
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

describe('AcompanantesReserva — documento del registro de pasajeros', () => {
  const DOC = { Type: 'PASSPORT' as const, Number: 'X1234567', Nationality: 'USA', BirthDate: '1980-03-12', EntryDate: '2027-01-10' };

  function elegir(etiqueta: string, valor: string) {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim().startsWith(etiqueta));
    const sel = document.getElementById(label!.htmlFor) as HTMLSelectElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(sel, valor);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  it('agrega uno con documento: lo manda normalizado, con la fecha de nacimiento del acompañante', async () => {
    guardar.mockResolvedValue({ BookingID: 'bkg_abc', message: 'ok', Companions: [{ ...MARY, IdentityDocument: DOC }] });
    render();
    act(() => boton('Agregar acompañante')!.click());
    expect(container.querySelector('[data-bloque="documento"] legend')?.textContent).toBe('Documento (registro de pasajeros)');
    escribir(campo('Nombre'), 'Mary');
    escribir(campo('Fecha de nacimiento'), '1980-03-12');
    elegir('Tipo de documento', 'PASSPORT');
    escribir(campo('Número de documento'), ' X1234567 ');
    escribir(campo('Nacionalidad'), 'usa');
    escribir(campo('Fecha de ingreso al país'), '2027-01-10');
    await clickAsync(boton('Guardar acompañante'));

    expect(guardar).toHaveBeenCalledWith('bkg_abc', [
      {
        FirstName: 'Mary',
        LastName: '',
        BirthDate: '1980-03-12',
        FoodAllergy: false,
        FoodAllergyDetail: '',
        Notes: '',
        IdentityDocument: DOC,
      },
    ]);
    expect(container.querySelector('[data-dato="documento"]')?.textContent).toBe('Pasaporte X1234567 · USA · Ingresó el 10 ene 2027');
    expect(boton('Guardar acompañante')).toBeUndefined();
  });

  it('sin documento no manda la clave (igual que antes)', async () => {
    guardar.mockResolvedValue({ BookingID: 'bkg_abc', message: 'ok', Companions: [MARY] });
    render();
    act(() => boton('Agregar acompañante')!.click());
    escribir(campo('Nombre'), 'Mary');
    await clickAsync(boton('Guardar acompañante'));
    expect(Object.keys(guardar.mock.calls[0][1][0])).not.toContain('IdentityDocument');
    expect(container.querySelector('[data-dato="documento"]')).toBeNull();
  });

  it('documento a medias: no manda nada y dice qué falta', async () => {
    render();
    act(() => boton('Agregar acompañante')!.click());
    escribir(campo('Nombre'), 'Mary');
    escribir(campo('Número de documento'), 'X1');
    await clickAsync(boton('Guardar acompañante'));
    expect(container.textContent).toContain('Elige el tipo de documento.');

    escribir(campo('Número de documento'), '');
    elegir('Tipo de documento', 'RUT');
    await clickAsync(boton('Guardar acompañante'));
    expect(container.textContent).toContain('Falta el número del documento.');
    expect(guardar).not.toHaveBeenCalled();
  });

  it('editar carga el documento guardado y lo conserva; los demás viajan intactos', async () => {
    const conDoc = { ...MARY, IdentityDocument: DOC };
    guardar.mockResolvedValue({ BookingID: 'bkg_abc', message: 'ok', Companions: [{ ...conDoc, Notes: 'Vegetariana' }, JOHN] });
    render([conDoc, JOHN]);
    act(() => boton('Editar')!.click());
    expect((campo('Número de documento') as HTMLInputElement).value).toBe('X1234567');
    escribir(campo('Notas'), 'Vegetariana');
    await clickAsync(boton('Guardar acompañante'));
    expect(guardar).toHaveBeenCalledWith('bkg_abc', [{ ...conDoc, Notes: 'Vegetariana' }, JOHN]);
  });

  it('borrar el documento manda null', async () => {
    const conDoc = { ...MARY, IdentityDocument: DOC };
    guardar.mockResolvedValue({ BookingID: 'bkg_abc', message: 'ok', Companions: [{ ...MARY, IdentityDocument: {} }] });
    render([conDoc]);
    act(() => boton('Editar')!.click());
    elegir('Tipo de documento', '');
    escribir(campo('Número de documento'), '');
    escribir(campo('Nacionalidad'), '');
    escribir(campo('Fecha de ingreso al país'), '');
    await clickAsync(boton('Guardar acompañante'));
    expect(guardar.mock.calls[0][1][0].IdentityDocument).toBeNull();
    expect(container.querySelector('[data-dato="documento"]')).toBeNull();
  });

  it('si el servidor no devuelve el documento, lo dice sin fingir que quedó', async () => {
    guardar.mockResolvedValue({ BookingID: 'bkg_abc', message: 'ok', Companions: [MARY] });
    render();
    act(() => boton('Agregar acompañante')!.click());
    escribir(campo('Nombre'), 'Mary');
    elegir('Tipo de documento', 'PASSPORT');
    escribir(campo('Número de documento'), 'X1234567');
    await clickAsync(boton('Guardar acompañante'));
    expect(container.textContent).toContain('Se guardó el acompañante, pero el servidor todavía no guarda su documento.');
    expect(container.querySelector('[data-dato="documento"]')).toBeNull();
    expect(onCambio).toHaveBeenCalledTimes(1);
    expect(onEditando).toHaveBeenLastCalledWith(false);
  });
});

describe('AcompanantesReserva — concurrencia (ExpectedUpdatedAt, 30-oct)', () => {
  const LEIDO = '2026-10-30T12:00:00.000Z';
  const MODIFICADA = 'Alguien cambió esta reserva mientras la editabas. Recarga para ver lo último; tus cambios no se guardaron.';

  it('manda el UpdatedAt que leyó; tras guardar usa el que devuelve el servidor, o ninguno si no lo devuelve', async () => {
    guardar
      .mockResolvedValueOnce({ BookingID: 'bkg_abc', message: 'ok', Companions: [MARY, JOHN], UpdatedAt: '2026-10-30T12:05:00.000Z' })
      .mockResolvedValueOnce({ BookingID: 'bkg_abc', message: 'ok', Companions: [MARY] })
      .mockResolvedValueOnce({ BookingID: 'bkg_abc', message: 'ok', Companions: [] });
    render([MARY], true, LEIDO);
    act(() => boton('Agregar acompañante')!.click());
    escribir(campo('Nombre'), 'John');
    await clickAsync(boton('Guardar acompañante'));
    expect(guardar.mock.calls[0][2]).toBe(LEIDO);
    await clickAsync(boton('Quitar'));
    expect(guardar.mock.calls[1][2]).toBe('2026-10-30T12:05:00.000Z');
    await clickAsync(boton('Quitar'));
    // Sin UpdatedAt en la respuesta no se manda uno viejo: chocaría consigo mismo.
    expect(guardar.mock.calls[2]).toHaveLength(2);
  });

  it('sin UpdatedAt en la reserva (servidor anterior) no manda el campo', async () => {
    guardar.mockResolvedValue({ BookingID: 'bkg_abc', message: 'ok', Companions: [] });
    render([MARY]);
    await clickAsync(boton('Quitar'));
    expect(guardar.mock.calls[0]).toHaveLength(2);
  });

  it('409 reserva_modificada: lo dice, conserva lo escrito y «Recargar» trae la reserva actual', async () => {
    guardar.mockRejectedValue(new Conflicto('La reserva cambió', 'reserva_modificada'));
    recargarReserva.mockResolvedValue({ client_id: 'x', reservas: [{ BookingID: 'bkg_abc', Companions: [JOHN], UpdatedAt: '2026-10-30T12:09:00.000Z' }] });
    render([MARY], true, LEIDO);
    act(() => boton('Agregar acompañante')!.click());
    escribir(campo('Nombre'), 'Pedro');
    await clickAsync(boton('Guardar acompañante'));
    const aviso = container.querySelector('[data-aviso="reserva-modificada"]');
    expect(aviso?.querySelector('[role="alert"]')?.textContent).toBe(MODIFICADA);
    expect((campo('Nombre') as HTMLInputElement).value).toBe('Pedro');
    expect(boton('Guardar acompañante')!.disabled).toBe(true);
    expect(onCambio).not.toHaveBeenCalled();
    await clickAsync(boton('Recargar'));
    expect(recargarReserva).toHaveBeenCalledWith({ bookingId: 'bkg_abc' });
    expect(container.textContent).toContain('John Smith');
    expect(container.textContent).not.toContain('Mary Smith');
    expect(container.querySelector('[data-aviso="reserva-modificada"]')).toBeNull();
    expect(boton('Guardar acompañante')).toBeUndefined();
    expect(onCambio).toHaveBeenCalled();
    // El siguiente guardado va contra el UpdatedAt recién leído.
    guardar.mockReset().mockResolvedValue({ BookingID: 'bkg_abc', message: 'ok', Companions: [] });
    await clickAsync(boton('Quitar'));
    expect(guardar.mock.calls[0][2]).toBe('2026-10-30T12:09:00.000Z');
  });

  it('un 409 sin ese código se muestra como cualquier error, sin «Recargar»', async () => {
    guardar.mockRejectedValue(new Conflicto('Otro conflicto'));
    render([MARY], true, LEIDO);
    await clickAsync(boton('Quitar'));
    expect(container.textContent).toContain('Otro conflicto');
    expect(boton('Recargar')).toBeUndefined();
  });

  it('si recargar falla, lo dice y deja el aviso para reintentar', async () => {
    guardar.mockRejectedValue(new Conflicto('x', 'reserva_modificada'));
    recargarReserva.mockRejectedValue(new Error('caído'));
    render([MARY], true, LEIDO);
    await clickAsync(boton('Quitar'));
    await clickAsync(boton('Recargar'));
    expect(container.textContent).toContain('No pudimos recargar la reserva. Vuelve a intentarlo.');
    expect(boton('Recargar')).toBeDefined();
  });
});

// Ronda 4 (30-oct): `esperado` y la lista se mueven juntos; la versión de la
// reserva que llega por props solo se adopta si no hay cambios sin guardar.
describe('AcompanantesReserva — versión con recargas (ronda 4)', () => {
  const V1 = '2026-10-30T12:00:00.000Z';
  const V2 = '2026-10-30T12:05:00.000Z';
  const V3 = '2026-10-30T12:10:00.000Z';
  const conflicto = () => new Conflicto('La reserva cambió', 'reserva_modificada');

  it('B agregó a John; la ficha recarga con el formulario editado: guarda con la versión vieja, da 409 y no borra a John', async () => {
    guardar.mockRejectedValue(conflicto());
    render([MARY], true, V1);
    act(() => boton('Editar')!.click());
    escribir(campo('Notas'), 'Vegetariana');
    actualizar([MARY, JOHN], V3);
    expect((campo('Notas') as HTMLTextAreaElement).value).toBe('Vegetariana');
    await clickAsync(boton('Guardar acompañante'));
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar.mock.calls[0][1]).toEqual([{ ...MARY, Notes: 'Vegetariana' }]);
    expect(guardar.mock.calls[0][2]).toBe(V1);
    expect(container.querySelector('[data-aviso="reserva-modificada"]')).not.toBeNull();
  });

  it('recarga sin cambios: rearma la lista y el formulario abierto, y guarda con la versión nueva', async () => {
    guardar.mockResolvedValue({ BookingID: 'bkg_abc', message: 'ok', Companions: [MARY, JOHN] });
    render([MARY], true, V1);
    act(() => boton('Editar')!.click());
    actualizar([{ ...MARY, Notes: 'Lo cambió B' }, JOHN], V3);
    expect(container.textContent).toContain('John Smith');
    expect((campo('Notas') as HTMLTextAreaElement).value).toBe('Lo cambió B');
    escribir(campo('Notas'), 'Vegetariana');
    await clickAsync(boton('Guardar acompañante'));
    expect(guardar).toHaveBeenCalledWith('bkg_abc', [{ ...MARY, Notes: 'Vegetariana' }, JOHN], V3);
  });

  it('recarga sin cambios: si el acompañante que estaba abierto ya no está, cierra el formulario', () => {
    render([MARY, JOHN], true, V1);
    act(() => boton('Editar')!.click());
    actualizar([JOHN], V3);
    expect(boton('Guardar acompañante')).toBeUndefined();
    expect(container.textContent).not.toContain('Mary Smith');
  });

  it('recarga con un acompañante nuevo a medio escribir: conserva lo escrito, la lista y la versión', async () => {
    guardar.mockRejectedValue(conflicto());
    render([MARY], true, V1);
    act(() => boton('Agregar acompañante')!.click());
    escribir(campo('Nombre'), 'Pedro');
    actualizar([MARY, JOHN], V3);
    expect((campo('Nombre') as HTMLInputElement).value).toBe('Pedro');
    expect(container.textContent).not.toContain('John Smith');
    await clickAsync(boton('Guardar acompañante'));
    expect(guardar.mock.calls[0][2]).toBe(V1);
    expect(guardar.mock.calls[0][1].map((a: Acompanante) => a.FirstName)).toEqual(['Mary', 'Pedro']);
  });

  it('dos guardados propios seguidos: mientras la ficha recarga no guarda («Actualizando…») y luego va con la versión nueva, sin 409', async () => {
    guardar
      .mockResolvedValueOnce({ BookingID: 'bkg_abc', message: 'ok', Companions: [MARY, JOHN], UpdatedAt: V2 })
      .mockResolvedValueOnce({ BookingID: 'bkg_abc', message: 'ok', Companions: [MARY, JOHN, { ...JOHN, CompanionID: 'cmp_pedro0000000', FirstName: 'Pedro' }], UpdatedAt: V3 });
    render([MARY], true, V1);
    act(() => boton('Agregar acompañante')!.click());
    escribir(campo('Nombre'), 'John');
    await clickAsync(boton('Guardar acompañante'));
    expect(guardar.mock.calls[0][2]).toBe(V1);
    // La ficha marca la recarga pendiente con la reserva vieja todavía en props.
    actualizar([MARY], V1, true);
    expect(container.textContent).toContain('John Smith');
    expect(Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === 'Quitar').every((b) => b.disabled)).toBe(true);
    act(() => boton('Agregar acompañante')!.click());
    expect(boton('Actualizando…')!.disabled).toBe(true);
    actualizar([MARY, JOHN], V2);
    expect(boton('Guardar acompañante')!.disabled).toBe(false);
    escribir(campo('Nombre'), 'Pedro');
    await clickAsync(boton('Guardar acompañante'));
    expect(guardar).toHaveBeenCalledTimes(2);
    expect(guardar.mock.calls[1][2]).toBe(V2);
    expect(container.querySelector('[data-aviso="reserva-modificada"]')).toBeNull();
  });
});

describe('AcompanantesReserva — rol Lectura sin IdentityDocument (30-oct)', () => {
  it('sin la clave IdentityDocument se ve igual, sin «undefined» y sin editar', () => {
    permiso.operar = false;
    const sinDoc = { ...MARY } as Acompanante & { IdentityDocument?: unknown };
    delete sinDoc.IdentityDocument;
    render([sinDoc, JOHN]);
    expect(container.textContent).toContain('Mary Smith');
    expect(container.textContent).toContain('John Smith');
    expect(container.querySelector('[data-dato="documento"]')).toBeNull();
    expect(container.textContent).not.toMatch(/undefined|null|NaN/);
    expect(boton('Agregar acompañante')).toBeUndefined();
    expect(boton('Editar')).toBeUndefined();
  });
});
