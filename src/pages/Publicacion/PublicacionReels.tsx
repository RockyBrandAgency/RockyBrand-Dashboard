import { useState, useEffect, useCallback } from 'react';
import { getPublicaciones, getHorarioSugerido, UnauthorizedError } from '../../api/dashboardApi';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { KpiRow } from '../../components/KpiRow';
import { SectionHead } from '../../components/SectionHead';
import { LineChartIcon } from '../../components/icons/RockyIcons';
import { useAuth } from '../../context/AuthContext';
import { CLIENT_LOCATION } from '../../branding';
import type {
  PublicacionesResponse, PublicacionEnCola, PublicacionHistorial,
  DestinoPublicado, HorarioSugerido,
} from '../../types';

// Publicación de Reels — la pantalla de Berry (`publisher`), el octavo agente.
//
// Es una pantalla de LECTURA, y eso es una decisión, no una etapa: publicar,
// reintentar y detener viven en publisher_lambda y en ningún otro lado
// (decisión 0010, "ante la duda no se publica"). Un botón "publicar ahora" acá
// abriría una segunda vía de escritura al mismo registro, que es exactamente
// lo que el mecanismo de deduplicación no puede tener.
//
// Lo que sí muestra:
// - Qué está por salir, con el copy aprobado tal cual va a salir.
// - Qué ya salió, con el enlace real, que es lo único que el cliente puede
//   comprobar por su cuenta sin creernos.
// - Qué destino quedó a medias y necesita que alguien lo mire.
//
// Ningún texto de acá redacta un estado: la frase la manda el backend
// (`publisher_panel.ETIQUETA_DE_ESTADO`). Dos pantallas traduciendo por su
// cuenta terminan diciendo cosas distintas del mismo estado.

const NOMBRE_PLATAFORMA: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

// Cómo sale la pieza en cada plataforma. Espeja
// `publisher_core.MODALIDADES_POR_PLATAFORMA`: si allá se agrega una, acá cae
// al valor crudo, que es feo pero cierto — nunca a una etiqueta inventada.
const NOMBRE_MODALIDAD: Record<string, string> = {
  trial_reel: 'Reel de prueba',
  reel: 'Reel',
  direct_post: 'Publicación directa',
  draft: 'Borrador',
  short: 'Short',
  video: 'Video',
};

function nombrePlataforma(p: string): string {
  return NOMBRE_PLATAFORMA[p] ?? p;
}

function nombreModalidad(m: string): string {
  return NOMBRE_MODALIDAD[m] ?? m;
}

// Tres tonos y no uno por estado: lo que el cliente necesita distinguir de un
// vistazo es "salió" / "va en camino" / "alguien tiene que mirarlo". Los
// tokens son los mismos que ya usan Reservas y Revisión de Contenido.
function tono(d: DestinoPublicado): { color: string; bg: string } {
  if (d.requiere_persona || d.estado === 'FAILED_FINAL') {
    return { color: 'var(--status-critico-text)', bg: 'var(--status-critico-bg)' };
  }
  if (d.estado === 'SUCCEEDED') {
    return { color: 'var(--status-bien-text)', bg: 'var(--status-bien-bg)' };
  }
  return { color: 'var(--status-atencion-text)', bg: 'var(--status-atencion-bg)' };
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  // El backend manda ISO-8601 en UTC. `toLocaleString` lo pasa a la hora del
  // navegador, que es la del cliente: una publicación de las 19:12 de Chile
  // tiene que leerse 19:12, no 22:12.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-CL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function Badge({ texto, color, bg }: { texto: string; color: string; bg: string }) {
  return (
    <span style={{
      background: bg, color, borderRadius: 'var(--radius-sm)', padding: '4px 10px',
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{texto}</span>
  );
}

// La franja que Berry respeta. No es decorativa: el agente vuelve a
// consultarla antes de publicar y NO publica fuera de ella, aunque el
// calendario haya abierto la ventana (decisión 0010, regla 4). Sale de las
// métricas reales del propio cliente, no de una buena práctica genérica.
//
// Si el endpoint no contesta, el bloque no se dibuja: es mejor no decir nada
// que afirmar un horario que no se pudo leer.
function BloqueFranja({ h }: { h: HorarioSugerido | null }) {
  if (!h) return null;
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: 20, boxShadow: 'var(--shadow-card)',
      marginBottom: 'var(--space-7)',
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>Franja que respeta la publicación</div>
      {h.hay_recomendacion && h.franja ? (
        <>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginTop: 8, letterSpacing: '-0.01em' }}>
            {h.franja}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 6, lineHeight: 1.5 }}>
            {h.mensaje}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 8, lineHeight: 1.5 }}>
          {h.mensaje ?? 'Todavía no hay publicaciones suficientes para recomendar un horario.'}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 10 }}>
        Fuera de esta franja no se publica, aunque haya piezas listas en la cola.
      </div>
    </div>
  );
}

function Plataformas({ items }: { items: PublicacionesResponse['plataformas'] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--space-7)' }}>
      {items.map((p) => (
        <span key={p.plataforma} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)',
          padding: '6px 12px', fontSize: 13,
          background: p.disponible ? 'var(--status-bien-bg)' : 'transparent',
          color: p.disponible ? 'var(--status-bien-text)' : 'var(--text-sub)',
        }}>
          {nombrePlataforma(p.plataforma)}
          <span style={{ fontSize: 12, opacity: 0.85 }}>
            {p.disponible ? 'activa' : 'todavía no'}
          </span>
        </span>
      ))}
    </div>
  );
}

