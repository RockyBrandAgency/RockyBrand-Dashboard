import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { BadgePrograma, RanuraBandera } from '../../components/BadgePrograma';
import { banderaDeMercado, banderaDePais } from '../../lib/banderas';
import { Icono, type Concepto } from '../../lib/iconos';
import {
  actualizarHuesped,
  actualizarReserva,
  cancelarReserva,
  confirmarReserva,
  ConflictError,
  ErrorTransitorio,
  getHuespedes,
  TimeoutError,
  UnauthorizedError,
} from '../../api/dashboardApi';
import { useAuth } from '../../context/AuthContext';
import { useAnchoContenido } from '../../hooks/useAnchoContenido';
import { Chip } from './ChipVenta';
import { AcompanantesReserva } from '../../components/AcompanantesReserva';
import { AvisoFlotante, type Aviso } from '../../components/AvisoFlotante';
import { OriginBadge } from '../../components/OriginBadge';
import { telefonoDe, enlaceWhatsapp } from '../../lib/contactoHuesped';
import { fmtSelloUtc } from '../../lib/selloUtc';
import {
  diasEntre,
  ESTADO_RESERVA_LABEL,
  EXPERIENCIA_LABEL,
  fechaCorta,
  fmtDolar,
  fmtMonto,
  fmtPorcentaje,
  LICENCIA_INCLUIDA,
  MERCADO_LABEL,
  MOTIVOS_DOLAR,
  notasEnBullets,
  nombrePrograma,
  programaDe,
  unidadTexto,
  utilidadDe,
} from '../../lib/fichaPescador';
import { terminologiaPms } from '../../lib/terminologiaPms';
import { personasDe } from '../../lib/personas';
import type { FishingExperience, HuespedItem, ReservaResumenItem, UnidadCosto } from '../../types';

// Ficha del pescador como página (5.0.0, solo Chile Fly Fishing). La abren el
// Overview, el Calendario de Reservas y Pescadores; reemplaza ahí al modal
// BookingDetailModal, que sigue para los demás clientes. Conserva todo lo
// que hacía el modal: fechas, acompañantes, notas, «Ya pagó» con «No avisar»
// y cancelar. Las confirmaciones van dentro de la página, en el lugar del pie,
// y no en un window.confirm.

const BARRA_MOVIL = 60;

const ESTADO_COLOR: Record<string, { bg: string; fg: string }> = {
  CONFIRMED: { bg: 'var(--status-bien-bg)', fg: 'var(--status-bien-text)' },
  PENDING: { bg: 'var(--status-atencion-bg)', fg: 'var(--status-atencion-text)' },
  CANCELLED: { bg: 'var(--status-critico-bg)', fg: 'var(--status-critico-text)' },
};

const fieldLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, lineHeight: '18px', fontWeight: 400, color: 'var(--text-sub)' };
const fieldValue: React.CSSProperties = { fontSize: 14, lineHeight: '24px', color: 'var(--text)', marginTop: 6, overflowWrap: 'anywhere' };
const tenue: React.CSSProperties = { fontSize: 14, lineHeight: '24px', color: 'var(--text-sub)' };
const inputStyle: React.CSSProperties = {
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
// Ficha en tarjetas (§15.3, 18-oct): sin círculos numerados; el título de
// cada tarjeta basta y con el orden nuevo los números ya no coincidían.
const tituloSeccion: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text)', margin: 0 };
// Mismo corte que las tablas de Ventas (ANCHO_TABLAS = 760). Se repite el
// número para no importar VentasLodge, que a su vez importa esta ficha.
const ANCHO_CUATRO = 760;

function fmtFecha(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtCorta(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

// Un 400 o un 409 traen el motivo del servidor: se muestra tal cual. Un
// corte de red, un 5xx o un tiempo agotado no traen nada útil.
function mensajeDelServidor(e: unknown): string | null {
  if (!(e instanceof Error) || e instanceof ErrorTransitorio || e instanceof TimeoutError) return null;
  return e.message || null;
}

// 503 «No pudimos leer la configuración»: trae mensaje propio, pero sí vale
// reintentar.
function mensajeTransitorio(e: unknown): string | null {
  return e instanceof ErrorTransitorio && e.delServidor ? e.message || null : null;
}

function enLista(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

interface Form {
  checkIn: string;
  checkOut: string;
  licencia: boolean | null;
  equipo: boolean | null;
  experiencia: FishingExperience | '';
  cumple: string;
  aniv: string;
}

const CLAVES: (keyof Form)[] = ['checkIn', 'checkOut', 'licencia', 'equipo', 'experiencia', 'cumple', 'aniv'];

function formDe(r: ReservaResumenItem, h: HuespedItem | null | undefined): Form {
  return {
    checkIn: r.CheckIn,
    checkOut: r.CheckOut,
    licencia: r.FishingLicensePurchased ?? null,
    equipo: r.BringsOwnGear ?? null,
    experiencia: r.GuestFishingExperience ?? '',
    cumple: h?.BirthDate ?? '',
    aniv: h?.AnniversaryDate ?? '',
  };
}

function iguales(a: Form, b: Form): boolean {
  return CLAVES.every((k) => a[k] === b[k]);
}

/** Título de tarjeta de la ficha con su ícono (§16.4: título → detalle). */
function TituloTarjeta({ icono, children, id }: { icono: Concepto; children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} style={tituloSeccion} data-parte="titulo">
      <Icono concepto={icono} />
      <span>{children}</span>
    </h2>
  );
}

function Seccion({ tarjeta, titulo, icono, children }: { tarjeta: string; titulo: string; icono: Concepto; children: React.ReactNode }) {
  return (
    <section data-tarjeta={tarjeta} className="tarjeta ficha-tarjeta">
      <TituloTarjeta icono={icono}>{titulo}</TituloTarjeta>
      {children}
    </section>
  );
}

// Fila del resumen de la venta (§16.4), dentro de un <dl> (§7.2): ícono y
// etiqueta en <dt>, valor en <dd>, valor a la derecha;
// lo que va debajo (lista, chips, notas) ocupa su propia línea.
function DatoResumen({ etiqueta, valor, cifra, color, icono, ranura, children }: { etiqueta: string; valor: React.ReactNode; cifra?: boolean; color?: string; icono?: Concepto; ranura?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="dato fila-dato fila-dato--resumen" data-dato={etiqueta} data-fila-dato={icono ?? 'ranura'}>
      <dt className="dato__etiqueta fila-dato__etiqueta">
        {icono ? <Icono concepto={icono} /> : (ranura ?? <span className="ranura-icono" aria-hidden="true" />)}
        <span>{etiqueta}</span>
      </dt>
      <dd className={cifra ? 'dato__valor fila-dato__valor fila-dato__valor--fuerte dato__valor--cifra' : 'dato__valor fila-dato__valor'} style={color ? { color } : undefined}>
        {valor}
      </dd>
      {children && <dd className="fila-dato__extra">{children}</dd>}
    </div>
  );
}

function Dato({ etiqueta, icono, ranura, children }: { etiqueta: string; icono?: Concepto; ranura?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }} data-fila-dato={icono ?? 'ranura'}>
      <div style={fieldLabel}>
        {icono ? <Icono concepto={icono} /> : (ranura ?? <span className="ranura-icono" aria-hidden="true" />)}
        {etiqueta}
      </div>
      <div style={fieldValue}>{children}</div>
    </div>
  );
}

