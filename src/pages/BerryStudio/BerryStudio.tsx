import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cancelarBerrySubida, getBerryBiblioteca, UnauthorizedError } from '../../api/dashboardApi';
import { AsyncState } from '../../components/AsyncState';
import { EmptyStateIllustrated } from '../../components/EmptyStateIllustrated';
import { SectionHead } from '../../components/SectionHead';
import { TabsWithIndicator } from '../../components/TabsWithIndicator';
import { FilmIcon, UploadIcon } from '../../components/icons/RockyIcons';
import { useAuth, usePermiso } from '../../context/AuthContext';
import type { BerryBibliotecaResponse, BerryMedio, BerryTipo } from '../../types';
import { ACCEPT } from './formatos';
import { ListaSubidas } from './ListaSubidas';
import { clavesDelMedio, olvidarMedio } from './motorSubida';
import { configurarParteBytes, conectarPantalla, agregarArchivos, estaActiva, estaEnEstaPestana, useSubidasBerry } from './subidasEnCurso';
import { TarjetaMedio } from './TarjetaMedio';
import { VisorMedio } from './VisorMedio';

// Berry Studio, fase 1: subir el material crudo (clips, fotos, audio) y ver
// la versión liviana que Berry prepara para editar. Todavía no edita nada.
//
// La biblioteca se consulta cada 5 s solo mientras algo se está preparando o
// esta pestaña está subiendo, y se deja de consultar al salir de la pantalla.
// Una subida abandonada (en `subiendo` sin nadie que la suba) no hace
// consultar: se muestra «a medias» y se puede quitar. Las subidas en curso NO
// se cortan al salir: viven en subidasEnCurso.ts.

type Pestana = 'todo' | BerryTipo;

const INTERVALO_MS = 5000;

const VACIO: Record<Pestana, string> = {
  todo: '',
  video: 'Todavía no hay videos.',
  foto: 'Todavía no hay fotos.',
  audio: 'Todavía no hay audio.',
};

