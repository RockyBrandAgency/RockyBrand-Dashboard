import { useMemo, useState, type ReactNode } from 'react';
import { FacebookIcon, InstagramIcon, TiktokIcon, YoutubeIcon } from '../../components/PlatformIcons';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { SectionHead } from '../../components/SectionHead';
import { SelloFrescura } from '../../components/SelloFrescura';
import { LineChartIcon } from '../../components/icons/RockyIcons';
import type { InsightNumero, InsightVigente, PublicacionRed, RedSocial, RendimientoRedes as Datos } from '../../types';

// Rendimiento en redes — lo publicado en Instagram, Facebook, YouTube y TikTok
// en una sola vista, con su alcance, vistas y likes, y los insights al lado.
//
// Toda cifra sale del registro diario (`rendimiento_rrss.py`). La pantalla no
// inventa nada:
// - Un dato que la red no entrega es null y se dibuja "—", nunca 0. Facebook
//   (reels) y YouTube no entregan alcance por publicación en sus APIs.
// - Las sumas de alcance se llaman "alcance sumado": dos publicaciones vistas
//   por la misma persona la cuentan dos veces, así que no es gente única.
// - Lo que tiene menos de `madurando_dias` días se marca y no entra a la
//   mediana: todavía está juntando vistas.
// - Los insights llegan redactados desde el backend, con su n. Acá no se
//   reescriben.

const REDES: RedSocial[] = ['instagram', 'facebook', 'youtube', 'tiktok'];
const NOMBRE: Record<RedSocial, string> = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok' };
const SIN_ALCANCE: Partial<Record<RedSocial, string>> = {
  facebook: 'Meta no entrega el alcance de los reels',
  youtube: 'La API de YouTube no entrega alcance',
};
const PERIODOS = [7, 30, 60] as const;
const POR_PAGINA = 20;
type Periodo = (typeof PERIODOS)[number];
type Orden = 'fecha' | 'vistas' | 'alcance' | 'likes' | 'relativo';

function Icono({ red, size = 18 }: { red: RedSocial; size?: number }) {
  if (red === 'instagram') return <InstagramIcon size={size} />;
  if (red === 'facebook') return <FacebookIcon size={size} />;
  if (red === 'youtube') return <YoutubeIcon size={size} />;
  return <TiktokIcon size={size} />;
}

function n(x: number | null | undefined): string {
  return x == null ? '—' : x.toLocaleString('es-CL');
}

