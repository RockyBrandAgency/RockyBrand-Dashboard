import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BerryMedio } from '../../types';
import {
  claveReanudacion,
  crearSubida,
  planPartes,
  SubidaCancelada,
  SubidaPausada,
  type Almacen,
  type ApiSubida,
  type OpcionesMotor,
} from './motorSubida';

// Qué afirma este archivo: que el motor de Berry Studio sube un archivo a S3
// tal como dice el contrato de la fase 1. Cada parte con su tramo exacto, sin
// cabeceras propias, a lo más 4 a la vez; URLs de a lotes de 50 pedidas antes
// de que se acaben y renovadas al vencer o con un 403; 3 reintentos con
// espera creciente; retomar saltándose lo que S3 ya tiene; `completar` con
// todas las partes en orden; un `completar` que ya pasó en el servidor no se
// sube de nuevo; cancelar que corta y avisa. Sin red: el XHR, la
// API, el reloj y el almacenamiento son falsos.

type Respuesta = { status: number; etag?: string | null } | 'error' | 'colgar';

class XhrFalso {
  static creados: XhrFalso[] = [];
  static enVuelo = 0;
  static maxEnVuelo = 0;
  static responder: (x: XhrFalso) => Respuesta | Promise<Respuesta> = (x) => ({ status: 200, etag: `"etag-${x.parte()}"` });

  method = '';
  url = '';
  status = 0;
  headers: Record<string, string> = {};
  cuerpo: Blob | null = null;
  abortado = false;
  etag: string | null = null;
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    XhrFalso.creados.push(this);
  }

  parte(): number {
    return Number(new URL(this.url).pathname.replace('/p', ''));
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }

  getResponseHeader(nombre: string) {
    return nombre.toLowerCase() === 'etag' ? this.etag : null;
  }

  send(cuerpo: Blob) {
    this.cuerpo = cuerpo;
    XhrFalso.enVuelo++;
    XhrFalso.maxEnVuelo = Math.max(XhrFalso.maxEnVuelo, XhrFalso.enVuelo);
    void (async () => {
      const r = await XhrFalso.responder(this);
      if (r === 'colgar' || this.abortado) return;
      XhrFalso.enVuelo--;
      this.upload.onprogress?.({ loaded: cuerpo.size } as ProgressEvent);
      if (r === 'error') {
        this.onerror?.();
        return;
      }
      this.status = r.status;
      this.etag = r.etag ?? null;
      this.onload?.();
    })();
  }

  abort() {
    if (this.abortado) return;
    this.abortado = true;
    XhrFalso.enVuelo--;
    this.onabort?.();
  }
}

function almacenEnMemoria(inicial: Record<string, string> = {}): Almacen & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => {
      datos[k] = v;
    },
    removeItem: (k) => {
      delete datos[k];
    },
  };
}

const MEDIO = { id: 'm1', estado: 'preparando' } as BerryMedio;

let reloj = 0;
let firmas = 0;
const firmadaEn = new Map<string, number>();

function apiFalsa(parteBytes: number, venceEn = 800) {
  return {
    iniciar: vi.fn(async (b: { tamano: number }) => ({
      id: 'm1',
      upload_id: 'u1',
      tipo: 'video' as const,
      parte_bytes: parteBytes,
      partes: Math.ceil(b.tamano / parteBytes),
    })),
    firmar: vi.fn(async (b: { numeros: number[]; listar?: boolean }) => {
      firmas++;
      const urls: Record<string, string> = {};
      for (const n of b.numeros) {
        const url = `https://s3.test/p${n}?v=${firmas}`;
        urls[String(n)] = url;
        firmadaEn.set(url, reloj);
      }
      return { urls, vence_en: venceEn };
    }),
    completar: vi.fn(async (_b: Parameters<ApiSubida['completar']>[0]) => ({ medio: MEDIO })),
    cancelar: vi.fn(async (_b: Parameters<ApiSubida['cancelar']>[0]) => ({ ok: true as const })),
    buscarMedio: vi.fn(async (_id: string): Promise<BerryMedio | null> => null),
  } satisfies ApiSubida;
}

