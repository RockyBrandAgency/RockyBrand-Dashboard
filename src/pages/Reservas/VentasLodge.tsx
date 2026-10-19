import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AsyncState } from '../../components/AsyncState';
import { BadgePrograma, MercadoConBandera, RanuraBandera } from '../../components/BadgePrograma';
import { banderaDeMercado } from '../../lib/banderas';
import { Icono, type Concepto } from '../../lib/iconos';
import { ConflictError, ErrorTransitorio, getReservasResumen, getVentas, NoEncontradoError, SinPermisoError, SolicitudInvalidaError, UnauthorizedError } from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import { useAnchoContenido } from '../../hooks/useAnchoContenido';
import { useFuentesListas } from '../../hooks/useFuentesListas';
import { useRetornoFicha } from '../../hooks/useRetornoFicha';
import { fechaCorta, fmtDolar, fmtMonto, fmtPorcentaje, LICENCIA_INCLUIDA, MERCADO_LABEL, mesLargo, motivoSinUtilidad, PROGRAMA_LABEL } from '../../lib/fichaPescador';
import { terminologiaPms } from '../../lib/terminologiaPms';
import { cuadra, fraseMix, hoyChile, mercadosDelMes, mixDe } from '../../lib/ventasMix';
import { Chip } from './ChipVenta';
import { FichaPescador } from './FichaPescador';
import { MercadosMes, QueSeVende } from './QueSeVende';
import { ResumenPorPeriodo } from './ResumenPorPeriodo';
import { PERIODO_POR_DEFECTO, ventanasDe } from '../../lib/ventanasVentas';
import type { ReservaResumenItem, VentasCostoFijo, VentasMercadoMix, VentasMontos, VentasPeriodo, VentasReglaDescartada, VentasReserva, VentasResponse, VentasTarifa } from '../../types';

// Lodge → Ventas (5.0.0, ampliación del 16-oct; v2 del 17-oct según
// spec-ventas-v2.md). Lee GET /dashboard/ventas: todos los números los
// calcula el servidor; aquí solo se ordenan y se leen. Regla dura: cada
// moneda va por separado. USD y CLP nunca se suman, ni en el total ni en un
// mes. Un costo que el servidor pasó de CLP a USD con el dólar de la reserva
// ya llega en USD y suma en USD.

const ORDEN_MONEDAS = ['USD', 'CLP'];

/** «Vendido» a secas se leía como todo lo vendido: los montos por moneda
 *  solo suman las reservas con ganancia calculada (revisión del 17-oct). */
export const ETIQUETA_COBRADO = 'Cobrado con ganancia calculada';

export type SinCalcular = Record<string, { n: number; venta: number; conMonto: number }>;

/** Reservas confirmadas sin ganancia calculada, por moneda de la reserva. El
 *  servidor no las suma en `por_moneda` ni en `totales`: se cuentan aparte,
 *  cada moneda por separado. */
export function sinCalcularPorMoneda(reservas: readonly VentasReserva[]): SinCalcular {
  const out: SinCalcular = {};
  for (const r of reservas) {
    if (typeof r.Utilidad === 'number' && Number.isFinite(r.Utilidad)) continue;
    if (!r.Moneda) continue;
    const a = (out[r.Moneda] ??= { n: 0, venta: 0, conMonto: 0 });
    a.n += 1;
    if (typeof r.Venta === 'number' && Number.isFinite(r.Venta)) {
      a.venta += r.Venta;
      a.conMonto += 1;
    }
  }
  return out;
}

/** USD primero, CLP después y el resto por orden alfabético. */
export function monedasEn(obj: Record<string, unknown> | null | undefined): string[] {
  const rango = (m: string) => {
    const i = ORDEN_MONEDAS.indexOf(m);
    return i === -1 ? ORDEN_MONEDAS.length : i;
  };
  return Object.keys(obj ?? {}).sort((a, b) => rango(a) - rango(b) || a.localeCompare(b));
}

/** Las monedas con algún monto: el servidor manda USD y CLP siempre, aunque
 *  valgan 0, y una fila «CLP 0» en un mes solo en USD no informa nada. */
export function monedasConMonto(obj: Record<string, VentasMontos> | null | undefined): string[] {
  return monedasEn(obj).filter((m) => {
    const v = obj?.[m];
    return !!v && [v.venta, v.costo, v.utilidad].some((x) => x != null && x !== 0);
  });
}

// Códigos de `reglas_descartadas[].motivo`, los de
// pms_utilidad.parsear_costos_programa_con_descartes: un código que no esté
// aquí cae en el texto genérico, nunca en el código crudo.
const MOTIVO_REGLA: Record<string, string> = {
  NO_ES_OBJETO: 'no tiene el formato de una regla',
  FORMATO_ANTIGUO: 'usa el formato antiguo (monto por pescador) y hay que reescribirla',
  CAMPO_FALTANTE: 'le falta un dato obligatorio',
  FECHA_INVALIDA: 'una fecha está mal escrita o el término es anterior al inicio',
  MONTO_INVALIDO: 'el monto está mal escrito o es negativo',
  MONEDA_INVALIDA: 'la moneda no es un código de tres letras, como USD o CLP',
  PROGRAMA_INVALIDO: 'el programa no es All Inclusive ni Full Day',
  MERCADO_INVALIDO: 'el mercado no es USA, Chile ni Brasil',
  UNIDAD_INVALIDA: 'la unidad no es por pescador ni por jornada',
  PESCADORES_POR_JORNADA_INVALIDO: 'los pescadores por jornada no son un número entero mayor que 0',
  PRECIO_INVALIDO: 'el precio de lista está mal escrito o no es mayor que 0',
  MONEDA_PRECIO_INVALIDA: 'falta la moneda del precio de lista o no es un código de tres letras, como USD o CLP',
};
export function motivoRegla(motivo: string | null | undefined): string {
  return (motivo && MOTIVO_REGLA[motivo]) || 'tiene un dato que falta o está mal escrito';
}

function fecha(iso: string | null | undefined, conAno = false): string {
  if (!iso) return '';
  if (conAno) return fechaCorta(iso);
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

// Defensivo: un campo que falte o no sea número se lee «—», nunca «NaN».
const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const monto = (moneda: string | null | undefined, v: number | null | undefined) => (esNumero(v) && moneda ? fmtMonto(moneda, v) : '—');
const pct = (v: number | null | undefined) => (esNumero(v) ? fmtPorcentaje(v) : '—');
const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-CL')} ${n === 1 ? uno : varios}`;

/** «+ 2 reservas sin calcular: USD 900». Sin monto si ninguna trae venta. */
export function textoSinCalcular(moneda: string, s: SinCalcular[string]): string {
  return `+ ${plural(s.n, 'reserva', 'reservas')} sin calcular${s.conMonto > 0 ? `: ${monto(moneda, s.venta)}` : ''}`;
}

function LineaSinCalcular({ moneda, s }: { moneda: string; s: SinCalcular[string] }) {
  return (
    <p data-sin-calcular={moneda} style={{ ...tenue, margin: '8px 0 0' }}>
      {textoSinCalcular(moneda, s)}
    </p>
  );
}

const tarjeta: React.CSSProperties = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, minWidth: 0 };
// line-height fijo: con «normal» el h2 medía 18 px con la fuente de reserva y 20 con Inter (CLS).
const titulo2: React.CSSProperties = { margin: '0 0 12px', fontSize: 16, fontWeight: 700, lineHeight: '18px', color: 'var(--text)' };
// --text-sub (#52525b) y no --text-faint (#a1a1aa, 2,54:1 sobre blanco):
// WCAG 2.2 1.4.3 pide 4,5:1 (spec-ventas-v2 H1).
const etiqueta: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const tenue: React.CSSProperties = { fontSize: 13, color: 'var(--text-sub)' };
const celdaMercados: React.CSSProperties = { textAlign: 'left', whiteSpace: 'normal', minWidth: 140 };
const celda: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid var(--border-soft)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', verticalAlign: 'top' };
const encabezado: React.CSSProperties = { ...celda, ...etiqueta, borderBottom: '1px solid var(--border)' };
/** Solo para el lector de pantalla. */
const oculto: React.CSSProperties = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };
/** Un monto no se parte en dos líneas («USD» arriba y la cifra abajo). */
const sinCorte: React.CSSProperties = { whiteSpace: 'nowrap' };
const cifra: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right' };
const enlaceAncla: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, color: 'inherit', fontWeight: 700, textDecoration: 'underline' };
const rojo = 'var(--status-critico-text)';

