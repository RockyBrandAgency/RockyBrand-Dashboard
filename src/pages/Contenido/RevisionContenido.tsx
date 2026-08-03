import { useState, useEffect, useCallback } from 'react';
import {
  getContentPieces, getHorarioSugerido, aprobarPieza, rechazarPieza, UnauthorizedError,
} from '../../api/dashboardApi';
import { AsyncState } from '../../components/AsyncState';
import type {
  ContentPiece, Adaptacion, HorarioSugerido, EstadoPieza, AdvertenciaPieza,
} from '../../types';

// Revisión y aprobación de contenido de redes. Solo cubre lo que producen
// Dave (estratega) y Jimi (director de arte): los reportes de Neil, Slash y
// Cameron y las directivas de Rox son informes internos y no se aprueban.
//
// Mobile primero a pedido explícito: el dueño revisa esto desde el teléfono.
// Sistema de diseño propio, sin librerías nuevas.
//
// El client_id nunca viaja desde acá: sale del claim del JWT en el backend.

const ESTADOS: { id: EstadoPieza | ''; label: string }[] = [
  { id: '', label: 'Todas' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'aprobada', label: 'Aprobadas' },
  { id: 'rechazada', label: 'Rechazadas' },
];

const COLOR_ESTADO: Record<EstadoPieza, string> = {
  pendiente: '#B86114',
  aprobada: '#1F804D',
  rechazada: '#BF2E2E',
  publicada: '#3866BF',
};

// El límite de caracteres se muestra como referencia viva. Sale de las
// advertencias que ya calculó el backend contra el registro de specs: la
// vista NO tiene una tabla propia de límites, para que no puedan
// contradecirse.
function limiteDe(a: Adaptacion): number | null {
  const w = (a.advertencias || []).find((x) => x.regla === 'caption_max');
  return w?.limite ?? null;
}

