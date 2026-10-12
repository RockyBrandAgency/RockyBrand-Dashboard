import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BerryMedio } from '../../types';
import { detalleMedio, formatearDuracion, formatearRestante, formatearTamano, MENSAJE_HEIC, revisarArchivo } from './formatos';
import { TarjetaMedio } from './TarjetaMedio';

// Qué afirma este archivo: cómo lee el cliente cada medio de Berry Studio (la
// línea de detalle, el peso, el aviso de demora y el error), y qué deja subir
// el navegador antes de pedirle nada al servidor (HEIC con el texto exacto
// del contrato, formatos y topes).

const AHORA = Date.parse('2026-10-12T18:00:00Z');

function medio(extra: Partial<BerryMedio> = {}): BerryMedio {
  return {
    id: 'm1',
    tipo: 'video',
    nombre: 'C0042_rio_simpson_amanecer_toma_larga.MOV',
    tamano: 182_400_000,
    estado: 'listo',
    etiqueta: 'Listo',
    creado: '2026-10-12T17:55:00Z',
    actualizado: '2026-10-12T17:58:00Z',
    detalle: { ancho: 1080, alto: 1920, ancho_original: 2160, alto_original: 3840, fps: 59.94, duracion_s: 109.4, hdr: 'hlg', codec: 'hevc', tramos: 3 },
    miniatura_url: 'https://cdn.test/m1.jpg',
    ver_url: 'https://cdn.test/m1.mp4',
    error: null,
    upload_id: null,
    ...extra,
  };
}

let container: HTMLDivElement;
let root: Root | null = null;

function render(m: BerryMedio, onAbrir = vi.fn(), extra: Partial<Parameters<typeof TarjetaMedio>[0]> = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  act(() => {
    r.render(<TarjetaMedio medio={m} ahora={AHORA} onAbrir={onAbrir} {...extra} />);
  });
  return onAbrir;
}

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  const r = root;
  if (!r) return;
  act(() => r.unmount());
  container.remove();
  root = null;
});

describe('detalle de un medio', () => {
  it('video, audio y foto dicen solo lo que trae el detalle', () => {
    // La resolución es la del original, no la del proxy de 1080p.
    expect(detalleMedio('video', { ancho: 1080, alto: 1920, ancho_original: 2160, alto_original: 3840, fps: 59.94, duracion_s: 109.4, hdr: 'hlg' })).toBe(
      '2160×3840 · 59,94 fps · 1:49 · HDR HLG',
    );
    // SDR: sin `hdr`. Sin original: la del proxy.
    expect(detalleMedio('video', { ancho: 1920, alto: 1080, fps: 29.97, duracion_s: 12 })).toBe('1920×1080 · 29,97 fps · 0:12');
    expect(detalleMedio('audio', { duracion_s: 151, frecuencia_hz: 48000, canales: 2, codec: 'pcm_s24le' })).toBe('2:31 · 48 kHz · estéreo');
    expect(detalleMedio('audio', { duracion_s: 3725, frecuencia_hz: 44100, canales: 1 })).toBe('1:02:05 · 44,1 kHz · mono');
    // El backend guarda 0 cuando ffprobe no midió: no se dice.
    expect(detalleMedio('audio', { duracion_s: 20, frecuencia_hz: 0, canales: 0 })).toBe('0:20');
    expect(detalleMedio('foto', { ancho: 2048, alto: 1365, ancho_original: 6000, alto_original: 4000, orientacion: 1 })).toBe('6000×4000');
    expect(detalleMedio('video', null)).toBe('');
  });

  it('pesos, duraciones y tiempo restante en palabras cortas', () => {
    expect(formatearTamano(182_400_000)).toBe('182,4 MB');
    expect(formatearTamano(4_500_000_000)).toBe('4,5 GB');
    expect(formatearDuracion(59.6)).toBe('1:00');
    expect(formatearRestante(42)).toBe('quedan 42 s');
    expect(formatearRestante(185)).toBe('quedan 3 min');
    expect(formatearRestante(4800)).toBe('quedan 1 h 20 min');
  });
});