// Orden fijo de «Cuánto ganamos por venta» (spec §4.2); lo que no esté aquí va al final.
const ORDEN_LINEAS = ['FULL_DAY:USA', 'FULL_DAY:BR', 'FULL_DAY:CL', 'ALL_INCLUSIVE:USA', 'ALL_INCLUSIVE:BR'];
export function ordenarTarifas(tarifas: VentasTarifa[]): VentasTarifa[] {
  const rango = (f: VentasTarifa) => {
    const i = ORDEN_LINEAS.indexOf(`${f.programa}:${f.mercado}`);
    return i === -1 ? ORDEN_LINEAS.length : i;
  };
  return tarifas.slice().sort((a, b) => rango(a) - rango(b) || (a.desde ?? '').localeCompare(b.desde ?? ''));
}

function Indicador({ titulo, valor, unidad, detalle, aviso }: { titulo: React.ReactNode; valor: number; unidad: string; detalle: string; aviso?: string | null }) {
  return (
    <div style={tarjeta}>
      <div style={etiqueta}>{titulo}</div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{valor.toLocaleString('es-CL')}</span>
        <span style={{ fontSize: 15, color: 'var(--text-sub)' }}>{unidad}</span>
      </div>
      <div style={{ ...tenue, marginTop: 4 }}>{detalle}</div>
      {aviso && <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 6, fontWeight: 600 }}>{aviso}</div>}
    </div>
  );
}