function TarjetaEnCola({ p }: { p: PublicacionEnCola }) {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: 20, boxShadow: 'var(--shadow-card)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word' }}>
          {p.publication_id}
        </div>
        {p.orden != null && (
          <Badge texto={`Orden ${p.orden}`} color="var(--text-sub)" bg="var(--surface-2)" />
        )}
      </div>

      {p.ya_tiene_registro && (
        <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5 }}>
          Ya salió. La carpeta sigue en la cola porque el video original no se
          borra al publicar: retirarlo es una decisión tuya, no un efecto de la
          publicación.
        </div>
      )}

      {p.destinos.map((d) => (
        <div key={d.plataforma} style={{
          borderTop: '1px solid var(--border)', paddingTop: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {nombrePlataforma(d.plataforma)}
            </span>
            <Badge texto={nombreModalidad(d.modalidad)} color="var(--text-sub)" bg="var(--surface-2)" />
            {!d.disponible && (
              <Badge
                texto="sin conexión todavía"
                color="var(--status-atencion-text)"
                bg="var(--status-atencion-bg)"
              />
            )}
          </div>
          <div style={{
            fontSize: 13, color: 'var(--text)', marginTop: 8, lineHeight: 1.6,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{d.copy}</div>
        </div>
      ))}
    </div>
  );
}

function FilaHistorial({ h }: { h: PublicacionHistorial }) {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: 20, boxShadow: 'var(--shadow-card)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word' }}>
        {h.publication_id}
      </div>
      {h.destinos.map((d) => {
        const t = tono(d);
        return (
          <div key={`${d.plataforma}-${d.actualizado ?? ''}`} style={{
            borderTop: '1px solid var(--border)', paddingTop: 12,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {nombrePlataforma(d.plataforma)}
              </span>
              <Badge texto={d.etiqueta} color={t.color} bg={t.bg} />
              {d.intentos > 1 && (
                <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                  {d.intentos} intentos
                </span>
              )}
              {d.actualizado && (
                <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>{fechaCorta(d.actualizado)}</span>
              )}
            </div>

            {d.enlace && (
              <a
                href={d.enlace}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, color: 'var(--primary)', wordBreak: 'break-all' }}
              >Ver la publicación</a>
            )}

            {/* El error va completo y sin reescribir. Un mensaje resumido acá
                es un mensaje que después nadie puede buscar en los logs. */}
            {d.error && (
              <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5 }}>{d.error}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PublicacionReels({ isDesktop }: { isDesktop: boolean }) {
  const { clientId } = useAuth();
  const [datos, setDatos] = useState<PublicacionesResponse | null>(null);
  const [horario, setHorario] = useState<HorarioSugerido | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      // La franja se pide aparte y se deja caer si falla: vive detrás del gate
      // de `content_approval`, que es un servicio distinto de `publicacion`.
      // Un cliente puede tener uno y no el otro, y esta pantalla no puede
      // romperse por eso.
      const [r, h] = await Promise.all([
        getPublicaciones(),
        getHorarioSugerido().catch(() => null),
      ]);
      setDatos(r);
      setHorario(h);
    } catch (e) {
      if (e instanceof UnauthorizedError) throw e;
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las publicaciones.');
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const location = clientId ? CLIENT_LOCATION[clientId] : undefined;
  const fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  const enCola = (datos?.cola ?? []).filter((c) => !c.ya_tiene_registro);
  const yaSalieron = (datos?.cola ?? []).filter((c) => c.ya_tiene_registro);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isDesktop ? '36px 40px 72px' : '20px 16px 88px' }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end',
          gap: 12, paddingBottom: 'var(--space-7)', borderBottom: '1px solid var(--border)',
          marginBottom: 'var(--space-8)',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Publicación de Reels
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Berry publica piezas que ya fueron aprobadas, con su texto ya escrito, en la franja que tus propias métricas favorecen.
            </div>
          </div>
          {location && <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{location.label}, Chile · {fechaCap}</div>}
        </div>

        <AsyncState loading={cargando} error={error} onRetry={() => void cargar()}>
          {!datos ? null : (
            <>
              <div style={{ marginBottom: 'var(--space-7)' }}>
                <KpiRow items={[
                  { label: 'En cola', value: datos.resumen.en_cola },
                  { label: 'Publicadas', value: datos.resumen.publicadas },
                  { label: 'Necesitan revisión', value: datos.resumen.requieren_atencion },
                ]} />
              </div>

              <BloqueFranja h={horario} />
              <Plataformas items={datos.plataformas} />

              <SectionHead count={enCola.length ? { label: `${enCola.length}`, tone: 'atencion' } : undefined}>
                Por publicar
              </SectionHead>
              {enCola.length === 0 ? (
                <EmptyStateIllustrated
                  icon={<LineChartIcon size={36} />}
                  title="No hay nada en la cola"
                  description="Cuando se cargue un video aprobado con su texto, va a aparecer acá con el detalle exacto de cómo sale en cada plataforma."
                />
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr',
                  gap: 20, marginBottom: 'var(--space-8)',
                }}>
                  {enCola.map((p) => <TarjetaEnCola key={p.publication_id} p={p} />)}
                </div>
              )}

              {datos.historial.length > 0 && (
                <div style={{ marginTop: 'var(--space-8)' }}>
                  <SectionHead>Ya publicado</SectionHead>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr',
                    gap: 20,
                  }}>
                    {datos.historial.map((h) => <FilaHistorial key={h.publication_id} h={h} />)}
                  </div>
                </div>
              )}

              {yaSalieron.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 'var(--space-7)', lineHeight: 1.6 }}>
                  {yaSalieron.length === 1
                    ? 'Hay 1 carpeta en la cola cuyo contenido ya se publicó.'
                    : `Hay ${yaSalieron.length} carpetas en la cola cuyo contenido ya se publicó.`}
                  {' '}El video original no se borra al publicar: retirarlo es una decisión tuya.
                </div>
              )}
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
