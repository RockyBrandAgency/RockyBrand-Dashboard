import type { BerryMedio, BerryParteSubida, BerryPartesFirmadas, BerrySubidaIniciada } from '../../types';

// Motor de subida de Berry Studio: un archivo, del navegador a S3, por partes.
//
// Sin React y sin la API real adentro: todo lo que toca el mundo (las cinco
// llamadas al panel, el XHR, el reloj, la espera y localStorage) entra por
// `OpcionesMotor`, así las pruebas lo ejercitan entero sin red.
//
// Cómo sube (contrato de la fase 1):
// 1. Si este mismo archivo quedó a medias (clave en localStorage), pide a
//    `partes` con `listar: true` cuáles ya están en S3 y se las salta. Si el
//    servidor ya no la tiene abierta, mira la biblioteca: si el medio ya no
//    está «subiendo», un `completar` anterior pasó aunque su respuesta no
//    llegó, y la da por cerrada. Si no está, empieza de cero.
// 2. Si no, `iniciar` crea la subida y devuelve `parte_bytes`.
// 3. Pide URLs firmadas de a lotes de 50 como máximo, y el lote siguiente
//    antes de que se acaben. Una URL a menos de 60 s de vencer no se usa.
// 4. Sube 4 partes a la vez con XHR (el progreso de `fetch` no existe en
//    Safari). Cada parte tiene 3 reintentos con espera creciente; un 403 de
//    S3 es una URL vencida: se firma de nuevo sin esperar.
// 5. `completar` con todas las partes en orden. Recién ahí se borra la clave.
//    Si falla (un 409, o la respuesta no llega), mira la biblioteca igual que
//    al retomar antes de darlo por error: subir 20 GB de nuevo es peor.
//
// Pausar corta los PUT y deja la clave: reanudar es crear otra subida con el
// mismo File, que retoma por el paso 1. Cancelar además avisa al servidor y
// borra la clave.

export interface ApiSubida {
  iniciar(body: { nombre: string; tamano: number; tipo_mime: string }): Promise<BerrySubidaIniciada>;
  firmar(body: { id: string; upload_id: string; numeros: number[]; listar?: boolean }): Promise<BerryPartesFirmadas>;
  completar(body: { id: string; upload_id: string; partes: BerryParteSubida[] }): Promise<{ medio: BerryMedio }>;
  cancelar(body: { id: string; upload_id: string }): Promise<{ ok: true }>;
  /** El medio como lo trae la biblioteca, o null si no está. */
  buscarMedio(id: string): Promise<BerryMedio | null>;
}

/** Lo mínimo de `Storage` que usa el motor. */
export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

export type FaseMotor = 'iniciando' | 'subiendo' | 'completando';

/**
 * Cómo leer un error de la API:
 * - 'reintentar': red, timeout o 5xx; puede no repetirse.
 * - 'fatal': no tiene sentido seguir (sesión vencida).
 * - 'rechazo': el servidor dijo que no (4xx); al retomar, significa que la
 *   subida anterior ya no existe.
 */
export type ClaseError = 'reintentar' | 'fatal' | 'rechazo';

export interface OpcionesMotor {
  api: ApiSubida;
  /** Tamaño de parte para retomar (el de la biblioteca); al iniciar manda el del servidor. */
  parteBytesPorDefecto: number;
  almacen?: Almacen;
  paralelo?: number;
  maxReintentos?: number;
  tamanoLote?: number;
  margenVencimientoS?: number;
  ahora?: () => number;
  esperar?: (ms: number) => Promise<void>;
  clasificar?: (e: unknown) => ClaseError;
  crearXhr?: () => XMLHttpRequest;
  alProgreso?: (bytesSubidos: number) => void;
  alFase?: (fase: FaseMotor) => void;
}

