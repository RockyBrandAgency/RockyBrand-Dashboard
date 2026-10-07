import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { StoreGarantia, StoreGarantiaDatos } from '../../types';

// Qué afirma este archivo: que el formulario de garantías manda al backend el
// formulario COMPLETO y bien convertido (montos en pesos enteros, opcionales
// vacíos como null o ""), que no deja guardar lo que el backend rechazaría, y
// que al editar manda el valor del bloqueo optimista que tenía cargado.

const { crear, editar, handleUnauthorized } = vi.hoisted(() => ({
  crear: vi.fn(),
  editar: vi.fn(),
  handleUnauthorized: vi.fn(),
}));

vi.mock('../../api/dashboardApi', () => ({
  crearTiendaGarantia: (...args: unknown[]) => crear(...args),
  editarTiendaGarantia: (...args: unknown[]) => editar(...args),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ handleUnauthorized }) }));

import { GarantiaFormModal, leerMonto } from './GarantiaFormModal';

const WEB: StoreGarantia = {
  solicitud_id: 'GAR-ABC1234567',
  estado: 'despachada',
  origen: 'web',
  created_at: '2026-10-01T15:00:00+00:00',
  actualizada_en: '2026-10-02T10:00:00+00:00',
  nombre: 'Pedro Web',
  email: 'web@example.cl',
  telefono: '912345678',
  direccion: 'Calle 1, Puerto Varas, Los Lagos',
  direccion_calle: 'Calle 1',
  comuna: 'Puerto Varas',
  region: 'Los Lagos',
  cana: 'SKY G',
  modelo: '5904',
  tramo: '1',
  descripcion: 'Se cortó',
  costo_clp: 50000,
  costo_despacho_clp: null,
  costo_douglas_clp: 20000,
  pagado: true,
  fecha_pago: '2026-10-02',
  courier: '',
  numero_seguimiento: '',
  fecha_despacho: '2026-10-03',
  fecha_entrega: '',
  persona: 'web@example.cl',
  veces_usada: 1,
  nota_interna: 'Ojo',
};

let container: HTMLDivElement;
let root: Root;
let onClose: Mock<() => void>;
let onGuardado: Mock<(id: string) => void>;

function render(garantia?: StoreGarantia) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <StrictMode>
        <GarantiaFormModal garantia={garantia} onClose={onClose} onGuardado={onGuardado} />
      </StrictMode>,
    );
  });
}

function campo(etiqueta: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim().startsWith(etiqueta));
  if (!label) throw new Error(`No hay campo «${etiqueta}»`);
  return document.getElementById(label.htmlFor) as HTMLInputElement;
}

function escribir(etiqueta: string, valor: string) {
  const el = campo(etiqueta);
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, valor);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

function boton(texto: string): HTMLButtonElement {
  const b = Array.from(container.querySelectorAll('button')).find((x) => x.textContent?.trim() === texto);
  if (!b) throw new Error(`No hay botón «${texto}»`);
  return b;
}

async function click(b: HTMLElement) {
  await act(async () => {
    b.click();
  });
}

function alerta(): string | null | undefined {
  return container.querySelector('[role="alert"]')?.textContent;
}

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
  crear.mockReset();
  editar.mockReset();
  onClose = vi.fn<() => void>();
  onGuardado = vi.fn<(id: string) => void>();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function llenarMinimo() {
  escribir('Nombre', 'Ana Pérez');
  escribir('Teléfono', '+56 9 1234 5678');
  escribir('Caña', 'SKY G');
  escribir('Tramo', '2');
}

