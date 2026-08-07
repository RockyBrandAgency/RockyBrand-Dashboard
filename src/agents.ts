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
  /** Su herramienta real: con qué trabaja. Se muestra pegado al agente.
   *  En inglés, igual que el rol y la frase de alineación. */
  tarea: string;
}

// Rox va primero a propósito: es el único que no produce táctica. Emite la
// directiva estratégica que los otros 6 consumen como contexto obligatorio
// (ver agent_core.mandato_de_rox), y por eso en la pantalla se dibuja pegado
// al núcleo y no en el anillo.
// La MISMA frase para los 7, sin excepciones (decisión de Mato, 2026-08-07:
// "esto aplica para todos"). Va como constante única y no como campo por
// agente justamente para que no pueda divergir: si algún día hay que
// matizarla, se cambia en un solo lugar.
//
// EN INGLÉS, igual que los roles (decisión de Mato, 2026-08-07). Ojo: hoy es
// inglés para TODOS los clientes, no según el idioma de cada uno - el panel no
// expone `content_language` en GET /dashboard/me, así que no hay de dónde
// leerlo sin agregar el campo al backend.
//
// Es cierta a nivel de sistema, no es copy de relleno: agent_core.mandato_de_rox
// le inyecta la directiva estratégica vigente a los agentes como contexto
// obligatorio ("Estas directivas son obligatorias. Si tu output las contradice,
// corrigelo."), y todos leen además la misma base de conocimiento de marca del
// cliente.
export const FRASE_ALINEACION = "In line with the brand's objectives and guidelines.";

export const AGENTS: Record<AgentKey, Agent> = {
  rox: {
    key: 'rox',
    name: 'Rox',
    role: 'Chief Marketing Officer',
    tarea: "Sets the brand's direction and the mandate the others follow",
  },
  content_strategist: {
    key: 'content_strategist',
    name: 'Dave',
    role: 'Content & Social Strategist',
    tarea: 'Builds the content calendar',
  },
  art_director: {
    key: 'art_director',
    name: 'Jimi',
    role: 'Art Director',
    tarea: 'Directs the art from the real photo inventory',
  },
  analytics: {
    key: 'analytics',
    name: 'Neil',
    role: 'Performance & Data Analytics',
    tarea: 'Reports social and YouTube performance',
  },
  seo_geo_aeo: {
    key: 'seo_geo_aeo',
    name: 'Slash',
    role: 'SEO, GEO & AEO',
    tarea: 'Works search rankings with Search Console',
  },
  filmmaker: {
    key: 'filmmaker',
    name: 'Thelma',
    role: 'Filmmaker',
    tarea: 'Edits the videos from clips and voice',
  },
  research: {
    key: 'research',
    name: 'Cameron',
    role: 'Research',
    tarea: 'Finds market insights on Reddit and RSS',
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
