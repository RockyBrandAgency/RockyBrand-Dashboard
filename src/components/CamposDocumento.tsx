import { TIPOS_DOCUMENTO, type BorradorDocumento } from '../lib/acompanantes';

// Campos del documento del registro de pasajeros (2026-10-30). La ficha todavía
// no edita el documento del pescador (el backend no lo manda al panel, ver
// HuespedItem en types.ts); este bloque queda aparte para usarlo ahí cuando
// llegue. Recibe los estilos de quien lo usa para no romper su convención.
export function CamposDocumento({
  idBase,
  valor,
  onChange,
  estiloEtiqueta,
  estiloCampo,
}: {
  idBase: string;
  valor: BorradorDocumento;
  onChange: (v: BorradorDocumento) => void;
  estiloEtiqueta: React.CSSProperties;
  estiloCampo: React.CSSProperties;
}) {
  return (
    <fieldset data-bloque="documento" style={{ border: 'none', padding: 0, margin: '14px 0 0', minWidth: 0 }}>
      <legend style={{ ...estiloEtiqueta, padding: 0 }}>Documento (registro de pasajeros)</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12, marginTop: 8 }}>
        <div>
          <label style={estiloEtiqueta} htmlFor={`${idBase}-doc-tipo`}>
            Tipo de documento
          </label>
          <select
            id={`${idBase}-doc-tipo`}
            value={valor.Type}
            onChange={(e) => onChange({ ...valor, Type: e.target.value as BorradorDocumento['Type'] })}
            style={estiloCampo}
          >
            <option value="">Sin documento</option>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={estiloEtiqueta} htmlFor={`${idBase}-doc-numero`}>
            Número de documento
          </label>
          <input
            id={`${idBase}-doc-numero`}
            value={valor.Number}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onChange({ ...valor, Number: e.target.value })}
            style={estiloCampo}
          />
        </div>
        <div>
          <label style={estiloEtiqueta} htmlFor={`${idBase}-doc-nacionalidad`}>
            Nacionalidad
          </label>
          <input
            id={`${idBase}-doc-nacionalidad`}
            value={valor.Nationality}
            placeholder="Ej.: USA, BRA, CHL"
            autoComplete="off"
            onChange={(e) => onChange({ ...valor, Nationality: e.target.value })}
            style={{ ...estiloCampo, textTransform: 'uppercase' }}
          />
        </div>
        <div>
          <label style={estiloEtiqueta} htmlFor={`${idBase}-doc-ingreso`}>
            Fecha de ingreso al país
          </label>
          <input
            id={`${idBase}-doc-ingreso`}
            type="date"
            value={valor.EntryDate}
            min="1900-01-01"
            onChange={(e) => onChange({ ...valor, EntryDate: e.target.value })}
            style={estiloCampo}
          />
        </div>
      </div>
    </fieldset>
  );
}
