import { useId, useState, type FormEvent } from 'react';
import { Check, Copy } from 'lucide-react';
import { CodigoQr, uriTotp } from './CodigoQr';

/**
 * Piezas de la verificación en dos pasos (TOTP), compartidas por el login y
 * por Configuración: el campo del código de 6 dígitos y la inscripción con QR.
 */

export function CampoCodigo({
  valor,
  onCambio,
  idError,
  autoFocus,
}: {
  valor: string;
  onCambio: (v: string) => void;
  idError?: string;
  autoFocus?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)' }}>Código de 6 dígitos</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus={autoFocus}
        value={valor}
        // Se dejan solo dígitos: al pegar «123 456» desde la app queda «123456».
        onChange={(e) => onCambio(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-describedby={idError}
        placeholder="000000"
        className="crm-input"
        style={{ fontSize: 20, letterSpacing: '0.3em', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
      />
    </label>
  );
}

// La clave en grupos de 4, como la muestran las apps al escribirla a mano.
function enGrupos(secreto: string): string {
  return secreto.replace(/(.{4})/g, '$1 ').trim();
}

export function InscripcionTotp({
  secreto,
  cuenta,
  ocupado,
  error,
  textoBoton,
  onVerificar,
}: {
  secreto: string;
  cuenta: string;
  ocupado: boolean;
  error: string | null;
  textoBoton: string;
  onVerificar: (codigo: string) => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [copiada, setCopiada] = useState(false);
  const idError = useId();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(secreto);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      // Sin permiso de portapapeles la clave sigue a la vista para copiarla a mano.
    }
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (codigo.length === 6) onVerificar(codigo);
  };

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
        <li>Abre tu app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password u otra).</li>
        <li>Escanea este código QR con la app.</li>
        <li>Escribe el código de 6 dígitos que te muestre.</li>
      </ol>

      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <CodigoQr valor={uriTotp(secreto, cuenta)} etiqueta="Código QR para vincular tu app de autenticación" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>¿No puedes escanear? Escribe esta clave en la app:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <code
            data-secreto-totp
            style={{
              flex: '1 1 180px',
              minWidth: 0,
              overflowWrap: 'anywhere',
              userSelect: 'all',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 13,
              padding: '8px 10px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
            }}
          >
            {enGrupos(secreto)}
          </code>
          <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={copiar}>
            {copiada ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copiada ? 'Copiada' : 'Copiar clave'}
          </button>
        </div>
      </div>

      <CampoCodigo valor={codigo} onCambio={setCodigo} idError={error ? idError : undefined} />

      {error && (
        <div id={idError} role="alert" style={{ fontSize: 13, color: 'var(--status-critico-text)', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <button type="submit" className="crm-btn crm-btn-primary" disabled={ocupado || codigo.length !== 6} style={{ width: '100%' }}>
        {ocupado ? 'Verificando…' : textoBoton}
      </button>
    </form>
  );
}
