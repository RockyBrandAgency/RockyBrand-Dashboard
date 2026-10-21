import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * QR dibujado en el navegador, sin red: el contenido (la clave TOTP) nunca
 * sale a un servicio de QR externo. qrcode-generator 2.0.4 (MIT, sin
 * dependencias) solo calcula la matriz; acá se arma un <svg> con un único
 * <path>, sin innerHTML.
 */
export function CodigoQr({ valor, tamano = 176, etiqueta }: { valor: string; tamano?: number; etiqueta: string }) {
  const { d, lado } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(valor);
    qr.make();
    const n = qr.getModuleCount();
    const margen = 4; // zona de silencio de 4 módulos (ISO/IEC 18004)
    let camino = '';
    for (let fila = 0; fila < n; fila++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(fila, col)) camino += `M${col + margen} ${fila + margen}h1v1h-1z`;
      }
    }
    return { d: camino, lado: n + margen * 2 };
  }, [valor]);

  return (
    <svg
      role="img"
      aria-label={etiqueta}
      viewBox={`0 0 ${lado} ${lado}`}
      shapeRendering="crispEdges"
      // Cuadrado siempre: hasta `tamano` px y, en una pantalla más angosta,
      // el ancho disponible (sin desbordar a 320 px).
      style={{ display: 'block', width: '100%', maxWidth: tamano, height: 'auto', aspectRatio: '1 / 1', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
    >
      <path d={d} fill="#000" />
    </svg>
  );
}

/**
 * URI otpauth que leen las apps de autenticación (formato «Key Uri Format»
 * de Google Authenticator). Emisor y cuenta van codificados por separado.
 */
export function uriTotp(secreto: string, cuenta: string, emisor = 'RockyBrand'): string {
  const etiqueta = `${encodeURIComponent(emisor)}:${encodeURIComponent(cuenta)}`;
  return `otpauth://totp/${etiqueta}?secret=${encodeURIComponent(secreto)}&issuer=${encodeURIComponent(emisor)}`;
}
