import { BadgePrograma, MercadoConBandera } from '../../components/BadgePrograma';
import { MERCADO_LABEL } from '../../lib/fichaPescador';
import { masVendido, PCT, mercadosOrdenados, ORDEN_MERCADOS, ORDEN_PROGRAMAS, pctMix, segmento, sinClasificar, totalesMix, type Mix } from '../../lib/ventasMix';
import type { VentasMercadoMix, VentasTarifa } from '../../types';

/** Bloque «Qué se vende» (spec-ventas-mix.md §5). Solo conteos, sin plata.
 *  Las barras son decorativas (aria-hidden): cada fila dice su número y su %.
 *  Todas usan la misma escala, la participación sobre el total de pescadores
 *  de la temporada, así la barra dice lo mismo que el % que va al lado. Es la
 *  decisión registrada en spec-ventas-mix.md, «Decisiones del jefe» (17-oct),
 *  que manda sobre §5 y CA5. */

const n = (x: number) => x.toLocaleString('es-CL');
/** Backend anterior sin la clave, o un valor raro: 0. */
const incompletas = (x: { jornadas_incompletas?: number }) => (typeof x.jornadas_incompletas === 'number' && x.jornadas_incompletas > 0 ? x.jornadas_incompletas : 0);
const plural = (x: number, uno: string, varios: string) => `${n(x)} ${x === 1 ? uno : varios}`;

function Barra({ valor, max }: { valor: number; max: number }) {
  return (
    <span className="mix-riel" aria-hidden="true">
      {valor > 0 && max > 0 && <span className="mix-barra" style={{ width: `${(valor / max) * 100}%` }} />}
    </span>
  );
}

export function QueSeVende({ mix, tarifas, idBase }: { mix: Mix; tarifas: VentasTarifa[] | undefined; idBase: string }) {
  const { pescadores: N } = totalesMix(mix);
  const mercados = mercadosOrdenados(mix);
  const lider = masVendido(mix);
  const sin = sinClasificar(mix);
  const conTarifa = (p: string, m: string): boolean | null => (Array.isArray(tarifas) ? tarifas.some((f) => f.programa === p && f.mercado === m) : null);

  return (
    <section className="mix" aria-labelledby={`${idBase}-mix`} style={{ marginTop: 'var(--space-8)' }}>
      <h2 id={`${idBase}-mix`} style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
        Qué se vende
      </h2>
      <p className="mix-tenue" style={{ margin: '-6px 0 12px' }}>
        Pescadores confirmados de la temporada, por mercado y por programa.
      </p>
      <div className="mix-tarjeta">
        <div className="mix-grid">
          <div data-mix="mercados">
            <h3 className="mix-h3">Por mercado</h3>
            <ul className="mix-lista">
              {mercados.map((m) => (
                <li key={m.mercado} data-mercado={m.mercado}>
                  <span className="mix-cabeza">
                    <MercadoConBandera mercado={m.mercado} etiqueta={MERCADO_LABEL[m.mercado]} />
                    <span className="mix-cifra">
                      <span aria-hidden="true">
                        <strong>{n(m.pescadores)}</strong> · {pctMix(m.pescadores, N)}
                        {PCT}
                      </span>
                      <span className="solo-lector">
                        , {plural(m.pescadores, 'pescador', 'pescadores')}, {pctMix(m.pescadores, N)}
                        {PCT}
                      </span>
                    </span>
                  </span>
                  <Barra valor={m.pescadores} max={N} />
                </li>
              ))}
            </ul>
          </div>
          <div data-mix="programas">
            <h3 className="mix-h3">Por programa</h3>
            {ORDEN_PROGRAMAS.map((p) => {
              const prog = mix.programas.find((x) => x.programa === p) ?? { reservas: 0, pescadores: 0, unidades: 0, jornadas_incompletas: 0 };
              const cabecera =
                prog.pescadores === 0 && prog.reservas === 0
                  ? '0 pescadores'
                  : [plural(prog.pescadores, 'pescador', 'pescadores'), p === 'FULL_DAY' ? plural(prog.unidades, 'jornada', 'jornadas') : null, plural(prog.reservas, 'reserva', 'reservas'), `${pctMix(prog.pescadores, N)}${PCT}`]
                      .filter(Boolean)
                      .join(' · ');
              return (
                <div key={p} className="mix-grupo" data-programa-mix={p}>
                  <h4 className="mix-h4">
                    <BadgePrograma codigo={p} /> <span data-cabecera-programa="">{cabecera}</span>
                  </h4>
                  {p === 'FULL_DAY' && incompletas(prog) > 0 && (
                    <p className="mix-tenue" data-jornadas-incompletas="" style={{ margin: '2px 0 0' }}>
                      + {plural(incompletas(prog), 'reserva sin jornadas calculadas', 'reservas sin jornadas calculadas')} (falta la fecha de llegada o de salida)
                    </p>
                  )}
                  {prog.reservas === 0 ? (
                    <p className="mix-tenue" style={{ margin: '4px 0 0' }}>
                      Sin ventas todavía.
                    </p>
                  ) : (
                    <ul className="mix-lista">
                      {ORDEN_MERCADOS.map((m) => {
                        const s = segmento(mix, p, m);
                        const tarifa = conTarifa(p, m);
                        // Spec §5.2: AI Chile no tiene tarifa; en 0 dice «No se vende».
                        const noSeVende = p === 'ALL_INCLUSIVE' && m === 'CL' && s.reservas === 0 && tarifa !== true;
                        const esLider = lider != null && lider.programa === p && lider.mercado === m;
                        return (
                          <li key={m} data-segmento={`${p}:${m}`}>
                            <span className="mix-cabeza">
                              <MercadoConBandera mercado={m} etiqueta={MERCADO_LABEL[m]} />
                              <span className="mix-cifra">
                                {noSeVende ? (
                                  'No se vende'
                                ) : (
                                  <>
                                    <strong aria-hidden="true">{n(s.pescadores)}</strong>
                                    <span className="solo-lector">, {plural(s.pescadores, 'pescador', 'pescadores')}</span>
                                  </>
                                )}
                              </span>
                            </span>
                            {!noSeVende && <Barra valor={s.pescadores} max={N} />}
                            {!noSeVende && (
                              <span className="mix-detalle">
                                {plural(s.reservas, 'reserva', 'reservas')}
                                {s.reservas > 0 && tarifa === false ? ' · sin tarifa' : ''}
                                {esLider && <span className="mix-chip">Más vendido</span>}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
            {sin.reservas > 0 && (
              <p className="mix-tenue" data-sin-clasificar="" style={{ margin: '12px 0 0' }}>
                Sin programa o mercado: {plural(sin.pescadores, 'pescador', 'pescadores')} en {plural(sin.reservas, 'reserva', 'reservas')}.
              </p>
            )}
          </div>
        </div>
        <p className="mix-tenue" style={{ margin: '12px 0 0' }}>
          Los porcentajes están redondeados.
        </p>
      </div>
    </section>
  );
}

/** «🇺🇸 USA y otros 4 · 🇧🇷 Brasil 1»: mercados con pescadores de un mes, en orden fijo. */
export function MercadosMes({ mercados }: { mercados: VentasMercadoMix[] }) {
  if (mercados.length === 0) return <>—</>;
  return (
    <>
      {mercados.map((m, i) => (
        <span key={m.mercado} style={{ whiteSpace: 'nowrap' }}>
          {i > 0 && ' · '}
          <MercadoConBandera mercado={m.mercado} etiqueta={MERCADO_LABEL[m.mercado]} /> {n(m.pescadores)}
        </span>
      ))}
    </>
  );
}