export interface SubidaEnCurso {
  resultado: Promise<BerryMedio>;
  /** Corta los PUT, avisa al servidor y olvida la clave para retomar. */
  cancelar(): Promise<void>;
  /** Corta los PUT y conserva la clave: lo subido queda para retomar. */
  pausar(): Promise<void>;
}

export class SubidaCancelada extends Error {
  constructor() {
    super('Subida cancelada.');
  }
}

export class SubidaPausada extends Error {
  constructor() {
    super('Subida en pausa.');
  }
}

export class ErrorParte extends Error {
  status: number;
  sinEtag: boolean;
  constructor(status: number, sinEtag = false) {
    super(sinEtag ? 'S3 no devolvió el ETag de la parte.' : `S3 respondió ${status}.`);
    this.status = status;
    this.sinEtag = sinEtag;
  }
}

export const PREFIJO_CLAVE = 'berry-subida:';

export function claveReanudacion(a: { name: string; size: number; lastModified: number }): string {
  return `${PREFIJO_CLAVE}${a.name}:${a.size}:${a.lastModified}`;
}

/** localStorage envuelto: en modo privado o con el almacenamiento bloqueado
 *  cualquier acceso puede lanzar, y eso no puede tumbar una subida. */
export const almacenNavegador: Almacen = {
  getItem(clave) {
    try {
      return window.localStorage.getItem(clave);
    } catch {
      return null;
    }
  },
  setItem(clave, valor) {
    try {
      window.localStorage.setItem(clave, valor);
    } catch {
      // Sin almacenamiento la subida sigue; solo no se podrá retomar.
    }
  },
  removeItem(clave) {
    try {
      window.localStorage.removeItem(clave);
    } catch {
      // Nada que limpiar si no hay almacenamiento.
    }
  },
};

interface Ids {
  id: string;
  upload_id: string;
}

export function leerReanudacion(almacen: Almacen, clave: string): Ids | null {
  try {
    const crudo = almacen.getItem(clave);
    if (!crudo) return null;
    const v = JSON.parse(crudo) as Partial<Ids>;
    if (typeof v.id === 'string' && v.id && typeof v.upload_id === 'string' && v.upload_id) {
      return { id: v.id, upload_id: v.upload_id };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Las claves de este navegador que apuntan a un medio. La clave lleva
 * `lastModified`, que el servidor no conoce: se busca por nombre y tamaño y
 * se confirma con el id guardado.
 */
export function clavesDelMedio(m: { id: string; nombre: string; tamano: number }): string[] {
  const prefijo = `${PREFIJO_CLAVE}${m.nombre}:${m.tamano}:`;
  const halladas: string[] = [];
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const clave = ls.key(i);
      if (clave?.startsWith(prefijo) && leerReanudacion(almacenNavegador, clave)?.id === m.id) halladas.push(clave);
    }
  } catch {
    // Sin almacenamiento no hay nada que retomar.
  }
  return halladas;
}

export function olvidarMedio(m: { id: string; nombre: string; tamano: number }): void {
  for (const clave of clavesDelMedio(m)) almacenNavegador.removeItem(clave);
}

function guardarReanudacion(almacen: Almacen, clave: string, ids: Ids): void {
  try {
    almacen.setItem(clave, JSON.stringify({ id: ids.id, upload_id: ids.upload_id }));
  } catch {
    // Ver almacenNavegador.
  }
}

function borrarReanudacion(almacen: Almacen, clave: string): void {
  try {
    almacen.removeItem(clave);
  } catch {
    // Ver almacenNavegador.
  }
}

export interface Parte {
  numero: number;
  inicio: number;
  fin: number;
}

/** Partes de 1 en adelante: la n va de (n-1)*parteBytes a n*parteBytes. */
export function planPartes(tamano: number, parteBytes: number): Parte[] {
  if (tamano <= 0 || parteBytes <= 0) return [];
  const cantidad = Math.ceil(tamano / parteBytes);
  return Array.from({ length: cantidad }, (_, i) => ({
    numero: i + 1,
    inicio: i * parteBytes,
    fin: Math.min((i + 1) * parteBytes, tamano),
  }));
}

/**
 * PUT de una parte a su URL firmada. Sin `Authorization` y sin
 * `Content-Type` (un `slice` sin tipo no lo agrega): la firma ya lo dice todo.
 * Resuelve con el ETag tal cual lo manda S3, comillas incluidas.
 */
export function putParte(
  url: string,
  cuerpo: Blob,
  alProgreso: (cargados: number) => void,
  senal: AbortSignal,
  crearXhr: () => XMLHttpRequest = () => new XMLHttpRequest(),
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (senal.aborted) {
      reject(new SubidaCancelada());
      return;
    }
    const xhr = crearXhr();
    const alAbortar = () => xhr.abort();
    const terminar = () => senal.removeEventListener('abort', alAbortar);
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e: ProgressEvent) => alProgreso(e.loaded);
    xhr.onload = () => {
      terminar();
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag');
        if (etag) resolve(etag);
        else reject(new ErrorParte(xhr.status, true));
      } else {
        reject(new ErrorParte(xhr.status));
      }
    };
    xhr.onerror = () => {
      terminar();
      reject(new ErrorParte(0));
    };
    xhr.onabort = () => {
      terminar();
      reject(new SubidaCancelada());
    };
    senal.addEventListener('abort', alAbortar, { once: true });
    xhr.send(cuerpo);
  });
}

