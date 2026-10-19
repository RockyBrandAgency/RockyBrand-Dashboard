import { useEffect, useState } from 'react';
import { BadgePrograma, MercadoConBandera } from '../../components/BadgePrograma';
import { banderaDeMercado } from '../../lib/banderas';
import { Icono } from '../../lib/iconos';
import { MERCADO_LABEL, PROGRAMA_LABEL } from '../../lib/fichaPescador';
import {
  barrasDe,
  detalleBarra,
  detalleSector,
  jornadasTexto,
  NOMBRE_SECTOR,
  pescadoresTexto,
  reservasTexto,
  sectoresDe,
  type ClaveSector,
  type FilaBarra,
  type Sector,
} from '../../lib/ventanasVentas';
import type { VentasVentana } from '../../types';

// Gráficos de Ventas por período (spec-ventas-cajas §8). Miden pescadores,
// nunca plata. Barras = filas HTML con botón real; dona = SVG decorativo con
// la leyenda como equivalente accesible y control (WAI Complex Images; 2.5.8
// «Equivalent»). Sin tooltip flotante: una línea fija de detalle (1.4.13).
// Las animaciones las pone ResumenPorPeriodo (GSAP) leyendo los data-*.

const PCT = ' %';
const COLOR: Record<ClaveSector | 'otros', string> = { USA: 'var(--mercado-usa)', BR: 'var(--mercado-br)', CL: 'var(--mercado-cl)', sin: 'var(--mercado-sin)', otros: 'var(--mercado-sin)' };

/** Hover solo con puntero fino (el mismo criterio de buttonHoverGsap). */
const conHover = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Selección de un gráfico: fijada (clic, toque, Enter, Espacio) y vista previa (hover). Esc suelta las dos. */
function useSeleccion<T extends string>(validas: readonly T[]) {
  const [fijada, setFijada] = useState<T | null>(null);
  const [previa, setPrevia] = useState<T | null>(null);
  const activa = (previa && validas.includes(previa) ? previa : null) ?? (fijada && validas.includes(fijada) ? fijada : null);
  useEffect(() => {
    if (!fijada && !previa) return;
    const alEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFijada(null);
        setPrevia(null);
      }
    };
    document.addEventListener('keydown', alEsc);
    return () => document.removeEventListener('keydown', alEsc);
  }, [fijada, previa]);
  return {
    activa,
    fijada: fijada && validas.includes(fijada) ? fijada : null,
    alternar: (k: T) => setFijada((f) => (f === k ? null : k)),
    entrar: (k: T) => conHover() && setPrevia(k),
    salir: () => setPrevia(null),
  };
}

function Barra({ f, linea, activa, pulsada, masVendida, onAlternar, onEntrar, onSalir }: { f: FilaBarra; linea: boolean; activa: boolean; pulsada: boolean; masVendida: boolean; onAlternar: () => void; onEntrar: () => void; onSalir: () => void }) {
  const nombre = f.mercado ? MERCADO_LABEL[f.mercado] : 'Otros';
  const color = f.mercado ? COLOR[f.mercado] : COLOR.otros;
  return (
    <li>
      <button
        type="button"
        className={`barra${linea ? ' barra--linea' : ''}${activa && !pulsada ? ' barra--activa' : ''}`}
        data-barra={f.clave}
        aria-pressed={pulsada}
        onClick={onAlternar}
        onMouseEnter={onEntrar}
        onMouseLeave={onSalir}
      >
        <span className="barra__nombre">
          {f.programa && <span className="solo-lector">{PROGRAMA_LABEL[f.programa]} </span>}
          {f.mercado ? <MercadoConBandera mercado={f.mercado} etiqueta={nombre} /> : nombre}
          <span className="solo-lector">: {pescadoresTexto(f.pescadores)}, {f.pct}{PCT} del período</span>
          {masVendida && <span className="chip-mas-vendido">Más vendido</span>}
        </span>
        <span className="barra__riel" aria-hidden="true">
          <span className="barra__pieza" data-anim-ancho={(f.pescadores > 0 ? f.pct : 0).toString()} style={{ width: `${f.pescadores > 0 ? f.pct : 0}%`, background: color }} />
        </span>
        <span className="barra__valor" aria-hidden="true">
          {f.pescadores.toLocaleString('es-CL')} · {f.pct}
          {PCT}
        </span>
      </button>
    </li>
  );
}

export function GraficoBarras({ ventana, masVendida, ancho }: { ventana: VentasVentana; masVendida: string | null; ancho: number }) {
  const { grupos, otros } = barrasDe(ventana);
  const todas = [...grupos.flatMap((g) => g.filas), ...(otros ? [otros] : [])];
  const sel = useSeleccion(todas.map((f) => f.clave));
  const activa = todas.find((f) => f.clave === sel.activa) ?? null;
  const linea = ancho >= 768;
  const fila = (f: FilaBarra) => (
    <Barra
      key={f.clave}
      f={f}
      linea={linea}
      activa={sel.activa === f.clave}
      pulsada={sel.fijada === f.clave}
      masVendida={masVendida === f.clave}
      onAlternar={() => sel.alternar(f.clave)}
      onEntrar={() => sel.entrar(f.clave)}
      onSalir={sel.salir}
    />
  );
  return (
    <figure className="grafico tarjeta" data-grafico="barras">
      <figcaption>
        <h3 className="grafico__titulo parte-titulo" data-parte="titulo">
          <Icono concepto="grafico-barras" />
          Pescadores por programa y mercado
        </h3>
      </figcaption>
      {grupos.map((g) => (
        <div key={g.programa} className="grafico__grupo" data-grupo={g.programa} data-parte="detalle">
          <div className="grafico__cabeza" data-parte="badge">
            <BadgePrograma codigo={g.programa} />
            <span>
              {[pescadoresTexto(g.pescadores), g.jornadas != null ? jornadasTexto(g.jornadas) : null, reservasTexto(g.reservas), `${g.pct}${PCT}`].filter(Boolean).join(' · ')}
            </span>
          </div>
          {g.filas.length > 0 && <ul className="grafico__lista">{g.filas.map(fila)}</ul>}
        </div>
      ))}
      {otros && (
        <div className="grafico__grupo" data-parte="detalle">
          <ul className="grafico__lista">{fila(otros)}</ul>
        </div>
      )}
      <p className="grafico__detalle" data-parte="detalle" data-detalle-grafico="barras">
        {activa ? detalleBarra(activa) : 'Toca una barra para ver el detalle.'}
      </p>
    </figure>
  );
}

