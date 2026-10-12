import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  cancelarBerrySubida,
  completarBerrySubida,
  ErrorTransitorio,
  firmarBerryPartes,
  getBerryBiblioteca,
  iniciarBerrySubida,
  TimeoutError,
  UnauthorizedError,
} from '../../api/dashboardApi';
import type { BerryMedio, BerryTipo } from '../../types';
import { revisarArchivo, tipoAproximado } from './formatos';
import { claveReanudacion, crearSubida, SubidaCancelada, SubidaPausada, type ClaseError, type FaseMotor, type SubidaEnCurso } from './motorSubida';

// La cola de subidas de Berry Studio, en memoria del navegador.
//
// Vive fuera del componente a propósito: la pantalla se desmonta al ir a
// Publicación o a cualquier otra, y una subida de 20 GB no puede morir por
// eso. Los `File` quedan solo acá (nunca en localStorage); al recargar la
// pestaña se pierden, y por eso existe el retomar del motor.
//
// Un archivo a la vez, cada uno con 4 partes en paralelo: dos archivos
// juntos no suben más rápido, solo reparten el mismo ancho de banda.

export type EstadoSubida = 'en-espera' | FaseMotor | 'pausada' | 'completada' | 'error' | 'cancelada';

export interface EntradaSubida {
  clave: string;
  clientId: string | null;
  nombre: string;
  tamano: number;
  tipo: BerryTipo | null;
  estado: EstadoSubida;
  subidos: number;
  /** Bytes por segundo, promedio de los últimos segundos; null sin muestra suficiente. */
  velocidad: number | null;
  restanteS: number | null;
  error: string | null;
  /** Lo que devolvió `completar` (queda en `preparando`). */
  medio: BerryMedio | null;
  reintentable: boolean;
}

const ACTIVOS: ReadonlySet<EstadoSubida> = new Set(['en-espera', 'iniciando', 'subiendo', 'completando']);

export function estaActiva(e: EntradaSubida): boolean {
  return ACTIVOS.has(e.estado);
}

/** Activa o en pausa: el archivo sigue en esta pestaña y se puede retomar acá. */
export function estaEnEstaPestana(e: EntradaSubida): boolean {
  return ACTIVOS.has(e.estado) || e.estado === 'pausada';
}

interface Interna {
  entrada: EntradaSubida;
  archivo: File;
  mime: string;
  motor: SubidaEnCurso | null;
  /** Cambia en cada arranque o cancelación: los avisos de un motor viejo se ignoran. */
  turno: object;
  muestras: { t: number; b: number }[];
}

const VENTANA_VELOCIDAD_MS = 8000;

let internas: Interna[] = [];
let instantanea: EntradaSubida[] = [];
const oyentes = new Set<() => void>();
let emisionPendiente: ReturnType<typeof setTimeout> | null = null;
let parteBytes = 16 * 1024 * 1024;
let clienteActual: string | null | undefined;
let contador = 0;
let avisoSalidaPuesto = false;
const manejadores: { alNoAutorizado: (() => void) | null; alCompletar: ((m: BerryMedio) => void) | null } = {
  alNoAutorizado: null,
  alCompletar: null,
};

function clasificar(e: unknown): ClaseError {
  if (e instanceof UnauthorizedError) return 'fatal';
  if (e instanceof ErrorTransitorio || e instanceof TimeoutError) return 'reintentar';
  return 'rechazo';
}

function alSalir(e: BeforeUnloadEvent) {
  e.preventDefault();
  // Chrome y Safari antiguos solo muestran el aviso con returnValue puesto.
  e.returnValue = '';
}

function actualizarAvisoSalida() {
  const activa = internas.some((i) => ACTIVOS.has(i.entrada.estado));
  if (activa && !avisoSalidaPuesto) {
    window.addEventListener('beforeunload', alSalir);
    avisoSalidaPuesto = true;
  } else if (!activa && avisoSalidaPuesto) {
    window.removeEventListener('beforeunload', alSalir);
    avisoSalidaPuesto = false;
  }
}

function emitir() {
  if (emisionPendiente) {
    clearTimeout(emisionPendiente);
    emisionPendiente = null;
  }
  instantanea = internas.map((i) => i.entrada);
  actualizarAvisoSalida();
  actualizarTic();
  for (const f of oyentes) f();
}

// El progreso llega decenas de veces por segundo (4 XHR a la vez): la
// pantalla se redibuja a lo más 4 veces por segundo.
function emitirPronto() {
  if (emisionPendiente) return;
  emisionPendiente = setTimeout(emitir, 250);
}

function cambiar(i: Interna, cambios: Partial<EntradaSubida>) {
  i.entrada = { ...i.entrada, ...cambios };
}

