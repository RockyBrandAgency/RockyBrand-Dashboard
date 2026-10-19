import { PROGRAMA_LABEL } from '../lib/fichaPescador';
import { banderaDeMercado, banderaDePais } from '../lib/banderas';
import type { ProgramaLodge } from '../types';

export function esPrograma(codigo: string): codigo is ProgramaLodge {
  return Object.prototype.hasOwnProperty.call(PROGRAMA_LABEL, codigo);
}

/** Programa de pesca de CFF con su color (Full Day / All Inclusive). El nombre
 *  va siempre dentro: el color nunca es la única señal (WCAG 2.2 1.4.1).
 *  Cualquier otro RoomID (habitaciones de Alto Castillo) queda como texto. */
export function BadgePrograma({ codigo }: { codigo: string | null | undefined }) {
  if (!codigo) return null;
  if (!esPrograma(codigo)) return <>{codigo}</>;
  return (
    <span className={`badge-programa badge-programa--${codigo === 'FULL_DAY' ? 'fd' : 'ai'}`} data-programa={codigo}>
      {PROGRAMA_LABEL[codigo]}
    </span>
  );
}

/** Bandera decorativa (aria-hidden) + nombre visible. Sin país reconocido, solo el nombre. */
export function PaisConBandera({ pais, vacio = '—' }: { pais: string | null | undefined; vacio?: string }) {
  if (typeof pais !== 'string' || !pais.trim()) return <>{vacio}</>;
  const bandera = banderaDePais(pais);
  return (
    <span className="con-bandera">
      {bandera && <span aria-hidden="true" className="bandera">{bandera}</span>}
      {pais}
    </span>
  );
}

/** País del pescador en listas: bandera decorativa (aria-hidden) + nombre VISIBLE,
 *  que se corta con elipsis si no cabe, sin romper la fila; el nombre completo va
 *  en `title`. Sin país, nada. País fuera de la lista: solo el nombre. */
export function PaisPescador({ pais }: { pais: string | null | undefined }) {
  if (typeof pais !== 'string' || !pais.trim()) return null;
  const bandera = banderaDePais(pais);
  return (
    <span className="pais-pescador" title={pais}>
      {bandera && <span aria-hidden="true" className="bandera">{bandera}</span>}
      <span className="pais-pescador__nombre">{pais}</span>
    </span>
  );
}

/** Solo bandera, para las barras del calendario: excepción decidida por espacio
 *  (spec-ventas-mix.md, «Decisiones del jefe», 17-oct). En las demás listas va
 *  `PaisPescador`, con el país visible. Aquí el país va como texto solo para
 *  lectores de pantalla y como `title`. Sin país reconocido, nada. */
export function BanderaPescador({ pais }: { pais: string | null | undefined }) {
  const bandera = banderaDePais(pais);
  if (!bandera || !pais) return null;
  return (
    <span className="bandera bandera--pescador" title={pais}>
      <span aria-hidden="true">{bandera}</span>
      <span className="solo-lector">({pais})</span>
    </span>
  );
}

/** Mercado de tarifas (USA, Chile, Brasil) con su bandera. */
export function MercadoConBandera({ mercado, etiqueta }: { mercado: string | null | undefined; etiqueta: string }) {
  const bandera = banderaDeMercado(mercado);
  return (
    <span className="con-bandera">
      {bandera && <span aria-hidden="true" className="bandera">{bandera}</span>}
      {etiqueta}
    </span>
  );
}

/** Ranura de 18 px para la bandera (spec §16.3): el emoji es decorativo
 *  (aria-hidden) y, sin bandera reconocida, la ranura queda vacía con su ancho
 *  reservado para que las filas sigan alineadas. */
export function RanuraBandera({ bandera }: { bandera: string | null | undefined }) {
  return (
    <span aria-hidden="true" className="ranura-bandera" data-ranura-bandera="">
      {bandera ?? ''}
    </span>
  );
}
