import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Qué afirma (10-nov, «Borrar definitivamente»): la confirmación abre con el
// foco en «Volver sin cambios», dice que es irreversible y muestra programa y fechas;
// «Volver sin cambios» y Escape no llaman al servidor y devuelven el foco; «Borrar
// definitivamente» llama a POST …/borrar y avisa a la pantalla; cada 409, el
// 403 y el 404 se explican con su texto, y los que lo piden ofrecen Recargar.

const { api, Errores } = vi.hoisted(() => {
  class ConflictError extends Error {
    code?: string;
    constructor(m?: string, code?: string) {
      super(m);
      this.code = code;
    }
  }
  return {
    api: { borrarReservaDefinitivo: vi.fn() },
    Errores: {
      ConflictError,
      SinPermisoError: class SinPermisoError extends Error {},
      SolicitudInvalidaError: class SolicitudInvalidaError extends Error {},
      TimeoutError: class TimeoutError extends Error {},
      ErrorTransitorio: class ErrorTransitorio extends Error {
        delServidor: boolean;
        constructor(m: string, delServidor = false) {
          super(m);
          this.delServidor = delServidor;
        }
      },
      NoEncontradoError: class NoEncontradoError extends Error {},
      UnauthorizedError: class UnauthorizedError extends Error {},
    },
  };
});

vi.mock('../../api/dashboardApi', () => ({
  borrarReservaDefinitivo: (...a: unknown[]) => api.borrarReservaDefinitivo(...a),
  ConflictError: Errores.ConflictError,
  SinPermisoError: Errores.SinPermisoError,
  NoEncontradoError: Errores.NoEncontradoError,
  UnauthorizedError: Errores.UnauthorizedError,
  SolicitudInvalidaError: Errores.SolicitudInvalidaError,
  TimeoutError: Errores.TimeoutError,
  ErrorTransitorio: Errores.ErrorTransitorio,
  SOLO_CANCELADAS: 'solo_canceladas',
  RESERVA_MODIFICADA: 'reserva_modificada',
  NOCHES_SIN_LIBERAR: 'noches_sin_liberar',
  DEMASIADOS_ITEMS: 'demasiados_items',
}));

import { BorrarReserva } from './BorrarReserva';

let container: HTMLDivElement;
let root: Root;
const onBorrada = vi.fn();
const onRecargar = vi.fn();
const onUnauthorized = vi.fn();

async function render() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <StrictMode>
        <BorrarReserva
          bookingId="bkg_9"
          resumen="All Inclusive · llega el 10 de noviembre de 2026 y se va el 15 de noviembre de 2026."
          textoAviso="Borraste definitivamente la reserva All Inclusive del 10 nov al 15 nov."
          onBorrada={onBorrada}
          onRecargar={onRecargar}
          onUnauthorized={onUnauthorized}
        />
      </StrictMode>,
    );
  });
}

const boton = (texto: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);
const dialogo = () => container.querySelector('[role="alertdialog"]');

async function abrir() {
  await act(async () => boton('Borrar definitivamente')!.click());
}

async function fallarCon(error: Error) {
  api.borrarReservaDefinitivo.mockRejectedValueOnce(error);
  await abrir();
  await act(async () => (dialogo()!.querySelector('.crm-btn-danger-filled') as HTMLButtonElement).click());
}

