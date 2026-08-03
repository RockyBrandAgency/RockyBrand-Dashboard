import { useState } from 'react';
import { importEmailCsv, UnauthorizedError } from '../../../api/dashboardApi';
import { useAuth } from '../../../context/AuthContext';
import type { EmailImportResult } from '../../../types';
import { Panel, Boton, Aviso, Vacio, Tabla, td, tdMuted, trStyle } from './shared';

// Carga de una base de contactos desde CSV.
//
// El flujo es a propósito en dos pasos: primero se muestra qué pasaría, y
// recién después se escribe. Importar una base sucia es la principal fuente
// de rebotes duros, y la cuenta de envío es COMPARTIDA entre todos los
// clientes: una base mala de uno le sube el porcentaje de rebote a todos y
// puede terminar en una suspensión que afecta a gente que no hizo nada.
//
// Los importados quedan como "pendientes" hasta que confirman por correo. No
// es una formalidad: escribirle a alguien que nunca dijo que sí es lo que
// genera las quejas de spam, y las quejas son lo que hunde un dominio.
export function ImportarCsv({ onImportado }: { onImportado: () => void }) {
  const { handleUnauthorized } = useAuth();
  const [csv, setCsv] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<EmailImportResult | null>(null);
  const [resultado, setResultado] = useState<EmailImportResult | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leerArchivo = (file: File) => {
    setError(null);
    setPrevia(null);
    setResultado(null);
    setNombreArchivo(file.name);
    const lector = new FileReader();
    lector.onload = () => setCsv(String(lector.result ?? ''));
    lector.onerror = () => setError('No se pudo leer el archivo.');
    // Excel en Chile suele guardar en Latin-1; UTF-8 con fallback cubre los
    // dos casos sin pedirle a nadie que sepa qué codificación usó.
    lector.readAsText(file, 'utf-8');
  };

  const ejecutar = async (vistaPrevia: boolean) => {
    if (!csv.trim()) { setError('Primero elige un archivo o pega el contenido.'); return; }
    setCargando(true);
    setError(null);
    try {
      const r = await importEmailCsv(csv, vistaPrevia);
      if (vistaPrevia) { setPrevia(r); setResultado(null); }
      else { setResultado(r); setPrevia(null); onImportado(); }
    } catch (e) {
      if (e instanceof UnauthorizedError) return handleUnauthorized();
      setError(e instanceof Error ? e.message : 'No se pudo procesar el archivo.');
    } finally {
      setCargando(false);
    }
  };

  const inf = (previa ?? resultado)?.informe;

  return (
    <Panel title="Importar contactos desde un archivo">
      <Aviso tono="info">
        El archivo tiene que tener una primera fila con los nombres de columna e incluir una columna
        de correo (<code>email</code> o <code>correo</code>). Opcionales: <code>nombre</code> y <code>etiquetas</code>.
        Sirve tanto separado por comas como por punto y coma.
        <br />
        Si tienes un Excel, guárdalo como CSV antes de subirlo.
      </Aviso>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={{ cursor: 'pointer' }}>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) leerArchivo(f); }}
          />
          <span style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--white)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            Elegir archivo CSV
          </span>
        </label>
        {nombreArchivo && <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{nombreArchivo}</span>}
      </div>

      {error && <Aviso tono="critico">{error}</Aviso>}

      {csv.trim() && !resultado && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <Boton onClick={() => ejecutar(true)} disabled={cargando}>
            {cargando ? 'Revisando…' : 'Revisar antes de importar'}
          </Boton>
          {previa && (previa.informe?.validas ?? 0) > 0 && (
            <Boton tipo="primario" onClick={() => ejecutar(false)} disabled={cargando}>
              Importar {previa.informe.validas} {previa.informe.validas === 1 ? 'contacto' : 'contactos'}
            </Boton>
          )}
        </div>
      )}

      {resultado && (
        <Aviso tono="ok">
          <strong>Importados {resultado.importados}.</strong>{' '}
          {resultado.ya_existian ? `${resultado.ya_existian} ya estaban en la lista. ` : ''}
          {resultado.nota}
        </Aviso>
      )}

      {inf && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14, marginBottom: 14 }}>
            {[
              { l: 'Filas leídas', v: inf.leidas, c: 'var(--text)' },
              { l: 'Válidas', v: inf.validas, c: '#216b35' },
              { l: 'Descartadas', v: inf.descartadas, c: inf.descartadas > 0 ? '#8a6116' : 'var(--text-muted)' },
            ].map((m) => (
              <div key={m.l}>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{m.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.c, marginTop: 4 }}>{m.v.toLocaleString('es-CL')}</div>
              </div>
            ))}
          </div>

          {inf.truncado && <Aviso tono="alerta">El archivo es más grande que el máximo permitido y se leyó solo una parte. Divídelo y súbelo por tandas.</Aviso>}

          {/* Lo descartado se muestra con el motivo, no se descarta en
              silencio: casi siempre es una columna mal exportada, y verlo es
              lo único que permite corregirla. */}
          {inf.descartadas > 0 && (
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-sub)' }}>
              {inf.email_invalido.length > 0 && <div><strong>Correos mal escritos ({inf.email_invalido.length}):</strong> {inf.email_invalido.slice(0, 8).join(', ')}{inf.email_invalido.length > 8 ? '…' : ''}</div>}
              {inf.duplicadas_en_archivo.length > 0 && <div><strong>Repetidos dentro del archivo ({inf.duplicadas_en_archivo.length}):</strong> {inf.duplicadas_en_archivo.slice(0, 8).join(', ')}{inf.duplicadas_en_archivo.length > 8 ? '…' : ''}</div>}
              {inf.sin_email > 0 && <div><strong>Filas sin correo:</strong> {inf.sin_email}</div>}
            </div>
          )}
        </>
      )}

      {previa?.muestra && previa.muestra.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Así se van a importar</div>
          {previa.muestra.length === 0 ? <Vacio>Nada que importar.</Vacio> : (
            <Tabla cols={[{ label: 'Correo' }, { label: 'Nombre' }, { label: 'Etiquetas' }]}>
              {previa.muestra.slice(0, 10).map((m) => (
                <tr key={m.email} style={trStyle}>
                  <td style={td}>{m.email}</td>
                  <td style={tdMuted}>{m.name || '—'}</td>
                  <td style={tdMuted}>{m.tags.length ? m.tags.join(', ') : '—'}</td>
                </tr>
              ))}
            </Tabla>
          )}
        </div>
      )}
    </Panel>
  );
}
