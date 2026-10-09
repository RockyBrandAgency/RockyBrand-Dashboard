import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { StoreGarantia, StoreGarantiaAviso, StoreGarantiaDatos } from '../../types';

// Qué afirma este archivo: que el formulario de garantías manda al backend el
// formulario COMPLETO y bien convertido (montos en pesos enteros, opcionales
// vacíos como null o ""), que no deja guardar lo que el backend rechazaría, y
// que al editar manda el valor del bloqueo optimista que tenía cargado.
// Y que la página elimina, restaura y ofrece traer lo actual tras un 409
// (2026-10-07). Desde 2026-10-08 lleva RUT (validado y con formato) y la
// región es una lista.
// Y el aviso por WhatsApp (2026-10-08): solo sale con el botón y la
// confirmación, con lo guardado y el bloqueo optimista, y tras un error
// muestra el estado que quedó guardado.

const { crear, editar, notificar, handleUnauthorized } = vi.hoisted(() => ({
  crear: vi.fn(),
  editar: vi.fn(),
  notificar: vi.fn(),
  handleUnauthorized: vi.fn(),
}));

vi.mock('../../api/dashboardApi', () => ({
  crearTiendaGarantia: (...args: unknown[]) => crear(...args),
  editarTiendaGarantia: (...args: unknown[]) => editar(...args),
  notificarTiendaGarantia: (...args: unknown[]) => notificar(...args),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ConflictError: class ConflictError extends Error {},
  TimeoutError: class TimeoutError extends Error {},
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ handleUnauthorized }) }));

import { ConflictError, TimeoutError } from '../../api/dashboardApi';
import { GarantiaFicha, leerMonto } from './GarantiaFicha';

