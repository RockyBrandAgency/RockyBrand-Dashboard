// Los 7 agentes de IA REALES de RockyBrand, con sus nombres y roles tal cual
// existen en el backend - no una lista inventada para la UI.
//
// Fuentes de verdad (verificadas 2026-08-07 leyendo el código, no de memoria):
// - Nombres y claves: `04-codigo/agent_core.py` (docstring: "Modulo compartido
//   entre los 7 agentes de IA (Jimi, Dave, Neil, Slash, Thelma, Cameron, Rox)")
//   y `infra/rockybrand_infra/agents_stack.py` (AGENT_SCHEDULE_CRON).
// - Roles: títulos de los playbooks en `02-agents/playbooks/` ("Art Director &
//   Visual Concept Creator", "Performance & Data Analytics Specialist",
//   "Search, Geographic & AI Engine Optimization Expert", "Content & Social
//   Media Strategist") y el prompt de Rox en `04-codigo/panel_config_api_lambda.py`
//   ("Eres Rox, Chief Marketing Officer de {NOMBRE_CLIENTE}").
// - Qué usa cada uno: regla 4 del prompt de Rox, que enumera las herramientas
//   reales de cada agente ("Cameron: Reddit/RSS; Slash: Search Console; Jimi:
//   inventario de fotos del cliente; Dave: calendario; Thelma: clips + voz").
//
// Los roles quedan en inglés porque así están escritos en el backend y en los
// playbooks; `tarea` va en español porque es lo que lee el cliente.

export type AgentKey =
  | 'rox'
  | 'content_strategist'
  | 'art_director'
  | 'analytics'
  | 'seo_geo_aeo'
  | 'filmmaker'
  | 'research';

export interface Agent {
  key: AgentKey;
  name: string;
  role: string;
  /** Su herramienta real: con qué trabaja. Se muestra pegado al agente. */
  tarea: string;
  /** Su compromiso con la marca, en primera persona. No es marketing: es
   *  literal cómo funciona el sistema. Rox emite una directiva estratégica y
   *  agent_core.mandato_de_rox se la inyecta a los otros 6 como contexto
   *  OBLIGATORIO ("Estas directivas son obligatorias. Si tu output las
   *  contradice, corrigelo."). Por eso Rox dice que los define y el resto dice
   *  que los sigue - no son la misma frase porque no hacen lo mismo. */
  frase: string;
}

// Rox va primero a propósito: es el único que no produce táctica. Emite la
// directiva estratégica que los otros 6 consumen como contexto obligatorio
// (ver agent_core.mandato_de_rox), y por eso en la pantalla se dibuja pegado
// al núcleo y no en el anillo.
export const AGENTS: Record<AgentKey, Agent> = {
  rox: {
    key: 'rox',
    name: 'Rox',
    role: 'Chief Marketing Officer',
    tarea: 'Define el norte de la marca y la directiva que siguen los demás',
    frase: 'Yo defino los objetivos de la marca, y el resto del equipo trabaja alineado a ellos.',
  },
  content_strategist: {
    key: 'content_strategist',
    name: 'Dave',
    role: 'Content & Social Strategist',
    tarea: 'Arma el calendario de contenido',
    frase: 'Todo lo que planifico va en línea con los objetivos de la marca.',
  },
  art_director: {
    key: 'art_director',
    name: 'Jimi',
    role: 'Art Director',
    tarea: 'Dirige el arte con el inventario real de fotos',
    frase: 'Todo lo que diseño va en línea con los objetivos de la marca.',
  },
  analytics: {
    key: 'analytics',
    name: 'Neil',
    role: 'Performance & Data Analytics',
    tarea: 'Reporta el rendimiento de redes y YouTube',
    frase: 'Todo lo que mido va en línea con los objetivos de la marca.',
  },
  seo_geo_aeo: {
    key: 'seo_geo_aeo',
    name: 'Slash',
    role: 'SEO, GEO & AEO',
    tarea: 'Trabaja el posicionamiento con Search Console',
    frase: 'Todo lo que posiciono va en línea con los objetivos de la marca.',
  },
  filmmaker: {
    key: 'filmmaker',
    name: 'Thelma',
    role: 'Filmmaker',
    tarea: 'Monta los videos con clips y voz',
    frase: 'Todo lo que edito va en línea con los objetivos de la marca.',
  },
  research: {
    key: 'research',
    name: 'Cameron',
    role: 'Research',
    tarea: 'Busca insights de mercado en Reddit y RSS',
    frase: 'Todo lo que investigo va en línea con los objetivos de la marca.',
  },
};

// Qué agentes trabajan para cada cliente. Espeja `infra/clientes.json`, que es
// la fuente única de verdad de los SCHEDULES, más `content_strategist` (Dave),
// que está deliberadamente fuera de esa lista porque se invoca a mano desde el
// panel de staff, no por cron (ver el bloque "_nota" de ese archivo) - pero sí
// trabaja para el cliente, así que acá corresponde mostrarlo.
//
// Es un espejo estático a propósito: la API del panel de cliente
// (GET /dashboard/me) hoy solo expone `services.agents` como booleano, no el
// detalle por agente. Si mañana se agrega un cliente a clientes.json, hay que
// agregarlo acá también; un cliente sin entrada no ve esta pantalla en vez de
// mostrarle un equipo inventado.
const CLIENT_AGENT_KEYS: Record<string, AgentKey[]> = {
  'chile-fly-fishing': ['rox', 'content_strategist', 'art_director', 'analytics', 'seo_geo_aeo', 'filmmaker', 'research'],
  'alto-castillo': ['rox', 'content_strategist', 'art_director', 'analytics', 'seo_geo_aeo', 'filmmaker', 'research'],
};

export function agentsForClient(clientId: string | null): Agent[] {
  if (!clientId) return [];
  const keys = CLIENT_AGENT_KEYS[clientId];
  if (!keys) return [];
  return keys.map((k) => AGENTS[k]);
}
