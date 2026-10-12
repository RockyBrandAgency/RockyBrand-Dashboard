import type { BerryDetalle, BerryMedio, BerryTipo } from '../../types';

// Qué acepta Berry Studio y cómo se lee cada dato de la biblioteca.
//
// Las extensiones y los topes son los del contrato de la fase 1
// (POST /dashboard/berry/subidas). El servidor vuelve a validar: esto solo
// evita subir 20 GB para recibir un 400 al final. Los topes van en GiB y MiB
// (el valor más alto de los dos posibles) para que el navegador nunca sea más
// estricto que el servidor.

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

interface Formato {
  tipo: BerryTipo;
  mime: string;
}

const FORMATOS: Record<string, Formato> = {
  mov: { tipo: 'video', mime: 'video/quicktime' },
  mp4: { tipo: 'video', mime: 'video/mp4' },
  m4v: { tipo: 'video', mime: 'video/x-m4v' },
  jpg: { tipo: 'foto', mime: 'image/jpeg' },
  jpeg: { tipo: 'foto', mime: 'image/jpeg' },
  png: { tipo: 'foto', mime: 'image/png' },
  cr2: { tipo: 'foto', mime: 'image/x-canon-cr2' },
  wav: { tipo: 'audio', mime: 'audio/wav' },
  mp3: { tipo: 'audio', mime: 'audio/mpeg' },
  m4a: { tipo: 'audio', mime: 'audio/mp4' },
  aac: { tipo: 'audio', mime: 'audio/aac' },
  flac: { tipo: 'audio', mime: 'audio/flac' },
};

export const TOPE_BYTES: Record<BerryTipo, number> = {
  video: 20 * GIB,
  foto: 200 * MIB,
  audio: 2 * GIB,
};

const TOPE_TEXTO: Record<BerryTipo, string> = {
  video: '20 GB',
  foto: '200 MB',
  audio: '2 GB',
};

const NOMBRE_TIPO: Record<BerryTipo, string> = {
  video: 'Un video',
  foto: 'Una foto',
  audio: 'Un audio',
};

/** Para el `accept` del selector. HEIC no va: la fase 1 no lo procesa. */
export const ACCEPT = 'video/*,image/*,audio/*,.cr2,.mov,.m4a';

/** Texto exacto del contrato (el servidor responde lo mismo con un 400). */
export const MENSAJE_HEIC =
  'Las fotos HEIC llegan en la fase 2. Por ahora, expórtala como JPEG (Fotos › Archivo › Exportar).';

const MENSAJE_FORMATO =
  'Formato no aceptado. Videos: MOV, MP4 o M4V. Fotos: JPG, PNG o CR2. Audio: WAV, MP3, M4A, AAC o FLAC.';

export function extension(nombre: string): string {
  const i = nombre.lastIndexOf('.');
  return i < 0 ? '' : nombre.slice(i + 1).toLowerCase();
}

export type Revision = { ok: true; tipo: BerryTipo; mime: string } | { ok: false; error: string };

/** Revisión previa en el navegador: extensión, archivo vacío y tope por tipo. */
export function revisarArchivo(archivo: { name: string; size: number; type: string }): Revision {
  const ext = extension(archivo.name);
  if (ext === 'heic' || ext === 'heif') return { ok: false, error: MENSAJE_HEIC };
  const formato = FORMATOS[ext];
  if (!formato) return { ok: false, error: MENSAJE_FORMATO };
  if (archivo.size <= 0) return { ok: false, error: 'El archivo está vacío.' };
  if (archivo.size > TOPE_BYTES[formato.tipo]) {
    return { ok: false, error: `${NOMBRE_TIPO[formato.tipo]} puede pesar hasta ${TOPE_TEXTO[formato.tipo]}.` };
  }
  // Safari y Chrome dejan `type` vacío en CR2 y a veces en M4A: el MIME de la
  // extensión es el que el servidor espera de todos modos.
  return { ok: true, tipo: formato.tipo, mime: archivo.type || formato.mime };
}

/** Para el ícono de un archivo rechazado: lo que diga su MIME o su extensión. */
export function tipoAproximado(archivo: { name: string; type: string }): BerryTipo | null {
  const formato = FORMATOS[extension(archivo.name)];
  if (formato) return formato.tipo;
  if (archivo.type.startsWith('video/')) return 'video';
  if (archivo.type.startsWith('image/') || ['heic', 'heif'].includes(extension(archivo.name))) return 'foto';
  if (archivo.type.startsWith('audio/')) return 'audio';
  return null;
}

