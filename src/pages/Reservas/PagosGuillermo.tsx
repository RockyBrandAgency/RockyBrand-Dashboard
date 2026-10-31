import { useEffect, useId, useRef, useState } from 'react';
import { actualizarReserva, ErrorTransitorio, esReservaModificada, MENSAJE_RESERVA_MODIFICADA, TimeoutError, UnauthorizedError } from '../../api/dashboardApi';
import { fmtMonto } from '../../lib/fichaPescador';
import type { PagoProveedor } from '../../types';

// Edición de los pagos a Guillermo (30-oct, ficha-finanzas-reserva): dólar
// acordado y la lista de pagos en CLP. Guarda con el PUT de la reserva, que
// reemplaza la lista entera. Los montos que se ven arriba (total, pagado, por
// pagar) los calcula el servidor: al guardar, la pantalla recarga.
//
// Revisión UX del 30-oct: los pagos guardados se ven cerrados, como filas de
// lectura con «Editar» y «Quitar»; solo uno abierto a la vez. La vista previa
// (costo en CLP, suma y lo que queda) es local y orientativa: la cifra que
// vale es la que devuelve el servidor.

interface Fila {
  clave: number;
  PaymentID?: string;
  fecha: string;
  monto: string;
  nota: string;
}

const etiqueta: React.CSSProperties = { display: 'block', fontSize: 14, lineHeight: '18px', color: 'var(--text-sub)' };
const campo: React.CSSProperties = {
  width: '100%',
  marginTop: 6,
  fontSize: 14,
  lineHeight: '18px',
  minHeight: 48,
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  background: 'var(--white)',
  color: 'var(--text)',
};