function Montos({ moneda, m, sinGanancia = false }: { moneda: string; m: VentasMontos; sinGanancia?: boolean }) {
  const filas: [string, string][] = [
    [ETIQUETA_COBRADO, monto(moneda, m.venta)],
    ['Costo', monto(moneda, m.costo)],
    ...(sinGanancia ? [] : ([['Ganancia', monto(moneda, m.utilidad)]] as [string, string][])),
    ['Margen', pct(m.porcentaje)],
  ];
  return (
    <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '6px 12px', fontSize: 14 }}>
      {filas.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt style={{ color: 'var(--text-sub)', minWidth: 0 }}>{k}</dt>
          <dd style={{ margin: 0, textAlign: 'right', fontWeight: k === 'Ganancia' ? 700 : 500, color: k === 'Ganancia' && (m.utilidad ?? 0) < 0 ? rojo : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type EstadoFicha =
  | { estado: 'cargando' }
  | { estado: 'error'; mensaje: string }
  | { estado: 'aviso'; mensaje: string }
  | { estado: 'no-existe' }
  | { estado: 'ok'; reservas: ReservaResumenItem[] };

// 503 trae su propio mensaje («No pudimos leer la configuración…»): se muestra
// tal cual y con «Reintentar». Un corte de red o un 500, el texto genérico.
function mensajeReintentable(e: unknown, generico: string): string {
  return e instanceof ErrorTransitorio && e.delServidor ? e.message : generico;
}

// Cómo queda la ficha abierta desde Ventas cuando falla su reserva por
// booking_id. 400 y 409 explican el motivo: reintentar no sirve.
export function estadoFichaPorError(e: unknown): EstadoFicha {
  if (e instanceof NoEncontradoError) return { estado: 'no-existe' };
  // El 403 viene de /reservas-resumen (bandera pms_resumen), no de Ventas.
  if (e instanceof SinPermisoError) return { estado: 'aviso', mensaje: 'No tienes acceso a esta reserva desde esta cuenta.' };
  if (e instanceof SolicitudInvalidaError || e instanceof ConflictError) return { estado: 'aviso', mensaje: e.message };
  return { estado: 'error', mensaje: mensajeReintentable(e, 'No pudimos abrir la reserva. Revisa tu conexión y vuelve a intentarlo.') };
}

// Tablas o tarjetas según el ancho REAL del contenido (useAnchoContenido,
// mismo criterio que ReservasResumen), no según la ventana: a 1024 px, con la
// barra lateral, quedan 664 px y las tablas de 6 y 7 columnas partían cada
// monto en dos líneas (revisión del 17-oct). `tablas` (breakpoint desktop)
// solo decide mientras no hay medición.
export const ANCHO_TABLAS = 760;

export function VentasLodge({ isDesktop, tablas: tablasPorVentana }: { isDesktop: boolean; tablas: boolean }) {
  const [contenidoRef, anchoContenido] = useAnchoContenido<HTMLDivElement>();
  const tablas = anchoContenido === null ? tablasPorVentana : anchoContenido >= ANCHO_TABLAS;
  const { handleUnauthorized, clientId, clientTerminologia } = useAuth();
  const t = terminologiaPms(clientId, clientTerminologia);
  const id = useId();
  const [temporada, setTemporada] = useState<string | null>(null);
  const [datos, setDatos] = useState<VentasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // El contenido entra con la fuente ya cargada: sin salto al cambiar de fuente.
  const fuentesListas = useFuentesListas();
  const [error, setError] = useState<string | null>(null);
  // 409 (temporada sin configurar) y 400 (temporada mal escrita) no son
  // fallas de red: se explican sin «Reintentar».
  const [aviso, setAviso] = useState<{ titulo: string; detalle: string } | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  // La ficha pide su reserva por booking_id: la de /ventas no trae todo y la
  // lista de /reservas-resumen tiene ventana de fechas.
  const [fichaDatos, setFichaDatos] = useState<EstadoFicha>({ estado: 'cargando' });
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set());
  const [ficha, setFicha] = useState<string | null>(null);
  // El período vive aquí y no en el resumen: sobrevive a abrir una ficha (CA-V25).
  const [periodo, setPeriodo] = useState<VentasPeriodo>(PERIODO_POR_DEFECTO);
  const { scrollRef, recordar } = useRetornoFicha(ficha !== null);
  // Cada pedido lleva su número: si llega tarde (se abrió otra ficha, se
  // volvió a Ventas o se eligió otra temporada), su respuesta se descarta.
  const pedidoVentas = useRef(0);
  const pedidoFicha = useRef(0);
  const volverRef = useRef<HTMLButtonElement>(null);
  const mensajeRef = useRef<HTMLParagraphElement>(null);
  // Destinos de «Ver detalle» y «Ver cuáles» de la vista sin `ventanas`: el
  // foco va a su título. Con `ventanas` esas secciones no existen (19-oct).
  const porVentaRef = useRef<HTMLHeadingElement>(null);
  const sinCalcularRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(
    (temp: string | null) => {
      const n = ++pedidoVentas.current;
      setLoading(true);
      setError(null);
      setAviso(null);
      setSinConexion(false);
      getVentas(temp ?? undefined)
        .then((d) => {
          if (n === pedidoVentas.current) setDatos(d);
        })
        .catch((e: unknown) => {
          if (n !== pedidoVentas.current) return;
          if (e instanceof UnauthorizedError) return handleUnauthorized();
          if (e instanceof ConflictError) {
            return setAviso({ titulo: 'Falta configurar las fechas de la temporada.', detalle: 'Sin la fecha de inicio y de fin de la temporada no se pueden ordenar las ventas por mes.' });
          }
          if (e instanceof SinPermisoError) {
            return setAviso({ titulo: 'Ventas no está activa para esta cuenta.', detalle: 'Si la necesitas, pide que la activen.' });
          }
          if (e instanceof SolicitudInvalidaError) {
            return setAviso({ titulo: temp ? `La temporada ${temp} no es válida.` : 'Esa temporada no es válida.', detalle: 'Elige otra temporada de la lista.' });
          }
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setSinConexion(true);
            return setError('Sin conexión. Las ventas se cargan cuando vuelva la conexión.');
          }
          setError(mensajeReintentable(e, 'No pudimos cargar las ventas. Revisa tu conexión y vuelve a intentarlo.'));
        })
        .finally(() => {
          if (n === pedidoVentas.current) setLoading(false);
        });
    },
    [handleUnauthorized],
  );

  // La reserva va por booking_id (404 = no existe; otro error, «Reintentar»).
  // La lista con ventana solo suma los otros viajes del pescador: si falla,
  // la ficha abre igual.
  const cargarFicha = useCallback(
    // `silencioso`: después de guardar en la ficha se refresca sin desmontarla
    // (perdería su aviso de «guardado»); si ese refresco falla, queda lo que hay.
    (bookingId: string, silencioso = false) => {
      const n = ++pedidoFicha.current;
      if (!silencioso) setFichaDatos({ estado: 'cargando' });
      Promise.allSettled([getReservasResumen({ bookingId }), getReservasResumen()]).then(([una, lista]) => {
        if (n !== pedidoFicha.current) return;
        if (una.status === 'rejected') {
          if (una.reason instanceof UnauthorizedError) return handleUnauthorized();
          if (silencioso) return;
          return setFichaDatos(estadoFichaPorError(una.reason));
        }
        const item = una.value.reservas.find((r) => r.BookingID === bookingId);
        if (!item) return silencioso ? undefined : setFichaDatos({ estado: 'no-existe' });
        setFichaDatos((prev) => {
          // Si la lista falla en el refresco silencioso, siguen los viajes que ya había.
          const otras =
            lista.status === 'fulfilled'
              ? lista.value.reservas.filter((r) => r.BookingID !== bookingId)
              : silencioso && prev.estado === 'ok'
                ? prev.reservas.filter((r) => r.BookingID !== bookingId)
                : [];
          return { estado: 'ok', reservas: [item, ...otras] };
        });
      });
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    load(temporada);
  }, [load, temporada]);
  useEffect(() => {
    if (ficha) cargarFicha(ficha);
  }, [cargarFicha, ficha]);
  // E12: sin conexión, vuelve a pedir solo cuando la conexión vuelve.
  useEffect(() => {
    if (!sinConexion) return;
    const alVolver = () => load(temporada);
    window.addEventListener('online', alVolver);
    return () => window.removeEventListener('online', alVolver);
  }, [sinConexion, load, temporada]);
  // Mientras abre, el foco va a «← Ventas»; si no abre, al mensaje. Sin esto
  // queda en BODY y el teclado o el lector no saben qué pasó (WCAG 2.4.3).
  useEffect(() => {
    if (!ficha) return;
    if (fichaDatos.estado === 'cargando') volverRef.current?.focus();
    else if (fichaDatos.estado !== 'ok') mensajeRef.current?.focus();
  }, [ficha, fichaDatos.estado]);

  function cerrarFicha() {
    pedidoFicha.current++;
    setFicha(null);
  }

  if (ficha) {
    if (fichaDatos.estado !== 'ok') {
      return (
        <div className="ficha-pescador" style={{ flex: 1, background: 'var(--bg)' }}>
          <div className="contenedor-pagina" style={{ paddingTop: isDesktop ? 28 : 16 }}>
            <button ref={volverRef} type="button" className="crm-btn crm-btn-text crm-btn-sm" onClick={cerrarFicha} style={{ marginLeft: -12, minHeight: 44 }}>
              ← Ventas
            </button>
            {fichaDatos.estado === 'cargando' ? (
              <AsyncState loading error={null}>
                {null}
              </AsyncState>
            ) : (
              <div style={{ marginTop: 'var(--space-6)' }}>
                <p ref={mensajeRef} tabIndex={-1} role="alert" style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>
                  {fichaDatos.estado === 'no-existe' ? 'Esta reserva no existe. Puede que la hayan borrado: vuelve a Ventas para ver la lista al día.' : fichaDatos.mensaje}
                </p>
                {fichaDatos.estado === 'error' && (
                  <button type="button" className="crm-btn crm-btn-primary" style={{ marginTop: 12, minHeight: 44 }} onClick={() => cargarFicha(ficha)}>
                    Reintentar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    return (
      <FichaPescador
        bookingId={ficha}
        reservas={fichaDatos.reservas}
        volverA="Ventas"
        isDesktop={isDesktop}
        onVolver={cerrarFicha}
        onCambio={() => {
          load(temporada);
          cargarFicha(ficha, true);
        }}
      />
    );
  }

  // `fila` es el data-fila tocado: al volver, el foco vuelve a esa misma fila
  // (una reserva puede estar en su mes y también en «Sin calcular»).
  function abrir(bookingId: string, fila = bookingId) {
    recordar(fila);
    setFichaDatos({ estado: 'cargando' });
    setFicha(bookingId);
  }

  function alternar(mes: string) {
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(mes)) n.delete(mes);
      else n.add(mes);
      return n;
    });
  }

  const proveedores = [...new Set((datos?.costos_fijos ?? []).map((c) => c.proveedor).filter(Boolean))];
  const unProveedor = proveedores.length === 1 ? proveedores[0] : null;
  const resumen = datos?.resumen;
  // meses trae todo el período, también los vacíos: lo vacío se mide en reservas.
  const vacio = datos !== null && (resumen?.full_day.reservas ?? 0) === 0 && (resumen?.all_inclusive.reservas ?? 0) === 0 && datos.sin_calcular.length === 0;
  // El servidor las manda de la más nueva a la más vieja: se respeta su orden.
  // La elegida va en la lista aunque el servidor la rechace (400): así el
  // select y el aviso hablan de la misma temporada.
  const temporadas = datos ? [...new Set([...(datos.temporadas ?? []), datos.periodo.temporada, ...(temporada ? [temporada] : [])])] : [];
  const reservasVentas = new Map((datos?.meses ?? []).flatMap((m) => m.reservas.map((r) => [r.BookingID, r] as const)));
  const persona = (n: number) => plural(n, t.personaMinuscula, t.personasMinuscula);
  // Sin `tarifas` el servidor es anterior al 17-oct: se muestra la lista de costos de antes (E10).
  const tarifas = Array.isArray(datos?.tarifas) ? ordenarTarifas(datos!.tarifas!) : null;
  const descartadas = datos?.reglas_descartadas ?? [];
  // «Qué se vende» (17-oct): el mix lo calcula el servidor. Sin los bloques
  // (Lambda anterior) no hay mix y el resumen queda como antes.
  const mix = datos ? mixDe(datos) : null;
  const mixCuadra = mix != null && resumen != null && cuadra(mix, resumen);
  // Ventanas de 30 y 90 días y temporada (18-oct). Sin ellas, o mal formadas,
  // la página queda como antes (E3, CA-V31/32).
  const ventanas = datos ? ventanasDe(datos) : null;

  /** Monedas cuyo total incluye costos convertidos con el dólar, y desde qué moneda. */
  const convertidas = new Map<string, string>();
  for (const r of reservasVentas.values()) {
    if (r.CostoOriginal && r.Utilidad != null && r.CostoOriginal.moneda !== r.Moneda) convertidas.set(r.Moneda, r.CostoOriginal.moneda);
  }

  /** Motivo de «Sin calcular», con las monedas y el día del dólar cuando se pueden leer. */
  function motivoSin(s: VentasResponse['sin_calcular'][number]): { contexto: React.ReactNode; motivo: string } {
    const r = reservasVentas.get(s.BookingID);
    const costo = r && datos?.costos_fijos.find((c) => c.programa === r.Programa && c.mercado === r.Mercado);
    const contexto = r && (r.Programa || r.Mercado) ? programaMercado(r.Programa, r.Mercado) : null;
    return { contexto, motivo: motivoSinUtilidad(s.Reason, r?.Moneda ?? null, costo && costo.moneda !== r?.Moneda ? costo.moneda : null, r?.FechaConfirmacion ?? null) };
  }

  function irA(e: React.MouseEvent, destino: HTMLElement | null) {
    e.preventDefault();
    destino?.focus();
  }

  /** «[Full Day] 🇺🇸 USA»: badge del programa y mercado con bandera; `resto` sigue tras « · ». */
  function programaMercado(programa: string | null | undefined, mercado: string | null | undefined, resto: (string | null | undefined)[] = []) {
    const etiquetaMercado = mercado ? (MERCADO_LABEL[mercado as keyof typeof MERCADO_LABEL] ?? mercado) : null;
    const cola = resto.filter(Boolean).join(' · ');
    return (
      <>
        {programa && <BadgePrograma codigo={programa} />}
        {programa && etiquetaMercado && ' '}
        {etiquetaMercado && <MercadoConBandera mercado={mercado} etiqueta={etiquetaMercado} />}
        {(programa || etiquetaMercado) && cola ? ' · ' : ''}
        {cola}
      </>
    );
  }

  /** Una reserva dentro de su mes (spec §4.4): un solo botón, solo spans. */
  function filaReserva(r: VentasReserva) {
    const conGanancia = esNumero(r.Utilidad);
    const perdida = conGanancia && r.Utilidad! < 0;
    const bajoLista = r.BajoLista === true;
    // Tarjeta de venta (spec-ventas-cajas §15.2): nombre y chips, programa y
    // fechas, los cuatro datos y, si aplica, el costo original y el dólar.
    const datosFila: [string, Concepto, string, boolean][] = [
      ['Cobrado', 'venta', monto(r.Moneda, r.Venta), false],
      ['Costo', 'costo', monto(r.Moneda, r.Costo), false],
      ['Ganancia', perdida ? 'perdida' : 'ganancia', monto(r.Moneda, r.Utilidad), true],
      ['Margen', 'margen', pct(r.Porcentaje), true],
    ];
    const anchoFila = anchoContenido ?? (tablas ? ANCHO_TABLAS : 0);
    const cuatro = anchoFila >= 520;
    const etiquetaMercado = r.Mercado ? (MERCADO_LABEL[r.Mercado] ?? r.Mercado) : null;
    const dato = ([k, icono, v, fuerte]: [string, Concepto, string, boolean]) => (
      <span key={k} className={`dato-icono${fuerte ? ' dato-icono--fuerte' : ''}${fuerte && perdida ? ' dato-icono--perdida' : ''}`} data-dato={k} data-fila-dato={icono}>
        <span className="dato-icono__etiqueta">
          <Icono concepto={icono} />
          {k}
        </span>
        <span className="dato-icono__valor">{v}</span>
      </span>
    );
    return (
      <li key={r.BookingID}>
        <button type="button" className="fila-lista tarjeta tarjeta--boton fila-venta" data-fila={r.BookingID} onClick={() => abrir(r.BookingID)}>
          <span className="parte-badge" data-parte="badge">
            <span className="fila-venta__marca">
              {r.Programa && <BadgePrograma codigo={r.Programa} />}
              {etiquetaMercado && (
                <span className="fila-venta__pais">
                  <RanuraBandera bandera={banderaDeMercado(r.Mercado)} />
                  {etiquetaMercado}
                </span>
              )}
            </span>
            {(bajoLista || perdida) && (
              <span className="fila-venta__chips">
                {bajoLista && <Chip>Bajo lista</Chip>}
                {perdida && <Chip critico>Pérdida</Chip>}
              </span>
            )}
          </span>
          <span className="parte-titulo fila-venta__nombre" data-parte="titulo">
            {r.GuestName || r.BookingID}
          </span>
          <span className="fila-venta__meta" data-parte="detalle">
            <span className="fila-venta__meta-item">
              <Icono concepto="fechas" />
              {`${fecha(r.CheckIn)} – ${fecha(r.CheckOut)}`}
            </span>
            {r.Pescadores != null && (
              <span className="fila-venta__meta-item">
                <Icono concepto="pescadores" />
                {persona(r.Pescadores)}
              </span>
            )}
            {r.Programa === 'FULL_DAY' && r.Jornadas != null && (
              <span className="fila-venta__meta-item">
                <Icono concepto="jornadas" />
                {plural(r.Jornadas, 'jornada', 'jornadas')}
              </span>
            )}
          </span>
          <span className="grupo grupo--div fila-venta__plata" data-parte="detalle">
            <span className={`fila-venta__grupos${cuatro ? ' fila-venta__grupos--cuatro' : ''}`}>
              <span className="fila-venta__datos">{datosFila.slice(0, 2).map(dato)}</span>
              <span className="fila-venta__datos resultado" data-resultado="">
                {datosFila.slice(2).map(dato)}
              </span>
            </span>
          </span>
          {!conGanancia && <span className="fila-venta__nota">{motivoSin({ BookingID: r.BookingID, GuestName: r.GuestName, Reason: r.Reason }).motivo}</span>}
          {bajoLista && esNumero(r.PrecioLista) && esNumero(r.Venta) && (
            <span className="fila-venta__nota">
              <Icono concepto="precio-lista" />
              <span>
                Lista {monto(r.Moneda, r.PrecioLista)} · se cobró {monto(r.Moneda, r.PrecioLista - r.Venta)} menos
              </span>
            </span>
          )}
          {r.CostoOriginal && esNumero(r.CostoOriginal.monto) && (
            <span className="fila-venta__nota">
              <Icono concepto="dolar" />
              <span>
                Costo {monto(r.CostoOriginal.moneda, r.CostoOriginal.monto)}
                {r.Dolar && esNumero(r.Dolar.valor) ? ` · dólar ${fmtDolar(r.Dolar.valor)} del ${fechaCorta(r.Dolar.fecha)}` : ''}
              </span>
            </span>
          )}
          <span className="fila-venta__ver" aria-hidden="true">
            Ver ficha ›
          </span>
        </button>
      </li>
    );
  }

  function listaReservas(lista: VentasReserva[], idLista: string) {
    if (lista.length === 0) return <p style={{ ...tenue, margin: '8px 0' }}>Sin reservas confirmadas en este mes.</p>;
    const porLlegada = lista.slice().sort((a, b) => (a.CheckIn ?? '').localeCompare(b.CheckIn ?? ''));
    return (
      <>
        <ul id={idLista} style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {porLlegada.map(filaReserva)}
        </ul>
      </>
    );
  }

  const fullDayMes = (reservas: number, jornadas: number) => (reservas > 0 ? plural(jornadas, 'jornada', 'jornadas') : '—');
  const allInclusiveMes = (reservas: number, pescadores: number) => (reservas > 0 ? persona(pescadores) : '—');

  // Defensivo: el servidor manda solo reglas validadas, pero un campo que
  // falte se omite o se dice, nunca se pinta «undefined» ni «NaN».
  function textoCosto(c: VentasCostoFijo): React.ReactNode {
    const unidad = c.unidad === 'jornada' ? 'jornada' : c.unidad === 'pescador' ? t.personaMinuscula : null;
    const hayMonto = typeof c.monto === 'number' && Number.isFinite(c.monto) && typeof c.moneda === 'string' && c.moneda !== '';
    const precio = hayMonto ? `${fmtMonto(c.moneda, c.monto)}${unidad ? ` por ${unidad}` : ''}` : 'monto sin dato';
    let s = precio;
    const pj = c.pescadores_por_jornada;
    if (c.unidad === 'jornada' && typeof pj === 'number' && Number.isFinite(pj) && pj > 0) s += `, hasta ${persona(pj)}`;
    if (c.incluye_licencia) s += ` · Licencia: ${LICENCIA_INCLUIDA}`;
    return (
      <>
        {unProveedor || !c.proveedor ? '' : `${c.proveedor}: `}
        {programaMercado(c.programa, c.mercado, [s])}
      </>
    );
  }

  function textoDescartada(r: VentasReglaDescartada): string {
    const cual = [r.programa ? (PROGRAMA_LABEL[r.programa as keyof typeof PROGRAMA_LABEL] ?? r.programa) : null, r.proveedor && !unProveedor ? r.proveedor : null].filter(Boolean).join(', ');
    const n = Number.isFinite(r.indice) ? `Regla ${r.indice + 1}` : 'Una regla';
    return `${n}${cual ? ` (${cual})` : ''}: ${motivoRegla(r.motivo)}.`;
  }

  // --- «Cuánto ganamos por venta» ---

  function nombreLinea(f: VentasTarifa): React.ReactNode {
    return programaMercado(f.programa, f.mercado);
  }
  function unidadLinea(f: VentasTarifa): string {
    if (f.unidad === 'jornada') {
      const pj = f.pescadores_por_jornada;
      return esNumero(pj) && pj > 0 ? `por jornada, hasta ${persona(pj)}` : 'por jornada';
    }
    return `por ${t.personaMinuscula}`;
  }
  /** Con dos reglas para la misma línea, cuál rige cuándo. */
  function vigencia(f: VentasTarifa): string | null {
    const misma = (tarifas ?? []).filter((o) => o.programa === f.programa && o.mercado === f.mercado);
    if (misma.length < 2) return null;
    if (f.hasta) return `hasta el ${fecha(f.hasta, true)}`;
    return f.desde ? `desde el ${fecha(f.desde, true)}` : null;
  }
  const difiere = (f: VentasTarifa) => !!f.precio && !!f.costo && f.costo.moneda !== f.precio.moneda;
  function costoLinea(f: VentasTarifa): { principal: string; detalle: string | null } {
    if (difiere(f) && esNumero(f.costo_convertido)) {
      return {
        principal: monto(f.precio!.moneda, f.costo_convertido),
        detalle: `${monto(f.costo.moneda, f.costo.monto)}${f.dolar && esNumero(f.dolar.valor) ? ` al dólar de ${fmtDolar(f.dolar.valor)}` : ''}`,
      };
    }
    return { principal: monto(f.costo?.moneda, f.costo?.monto), detalle: null };
  }
  /** Nota del dólar, solo en las líneas que convierten (Brasil Full Day). */
  function notaDolar(f: VentasTarifa): string | null {
    if (!difiere(f)) return null;
    if (!f.dolar || !esNumero(f.dolar.valor) || !esNumero(f.ganancia)) {
      return 'No hay dólar observado disponible: la ganancia no se calcula. Vuelve a cargar más tarde.';
    }
    // Costo en CLP y precio en USD: si el dólar baja, el costo en USD sube.
    const sentido = f.costo.moneda === 'CLP' ? 'baja' : 'sube';
    const equilibrio = esNumero(f.dolar_equilibrio) ? ` Si el dólar ${sentido} de ${fmtDolar(f.dolar_equilibrio)}, esta venta pierde plata.` : '';
    return `Dólar observado del ${fechaCorta(f.dolar.fecha)} (${f.dolar.fuente}). Cada reserva usa el dólar del día en que se confirmó.${equilibrio}`;
  }
  function vendidasLinea(f: VentasTarifa): string {
    const u = f.vendidas?.unidades;
    if (!esNumero(u)) return '—';
    return f.unidad === 'jornada' ? plural(u, 'jornada', 'jornadas') : persona(u);
  }
  const precioLinea = (f: VentasTarifa) => (f.precio ? monto(f.precio.moneda, f.precio.monto) : 'Sin precio de lista');
  const gananciaLinea = (f: VentasTarifa) => (f.precio ? monto(f.precio.moneda, f.ganancia) : '—');
  const gananciaNegativa = (f: VentasTarifa) => esNumero(f.ganancia) && f.ganancia < 0;

  function bloquePorVenta() {
    if (!datos) return null;
    return (
      <section className="ventas-seccion" aria-labelledby={`${id}-porventa`}>
        <h2 id={`${id}-porventa`} ref={porVentaRef} tabIndex={-1} style={titulo2}>
          {tarifas ? 'Cuánto ganamos por venta' : unProveedor ? `Costos fijos de ${unProveedor}` : 'Costos fijos del guía'}
        </h2>
        {descartadas.length > 0 && (
          <div id={`${id}-descartadas`} role="status" style={{ ...tarjeta, marginBottom: 12, background: 'var(--status-atencion-bg)' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              {plural(descartadas.length, 'regla de costo no se usa', 'reglas de costo no se usan')} porque tienen un error en la configuración:
            </p>
            <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 13, color: 'var(--text-sub)' }}>
              {descartadas.map((r, i) => (
                <li key={i}>{textoDescartada(r)}</li>
              ))}
            </ul>
            <p style={{ ...tenue, margin: '6px 0 0' }}>Las reservas que caerían en esas reglas quedan en «Sin calcular».</p>
          </div>
        )}
        {tarifas ? (
          <>
            <p style={{ ...tenue, margin: '-6px 0 12px' }}>Con el precio de lista. Lo que se cobró de verdad está en cada reserva, dentro de su mes.</p>
            {tarifas.length === 0 ? (
              <p style={tenue}>No hay precios ni costos cargados para esta temporada.</p>
            ) : tablas ? (
              <div style={{ ...tarjeta, padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: 'var(--text)' }}>
                  <caption style={oculto}>Precio, costo y ganancia por unidad vendida</caption>
                  <thead>
                    <tr>
                      {['Programa y mercado', 'Precio de lista', 'Costo', 'Ganancia', 'Margen', 'Vendidas'].map((h, i) => (
                        <th key={h} scope="col" style={{ ...encabezado, textAlign: i === 0 ? 'left' : 'right' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {tarifas.map((f, i) => {
                    const c = costoLinea(f);
                    const nota = notaDolar(f);
                    const vig = vigencia(f);
                    const sinBorde = nota ? { borderBottom: 0 } : {};
                    return (
                      <tbody key={i} data-tarifa={`${f.programa}:${f.mercado}`}>
                        <tr>
                          <th scope="row" style={{ ...celda, ...sinBorde, textAlign: 'left', fontWeight: 600 }}>
                            {nombreLinea(f)}
                            <div style={{ ...tenue, fontWeight: 400 }}>{unidadLinea(f)}</div>
                            {vig && <div style={{ ...tenue, fontWeight: 400 }}>{vig}</div>}
                          </th>
                          <td style={{ ...celda, ...sinBorde, ...sinCorte }}>{precioLinea(f)}</td>
                          <td style={{ ...celda, ...sinBorde }}>
                            <span style={sinCorte}>{c.principal}</span>
                            {c.detalle && <div style={tenue}>{c.detalle}</div>}
                          </td>
                          <td style={{ ...celda, ...sinBorde, ...sinCorte, fontWeight: 700, color: gananciaNegativa(f) ? rojo : undefined }}>{gananciaLinea(f)}</td>
                          <td style={{ ...celda, ...sinBorde }}>{pct(f.margen)}</td>
                          <td style={{ ...celda, ...sinBorde }}>{vendidasLinea(f)}</td>
                        </tr>
                        {nota && (
                          <tr>
                            <td colSpan={6} style={{ ...celda, ...tenue, textAlign: 'left', paddingTop: 0 }}>
                              {nota}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })}
                </table>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tarifas.map((f, i) => {
                  const c = costoLinea(f);
                  const nota = notaDolar(f);
                  const vig = vigencia(f);
                  const filas: [string, React.ReactNode, boolean][] = [
                    ['Precio de lista', precioLinea(f), false],
                    ['Costo', c.detalle ? (<>{c.principal}<span style={{ display: 'block', ...tenue }}>{c.detalle}</span></>) : c.principal, false],
                    ['Ganancia', gananciaLinea(f), true],
                    ['Margen', pct(f.margen), false],
                    ['Vendidas', vendidasLinea(f), false],
                  ];
                  return (
                    <li key={i} style={tarjeta} data-tarifa={`${f.programa}:${f.mercado}`}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{nombreLinea(f)}</h3>
                      <div style={tenue}>{unidadLinea(f)}</div>
                      {vig && <div style={tenue}>{vig}</div>}
                      <dl style={{ margin: '10px 0 0', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '6px 12px', fontSize: 14 }}>
                        {filas.map(([k, v, fuerte]) => (
                          <div key={k} style={{ display: 'contents' }}>
                            <dt style={{ color: 'var(--text-sub)', minWidth: 0 }}>{k}</dt>
                            <dd style={{ margin: 0, ...cifra, fontWeight: fuerte ? 700 : 500, color: fuerte && gananciaNegativa(f) ? rojo : 'var(--text)' }}>{v}</dd>
                          </div>
                        ))}
                      </dl>
                      {nota && <p style={{ ...tenue, margin: '10px 0 0' }}>{nota}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : datos.costos_fijos.length === 0 ? (
          <p style={tenue}>No hay costos fijos cargados para esta temporada.</p>
        ) : (
          <div style={tarjeta}>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--text)' }}>
              {datos.costos_fijos.map((c, i) => (
                <li key={i}>
                  {textoCosto(c)}
                  <div style={tenue}>
                    {c.desde ? `Vigente desde el ${fecha(c.desde, true)}` : 'Sin fecha de inicio'}
                    {c.hasta ? ` hasta el ${fecha(c.hasta, true)}` : ''}.
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  // --- Por mes ---

  function celdasMontos(mon: string | null, v: VentasMontos | null, extra: React.CSSProperties) {
    return (
      <>
        <td style={{ ...celda, ...extra, ...sinCorte }}>{mon && v ? monto(mon, v.venta) : '—'}</td>
        <td style={{ ...celda, ...extra, ...sinCorte }}>{mon && v ? monto(mon, v.costo) : '—'}</td>
        <td style={{ ...celda, ...extra, ...sinCorte, fontWeight: 700, color: (v?.utilidad ?? 0) < 0 ? rojo : undefined }}>{mon && v ? monto(mon, v.utilidad) : '—'}</td>
        <td style={{ ...celda, ...extra }}>{v ? pct(v.porcentaje) : '—'}</td>
      </>
    );
  }

  /** Filas de un mes o del total: una por moneda, USD arriba, separadas por
   *  una línea punteada. Debajo, una fila por moneda con las reservas sin
   *  ganancia calculada, que no suman en las cifras de arriba. */
  function filasMoneda(porMoneda: Record<string, VentasMontos>, cabecera: (n: number) => React.ReactNode, extra: React.CSSProperties = {}, sin: SinCalcular = {}) {
    const monedas = monedasConMonto(porMoneda);
    const monedasSin = monedasEn(sin);
    // Un mes con todo sin calcular no muestra la fila de «—»: solo la de abajo.
    const filas: (string | null)[] = monedas.length > 0 ? monedas : monedasSin.length > 0 ? [] : [null];
    const total = filas.length + monedasSin.length;
    const borde = (i: number): React.CSSProperties => (i === total - 1 ? extra : { ...extra, borderBottom: '1px dotted var(--border-soft)' });
    return [
      ...filas.map((mon, i) => (
        <tr key={mon ?? 'sin'} data-moneda={mon ?? undefined}>
          {i === 0 && cabecera(total)}
          {celdasMontos(mon, mon ? porMoneda[mon] : null, borde(i))}
        </tr>
      )),
      ...monedasSin.map((mon, j) => {
        const i = filas.length + j;
        return (
          <tr key={`sin-${mon}`}>
            {i === 0 && cabecera(total)}
            <td colSpan={4} data-sin-calcular={mon} style={{ ...celda, ...borde(i), ...tenue, fontWeight: 400 }}>
              {textoSinCalcular(mon, sin[mon])}
            </td>
          </tr>
        );
      }),
    ];
  }

  function bloquePorMes() {
    if (!datos || !resumen) return null;
    const totalEstilo: React.CSSProperties = { fontWeight: 700, borderTop: '2px solid var(--text)', borderBottom: 0 };
    const sinTotal = sinCalcularPorMoneda(datos.meses.flatMap((m) => m.reservas));
    return (
      <section className="ventas-seccion" aria-labelledby={`${id}-meses`}>
        <h2 id={`${id}-meses`} style={titulo2}>
          Por mes
        </h2>
        <p style={{ ...tenue, margin: '-6px 0 12px' }}>Toca un mes para ver sus reservas.</p>
        {tablas ? (
          <div style={{ ...tarjeta, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: 'var(--text)' }}>
              <thead>
                <tr>
                  {['Mes', 'FULL_DAY', 'ALL_INCLUSIVE', ...(mix ? ['Mercados'] : []), ETIQUETA_COBRADO, 'Costo', 'Ganancia', 'Margen'].map((h, i) => (
                    <th key={h} scope="col" style={{ ...encabezado, textAlign: i === 0 || h === 'Mercados' ? 'left' : 'right' }}>
                      {i === 1 || i === 2 ? <BadgePrograma codigo={h} /> : h}
                    </th>
                  ))}
                </tr>
              </thead>
              {datos.meses.map((m) => {
                const abierto = abiertos.has(m.mes);
                return (
                  <tbody key={m.mes} data-mes={m.mes}>
                    {filasMoneda(
                      m.por_moneda,
                      (n) => (
                      <>
                        <th scope="row" rowSpan={n} style={{ ...celda, textAlign: 'left', fontWeight: 600 }}>
                          <button type="button" className="fila-lista" aria-expanded={abierto} onClick={() => alternar(m.mes)} style={{ gap: 8, fontWeight: 600 }}>
                            <span aria-hidden="true" style={{ display: 'inline-block', transform: abierto ? 'rotate(90deg)' : undefined }}>
                              ›
                            </span>
                            {mesLargo(m.mes)}
                          </button>
                        </th>
                        <td rowSpan={n} style={celda}>
                          {fullDayMes(m.full_day.reservas, m.full_day.jornadas)}
                        </td>
                        <td rowSpan={n} style={celda}>
                          {allInclusiveMes(m.all_inclusive.reservas, m.all_inclusive.pescadores)}
                        </td>
                        {mix && (
                          <td rowSpan={n} data-mercados-mes="" style={{ ...celda, ...celdaMercados }}>
                            <MercadosMes mercados={mercadosDelMes(m.mercados)} />
                          </td>
                        )}
                      </>
                      ),
                      {},
                      sinCalcularPorMoneda(m.reservas),
                    )}
                    {abierto && (
                      <tr>
                        <td colSpan={mix ? 8 : 7} style={{ padding: '0 12px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                          {listaReservas(m.reservas, `${id}-mes-${m.mes}`)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
              <tfoot data-total-temporada="">
                {filasMoneda(
                  datos.totales,
                  (n) => (
                    <>
                      <th scope="row" rowSpan={n} style={{ ...celda, ...totalEstilo, textAlign: 'left' }}>
                        Total temporada
                      </th>
                      <td rowSpan={n} style={{ ...celda, ...totalEstilo }}>
                        {fullDayMes(resumen.full_day.reservas, resumen.full_day.jornadas)}
                      </td>
                      <td rowSpan={n} style={{ ...celda, ...totalEstilo }}>
                        {allInclusiveMes(resumen.all_inclusive.reservas, resumen.all_inclusive.pescadores)}
                      </td>
                      {mix && (
                        <td rowSpan={n} data-mercados-mes="" style={{ ...celda, ...totalEstilo, ...celdaMercados }}>
                          <MercadosMes mercados={mercadosDelMes(mix.mercados)} />
                        </td>
                      )}
                    </>
                  ),
                  { fontWeight: 700 },
                  sinTotal,
                )}
              </tfoot>
            </table>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {datos.meses.map((m) => {
              const abierto = abiertos.has(m.mes);
              return (
                <li key={m.mes} style={tarjeta} data-mes={m.mes}>
                  <button type="button" className="fila-lista" aria-expanded={abierto} onClick={() => alternar(m.mes)} style={{ gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{mesLargo(m.mes)}</span>
                    <span aria-hidden="true" style={{ fontSize: 18, color: 'var(--text-sub)', transform: abierto ? 'rotate(90deg)' : undefined }}>
                      ›
                    </span>
                  </button>
                  {cuerpoTarjetaMes(m.full_day, m.all_inclusive, m.por_moneda, sinCalcularPorMoneda(m.reservas), m.mercados)}
                  {abierto && <div style={{ marginTop: 12 }}>{listaReservas(m.reservas, `${id}-mes-${m.mes}`)}</div>}
                </li>
              );
            })}
            <li style={{ ...tarjeta, border: '1px solid var(--text)' }} data-total-temporada="">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Total temporada</h3>
              {cuerpoTarjetaMes(resumen.full_day, resumen.all_inclusive, datos.totales, sinTotal, mix?.mercados)}
            </li>
          </ul>
        )}
      </section>
    );
  }

  function cuerpoTarjetaMes(fd: { reservas: number; jornadas: number }, ai: { reservas: number; pescadores: number }, porMoneda: Record<string, VentasMontos>, sin: SinCalcular, mercados?: VentasMercadoMix[]) {
    const conMonto = monedasConMonto(porMoneda);
    const delMes = mercadosDelMes(mercados);
    const partes = [fd.reservas > 0 ? `${plural(fd.jornadas, 'jornada', 'jornadas')} Full Day` : null, ai.reservas > 0 ? `${persona(ai.pescadores)} All Inclusive` : null].filter(Boolean);
    return (
      <>
        <div style={{ ...tenue, marginTop: 2 }}>{partes.length > 0 ? partes.join(' · ') : 'Sin ventas confirmadas.'}</div>
        {mix && delMes.length > 0 && (
          <div data-mercados-mes="" style={{ ...tenue, marginTop: 2 }}>
            {t.personasMinuscula.charAt(0).toUpperCase() + t.personasMinuscula.slice(1)}: <MercadosMes mercados={delMes} />
          </div>
        )}
        {monedasEn(Object.fromEntries([...conMonto, ...Object.keys(sin)].map((k) => [k, true]))).map((mon) => (
          <div key={mon} style={{ marginTop: 12 }} data-moneda={mon}>
            <div style={{ ...etiqueta, marginBottom: 6 }}>En {mon}</div>
            {conMonto.includes(mon) && <Montos moneda={mon} m={porMoneda[mon]} />}
            {sin[mon] && <LineaSinCalcular moneda={mon} s={sin[mon]} />}
          </div>
        ))}
      </>
    );
  }

  // --- Resumen ---

  function avisosResumen() {
    if (!datos || !resumen) return null;
    const sinCalcular = datos.sin_calcular.length;
    const pendientes = resumen.pendientes.reservas;
    if (descartadas.length === 0 && sinCalcular === 0 && pendientes === 0) return null;
    return (
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {descartadas.length > 0 && (
          <div className="crm-aviso alerta" role="status" style={{ margin: 0, paddingTop: 0, paddingBottom: 0 }}>
            {detalleDescartadas()}
          </div>
        )}
        {sinCalcular > 0 && (
          <div className="crm-aviso alerta" role="status" style={{ margin: 0, paddingTop: 0, paddingBottom: 0 }}>
            {sinCalcular === 1 ? '1 reserva sin calcular no suma plata.' : `${sinCalcular.toLocaleString('es-CL')} reservas sin calcular no suman plata.`}
            {/* Con `ventanas` no hay sección «Sin calcular» a la que llevar. */}
            {!ventanas && (
              <>
                {' '}
                <a href={`#${id}-sin`} onClick={(e) => irA(e, sinCalcularRef.current)} style={enlaceAncla}>
                  Ver cuáles
                </a>
              </>
            )}
          </div>
        )}
        {pendientes > 0 && (
          <p style={{ ...tenue, margin: 0 }}>
            {pendientes === 1
              ? 'Además hay 1 reserva pendiente de confirmar: no entra en estas cifras.'
              : `Además hay ${pendientes.toLocaleString('es-CL')} reservas pendientes de confirmar: no entran en estas cifras.`}
          </p>
        )}
      </div>
    );
  }

  /** Texto del aviso de reglas descartadas, el mismo en las dos ramas del
   *  resumen. Con `ventanas` (CFF) no hay «Cuánto ganamos por venta» al que
   *  enlazar (pedido de Mato, 19-oct): el detalle va aquí mismo. */
  function detalleDescartadas() {
    return (
      <>
        {descartadas.length === 1 ? '1 regla de costo tiene un error y no se usa' : `${descartadas.length.toLocaleString('es-CL')} reglas de costo tienen un error y no se usan`}: sus reservas quedan sin calcular.
        {ventanas ? (
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {descartadas.map((r, i) => (
              <li key={i}>{textoDescartada(r)}</li>
            ))}
          </ul>
        ) : (
          <>
            {' '}
            <a href={`#${id}-porventa`} onClick={(e) => irA(e, porVentaRef.current)} style={enlaceAncla}>
              Ver detalle
            </a>
          </>
        )}
      </>
    );
  }

  function avisoDescartadas() {
    if (descartadas.length === 0) return null;
    return (
      <div className="crm-aviso alerta" role="status" style={{ margin: '0 0 12px', paddingTop: 0, paddingBottom: 0 }}>
        {detalleDescartadas()}
      </div>
    );
  }

  /** Resumen por período (spec-ventas-cajas §4): reemplaza las tarjetas y «Qué se vende». */
  function bloqueResumenPorPeriodo() {
    if (!datos || !resumen || !ventanas) return null;
    return (
      <section aria-labelledby={`${id}-resumen`}>
        <h2 id={`${id}-resumen`} style={titulo2}>
          Resumen
        </h2>
        {avisoDescartadas()}
        <ResumenPorPeriodo
          ventanas={ventanas}
          periodo={periodo}
          onPeriodo={setPeriodo}
          temporada={datos.periodo}
          tarifas={datos.tarifas}
          hoy={ventanas.hoy ?? hoyChile()}
          ancho={anchoContenido}
          pendientes={resumen.pendientes.reservas}
          meses={datos.meses}
        />
      </section>
    );
  }

  function bloqueResumen() {
    if (!datos || !resumen) return null;
    if (ventanas && !vacio) return bloqueResumenPorPeriodo();
    const monedas = monedasConMonto(datos.totales);
    const sinTotal = sinCalcularPorMoneda(datos.meses.flatMap((m) => m.reservas));
    const soloSinCalcular = monedasEn(sinTotal).filter((m) => !monedas.includes(m));
    const frase = mix && mixCuadra ? fraseMix(mix, datos.periodo, hoyChile()) : null;
    const incompletas = resumen.full_day.jornadas_incompletas ?? 0;
    const avisoIncompletas = incompletas > 0 ? `${plural(incompletas, 'reserva sin fechas: sus jornadas no se cuentan', 'reservas sin fechas: sus jornadas no se cuentan')}.` : null;
    const confirmadas = resumen.full_day.reservas + resumen.all_inclusive.reservas;
    return (
      <section aria-labelledby={`${id}-resumen`}>
        <h2 id={`${id}-resumen`} style={titulo2}>
          Resumen
        </h2>
        {!vacio && mix && (mixCuadra ? frase && <p data-frase-mix="" style={{ margin: '0 0 18px', fontSize: 16, lineHeight: '24px', color: 'var(--text)', maxWidth: '60ch' }}>{frase}</p> : (
          <div data-mix-no-cuadra="" style={{ ...tarjeta, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>No pudimos repartir las ventas por mercado: los conteos no coinciden con el total. Las demás cifras de la pantalla están bien.</p>
            <button type="button" className="crm-btn crm-btn-primary" style={{ marginTop: 12, minHeight: 44 }} onClick={() => load(temporada)}>
              Reintentar
            </button>
          </div>
        ))}
        {vacio ? (
          <div style={{ ...tarjeta, padding: '32px 24px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>Todavía no hay reservas confirmadas en la temporada {datos.periodo.temporada}.</p>
            <p style={{ margin: '4px 0 0', ...tenue }}>Cuando una reserva quede pagada, aparece aquí en el mes de su llegada.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 16 }}>
            {mix ? (
              <Indicador titulo="Reservas confirmadas" valor={confirmadas} unidad={confirmadas === 1 ? 'reserva' : 'reservas'} detalle={persona(resumen.full_day.pescadores + resumen.all_inclusive.pescadores)} aviso={avisoIncompletas} />
            ) : (
              <>
            <Indicador
              titulo={<><BadgePrograma codigo="FULL_DAY" /> vendidos</>}
              valor={resumen.full_day.jornadas}
              unidad={resumen.full_day.jornadas === 1 ? 'jornada' : 'jornadas'}
              detalle={`En ${plural(resumen.full_day.reservas, 'reserva', 'reservas')} · ${persona(resumen.full_day.pescadores)}`}
              aviso={avisoIncompletas}
            />
            <Indicador
              titulo={<><BadgePrograma codigo="ALL_INCLUSIVE" /> vendidos</>}
              valor={resumen.all_inclusive.pescadores}
              unidad={resumen.all_inclusive.pescadores === 1 ? t.personaMinuscula : t.personasMinuscula}
              detalle={`En ${plural(resumen.all_inclusive.reservas, 'reserva', 'reservas')}`}
            />
              </>
            )}
            {monedas.map((mon) => {
              const v = datos.totales[mon];
              const perdida = esNumero(v.utilidad) && v.utilidad < 0;
              const origen = convertidas.get(mon);
              return (
                <div key={mon} style={tarjeta} data-total-moneda={mon}>
                  <div style={etiqueta}>Ganancia en {mon}</div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span data-ganancia="" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: perdida ? rojo : 'var(--text)', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
                      {monto(mon, v.utilidad)}
                    </span>
                    {perdida && <Chip critico>Pérdida</Chip>}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Montos moneda={mon} m={v} sinGanancia />
                  </div>
                  {sinTotal[mon] && <LineaSinCalcular moneda={mon} s={sinTotal[mon]} />}
                  {origen && <p style={{ ...tenue, margin: '8px 0 0' }}>Incluye costos pasados de {origen} a {mon} con el dólar de cada reserva.</p>}
                </div>
              );
            })}
            {soloSinCalcular.map((mon) => (
              <div key={mon} style={tarjeta} data-total-moneda={mon}>
                <div style={etiqueta}>Sin calcular en {mon}</div>
                <LineaSinCalcular moneda={mon} s={sinTotal[mon]} />
              </div>
            ))}
          </div>
        )}
        {avisosResumen()}
      </section>
    );
  }

  function bloqueSinCalcular() {
    if (!datos) return null;
    return (
      <section className="ventas-seccion" aria-labelledby={`${id}-sin`}>
        <h2 id={`${id}-sin`} ref={sinCalcularRef} tabIndex={-1} style={titulo2}>
          Sin calcular{datos.sin_calcular.length > 0 ? ` (${datos.sin_calcular.length})` : ''}
        </h2>
        {datos.sin_calcular.length === 0 ? (
          <p style={tenue}>Todas las reservas confirmadas tienen su ganancia calculada.</p>
        ) : (
          <div style={{ ...tarjeta, padding: '0 16px' }}>
            <p style={{ ...tenue, margin: '12px 0 4px' }}>Estas reservas cuentan en las reservas y jornadas de arriba, pero no suman plata hasta que se complete el dato que falta.</p>
            {/* Antes del 17-oct el servidor no convertía: una venta web en USD de Chile o Brasil caía aquí. */}
            {!tarifas && datos.sin_calcular.some((s) => s.Reason === 'MONEDA_DISTINTA') && (
              <p style={{ ...tenue, margin: '0 0 4px' }}>
                Una venta web se cobra siempre en USD. Si el {t.personaMinuscula} es de Chile o de Brasil, el costo del guía está en CLP y no se puede restar.
              </p>
            )}
            {datos.sin_calcular.some((s) => s.Reason === 'SIN_DOLAR') && (
              <p style={{ ...tenue, margin: '0 0 4px' }}>
                El costo de un Full Day de Brasil está en pesos y se pasa a dólares con el dólar observado del día en que se confirmó. Si ese día no hay dólar, la ganancia no se calcula.
              </p>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {datos.sin_calcular.map((s, i) => {
                const { motivo } = motivoSin(s);
                const r = reservasVentas.get(s.BookingID);
                const mercado = r?.Mercado ?? null;
                const etiquetaMercado = mercado ? (MERCADO_LABEL[mercado as keyof typeof MERCADO_LABEL] ?? mercado) : null;
                return (
                  <li key={s.BookingID} style={{ borderTop: i === 0 ? undefined : '1px solid var(--border)' }}>
                    <button type="button" className="fila-lista fila-sin" data-fila={`sin:${s.BookingID}`} onClick={() => abrir(s.BookingID, `sin:${s.BookingID}`)}>
                      {(r?.Programa || etiquetaMercado) && (
                        <span className="parte-badge" data-parte="badge">
                          <span className="fila-venta__marca">
                            {r?.Programa && <BadgePrograma codigo={r.Programa} />}
                            {etiquetaMercado && (
                              <span className="fila-venta__pais">
                                <RanuraBandera bandera={banderaDeMercado(mercado)} />
                                {etiquetaMercado}
                              </span>
                            )}
                          </span>
                        </span>
                      )}
                      <span className="parte-titulo fila-venta__nombre" data-parte="titulo">{s.GuestName || s.BookingID}</span>
                      <span className="fila-sin__motivo" data-parte="detalle">
                        <Icono concepto="aviso" />
                        <span>{motivo}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    );
  }

  return (
    <div ref={scrollRef} style={{ flex: 1, background: 'var(--bg)' }}>
      <div ref={contenidoRef} className="contenedor-pagina">
        <div className="ventas-encabezado">
          <div style={{ minWidth: 0 }}>
            {/* Alto de línea fijo: con «normal», el cambio de la fuente de
                reserva a Inter (display=swap) cambia el alto y corre todo. */}
            <h1 data-titulo-lista tabIndex={-1} style={{ margin: 0, fontSize: isDesktop ? 24 : 20, lineHeight: isDesktop ? '30px' : '24px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Ventas
            </h1>
            {/* En el teléfono, dos líneas reservadas: el texto de carga y el de la
                temporada no siempre ocupan las mismas (salto de 18 px a 360–390). */}
            <div style={{ fontSize: 13, lineHeight: '18px', minHeight: isDesktop ? undefined : 36, color: 'var(--text-sub)', marginTop: 6 }}>
              {datos && !aviso && !error && (!temporada || datos.periodo.temporada === temporada)
                ? ventanas
                  ? `Temporada ${datos.periodo.temporada} · solo reservas confirmadas.`
                  : `Temporada ${datos.periodo.temporada} · solo reservas confirmadas, por mes de llegada.`
                : 'Reservas confirmadas de la temporada, por mes de llegada.'}
            </div>
          </div>
          {/* El selector ocupa su lugar desde la carga (oculto mientras no hay
              temporadas). Si aparece después, en escritorio empuja el título
              13 px y en el teléfono empuja el esqueleto ~77 px, porque
              AsyncState lo deja un cuadro más (CLS 0,0031 a 1440 y 0,04–0,06
              a 320–390, medidos el 18-oct). */}
          {(temporadas.length > 0 || isDesktop || loading) && (
            <div style={temporadas.length === 0 ? { visibility: 'hidden' } : undefined} aria-hidden={temporadas.length === 0 || undefined}>
              <label htmlFor={`${id}-temporada`} style={{ ...etiqueta, display: 'block', lineHeight: '18px', marginBottom: 6 }}>
                Temporada
              </label>
              <select
                id={`${id}-temporada`}
                value={temporada ?? datos?.periodo.temporada ?? ''}
                onChange={(e) => setTemporada(e.target.value)}
                aria-busy={loading}
                style={{ minHeight: 48, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--white)', fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit' }}
              >
                {temporadas.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {aviso && !loading ? (
          <div role="status" style={{ ...tarjeta, padding: '24px' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{aviso.titulo}</p>
            <p style={{ ...tenue, margin: '6px 0 0' }}>{aviso.detalle}</p>
          </div>
        ) : (
          <AsyncState loading={loading || !fuentesListas} error={error} onRetry={() => load(temporada)}>
            {datos && resumen && (
              <>
                {bloqueResumen()}
                {!vacio && !ventanas && mix && mixCuadra && <QueSeVende mix={mix} tarifas={datos.tarifas} idBase={id} />}
                {/* Con `ventanas` (CFF) la pantalla termina en el resumen: Mato
                    pidió el 19-oct quitar «Por mes» y todo lo de abajo. La
                    vista sin `ventanas` (Alto Castillo) no cambia. */}
                {!ventanas && !vacio && bloquePorMes()}
                {!ventanas && bloquePorVenta()}
                {!ventanas && !vacio && bloqueSinCalcular()}
                {!ventanas && (
                <section className="ventas-seccion" aria-labelledby={`${id}-como`}>
                  <h2 id={`${id}-como`} style={titulo2}>
                    Cómo se calcula
                  </h2>
                  <ul style={{ ...tenue, margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: '18px' }}>
                    <li>Solo cuentan las reservas confirmadas, en el mes en que llega el {t.personaMinuscula}.</li>
                    <li>La ganancia sale de lo que se cobró en cada reserva, no del precio de lista.</li>
                    <li>USD y CLP van por separado: nunca se suman.</li>
                    <li>El costo de un Full Day de Brasil está en pesos: se pasa a dólares con el dólar observado del Banco Central del día en que se confirmó la reserva.</li>
                    <li>«USA y otros» vale para todo {t.personaMinuscula} que no sea de Chile ni de Brasil, o que no tenga país.</li>
                    {mix && <li>«Qué se vende» cuenta {t.personasMinuscula} confirmados, no plata: quien reserva dos veces cuenta dos veces. Un segmento es «Más vendido» desde 10 {t.personasMinuscula} en la temporada y si no empata.</li>}
                  </ul>
                </section>
                )}
              </>
            )}
          </AsyncState>
        )}
      </div>
    </div>
  );
}