function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Suma que respeta el null: si ninguna publicación trae el dato, no hay suma. */
function suma(pubs: PublicacionRed[], campo: 'alcance' | 'vistas' | 'likes' | 'comentarios'): number | null {
  const xs = pubs.map((p) => p[campo]).filter((x): x is number => x != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
}

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // El ISO viene en UTC; toLocaleString lo pasa a la hora del navegador.
  return d.toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        border: `1px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
        background: activo ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'var(--white)',
        color: activo ? 'var(--primary)' : 'var(--text)', fontWeight: activo ? 600 : 500,
        borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 13, fontFamily: 'inherit',
      }}
    >{children}</button>
  );
}

function Etiqueta({ texto, tono }: { texto: string; tono: 'bien' | 'mal' | 'atencion' | 'neutro' }) {
  const c = {
    bien: ['var(--status-bien-text)', 'var(--status-bien-bg)'],
    mal: ['var(--status-critico-text)', 'var(--status-critico-bg)'],
    atencion: ['var(--status-atencion-text)', 'var(--status-atencion-bg)'],
    neutro: ['var(--text-sub)', 'var(--surface-2)'],
  }[tono];
  return (
    <span style={{
      color: c[0], background: c[1], borderRadius: 'var(--radius-sm)', padding: '2px 8px',
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{texto}</span>
  );
}

function Miniatura({ p }: { p: PublicacionRed }) {
  const [rota, setRota] = useState(false);
  const caja = {
    width: 44, height: 56, borderRadius: 'var(--radius-sm)', flexShrink: 0, overflow: 'hidden',
    background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as const;
  // Las miniaturas de Meta y TikTok son URLs firmadas que vencen: si una ya
  // no carga, queda el ícono de la red en vez de una imagen rota.
  if (!p.miniatura || rota) return <div style={caja}><Icono red={p.plataforma} /></div>;
  return (
    <div style={caja}>
      <img src={p.miniatura} alt="" loading="lazy" referrerPolicy="no-referrer"
        onError={() => setRota(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

function TarjetaRed({ red, pubs, conAviso }: { red: RedSocial; pubs: PublicacionRed[]; conAviso: string | null }) {
  const maduras = pubs.filter((p) => !p.madurando && p.vistas != null).map((p) => p.vistas as number);
  const filas: [string, string, string?][] = [
    ['Publicaciones', n(pubs.length)],
    ['Vistas', n(suma(pubs, 'vistas'))],
    ['Alcance sumado', n(suma(pubs, 'alcance')), SIN_ALCANCE[red]],
    ['Likes', n(suma(pubs, 'likes'))],
    ['Vistas medianas', n(mediana(maduras)), maduras.length ? `${maduras.length} con 7 días o más` : 'sin publicaciones con 7 días'],
  ];
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
      padding: 18, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icono red={red} size={20} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{NOMBRE[red]}</span>
      </div>
      {conAviso && <Etiqueta texto={conAviso} tono="atencion" />}
      {filas.map(([k, v, nota]) => (
        <div key={k}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
            <span style={{ color: 'var(--text-sub)' }}>{k}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
          </div>
          {nota && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{nota}</div>}
        </div>
      ))}
    </div>
  );
}

const TONO_NUMERO: Record<InsightNumero['tipo'], 'bien' | 'mal' | 'atencion' | 'neutro'> = {
  bien: 'bien', mal: 'mal', probar: 'atencion', info: 'neutro',
};
const TEXTO_NUMERO: Record<InsightNumero['tipo'], string> = {
  bien: 'Funcionó', mal: 'No funcionó', probar: 'Por probar', info: 'Dato',
};
const SIGNO: Record<InsightVigente['signo'], { texto: string; tono: 'bien' | 'mal' | 'atencion' }> = {
  hacer: { texto: 'Hacer', tono: 'bien' },
  no_hacer: { texto: 'No hacer', tono: 'mal' },
  probar: { texto: 'Por probar', tono: 'atencion' },
};

function Insights({ numeros, vigentes, isDesktop }: { numeros: InsightNumero[]; vigentes: InsightVigente[]; isDesktop: boolean }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const caja = {
    background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
    padding: 20, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column' as const, gap: 14,
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 'var(--space-8)' }}>
      <div style={caja}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Lo que dicen los números</div>
        {numeros.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>Todavía no hay datos suficientes.</div>}
        {numeros.map((i) => (
          <div key={i.titulo} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Etiqueta texto={TEXTO_NUMERO[i.tipo]} tono={TONO_NUMERO[i.tipo]} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{i.titulo}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>{i.detalle}</div>
          </div>
        ))}
      </div>
      <div style={caja}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Insights vigentes</div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: -8 }}>
          Lo que la evidencia acumulada dice que hay que hacer, evitar o probar.
        </div>
        {vigentes.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>Sin insights cargados.</div>}
        {vigentes.map((v) => (
          <div key={v.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <button
              type="button"
              onClick={() => setAbierto(abierto === v.id ? null : v.id)}
              aria-expanded={abierto === v.id}
              style={{
                all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start',
                width: '100%', boxSizing: 'border-box',
              }}
            >
              <Etiqueta texto={SIGNO[v.signo].texto} tono={SIGNO[v.signo].tono} />
              <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                <strong>{v.hallazgo}</strong>
                <span style={{ color: 'var(--text-faint)' }}> · {v.red} · <span style={{ whiteSpace: 'nowrap' }}>{v.id}</span></span>
              </span>
            </button>
            {abierto === v.id && (
              <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><strong>Qué hacer:</strong> {v.accion}</div>
                <div><strong>Evidencia:</strong> {v.evidencia} <em>({v.estado})</em></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Relativo({ r }: { r: number | null }) {
  if (r == null) return <span style={{ color: 'var(--text-faint)' }}>—</span>;
  const t = r >= 1.5 ? 'bien' : r < 0.5 ? 'mal' : 'neutro';
  return <Etiqueta texto={`${r.toLocaleString('es-CL', { maximumFractionDigits: 1 })}x`} tono={t} />;
}

export function RendimientoRedes({ datos, isDesktop }: { datos: Datos | null | undefined; isDesktop: boolean }) {
  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [red, setRed] = useState<RedSocial | 'todas'>('todas');
  const [orden, setOrden] = useState<Orden>('fecha');
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  // Lo normal de cada red: mediana de vistas de sus publicaciones con 7 días o
  // más en toda la ventana (no solo el período elegido), para que cambiar el
  // filtro no mueva la vara con la que se compara.
  const base = useMemo(() => {
    const b: Partial<Record<RedSocial, number | null>> = {};
    for (const r of REDES) {
      b[r] = mediana((datos?.publicaciones ?? [])
        .filter((p) => p.plataforma === r && !p.madurando && p.vistas != null)
        .map((p) => p.vistas as number));
    }
    return b;
  }, [datos]);

  if (!datos) {
    return (
      <EmptyStateIllustrated
        icon={<LineChartIcon size={36} />}
        title="Todavía no hay mediciones de lo publicado"
        description="Cuando la medición diaria de las redes esté activa para tu cuenta, acá vas a ver cada publicación de Instagram, Facebook, YouTube y TikTok con su alcance, vistas y likes."
      />
    );
  }

  const desde = Date.now() - periodo * 86400000;
  const enPeriodo = datos.publicaciones.filter((p) => new Date(p.fecha).getTime() >= desde);
  const visibles = enPeriodo.filter((p) => red === 'todas' || p.plataforma === red);
  const relativo = (p: PublicacionRed) => {
    const b = base[p.plataforma];
    return !p.madurando && p.vistas != null && b ? p.vistas / b : null;
  };
  const ordenadas = [...visibles].sort((a, b) => {
    if (orden === 'fecha') return b.fecha.localeCompare(a.fecha);
    const va = orden === 'relativo' ? relativo(a) : a[orden];
    const vb = orden === 'relativo' ? relativo(b) : b[orden];
    return (vb ?? -1) - (va ?? -1);
  });
  const pagina = ordenadas.slice(0, mostrar);

  const generado = new Date(datos.generado);
  const diaGenerado = datos.generado.slice(0, 10);
  const atraso = Math.max(0, Math.floor((Date.now() - generado.getTime()) / 86400000));
  const caidas = REDES.filter((r) => datos.fuentes[r] && !datos.fuentes[r]?.ok);

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 'var(--space-7)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PERIODOS.map((d) => (
            <Chip key={d} activo={periodo === d} onClick={() => { setPeriodo(d); setMostrar(POR_PAGINA); }}>Últimos {d} días</Chip>
          ))}
        </div>
        <SelloFrescura fecha={diaGenerado} diasDeAtraso={atraso} />
      </div>

      {caidas.length > 0 && (
        <div style={{
          background: 'var(--status-atencion-bg)', color: 'var(--status-atencion-text)', borderRadius: 'var(--radius-md)',
          padding: '10px 14px', fontSize: 13, marginBottom: 'var(--space-7)',
        }}>
          {caidas.map((r) => NOMBRE[r]).join(', ')} no respondió en la última medición: sus números son los de la medición anterior o faltan.
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
        gap: 12, marginBottom: 'var(--space-8)',
      }}>
        {REDES.map((r) => (
          <TarjetaRed key={r} red={r} pubs={enPeriodo.filter((p) => p.plataforma === r)}
            conAviso={caidas.includes(r) ? 'sin respuesta hoy' : null} />
        ))}
      </div>

      <SectionHead>Insights</SectionHead>
      <Insights numeros={datos.insights.numeros} vigentes={datos.insights.vigentes} isDesktop={isDesktop} />

      <SectionHead count={{ label: `${visibles.length}`, tone: 'bien' }}>Todo lo publicado</SectionHead>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Chip activo={red === 'todas'} onClick={() => { setRed('todas'); setMostrar(POR_PAGINA); }}>Todas</Chip>
          {REDES.map((r) => (
            <Chip key={r} activo={red === r} onClick={() => { setRed(r); setMostrar(POR_PAGINA); }}><Icono red={r} size={14} />{NOMBRE[r]}</Chip>
          ))}
        </div>
        <label style={{ fontSize: 13, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 8 }}>
          Ordenar por
          <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}
            style={{ fontFamily: 'inherit', fontSize: 13, padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text)' }}>
            <option value="fecha">Más reciente</option>
            <option value="vistas">Vistas</option>
            <option value="alcance">Alcance</option>
            <option value="likes">Likes</option>
            <option value="relativo">Contra lo normal de su red</option>
          </select>
        </label>
      </div>

      {ordenadas.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-sub)', padding: '16px 0' }}>No hay publicaciones en este período.</div>
      ) : isDesktop ? (
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Publicación</th>
                <th>Fecha</th>
                <th className="num">Alcance</th>
                <th className="num">Vistas</th>
                <th className="num">Likes</th>
                <th className="num">Coment.</th>
                <th className="num">Compart.</th>
                <th className="num" title="Vistas de la publicación dividido por la mediana de su red (publicaciones con 7 días o más, últimos 60 días)">vs. normal</th>
              </tr>
            </thead>
            <tbody>
              {pagina.map((p) => (
                <tr key={`${p.plataforma}-${p.id}`}>
                  <td style={{ minWidth: 320 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <Miniatura p={p} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Icono red={p.plataforma} size={14} />
                          {p.madurando && <Etiqueta texto="madurando" tono="atencion" />}
                          {p.prueba && <Etiqueta texto="reel de prueba" tono="neutro" />}
                        </div>
                        <div style={{ marginTop: 4, lineHeight: 1.45, wordBreak: 'break-word' }}>
                          {p.url
                            ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)' }}>{p.texto || '(sin texto)'}</a>
                            : (p.texto || '(sin texto)')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fechaCorta(p.fecha)}</td>
                  <td className="num">{n(p.alcance)}</td>
                  <td className="num">{n(p.vistas)}</td>
                  <td className="num">{n(p.likes)}</td>
                  <td className="num">{n(p.comentarios)}</td>
                  <td className="num">{n(p.compartidos)}</td>
                  <td className="num"><Relativo r={relativo(p)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pagina.map((p) => (
            <div key={`${p.plataforma}-${p.id}`} style={{
              background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              padding: 14, display: 'flex', gap: 12,
            }}>
              <Miniatura p={p} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-sub)' }}>
                  <Icono red={p.plataforma} size={14} />{fechaCorta(p.fecha)}
                  {p.madurando && <Etiqueta texto="madurando" tono="atencion" />}
                  {p.prueba && <Etiqueta texto="reel de prueba" tono="neutro" />}
                </div>
                <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45, wordBreak: 'break-word' }}>
                  {p.url
                    ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)' }}>{p.texto || '(sin texto)'}</a>
                    : (p.texto || '(sin texto)')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10, fontSize: 12 }}>
                  {([['Alcance', p.alcance], ['Vistas', p.vistas], ['Likes', p.likes], ['Coment.', p.comentarios]] as const).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ color: 'var(--text-sub)' }}>{k}</div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{n(v)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8 }}><Relativo r={relativo(p)} /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {ordenadas.length > pagina.length && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Chip activo={false} onClick={() => setMostrar(mostrar + POR_PAGINA)}>
            Ver {Math.min(POR_PAGINA, ordenadas.length - pagina.length)} más de {ordenadas.length - pagina.length}
          </Chip>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 'var(--space-7)', lineHeight: 1.6 }}>
        Se mide una vez al día. «—» significa que la red no entrega ese dato, no que sea cero. «Madurando»: la publicación tiene
        menos de {datos.madurando_dias} días y todavía junta vistas, por eso no se compara. «vs. normal»: sus vistas divididas por la
        mediana de su red en los últimos {datos.ventana_dias} días.
      </div>
    </>
  );
}