function SiNo({ etiqueta, valor, onChange }: { etiqueta: string; valor: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div role="group" aria-label={etiqueta} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6 }}>
      <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm ficha-control" aria-pressed={valor === true} onClick={() => onChange(true)}>
        Sí
      </button>
      <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm ficha-control" aria-pressed={valor === false} onClick={() => onChange(false)}>
        No
      </button>
      {valor === null && <span style={tenue}>Sin dato</span>}
    </div>
  );
}

export interface FichaPescadorProps {
  bookingId: string;
  /** La lista que ya cargó la pantalla: la ficha se dibuja al tiro, sin otra carga. */
  reservas: ReservaResumenItem[];
  /** Si la pantalla ya lo tiene (Pescadores). Si no, la ficha lo busca. */
  huesped?: HuespedItem | null;
  /** Nombre de la pantalla a la que vuelve: «Calendario de Reservas». */
  volverA: string;
  isDesktop: boolean;
  onVolver: () => void;
  /** Algo cambió en el servidor: la pantalla recarga su lista. */
  onCambio: () => void;
}

export function FichaPescador(props: FichaPescadorProps) {
  const { bookingId, reservas, huesped, volverA, isDesktop, onVolver } = props;
  const { handleUnauthorized } = useAuth();
  const [activoId, setActivoId] = useState(bookingId);
  const reserva = reservas.find((r) => r.BookingID === activoId) ?? null;
  const guestId = reserva?.GuestID;

  // undefined = buscando; null = no está o no se pudo leer.
  const [huespedLeido, setHuespedLeido] = useState<HuespedItem | null | undefined>(undefined);
  useEffect(() => {
    if (huesped || !guestId) return;
    let vivo = true;
    getHuespedes()
      .then((r) => {
        if (vivo) setHuespedLeido(r.huespedes.find((h) => h.GuestID === guestId) ?? null);
      })
      .catch((e: unknown) => {
        if (e instanceof UnauthorizedError) return handleUnauthorized();
        if (vivo) setHuespedLeido(null);
      });
    return () => {
      vivo = false;
    };
  }, [huesped, guestId, handleUnauthorized]);
  const huespedFinal = huesped ?? (guestId ? huespedLeido : null);

  if (!reserva) {
    return (
      <div className="ficha-pescador" style={{ flex: 1, background: 'var(--bg)' }}>
        <div className="contenedor-pagina" style={{ paddingTop: isDesktop ? 28 : 16 }}>
          <button type="button" className="crm-btn crm-btn-text crm-btn-sm" onClick={onVolver} style={{ marginLeft: -12 }}>
            ← {volverA}
          </button>
          <p role="alert" style={{ fontSize: 14, color: 'var(--text)', marginTop: 'var(--space-6)' }}>
            No encontramos esta reserva. Puede que la hayan cancelado o que esté fuera del período que muestra el panel.
          </p>
        </div>
      </div>
    );
  }

  return <FichaContenido key={reserva.BookingID} {...props} reserva={reserva} huesped={huespedFinal} onCambiarViaje={setActivoId} />;
}