describe('GarantiaFormModal — agregar', () => {
  it('manda el formulario completo, con el precio por defecto y sin correo', async () => {
    crear.mockResolvedValue({ ok: true, solicitud_id: 'GAR-NUEVA00001' });
    render();
    llenarMinimo();
    await click(boton('Agregar garantía'));

    const esperado: StoreGarantiaDatos = {
      nombre: 'Ana Pérez',
      email: '',
      telefono: '+56 9 1234 5678',
      direccion: '',
      comuna: '',
      region: '',
      cana: 'SKY G',
      modelo: '',
      tramo: '2',
      descripcion: '',
      estado: 'recibida',
      costo_clp: 50000,
      costo_despacho_clp: null,
      costo_douglas_clp: null,
      pagado: false,
      fecha_pago: '',
      courier: '',
      numero_seguimiento: '',
      fecha_despacho: '',
      fecha_entrega: '',
      nota_interna: '',
    };
    expect(crear).toHaveBeenCalledWith(esperado);
    expect(onGuardado).toHaveBeenCalledWith('GAR-NUEVA00001');
  });

  it('carga despacho, entrega, costos y pago', async () => {
    crear.mockResolvedValue({ ok: true, solicitud_id: 'GAR-NUEVA00002' });
    render();
    llenarMinimo();
    escribir('Correo', ' ana@example.cl ');
    escribir('Dirección de despacho', 'Av. Siempre Viva 123');
    escribir('Comuna', 'Coyhaique');
    escribir('Región', 'Aysén');
    escribir('Empresa de transporte', 'Starken');
    escribir('N° de seguimiento', 'ST-998');
    escribir('Fecha de despacho', '2026-10-03');
    escribir('Recibida por el cliente el', '2026-10-06');
    escribir('Precio al cliente', '$45.000');
    escribir('Costo de despacho', '6.500');
    escribir('Costo pagado a Douglas', '20000');
    expect(container.textContent).toContain('$18.500');
    await click(campo('Pagado') as HTMLInputElement);
    escribir('Fecha de pago', '2026-10-02');
    escribir('Estado', 'entregada');
    await click(boton('Agregar garantía'));

    expect(crear).toHaveBeenCalledTimes(1);
    const datos = crear.mock.calls[0][0] as StoreGarantiaDatos;
    expect(datos).toMatchObject({
      email: 'ana@example.cl',
      direccion: 'Av. Siempre Viva 123',
      comuna: 'Coyhaique',
      region: 'Aysén',
      courier: 'Starken',
      numero_seguimiento: 'ST-998',
      fecha_despacho: '2026-10-03',
      fecha_entrega: '2026-10-06',
      costo_clp: 45000,
      costo_despacho_clp: 6500,
      costo_douglas_clp: 20000,
      pagado: true,
      fecha_pago: '2026-10-02',
      estado: 'entregada',
    });
  });

  it.each([
    ['Nombre', '', 'Falta el nombre.'],
    ['Teléfono', ' ', 'Falta el teléfono.'],
    ['Caña', '', 'Falta la caña.'],
    ['Tramo', '', 'Elige el tramo.'],
    ['Correo', 'ana@', 'El correo no tiene un formato válido.'],
    ['Precio al cliente', '', 'Falta el precio al cliente.'],
    ['Precio al cliente', '45.000,5', 'El precio al cliente debe ser un monto en pesos'],
    ['Costo de despacho', '-100', 'El costo de despacho debe ser un monto en pesos'],
  ])('no guarda si %s = «%s»', async (etiqueta, valor, mensaje) => {
    render();
    llenarMinimo();
    escribir(etiqueta, valor);
    await click(boton('Agregar garantía'));
    expect(alerta()).toContain(mensaje);
    expect(crear).not.toHaveBeenCalled();
  });

  it('no deja una entrega anterior al despacho', async () => {
    render();
    llenarMinimo();
    escribir('Fecha de despacho', '2026-10-05');
    escribir('Recibida por el cliente el', '2026-10-04');
    await click(boton('Agregar garantía'));
    expect(alerta()).toContain('La fecha de entrega no puede ser anterior');
    expect(crear).not.toHaveBeenCalled();
  });

  it('muestra el error del backend y no da la garantía por guardada', async () => {
    crear.mockRejectedValue(new Error('Indica el tramo: 1 (la punta), 2, 3 o 4.'));
    render();
    llenarMinimo();
    await click(boton('Agregar garantía'));
    expect(alerta()).toContain('Indica el tramo');
    expect(onGuardado).not.toHaveBeenCalled();
  });

  it('pide confirmación antes de descartar lo escrito', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render();
    escribir('Nombre', 'Ana');
    await click(boton('Cancelar'));
    expect(window.confirm).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('GarantiaFormModal — editar', () => {
  it('parte con lo guardado y no deja guardar sin cambios', () => {
    render(WEB);
    expect((campo('Nombre') as HTMLInputElement).value).toBe('Pedro Web');
    expect((campo('Dirección de despacho') as HTMLInputElement).value).toBe('Calle 1');
    expect((campo('Costo pagado a Douglas') as HTMLInputElement).value).toBe('20.000');
    expect((campo('Costo de despacho') as HTMLInputElement).value).toBe('');
    expect(boton('Guardar cambios').disabled).toBe(true);
  });

  it('manda el id, todo el formulario y el valor del bloqueo que tenía cargado', async () => {
    editar.mockResolvedValue({ ok: true, actualizada_en: '2026-10-07T12:00:00+00:00' });
    render(WEB);
    escribir('Empresa de transporte', 'Chilexpress');
    escribir('Recibida por el cliente el', '2026-10-06');
    escribir('Correo', '');
    await click(boton('Guardar cambios'));

    expect(editar).toHaveBeenCalledTimes(1);
    const [id, datos, esperado] = editar.mock.calls[0] as [string, StoreGarantiaDatos, string];
    expect(id).toBe('GAR-ABC1234567');
    expect(esperado).toBe('2026-10-02T10:00:00+00:00');
    expect(datos).toEqual({
      nombre: 'Pedro Web',
      email: '',
      telefono: '912345678',
      direccion: 'Calle 1',
      comuna: 'Puerto Varas',
      region: 'Los Lagos',
      cana: 'SKY G',
      modelo: '5904',
      tramo: '1',
      descripcion: 'Se cortó',
      estado: 'despachada',
      costo_clp: 50000,
      costo_despacho_clp: null,
      costo_douglas_clp: 20000,
      pagado: true,
      fecha_pago: '2026-10-02',
      courier: 'Chilexpress',
      numero_seguimiento: '',
      fecha_despacho: '2026-10-03',
      fecha_entrega: '2026-10-06',
      nota_interna: 'Ojo',
    });
    expect(onGuardado).toHaveBeenCalledWith('GAR-ABC1234567');
  });

  it('al desmarcar Pagado no manda la fecha de pago', async () => {
    editar.mockResolvedValue({ ok: true, actualizada_en: 'x' });
    render(WEB);
    await click(campo('Pagado') as HTMLInputElement);
    expect(() => campo('Fecha de pago')).toThrow();
    await click(boton('Guardar cambios'));
    expect(editar.mock.calls[0][1]).toMatchObject({ pagado: false, fecha_pago: '' });
  });

  it('un 409 se muestra tal cual y el formulario sigue abierto', async () => {
    editar.mockRejectedValue(new Error('Esta garantía cambió desde que abriste el formulario. Recarga la página y vuelve a editarla.'));
    render(WEB);
    escribir('Nombre', 'Otro');
    await click(boton('Guardar cambios'));
    expect(alerta()).toContain('Recarga la página');
    expect(onGuardado).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('leerMonto', () => {
  it.each([
    ['', null],
    ['50000', 50000],
    ['50.000', 50000],
    ['$ 50.000', 50000],
    ['0', 0],
    ['10.000.000', 10000000],
    ['10.000.001', 'invalido'],
    ['50,5', 'invalido'],
    ['abc', 'invalido'],
    ['-1', 'invalido'],
  ])('«%s» → %s', (texto, esperado) => {
    expect(leerMonto(texto)).toBe(esperado);
  });
});