function registrarProgreso(i: Interna, bytes: number) {
  const t = Date.now();
  i.muestras.push({ t, b: bytes });
  while (i.muestras.length > 2 && t - i.muestras[0].t > VENTANA_VELOCIDAD_MS) i.muestras.shift();
  const primera = i.muestras[0];
  const dt = (t - primera.t) / 1000;
  const velocidad = dt >= 1 ? (bytes - primera.b) / dt : null;
  const ok = velocidad !== null && velocidad > 0;
  cambiar(i, {
    subidos: bytes,
    velocidad: ok ? velocidad : null,
    restanteS: ok ? Math.max(0, i.entrada.tamano - bytes) / velocidad : null,
  });
}

// Si la red se detiene no llegan eventos de progreso, y la velocidad y el
// tiempo restante quedarían congelados en su último valor. Cada segundo se
// agrega una muestra con lo que haya, para que bajen hasta desaparecer.
let tic: ReturnType<typeof setInterval> | null = null;

function actualizarTic() {
  const subiendo = internas.some((i) => i.entrada.estado === 'subiendo');
  if (subiendo && !tic) {
    tic = setInterval(() => {
      for (const i of internas) if (i.entrada.estado === 'subiendo') registrarProgreso(i, i.entrada.subidos);
      emitir();
    }, 1000);
  } else if (!subiendo && tic) {
    clearInterval(tic);
    tic = null;
  }
}

function siguiente() {
  if (internas.some((i) => i.entrada.estado !== 'en-espera' && ACTIVOS.has(i.entrada.estado))) return;
  const i = internas.find((x) => x.entrada.estado === 'en-espera');
  if (i) arrancar(i);
}

function arrancar(i: Interna) {
  const turno = {};
  i.turno = turno;
  i.muestras = [];
  // `subidos` se conserva: al reanudar, la barra no vuelve a cero mientras
  // el motor pregunta qué partes ya están.
  cambiar(i, { estado: 'iniciando', error: null, velocidad: null, restanteS: null, reintentable: false });
  const motor = crearSubida(i.archivo, i.mime, {
    api: {
      iniciar: iniciarBerrySubida,
      firmar: firmarBerryPartes,
      completar: completarBerrySubida,
      cancelar: cancelarBerrySubida,
      buscarMedio: async (id) => (await getBerryBiblioteca()).medios.find((m) => m.id === id) ?? null,
    },
    parteBytesPorDefecto: parteBytes,
    clasificar,
    alFase: (fase) => {
      if (i.turno !== turno) return;
      cambiar(i, fase === 'completando' ? { estado: fase, velocidad: null, restanteS: null } : { estado: fase });
      emitir();
    },
    alProgreso: (bytes) => {
      if (i.turno !== turno) return;
      registrarProgreso(i, bytes);
      emitirPronto();
    },
  });
  i.motor = motor;
  emitir();
  motor.resultado.then(
    (medio) => {
      if (i.turno !== turno) return;
      cambiar(i, { estado: 'completada', medio, subidos: i.entrada.tamano, velocidad: null, restanteS: null });
      emitir();
      manejadores.alCompletar?.(medio);
      siguiente();
    },
    (e: unknown) => {
      if (i.turno !== turno || e instanceof SubidaCancelada || e instanceof SubidaPausada) return;
      if (e instanceof UnauthorizedError) {
        cambiar(i, {
          estado: 'error',
          error: 'Tu sesión expiró. Inicia sesión y toca Reintentar: lo ya subido no se pierde.',
          reintentable: true,
          velocidad: null,
          restanteS: null,
        });
        emitir();
        manejadores.alNoAutorizado?.();
        return;
      }
      cambiar(i, {
        estado: 'error',
        error: e instanceof Error ? e.message : 'No se pudo subir el archivo.',
        reintentable: true,
        velocidad: null,
        restanteS: null,
      });
      emitir();
      siguiente();
    },
  );
}

/** Agrega archivos a la cola. Los que no pasan la revisión quedan como error. */
export function agregarArchivos(archivos: File[], clientId: string | null) {
  for (const archivo of archivos) {
    const clave = claveReanudacion(archivo);
    // El mismo archivo dos veces a la vez se pisaría la clave de retomar. Si
    // ya está en la lista en pausa o con error, elegirlo de nuevo lo retoma.
    const previa = internas.find(
      (i) => i.entrada.clientId === clientId && claveReanudacion(i.archivo) === clave &&
        (estaEnEstaPestana(i.entrada) || (i.entrada.estado === 'error' && i.entrada.reintentable)),
    );
    if (previa) {
      if (previa.entrada.estado === 'pausada' || previa.entrada.estado === 'error') {
        previa.archivo = archivo;
        cambiar(previa, { estado: 'en-espera', error: null });
      }
      continue;
    }
    const r = revisarArchivo(archivo);
    internas.push({
      archivo,
      mime: r.ok ? r.mime : '',
      motor: null,
      turno: {},
      muestras: [],
      entrada: {
        clave: `s${Date.now()}-${contador++}`,
        clientId,
        nombre: archivo.name,
        tamano: archivo.size,
        tipo: r.ok ? r.tipo : tipoAproximado(archivo),
        estado: r.ok ? 'en-espera' : 'error',
        subidos: 0,
        velocidad: null,
        restanteS: null,
        error: r.ok ? null : r.error,
        medio: null,
        reintentable: false,
      },
    });
  }
  emitir();
  siguiente();
}