/** Geometría de un arco sobre un círculo de radio r (fracciones 0–1). */
export function arco(r: number, inicio: number, largo: number, separacion: number): { dash: string; offset: string } {
  const C = 2 * Math.PI * r;
  const l = largo * C;
  const sep = l > separacion ? separacion : 0;
  return { dash: `${Math.max(0, l - sep).toFixed(2)} ${C.toFixed(2)}`, offset: (-(inicio * C + sep / 2)).toFixed(2) };
}
export const SEPARACION_DONA = 2;

export function GraficoDona({ ventana, ancho }: { ventana: VentasVentana; ancho: number }) {
  const sectores = sectoresDe(ventana);
  const sel = useSeleccion<ClaveSector>(sectores.map((s) => s.clave));
  const activa = sectores.find((s) => s.clave === sel.activa) ?? null;
  const grande = ancho >= 520;
  const S = grande ? 200 : 160;
  const trazo = grande ? 32 : 28;
  // 4 px de aire para que el sector activo crezca hacia afuera sin salirse.
  const r = S / 2 - trazo / 2 - 4;
  const total = sectores.reduce((a, s) => a + s.pescadores, 0);
  const conSector = sectores.filter((s) => s.largo > 0).length;
  const sep = conSector > 1 ? SEPARACION_DONA : 0;
  return (
    <figure className="grafico tarjeta" data-grafico="dona">
      <figcaption>
        <h3 className="grafico__titulo parte-titulo" data-parte="titulo">
          <Icono concepto="grafico-dona" />
          Pescadores por mercado
        </h3>
      </figcaption>
      <div className={`dona${grande ? ' dona--lado' : ''}`} data-parte="detalle">
        <div className="dona__lienzo" style={{ width: S, height: S }}>
          <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true" focusable="false" data-dona-sep={sep}>
            <circle cx={S / 2} cy={S / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={trazo} />
            <g transform={`rotate(-90 ${S / 2} ${S / 2})`}>
              {sectores.map((s: Sector) => {
                const act = sel.activa === s.clave;
                const rr = act ? r + 2 : r;
                const g = arco(rr, s.inicio, s.largo, sep);
                return (
                  <circle
                    key={s.clave}
                    className="dona__sector"
                    data-arco={s.clave}
                    data-inicio={s.inicio}
                    data-largo={s.largo}
                    cx={S / 2}
                    cy={S / 2}
                    r={rr}
                    fill="none"
                    stroke={COLOR[s.clave]}
                    strokeWidth={act ? trazo + 4 : trazo}
                    strokeDasharray={g.dash}
                    strokeDashoffset={g.offset}
                    onClick={() => sel.alternar(s.clave)}
                    onMouseEnter={() => sel.entrar(s.clave)}
                    onMouseLeave={sel.salir}
                  />
                );
              })}
            </g>
          </svg>
          <div className="dona__centro" aria-hidden="true">
            <span className="dona__centro-cifra">{(activa ? activa.pescadores : total).toLocaleString('es-CL')}</span>
            <span className="dona__centro-texto">{activa ? NOMBRE_SECTOR[activa.clave] : total === 1 ? 'pescador' : 'pescadores'}</span>
          </div>
        </div>
        <ul className="leyenda">
          {sectores.map((s) => {
            const nombre = NOMBRE_SECTOR[s.clave];
            const bandera = s.clave === 'sin' ? null : banderaDeMercado(s.clave);
            const pulsada = sel.fijada === s.clave;
            return (
              <li key={s.clave}>
                <button
                  type="button"
                  className={`leyenda__boton${sel.activa === s.clave && !pulsada ? ' leyenda__boton--activa' : ''}`}
                  data-sector={s.clave}
                  aria-pressed={pulsada}
                  onClick={() => sel.alternar(s.clave)}
                  onMouseEnter={() => sel.entrar(s.clave)}
                  onMouseLeave={sel.salir}
                >
                  <span className="leyenda__muestra" aria-hidden="true" style={{ background: COLOR[s.clave] }} />
                  <span className="leyenda__nombre">
                    {bandera && (
                      <span aria-hidden="true" className="bandera" style={{ marginRight: 6 }}>
                        {bandera}
                      </span>
                    )}
                    {nombre}
                    <span className="solo-lector">: {pescadoresTexto(s.pescadores)}, {s.pct}{PCT} del período</span>
                  </span>
                  <span className="leyenda__valor" aria-hidden="true">
                    {s.pescadores.toLocaleString('es-CL')} · {s.pct}
                    {PCT}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="grafico__detalle" data-parte="detalle" data-detalle-grafico="dona">
        {activa ? detalleSector(activa) : 'Toca un mercado para ver el detalle.'}
      </p>
    </figure>
  );
}
