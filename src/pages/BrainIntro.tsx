import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { mountBrainScene, brainPalette, type BrainAgent } from '../lib/brainScene';
import type { Agent } from '../agents';

// Pantalla de entrada al panel: el cerebro de marca del cliente con su equipo
// de agentes alrededor. Aprobada por Mato el 2026-08-07 con esta forma exacta:
// solo el cerebro y los agentes, todo centrado, sin bloque de texto al costado,
// y el botón de entrar discreto abajo a la derecha.
//
// Se muestra UNA vez por sesión de navegador (ver App.tsx), no en cada
// navegación: es una bienvenida, no una pantalla de trabajo.

export function BrainIntro({
  agents,
  accent,
  logoSrc,
  logoAlt,
  onEnter,
}: {
  agents: Agent[];
  accent: string;
  logoSrc: string | null;
  logoAlt: string;
  onEnter: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // Rox no es un agente táctico más: es quien emite la directiva estratégica
    // que los otros 6 consumen como contexto obligatorio (agent_core.py). Por
    // eso su conexión va más marcada y sus paquetes viajan SOLO hacia el
    // núcleo - escribe la memoria de marca, no la recibe.
    const scene: BrainAgent[] = agents.map((a) => ({
      name: a.name,
      role: a.role,
      tarea: a.tarea,
      frase: a.frase,
      dir: a.key === 'rox' ? 'in' : 'both',
      emphasis: a.key === 'rox',
    }));
    return mountBrainScene(el, { accent, agents: scene, logoSrc, logoAlt });
  }, [agents, accent, logoSrc, logoAlt]);

  // Las etiquetas de los agentes y el botón son DOM, no canvas: toman el color
  // del cliente por custom properties, derivadas del mismo acento que usa la
  // escena - no un azul fijo que sería el color de otro cliente.
  const themeVars = useMemo(() => {
    const pal = brainPalette(accent);
    return {
      '--brain-link': pal.link,
      '--brain-lit': pal.lit,
      '--brain-syn': pal.synapse,
    } as CSSProperties;
  }, [accent]);

  return (
    <div className="brain-screen" style={themeVars}>
      <div className="brain-stage" ref={stageRef} />
      <button type="button" className="brain-enter" onClick={onEnter}>
        Entrar <span aria-hidden="true">&#8594;</span>
      </button>
    </div>
  );
}
