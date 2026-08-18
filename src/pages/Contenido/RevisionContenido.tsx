import { useState, useEffect, useCallback } from 'react';
import {
  getContentPieces, getHorarioSugerido, aprobarPieza, rechazarPieza, UnauthorizedError,
} from '../../api/dashboardApi';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { ImageIcon } from '../../components/icons/RockyIcons';
import { useAuth } from '../../context/AuthContext';
import { CLIENT_LOCATION } from '../../branding';
import type {
  ContentPiece, Adaptacion, HorarioSugerido, EstadoPieza, AdvertenciaPieza,
} from '../../types';

// Revisión y aprobación de contenido de redes. Solo cubre lo que producen
// Dave (estratega) y Jimi (director de arte): los reportes de Neil, Slash y
// Cameron y las directivas de Rox son informes internos y no se aprueban.
//
// El client_id nunca viaja desde acá: sale del claim del JWT en el backend.
//
// Rediseño 2026-08-03 contra Figma (frame "20 — Revisión de Contenido"):
// el mockup muestra una tarjeta simple por pieza (1 plataforma, sin
// historial, sin advertencias, sin horario sugerido) - pero la pantalla
// real ya es más completa que eso (multi-plataforma con tabs, advertencias
// reales de cada spec, activo visual del Art Director, horario sugerido
// con datos reales, historial de rechazo). Se aplicó el lenguaje visual
// nuevo (tokens, grid de tarjetas, colores de estado) sin recortar esa
// funcionalidad real - adaptar el layout a los datos reales, nunca al
// revés.

const ESTADOS: { id: EstadoPieza | ''; label: string }[] = [
  { id: '', label: 'Todas' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'aprobada', label: 'Aprobadas' },
  { id: 'rechazada', label: 'Rechazadas' },
];

// Hex literales, no var(--status-*) - Badge combina el color con un sufijo
// de alpha ("${color}1A"), que solo funciona con un hex real. Son el
// mismo valor exacto que --status-atencion-dot/--status-bien-dot/
// --status-critico-dot (confirmado contra el Figma real: "Pendiente"
// #d97706, "Aprobada"/"Confirmada" #16a34a, "Rechazada"/"Cancelada"
// #ef4444 - los mismos 3 tokens que ya usa Reservas Resumen). "publicada"
// quedó fuera de ese set de 3 estados en el Figma real - quedó documentado
// como pregunta abierta para Mato (¿token --status-info-* nuevo, o un azul
// propio?) y no fue respondida todavía, así que se mantiene como su propio
// azul explícito en vez de forzarlo dentro de un token que no le
// corresponde.
const COLOR_ESTADO: Record<EstadoPieza, string> = {
  pendiente: '#D97706',
  aprobada: '#16A34A',
  rechazada: '#EF4444',
  publicada: '#3866BF',
};

// Fondos sólidos reales del badge de estado (Figma: "Pendiente" #fef3c7,
// "Aprobada"/"Rechazada" mismos tonos que --status-bien-bg/-critico-bg -
// hallazgo de auditoría 2026-08-04, antes se derivaban por alpha-mix).
const COLOR_ESTADO_BG: Record<EstadoPieza, string> = {
  pendiente: 'var(--status-atencion-bg)',
  aprobada: 'var(--status-bien-bg)',
  rechazada: 'var(--status-critico-bg)',
  publicada: 'var(--status-info-bg)',
};

// El límite de caracteres se muestra como referencia viva. Sale de las
// advertencias que ya calculó el backend contra el registro de specs: la
// vista NO tiene una tabla propia de límites, para que no puedan
// contradecirse.
function limiteDe(a: Adaptacion): number | null {
  const w = (a.advertencias || []).find((x) => x.regla === 'caption_max');
  return w?.limite ?? null;
}