/** «4.120.200», «4120200» o «4 120 200» → 4120200. null si no es un entero > 0. */
export function leerMontoClp(texto: string): number | null {
  const limpio = texto.replace(/[.\s]/g, '');
  if (!/^\d+$/.test(limpio)) return null;
  const n = Number(limpio);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

// Dólar acordado (30-oct, revisión de código): convención chilena, igual que
// leerMontoClp: «.» separa miles y «,» es el decimal. «1.000» es mil (antes se
// leía 1) y «981.5» se rechaza en vez de adivinar.
const DOLAR_CHILENO = /^(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/;
export const MENSAJE_DOLAR_INVALIDO = 'El dólar acordado tiene que ser un número mayor que cero, por ejemplo 981 o 981,50.';
export const MENSAJE_DOLAR_DECIMALES = 'Máximo 2 decimales';
/** Fuera de este rango se avisa sin bloquear: CLP por 1 USD. */
export const DOLAR_RANGO = { min: 100, max: 5000 } as const;

/** Por qué el texto del dólar no sirve; null si sirve o está vacío (sin acordar). */
export function errorDolar(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  if (!DOLAR_CHILENO.test(t)) return MENSAJE_DOLAR_INVALIDO;
  if ((t.split(',')[1] ?? '').length > 2) return MENSAJE_DOLAR_DECIMALES;
  return Number(t.replace(/\./g, '').replace(',', '.')) > 0 ? null : MENSAJE_DOLAR_INVALIDO;
}

/** «981», «981,5» o «1.000» → número > 0; vacío → null (sin acordar); inválido → NaN. */
export function leerDolar(texto: string): number | null {
  const t = texto.trim();
  if (!t) return null;
  if (errorDolar(t)) return Number.NaN;
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

/** Aviso que no bloquea si el dólar parece mal tipeado (bajo 100 o sobre 5.000). */
export function avisoDolar(tasa: number | null): string | null {
  if (tasa == null || Number.isNaN(tasa) || (tasa >= DOLAR_RANGO.min && tasa <= DOLAR_RANGO.max)) return null;
  return `Revisa el dólar: CLP ${tasa.toLocaleString('es-CL', { maximumFractionDigits: 2 })} por 1 USD parece fuera de rango`;
}

function montoATexto(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toLocaleString('es-CL') : '';
}

export interface EditorPagosGuillermoProps {
  bookingId: string;
  dolar: number | null;
  pagos: PagoProveedor[];
  /** Costo de Guillermo en la moneda de su tarifa, para la vista previa. */
  costo?: { moneda: string; monto: number } | null;
  /** Cuántas unidades (pescadores o jornadas) y cómo se nombra una: «Un pescador». */
  unidades?: number | null;
  nombreUnidad?: string | null;
  /** Año del viaje: la fecha corta de un pago lleva año solo si es otro. */
  anioViaje?: number | null;
  /** UpdatedAt que leyó la ficha: va como ExpectedUpdatedAt (409 si cambió). */
  updatedAt?: string | null;
  /** Vuelve a cargar la reserva tras un 409 reserva_modificada. */
  onRecargar?: () => void;
  /** Hay una recarga pendiente tras un guardado propio de la ficha: no se guarda. */
  actualizando?: boolean;
  /** Bloqueado mientras hay una confirmación abierta en la ficha. */
  bloqueado: boolean;
  onGuardado: () => void;
  onCerrar: () => void;
  onUnauthorized: () => void;
}

/** «15 oct»; con año solo si no es el del viaje. */
export function fechaPagoCorta(iso: string | null | undefined, anioViaje?: number | null): string {
  if (!iso) return '';
  const d = iso.length <= 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const conAnio = anioViaje == null || d.getFullYear() !== anioViaje;
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' as const } : {}) }).replace(',', '');
}

/** El «%» de una nota no queda solo en la línea siguiente. */
export function notaSinCorte(nota: string): string {
  return nota.replace(/ %/g, ' %');
}

function huella(dolar: string, filas: Fila[]): string {
  return JSON.stringify([dolar.trim(), filas.map((f) => [f.PaymentID ?? '', f.fecha, f.monto.trim(), f.nota.trim()])]);
}

export function EditorPagosGuillermo({
  bookingId,
  dolar,
  pagos,
  costo = null,
  unidades = null,
  nombreUnidad = null,
  anioViaje = null,
  updatedAt = null,
  onRecargar,
  actualizando = false,
  bloqueado,
  onGuardado,
  onCerrar,
  onUnauthorized,
}: EditorPagosGuillermoProps) {
  const id = useId();
  const contador = useRef(0);
  const nueva = (p?: PagoProveedor): Fila => ({
    clave: contador.current++,
    PaymentID: p?.PaymentID,
    fecha: p?.Date ?? '',
    monto: p ? montoATexto(Number(p.Amount)) : '',
    nota: p?.Notes ?? '',
  });
  const textoDe = (d: number | null) => (d != null && Number.isFinite(Number(d)) ? Number(d).toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '');
  const filasDe = (ps: PagoProveedor[]) => [...ps].sort((a, b) => a.Date.localeCompare(b.Date)).map(nueva);
  const [textoDolar, setTextoDolar] = useState(() => textoDe(dolar));
  const [filas, setFilas] = useState<Fila[]>(() => filasDe(pagos));
  const inicial = useRef<string | null>(null);
  if (inicial.current === null) inicial.current = huella(textoDolar, filas);
  // Concurrencia (30-oct, ronda 4): la lista y el UpdatedAt se toman juntos al
  // abrir y no siguen al prop. Un PUT lleva ExpectedUpdatedAt=V solo si lo que
  // se edita es exactamente lo del servidor en V.
  const version = useRef<string | null>(updatedAt);
  const hayCambiosRef = useRef(false);
  // Clave del pago abierto; los demás se ven como filas de lectura.
  const [abierta, setAbierta] = useState<number | null>(null);
  const [descartar, setDescartar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorEn, setErrorEn] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // 409 reserva_modificada: lo escrito queda en pantalla hasta que se recargue.
  const [modificada, setModificada] = useState(false);
  const dolarRef = useRef<HTMLInputElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const agregarRef = useRef<HTMLButtonElement>(null);
  // Foco pendiente para después del render: un id de campo, o el «Quitar» en esa posición.
  const [enfocar, setEnfocar] = useState<{ campo?: string; quitar?: number; seguir?: boolean; cancelar?: boolean; recargar?: boolean } | null>(null);

  useEffect(() => {
    dolarRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!enfocar) return;
    const raiz = contenedorRef.current;
    if (enfocar.campo) document.getElementById(enfocar.campo)?.focus();
    else if (enfocar.quitar != null) {
      const botones = raiz?.querySelectorAll<HTMLButtonElement>('[data-quitar]') ?? [];
      (botones[enfocar.quitar] ?? agregarRef.current)?.focus();
    } else if (enfocar.seguir) raiz?.querySelector<HTMLButtonElement>('[data-accion="seguir"]')?.focus();
    else if (enfocar.cancelar) raiz?.querySelector<HTMLButtonElement>('[data-accion="cancelar"]')?.focus();
    else if (enfocar.recargar) raiz?.querySelector<HTMLButtonElement>('[data-accion="recargar"]')?.focus();
    setEnfocar(null);
  }, [enfocar]);

  const hayCambios = huella(textoDolar, filas) !== inicial.current;
  hayCambiosRef.current = hayCambios;

  // Llegó otra versión de la reserva con el editor abierto: sin cambios, se
  // rearma con lo nuevo; con cambios, se conserva la versión tomada al abrir
  // (si otro cambió la reserva, el servidor responde 409: correcto y seguro).
  useEffect(() => {
    if (updatedAt === version.current || hayCambiosRef.current) return;
    version.current = updatedAt;
    const td = textoDe(dolar);
    const fs = filasDe(pagos);
    inicial.current = huella(td, fs);
    setTextoDolar(td);
    setFilas(fs);
    setAbierta(null);
    setModificada(false);
    setError(null);
    setErrorEn(null);
    // Solo la versión dispara el rearmado: dólar y pagos llegan con ella.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedAt]);

  function limpiarError() {
    setError(null);
    setErrorEn(null);
  }

  function cambiar(clave: number, parte: Partial<Fila>) {
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...parte } : f)));
    limpiarError();
  }

  function agregar() {
    const f = nueva();
    setFilas((fs) => [...fs, f]);
    setAbierta(f.clave);
    setEnfocar({ campo: `${id}-${f.clave}-fecha` });
  }

  function abrir(clave: number) {
    setAbierta(clave);
    setEnfocar({ campo: `${id}-${clave}-fecha` });
  }

  function quitar(clave: number) {
    const i = filas.findIndex((f) => f.clave === clave);
    setFilas((fs) => fs.filter((f) => f.clave !== clave));
    if (abierta === clave) setAbierta(null);
    limpiarError();
    // Al «Quitar» que queda en esa posición; si no hay, a «Agregar pago».
    setEnfocar({ quitar: i });
  }

  function cerrar() {
    if (guardando) return;
    if (hayCambios) {
      setDescartar(true);
      setEnfocar({ seguir: true });
    } else onCerrar();
  }

  function fallar(texto: string, campoId: string, clave?: number) {
    setError(texto);
    setErrorEn(campoId);
    if (clave != null) setAbierta(clave);
    setEnfocar({ campo: campoId });
  }

  async function guardar() {
    if (guardando || bloqueado || modificada || actualizando) return;
    const problemaDolar = errorDolar(textoDolar);
    if (problemaDolar) return fallar(problemaDolar, `${id}-dolar`);
    const tasa = leerDolar(textoDolar);
    const lista: PagoProveedor[] = [];
    for (const [i, f] of filas.entries()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) return fallar(`Falta la fecha del pago ${i + 1}.`, `${id}-${f.clave}-fecha`, f.clave);
      const monto = leerMontoClp(f.monto);
      if (monto == null) return fallar(`El monto del pago ${i + 1} tiene que ser un número entero de pesos mayor que cero.`, `${id}-${f.clave}-monto`, f.clave);
      lista.push({ ...(f.PaymentID ? { PaymentID: f.PaymentID } : {}), Date: f.fecha, Amount: monto, Notes: f.nota.trim() });
    }
    setGuardando(true);
    limpiarError();
    try {
      const resp = await actualizarReserva(bookingId, {
        SupplierRate: tasa,
        SupplierPayments: lista,
        ...(version.current ? { ExpectedUpdatedAt: version.current } : {}),
      });
      // Igual que la licencia y los acompañantes: sin eco, la Lambda
      // desplegada es anterior e ignoró los campos.
      if (!resp || (!('SupplierPayments' in resp) && !('SupplierRate' in resp))) {
        setError('No se guardó: el servidor todavía no acepta los pagos a Guillermo.');
        return;
      }
      onGuardado();
    } catch (e) {
      if (e instanceof UnauthorizedError) return onUnauthorized();
      if (esReservaModificada(e)) {
        setModificada(true);
        setEnfocar({ recargar: true });
        return;
      }
      if (!navigator.onLine) setError('Sin conexión. Tus cambios siguen en pantalla; guarda cuando vuelva la conexión.');
      else if (e instanceof ErrorTransitorio && e.delServidor && e.message) setError(`No pudimos guardar los pagos. ${e.message}`);
      else if (e instanceof Error && !(e instanceof ErrorTransitorio) && !(e instanceof TimeoutError) && e.message) setError(`No pudimos guardar los pagos. ${e.message}`);
      else setError('No pudimos guardar los pagos. Tus cambios siguen en pantalla: vuelve a intentarlo.');
    } finally {
      setGuardando(false);
    }
  }

  const describe = (campoId: string) => (errorEn === campoId ? `${id}-error` : undefined);

  // Vista previa local (sin aria-live: se lee al llegar, no a cada tecla).
  const tasaPrevia = leerDolar(textoDolar);
  const tasaValida = tasaPrevia != null && !Number.isNaN(tasaPrevia) ? tasaPrevia : null;
  const totalPrevio = (() => {
    if (!costo) return null;
    if (costo.moneda === 'CLP') return Math.round(costo.monto);
    if (costo.moneda === 'USD' && tasaValida != null) return Math.round(costo.monto * tasaValida);
    return null;
  })();
  const sumaPagos = filas.reduce((t, f) => t + (leerMontoClp(f.monto) ?? 0), 0);
  const queda = totalPrevio != null ? totalPrevio - sumaPagos : null;
  const tasaTexto = tasaValida != null ? tasaValida.toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '';
  const fueraDeRango = avisoDolar(tasaValida);
  const describeDolar = [describe(`${id}-dolar`), fueraDeRango ? `${id}-rango` : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div
      ref={contenedorRef}
      className="editor-guillermo"
      data-editor="guillermo"
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || guardando) return;
        e.preventDefault();
        if (descartar) {
          setDescartar(false);
          setEnfocar({ cancelar: true });
        } else cerrar();
      }}
    >
      <fieldset disabled={guardando || bloqueado} className="editor-guillermo__campos">
        <legend className="editor-guillermo__leyenda">Editar dólar acordado y pagos a Guillermo</legend>
        <div className="editor-guillermo__dolar">
          <label htmlFor={`${id}-dolar`} style={etiqueta}>
            Dólar acordado (CLP por 1 USD)
          </label>
          <input
            ref={dolarRef}
            id={`${id}-dolar`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ej.: 981"
            value={textoDolar}
            onChange={(e) => {
              setTextoDolar(e.target.value);
              limpiarError();
            }}
            aria-invalid={errorEn === `${id}-dolar` || undefined}
            aria-describedby={describeDolar}
            style={campo}
          />
          {fueraDeRango && (
            <p id={`${id}-rango`} data-vista="dolar-rango" className="editor-guillermo__aviso">
              {fueraDeRango}
            </p>
          )}
        </div>
        {totalPrevio != null && costo && (
          <div className="editor-guillermo__previa" data-vista="costo">
            <p>
              {costo.moneda === 'USD'
                ? `Costo: ${fmtMonto('USD', costo.monto)} × ${tasaTexto} = ${fmtMonto('CLP', totalPrevio)}`
                : `Costo: ${fmtMonto('CLP', totalPrevio)}`}
            </p>
            {unidades != null && unidades > 1 && nombreUnidad && (
              <p data-vista="unidad">
                {nombreUnidad}: {fmtMonto('CLP', Math.round(totalPrevio / unidades))}
              </p>
            )}
          </div>
        )}
        {filas.length === 0 && <p className="editor-guillermo__vacio">Sin pagos a Guillermo.</p>}
        <ol className="editor-guillermo__pagos">
          {filas.map((f, i) =>
            abierta === f.clave ? (
              <li key={f.clave} data-fila={f.clave} className="editor-guillermo__pago">
                <fieldset className="editor-guillermo__pago-campos">
                  <legend className="solo-lector">Pago {i + 1}</legend>
                  <div className="editor-guillermo__pago-cabecera">
                    <span aria-hidden="true" className="editor-guillermo__pago-titulo">
                      Pago {i + 1}
                    </span>
                    <button type="button" data-quitar="" className="crm-btn crm-btn-ghost ficha-control editor-guillermo__boton" onClick={() => quitar(f.clave)} aria-label={`Quitar el pago ${i + 1}`}>
                      Quitar
                    </button>
                  </div>
                  <div className="editor-guillermo__celda">
                    <label htmlFor={`${id}-${f.clave}-fecha`} style={etiqueta}>
                      Fecha
                    </label>
                    <input
                      id={`${id}-${f.clave}-fecha`}
                      type="date"
                      value={f.fecha}
                      onChange={(e) => cambiar(f.clave, { fecha: e.target.value })}
                      aria-invalid={errorEn === `${id}-${f.clave}-fecha` || undefined}
                      aria-describedby={describe(`${id}-${f.clave}-fecha`)}
                      style={campo}
                    />
                  </div>
                  <div className="editor-guillermo__celda">
                    <label htmlFor={`${id}-${f.clave}-monto`} style={etiqueta}>
                      Monto (CLP)
                    </label>
                    <input
                      id={`${id}-${f.clave}-monto`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Ej.: 4.120.200"
                      value={f.monto}
                      onChange={(e) => cambiar(f.clave, { monto: e.target.value })}
                      aria-invalid={errorEn === `${id}-${f.clave}-monto` || undefined}
                      aria-describedby={describe(`${id}-${f.clave}-monto`)}
                      style={campo}
                    />
                  </div>
                  <div className="editor-guillermo__celda editor-guillermo__celda--nota">
                    <label htmlFor={`${id}-${f.clave}-nota`} style={etiqueta}>
                      Nota
                    </label>
                    <input
                      id={`${id}-${f.clave}-nota`}
                      type="text"
                      autoComplete="off"
                      placeholder="Ej.: 100 % de un pescador"
                      value={f.nota}
                      onChange={(e) => cambiar(f.clave, { nota: e.target.value })}
                      style={campo}
                    />
                  </div>
                </fieldset>
              </li>
            ) : (
              <li key={f.clave} data-fila={f.clave} className="editor-guillermo__pago editor-guillermo__pago--cerrado">
                <div className="editor-guillermo__lectura">
                  <span className="editor-guillermo__lectura-linea">
                    {[fechaPagoCorta(f.fecha, anioViaje) || 'Sin fecha', leerMontoClp(f.monto) != null ? fmtMonto('CLP', leerMontoClp(f.monto)!) : 'Sin monto'].join(' · ')}
                  </span>
                  {f.nota.trim() && <span className="editor-guillermo__lectura-nota">{notaSinCorte(f.nota.trim())}</span>}
                </div>
                <div className="editor-guillermo__lectura-acciones">
                  <button type="button" className="crm-btn crm-btn-ghost ficha-control editor-guillermo__boton" onClick={() => abrir(f.clave)} aria-label={`Editar el pago ${i + 1}`}>
                    Editar
                  </button>
                  <button type="button" data-quitar="" className="crm-btn crm-btn-ghost ficha-control editor-guillermo__boton" onClick={() => quitar(f.clave)} aria-label={`Quitar el pago ${i + 1}`}>
                    Quitar
                  </button>
                </div>
              </li>
            ),
          )}
        </ol>
        <button ref={agregarRef} type="button" className="crm-btn crm-btn-ghost ficha-control" onClick={agregar}>
          Agregar pago
        </button>
      </fieldset>
      <div className="editor-guillermo__previa editor-guillermo__suma" data-vista="suma">
        <p>Suma de pagos: {fmtMonto('CLP', sumaPagos)}</p>
        {queda != null && queda >= 0 && <p data-vista="queda">Queda por pagar: {fmtMonto('CLP', queda)}</p>}
        {queda != null && queda < 0 && (
          <p data-vista="de-mas" className="editor-guillermo__aviso">
            Con estos pagos le pagas {fmtMonto('CLP', -queda)} de más.
          </p>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="editor-guillermo__error">
          {error}
        </p>
      )}
      {modificada && (
        <div className="editor-guillermo__modificada" data-aviso="reserva-modificada">
          <p role="alert" className="editor-guillermo__error">
            {MENSAJE_RESERVA_MODIFICADA}
          </p>
          {onRecargar && (
            <button type="button" className="crm-btn crm-btn-primary ficha-control" data-accion="recargar" onClick={onRecargar}>
              Recargar
            </button>
          )}
        </div>
      )}
      {descartar ? (
        <div className="editor-guillermo__descartar" role="group" aria-labelledby={`${id}-descartar`}>
          <p id={`${id}-descartar`}>¿Descartar los cambios en los pagos?</p>
          <div className="editor-guillermo__acciones">
            <button type="button" className="crm-btn crm-btn-ghost ficha-control" data-accion="descartar" onClick={onCerrar}>
              Descartar
            </button>
            <button
              type="button"
              className="crm-btn crm-btn-primary ficha-control"
              data-accion="seguir"
              onClick={() => {
                setDescartar(false);
                setEnfocar({ cancelar: true });
              }}
            >
              Seguir editando
            </button>
          </div>
        </div>
      ) : (
        <div className="editor-guillermo__acciones">
          <button type="button" className="crm-btn crm-btn-ghost ficha-control" data-accion="cancelar" onClick={cerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="crm-btn crm-btn-primary ficha-control" onClick={() => void guardar()} disabled={guardando || bloqueado || modificada || actualizando}>
            {guardando ? 'Guardando…' : actualizando ? 'Actualizando…' : 'Guardar pagos'}
          </button>
        </div>
      )}
    </div>
  );
}