function Badge({ texto, color }: { texto: string; color: string }) {
  return (
    <span style={{
      background: `${color}1A`, color, borderRadius: 999, padding: '3px 10px',
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{texto}</span>
  );
}

function Advertencias({ items }: { items: AdvertenciaPieza[] }) {
  if (!items.length) return null;
  // Imposibles de no ver, pero NUNCA bloquean: quien decide es el cliente.
  return (
    <div style={{
      background: '#FFF7F0', border: '1px solid #FF9E42', borderRadius: 10,
      padding: 12, marginTop: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#B86114', marginBottom: 6 }}>
        ⚠ {items.length} {items.length === 1 ? 'advertencia' : 'advertencias'} de plataforma
      </div>
      {items.map((w, i) => (
        <div key={i} style={{ fontSize: 13, color: '#1E1E1E', lineHeight: 1.5 }}>· {w.mensaje}</div>
      ))}
      <div style={{ fontSize: 12, color: '#595959', marginTop: 6 }}>
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
        border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8,
        padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        color: copiado ? '#1F804D' : 'inherit',
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
          color: excedido ? '#BF2E2E' : '#595959',
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
          <div style={{ fontSize: 12, fontWeight: 700, color: '#595959', marginBottom: 6 }}>
            ACTIVO VISUAL (elegido por el Art Director)
          </div>
          {a.activo_visual.activos.map((act, i) => (
            <div key={i} style={{
              border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{act.nombre_archivo}</div>
              {act.justificacion && (
                <div style={{ fontSize: 13, color: '#595959', marginTop: 4 }}>{act.justificacion}</div>
              )}
            </div>
          ))}
          {a.activo_visual.nota && (
            <div style={{ fontSize: 12, color: '#B86114' }}>{a.activo_visual.nota}</div>
          )}
        </div>
      ) : (
        // Estado honesto: no es un dato faltante, es que Jimi todavía no
        // corrió. Sólo se dispara al aprobar.
        <div style={{
          marginTop: 14, fontSize: 13, color: '#595959', background: 'var(--surface-2, #F9F9F9)',
          borderRadius: 10, padding: 12,
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
      <div style={{ fontSize: 12, fontWeight: 700, color: '#595959', marginBottom: 4 }}>
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
      border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20,
      background: h.hay_recomendacion ? '#EBFFEE' : 'var(--surface)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#595959', marginBottom: 8 }}>
        HORARIO SUGERIDO DE PUBLICACIÓN
      </div>
      {!h.hay_recomendacion ? (
        <div style={{ fontSize: 14, lineHeight: 1.55 }}>{h.mensaje}</div>
      ) : (
        <>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{h.franja}</div>
          <div style={{ fontSize: 13, color: '#1E1E1E', lineHeight: 1.55 }}>
            Lo sustentan {h.publicaciones_en_la_franja} de {h.publicaciones_analizadas} publicaciones
            {h.diferencia_pct != null && <> · rinde <strong>{h.diferencia_pct}%</strong> más que el resto</>}
          </div>
          <div style={{ fontSize: 12, color: '#595959', marginTop: 6 }}>
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
      border: '1px solid var(--border)', borderRadius: 14, padding: 16,
      marginBottom: 16, background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <Badge texto={p.estado} color={COLOR_ESTADO[p.estado]} />
        {p.fecha_publicacion_propuesta && <Badge texto={p.fecha_publicacion_propuesta} color="#595959" />}
        {p.objetivo ? <Badge texto={p.objetivo} color="#3866BF" />
          : <Badge texto="sin objetivo" color="#B86114" />}
        {advertenciasTotal > 0 && <Badge texto={`${advertenciasTotal} advertencia(s)`} color="#B86114" />}
      </div>

      <div style={{ fontSize: 16, lineHeight: 1.55, marginBottom: 14 }}>{p.concepto}</div>

      {ultimoRechazo && (
        <div style={{
          background: '#FFF5F5', border: '1px solid #FF7556', borderRadius: 10,
          padding: 12, marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#BF2E2E', marginBottom: 4 }}>
            MOTIVO DEL RECHAZO
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{ultimoRechazo.comentario}</div>
          <div style={{ fontSize: 12, color: '#595959', marginTop: 4 }}>
            {ultimoRechazo.quien} · {ultimoRechazo.cuando.slice(0, 16).replace('T', ' ')}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
        {adaptaciones.map((a, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
            background: tab === i ? 'var(--primary, #2A2A2A)' : 'var(--surface-2, #F0F0F0)',
            color: tab === i ? '#fff' : 'inherit',
          }}>
            {a.plataforma}{(a.advertencias?.length || 0) > 0 ? ' ⚠' : ''}
          </button>
        ))}
      </div>

      {adaptaciones[tab] && <VistaAdaptacion a={adaptaciones[tab]} />}

      {aviso && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#B86114' }}>{aviso}</div>
      )}

      {!decidida && !rechazando && (
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button onClick={aprobar} disabled={enviando} style={{
            flex: '1 1 140px', border: 'none', borderRadius: 10, padding: '14px 18px',
            background: '#1F804D', color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: enviando ? 'wait' : 'pointer',
          }}>{enviando ? 'Aprobando…' : 'Aprobar'}</button>
          <button onClick={() => setRechazando(true)} disabled={enviando} style={{
            flex: '1 1 140px', border: '1px solid #BF2E2E', borderRadius: 10, padding: '14px 18px',
            background: 'transparent', color: '#BF2E2E', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>Rechazar</button>
        </div>
      )}

      {rechazando && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            ¿Qué hay que mejorar? <span style={{ color: '#BF2E2E' }}>(obligatorio)</span>
          </div>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={4}
            placeholder="El agente usa este texto para regenerar la pieza."
            style={{
              width: '100%', boxSizing: 'border-box', borderRadius: 10, padding: 12,
              border: '1px solid var(--border)', fontSize: 15, fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              onClick={rechazar}
              disabled={!comentario.trim() || enviando}
              style={{
                flex: '1 1 140px', border: 'none', borderRadius: 10, padding: '14px 18px',
                background: comentario.trim() ? '#BF2E2E' : '#D9D9D9',
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: comentario.trim() ? 'pointer' : 'not-allowed',
              }}
            >{enviando ? 'Enviando…' : 'Confirmar rechazo'}</button>
            <button onClick={() => { setRechazando(false); setComentario(''); }} style={{
              flex: '1 1 100px', border: '1px solid var(--border)', borderRadius: 10,
              padding: '14px 18px', background: 'transparent', fontSize: 15, cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RevisionContenido() {
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

  return (
    <div style={{ padding: '20px 16px 90px', maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Revisión de contenido</h1>
      <p style={{ fontSize: 14, color: '#595959', margin: '0 0 20px', lineHeight: 1.5 }}>
        Aprueba o rechaza las piezas antes de publicarlas. Nada se publica automáticamente.
      </p>

      <BloqueHorario h={horario} />

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8, paddingBottom: 4 }}>
        {ESTADOS.map((e) => (
          <button key={e.id} onClick={() => setEstado(e.id)} style={{
            border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
            background: estado === e.id ? 'var(--primary, #2A2A2A)' : 'var(--surface-2, #F0F0F0)',
            color: estado === e.id ? '#fff' : 'inherit',
          }}>{e.label}</button>
        ))}
      </div>

      {plataformas.length > 1 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          <button onClick={() => setPlataforma('')} style={chip(plataforma === '')}>Todas</button>
          {plataformas.map((pl) => (
            <button key={pl} onClick={() => setPlataforma(pl)} style={chip(plataforma === pl)}>{pl}</button>
          ))}
        </div>
      )}

      <AsyncState loading={cargando} error={error} onRetry={() => void cargar()}>
        {piezas.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#595959' }}>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>
              {estado || plataforma
                ? 'No hay piezas que coincidan con estos filtros.'
                : 'Aún no hay piezas para revisar.'}
            </div>
          </div>
        ) : (
          piezas.map((p) => (
            <Pieza key={p.piece_id} p={p}
              onCambio={(nueva) => setPiezas((prev) =>
                prev.map((x) => (x.piece_id === nueva.piece_id ? nueva : x)))} />
          ))
        )}
      </AsyncState>
    </div>
  );
}

function chip(activo: boolean): React.CSSProperties {
  return {
    border: '1px solid var(--border)', borderRadius: 999, padding: '6px 12px',
    fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
    background: activo ? 'var(--primary, #2A2A2A)' : 'transparent',
    color: activo ? '#fff' : 'inherit',
  };
}