function archivo(tamano: number, nombre = 'clip.mov'): File {
  return new File([new Uint8Array(tamano)], nombre, { type: 'video/quicktime', lastModified: 1_700_000_000_000 });
}

function opciones(api: ApiSubida, extra: Partial<OpcionesMotor> = {}): OpcionesMotor {
  return {
    api,
    parteBytesPorDefecto: 10,
    almacen: almacenEnMemoria(),
    ahora: () => reloj,
    esperar: vi.fn(async (_ms: number) => undefined),
    crearXhr: () => new XhrFalso() as unknown as XMLHttpRequest,
    ...extra,
  };
}

beforeEach(() => {
  XhrFalso.creados = [];
  XhrFalso.enVuelo = 0;
  XhrFalso.maxEnVuelo = 0;
  XhrFalso.responder = (x) => ({ status: 200, etag: `"etag-${x.parte()}"` });
  reloj = 0;
  firmas = 0;
  firmadaEn.clear();
});

describe('planPartes', () => {
  it('parte n va de (n-1)*parte a n*parte y la última se acorta', () => {
    expect(planPartes(40, 16)).toEqual([
      { numero: 1, inicio: 0, fin: 16 },
      { numero: 2, inicio: 16, fin: 32 },
      { numero: 3, inicio: 32, fin: 40 },
    ]);
    expect(planPartes(32, 16)).toHaveLength(2);
    expect(planPartes(0, 16)).toEqual([]);
    // 20 GB en partes de 16 MiB: muy por debajo del tope de 10.000 de S3.
    expect(planPartes(20 * 1024 ** 3, 16 * 1024 ** 2)).toHaveLength(1280);
  });
});