const MENSAJE_CORTE = 'Se cortó la subida. Revisa tu conexión y reintenta: lo ya subido no se pierde.';

export function crearSubida(archivo: File, mime: string, op: OpcionesMotor): SubidaEnCurso {
  const paralelo = op.paralelo ?? 4;
  const maxReintentos = op.maxReintentos ?? 3;
  const tamanoLote = Math.min(op.tamanoLote ?? 50, 50);
  const margenMs = (op.margenVencimientoS ?? 60) * 1000;
  const ahora = op.ahora ?? Date.now;
  const esperar = op.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const clasificar = op.clasificar ?? (() => 'rechazo' as const);
  const almacen = op.almacen ?? almacenNavegador;
  const clave = claveReanudacion(archivo);
  const controlador = new AbortController();
  const espera = (intento: number) => esperar(1000 * 2 ** intento);

  let cancelada = false;
  let pausada = false;
  let completada = false;
  let ids: Ids | null = null;

  async function firmarConReintento(body: { numeros: number[]; listar?: boolean }, conIds: Ids): Promise<BerryPartesFirmadas> {
    for (let intento = 0; ; intento++) {
      try {
        return await op.api.firmar({ ...conIds, ...body });
      } catch (e) {
        if (controlador.signal.aborted) throw new SubidaCancelada();
        if (clasificar(e) !== 'reintentar' || intento >= maxReintentos) throw e;
        await espera(intento);
      }
    }
  }

  // Un medio que ya no está «subiendo» se completó en el servidor.
  async function cerradaEnServidor(id: string): Promise<BerryMedio | null> {
    try {
      const m = await op.api.buscarMedio(id);
      return m && m.estado !== 'subiendo' ? m : null;
    } catch {
      return null;
    }
  }

  const cerrar = (medio: BerryMedio) => {
    completada = true;
    borrarReanudacion(almacen, clave);
    return medio;
  };

  async function correr(): Promise<BerryMedio> {
    op.alFase?.('iniciando');
    const hechas = new Map<number, string>();
    const urls = new Map<number, { url: string; expira: number }>();
    let plan: Parte[] = [];

    const guardarUrls = (r: BerryPartesFirmadas, desde: number) => {
      const expira = desde + r.vence_en * 1000 - margenMs;
      for (const [n, url] of Object.entries(r.urls)) urls.set(Number(n), { url, expira });
    };

    // 1. Retomar, si este archivo quedó a medias.
    const previa = leerReanudacion(almacen, clave);
    if (previa) {
      const candidato = planPartes(archivo.size, op.parteBytesPorDefecto);
      try {
        const t0 = ahora();
        const r = await firmarConReintento(
          { numeros: candidato.slice(0, tamanoLote).map((p) => p.numero), listar: true },
          previa,
        );
        ids = previa;
        plan = candidato;
        for (const s of r.subidas ?? []) {
          if (s.numero >= 1 && s.numero <= plan.length && s.etag) hechas.set(s.numero, s.etag);
        }
        guardarUrls(r, t0);
      } catch (e) {
        if (e instanceof SubidaCancelada || clasificar(e) !== 'rechazo') throw e;
        // El servidor ya no la tiene abierta: completada, cancelada o vencida.
        const cerrada = await cerradaEnServidor(previa.id);
        if (cerrada) return cerrar(cerrada);
        borrarReanudacion(almacen, clave);
      }
    }
    if (controlador.signal.aborted) throw new SubidaCancelada();

    // 2. Iniciar una nueva.
    if (!ids) {
      const r = await op.api.iniciar({ nombre: archivo.name, tamano: archivo.size, tipo_mime: mime });
      ids = { id: r.id, upload_id: r.upload_id };
      // Se guarda antes de mirar si la pausaron: así la pausa la puede retomar.
      guardarReanudacion(almacen, clave, ids);
      if (controlador.signal.aborted) throw new SubidaCancelada();
      plan = planPartes(archivo.size, r.parte_bytes);
      if (r.partes && r.partes !== plan.length) {
        throw new Error('El servidor calculó otra cantidad de partes. Reintenta la subida.');
      }
    }
    const subida = ids;

    // 3 y 4. Subir lo que falta.
    op.alFase?.('subiendo');
    const pendientes = plan.filter((p) => !hechas.has(p.numero));
    let bytesHechos = plan.filter((p) => hechas.has(p.numero)).reduce((s, p) => s + (p.fin - p.inicio), 0);
    const enVuelo = new Map<number, number>();
    const reportar = () => {
      let enCurso = 0;
      for (const c of enVuelo.values()) enCurso += c;
      op.alProgreso?.(bytesHechos + enCurso);
    };
    reportar();

    let cursor = 0;
    let firmando: Promise<void> | null = null;
    const urlValida = (n: number) => {
      const u = urls.get(n);
      return u && ahora() < u.expira ? u : null;
    };
    const sinUrlDesde = (indice: number, excepto?: number) =>
      pendientes.slice(indice).map((p) => p.numero).filter((n) => n !== excepto && !hechas.has(n) && !urlValida(n));

    const lanzarFirma = (numeros: number[]): Promise<void> => {
      const t0 = ahora();
      const p = firmarConReintento({ numeros: numeros.slice(0, tamanoLote) }, subida).then((r) => guardarUrls(r, t0));
      const marca: Promise<void> = p.then(
        () => undefined,
        () => undefined,
      ).then(() => {
        if (firmando === marca) firmando = null;
      });
      firmando = marca;
      return p;
    };

    // Recién tomada una parte: si a ella o a alguna de las `paralelo`
    // siguientes le falta URL, se pide el lote desde ahí. Así el lote nuevo
    // llega antes de que se acabe el anterior y nadie espera la firma.
    const adelantarFirma = () => {
      if (firmando) return;
      const desde = Math.max(0, cursor - 1);
      const ventana = pendientes.slice(desde, desde + paralelo + 1).map((p) => p.numero);
      if (!ventana.some((n) => !hechas.has(n) && !urlValida(n))) return;
      lanzarFirma(sinUrlDesde(desde)).catch(() => undefined);
    };

    const asegurarUrl = async (n: number) => {
      let u = urlValida(n);
      if (u) return u;
      if (firmando) {
        await firmando;
        u = urlValida(n);
        if (u) return u;
      }
      await lanzarFirma([n, ...sinUrlDesde(cursor, n)]);
      u = urlValida(n);
      if (!u) throw new Error(`El servidor no firmó la parte ${n}. Reintenta la subida.`);
      return u;
    };

    const subirParte = async (parte: Parte) => {
      const n = parte.numero;
      for (let intento = 0; ; intento++) {
        if (controlador.signal.aborted) throw new SubidaCancelada();
        const u = await asegurarUrl(n);
        try {
          const etag = await putParte(
            u.url,
            archivo.slice(parte.inicio, parte.fin),
            (cargados) => {
              enVuelo.set(n, cargados);
              reportar();
            },
            controlador.signal,
            op.crearXhr,
          );
          enVuelo.delete(n);
          hechas.set(n, etag);
          bytesHechos += parte.fin - parte.inicio;
          reportar();
          return;
        } catch (e) {
          enVuelo.delete(n);
          reportar();
          if (e instanceof SubidaCancelada || controlador.signal.aborted) throw new SubidaCancelada();
          if (e instanceof ErrorParte && e.sinEtag) {
            throw new Error(`No se pudo confirmar la parte ${n} del archivo. Avisa a RockyBrand.`);
          }
          if (intento >= maxReintentos) throw new Error(MENSAJE_CORTE);
          if (e instanceof ErrorParte && e.status === 403) {
            // URL vencida: todo lo firmado en ese lote o antes vence junto.
            for (const [m, otra] of urls) if (otra.expira <= u.expira) urls.delete(m);
            continue;
          }
          await espera(intento);
        }
      }
    };

    let falla: unknown = null;
    const trabajador = async () => {
      while (!falla && !controlador.signal.aborted && cursor < pendientes.length) {
        const parte = pendientes[cursor++];
        adelantarFirma();
        await subirParte(parte);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(paralelo, pendientes.length) }, () =>
        trabajador().catch((e) => {
          if (!falla && !(e instanceof SubidaCancelada)) {
            falla = e;
            controlador.abort();
          }
        }),
      ),
    );
    if (controlador.signal.aborted && !falla) throw new SubidaCancelada();
    if (falla) throw falla;

    // 5. Completar con todas, en orden.
    op.alFase?.('completando');
    const partes = [...hechas.entries()]
      .map(([numero, etag]) => ({ numero, etag }))
      .sort((a, b) => a.numero - b.numero);
    let r: { medio: BerryMedio };
    try {
      r = await op.api.completar({ ...subida, partes });
    } catch (e) {
      if (clasificar(e) === 'fatal') throw e;
      const cerrada = await cerradaEnServidor(subida.id);
      if (cerrada) return cerrar(cerrada);
      throw e;
    }
    return cerrar(r.medio);
  }

  // Cortar por pausa o por cancelación se ve igual desde adentro (la señal
  // abortada); acá se distingue cuál fue.
  const resultado = correr().catch((e: unknown) => {
    if (cancelada) throw new SubidaCancelada();
    if (pausada) throw new SubidaPausada();
    throw e;
  });
  // Quien no espere el resultado (cancelar antes de tiempo) no deja una
  // promesa rechazada sin manejar.
  resultado.catch(() => undefined);

  return {
    resultado,
    async pausar() {
      if (cancelada || pausada || completada) return;
      pausada = true;
      controlador.abort();
      try {
        await resultado;
      } catch {
        // Se esperaba: la subida quedó en pausa.
      }
    },
    async cancelar() {
      if (cancelada || completada) return;
      cancelada = true;
      controlador.abort();
      try {
        await resultado;
      } catch {
        // Se esperaba: la subida se cortó.
      }
      if (completada) return;
      const aBorrar = ids;
      borrarReanudacion(almacen, clave);
      if (aBorrar) {
        try {
          await op.api.cancelar(aBorrar);
        } catch {
          // Si no se pudo avisar, S3 limpia las partes huérfanas solo.
        }
      }
    },
  };
}