beforeEach(() => {
  api.borrarReservaDefinitivo.mockReset().mockResolvedValue({ BookingID: 'bkg_9', message: 'ok', borrados: 3 });
  onBorrada.mockReset();
  onRecargar.mockReset();
  onUnauthorized.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Borrar definitivamente: confirmación', () => {
  it('abre un diálogo accesible, irreversible, con programa y fechas y el foco en «Volver sin cambios»', async () => {
    await render();
    expect(dialogo()).toBeNull();
    await abrir();

    const d = dialogo()!;
    const titulo = container.querySelector(`#${CSS.escape(d.getAttribute('aria-labelledby')!)}`);
    expect(titulo?.textContent).toBe('¿Borrar definitivamente esta reserva?');
    const texto = container.querySelector(`#${CSS.escape(d.getAttribute('aria-describedby')!)}`)?.textContent ?? '';
    expect(texto).toContain('All Inclusive · llega el 10 de noviembre de 2026 y se va el 15 de noviembre de 2026.');
    expect(texto).toContain('no se puede recuperar');
    expect(texto).toContain('Desaparece del historial de reservas y de Ventas.');
    expect(d.textContent).toContain('No se puede deshacer');
    expect(document.activeElement).toBe(boton('Volver sin cambios'));
    expect(api.borrarReservaDefinitivo).not.toHaveBeenCalled();
  });

  it('«Volver sin cambios» cierra sin llamar al servidor y devuelve el foco al botón', async () => {
    await render();
    await abrir();
    await act(async () => boton('Volver sin cambios')!.click());
    expect(dialogo()).toBeNull();
    expect(document.activeElement).toBe(boton('Borrar definitivamente'));
    expect(api.borrarReservaDefinitivo).not.toHaveBeenCalled();
  });

  it('Escape cierra sin llamar al servidor y devuelve el foco al botón', async () => {
    await render();
    await abrir();
    await act(async () => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(dialogo()).toBeNull();
    expect(document.activeElement).toBe(boton('Borrar definitivamente'));
    expect(api.borrarReservaDefinitivo).not.toHaveBeenCalled();
  });

  it('confirmar llama a la API con el booking_id y avisa a la pantalla', async () => {
    await render();
    await abrir();
    await act(async () => (dialogo()!.querySelector('.crm-btn-danger-filled') as HTMLButtonElement).click());
    expect(api.borrarReservaDefinitivo).toHaveBeenCalledTimes(1);
    expect(api.borrarReservaDefinitivo).toHaveBeenCalledWith('bkg_9');
    expect(onBorrada).toHaveBeenCalledWith('bkg_9', 'Borraste definitivamente la reserva All Inclusive del 10 nov al 15 nov.');
  });
});

describe('Borrar definitivamente: errores', () => {
  it('409 reserva_modificada: pide recargar, no avisa de borrado y «Recargar» recarga', async () => {
    await render();
    await fallarCon(new Errores.ConflictError('La reserva cambió.', 'reserva_modificada'));
    const alerta = container.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain('Alguien cambió esta reserva');
    expect(alerta.textContent).toContain('no se borró nada');
    expect(onBorrada).not.toHaveBeenCalled();
    // Tras la falla el foco no cae al body: queda en el botón seguro.
    expect(document.activeElement).toBe(boton('Volver sin cambios'));
    await act(async () => boton('Recargar')!.click());
    expect(onRecargar).toHaveBeenCalledTimes(1);
    expect(dialogo()).toBeNull();
    // Recargar cierra el diálogo y devuelve el foco al botón que lo abrió.
    expect(document.activeElement).toBe(boton('Borrar definitivamente'));
  });

  it('409 solo_canceladas: explica que solo se borran las canceladas y ofrece recargar', async () => {
    await render();
    await fallarCon(new Errores.ConflictError('Solo canceladas.', 'solo_canceladas'));
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('solo se borran las canceladas');
    expect(boton('Recargar')).toBeTruthy();
    expect(onBorrada).not.toHaveBeenCalled();
  });

  it('403: muestra el motivo del rol, sin «Recargar», y el diálogo sigue abierto', async () => {
    await render();
    await fallarCon(new Errores.SinPermisoError('Tu rol no permite esta acción. Pídesela a un administrador de tu cuenta.'));
    const alerta = container.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toBe('No se borró. Tu rol no permite esta acción. Pídesela a un administrador de tu cuenta.');
    expect(boton('Recargar')).toBeUndefined();
    expect(dialogo()).not.toBeNull();
    expect(onBorrada).not.toHaveBeenCalled();
  });

  it('404: dice que ya no existe y ofrece recargar', async () => {
    await render();
    await fallarCon(new Errores.NoEncontradoError('No existe.'));
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('ya no existe');
    expect(boton('Recargar')).toBeTruthy();
  });

  it('409 noches_sin_liberar: manda a soporte, sin «Recargar»', async () => {
    await render();
    await fallarCon(new Errores.ConflictError('quedan noches tomadas', 'noches_sin_liberar'));
    const alerta = container.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain('quedan noches tomadas a nombre de esta reserva');
    expect(alerta.textContent).toContain('soporte de RockyBrand');
    expect(boton('Recargar')).toBeUndefined();
    expect(onBorrada).not.toHaveBeenCalled();
  });

  it('409 demasiados_items: manda a soporte, sin «Recargar»', async () => {
    await render();
    await fallarCon(new Errores.ConflictError('más de 99', 'demasiados_items'));
    const alerta = container.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain('demasiados registros');
    expect(alerta.textContent).toContain('soporte de RockyBrand');
    expect(boton('Recargar')).toBeUndefined();
  });

  it('400: texto propio, sin el mensaje técnico del servidor', async () => {
    await render();
    await fallarCon(new Errores.SolicitudInvalidaError('booking_id invalido: bkg_9'));
    const alerta = container.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain('no reconoce el identificador');
    expect(alerta.textContent).not.toContain('booking_id invalido');
  });

  it('500: texto propio, sin el mensaje técnico del servidor y sin «Recargar»', async () => {
    await render();
    await fallarCon(new Error('Internal server error: KeyError Items'));
    const alerta = container.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain('el servidor tuvo un problema');
    expect(alerta.textContent).not.toContain('KeyError');
    expect(boton('Recargar')).toBeUndefined();
  });

  it('tiempo agotado: puede que se haya borrado, ofrece recargar para confirmar', async () => {
    await render();
    await fallarCon(new Errores.TimeoutError('El panel tardó demasiado en responder.'));
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('Puede que se haya borrado; recarga para confirmar.');
    await act(async () => boton('Recargar')!.click());
    expect(onRecargar).toHaveBeenCalledTimes(1);
    expect(onBorrada).not.toHaveBeenCalled();
  });

  it('sin conexión: el mismo aviso de confirmar recargando', async () => {
    await render();
    await fallarCon(new Errores.ErrorTransitorio('No se pudo conectar con el panel.', false));
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('Puede que se haya borrado; recarga para confirmar.');
    expect(boton('Recargar')).toBeTruthy();
  });

  it('401: deja la sesión al AuthContext y no muestra error', async () => {
    await render();
    await fallarCon(new Errores.UnauthorizedError());
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
