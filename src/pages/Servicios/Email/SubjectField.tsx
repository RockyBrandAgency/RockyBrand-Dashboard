
// Campo de asunto con el largo óptimo a la vista, pedido explícito de Mato.
//
// Los números no son una opinión de diseño: 28-50 caracteres es el rango que
// entra completo en la bandeja de la mayoría de los clientes de correo, ~45
// es lo que muestra un teléfono en vertical (donde se abre la mayoría del
// correo hoy), y pasados los ~78 se corta en casi todos. El corte importa
// porque la parte que se pierde es siempre el final, que es justo donde suele
// estar el gancho.
//
// La validación DE VERDAD la hace el backend (guardar_campana rechaza asunto
// vacío y asunto sobre el máximo duro). Esto es la ayuda mientras se escribe,
// no el guardián: una pantalla nunca es el lugar donde se hace cumplir una
// regla.

export const SUBJECT_MIN = 28;
export const SUBJECT_OPTIMO_MAX = 50;
export const SUBJECT_VISIBLE_MOVIL = 45;
export const SUBJECT_MAX_DURO = 78;

const PALABRAS_RIESGO = [
  'gratis', 'free', 'urgente', 'oferta', 'promoción', 'promocion', 'descuento',
  'ganador', 'ganaste', 'premio', 'garantizado', 'sin costo', '100%', 'click aquí', 'click aqui',
];

export interface Evaluacion {
  largo: number;
  estado: 'vacio' | 'corto' | 'optimo' | 'largo' | 'problema';
  avisos: string[];
}

// Mismo criterio que evaluar_asunto en el backend. Se repite acá a propósito
// para que el aviso aparezca mientras se escribe, sin una llamada de red por
// cada tecla - pero el que manda al guardar sigue siendo el backend.
export function evaluarAsunto(texto: string): Evaluacion {
  const s = (texto ?? '').trim();
  const largo = s.length;
  const avisos: string[] = [];

  if (largo === 0) return { largo: 0, estado: 'vacio', avisos: ['El asunto está vacío.'] };

  const minusculas = s.toLowerCase();
  const riesgo = PALABRAS_RIESGO.filter((p) => minusculas.includes(p));
  if (riesgo.length >= 2) {
    avisos.push(`Palabras que los filtros de spam miran con lupa: ${riesgo.join(', ')}.`);
  }

  const letras = s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  if (letras.length >= 6 && letras === letras.toUpperCase()) {
    avisos.push('Está todo en mayúsculas: se lee como grito y penaliza la entrega.');
  }
  if ((s.match(/!/g) ?? []).length > 1) {
    avisos.push('Más de un signo de exclamación.');
  }

  let estado: Evaluacion['estado'];
  if (largo > SUBJECT_MAX_DURO) {
    estado = 'problema';
    avisos.push(`Pasa los ${SUBJECT_MAX_DURO} caracteres: se corta en casi todos los clientes de correo.`);
  } else if (largo > SUBJECT_OPTIMO_MAX) {
    estado = 'largo';
  } else if (largo < SUBJECT_MIN) {
    estado = 'corto';
  } else {
    estado = 'optimo';
  }
  if (riesgo.length >= 2 || avisos.length >= 2) estado = 'problema';

  return { largo, estado, avisos };
}

const COLOR: Record<Evaluacion['estado'], string> = {
  vacio: 'var(--text-muted)',
  corto: '#8a6116',
  optimo: '#216b35',
  largo: '#8a6116',
  problema: '#b42318',
};

const GLOSA: Record<Evaluacion['estado'], string> = {
  vacio: 'Escribe el asunto',
  corto: `Corto — lo ideal parte en ${SUBJECT_MIN}`,
  optimo: 'Largo óptimo',
  largo: `Se ve completo hasta ${SUBJECT_OPTIMO_MAX}`,
  problema: 'Revísalo antes de enviar',
};

export function SubjectField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ev = evaluarAsunto(value);
  const color = COLOR[ev.estado];
  const proporcion = Math.min(ev.largo / SUBJECT_MAX_DURO, 1);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div className="crm-field-label" style={{ marginBottom: 0 }}>Asunto</div>
        <div style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
          {ev.largo} · {GLOSA[ev.estado]}
        </div>
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="La temporada de mosca seca abre en Coyhaique"
        className="crm-input"
        style={{ borderColor: ev.estado === 'problema' ? '#f0c4c0' : undefined }}
      />

      {/* La barra marca dónde queda el rango óptimo y dónde corta el móvil,
          para que el largo se entienda de una mirada y no leyendo un número. */}
      <div style={{ position: 'relative', height: 4, background: 'var(--border-soft)', borderRadius: 2, marginTop: 8 }}>
        <div style={{
          position: 'absolute', left: `${(SUBJECT_MIN / SUBJECT_MAX_DURO) * 100}%`,
          width: `${((SUBJECT_OPTIMO_MAX - SUBJECT_MIN) / SUBJECT_MAX_DURO) * 100}%`,
          top: 0, bottom: 0, background: '#cde6d4', borderRadius: 2,
        }} />
        <div style={{ position: 'absolute', left: `${(SUBJECT_VISIBLE_MOVIL / SUBJECT_MAX_DURO) * 100}%`, top: -3, bottom: -3, width: 1, background: 'var(--text-muted)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${proporcion * 100}%`, background: color, borderRadius: 2, opacity: 0.85 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
        <span>{SUBJECT_MIN}</span>
        <span>{SUBJECT_VISIBLE_MOVIL} · corte en móvil</span>
        <span>{SUBJECT_MAX_DURO}</span>
      </div>

      {ev.avisos.length > 0 && ev.estado !== 'vacio' && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 11.5, color: COLOR[ev.estado], lineHeight: 1.6 }}>
          {ev.avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
    </div>
  );
}