describe('crearSubida', () => {
  it('sube cada parte con su tramo exacto, sin cabeceras, 4 a la vez, y completa en orden', async () => {
    const api = apiFalsa(10);
    // Las partes altas terminan primero: el orden de llegada no es el de completar.
    XhrFalso.responder = async (x) => {
      await new Promise((r) => setTimeout(r, 12 - x.parte()));
      return { status: 200, etag: `"etag-${x.parte()}"` };
    };
    const almacen = almacenEnMemoria();
    const progreso: number[] = [];
    const s = crearSubida(archivo(95), 'video/quicktime', opciones(api, { almacen, alProgreso: (b) => progreso.push(b) }));

    await expect(s.resultado).resolves.toBe(MEDIO);

    expect(api.iniciar).toHaveBeenCalledWith({ nombre: 'clip.mov', tamano: 95, tipo_mime: 'video/quicktime' });
    // Diez partes caben en un solo lote.
    expect(api.firmar).toHaveBeenCalledTimes(1);
    expect(XhrFalso.creados).toHaveLength(10);
    for (const x of XhrFalso.creados) {
      expect(x.method).toBe('PUT');
      expect(x.headers).toEqual({});
      expect(x.cuerpo?.size).toBe(x.parte() === 10 ? 5 : 10);
      expect(x.cuerpo?.type).toBe('');
    }
    expect(XhrFalso.maxEnVuelo).toBeLessThanOrEqual(4);
    expect(XhrFalso.maxEnVuelo).toBeGreaterThan(1);
    expect(api.completar).toHaveBeenCalledTimes(1);
    expect(api.completar.mock.calls[0][0]).toEqual({
      id: 'm1',
      upload_id: 'u1',
      partes: Array.from({ length: 10 }, (_, i) => ({ numero: i + 1, etag: `"etag-${i + 1}"` })),
    });
    expect(progreso.at(-1)).toBe(95);
    // Completada, la clave para retomar ya no sirve.
    expect(almacen.datos).toEqual({});
  });

  it('pide URLs de a lotes de 50 como máximo, y el siguiente antes de que se acaben', async () => {
    const api = apiFalsa(1);
    const iniciadosAlFirmar: number[] = [];
    api.firmar.mockImplementation(async (b) => {
      iniciadosAlFirmar.push(XhrFalso.creados.length);
      firmas++;
      return { urls: Object.fromEntries(b.numeros.map((n) => [String(n), `https://s3.test/p${n}?v=${firmas}`])), vence_en: 800 };
    });
    const s = crearSubida(archivo(120), 'video/quicktime', opciones(api));
    await s.resultado;

    const lotes = api.firmar.mock.calls.map((c) => c[0].numeros);
    expect(lotes.every((l) => l.length >= 1 && l.length <= 50)).toBe(true);
    expect(lotes.map((l) => l.length)).toEqual([50, 50, 20]);
    // El segundo lote se pidió con partes del primero todavía sin empezar.
    expect(iniciadosAlFirmar[1]).toBeLessThan(50);
    // Cada parte se subió una sola vez y con una URL firmada para ella.
    const partes = XhrFalso.creados.map((x) => x.parte()).sort((a, b) => a - b);
    expect(partes).toEqual(Array.from({ length: 120 }, (_, i) => i + 1));
    expect(api.completar.mock.calls[0][0].partes).toHaveLength(120);
  });

  it('no usa una URL a menos de 60 s de vencer: la vuelve a pedir', async () => {
    const api = apiFalsa(10, 100); // vale 100 s → se usa hasta los 40 s
    const vencidas: string[] = [];
    XhrFalso.responder = (x) => {
      if (reloj >= (firmadaEn.get(x.url) ?? -Infinity) + 40_000) vencidas.push(x.url);
      reloj += 15_000;
      return { status: 200, etag: `"etag-${x.parte()}"` };
    };
    const s = crearSubida(archivo(60), 'video/quicktime', opciones(api, { paralelo: 1 }));
    await s.resultado;

    expect(vencidas).toEqual([]);
    expect(api.firmar.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(XhrFalso.creados).toHaveLength(6);
  });

  it('un 403 de S3 es una URL vencida: firma de nuevo sin esperar y reintenta', async () => {
    const api = apiFalsa(10);
    let primera = true;
    XhrFalso.responder = (x) => {
      if (x.parte() === 2 && primera) {
        primera = false;
        return { status: 403 };
      }
      return { status: 200, etag: `"etag-${x.parte()}"` };
    };
    const esperar = vi.fn(async (_ms: number) => undefined);
    const s = crearSubida(archivo(30), 'video/quicktime', opciones(api, { esperar }));
    await s.resultado;

    const urlsParte2 = XhrFalso.creados.filter((x) => x.parte() === 2).map((x) => x.url);
    expect(urlsParte2).toHaveLength(2);
    expect(urlsParte2[0]).not.toBe(urlsParte2[1]);
    expect(api.firmar.mock.calls.length).toBe(2);
    expect(esperar).not.toHaveBeenCalled();
  });

  it('reintenta una parte hasta 3 veces con espera creciente', async () => {
    const api = apiFalsa(10);
    const fallas: Respuesta[] = ['error', { status: 500 }, 'error'];
    XhrFalso.responder = (x) => (x.parte() === 1 && fallas.length ? fallas.shift()! : { status: 200, etag: `"etag-${x.parte()}"` });
    const esperar = vi.fn(async (_ms: number) => undefined);
    const s = crearSubida(archivo(20), 'video/quicktime', opciones(api, { esperar }));

    await expect(s.resultado).resolves.toBe(MEDIO);
    expect(esperar.mock.calls.map((c) => c[0])).toEqual([1000, 2000, 4000]);
    expect(XhrFalso.creados.filter((x) => x.parte() === 1)).toHaveLength(4);
  });

  it('a la cuarta falla de una parte se rinde, corta las demás y conserva la clave para retomar', async () => {
    const api = apiFalsa(10);
    XhrFalso.responder = (x) => (x.parte() === 1 ? 'error' : { status: 200, etag: `"etag-${x.parte()}"` });
    const almacen = almacenEnMemoria();
    const s = crearSubida(archivo(50), 'video/quicktime', opciones(api, { almacen }));

    await expect(s.resultado).rejects.toThrow('Se cortó la subida');
    expect(api.completar).not.toHaveBeenCalled();
    expect(almacen.datos[claveReanudacion(archivo(50))]).toBe(JSON.stringify({ id: 'm1', upload_id: 'u1' }));
  });

  it('un PUT sin ETag (CORS sin exponerlo) falla de inmediato, sin reintentar', async () => {
    const api = apiFalsa(10);
    XhrFalso.responder = () => ({ status: 200, etag: null });
    const s = crearSubida(archivo(10), 'video/quicktime', opciones(api));
    await expect(s.resultado).rejects.toThrow('No se pudo confirmar la parte 1');
    expect(XhrFalso.creados).toHaveLength(1);
  });

  it('retoma: lista lo que S3 ya tiene y sube solo lo que falta', async () => {
    const api = apiFalsa(10);
    api.firmar.mockImplementation(async (b) => ({
      urls: Object.fromEntries(b.numeros.map((n) => [String(n), `https://s3.test/p${n}?v=1`])),
      vence_en: 800,
      ...(b.listar ? { subidas: [{ numero: 1, etag: '"e1"' }, { numero: 3, etag: '"e3"' }] } : {}),
    }));
    const f = archivo(40);
    const almacen = almacenEnMemoria({ [claveReanudacion(f)]: JSON.stringify({ id: 'm1', upload_id: 'u1' }) });
    const progreso: number[] = [];
    const s = crearSubida(f, 'video/quicktime', opciones(api, { almacen, alProgreso: (b) => progreso.push(b) }));
    await s.resultado;

    expect(api.iniciar).not.toHaveBeenCalled();
    expect(api.firmar.mock.calls[0][0]).toMatchObject({ id: 'm1', upload_id: 'u1', listar: true });
    expect(XhrFalso.creados.map((x) => x.parte()).sort()).toEqual([2, 4]);
    // Lo ya subido cuenta desde el principio.
    expect(progreso[0]).toBe(20);
    expect(api.completar.mock.calls[0][0].partes).toEqual([
      { numero: 1, etag: '"e1"' },
      { numero: 2, etag: '"etag-2"' },
      { numero: 3, etag: '"e3"' },
      { numero: 4, etag: '"etag-4"' },
    ]);
    expect(almacen.datos).toEqual({});
  });

  it('si la subida anterior ya no existe, empieza de cero', async () => {
    const api = apiFalsa(10);
    const original = api.firmar.getMockImplementation()!;
    api.firmar.mockImplementation(async (b) => {
      if (b.listar) throw new Error('La subida no existe.');
      return original(b);
    });
    const f = archivo(20);
    const almacen = almacenEnMemoria({ [claveReanudacion(f)]: JSON.stringify({ id: 'viejo', upload_id: 'u0' }) });
    const s = crearSubida(f, 'video/quicktime', opciones(api, { almacen }));
    await s.resultado;

    expect(api.buscarMedio).toHaveBeenCalledWith('viejo');
    expect(api.iniciar).toHaveBeenCalledTimes(1);
    expect(api.completar.mock.calls[0][0]).toMatchObject({ id: 'm1', upload_id: 'u1' });
  });

  it('al retomar, si el servidor ya la cerró y la biblioteca la trae preparando, no sube nada', async () => {
    const api = apiFalsa(10);
    api.firmar.mockRejectedValue(new Error('Esa subida ya se cerró o se canceló.'));
    api.buscarMedio.mockResolvedValue({ id: 'm1', estado: 'preparando' } as BerryMedio);
    const f = archivo(20);
    const almacen = almacenEnMemoria({ [claveReanudacion(f)]: JSON.stringify({ id: 'm1', upload_id: 'u1' }) });
    const s = crearSubida(f, 'video/quicktime', opciones(api, { almacen }));

    await expect(s.resultado).resolves.toMatchObject({ id: 'm1', estado: 'preparando' });
    expect(api.buscarMedio).toHaveBeenCalledWith('m1');
    expect(api.iniciar).not.toHaveBeenCalled();
    expect(XhrFalso.creados).toHaveLength(0);
    expect(api.completar).not.toHaveBeenCalled();
    expect(almacen.datos).toEqual({});
  });

  it('si completar falla pero el medio ya no está subiendo, lo da por cerrado', async () => {
    const api = apiFalsa(10);
    api.completar.mockRejectedValue(new Error('Esa subida ya se cerró o se canceló.'));
    api.buscarMedio.mockResolvedValue({ id: 'm1', estado: 'listo' } as BerryMedio);
    const almacen = almacenEnMemoria();
    const s = crearSubida(archivo(20), 'video/quicktime', opciones(api, { almacen }));

    await expect(s.resultado).resolves.toMatchObject({ id: 'm1', estado: 'listo' });
    expect(api.completar).toHaveBeenCalledTimes(1);
    expect(almacen.datos).toEqual({});
  });

  it('si completar falla y el medio sigue subiendo, falla y conserva la clave para retomar', async () => {
    const api = apiFalsa(10);
    api.completar.mockRejectedValue(new Error('sin respuesta'));
    api.buscarMedio.mockResolvedValue({ id: 'm1', estado: 'subiendo' } as BerryMedio);
    const f = archivo(20);
    const almacen = almacenEnMemoria();
    const s = crearSubida(f, 'video/quicktime', opciones(api, { almacen }));

    await expect(s.resultado).rejects.toThrow('sin respuesta');
    expect(almacen.datos[claveReanudacion(f)]).toBe(JSON.stringify({ id: 'm1', upload_id: 'u1' }));
  });

  it('si la biblioteca tampoco responde, completar falla con su propio error', async () => {
    const api = apiFalsa(10);
    api.completar.mockRejectedValue(new Error('sin respuesta'));
    api.buscarMedio.mockRejectedValue(new Error('biblioteca caída'));
    const s = crearSubida(archivo(20), 'video/quicktime', opciones(api));
    await expect(s.resultado).rejects.toThrow('sin respuesta');
  });

  it('con la sesión vencida en completar no consulta la biblioteca', async () => {
    const api = apiFalsa(10);
    class SinSesion extends Error {}
    api.completar.mockRejectedValue(new SinSesion('expiró'));
    const s = crearSubida(archivo(20), 'video/quicktime', opciones(api, {
      clasificar: (e) => (e instanceof SinSesion ? 'fatal' : 'rechazo'),
    }));
    await expect(s.resultado).rejects.toThrow('expiró');
    expect(api.buscarMedio).not.toHaveBeenCalled();
  });

  it('una falla pasajera al retomar no tira lo subido: falla y conserva la clave', async () => {
    const api = apiFalsa(10);
    class Pasajera extends Error {}
    api.firmar.mockRejectedValue(new Pasajera('sin red'));
    const f = archivo(20);
    const clave = claveReanudacion(f);
    const almacen = almacenEnMemoria({ [clave]: JSON.stringify({ id: 'm1', upload_id: 'u1' }) });
    const s = crearSubida(f, 'video/quicktime', opciones(api, {
      almacen,
      clasificar: (e) => (e instanceof Pasajera ? 'reintentar' : 'rechazo'),
    }));

    await expect(s.resultado).rejects.toThrow('sin red');
    expect(api.firmar).toHaveBeenCalledTimes(4);
    expect(api.iniciar).not.toHaveBeenCalled();
    expect(almacen.datos[clave]).toBeDefined();
  });

  it('cancelar corta los PUT en curso, avisa al servidor y borra la clave', async () => {
    const api = apiFalsa(10);
    XhrFalso.responder = () => 'colgar';
    const almacen = almacenEnMemoria();
    const s = crearSubida(archivo(100), 'video/quicktime', opciones(api, { almacen }));
    await vi.waitFor(() => expect(XhrFalso.creados.length).toBe(4));

    await s.cancelar();

    await expect(s.resultado).rejects.toBeInstanceOf(SubidaCancelada);
    expect(XhrFalso.creados.every((x) => x.abortado)).toBe(true);
    expect(api.cancelar).toHaveBeenCalledWith({ id: 'm1', upload_id: 'u1' });
    expect(api.completar).not.toHaveBeenCalled();
    expect(almacen.datos).toEqual({});
  });

  it('pausar corta los PUT y conserva la clave; reanudar sigue con la misma subida', async () => {
    const api = apiFalsa(10);
    // Las partes 1 y 2 suben; el resto queda colgado hasta la pausa.
    XhrFalso.responder = (x) => (x.parte() <= 2 ? { status: 200, etag: `"etag-${x.parte()}"` } : 'colgar');
    const almacen = almacenEnMemoria();
    const f = archivo(50);
    const s = crearSubida(f, 'video/quicktime', opciones(api, { almacen }));
    await vi.waitFor(() => expect(XhrFalso.creados.length).toBe(5));

    await s.pausar();

    await expect(s.resultado).rejects.toBeInstanceOf(SubidaPausada);
    expect(XhrFalso.creados.filter((x) => x.parte() > 2).every((x) => x.abortado)).toBe(true);
    expect(api.cancelar).not.toHaveBeenCalled();
    expect(almacen.datos[claveReanudacion(f)]).toBe(JSON.stringify({ id: 'm1', upload_id: 'u1' }));

    // Reanudar: el servidor dice que la 1 y la 2 ya están.
    const original = api.firmar.getMockImplementation()!;
    api.firmar.mockImplementation(async (b) => ({
      ...(await original(b)),
      ...(b.listar ? { subidas: [{ numero: 1, etag: '"etag-1"' }, { numero: 2, etag: '"etag-2"' }] } : {}),
    }));
    XhrFalso.creados = [];
    XhrFalso.responder = (x) => ({ status: 200, etag: `"etag-${x.parte()}"` });
    const otra = crearSubida(f, 'video/quicktime', opciones(api, { almacen }));
    await otra.resultado;

    expect(api.iniciar).toHaveBeenCalledTimes(1);
    expect(XhrFalso.creados.map((x) => x.parte()).sort()).toEqual([3, 4, 5]);
    expect(api.completar.mock.calls[0][0].partes.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5]);
    expect(almacen.datos).toEqual({});
  });

  it('cancelar una subida en pausa sí avisa al servidor y borra la clave', async () => {
    const api = apiFalsa(10);
    XhrFalso.responder = () => 'colgar';
    const almacen = almacenEnMemoria();
    const s = crearSubida(archivo(30), 'video/quicktime', opciones(api, { almacen }));
    await vi.waitFor(() => expect(XhrFalso.creados.length).toBe(3));
    await s.pausar();
    await s.cancelar();
    expect(api.cancelar).toHaveBeenCalledWith({ id: 'm1', upload_id: 'u1' });
    expect(almacen.datos).toEqual({});
  });

  it('sube igual si localStorage lanza en cada acceso', async () => {
    const api = apiFalsa(10);
    const roto: Almacen = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const s = crearSubida(archivo(25), 'video/quicktime', opciones(api, { almacen: roto }));
    await expect(s.resultado).resolves.toBe(MEDIO);
  });
});
