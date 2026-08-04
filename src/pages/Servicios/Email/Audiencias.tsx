import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getEmailResumen, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailContact, EmailAudiencia } from '../../../types';
import { ImportarCsv } from './ImportarCsv';
import { Card, Boton, Campo, Aviso, Vacio, Pill, Tabla, estadoContacto, formatFecha } from './shared';
import { SearchIcon, PlusIcon } from '../../../components/icons/RockyIcons';

// Misma pantalla que Audiencias del panel principal: barra de segmentos a la
// izquierda, buscador y las DOS vías de alta arriba (a mano o por archivo),
// tabla de contactos abajo.
//
// La distinción entre "Todos" y "Suscritos activos" es el número que más
// importa acá: alguien que está en la lista pero no confirmó NO recibe
// campañas, y mirar solo el total hace creer que el alcance es mayor.

interface Segmento {
  key: string;
  label: string;
  filtro: (c: EmailContact) => boolean;
}

// Mismos segmentos que managementSegments() en el panel principal.
function segmentos(contacts: EmailContact[]): Segmento[] {
  const base: Segmento[] = [
    { key: 'all', label: 'Todos', filtro: () => true },
    { key: 'subscribed', label: 'Suscritos activos', filtro: (c) => c.status === 'subscribed' },
    { key: 'pending', label: 'Sin confirmar', filtro: (c) => c.status === 'pending' },
    { key: 'unsubscribed', label: 'No suscritos', filtro: (c) => c.status === 'unsubscribed' },
    { key: 'bounced', label: 'Rebotados', filtro: (c) => c.status === 'bounced' },
    { key: 'complained', label: 'Marcaron spam', filtro: (c) => c.status === 'complained' },
  ];
  const tags = new Set<string>();
  contacts.forEach((c) => (c.tags || []).forEach((t) => tags.add(t)));
  Array.from(tags).sort().forEach((t) => base.push({ key: `tag:${t}`, label: t, filtro: (c) => (c.tags || []).includes(t) }));
  return base;
}

