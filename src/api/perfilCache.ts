import { decodeIdTokenClaims } from './cognitoAuth';
import type { MeResponse } from '../types';

// Recuerdo de la última respuesta de GET /dashboard/me, para que recargar la
// página no vuelva a dejar el panel en blanco esperando esa llamada.
//
// El problema real que resuelve (reportado por Mato el 2026-08-18 sobre
// https://chile-fly-fishing.panel.rockybrand.cl/): al cargar, /dashboard/me
// tarda -es una Lambda, con arranque en frío son segundos- y en todo ese rato
// la app no sabe qué cliente es ni qué contrató. Con ese hueco pasaban las dos
// cosas que él vio: la pantalla se quedaba pegada, y después aparecía un panel
// con secciones que no son de Chile Fly Fishing hasta que llegaba la
// respuesta. Guardando la respuesta anterior, la segunda carga en adelante
// arranca ya con el panel correcto y la llamada solo confirma o corrige.
//
// TRES CANDADOS, porque esto guarda identidad de cliente:
//
// 1. sessionStorage, NO localStorage. Es exactamente donde vive la sesión
//    (cognitoAuth.ts, SESSION_STORAGE_KEY): el recuerdo no puede sobrevivir ni
//    un segundo más que el token, ni cruzar de una pestaña a otra.
// 2. Va firmado con el `sub` del ID token y solo se devuelve si el `sub` del
//    token de AHORA es el mismo. Si entra otra persona, el recuerdo del
//    anterior no se lee: se descarta.
// 3. NO decide nada de datos. El aislamiento por cliente lo sigue haciendo el
//    backend con el claim del JWT en cada request, igual que siempre; esto
//    solo evita dibujar un menú equivocado mientras la respuesta viaja. La
//    respuesta real, cuando llega, siempre pisa lo que hubiera acá.
const KEY = 'rockybrand.dashboard.perfil';

interface PerfilGuardado {
  sub: string;
  me: MeResponse;
}

function subDe(idToken: string): string | null {
  const sub = decodeIdTokenClaims(idToken).sub;
  return typeof sub === 'string' && sub ? sub : null;
}

export function leerPerfilCacheado(idToken: string): MeResponse | null {
  const sub = subDe(idToken);
  if (!sub) return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const guardado = JSON.parse(raw) as PerfilGuardado;
    if (guardado.sub !== sub) {
      // Otro usuario en la misma pestaña: el recuerdo del anterior no sirve
      // y no se deja ahí tirado.
      sessionStorage.removeItem(KEY);
      return null;
    }
    return guardado.me ?? null;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function guardarPerfilCacheado(idToken: string, me: MeResponse): void {
  const sub = subDe(idToken);
  if (!sub) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ sub, me } satisfies PerfilGuardado));
  } catch {
    // sessionStorage lleno o bloqueado (modo privado de algunos browsers):
    // el panel sigue funcionando igual que antes de existir este archivo.
  }
}

export function borrarPerfilCacheado(): void {
  sessionStorage.removeItem(KEY);
}
