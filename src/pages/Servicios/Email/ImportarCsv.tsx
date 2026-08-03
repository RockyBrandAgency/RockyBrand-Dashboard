import { useState } from 'react';
import { importEmailCsv, UnauthorizedError } from '../../../api/dashboardApi';
import { useAuth } from '../../../context/AuthContext';
import type { EmailImportResult } from '../../../types';
import { Card, Boton, Aviso, Tabla } from './shared';

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
    <Card title="Importar contactos desde un archivo">
      <Aviso tono="info">
        El archivo tiene que tener una primera fila con los nombres de columna e incluir una columna
        de correo (<code>email</code> o <code>correo</code>). Opcionales: <code>nombre</code> y <code>etiquetas</code>.
        Sirve tanto separado por comas como por punto y coma.
        <br />
        Si tienes un Excel, guárdalo como CSV antes de subirlo.
      </Aviso>

      <div className="crm-import-actions">
        <label style={{ cursor: 'pointer' }}>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) leerArchivo(f); }}
          />
          <span className="crm-btn crm-btn-ghost crm-btn-sm">Elegir archivo CSV</span>
        </label>
        {nombreArchivo && <span className="crm-cell-sub">{nombreArchivo}</span>}
      </div>

      {error && <Aviso tono="critico">{error}</Aviso>}

      {csv.trim() && !resultado && (
        <div className="crm-import-actions">
          <Boton sm onClick={() => ejecutar(true)} disabled={cargando}>
            {cargando ? 'Revisando…' : 'Revisar antes de importar'}
          </Boton>
          {previa && (previa.informe?.validas ?? 0) > 0 && (
            <Boton sm tipo="primary" onClick={() => ejecutar(false)} disabled={cargando}>
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
          <div className="crm-import-cifras">
            {[
              { l: 'Filas leídas', v: inf.leidas, cls: '' },
              { l: 'Válidas', v: inf.validas, cls: ' ok' },
              { l: 'Descartadas', v: inf.descartadas, cls: inf.descartadas > 0 ? ' alerta' : '' },
            ].map((m) => (
              <div key={m.l}>
                <div className="crm-mini-label">{m.l}</div>
                <div className={`crm-import-num${m.cls}`}>{m.v.toLocaleString('es-CL')}</div>
              </div>
            ))}
          </div>

          {inf.truncado && <Aviso tono="alerta">El archivo es más grande que el máximo permitido y se leyó solo una parte. Divídelo y súbelo por tandas.</Aviso>}

          {/* Lo descartado se muestra con el motivo, no se descarta en
              silencio: casi siempre es una columna mal exportada, y verlo es
              lo único que permite corregirla. */}
          {inf.descartadas > 0 && (
            <div className="crm-import-descartes">
              {inf.email_invalido.length > 0 && <div><strong>Correos mal escritos ({inf.email_invalido.length}):</strong> {inf.email_invalido.slice(0, 8).join(', ')}{inf.email_invalido.length > 8 ? '…' : ''}</div>}
              {inf.duplicadas_en_archivo.length > 0 && <div><strong>Repetidos dentro del archivo ({inf.duplicadas_en_archivo.length}):</strong> {inf.duplicadas_en_archivo.slice(0, 8).join(', ')}{inf.duplicadas_en_archivo.length > 8 ? '…' : ''}</div>}
              {inf.sin_email > 0 && <div><strong>Filas sin correo:</strong> {inf.sin_email}</div>}
            </div>
          )}
        </>
      )}

      {previa?.muestra && previa.muestra.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="crm-desc-label">Así se van a importar</div>
          <Tabla cols={[{ label: 'Correo' }, { label: 'Nombre' }, { label: 'Tags' }]}>
            {previa.muestra.slice(0, 10).map((m) => (
              <tr key={m.email}>
                <td>{m.email}</td>
                <td className="crm-cell-sub">{m.name || '—'}</td>
                <td>{m.tags.length ? m.tags.map((t) => <span className="crm-tag" key={t}>{t}</span>) : '—'}</td>
              </tr>
            ))}
          </Tabla>
        </div>
      )}
    </Card>
  );
}
