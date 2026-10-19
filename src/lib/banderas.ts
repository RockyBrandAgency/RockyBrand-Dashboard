import type { MercadoLodge } from '../types';

/** Bandera de un país a partir de lo que trae `GuestOriginCountry`.
 *
 *  Formato real (verificado el 17-oct en el backend y en el fixture de Ventas):
 *  es el NOMBRE del país en texto libre. El formulario del sitio manda el nombre
 *  en inglés («United States», «Brazil», «Chile»); el panel acepta lo que se
 *  escriba. Por eso se normaliza (minúsculas, sin tildes) y se busca en una
 *  lista cerrada. Un país que no está en la lista no lleva bandera: nunca se
 *  adivina. La bandera se arma con los dos «regional indicator symbols» del
 *  código ISO 3166-1 alfa-2 (U+1F1E6 = A). */

const NOMBRES: Record<string, string> = {
  US: 'united states|united states of america|usa|us|u.s.|u.s.a.|eeuu|ee.uu.|ee uu|estados unidos|estados unidos de america',
  BR: 'brazil|brasil|bra|br',
  CL: 'chile|chl|cl',
  AR: 'argentina|arg|ar',
  CA: 'canada|can|ca',
  MX: 'mexico|mex|mx',
  GB: 'united kingdom|uk|gb|gbr|great britain|england|scotland|wales|reino unido|inglaterra|escocia',
  IE: 'ireland|irlanda|ie|irl',
  DE: 'germany|alemania|deutschland|de|deu',
  FR: 'france|francia|fr|fra',
  ES: 'spain|espana|es|esp',
  IT: 'italy|italia|it|ita',
  PT: 'portugal|pt|prt',
  NL: 'netherlands|the netherlands|holland|holanda|paises bajos|nl|nld',
  BE: 'belgium|belgica|be|bel',
  CH: 'switzerland|suiza|ch|che',
  AT: 'austria|at|aut',
  SE: 'sweden|suecia|se|swe',
  NO: 'norway|noruega|nor', // «no» se omite: puede ser «no» de respuesta
  DK: 'denmark|dinamarca|dk|dnk',
  FI: 'finland|finlandia|fi|fin',
  AU: 'australia|au|aus',
  NZ: 'new zealand|nueva zelanda|nz|nzl',
  JP: 'japan|japon|jp|jpn',
  CO: 'colombia|co|col',
  PE: 'peru|pe|per',
  UY: 'uruguay|uy|ury',
  ZA: 'south africa|sudafrica|za|zaf',
};

const CODIGO_POR_NOMBRE = new Map<string, string>();
for (const [codigo, nombres] of Object.entries(NOMBRES)) {
  for (const n of nombres.split('|')) CODIGO_POR_NOMBRE.set(n, codigo);
}

function normalizar(pais: string): string {
  return pais.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Código ISO alfa-2 de un país escrito como nombre o código; null si no se reconoce. */
export function codigoPais(pais: string | null | undefined): string | null {
  if (typeof pais !== 'string' || !pais.trim()) return null;
  return CODIGO_POR_NOMBRE.get(normalizar(pais)) ?? null;
}

/** Emoji de bandera de un código alfa-2 («US» → 🇺🇸). null si no son dos letras A–Z. */
export function emojiBandera(codigo: string): string | null {
  if (!/^[A-Z]{2}$/.test(codigo)) return null;
  return String.fromCodePoint(...[...codigo].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Bandera del país del pescador, o null si no hay país o no se reconoce. */
export function banderaDePais(pais: string | null | undefined): string | null {
  const codigo = codigoPais(pais);
  return codigo ? emojiBandera(codigo) : null;
}

const CODIGO_MERCADO: Record<MercadoLodge, string> = { USA: 'US', CL: 'CL', BR: 'BR' };

/** Bandera de un mercado de tarifas (USA, Chile, Brasil). */
export function banderaDeMercado(mercado: string | null | undefined): string | null {
  if (!mercado || !Object.prototype.hasOwnProperty.call(CODIGO_MERCADO, mercado)) return null;
  return emojiBandera(CODIGO_MERCADO[mercado as MercadoLodge]);
}