export function AudienciasEmail({ contacts, onReload, onAdd, onDelete }: {
  contacts: EmailContact[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onAdd: (email: string, name: string, tags: string[]) => Promise<void>;
  onDelete: (email: string) => Promise<void>;
}) {
  const { handleUnauthorized } = useAuth();
  const [audiencia, setAudiencia] = useState<EmailAudiencia | null>(null);
  const [segActivo, setSegActivo] = useState('all');
  const [busqueda, setBusqueda] = useState('');
  const [verForm, setVerForm] = useState(false);
  const [verImport, setVerImport] = useState(false);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [tags, setTags] = useState('');
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargarResumen = useCallback(() => {
    getEmailResumen()
      .then((r) => setAudiencia(r.audiencia))
      .catch((e: unknown) => {
        // Un fallo acá no debe tapar la lista de contactos, que es lo
        // principal de la pantalla: se omite el resumen y ya.
        if (e instanceof UnauthorizedError) handleUnauthorized();
      });
  }, [handleUnauthorized]);

  useEffect(cargarResumen, [cargarResumen]);

  const lista = contacts ?? [];
  const segs = useMemo(() => segmentos(lista), [lista]);
  const seg = segs.find((s) => s.key === segActivo) ?? segs[0];
  const filtrados = lista.filter(seg.filtro).filter((c) => {
    const q = busqueda.toLowerCase();
    return !q || (c.email || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q);
  });

  const recargarTodo = () => { onReload(); cargarResumen(); };

  async function guardar() {
    if (!correo.trim() || !correo.includes('@')) {
      setErrorForm('Ingresa un correo válido.');
      return;
    }
    setErrorForm(null);
    await onAdd(correo.trim(), nombre.trim(), tags.split(',').map((t) => t.trim()).filter(Boolean));
    setNombre(''); setCorreo(''); setTags(''); setVerForm(false);
    cargarResumen();
  }

  async function borrar(email: string) {
    if (!confirm(`¿Eliminar a ${email} de la audiencia?`)) return;
    await onDelete(email);
    cargarResumen();
  }

  return (
    <>
      {audiencia && audiencia.pendientes_confirmacion > 0 && (
        <Aviso tono="info">
          {audiencia.pendientes_confirmacion}{' '}
          {audiencia.pendientes_confirmacion === 1 ? 'persona recibió' : 'personas recibieron'} el correo de confirmación
          y todavía no {audiencia.pendientes_confirmacion === 1 ? 'lo confirma' : 'lo confirman'}. Hasta que lo hagan no
          entran en ninguna campaña.
        </Aviso>
      )}

      <div className="crm-aud-layout">
        <div className="crm-card" style={{ padding: 'var(--space-7)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 'var(--space-5)' }}>Segmentos y Listas</div>
          {segs.map((s) => (
            <div
              key={s.key}
              className={`crm-seg-item${s.key === segActivo ? ' active' : ''}`}
              onClick={() => setSegActivo(s.key)}
            >
              <span>{s.label}</span>
              <span className="crm-seg-count">{lista.filter(s.filtro).length}</span>
            </div>
          ))}
        </div>

        <div>
          <div className="crm-toolbar">
            <div className="crm-search-wrap">
              <SearchIcon size={14} color="var(--text-sub)" />
              <input
                className="crm-search"
                placeholder="Buscar contacto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            {/* Las dos vías de alta, igual que en el panel principal: a mano
                para un contacto suelto, archivo para una base entera. */}
            <Boton sm onClick={() => { setVerImport((v) => !v); setVerForm(false); }}>Importar CSV</Boton>
            <Boton sm tipo="primary" onClick={() => { setVerForm((v) => !v); setVerImport(false); }}>
              <PlusIcon size={11} color="#fff" /> Agregar Contacto
            </Boton>
          </div>

          {verImport && <ImportarCsv onImportado={() => { setVerImport(false); recargarTodo(); }} />}

          {verForm && (
            <Card>
              {errorForm && <Aviso tono="critico">{errorForm}</Aviso>}
              <Campo label="Nombre">
                <input className="crm-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </Campo>
              <Campo label="Correo">
                <input className="crm-input" placeholder="nombre@dominio.com" value={correo} onChange={(e) => setCorreo(e.target.value)} />
              </Campo>
              <Campo label="Tags (separados por coma)" hint="Sirven para segmentar a quién le llega cada campaña.">
                <input className="crm-input" placeholder="cliente anterior, VIP" value={tags} onChange={(e) => setTags(e.target.value)} />
              </Campo>
              <div style={{ display: 'flex', gap: 10 }}>
                <Boton sm tipo="primary" onClick={guardar}>Guardar contacto</Boton>
                <Boton sm onClick={() => { setVerForm(false); setErrorForm(null); }}>Cancelar</Boton>
              </div>
            </Card>
          )}

          <div className="crm-card">
            <Tabla cols={[{ label: 'Contacto' }, { label: 'Estado' }, { label: 'Tags' }, { label: 'Alta' }, { label: '' }]}>
              {filtrados.map((c) => (
                <tr key={c.email}>
                  <td>
                    <div className="crm-cell-name">{c.name || '(sin nombre)'}</div>
                    <div className="crm-cell-sub">{c.email}</div>
                  </td>
                  <td><Pill estado={c.status}>{estadoContacto(c.status)}</Pill></td>
                  <td>{(c.tags || []).map((t) => <span className="crm-tag" key={t}>{t}</span>)}</td>
                  <td className="crm-cell-sub">{formatFecha(c.created_at)}</td>
                  <td>
                    <div className="crm-row-actions">
                      <Boton sm tipo="danger" onClick={() => borrar(c.email)}>Eliminar</Boton>
                    </div>
                  </td>
                </tr>
              ))}
            </Tabla>
            {!filtrados.length && <Vacio>Sin contactos en este segmento todavía.</Vacio>}
          </div>
        </div>
      </div>
    </>
  );
}