export function cancelarSubida(clave: string) {
  const i = internas.find((x) => x.entrada.clave === clave);
  // Completando no se cancela: el servidor ya está armando el archivo.
  if (!i || !['en-espera', 'iniciando', 'subiendo', 'pausada'].includes(i.entrada.estado)) return;
  // El motor anterior (en pausa o con error) conoce la subida del servidor:
  // cancelarlo la borra allá también.
  const motor = i.motor;
  i.turno = {};
  i.motor = null;
  cambiar(i, { estado: 'cancelada', velocidad: null, restanteS: null });
  emitir();
  if (motor) void motor.cancelar();
  siguiente();
}

/** Corta los PUT y deja la subida lista para seguir; la siguiente de la cola arranca. */
export function pausarSubida(clave: string) {
  const i = internas.find((x) => x.entrada.clave === clave);
  if (!i || (i.entrada.estado !== 'iniciando' && i.entrada.estado !== 'subiendo')) return;
  i.turno = {};
  cambiar(i, { estado: 'pausada', velocidad: null, restanteS: null });
  emitir();
  if (i.motor) void i.motor.pausar();
  siguiente();
}

/** Vuelve a la cola: el motor nuevo retoma con `listar: true`. */
export function reanudarSubida(clave: string) {
  const i = internas.find((x) => x.entrada.clave === clave);
  if (!i || i.entrada.estado !== 'pausada') return;
  cambiar(i, { estado: 'en-espera' });
  emitir();
  siguiente();
}

export function reintentarSubida(clave: string) {
  const i = internas.find((x) => x.entrada.clave === clave);
  if (!i || i.entrada.estado !== 'error' || !i.entrada.reintentable) return;
  cambiar(i, { estado: 'en-espera', error: null });
  emitir();
  siguiente();
}

/** Saca una fila de la lista. Si la subida falló, además la descarta en el
 *  servidor: si no, quedaría «subiendo» para siempre en la biblioteca. */
export function quitarSubida(clave: string) {
  const i = internas.find((x) => x.entrada.clave === clave);
  if (!i || ACTIVOS.has(i.entrada.estado)) return;
  if ((i.entrada.estado === 'error' || i.entrada.estado === 'pausada') && i.motor) void i.motor.cancelar();
  i.turno = {};
  internas = internas.filter((x) => x !== i);
  emitir();
}

/** Tamaño de parte de la biblioteca: el que se usa para retomar. */
export function configurarParteBytes(bytes: number) {
  if (Number.isFinite(bytes) && bytes > 0) parteBytes = bytes;
}

/** La pantalla montada recibe los avisos; al desmontarse, nadie. */
export function conectarPantalla(alCompletar: (m: BerryMedio) => void, alNoAutorizado: () => void): () => void {
  manejadores.alCompletar = alCompletar;
  manejadores.alNoAutorizado = alNoAutorizado;
  return () => {
    if (manejadores.alCompletar === alCompletar) manejadores.alCompletar = null;
    if (manejadores.alNoAutorizado === alNoAutorizado) manejadores.alNoAutorizado = null;
  };
}

// Aislamiento por cliente: si en esta pestaña entra otra cuenta, lo de la
// anterior se corta y se olvida, aunque estuviera subiendo.
function asegurarCliente(clientId: string | null) {
  if (clienteActual === undefined || clienteActual === clientId) {
    clienteActual = clientId;
    return;
  }
  for (const i of internas) {
    if (ACTIVOS.has(i.entrada.estado) && i.motor) void i.motor.cancelar();
    i.turno = {};
  }
  internas = [];
  clienteActual = clientId;
  emitir();
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

export function useSubidasBerry(clientId: string | null): EntradaSubida[] {
  useEffect(() => asegurarCliente(clientId), [clientId]);
  const todas = useSyncExternalStore(suscribir, () => instantanea);
  return useMemo(() => todas.filter((e) => e.clientId === clientId), [todas, clientId]);
}
