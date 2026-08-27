// Cuán viejo es el dato que está mirando el cliente.
//
// Las cifras de RRSS del panel NO son llamadas en vivo a Meta: son snapshots
// que escribe el agente `analytics` cuando corre. Si el agente se apaga, el
// panel sigue mostrando el último número con la misma cara de siempre y el
// atraso es invisible — pasó de verdad con alto-castillo, que estuvo 16 días
// mostrando datos del 11-ago como si fueran de hoy.
//
// El umbral es 2 días y no 1 a propósito: Meta nunca entrega el día en curso,
// así que "el dato es de ayer" es el estado NORMAL y marcarlo en rojo
// entrenaría a ignorar el aviso.
export function SelloFrescura({ fecha, diasDeAtraso }: { fecha: string | null; diasDeAtraso: number | null }) {
  if (!fecha || diasDeAtraso == null) return null;

  const viejo = diasDeAtraso > 2;
  const fechaLegible = new Date(`${fecha}T00:00:00`).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
  });

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 11px',
        borderRadius: 'var(--radius-pill)',
        background: viejo ? 'var(--status-atencion-bg)' : 'var(--status-neutro-bg)',
        color: viejo ? 'var(--status-atencion-text)' : 'var(--text-sub)',
        fontSize: 'var(--font-size-xs)',
        marginBottom: 18,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: viejo ? 'var(--status-atencion-dot)' : 'var(--status-bien-dot)',
          flexShrink: 0,
        }}
      />
      {diasDeAtraso <= 0 ? (
        <span>Datos recolectados hoy.</span>
      ) : (
        <span>
          Datos al <strong>{fechaLegible}</strong>
          {viejo ? ` — ${diasDeAtraso} días sin actualizar.` : ` (ayer).`}
        </span>
      )}
    </div>
  );
}