describe('revisión antes de subir', () => {
  it('HEIC se rechaza con el texto exacto del contrato', () => {
    expect(revisarArchivo({ name: 'IMG_0001.HEIC', size: 3_000_000, type: 'image/heic' })).toEqual({ ok: false, error: MENSAJE_HEIC });
    expect(revisarArchivo({ name: 'IMG_0002.heif', size: 3_000_000, type: '' })).toEqual({ ok: false, error: MENSAJE_HEIC });
    expect(MENSAJE_HEIC).toBe('Las fotos HEIC llegan en la fase 2. Por ahora, expórtala como JPEG (Fotos › Archivo › Exportar).');
  });

  it('acepta los formatos del contrato y pone el MIME que falte', () => {
    expect(revisarArchivo({ name: 'C0042.MOV', size: 10, type: 'video/quicktime' })).toEqual({ ok: true, tipo: 'video', mime: 'video/quicktime' });
    expect(revisarArchivo({ name: 'IMG_1.CR2', size: 10, type: '' })).toEqual({ ok: true, tipo: 'foto', mime: 'image/x-canon-cr2' });
    expect(revisarArchivo({ name: 'toma.m4a', size: 10, type: '' })).toEqual({ ok: true, tipo: 'audio', mime: 'audio/mp4' });
  });

  it('rechaza formatos ajenos, archivos vacíos y lo que pasa del tope', () => {
    expect(revisarArchivo({ name: 'guion.pdf', size: 10, type: 'application/pdf' }).ok).toBe(false);
    expect(revisarArchivo({ name: 'clip.mp4', size: 0, type: 'video/mp4' })).toEqual({ ok: false, error: 'El archivo está vacío.' });
    expect(revisarArchivo({ name: 'foto.jpg', size: 201 * 1024 ** 2, type: 'image/jpeg' })).toEqual({
      ok: false,
      error: 'Una foto puede pesar hasta 200 MB.',
    });
    expect(revisarArchivo({ name: 'largo.mov', size: 20 * 1024 ** 3, type: 'video/quicktime' }).ok).toBe(true);
  });
});

describe('TarjetaMedio', () => {
  it('un medio listo es un botón que abre el visor, con su miniatura diferida y su detalle', () => {
    const onAbrir = render(medio());
    const boton = container.querySelector('button');
    expect(boton?.getAttribute('aria-label')).toBe('Ver C0042_rio_simpson_amanecer_toma_larga.MOV');
    const img = container.querySelector('img');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.style.objectFit).toBe('contain');
    expect(container.textContent).toContain('2160×3840 · 59,94 fps · 1:49 · HDR HLG · 182,4 MB');
    expect(container.textContent).toContain('hace 5 minutos');
    act(() => boton!.click());
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), boton);
  });

  it('preparando hace más de 30 min avisa la demora y no se abre', () => {
    render(
      medio({
        estado: 'preparando',
        etiqueta: 'Preparando: 2 de 4 tramos',
        actualizado: '2026-10-12T17:20:00Z',
        miniatura_url: null,
        ver_url: null,
      }),
    );
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('Preparando: 2 de 4 tramos');
    expect(container.textContent).toContain('Se está demorando más de lo normal');
  });

  it('preparando hace poco no avisa nada', () => {
    render(medio({ estado: 'preparando', etiqueta: 'Preparando', miniatura_url: null, ver_url: null }));
    expect(container.textContent).not.toContain('demorando');
  });

  it('un error muestra el motivo que manda el backend', () => {
    render(medio({ estado: 'error', etiqueta: 'No se pudo preparar', error: 'El archivo está dañado.', ver_url: null }));
    expect(container.textContent).toContain('El archivo está dañado.');
    expect(container.querySelector('button')).toBeNull();
  });

  it('un audio no muestra miniatura sino su ícono', () => {
    render(medio({ tipo: 'audio', nombre: 'ambiente.wav', detalle: { duracion_s: 151, frecuencia_hz: 48000, canales: 2 }, miniatura_url: null }));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toContain('2:31 · 48 kHz · estéreo');
  });

  it('subiendo sin nadie que la suba es una «Subida a medias» que se puede quitar', () => {
    const onQuitar = vi.fn();
    const m = medio({ estado: 'subiendo', etiqueta: 'Subiendo', upload_id: 'u-9', miniatura_url: null, ver_url: null, detalle: null });
    render(m, vi.fn(), { onQuitar, reanudable: true });
    expect(container.textContent).toContain('Subida a medias');
    expect(container.textContent).toContain('Para seguirla, vuelve a elegir el mismo archivo.');
    const quitar = container.querySelector<HTMLButtonElement>('button[aria-label^="Quitar la subida a medias"]');
    act(() => quitar!.click());
    expect(onQuitar).toHaveBeenCalledWith(m);
  });

  it('subiendo desde esta pestaña muestra la etiqueta del backend y no se puede quitar', () => {
    render(medio({ estado: 'subiendo', etiqueta: 'Subiendo', upload_id: 'u-9', ver_url: null }), vi.fn(), { aqui: true, onQuitar: vi.fn() });
    expect(container.textContent).toContain('Subiendo');
    expect(container.textContent).not.toContain('a medias');
    expect(container.querySelector('button')).toBeNull();
  });
});