const NUM = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });
const NUM2 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

/** Tamaño en MB o GB decimales, como los muestra el Finder. */
export function formatearTamano(bytes: number): string {
  if (bytes >= 1e9) return `${NUM.format(bytes / 1e9)} GB`;
  if (bytes >= 1e6) return `${NUM.format(bytes / 1e6)} MB`;
  return `${NUM.format(Math.max(bytes, 0) / 1e3)} KB`;
}

export function formatearVelocidad(bytesPorSegundo: number): string {
  return `${NUM.format(bytesPorSegundo / 1e6)} MB/s`;
}

/** 109 → «1:49»; 3725 → «1:02:05». */
export function formatearDuracion(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Tiempo restante en palabras cortas: «quedan 40 s», «quedan 3 min», «quedan 1 h 20 min». */
export function formatearRestante(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return '';
  if (segundos < 60) return `quedan ${Math.max(1, Math.round(segundos))} s`;
  const min = Math.round(segundos / 60);
  if (min < 60) return `quedan ${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `quedan ${h} h ${resto} min` : `quedan ${h} h`;
}

function canales(n: number): string {
  if (n === 1) return 'mono';
  if (n === 2) return 'estéreo';
  return `${n} canales`;
}

/**
 * La línea de detalle de una tarjeta, con lo que el backend midió:
 * video «3840×2160 · 59,94 fps · 1:49 · HDR HLG»,
 * audio «2:31 · 48 kHz · estéreo», foto «6000×4000».
 * Lo que no viene no se dice.
 */
export function detalleMedio(tipo: BerryTipo, d: BerryDetalle | null): string {
  return partesDetalle(tipo, d).join(' · ');
}

/** Lo mismo que `detalleMedio`, en trozos: la tarjeta no corta un trozo en dos líneas. */
export function partesDetalle(tipo: BerryTipo, d: BerryDetalle | null): string[] {
  if (!d) return [];
  const partes: string[] = [];
  // La resolución que importa es la del original; la del proxy solo si falta.
  const ancho = d.ancho_original || d.ancho;
  const alto = d.alto_original || d.alto;
  if (tipo !== 'audio' && ancho && alto) partes.push(`${ancho}×${alto}`);
  if (tipo === 'video' && d.fps) partes.push(`${NUM2.format(d.fps)} fps`);
  if (tipo !== 'foto' && d.duracion_s) partes.push(formatearDuracion(d.duracion_s));
  if (tipo === 'video' && d.hdr) partes.push(`HDR ${d.hdr.toUpperCase()}`);
  if (tipo === 'audio' && d.frecuencia_hz) partes.push(`${NUM.format(d.frecuencia_hz / 1000)} kHz`);
  if (tipo === 'audio' && d.canales) partes.push(canales(d.canales));
  return partes;
}

const RELATIVA = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' });

/** «hace 5 minutos», «ayer», «12 oct». */
export function fechaRelativa(iso: string, ahora: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const seg = Math.round((t - ahora) / 1000);
  const abs = Math.abs(seg);
  if (abs < 60) return 'recién';
  if (abs < 3600) return RELATIVA.format(Math.round(seg / 60), 'minute');
  if (abs < 86400) return RELATIVA.format(Math.round(seg / 3600), 'hour');
  if (abs < 7 * 86400) return RELATIVA.format(Math.round(seg / 86400), 'day');
  return new Date(t).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

/** Más de 30 min sin cambios mientras prepara: se avisa, no se esconde. */
export const DEMORA_MS = 30 * 60 * 1000;

export function seEstaDemorando(m: BerryMedio, ahora: number = Date.now()): boolean {
  if (m.estado !== 'preparando') return false;
  const t = new Date(m.actualizado || m.creado).getTime();
  return !Number.isNaN(t) && ahora - t > DEMORA_MS;
}

export type Tono = 'bien' | 'atencion' | 'critico' | 'neutro' | 'info';

export function tonoMedio(m: BerryMedio, ahora: number = Date.now()): Tono {
  if (m.estado === 'listo') return 'bien';
  if (m.estado === 'error') return 'critico';
  if (seEstaDemorando(m, ahora)) return 'atencion';
  return 'info';
}
