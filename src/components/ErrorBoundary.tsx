import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

// Red de seguridad para errores de render.
//
// Antes de esto, un solo TypeError en cualquier pantalla dejaba el panel
// COMPLETAMENTE EN BLANCO: React desmonta todo el árbol cuando un render
// lanza y nadie lo atrapa. Se descubrió el 2026-08-03 durante una prueba en
// la que una respuesta llegó incompleta y `datos.audiencia.total` explotó -
// el resultado no fue "esta sección falló", fue una página blanca sin
// sidebar, sin nada, y sin ninguna pista de qué pasó.
//
// Para el cliente esa diferencia es enorme: una pantalla blanca se lee como
// "el sistema se cayó" y termina en una llamada. Un recuadro que dice qué
// falló y ofrece recargar deja el resto del panel utilizable.
//
// AsyncState ya cubre los errores de RED (una petición que falla). Esto cubre
// lo otro: que el código de una pantalla reviente al dibujar.

interface Props {
  children: ReactNode;
  // Nombre de lo que se está protegiendo, para que el mensaje diga qué falló
  // en vez de "algo falló".
  nombre?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A la consola del navegador, que es donde se mira cuando alguien
    // reporta el problema. No se manda a ningún servicio externo: este panel
    // muestra datos de un cliente y el stack puede traer parte de ellos.
    console.error('[panel] error de render', this.props.nombre ?? '', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ padding: 32, maxWidth: 560, margin: '0 auto' }}>
        <div style={{ background: '#fdf0ef', border: '1px solid #f2ccc8', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#b42318', marginBottom: 8 }}>
            No se pudo mostrar {this.props.nombre ?? 'esta sección'}
          </div>
          <div style={{ fontSize: 13, color: '#7a2b24', lineHeight: 1.6, marginBottom: 16 }}>
            Es un problema de la pantalla, no de tus datos: nada se perdió ni se envió.
            Si vuelve a pasar, avísanos y lo revisamos.
          </div>
          <button className="crm-btn crm-btn-danger-filled" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
