import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getEmailConsultas, UnauthorizedError } from '../../../api/dashboardApi';
import type { EmailConsulta } from '../../../types';
import { Card, Boton, Aviso, Vacio, Tabla, formatFechaHora } from './shared';

// Las consultas que llegaron por el formulario de contacto del sitio.
//
// Esta pantalla existe por un caso real: hasta el 2026-08-23 el único lugar
// donde vivía el texto de una consulta era el correo de aviso interno. Ese
// correo apuntó 19 días a un buzón que nadie leía y la consulta de un
// cliente se perdió entera — no se atrasó, se perdió, porque no había
// ninguna otra copia. Acá está la copia.

function Detalle({ c, onCerrar }: { c: EmailConsulta; onCerrar: () => void }) {
  const filas: [string, string | number | null][] = [
    ['Correo', c.email],
    ['Teléfono', c.phone],
    ['País', c.country],
    ['Programa', c.program],
    ['Personas', c.anglers],
    ['Fechas aproximadas', c.approx_dates],
    ['Restricciones', c.dietary],
    ['Origen', c.source],
    ['Campaña', c.atribucion],
  ];
  return (
    <Card title={c.name || 'Consulta sin nombre'} right={<Boton onClick={onCerrar} sm>Volver</Boton>}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ opacity: 0.7, fontSize: 13 }}>{formatFechaHora(c.fecha)}</div>
        {filas.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, v]) => (
          <div key={label} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ opacity: 0.7, minWidth: 150 }}>{label}</span>
            <strong style={{ wordBreak: 'break-word' }}>{String(v)}</strong>
          </div>
        ))}
        <div style={{ marginTop: 8 }}>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>Mensaje</div>
          {/* pre-wrap: el visitante escribió con saltos de línea y perderlos
              convierte una consulta detallada en un párrafo ilegible */}
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {c.message || <span style={{ opacity: 0.6 }}>Sin mensaje</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ConsultasEmail() {
  const { handleUnauthorized } = useAuth();
  const [consultas, setConsultas] = useState<EmailConsulta[] | null>(null);
  const [dias, setDias] = useState(180);
  const [truncado, setTruncado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<EmailConsulta | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    getEmailConsultas()
      .then((r) => { setConsultas(r.consultas); setDias(r.dias); setTruncado(r.truncado); })
      .catch((e) => {
        if (e instanceof UnauthorizedError) { handleUnauthorized(); return; }
        setError(e?.message || 'No se pudieron cargar las consultas.');
        setConsultas([]);
      });
  }, [handleUnauthorized]);

  useEffect(() => { cargar(); }, [cargar]);

  if (abierta) return <Detalle c={abierta} onCerrar={() => setAbierta(null)} />;

  return (
    <Card
      title="Consultas del formulario"
      right={<Boton onClick={cargar} sm>Actualizar</Boton>}
    >
      {error && <Aviso tono="critico">{error}</Aviso>}
      {truncado && (
        <Aviso tono="alerta">
          Hay más consultas de las que caben en esta vista. Se muestran las más recientes.
        </Aviso>
      )}
      {consultas === null && <Vacio>Cargando…</Vacio>}
      {consultas !== null && consultas.length === 0 && !error && (
        <Vacio>Todavía no hay consultas registradas en los últimos {dias} días.</Vacio>
      )}
      {!!consultas?.length && (
        <Tabla cols={[{ label: 'Fecha' }, { label: 'Nombre' }, { label: 'Correo' }, { label: 'País' }, { label: 'Mensaje' }, { label: '' }]}>
          {consultas.map((c) => (
            <tr key={`${c.fecha}-${c.email}`}>
              <td>{formatFechaHora(c.fecha)}</td>
              <td>{c.name || '—'}</td>
              <td style={{ wordBreak: 'break-all' }}>{c.email || '—'}</td>
              <td>{c.country || '—'}</td>
              <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.message || '—'}
              </td>
              <td><Boton onClick={() => setAbierta(c)} sm>Ver</Boton></td>
            </tr>
          ))}
        </Tabla>
      )}
    </Card>
  );
}