// Forma corregida 2026-08-04 (hallazgo de auditoría): era un pill total
// (radius-pill) con fondo mezclado por alpha (`${color}1A`, ej. #D97706
// con 10% de opacidad da un tono mucho más pálido que el pastel plano
// real de Figma) - ahora radius-sm (6px) y padding 4px 10px, igual que
// .crm-pill/OriginBadge. `bg` es opcional: cuando se conoce el token de
// fondo sólido real (el badge de estado, ver COLOR_ESTADO_BG abajo) se
// usa ese; si no, sigue con el mezclado por alpha como aproximación
// honesta para colores que no tienen un token de fondo confirmado contra
// Figma (objetivo, fecha, conteo de advertencias).
function Badge({ texto, color, bg }: { texto: string; color: string; bg?: string }) {
  return (
    <span style={{
      background: bg ?? `${color}1A`, color, borderRadius: 'var(--radius-sm)', padding: '4px 10px',
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{texto}</span>
  );
}

function Advertencias({ items }: { items: AdvertenciaPieza[] }) {
  if (!items.length) return null;
  // Imposibles de no ver, pero NUNCA bloquean: quien decide es el cliente.
  return (
    <div style={{
      background: 'var(--status-atencion-bg)', border: '1px solid var(--status-atencion-dot)', borderRadius: 'var(--radius-sm)',
      padding: 12, marginTop: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-atencion-text)', marginBottom: 6 }}>
        ⚠ {items.length} {items.length === 1 ? 'advertencia' : 'advertencias'} de plataforma
      </div>
      {items.map((w, i) => (
        <div key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>· {w.mensaje}</div>
      ))}
      <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 6 }}>
        No bloquean la aprobación: tú decides.
      </div>
    </div>
  );
}

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        } catch { /* sin portapapeles: el texto igual está a la vista */ }
      }}
      style={{
        border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
        padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        color: copiado ? 'var(--status-bien-text)' : 'inherit',
      }}
    >{copiado ? '✓ Copiado' : 'Copiar texto'}</button>
  );
}

function VistaAdaptacion({ a }: { a: Adaptacion }) {
  const limite = limiteDe(a);
  const largo = `${a.headline || ''}\n${a.cuerpo || ''}`.length;
  const excedido = limite !== null && largo > limite;
  const paraCopiar = [a.headline, a.cuerpo, a.cta, (a.hashtags || []).map((h) => `#${h}`).join(' ')]
    .filter(Boolean).join('\n\n');

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <Badge texto={a.formato} color="#3866BF" />
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: excedido ? 'var(--status-critico-text)' : 'var(--text-sub)',
        }}>
          {largo} {limite !== null ? `/ ${limite}` : ''} caracteres
          {limite === null && ' · sin límite oficial verificado'}
        </span>
      </div>

      <Campo etiqueta="Headline" valor={a.headline} />
      <Campo etiqueta="Cuerpo" valor={a.cuerpo} multilinea />
      {a.cta && <Campo etiqueta="CTA" valor={a.cta} />}
      {!!(a.hashtags || []).length && (
        <Campo etiqueta="Hashtags" valor={(a.hashtags || []).map((h) => `#${h}`).join(' ')} />
      )}

      {a.activo_visual?.activos?.length ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 6 }}>
            ACTIVO VISUAL (elegido por el Art Director)
          </div>
          {a.activo_visual.activos.map((act, i) => (
            <div key={i} style={{
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{act.nombre_archivo}</div>
              {act.justificacion && (
                <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>{act.justificacion}</div>
              )}
            </div>
          ))}
          {a.activo_visual.nota && (
            <div style={{ fontSize: 12, color: 'var(--status-atencion-text)' }}>{a.activo_visual.nota}</div>
          )}
        </div>
      ) : (
        // Estado honesto: no es un dato faltante, es que Jimi todavía no
        // corrió. Sólo se dispara al aprobar.
        <div style={{
          marginTop: 14, fontSize: 13, color: 'var(--text-sub)', background: 'var(--surface-2)',
          borderRadius: 'var(--radius-sm)', padding: 12,
        }}>
          Sin activo visual todavía. El Art Director lo genera después de que apruebes la pieza.
        </div>
      )}

      <Advertencias items={a.advertencias || []} />
      <div style={{ marginTop: 14 }}><BotonCopiar texto={paraCopiar} /></div>
    </div>
  );
}

function Campo({ etiqueta, valor, multilinea }: { etiqueta: string; valor?: string; multilinea?: boolean }) {
  if (!valor) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 4 }}>
        {etiqueta.toUpperCase()}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.55, whiteSpace: multilinea ? 'pre-wrap' : 'normal' }}>
        {valor}
      </div>
    </div>
  );
}

function BloqueHorario({ h }: { h: HorarioSugerido | null }) {
  if (!h) return null;
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 20,
      background: h.hay_recomendacion ? 'var(--status-bien-bg)' : 'var(--white)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 8 }}>
        HORARIO SUGERIDO DE PUBLICACIÓN
      </div>
      {!h.hay_recomendacion ? (
        <div style={{ fontSize: 14, lineHeight: 1.55 }}>{h.mensaje}</div>
      ) : (
        <>
          <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, marginBottom: 6 }}>{h.franja}</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>
            Lo sustentan {h.publicaciones_en_la_franja} de {h.publicaciones_analizadas} publicaciones
            {h.diferencia_pct != null && <> · rinde <strong>{h.diferencia_pct}%</strong> más que el resto</>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 6 }}>
            Métrica: {h.metrica}. Fuente: {h.fuente}.
          </div>
        </>
      )}
    </div>
  );
}