const WEB: StoreGarantia = {
  solicitud_id: 'GAR-ABC1234567',
  estado: 'despachada',
  origen: 'web',
  created_at: '2026-10-01T15:00:00+00:00',
  actualizada_en: '2026-10-02T10:00:00+00:00',
  nombre: 'Pedro Web',
  rut: '12.345.678-5',
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

function render(garantia?: StoreGarantia, extra: Partial<React.ComponentProps<typeof GarantiaFicha>> = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <StrictMode>
        <GarantiaFicha garantia={garantia} isDesktop onClose={onClose} onGuardado={onGuardado} {...extra} />
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

function radio(texto: string): HTMLInputElement {
  const label = Array.from(container.querySelectorAll('label.garantia-chip')).find((l) => l.textContent?.replace('✓', '').trim() === texto);
  if (!label) throw new Error(`No hay estado «${texto}»`);
  return label.querySelector('input') as HTMLInputElement;
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
  notificar.mockReset();
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

describe('GarantiaFicha — agregar', () => {
  it('manda el formulario completo, con el precio por defecto y sin correo', async () => {
    crear.mockResolvedValue({ ok: true, solicitud_id: 'GAR-NUEVA00001' });
    render();
    llenarMinimo();
    await click(boton('Agregar garantía'));

    const esperado: StoreGarantiaDatos = {
      nombre: 'Ana Pérez',
      rut: '',
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
    escribir('RUT', '12345678-5');
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
    await click(radio('Entregada'));
    await click(boton('Agregar garantía'));

    expect(crear).toHaveBeenCalledTimes(1);
    const datos = crear.mock.calls[0][0] as StoreGarantiaDatos;
    expect(datos).toMatchObject({
      rut: '12.345.678-5',
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
    ['RUT', '12.345.678-9', 'El RUT no es válido'],
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

describe('GarantiaFicha — editar', () => {
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
      rut: '12.345.678-5',
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

describe('GarantiaFicha — eliminar, restaurar y conflicto', () => {
  it('una nueva no tiene Eliminar', () => {
    render(undefined, { onEliminar: vi.fn() });
    expect(() => boton('Eliminar')).toThrow();
  });

  it('elimina sin preguntar si no hay cambios', async () => {
    const onEliminar = vi.fn().mockResolvedValue(undefined);
    render(WEB, { onEliminar });
    await click(boton('Eliminar'));
    expect(window.confirm).not.toHaveBeenCalled();
    expect(onEliminar).toHaveBeenCalledWith(WEB);
  });

  it('con cambios sin guardar pregunta antes de eliminar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onEliminar = vi.fn().mockResolvedValue(undefined);
    render(WEB, { onEliminar });
    escribir('Nombre', 'Otro');
    await click(boton('Eliminar'));
    expect(window.confirm).toHaveBeenCalled();
    expect(onEliminar).not.toHaveBeenCalled();
  });

  it('si eliminar falla, muestra el error y la ficha sigue abierta', async () => {
    const onEliminar = vi.fn().mockRejectedValue(new Error('No se pudo conectar con el panel.'));
    render(WEB, { onEliminar });
    await click(boton('Eliminar'));
    expect(alerta()).toContain('No se pudo conectar');
    expect(boton('Eliminar').disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('una eliminada se abre en solo lectura y se restaura', async () => {
    const onRestaurar = vi.fn().mockResolvedValue(undefined);
    render({ ...WEB, eliminada_en: '2026-10-07T20:00:00+00:00' }, { onEliminar: vi.fn(), onRestaurar });
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(() => boton('Guardar cambios')).toThrow();
    expect(() => boton('Eliminar')).toThrow();
    expect(container.textContent).toContain('Restáurala para editarla');
    await click(boton('Restaurar'));
    expect(onRestaurar).toHaveBeenCalledWith(expect.objectContaining({ solicitud_id: 'GAR-ABC1234567' }));
  });

  it('una viva no tiene Eliminar permanentemente', () => {
    render(WEB, { onEliminar: vi.fn(), onBorrar: vi.fn() });
    expect(() => boton('Eliminar permanentemente')).toThrow();
  });

  it('una eliminada se borra para siempre solo si se confirma', async () => {
    const onBorrar = vi.fn().mockResolvedValue(undefined);
    render({ ...WEB, eliminada_en: '2026-10-07T20:00:00+00:00' }, { onRestaurar: vi.fn(), onBorrar });
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await click(boton('Eliminar permanentemente'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('no se puede restaurar'));
    expect(onBorrar).not.toHaveBeenCalled();
    await click(boton('Eliminar permanentemente'));
    expect(onBorrar).toHaveBeenCalledWith(expect.objectContaining({ solicitud_id: 'GAR-ABC1234567' }));
  });

  it('si borrar falla, muestra el error y sigue en la página', async () => {
    const onBorrar = vi.fn().mockRejectedValue(new Error('La garantía se restauró mientras la borrabas. No se borró.'));
    render({ ...WEB, eliminada_en: '2026-10-07T20:00:00+00:00' }, { onRestaurar: vi.fn(), onBorrar });
    await click(boton('Eliminar permanentemente'));
    expect(alerta()).toContain('se restauró');
    expect(boton('Eliminar permanentemente').disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('tras un 409 ofrece descartar y ver la versión actual', async () => {
    editar.mockRejectedValue(new ConflictError('Esta garantía cambió desde que abriste el formulario.'));
    const onVerActual = vi.fn();
    render(WEB, { onVerActual });
    escribir('Nombre', 'Otro');
    await click(boton('Guardar cambios'));
    await click(boton('Descartar mis cambios y ver la versión actual'));
    expect(onVerActual).toHaveBeenCalledTimes(1);
  });

  it('un error que no es 409 no ofrece ver la versión actual', async () => {
    editar.mockRejectedValue(new Error('Falta el nombre.'));
    render(WEB, { onVerActual: vi.fn() });
    escribir('Nombre', 'Otro');
    await click(boton('Guardar cambios'));
    expect(() => boton('Descartar mis cambios y ver la versión actual')).toThrow();
  });

  it('⌘S guarda, y sin cambios no hace nada', async () => {
    editar.mockResolvedValue({ ok: true, actualizada_en: 'x' });
    render(WEB);
    const teclear = () =>
      act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }));
      });
    await teclear();
    expect(editar).not.toHaveBeenCalled();
    escribir('Empresa de transporte', 'Starken');
    await teclear();
    expect(editar).toHaveBeenCalledTimes(1);
  });

  it('el estado se elige con los chips y se manda al guardar', async () => {
    editar.mockResolvedValue({ ok: true, actualizada_en: 'x' });
    render(WEB);
    expect(radio('Despachada').checked).toBe(true);
    await click(radio('Rechazada'));
    await click(boton('Guardar cambios'));
    expect(editar.mock.calls[0][1]).toMatchObject({ estado: 'rechazada' });
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

describe('GarantiaFicha — aviso por WhatsApp', () => {
  const PREVIA = {
    texto: 'Hola Pedro,\n*Datos del despacho*\n- *Starken, N° de seguimiento:* 123456789',
    botones: ['Lo recibí', 'Seguir mi envío'],
    destino: '+56 9 1234 5678',
    url: 'https://www.starken.cl/seguimiento?codigo=123456789',
  };
  const SIN_AVISO: StoreGarantiaAviso = {
    accion: 'notificar',
    motivo: '',
    estado: '',
    enviado_en: '',
    entregado_en: '',
    leido_en: '',
    fallido_en: '',
    error: null,
    envios: 0,
    destino_avisado: '',
    cambio_desde_aviso: false,
    vista_previa: PREVIA,
    recepcion: null,
  };
  const ENVIADO: StoreGarantiaAviso = {
    ...SIN_AVISO,
    accion: 'reenviar',
    estado: 'enviado',
    enviado_en: '2026-10-08T15:00:00+00:00',
    envios: 1,
    destino_avisado: '+56 9 1234 5678',
  };
  const conAviso = (aviso: StoreGarantiaAviso): StoreGarantia => ({ ...WEB, courier: 'Starken', numero_seguimiento: '123456789', aviso });

  it('sin el aviso del backend no hay bloque', () => {
    render(WEB);
    expect(container.textContent).not.toContain('Aviso al cliente por WhatsApp');
  });

  it('muestra la vista previa con negritas y no envía sin confirmar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(conAviso(SIN_AVISO));
    expect(container.textContent).toContain('Todavía no se le avisa.');
    expect(container.querySelector('details')?.open).toBe(true);
    expect(Array.from(container.querySelectorAll('details strong')).map((x) => x.textContent)).toContain('Datos del despacho');
    await click(boton('Notificar al cliente'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('+56 9 1234 5678'));
    expect(notificar).not.toHaveBeenCalled();
  });

  it('confirmado, manda el id, el bloqueo y reenviar=false, y muestra el envío', async () => {
    const onAvisoCambiado = vi.fn();
    notificar.mockResolvedValue({ ok: true, solicitud_id: WEB.solicitud_id, aviso: ENVIADO });
    render(conAviso(SIN_AVISO), { onAvisoCambiado });
    await click(boton('Notificar al cliente'));
    expect(notificar).toHaveBeenCalledWith('GAR-ABC1234567', '2026-10-02T10:00:00+00:00', false);
    expect(container.textContent).toContain('Enviado el');
    expect(onAvisoCambiado).toHaveBeenCalledWith('GAR-ABC1234567', ENVIADO);
    expect(boton('Reenviar aviso')).toBeTruthy();
  });

  it('reenviar pregunta y manda reenviar=true', async () => {
    notificar.mockResolvedValue({ ok: true, solicitud_id: WEB.solicitud_id, aviso: { ...ENVIADO, envios: 2 } });
    render(conAviso({ ...ENVIADO, cambio_desde_aviso: true }));
    expect(container.textContent).toContain('Cambiaste datos desde el último aviso');
    await click(boton('Reenviar aviso'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('ya tiene un aviso'));
    expect(notificar).toHaveBeenCalledWith('GAR-ABC1234567', '2026-10-02T10:00:00+00:00', true);
    expect(container.textContent).toContain('Lleva 2 envíos.');
  });

  it('con cambios sin guardar no deja notificar', () => {
    render(conAviso(SIN_AVISO));
    escribir('N° de seguimiento', '999999999');
    expect(boton('Notificar al cliente').disabled).toBe(true);
    expect(container.textContent).toContain('Guarda los cambios primero');
  });

  it('sin acción posible muestra el motivo y no hay botón', () => {
    render(conAviso({ ...SIN_AVISO, accion: '', motivo: 'Para notificar falta el N° de seguimiento.', vista_previa: null }));
    expect(container.textContent).toContain('Para notificar falta el N° de seguimiento.');
    expect(() => boton('Notificar al cliente')).toThrow();
  });

  it('muestra la recepción confirmada por el cliente', () => {
    render(conAviso({ ...ENVIADO, accion: '', motivo: 'El cliente ya confirmó que lo recibió.', recepcion: { confirmada_en: '2026-10-09T12:00:00+00:00', via: 'whatsapp' } }));
    expect(container.textContent).toContain('Confirmó que lo recibió');
    expect(container.textContent).toContain('«Lo recibí»');
    expect(() => boton('Reenviar aviso')).toThrow();
  });

  it('un 409 ofrece ver la versión actual', async () => {
    const onVerActual = vi.fn();
    const onRecargarAviso = vi.fn().mockResolvedValue(null);
    notificar.mockRejectedValue(new ConflictError('La garantía cambió desde que la abriste.'));
    render(conAviso(SIN_AVISO), { onVerActual, onRecargarAviso });
    await click(boton('Notificar al cliente'));
    expect(alerta()).toContain('La garantía cambió');
    await click(boton('Ver la versión actual'));
    expect(onVerActual).toHaveBeenCalled();
  });

  it('tras un corte no afirma nada: dice que no se sabe y trae el estado guardado', async () => {
    const onRecargarAviso = vi.fn().mockResolvedValue({ ...ENVIADO, estado: 'incierto' });
    notificar.mockRejectedValue(new TimeoutError());
    render(conAviso(SIN_AVISO), { onRecargarAviso });
    await click(boton('Notificar al cliente'));
    expect(alerta()).toContain('No sabemos si el aviso salió');
    expect(onRecargarAviso).toHaveBeenCalledWith('GAR-ABC1234567');
    expect(container.textContent).toContain('No sabemos si salió: WhatsApp no respondió a tiempo.');
  });

  it('un error de red o un 5xx sin rechazo de WhatsApp no afirma que no salió', async () => {
    notificar.mockRejectedValue(new Error('Error de conexión con el dashboard.'));
    render(conAviso(SIN_AVISO), { onRecargarAviso: vi.fn().mockResolvedValue(null) });
    await click(boton('Notificar al cliente'));
    expect(alerta()).toContain('No sabemos si el aviso salió');
  });

  it('reenviar un aviso incierto no dice que el cliente ya lo tiene', async () => {
    notificar.mockResolvedValue({ ok: true, solicitud_id: WEB.solicitud_id, aviso: ENVIADO });
    render(conAviso({ ...ENVIADO, estado: 'incierto' }));
    await click(boton('Reenviar aviso'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('No sabemos si el aviso anterior salió'));
  });

  it('un rechazo de WhatsApp queda como no salió', async () => {
    const fallido: StoreGarantiaAviso = { ...SIN_AVISO, estado: 'fallido', fallido_en: '2026-10-08T15:00:00+00:00', error: { codigo: 131026, detalle: 'Ese número no tiene WhatsApp.' } };
    notificar.mockRejectedValue(new Error('No se envió. Ese número no tiene WhatsApp.'));
    render(conAviso(SIN_AVISO), { onRecargarAviso: vi.fn().mockResolvedValue(fallido) });
    await click(boton('Notificar al cliente'));
    expect(alerta()).toContain('No se envió.');
    expect(container.textContent).toContain('No salió');
    expect(boton('Reintentar el envío')).toBeTruthy();
  });
});