function FichaContenido({
  reserva,
  reservas,
  huesped,
  volverA,
  isDesktop,
  onVolver,
  onCambio,
  onCambiarViaje,
}: Omit<FichaPescadorProps, 'bookingId' | 'huesped'> & {
  reserva: ReservaResumenItem;
  huesped: HuespedItem | null | undefined;
  onCambiarViaje: (id: string) => void;
}) {
  const { handleUnauthorized, features, clientId, clientTerminologia } = useAuth();
  const term = terminologiaPms(clientId, clientTerminologia);
  // El bloque de utilidad solo con la bandera pms_utilidad del cliente.
  const conUtilidad = features?.pms_utilidad === true;
  const id = useId();
  // Columnas del resumen según el ancho real de la tarjeta (§15.3).
  const [resumenRef, anchoResumen] = useAnchoContenido<HTMLElement>();
  const nombre = reserva.GuestName || 'este pescador';
  const cancelada = reserva.Status === 'CANCELLED';
  const pendiente = reserva.Status === 'PENDING';
  const moneda = reserva.Currency;

  // Qué ofrece editar: solo lo que el backend ya maneja. Clave ausente en la
  // respuesta = Lambda anterior o bandera apagada: se muestra «—» y no hay
  // nada que guardar.
  const ofreceLicencia = reserva.FishingLicensePurchased !== undefined;
  const ofreceEquipo = reserva.BringsOwnGear !== undefined;
  const ofreceExperiencia = reserva.GuestFishingExperience !== undefined && Boolean(reserva.GuestID);
  const ofreceFechasPersona = Boolean(huesped);

  const [base, setBase] = useState<Form>(() => formDe(reserva, huesped));
  const [form, setForm] = useState<Form>(base);
  // Cuando la pantalla recarga (o llega el pescador), lo que no se tocó toma
  // el valor nuevo y lo que se está editando se respeta, campo por campo.
  const [fuente, setFuente] = useState({ reserva, huesped });
  if (fuente.reserva !== reserva || fuente.huesped !== huesped) {
    const nueva = formDe(reserva, huesped);
    const mezcla = { ...form };
    for (const k of CLAVES) if (form[k] === base[k]) (mezcla as Record<string, unknown>)[k] = nueva[k];
    setFuente({ reserva, huesped });
    setBase(nueva);
    setForm(mezcla);
  }
  const sucio = !cancelada && !iguales(form, base);

  const [guardando, setGuardando] = useState(false);
  // El último guardado falló por un 503 con mensaje propio: «Guardar» pasa a «Reintentar».
  const [reintentar, setReintentar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCampo, setErrorCampo] = useState<'checkIn' | 'checkOut' | null>(null);
  const [confirmacion, setConfirmacion] = useState<'cancelar' | 'confirmar' | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [sinAviso, setSinAviso] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // El documento es el que desplaza: su scroll-padding evita que el pie fijo
  // tape el campo que recibe el foco (WCAG 2.4.11). Alto del pie más holgura;
  // en el teléfono, más la barra inferior y los botones en dos líneas.
  useEffect(() => {
    const raiz = document.documentElement;
    const antes = raiz.style.scrollPaddingBottom;
    raiz.style.scrollPaddingBottom = isDesktop ? '120px' : '220px';
    return () => {
      raiz.style.scrollPaddingBottom = antes;
    };
  }, [isDesktop]);
  const [editandoAcompanante, setEditandoAcompanante] = useState(false);
  const [focoA, setFocoA] = useState<'cancelar' | 'confirmar' | null>(null);

  const tituloRef = useRef<HTMLHeadingElement>(null);
  const seguroRef = useRef<HTMLButtonElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const checkInRef = useRef<HTMLInputElement>(null);
  const checkOutRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  // La confirmación abre con el foco en el botón seguro y, al cerrarse,
  // lo devuelve al botón que la abrió.
  useEffect(() => {
    if (confirmacion) seguroRef.current?.focus();
    else if (focoA) {
      (focoA === 'cancelar' ? cancelarRef : confirmarRef).current?.focus();
      setFocoA(null);
    }
  }, [confirmacion, focoA]);

  const cerrarAviso = useCallback(() => setAviso(null), []);
  const avisar = (texto: string) => setAviso({ id: Date.now(), texto });
  const onCambioAcompanantes = useCallback(() => onCambio(), [onCambio]);

  function set<K extends keyof Form>(clave: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [clave]: valor }));
    if (errorCampo && (clave === 'checkIn' || clave === 'checkOut')) setErrorCampo(null);
  }

  function puedeSalir(): boolean {
    if (guardando || ocupado) return false;
    if (sucio && !window.confirm(`¿Salir sin guardar los cambios de ${nombre}?`)) return false;
    if (editandoAcompanante && !window.confirm('Hay un acompañante sin guardar. ¿Salir de todos modos?')) return false;
    return true;
  }

  function volver() {
    if (puedeSalir()) onVolver();
  }

  function cambiarViaje(otro: string) {
    if (otro !== reserva.BookingID && puedeSalir()) onCambiarViaje(otro);
  }

  async function guardar() {
    if (!sucio || guardando) return;
    const fechasCambiaron = form.checkIn !== base.checkIn || form.checkOut !== base.checkOut;
    if (fechasCambiaron) {
      if (!form.checkIn || !form.checkOut) {
        setErrorCampo(!form.checkIn ? 'checkIn' : 'checkOut');
        setError('Completa las dos fechas del viaje.');
        (!form.checkIn ? checkInRef : checkOutRef).current?.focus();
        return;
      }
      if (form.checkOut <= form.checkIn) {
        setErrorCampo('checkOut');
        setError('La salida tiene que ser después de la llegada.');
        checkOutRef.current?.focus();
        return;
      }
    }
    setGuardando(true);
    setError(null);
    setErrorCampo(null);
    setReintentar(false);

    const nuevaBase = { ...base };
    const guardado: string[] = [];
    const fallido: string[] = [];
    const sinSoporte: string[] = [];
    const delServidor: string[] = [];
    const transitorios: string[] = [];
    let sinRed = false;

    const cr: Parameters<typeof actualizarReserva>[1] = {};
    if (fechasCambiaron) {
      cr.CheckIn = form.checkIn;
      cr.CheckOut = form.checkOut;
    }
    if (form.licencia !== base.licencia && form.licencia !== null) cr.FishingLicensePurchased = form.licencia;
    if (form.equipo !== base.equipo && form.equipo !== null) cr.BringsOwnGear = form.equipo;
    if (Object.keys(cr).length > 0) {
      try {
        const resp = await actualizarReserva(reserva.BookingID, cr);
        if (fechasCambiaron) {
          nuevaBase.checkIn = form.checkIn;
          nuevaBase.checkOut = form.checkOut;
          guardado.push('las fechas del viaje');
        }
        // Igual que guardarAcompanantes: si la respuesta no trae el valor,
        // la Lambda desplegada no lo guardó.
        if (cr.FishingLicensePurchased !== undefined) {
          if (resp.FishingLicensePurchased === cr.FishingLicensePurchased) {
            nuevaBase.licencia = form.licencia;
            guardado.push('la licencia');
          } else sinSoporte.push('la licencia');
        }
        if (cr.BringsOwnGear !== undefined) {
          if (resp.BringsOwnGear === cr.BringsOwnGear) {
            nuevaBase.equipo = form.equipo;
            guardado.push('si trae equipo');
          } else sinSoporte.push('si trae equipo');
        }
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          setGuardando(false);
          return handleUnauthorized();
        }
        sinRed = sinRed || !navigator.onLine;
        const m = mensajeDelServidor(e);
        if (m) delServidor.push(m);
        const t = mensajeTransitorio(e);
        if (t) transitorios.push(t);
        if (fechasCambiaron) fallido.push('las fechas del viaje');
        if (cr.FishingLicensePurchased !== undefined) fallido.push('la licencia');
        if (cr.BringsOwnGear !== undefined) fallido.push('si trae equipo');
      }
    }

    const ch: Parameters<typeof actualizarHuesped>[1] = {};
    if (form.experiencia !== base.experiencia) ch.FishingExperience = form.experiencia || null;
    if (form.cumple !== base.cumple) ch.BirthDate = form.cumple;
    if (form.aniv !== base.aniv) ch.AnniversaryDate = form.aniv;
    if (Object.keys(ch).length > 0 && reserva.GuestID) {
      try {
        const resp = await actualizarHuesped(reserva.GuestID, ch);
        if (ch.BirthDate !== undefined || ch.AnniversaryDate !== undefined) {
          nuevaBase.cumple = form.cumple;
          nuevaBase.aniv = form.aniv;
          guardado.push('las fechas importantes');
        }
        if (ch.FishingExperience !== undefined) {
          if ('FishingExperience' in resp && resp.FishingExperience === ch.FishingExperience) {
            nuevaBase.experiencia = form.experiencia;
            guardado.push('el nivel de experiencia');
          } else sinSoporte.push('el nivel de experiencia');
        }
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          setGuardando(false);
          return handleUnauthorized();
        }
        sinRed = sinRed || !navigator.onLine;
        const m = mensajeDelServidor(e);
        if (m) delServidor.push(m);
        const t = mensajeTransitorio(e);
        if (t) transitorios.push(t);
        if (ch.BirthDate !== undefined || ch.AnniversaryDate !== undefined) fallido.push('las fechas importantes');
        if (ch.FishingExperience !== undefined) fallido.push('el nivel de experiencia');
      }
    }

    setBase(nuevaBase);
    setGuardando(false);
    if (guardado.length > 0) onCambio();
    if (fallido.length === 0 && sinSoporte.length === 0) {
      avisar(`Guardaste los cambios de ${nombre}.`);
      return;
    }
    const partes: string[] = [];
    if (sinRed) partes.push('Sin conexión. Tus cambios siguen en pantalla; guarda cuando vuelva la conexión.');
    else if (fallido.length > 0 && delServidor.length > 0) {
      // El servidor dijo por qué (400 o 409): reintentar igual no sirve.
      const motivo = delServidor.map((m) => (/[.!?]$/.test(m.trim()) ? m.trim() : `${m.trim()}.`)).join(' ');
      partes.push(
        guardado.length > 0
          ? `Se guardaron ${enLista(guardado)}, pero no ${enLista(fallido)}. ${motivo}`
          : `No pudimos guardar ${enLista(fallido)}. ${motivo} Tus cambios siguen en pantalla.`
      );
    } else if (fallido.length > 0 && transitorios.length > 0) {
      // 503 con mensaje propio: se muestra y el botón pasa a «Reintentar».
      const motivo = [...new Set(transitorios)].map((m) => (/[.!?]$/.test(m.trim()) ? m.trim() : `${m.trim()}.`)).join(' ');
      partes.push(
        guardado.length > 0
          ? `Se guardaron ${enLista(guardado)}, pero no ${enLista(fallido)}. ${motivo}`
          : `No pudimos guardar ${enLista(fallido)}. ${motivo} Tus cambios siguen en pantalla.`
      );
      setReintentar(true);
    } else if (fallido.length > 0)
      partes.push(
        guardado.length > 0
          ? `Se guardaron ${enLista(guardado)}, pero no ${enLista(fallido)}. Vuelve a intentarlo.`
          : `No pudimos guardar ${enLista(fallido)}. Tus cambios siguen en pantalla: vuelve a intentarlo.`
      );
    if (sinSoporte.length > 0) partes.push(`No se guardó ${enLista(sinSoporte)}: el servidor todavía no acepta ese dato.`);
    setError(partes.join(' '));
  }

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void guardar();
      }
    }
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  });

  function abrirConfirmacion(tipo: 'cancelar' | 'confirmar') {
    setErrorAccion(null);
    setConflicto(false);
    setConfirmacion(tipo);
  }

  function cerrarConfirmacion() {
    if (ocupado) return;
    setFocoA(confirmacion);
    setConfirmacion(null);
    setErrorAccion(null);
    setConflicto(false);
  }

  async function ejecutar() {
    if (!confirmacion || ocupado) return;
    setOcupado(true);
    setErrorAccion(null);
    setConflicto(false);
    try {
      if (confirmacion === 'cancelar') {
        await cancelarReserva(reserva.BookingID);
        avisar(`Cancelaste la reserva de ${nombre}.`);
      } else {
        // El aviso al pescador no sale de este botón: sale del Stream de
        // DynamoDB al aparecer el CONFIRMED, y crm_worker respeta la marca
        // SilentConfirm. Misma llamada que tenía el modal.
        await confirmarReserva(reserva.BookingID, sinAviso);
        avisar(`Confirmaste la reserva de ${nombre}. ${sinAviso ? 'No le enviamos aviso.' : 'Le enviamos el correo de confirmación.'}`);
      }
      setConfirmacion(null);
      onCambio();
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setConflicto(e instanceof ConflictError);
      const accion = confirmacion === 'cancelar' ? 'cancelar' : 'confirmar';
      setErrorAccion(navigator.onLine ? `No pudimos ${accion} la reserva. ${e instanceof Error ? e.message : ''}`.trim() : 'Sin conexión. Vuelve a intentarlo cuando vuelva la conexión.');
    } finally {
      setOcupado(false);
    }
  }

  const contacto = reserva.GuestContact || {};
  const utilidad = utilidadDe(reserva);
  const profit = reserva.Profit;
  const monedaCostos = profit?.Currency || moneda;
  const pagado = reserva.PaidAmount;
  const saldo = reserva.BalanceDue ?? (pagado != null ? reserva.TotalAmount - pagado : null);
  const restricciones = reserva.GuestDietaryRestrictions ?? huesped?.DietaryRestrictions ?? null;
  // PartyMembers llega como texto («"1"»): número con personasDe (QA 18-oct).
  const personas = personasDe(reserva);
  const viajes = reservas
    .filter((r) => r.GuestID && r.GuestID === reserva.GuestID && (r.Status !== 'CANCELLED' || r.BookingID === reserva.BookingID))
    .sort((a, b) => a.CheckIn.localeCompare(b.CheckIn));
  const ec = ESTADO_COLOR[reserva.Status];
  const grilla: React.CSSProperties = { display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: '18px 12px' };
  // Licencia (16-oct): en All Inclusive la compra el guía y va incluida; en
  // Full Day la compramos y se cobra aparte. En ningún caso resta utilidad.
  const programa = programaDe(reserva);
  const licenciaIncluida = profit?.IncluyeLicencia === true || (profit?.IncluyeLicencia == null && programa === 'ALL_INCLUSIVE');
  const mercado = profit?.Mercado ?? null;
  const unidades = (u: UnidadCosto, n: number) =>
    unidadTexto(u, n, { singular: term.personaMinuscula, plural: term.personasMinuscula });
  // All Inclusive de Chile o Brasil sin tarifa propia: el servidor usa la de USA.
  const mercadoCosto = profit?.MercadoCosto && mercado && profit.MercadoCosto !== mercado ? profit.MercadoCosto : null;
  // Costo pasado de CLP a USD (o al revés) con el dólar del día de confirmación.
  const costoOriginal =
    profit?.SupplierCostOriginal != null && profit.SupplierCurrencyOriginal && profit.SupplierCurrencyOriginal !== monedaCostos
      ? { monto: profit.SupplierCostOriginal, moneda: profit.SupplierCurrencyOriginal }
      : null;
  const motivoDolarCosto = !!profit?.Reason && MOTIVOS_DOLAR.has(profit.Reason) && (monedaCostos === 'USD' || monedaCostos === 'CLP');
  const costoGuia = (() => {
    if (costoOriginal) {
      const total = fmtMonto(costoOriginal.moneda, costoOriginal.monto);
      if (profit?.Units && profit.Unit) return `${fmtMonto(costoOriginal.moneda, costoOriginal.monto / profit.Units)} × ${unidades(profit.Unit, profit.Units)} = ${total}`;
      return total;
    }
    // Sin dólar o sin fecha de confirmación (17-oct): el servidor manda la
    // tarifa en su moneda (UnitCost) pero no la convierte. Esos dos motivos solo
    // salen con el par USD/CLP (pms_utilidad.py, PAR_DOLAR), así que la moneda
    // del costo es la otra del par. Se muestra sin convertir.
    if (profit?.SupplierCost == null && motivoDolarCosto && profit?.UnitCost != null && profit.Units != null && profit.Unit) {
      const monedaTarifa = monedaCostos === 'USD' ? 'CLP' : 'USD';
      return `${fmtMonto(monedaTarifa, profit.UnitCost)} × ${unidades(profit.Unit, profit.Units)} = ${fmtMonto(monedaTarifa, profit.UnitCost * profit.Units)}`;
    }
    // Con MONEDA_DISTINTA no hay monto, pero sí cuántas jornadas o pescadores.
    if (profit?.SupplierCost == null) return profit?.Units != null && profit.Unit ? `${unidades(profit.Unit, profit.Units)} · sin monto` : '—';
    const total = fmtMonto(monedaCostos, profit.SupplierCost);
    if (profit.UnitCost != null && profit.Units != null && profit.Unit)
      return `${fmtMonto(monedaCostos, profit.UnitCost)} × ${unidades(profit.Unit, profit.Units)} = ${total}`;
    // Lambda anterior al desglose: se reparte por persona, como antes.
    return personas ? `${fmtMonto(monedaCostos, profit.SupplierCost / personas)} × ${personas} = ${total}` : total;
  })();

  // Precio de lista (17-oct). Solo si el servidor ya lo manda (`ListPrice` en
  // Profit): una Lambda anterior no lo trae y no se inventa «sin precio».
  const conLista = !!profit && 'ListPrice' in profit;
  const precioLista = (() => {
    if (profit?.ListPrice == null) return null;
    const total = fmtMonto(moneda, profit.ListPrice);
    return profit.Units && profit.Unit ? `${unidades(profit.Unit, profit.Units)} × ${fmtMonto(moneda, profit.ListPrice / profit.Units)} = ${total}` : total;
  })();
  const bajoLista = profit?.BelowList === true && profit.ListPrice != null;
  // Dólar usado: con conversión, o cuando falta justo por el dólar.
  const tasa = profit?.ExchangeRate ?? null;
  const motivoDolar = !!profit?.Reason && MOTIVOS_DOLAR.has(profit.Reason);
  const dolarUsado = (() => {
    if (tasa) {
      const fuente = tasa.Source ? ` (${tasa.Source})` : '';
      const nota =
        profit?.ConfirmedAt && profit.ConfirmedAt !== tasa.Date
          ? `Dólar observado del ${fechaCorta(tasa.Date, true)}${fuente}. La reserva se confirmó el ${fechaCorta(profit.ConfirmedAt, true)}.`
          : `Dólar observado del ${fechaCorta(tasa.Date)}, día en que se confirmó la reserva${fuente}.`;
      return { valor: `1 USD = ${fmtDolar(tasa.Value)}`, nota };
    }
    if (!motivoDolar) return null;
    if (reserva.Status === 'PENDING') return { valor: 'Se fija al confirmar.', nota: null };
    return { valor: '—', nota: null };
  })();

  // Resumen de la venta (§15.3): filas A (hechos), B (plata) y C (pago).
  const conGanancia = !!utilidad.formula && profit?.Amount != null && profit.Percent != null;
  // Full Day: jornadas de guía, solo si el servidor las manda. All Inclusive:
  // noches = salida − llegada (decisión del coordinador, 18-oct).
  const duracion = (() => {
    if (programa === 'FULL_DAY') return profit?.Unit === 'jornada' && profit.Units ? unidades('jornada', profit.Units) : null;
    if (programa !== 'ALL_INCLUSIVE') return null;
    const d = diasEntre(reserva.CheckIn, reserva.CheckOut);
    return d > 0 ? `${d} ${d === 1 ? 'noche' : 'noches'}` : null;
  })();
  // Margen de lista de esta reserva: solo si lista y costo están en la moneda
  // de la venta y el costo no se convirtió con el dólar (misma regla que las
  // cajas de Ventas: sin moneda común no se compara).
  const margenLista =
    profit?.ListPrice != null && profit.ListPrice > 0 && profit.SupplierCost != null && !costoOriginal && monedaCostos === moneda
      ? Math.round(((profit.ListPrice - profit.SupplierCost) / profit.ListPrice) * 1000) / 10
      : null;
  const datoPagado = (
    <DatoResumen etiqueta="Pagado" icono="pagado" cifra={!conUtilidad} valor={pagado != null ? fmtMonto(moneda, pagado) : '—'}>
      {pagado == null && <span className="ficha-resumen__sub">Sin dato de pago</span>}
    </DatoResumen>
  );
  const datoSaldo = (
    <DatoResumen
      etiqueta="Saldo"
      icono="saldo"
      cifra={!conUtilidad}
      valor={saldo != null ? fmtMonto(moneda, saldo) : '—'}
      color={saldo == null ? undefined : saldo <= 0 ? 'var(--status-bien-text)' : 'var(--status-atencion-text)'}
    >
      <span className="ficha-resumen__sub">{saldo == null ? 'Sin dato de pago' : saldo <= 0 ? 'Pagado completo' : 'Por cobrar'}</span>
    </DatoResumen>
  );

  // El backend guarda el programa como código (`FULL_DAY`): se muestra su nombre.
  const programaTexto = nombrePrograma(reserva.RoomID);

  const textoCancelar = [
    `${programaTexto} · llega el ${fmtFecha(reserva.CheckIn)} y se va el ${fmtFecha(reserva.CheckOut)}.`,
    'La reserva queda en el historial como Cancelada y la fecha queda libre.',
    'Al pescador no le llega ningún aviso de cancelación. Si corresponde, avísale tú.',
    'Los administradores reciben un WhatsApp con la cancelación.',
    ...(pagado != null && pagado > 0 ? [`Ya pagó ${fmtMonto(moneda, pagado)}. Cancelar no devuelve el dinero: la devolución se hace aparte.`] : []),
  ];
  const textoConfirmar = sinAviso
    ? [
        `Queda registrado como pagado el total: ${fmtMonto(moneda, reserva.TotalAmount)}.`,
        'No le enviamos nada al pescador, a los administradores ni a los guías. Úsalo cuando ya le avisaste por otro medio.',
      ]
    : [
        `Queda registrado como pagado el total: ${fmtMonto(moneda, reserva.TotalAmount)}.`,
        'Le enviamos al pescador el correo de confirmación y empiezan sus correos antes del viaje.',
        'Los administradores reciben un WhatsApp con la reserva nueva.',
        'Los guías reciben un WhatsApp con quién llega, el programa, las fechas y cuántos pescadores, sin montos.',
      ];

  return (
    // Sin overflow propio: la página la desplaza el documento (App no acota el
    // alto), y un pie sticky solo se pega al contenedor que de verdad desplaza.
    // Con overflowY: 'auto' acá el pie quedaba al final de la ficha (QA 5.0.0).
    // En el teléfono, el relleno inferior deja el pie arriba de la barra fija.
    <div className="garantia-ficha ficha-pescador" style={{ flex: 1, background: 'var(--bg)', paddingBottom: isDesktop ? 0 : BARRA_MOVIL }}>
      <div className="contenedor-pagina" style={{ paddingTop: isDesktop ? 28 : 16, paddingBottom: 'var(--space-6)' }}>
        <button type="button" className="crm-btn crm-btn-text crm-btn-sm" onClick={volver} disabled={guardando || ocupado} style={{ marginLeft: -12 }}>
          ← {volverA}
        </button>

        <section data-tarjeta="cabecera" className="tarjeta ficha-tarjeta ficha-cabecera">
          <div className="parte-badge" data-parte="badge">
            <span className="fila-venta__marca">
              <BadgePrograma codigo={reserva.RoomID} />
              {/* País con bandera (17-oct, pedido de Mato): visible junto al badge. */}
              {reserva.GuestOriginCountry && (
                <span className="fila-venta__pais">
                  <RanuraBandera bandera={banderaDePais(reserva.GuestOriginCountry)} />
                  {reserva.GuestOriginCountry}
                </span>
              )}
            </span>
            <span className="chip ficha-estado" style={{ background: ec?.bg ?? 'var(--status-neutro-bg)', color: ec?.fg ?? 'var(--status-neutro-text)' }}>
              {ESTADO_RESERVA_LABEL[reserva.Status] ?? reserva.Status}
            </span>
          </div>
          <h1 ref={tituloRef} tabIndex={-1} className="parte-titulo" data-parte="titulo" style={{ fontSize: isDesktop ? 24 : 20, lineHeight: '30px', fontWeight: 700, color: 'var(--text)', overflowWrap: 'anywhere' }}>
            {nombre}
          </h1>
          <div className="fila-venta__meta" data-parte="detalle">
            <span className="fila-venta__meta-item">
              <Icono concepto="fechas" />
              {`${fmtCorta(reserva.CheckIn)} – ${fmtCorta(reserva.CheckOut)}`}
            </span>
            {personas != null && (
              <span className="fila-venta__meta-item">
                <Icono concepto="pescadores" />
                {`${personas} ${personas === 1 ? 'persona' : 'personas'}`}
              </span>
            )}
          </div>
          {viajes.length >= 2 && (
            // «cercanos»: la lista de reservas tiene ventana de fechas, así que
            // puede haber viajes más antiguos o más lejanos que no salen aquí.
            <div role="group" aria-label="Viajes cercanos de este pescador" data-parte="detalle" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <span style={tenue}>Viajes cercanos:</span>
              {viajes.map((v) => (
                <button key={v.BookingID} type="button" className="crm-btn crm-btn-ghost crm-btn-sm ficha-control" aria-pressed={v.BookingID === reserva.BookingID} onClick={() => cambiarViaje(v.BookingID)}>
                  {fmtCorta(v.CheckIn)}–{fmtCorta(v.CheckOut)}
                </button>
              ))}
            </div>
          )}
          {cancelada && (
            <div className="crm-aviso critico" data-parte="detalle" style={{ marginTop: 12, marginBottom: 0 }}>
              Esta reserva está cancelada. Queda en el historial y no se puede modificar.
            </div>
          )}
        </section>

        <section data-tarjeta="resumen-venta" ref={resumenRef} className={`tarjeta ficha-tarjeta ficha-resumen${(anchoResumen ?? 0) >= ANCHO_CUATRO ? ' ficha-resumen--columnas' : ''}`} aria-labelledby={`${id}-resumen`}>
          <TituloTarjeta icono="resumen-venta" id={`${id}-resumen`}>
            Resumen de la venta
          </TituloTarjeta>
          <div className="ficha-resumen__grupos">
            <dl className="grupo ficha-resumen__grupo" data-parte="detalle">
              <DatoResumen etiqueta="Programa" valor={<BadgePrograma codigo={reserva.RoomID} />} />
              <DatoResumen etiqueta="Llega – Se va" icono="fechas" valor={`${fmtCorta(reserva.CheckIn)} – ${fmtCorta(reserva.CheckOut)}`}>
                {duracion && <span className="ficha-resumen__sub">{duracion}</span>}
              </DatoResumen>
              <DatoResumen etiqueta={term.navPersonas} icono="pescadores" valor={personas ?? '—'} />
              <DatoResumen etiqueta="Mercado" ranura={<RanuraBandera bandera={banderaDeMercado(mercado)} />} valor={mercado ? MERCADO_LABEL[mercado] : '—'} />
            </dl>
            <div className="grupo grupo--div ficha-resumen__grupo" data-parte="detalle">
              <dl className="lista-datos">
                <DatoResumen etiqueta="Venta" icono="venta" cifra={!conUtilidad} valor={fmtMonto(moneda, reserva.TotalAmount)}>
                  {!!reserva.AddonsAmount && <span className="ficha-resumen__sub">Incluye {fmtMonto(moneda, reserva.AddonsAmount)} en extras</span>}
                </DatoResumen>
                {conUtilidad ? (
                  <DatoResumen etiqueta="Costo Guillermo" icono="costo" valor={profit?.SupplierCost != null ? fmtMonto(monedaCostos, profit.SupplierCost) : '—'}>
                    {costoOriginal && <span className="ficha-resumen__sub">Costo {fmtMonto(costoOriginal.moneda, costoOriginal.monto)}</span>}
                  </DatoResumen>
                ) : (
                  <>
                    {datoPagado}
                    {datoSaldo}
                  </>
                )}
              </dl>
              {conUtilidad && (
                <div className={`resultado${utilidad.negativa ? ' resultado--perdida' : ''}`} data-resultado="">
                  <dl className="lista-datos">
                    <DatoResumen etiqueta="Ganancia" icono={utilidad.negativa ? 'perdida' : 'ganancia'} cifra valor={conGanancia ? fmtMonto(monedaCostos, profit!.Amount!) : '—'} color={utilidad.negativa ? 'var(--status-critico-text)' : undefined}>
                      {utilidad.negativa && <span className="ficha-resumen__chip"><Chip critico>Pérdida</Chip></span>}
                    </DatoResumen>
                    <DatoResumen etiqueta="Margen" icono="margen" cifra valor={conGanancia ? fmtPorcentaje(profit!.Percent!) : '—'} color={utilidad.negativa ? 'var(--status-critico-text)' : undefined}>
                      {margenLista != null && <span className="ficha-resumen__sub">lista {fmtPorcentaje(margenLista)}</span>}
                      {margenLista != null && bajoLista && <span className="ficha-resumen__chip"><Chip data-bajo-lista="">Bajo lista</Chip></span>}
                    </DatoResumen>
                  </dl>
                </div>
              )}
              {conUtilidad && !conGanancia && <p className="ficha-resumen__motivo">{utilidad.motivo}</p>}
            </div>
            {conUtilidad && (
              <dl className="grupo grupo--div ficha-resumen__grupo" data-parte="detalle">
                {datoPagado}
                {datoSaldo}
              </dl>
            )}
          </div>
        </section>

        {/* Mientras una confirmación está abierta, los campos se bloquean: así
            no queda un cambio a medias que cancelar o confirmar haga perder. */}
        <fieldset disabled={guardando || cancelada || confirmacion !== null} className={cancelada ? 'solo-lectura' : undefined} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <Seccion tarjeta="viaje" titulo="Viaje" icono="viaje">
            <div className="grupo ficha-grupo" data-parte="detalle" style={grilla}>
              <div>
                <label htmlFor={`${id}-llega`} style={fieldLabel}>
                  <Icono concepto="fechas" />
                  Llega
                </label>
                <input
                  ref={checkInRef}
                  id={`${id}-llega`}
                  type="date"
                  value={form.checkIn}
                  onChange={(e) => set('checkIn', e.target.value)}
                  aria-invalid={errorCampo === 'checkIn' || undefined}
                  aria-describedby={errorCampo === 'checkIn' ? `${id}-error-fechas` : undefined}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor={`${id}-sale`} style={fieldLabel}>
                  <Icono concepto="fechas" />
                  Se va
                </label>
                <input
                  ref={checkOutRef}
                  id={`${id}-sale`}
                  type="date"
                  value={form.checkOut}
                  onChange={(e) => set('checkOut', e.target.value)}
                  aria-invalid={errorCampo === 'checkOut' || undefined}
                  aria-describedby={errorCampo === 'checkOut' ? `${id}-error-fechas` : undefined}
                  style={inputStyle}
                />
                {errorCampo && error && (
                  <div id={`${id}-error-fechas`} role="alert" style={{ fontSize: 12, color: 'var(--status-critico-text)', marginTop: 4 }}>
                    {error}
                  </div>
                )}
              </div>
            </div>
            <div className="grupo grupo--div ficha-grupo" data-parte="detalle" style={grilla}>
              <Dato etiqueta="Programa">
                <BadgePrograma codigo={reserva.RoomID} />
              </Dato>
              <Dato etiqueta="Personas" icono="pescadores">{personas ?? '—'}</Dato>
              <Dato etiqueta="Origen" icono="origen">
                <OriginBadge source={reserva.Source} />
              </Dato>
              <Dato etiqueta="Vuelo de llegada" icono="vuelo">
                {reserva.FlightNumber ? (
                  <>
                    <strong>{reserva.FlightNumber}</strong>
                    {reserva.FlightReportedAt && <span style={tenue}> · informado el {fmtSelloUtc(reserva.FlightReportedAt)}</span>}
                  </>
                ) : (
                  <span style={tenue}>Todavía no lo informa. Llega por WhatsApp cuando contesta el correo de confirmación.</span>
                )}
              </Dato>
            </div>
          </Seccion>

          <Seccion tarjeta="pescador" titulo="Pescador" icono="pescador">
            <div className="grupo ficha-grupo" data-parte="detalle" style={grilla}>
              <Dato etiqueta="Email" icono="email">
                {contacto.Email ? (
                  <a href={`mailto:${contacto.Email}`} style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', minHeight: 48, maxWidth: '100%' }}>
                    {contacto.Email}
                  </a>
                ) : (
                  '—'
                )}
              </Dato>
              <Dato etiqueta="WhatsApp" icono="whatsapp">
                {enlaceWhatsapp(contacto) ? (
                  <a href={enlaceWhatsapp(contacto)!} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', minHeight: 48, maxWidth: '100%' }}>
                    {telefonoDe(contacto)}
                  </a>
                ) : (
                  telefonoDe(contacto) || '—'
                )}
              </Dato>
              <Dato etiqueta="País" ranura={<RanuraBandera bandera={banderaDePais(reserva.GuestOriginCountry)} />}>
                {reserva.GuestOriginCountry || '—'}
              </Dato>
            </div>
            <div className="grupo grupo--div ficha-grupo" data-parte="detalle" style={grilla}>
              <div data-fila-dato="experiencia">
                <label htmlFor={`${id}-exp`} style={fieldLabel}>
                  <Icono concepto="experiencia" />
                  Nivel de experiencia
                </label>
                {ofreceExperiencia ? (
                  <select id={`${id}-exp`} value={form.experiencia} onChange={(e) => set('experiencia', e.target.value as FishingExperience | '')} style={inputStyle}>
                    <option value="">Sin dato</option>
                    {(Object.keys(EXPERIENCIA_LABEL) as FishingExperience[]).map((k) => (
                      <option key={k} value={k}>
                        {EXPERIENCIA_LABEL[k]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div id={`${id}-exp`} style={fieldValue}>
                    —
                  </div>
                )}
              </div>
              <div data-fila-dato="equipo">
                <div style={fieldLabel}>
                  <Icono concepto="equipo" />
                  Trae equipo
                </div>
                {ofreceEquipo ? <SiNo etiqueta="Trae equipo" valor={form.equipo} onChange={(v) => set('equipo', v)} /> : <div style={fieldValue}>—</div>}
              </div>
              <Dato etiqueta="Restricciones alimenticias" icono="restricciones">
                {restricciones && restricciones.length > 0 ? restricciones.join(', ') : <span style={tenue}>Sin restricciones informadas.</span>}
              </Dato>
              {huesped?.MobilityNotes && <Dato etiqueta="Movilidad" icono="movilidad">{huesped.MobilityNotes}</Dato>}
            </div>
            <div className="grupo grupo--div ficha-grupo" data-parte="detalle" style={grilla}>
              {ofreceFechasPersona ? (
                <>
                  <div data-fila-dato="fecha-especial">
                    <label htmlFor={`${id}-cumple`} style={fieldLabel}>
                      <Icono concepto="fecha-especial" />
                      Cumpleaños
                    </label>
                    <input id={`${id}-cumple`} type="date" value={form.cumple} onChange={(e) => set('cumple', e.target.value)} style={inputStyle} />
                  </div>
                  <div data-fila-dato="fecha-especial">
                    <label htmlFor={`${id}-aniv`} style={fieldLabel}>
                      <Icono concepto="fecha-especial" />
                      Aniversario
                    </label>
                    <input id={`${id}-aniv`} type="date" value={form.aniv} onChange={(e) => set('aniv', e.target.value)} style={inputStyle} />
                  </div>
                </>
              ) : (
                <Dato etiqueta="Cumpleaños y aniversario" icono="fecha-especial">
                  <span style={tenue}>{huesped === undefined ? 'Cargando…' : 'Sin ficha del pescador.'}</span>
                </Dato>
              )}
            </div>
          </Seccion>

          <Seccion tarjeta={conUtilidad ? 'costos' : 'licencia'} titulo={conUtilidad ? 'Cómo se calculó la ganancia' : 'Licencia de pesca'} icono={conUtilidad ? 'costos' : 'licencia'}>
            {conUtilidad && (
            <div className="grupo ficha-grupo" data-parte="detalle" style={grilla}>
              {conUtilidad && <Dato etiqueta="Cobrado" icono="venta">{fmtMonto(moneda, reserva.TotalAmount)}</Dato>}
              {conUtilidad && conLista && (
                <Dato etiqueta="Precio de lista" icono="precio-lista">
                  {precioLista ?? (
                    <span style={tenue}>
                      {profit?.Reason === 'SIN_TARIFA'
                        ? 'Sin tarifa para este programa y mercado.'
                        : 'Sin precio de lista para esa fecha.'}
                    </span>
                  )}
                  {bajoLista && (
                    <div role="note" style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                      <span className="chip">Bajo lista</span>
                      <span style={{ fontSize: 14, lineHeight: '24px', color: 'var(--text)' }}>Se cobró {fmtMonto(moneda, profit!.ListPrice! - reserva.TotalAmount)} menos que la lista.</span>
                    </div>
                  )}
                </Dato>
              )}
              {conUtilidad && (
                <Dato etiqueta="Costo de Guía" icono="costo">
                  {costoGuia}
                  {costoOriginal && profit?.SupplierCost != null && <div>= {fmtMonto(monedaCostos, profit.SupplierCost)}</div>}
                </Dato>
              )}
              {conUtilidad && dolarUsado && (
                <Dato etiqueta="Dólar usado" icono="dolar">
                  {dolarUsado.valor}
                  {dolarUsado.nota && <div style={tenue}>{dolarUsado.nota}</div>}
                </Dato>
              )}
              {conUtilidad && mercado && (
                <Dato etiqueta="Mercado" ranura={<RanuraBandera bandera={profit?.MercadoAsumido ? null : banderaDeMercado(mercado)} />}>
                  {/* Asumido: sin bandera, el pescador no tiene país; se mantiene el aviso. */}
                  {profit?.MercadoAsumido ? `Mercado asumido: ${MERCADO_LABEL[mercado]} (sin país)` : MERCADO_LABEL[mercado]}
                  {mercadoCosto && (
                    <div style={tenue}>
                      Costo con tarifa {MERCADO_LABEL[mercadoCosto]} (no hay tarifa propia para {MERCADO_LABEL[mercado]})
                    </div>
                  )}
                </Dato>
              )}
            </div>
            )}
            <div className={`grupo${conUtilidad ? ' grupo--div' : ''} ficha-grupo`} data-parte="detalle" style={grilla}>
              {licenciaIncluida ? (
                <Dato etiqueta="Licencia de pesca" icono="licencia">{LICENCIA_INCLUIDA}</Dato>
              ) : (
                <div data-fila-dato="licencia">
                  <div style={fieldLabel}>
                    <Icono concepto="licencia" />
                    Licencia de pesca: ¿la compramos nosotros?
                  </div>
                  {ofreceLicencia ? <SiNo etiqueta="¿La compramos nosotros?" valor={form.licencia} onChange={(v) => set('licencia', v)} /> : <div style={fieldValue}>—</div>}
                </div>
              )}
              {conUtilidad && (
                // Las cifras grandes ya están en el resumen: acá solo cómo se llegó a ellas.
                <Dato etiqueta="Fórmula de la ganancia" icono="costos">
                  {utilidad.formula && conGanancia ? (
                    <>
                      <span>{utilidad.formula}</span>
                      {utilidad.negativa && <div style={{ ...tenue, color: 'var(--status-critico-text)' }}>{utilidad.motivo}</div>}
                    </>
                  ) : (
                    <span style={tenue}>{utilidad.motivo}</span>
                  )}
                </Dato>
              )}
            </div>
          </Seccion>
        </fieldset>

        <section data-tarjeta="acompanantes" className="tarjeta ficha-tarjeta">
          <AcompanantesReserva
            bookingId={reserva.BookingID}
            inicial={reserva.Companions ?? []}
            editable={!cancelada && confirmacion === null}
            onCambio={onCambioAcompanantes}
            onEditando={setEditandoAcompanante}
            encabezado={(n) => (
              <TituloTarjeta icono="acompanantes">Acompañantes{n > 0 ? ` (${n})` : ''}</TituloTarjeta>
            )}
          />
        </section>

        <Seccion tarjeta="notas" titulo="Notas de la reserva" icono="notas">
          {reserva.BookingNotes && notasEnBullets(reserva.BookingNotes).length > 0 ? (
            <ul data-parte="detalle" style={{ ...fieldValue, margin: '12px 0 0', paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: '24px' }}>
              {notasEnBullets(reserva.BookingNotes).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : (
            <p data-parte="detalle" style={{ ...tenue, margin: '12px 0 0' }}>Sin notas.</p>
          )}
        </Seccion>

        <div
          data-tarjeta="ids"
          className="tarjeta tarjeta--plana ficha-tarjeta"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px 24px',
            fontSize: 12,
            lineHeight: '18px',
            color: 'var(--text-sub)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            overflowWrap: 'anywhere',
          }}
        >
          <Icono concepto="ids" />
          <span>
            Reserva <span style={{ userSelect: 'all' }}>{reserva.BookingID}</span>
          </span>
          {reserva.GuestID && (
            <span>
              Pescador <span style={{ userSelect: 'all' }}>{reserva.GuestID}</span>
            </span>
          )}
        </div>
      </div>

      {!cancelada && (
        <div style={{ position: 'sticky', bottom: isDesktop ? 0 : BARRA_MOVIL, background: 'var(--white)', boxShadow: '0 -4px 12px rgba(9,9,11,0.06)' }}>
          <div className="contenedor-pagina" style={{ paddingTop: 12, paddingBottom: 12 }}>
            {confirmacion ? (
              <div
                role="alertdialog"
                aria-labelledby={`${id}-conf-titulo`}
                aria-describedby={`${id}-conf-texto`}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cerrarConfirmacion();
                  }
                }}
              >
                <h2 id={`${id}-conf-titulo`} style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {confirmacion === 'cancelar' ? `¿Cancelar la reserva de ${nombre}?` : `¿Confirmar la reserva de ${nombre}?`}
                </h2>
                {editandoAcompanante && (
                  <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    Hay un acompañante sin guardar: si sigues, ese cambio se pierde.
                  </p>
                )}
                <ul id={`${id}-conf-texto`} style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                  {(confirmacion === 'cancelar' ? textoCancelar : textoConfirmar).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                {errorAccion && (
                  <div role="alert" style={{ fontSize: 13, color: 'var(--status-critico-text)', marginTop: 8 }}>
                    {errorAccion}
                    {conflicto && (
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          className="crm-btn crm-btn-tonal crm-btn-sm"
                          onClick={() => {
                            setConfirmacion(null);
                            setErrorAccion(null);
                            setConflicto(false);
                            onCambio();
                          }}
                        >
                          Ver la versión actual
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button ref={seguroRef} type="button" className="crm-btn crm-btn-ghost" onClick={cerrarConfirmacion} disabled={ocupado}>
                    Volver sin cambios
                  </button>
                  <button type="button" className={confirmacion === 'cancelar' ? 'crm-btn crm-btn-danger-filled' : 'crm-btn crm-btn-primary'} onClick={() => void ejecutar()} disabled={ocupado}>
                    {ocupado ? (confirmacion === 'cancelar' ? 'Cancelando…' : 'Confirmando…') : confirmacion === 'cancelar' ? 'Sí, cancelar la reserva' : 'Sí, confirmar'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {error && !errorCampo && (
                  <div role="alert" style={{ fontSize: 13, color: 'var(--status-critico-text)', marginBottom: 10 }}>
                    {error}
                  </div>
                )}
                {sucio || guardando ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isDesktop ? 'Cambios sin guardar' : 'Sin guardar'}</span>
                    <span style={{ flex: 1 }} />
                    <button
                      type="button"
                      className="crm-btn crm-btn-ghost"
                      disabled={guardando}
                      onClick={() => {
                        setForm(base);
                        setError(null);
                        setErrorCampo(null);
                        setReintentar(false);
                      }}
                    >
                      Descartar
                    </button>
                    <button type="button" className="crm-btn crm-btn-primary" onClick={() => void guardar()} disabled={guardando} title={isDesktop ? 'Guardar (⌘S o Ctrl+S)' : undefined}>
                      {guardando ? 'Guardando…' : reintentar ? 'Reintentar' : 'Guardar cambios'}
                    </button>
                  </div>
                ) : (
                  <>
                    {pendiente && (
                      <label style={{ display: 'flex', justifyContent: isDesktop ? 'flex-end' : 'flex-start', alignItems: 'center', gap: 8, minHeight: 44, marginBottom: 10, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={sinAviso} onChange={(e) => setSinAviso(e.target.checked)} style={{ width: 24, height: 24, margin: 0, cursor: 'pointer' }} />
                        No avisar al pescador
                      </label>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <button ref={cancelarRef} type="button" className="crm-btn crm-btn-danger" style={{ paddingInline: 12, marginLeft: -12 }} onClick={() => abrirConfirmacion('cancelar')}>
                        Cancelar reserva
                      </button>
                      <span style={{ flex: 1 }} />
                      {pendiente && (
                        <button ref={confirmarRef} type="button" className="crm-btn crm-btn-primary" onClick={() => abrirConfirmacion('confirmar')}>
                          {isDesktop ? 'Ya pagó · Confirmar' : 'Ya pagó'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {aviso && <AvisoFlotante aviso={aviso} isDesktop={isDesktop} onCerrar={cerrarAviso} />}
    </div>
  );
}