function Pieza({ p, onCambio }: { p: ContentPiece; onCambio: (nueva: ContentPiece) => void }) {
  const [tab, setTab] = useState(0);
  const [rechazando, setRechazando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const adaptaciones = p.adaptaciones || [];
  const advertenciasTotal = adaptaciones.reduce((n, a) => n + (a.advertencias?.length || 0), 0);
  const decidida = p.estado !== 'pendiente';

  async function aprobar() {
    setEnviando(true); setAviso(null);
    try {
      const r = await aprobarPieza(p.piece_id);
      onCambio(r.pieza);
      // Se dice la verdad de las dos cosas por separado: la pieza quedó
      // aprobada aunque el pedido de arte no se haya podido encolar.
      if (!r.arte_solicitada) {
        setAviso('Pieza aprobada, pero no se pudo pedirle el visual al Art Director. Se puede reintentar.');
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo aprobar.');
    } finally { setEnviando(false); }
  }

  async function rechazar() {
    if (!comentario.trim()) return;
    setEnviando(true); setAviso(null);
    try {
      const r = await rechazarPieza(p.piece_id, comentario.trim());
      onCambio(r.pieza);
      setRechazando(false); setComentario('');
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo rechazar.');
    } finally { setEnviando(false); }
  }

  const ultimoRechazo = [...(p.historial_revision || [])].reverse()
    .find((h) => h.decision === 'rechazada');

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16,
      background: 'var(--white)', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <Badge texto={p.estado} color={COLOR_ESTADO[p.estado]} bg={COLOR_ESTADO_BG[p.estado]} />
        {p.fecha_publicacion_propuesta && <Badge texto={p.fecha_publicacion_propuesta} color="#6B7280" />}
        {p.objetivo ? <Badge texto={p.objetivo} color="#3866BF" />
          : <Badge texto="sin objetivo" color="#D97706" />}
        {advertenciasTotal > 0 && <Badge texto={`${advertenciasTotal} advertencia(s)`} color="#D97706" />}
      </div>

      {/* 14px/500, no 16px/400 (Figma real, nodo 7:352) - sin truncar a
          propósito: es el texto que decide una aprobación, cortarlo le
          escondería contexto a quien revisa. */}
      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.55, marginBottom: 14, color: 'var(--text)' }}>{p.concepto}</div>

      {ultimoRechazo && (
        <div style={{
          background: 'var(--status-critico-bg)', border: '1px solid var(--status-critico-dot)', borderRadius: 'var(--radius-sm)',
          padding: 12, marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-critico-text)', marginBottom: 4 }}>
            MOTIVO DEL RECHAZO
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{ultimoRechazo.comentario}</div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>
            {ultimoRechazo.quien} · {ultimoRechazo.cuando.slice(0, 16).replace('T', ' ')}
          </div>
        </div>
      )}

      <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
        {adaptaciones.map((a, i) => (
          <button key={i} role="tab" aria-selected={tab === i} onClick={() => setTab(i)} style={{
            all: 'unset', boxSizing: 'border-box', borderRadius: 'var(--radius-pill)', padding: '8px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
            background: tab === i ? 'var(--primary)' : 'var(--surface-2)',
            color: tab === i ? '#fff' : 'inherit',
          }}>
            {a.plataforma}{(a.advertencias?.length || 0) > 0 ? ' ⚠' : ''}
          </button>
        ))}
      </div>

      {adaptaciones[tab] && <VistaAdaptacion a={adaptaciones[tab]} />}

      {aviso && (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--status-atencion-text)' }}>{aviso}</div>
      )}

      <div style={{ flex: 1 }} />

      {!decidida && !rechazando && (
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          {/* flex:1 se conserva: en esta tarjeta los dos botones se reparten el
              ancho a proposito (aprobar y rechazar pesan igual). Lo que cambia
              es que ahora son .crm-btn, con el alto y la forma de M3. */}
          <button className="crm-btn crm-btn-primary" style={{ flex: 1 }} onClick={aprobar} disabled={enviando}>
            {enviando ? 'Aprobando…' : 'Aprobar'}
          </button>
          <button className="crm-btn crm-btn-danger" style={{ flex: 1 }} onClick={() => setRechazando(true)} disabled={enviando}>
            Rechazar
          </button>
        </div>
      )}

      {decidida && !rechazando && (
        <div style={{ marginTop: 18 }}>
          <div style={{
            textAlign: 'center', borderRadius: 'var(--radius-sm)', padding: '8px 16px',
            background: 'var(--surface-2)', color: 'var(--text-sub)', fontSize: 13, fontWeight: 600,
          }}>
            Acción completada
          </div>
        </div>
      )}

      {rechazando && (
        <div style={{ marginTop: 18 }}>
          <label htmlFor={`rechazo-${p.piece_id}`} style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            ¿Qué hay que mejorar? <span style={{ color: 'var(--status-critico-text)' }}>(obligatorio)</span>
          </label>
          <textarea
            id={`rechazo-${p.piece_id}`}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={4}
            placeholder="El agente usa este texto para regenerar la pieza."
            style={{
              width: '100%', boxSizing: 'border-box', borderRadius: 'var(--radius-sm)', padding: 12,
              border: '1px solid var(--border)', fontSize: 15, fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={rechazar}
              disabled={!comentario.trim() || enviando}
              style={{
                all: 'unset', boxSizing: 'border-box', flex: 1, textAlign: 'center', borderRadius: 'var(--radius-sm)', padding: '8px 16px',
                background: comentario.trim() ? 'var(--status-critico-dot)' : 'var(--text-faint)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: comentario.trim() ? 'pointer' : 'not-allowed',
              }}
            >{enviando ? 'Enviando…' : 'Confirmar rechazo'}</button>
            <button onClick={() => { setRechazando(false); setComentario(''); }} style={{
              all: 'unset', boxSizing: 'border-box', flex: 1, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '8px 16px', background: 'transparent', fontSize: 13, cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RevisionContenido({ isDesktop }: { isDesktop: boolean }) {
  const { clientId } = useAuth();
  const [piezas, setPiezas] = useState<ContentPiece[]>([]);
  const [horario, setHorario] = useState<HorarioSugerido | null>(null);
  const [estado, setEstado] = useState<EstadoPieza | ''>('');
  const [plataforma, setPlataforma] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const [r, h] = await Promise.all([
        getContentPieces({ estado: estado || undefined, plataforma: plataforma || undefined }),
        getHorarioSugerido().catch(() => null),
      ]);
      setPiezas(r.piezas || []);
      setHorario(h);
    } catch (e) {
      if (e instanceof UnauthorizedError) throw e;
      setError(e instanceof Error ? e.message : 'No se pudo cargar el contenido.');
    } finally { setCargando(false); }
  }, [estado, plataforma]);

  useEffect(() => { void cargar(); }, [cargar]);

  const plataformas = Array.from(new Set(
    piezas.flatMap((p) => (p.adaptaciones || []).map((a) => a.plataforma))
  ));

  const location = clientId ? CLIENT_LOCATION[clientId] : undefined;
  const fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
            paddingBottom: 'var(--space-7)',
            borderBottom: '1px solid var(--border)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Revisión de Contenido
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Piezas de redes sociales generadas por IA para tu aprobación. Nada se publica automáticamente.
            </div>
          </div>
          {location && <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{location.label}, Chile · {fechaCap}</div>}
        </div>

        <BloqueHorario h={horario} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', marginBottom: 'var(--space-7)' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--border)', padding: 4, borderRadius: 'var(--radius-md)' }}>
            {ESTADOS.map((e) => (
              <button key={e.id} onClick={() => setEstado(e.id)} aria-pressed={estado === e.id} style={{
                all: 'unset', boxSizing: 'border-box', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 13, fontWeight: estado === e.id ? 600 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
                background: estado === e.id ? 'var(--white)' : 'transparent',
                color: estado === e.id ? 'var(--text)' : 'var(--text-sub)',
              }}>{e.label}</button>
            ))}
          </div>

          {plataformas.length > 1 && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              <button onClick={() => setPlataforma('')} aria-pressed={plataforma === ''} style={chip(plataforma === '')}>Todas</button>
              {plataformas.map((pl) => (
                <button key={pl} onClick={() => setPlataforma(pl)} aria-pressed={plataforma === pl} style={chip(plataforma === pl)}>{pl}</button>
              ))}
            </div>
          )}
        </div>

        <AsyncState loading={cargando} error={error} onRetry={() => void cargar()}>
          {piezas.length === 0 ? (
            estado || plataforma ? (
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 15, lineHeight: 1.6 }}>No hay piezas que coincidan con estos filtros.</div>
              </div>
            ) : (
              <EmptyStateIllustrated
                icon={<ImageIcon size={36} />}
                title="Sin piezas por revisar"
                description="Cuando los agentes de IA generen nuevo contenido para tus redes, va a aparecer acá para tu aprobación de manera automática."
              />
            )
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr', gap: 20 }}>
              {piezas.map((p) => (
                <Pieza key={p.piece_id} p={p}
                  onCambio={(nueva) => setPiezas((prev) =>
                    prev.map((x) => (x.piece_id === nueva.piece_id ? nueva : x)))} />
              ))}
            </div>
          )}
        </AsyncState>
      </div>
    </div>
  );
}

function chip(activo: boolean): React.CSSProperties {
  return {
    all: 'unset', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '6px 12px',
    fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
    background: activo ? 'var(--primary)' : 'transparent',
    color: activo ? '#fff' : 'var(--text-sub)',
  };
}