function tieneArchivos(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

export function BerryStudio({ isDesktop }: { isDesktop: boolean }) {
  const { clientId, handleUnauthorized } = useAuth();
  // Subir material: editor y admin (lib/permisos.ts). Lectura ve la biblioteca.
  const puedeSubir = usePermiso('subidas');
  const [datos, setDatos] = useState<BerryBibliotecaResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>('todo');
  const [abierto, setAbierto] = useState<BerryMedio | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const [quitando, setQuitando] = useState<string | null>(null);
  const [erroresQuitar, setErroresQuitar] = useState<Record<string, string>>({});
  const origen = useRef<HTMLElement | null>(null);
  const selector = useRef<HTMLInputElement>(null);
  const subidas = useSubidasBerry(clientId);

  const cargar = useCallback(
    async (silencioso = false): Promise<BerryBibliotecaResponse | null> => {
      if (!silencioso) {
        setCargando(true);
        setError(null);
      }
      try {
        const r = await getBerryBiblioteca();
        setDatos(r);
        setAhora(Date.now());
        configurarParteBytes(r.parte_bytes);
        return r;
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          handleUnauthorized();
          return null;
        }
        // Una consulta de fondo que falla no borra lo que ya se ve.
        if (!silencioso) setError(e instanceof Error ? e.message : 'No se pudo cargar la biblioteca.');
        return null;
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Lo que termina de subir entra a la biblioteca sin esperar la consulta.
  useEffect(
    () =>
      conectarPantalla((medio) => {
        setDatos((d) => (d ? { ...d, medios: [medio, ...d.medios.filter((m) => m.id !== medio.id)] } : d));
        setAhora(Date.now());
      }, handleUnauthorized),
    [handleUnauthorized],
  );

  const activas = subidas.filter(estaActiva);
  const enPestana = subidas.filter(estaEnEstaPestana);
  // El backend no conoce la pestaña: se reconoce por nombre y tamaño.
  const aqui = (m: BerryMedio) => enPestana.some((e) => e.nombre === m.nombre && e.tamano === m.tamano);
  const medios = useMemo(() => datos?.medios ?? [], [datos]);
  const debeConsultar = activas.length > 0 || medios.some((m) => m.estado === 'preparando');
  const reanudables = useMemo(
    () => new Set(medios.filter((m) => m.estado === 'subiendo' && clavesDelMedio(m).length > 0).map((m) => m.id)),
    [medios],
  );

  const quitarAMedias = async (m: BerryMedio) => {
    if (!m.upload_id) return;
    if (!confirm(`¿Quitar la subida a medias de ${m.nombre}?\n\nLo que alcanzó a subir se descarta.`)) return;
    setQuitando(m.id);
    setErroresQuitar(({ [m.id]: _, ...resto }) => resto);
    try {
      await cancelarBerrySubida({ id: m.id, upload_id: m.upload_id });
      olvidarMedio(m);
      setDatos((d) => (d ? { ...d, medios: d.medios.filter((x) => x.id !== m.id) } : d));
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleUnauthorized();
        return;
      }
      setErroresQuitar((prev) => ({ ...prev, [m.id]: e instanceof Error ? e.message : 'No se pudo quitar.' }));
    } finally {
      setQuitando(null);
      // Si ya no existía (404), la biblioteca nueva tampoco la trae.
      void cargar(true);
    }
  };

  useEffect(() => {
    if (!debeConsultar) return;
    const t = setInterval(() => {
      if (!document.hidden) void cargar(true);
    }, INTERVALO_MS);
    return () => clearInterval(t);
  }, [debeConsultar, cargar]);

  // Arrastrar y soltar en toda la ventana mientras la pantalla está abierta:
  // soltar fuera de la zona abriría el archivo en la pestaña y se perdería
  // el panel.
  useEffect(() => {
    if (!puedeSubir) return;
    let profundidad = 0;
    const entrar = (e: DragEvent) => {
      if (!tieneArchivos(e)) return;
      e.preventDefault();
      profundidad++;
      setArrastrando(true);
    };
    const sobre = (e: DragEvent) => {
      if (!tieneArchivos(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const salir = (e: DragEvent) => {
      if (!tieneArchivos(e)) return;
      profundidad = Math.max(0, profundidad - 1);
      if (profundidad === 0) setArrastrando(false);
    };
    const soltar = (e: DragEvent) => {
      if (!tieneArchivos(e)) return;
      e.preventDefault();
      profundidad = 0;
      setArrastrando(false);
      const archivos = Array.from(e.dataTransfer?.files ?? []);
      if (archivos.length) agregarArchivos(archivos, clientId);
    };
    window.addEventListener('dragenter', entrar);
    window.addEventListener('dragover', sobre);
    window.addEventListener('dragleave', salir);
    window.addEventListener('drop', soltar);
    return () => {
      window.removeEventListener('dragenter', entrar);
      window.removeEventListener('dragover', sobre);
      window.removeEventListener('dragleave', salir);
      window.removeEventListener('drop', soltar);
    };
  }, [clientId, puedeSubir]);

  const elegir = () => selector.current?.click();

  const refrescarUno = useCallback(
    async (id: string) => {
      const r = await cargar(true);
      return r?.medios.find((m) => m.id === id) ?? null;
    },
    [cargar],
  );

  const cerrarVisor = useCallback(() => {
    setAbierto(null);
    origen.current?.focus();
  }, []);

  const porId = useMemo(() => new Map(medios.map((m) => [m.id, m])), [medios]);
  const cuenta = (t: Pestana) => (t === 'todo' ? medios.length : medios.filter((m) => m.tipo === t).length);
  // En el celular, sin paréntesis: así las cuatro caben en una línea.
  const pestanaTexto = (nombre: string, t: Pestana) => (isDesktop ? `${nombre} (${cuenta(t)})` : `${nombre} ${cuenta(t)}`);
  const visibles = pestana === 'todo' ? medios : medios.filter((m) => m.tipo === pestana);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div className="contenedor-pagina">
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
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 24 : 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Berry Studio
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
              Sube clips, fotos y audio. Berry prepara la versión liviana para editar.
            </div>
          </div>
          {puedeSubir && (
            <button type="button" className="crm-btn crm-btn-primary" onClick={elegir}>
              <UploadIcon size={16} />
              Subir archivos
            </button>
          )}
          <input
            ref={selector}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              const archivos = Array.from(e.currentTarget.files ?? []);
              // Se limpia para poder elegir el mismo archivo otra vez: así se retoma.
              e.currentTarget.value = '';
              if (archivos.length) agregarArchivos(archivos, clientId);
            }}
          />
        </div>

        {isDesktop && puedeSubir && (
          <button
            type="button"
            onClick={elegir}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '18px 20px',
              marginBottom: 'var(--space-8)',
              border: '1.5px dashed var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--white)',
              color: 'var(--text-sub)',
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <span style={{ display: 'flex', color: 'var(--text-faint)' }}>
              <UploadIcon size={18} />
            </span>
            Arrastra los archivos a esta página o haz clic para elegirlos.
          </button>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, marginTop: isDesktop ? -16 : -8, marginBottom: 'var(--space-8)' }}>
          Videos MOV, MP4 o M4V hasta 20 GB · Fotos JPG, PNG o CR2 hasta 200 MB · Audio WAV, MP3, M4A, AAC o FLAC hasta 2 GB.
        </div>

        {subidas.length > 0 && (
          <div style={{ marginBottom: 'var(--space-9)' }}>
            <SectionHead count={activas.length ? { label: `${activas.length}`, tone: 'atencion' } : undefined}>
              Subidas
            </SectionHead>
            {activas.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 10 }}>
                No cierres esta pestaña mientras sube. Si se corta, vuelve a elegir el mismo archivo y sigue donde quedó.
              </div>
            )}
            <ListaSubidas entradas={subidas} medios={porId} />
          </div>
        )}

        <SectionHead>Biblioteca</SectionHead>
        <AsyncState loading={cargando} error={error} onRetry={() => void cargar()}>
          {!datos ? null : medios.length === 0 ? (
            <EmptyStateIllustrated
              icon={<FilmIcon size={36} />}
              title="Todavía no hay archivos"
              description="Sube clips, fotos o audio. Cuando Berry termine de prepararlos, aparecen acá listos para ver."
              cta={{ label: 'Subir archivos', onClick: elegir }}
            />
          ) : (
            <>
              <TabsWithIndicator
                tabs={[
                  { id: 'todo', label: pestanaTexto('Todo', 'todo') },
                  { id: 'video', label: pestanaTexto('Videos', 'video') },
                  { id: 'foto', label: pestanaTexto('Fotos', 'foto') },
                  { id: 'audio', label: pestanaTexto('Audio', 'audio') },
                ]}
                active={pestana}
                onChange={setPestana}
              />
              {visibles.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-sub)', padding: '8px 0 24px' }}>{VACIO[pestana]}</div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(240px, 1fr))' : '1fr',
                    gap: 16,
                  }}
                >
                  {visibles.map((m) => (
                    <TarjetaMedio
                      key={m.id}
                      medio={m}
                      ahora={ahora}
                      aqui={aqui(m)}
                      reanudable={reanudables.has(m.id)}
                      quitando={quitando === m.id}
                      errorQuitar={erroresQuitar[m.id] ?? null}
                      onQuitar={(medio) => void quitarAMedias(medio)}
                      onAbrir={(medio, el) => {
                        origen.current = el;
                        setAbierto(medio);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </AsyncState>
      </div>

      {arrastrando && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            pointerEvents: 'none',
            background: 'color-mix(in srgb, var(--primary) 10%, rgba(255,255,255,0.75))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              border: '2px dashed var(--primary)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--white)',
              color: 'var(--primary)',
              fontSize: 15,
              fontWeight: 600,
              padding: '28px 36px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: 'var(--shadow-card-hover)',
            }}
          >
            <UploadIcon size={22} />
            Suelta los archivos para subirlos
          </div>
        </div>
      )}

      {abierto && <VisorMedio medio={abierto} onCerrar={cerrarVisor} onRefrescar={refrescarUno} />}
    </div>
  );
}
