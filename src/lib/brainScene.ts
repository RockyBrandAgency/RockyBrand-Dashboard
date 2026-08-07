// Motor de la pantalla del cerebro de marca (BrainIntro).
//
// Imperativo a propósito, fuera de React: dibuja ~1.500 polilíneas y varios
// miles de puntos por frame en un <canvas>, y las etiquetas de los agentes se
// posicionan en píxeles calculados por el mismo layout que el canvas. Meter eso
// en el ciclo de render de React sería un re-render por frame para nada; acá
// React solo monta el contenedor y llama a mountBrainScene() una vez.
//
// El cerebro es 100% generativo: no hay imagen ni SVG. La silueta es una unión
// de campos escalares (lóbulos + tronco) y los pliegues son streamlines de un
// campo de ruido girado hacia la tangente del contorno, así que se redibuja
// nítido a cualquier tamaño y en cualquier densidad de píxeles.

export interface BrainAgent {
  name: string;
  role: string;
  tarea: string;
  frase: string;
  /** 'in' = solo reporta hacia el núcleo (Rox, que escribe la directiva).
   *  'both' = lee y reporta (los otros 6). */
  dir: 'in' | 'both';
  emphasis?: boolean;
}

export interface BrainSceneOptions {
  /** Hex del acento de marca del cliente (ver CLIENT_ACCENT_ON_DARK). */
  accent: string;
  agents: BrainAgent[];
  logoSrc: string | null;
  logoAlt: string;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------- color ----
// Del acento del cliente se derivan los 4 roles de la escena variando SOLO la
// luminosidad, nunca el matiz: así un cliente verde salvia da una escena verde
// salvia y no un azul genérico. El piso de saturación (0.28) es una derivación
// de UI para que un acento casi gris no se apague del todo sobre negro - no se
// declara como color de marca de nadie.
function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue: number;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return [hue, s, l];
}

function hslToRgbStr(hue: number, s: number, l: number): string {
  if (s === 0) {
    const v = Math.round(l * 255);
    return `${v},${v},${v}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [conv(hue + 1 / 3), conv(hue), conv(hue - 1 / 3)]
    .map((v) => Math.round(v * 255))
    .join(',');
}

export interface BrainPalette {
  link: string; fold: string; contour: string; lit: string; synapse: string; nebula: string;
}

/** Roles de color derivados del acento del cliente, como triples "r,g,b" listos
 *  para `rgba(var(--x), a)` en CSS o para el canvas. */
export function brainPalette(accent: string): BrainPalette {
  const [h, rawS] = hexToHsl(accent);
  const s = Math.max(rawS, 0.28);
  return {
    link: hslToRgbStr(h, s, 0.39),
    fold: hslToRgbStr(h, Math.min(s, 0.78), 0.47),
    contour: hslToRgbStr(h, Math.min(s, 0.9), 0.72),
    lit: hslToRgbStr(h, s, 0.62),
    synapse: hslToRgbStr(h, s, 0.82),
    nebula: hslToRgbStr(h, Math.min(s, 0.7), 0.35),
  };
}

// ---------------------------------------------------------------- ruido ----
function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise2(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, seed: number): number {
  return (
    noise2(x, y, seed) * 0.6 +
    noise2(x * 2.13, y * 2.13, seed + 7) * 0.27 +
    noise2(x * 4.71, y * 4.71, seed + 19) * 0.13
  );
}

// ------------------------------------------ campo del cerebro (perfil izq) --
function lobe(
  x: number, y: number, cx: number, cy: number, rx: number, ry: number,
  rot: number, k1: number, k2: number, p1: number, p2: number,
): number {
  const dx = x - cx;
  const dy = y - cy;
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  const ux = (dx * ca + dy * sa) / rx;
  const uy = (-dx * sa + dy * ca) / ry;
  const r = Math.sqrt(ux * ux + uy * uy);
  if (r > 1.9) return 1 - r;
  const th = Math.atan2(uy, ux);
  return 1 + k1 * Math.sin(3 * th + p1) + k2 * Math.sin(5 * th + p2) - r;
}

function capsule(
  x: number, y: number, ax: number, ay: number, bx: number, by: number, r0: number, r1: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const px = ax + dx * t;
  const py = ay + dy * t;
  const rad = r0 + (r1 - r0) * t;
  return 1 - Math.sqrt((x - px) * (x - px) + (y - py) * (y - py)) / rad;
}

function F(x: number, y: number): number {
  let v = lobe(x, y, -0.02, -0.24, 0.98, 0.62, 0.0, 0.06, 0.045, 0.9, 2.4);
  let t = lobe(x, y, -0.6, -0.02, 0.46, 0.44, 0.0, 0.05, 0.04, 2.0, 1.0);
  if (t > v) v = t;
  t = lobe(x, y, 0.66, -0.08, 0.44, 0.42, 0.0, 0.05, 0.04, 3.1, 0.4);
  if (t > v) v = t;
  t = lobe(x, y, -0.34, 0.3, 0.46, 0.24, 0.1, 0.05, 0.03, 1.3, 2.2);
  if (t > v) v = t;
  t = lobe(x, y, 0.56, 0.48, 0.42, 0.29, -0.16, 0.07, 0.04, 1.2, 3.0);
  if (t > v) v = t;
  t = capsule(x, y, 0.14, 0.24, 0.24, 0.88, 0.19, 0.085);
  if (t > v) v = t;

  // Los surcos (cisura de Silvio, surco cerebelo/cerebro) NO son agujeros
  // restados de la máscara: restarlos dejaba ranuras de borde duro que leían
  // como cortes de bisturí. Restan PROFUNDIDAD con un piso, así que abren una
  // muesca en la superficie y hacia adentro quedan como un valle donde los
  // pliegues se comprimen solos, que es como se ve un cerebro de verdad.
  let fis = capsule(x, y, -0.8, 0.08, -0.34, 0.19, 0.075, 0.055);
  const f2 = capsule(x, y, -0.34, 0.19, 0.06, 0.28, 0.055, 0.01);
  if (f2 > fis) fis = f2;
  const gap = capsule(x, y, 0.28, 0.29, 0.58, 0.22, 0.052, 0.008);
  const cut = Math.max(fis > 0 ? 0.62 * fis : 0, gap > 0 ? 0.5 * gap : 0);
  if (cut > 0) {
    const w = v - cut;
    v = v > 0.11 && w < 0.02 ? 0.02 : w;
  }
  return v;
}

const insideF = (x: number, y: number) => F(x, y) > 0;

function fieldAngle(x: number, y: number): number {
  const e = 0.006;
  const f0 = F(x, y);
  const gx = (F(x + e, y) - F(x - e, y)) / (2 * e);
  const gy = (F(x, y + e) - F(x, y - e)) / (2 * e);
  const gl = Math.sqrt(gx * gx + gy * gy) || 1;
  const tx = -gy / gl;
  const ty = gx / gl;
  const na = fbm(x * 1.22 + 5.2, y * 1.22 + 2.7, 101) * Math.PI * 3.0;
  let w = 1 - clamp(f0 / 0.34, 0, 1);
  w = w * w * 0.95;
  return Math.atan2(Math.sin(na) * (1 - w) + ty * w, Math.cos(na) * (1 - w) + tx * w);
}

// ------------------------------------------------------------- geometría ---
// Se calcula UNA vez por carga del módulo, en unidades del cerebro (no en
// píxeles), así que un resize solo cambia la escala del dibujo - nunca hay que
// recalcular los pliegues.
interface Fold {
  pts: number[];
  br: number;
}

const STEP = 0.0095;
const CELL = 0.0188;
const MAXPTS = 230;

function buildGeometry() {
  const occ = new Map<string, number>();
  const ckey = (x: number, y: number) => `${((x + 40) / CELL) | 0},${((y + 40) / CELL) | 0}`;

  const trace = (sx: number, sy: number, dir: number, id: number): number[] => {
    const pts: number[] = [];
    let x = sx;
    let y = sy;
    for (let i = 0; i < MAXPTS; i++) {
      if (!insideF(x, y)) break;
      const k = ckey(x, y);
      const owner = occ.get(k);
      if (owner !== undefined && owner !== id) break;
      occ.set(k, id);
      pts.push(x, y);
      const a = fieldAngle(x, y);
      x += Math.cos(a) * STEP * dir;
      y += Math.sin(a) * STEP * dir;
    }
    return pts;
  };

  const folds: Fold[] = [];
  let id = 0;
  const g = 0.033;
  for (let gy = -1.0; gy <= 1.15; gy += g) {
    for (let gx = -1.1; gx <= 1.18; gx += g) {
      const jx = gx + (hash2((gx * 977) | 0, (gy * 131) | 0, 5) - 0.5) * g * 0.9;
      const jy = gy + (hash2((gx * 313) | 0, (gy * 719) | 0, 9) - 0.5) * g * 0.9;
      if (!insideF(jx, jy) || occ.has(ckey(jx, jy))) continue;
      id++;
      const fwd = trace(jx, jy, 1, id);
      const bwd = trace(jx, jy, -1, id);
      const pts: number[] = [];
      for (let i = bwd.length - 2; i >= 0; i -= 2) pts.push(bwd[i], bwd[i + 1]);
      for (let j = 2; j < fwd.length; j += 2) pts.push(fwd[j], fwd[j + 1]);
      if (pts.length >= 30) folds.push({ pts, br: 0.6 + hash2(id, id * 3, 77) * 0.55 });
    }
  }

  // Contorno por marching squares sobre el mismo campo: sale exacto, surcos
  // incluidos, sin tener que mantener a mano un path paralelo a la máscara.
  const segs: number[] = [];
  const x0 = -1.16;
  const y0 = -1.02;
  const st = 0.01;
  const nx = Math.round(2.36 / st);
  const ny = Math.round(2.2 / st);
  let prev = new Float32Array(nx + 1);
  let cur = new Float32Array(nx + 1);
  for (let i = 0; i <= nx; i++) prev[i] = F(x0 + i * st, y0);
  for (let j = 1; j <= ny; j++) {
    const yy = y0 + j * st;
    const yp = yy - st;
    for (let i = 0; i <= nx; i++) cur[i] = F(x0 + i * st, yy);
    for (let i = 0; i < nx; i++) {
      const xa = x0 + i * st;
      const xb = xa + st;
      const va = prev[i];
      const vb = prev[i + 1];
      const vc = cur[i + 1];
      const vd = cur[i];
      const cx: number[] = [];
      let t: number;
      if (va > 0 !== vb > 0) { t = va / (va - vb); cx.push(xa + st * t, yp); }
      if (vb > 0 !== vc > 0) { t = vb / (vb - vc); cx.push(xb, yp + st * t); }
      if (vd > 0 !== vc > 0) { t = vd / (vd - vc); cx.push(xa + st * t, yy); }
      if (va > 0 !== vd > 0) { t = va / (va - vd); cx.push(xa, yp + st * t); }
      if (cx.length === 4) segs.push(cx[0], cx[1], cx[2], cx[3]);
      else if (cx.length === 8) {
        segs.push(cx[0], cx[1], cx[2], cx[3]);
        segs.push(cx[4], cx[5], cx[6], cx[7]);
      }
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
  }

  const dots: { x: number; y: number; s: number; ph: number; sp: number; big: boolean }[] = [];
  for (let f = 0; f < folds.length; f++) {
    const p = folds[f].pts;
    for (let i = 0; i < p.length; i += 8) {
      const h = hash2(f * 31 + i, i * 17 + f, 3);
      dots.push({
        x: p[i], y: p[i + 1],
        s: 0.45 + h * 1.25,
        ph: h * 6.28,
        sp: 0.6 + hash2(i, f, 41) * 1.7,
        big: h > 0.976,
      });
    }
  }

  return { folds, segs, dots };
}

let GEOMETRY: ReturnType<typeof buildGeometry> | null = null;
function geometry() {
  if (!GEOMETRY) GEOMETRY = buildGeometry();
  return GEOMETRY;
}

function makeGlow(size: number, rgb: string, mid: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.22, `rgba(${rgb},${mid})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, size, size);
  return c;
}

function edgeRadius(a: number): number {
  const oy = -0.06;
  let r = 0.25;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  while (r < 1.45) {
    if (!insideF(ca * r, oy + sa * r)) break;
    r += 0.012;
  }
  return r;
}

const qbez = (p0: number, p1: number, p2: number, t: number) => {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
};

interface NodeState {
  el: HTMLButtonElement;
  agent: BrainAgent;
  x: number; y: number;
  sx: number; sy: number;
  cx: number; cy: number;
  dist: number;
  lit: number;
  litOn: boolean;
  packets: { t: number; sp: number; up: boolean }[];
}

/**
 * Monta la escena en `container` (que debe estar posicionado). Devuelve la
 * función de limpieza: cancela el rAF, desconecta el observer y saca los nodos.
 */
export function mountBrainScene(container: HTMLElement, opts: BrainSceneOptions): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pal = brainPalette(opts.accent);
  const { folds, segs, dots } = geometry();

  const GLOW_BASE = makeGlow(64, pal.lit, 0.34);
  const GLOW_SYN = makeGlow(64, pal.synapse, 0.4);

  const canvas = document.createElement('canvas');
  canvas.className = 'brain-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  let logo: HTMLImageElement | null = null;
  let logoReady = false;
  if (opts.logoSrc) {
    logo = new Image();
    logo.onload = () => { logoReady = true; };
    logo.src = opts.logoSrc;
  }

  let hovered = -1;
  const nodes: NodeState[] = [];

  // Sin tarjeta de detalle aparte: la ficha completa (rol, compromiso y
  // herramienta) vive DENTRO de la etiqueta de cada agente, pegada a él. El
  // hover solo la resalta; no revela información que estuviera escondida.
  const focusNode = (i: number) => {
    hovered = i;
    for (let k = 0; k < nodes.length; k++) nodes[k].el.classList.toggle('is-active', k === i);
  };

  opts.agents.forEach((agent, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'brain-node' + (agent.emphasis ? ' is-lead' : '');
    el.style.setProperty('--i', String(i));
    const dot = document.createElement('span');
    dot.className = 'brain-node-dot';
    const tx = document.createElement('span');
    tx.className = 'brain-node-tx';
    const nm = document.createElement('span');
    nm.className = 'brain-node-name';
    nm.textContent = agent.name;
    const rl = document.createElement('span');
    rl.className = 'brain-node-role';
    rl.textContent = agent.role;
    const fr = document.createElement('span');
    fr.className = 'brain-node-frase';
    fr.textContent = agent.frase;
    const tk = document.createElement('span');
    tk.className = 'brain-node-toolkit';
    tk.textContent = agent.tarea;
    tx.append(nm, rl, fr, tk);
    el.append(dot, tx);
    el.setAttribute('aria-label', `${agent.name}, ${agent.role}. ${agent.frase} ${agent.tarea}`);
    el.addEventListener('mouseenter', () => focusNode(i));
    el.addEventListener('mouseleave', () => focusNode(-1));
    el.addEventListener('focus', () => focusNode(i));
    el.addEventListener('blur', () => focusNode(-1));
    container.appendChild(el);
    nodes.push({
      el, agent, x: 0, y: 0, sx: 0, sy: 0, cx: 0, cy: 0, dist: 0, lit: 0, litOn: false,
      packets: [],
    });
  });

  let W = 0, H = 0, DPR = 1, S = 1, bcx = 0, bcy = 0, ringCy = 0;
  let listMode = false;
  let nebula: HTMLCanvasElement | null = null;

  function buildNebula(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.max(1, W);
    c.height = Math.max(1, H);
    const x = c.getContext('2d')!;
    for (let i = 0; i < 12; i++) {
      const px = hash2(i * 13, 7, 71) * W;
      const py = hash2(i * 29, 3, 83) * H;
      const pr = (0.16 + hash2(i, 11, 97) * 0.34) * Math.max(W, H);
      const al = 0.028 + hash2(i, 5, 61) * 0.042;
      const gr = x.createRadialGradient(px, py, 0, px, py, pr);
      gr.addColorStop(0, `rgba(${pal.nebula},${al.toFixed(3)})`);
      gr.addColorStop(1, `rgba(${pal.nebula},0)`);
      x.fillStyle = gr;
      x.fillRect(0, 0, W, H);
    }
    for (let i = 0; i < 240; i++) {
      x.fillStyle = `rgba(210,232,255,${(0.06 + hash2(i, 41, 149) * 0.3).toFixed(3)})`;
      x.fillRect(hash2(i * 7, 19, 131) * W, hash2(i * 23, 31, 137) * H, 1, 1);
    }
    for (let i = 0; i < 2; i++) {
      const ry = bcy + (i === 0 ? -S * 0.46 : S * 0.34);
      const fx0 = bcx - S * 3.1;
      const fx1 = bcx + S * 3.1;
      const gr = x.createLinearGradient(fx0, ry, fx1, ry);
      gr.addColorStop(0, `rgba(${pal.lit},0)`);
      gr.addColorStop(0.5, `rgba(${pal.lit},0.07)`);
      gr.addColorStop(1, `rgba(${pal.lit},0)`);
      x.fillStyle = gr;
      x.fillRect(fx0, ry - 1, fx1 - fx0, 2);
    }
    return c;
  }

  function setLink(nd: NodeState, a: number, index: number) {
    const er = edgeRadius(a) * 1.02;
    nd.sx = bcx + Math.cos(a) * er * S;
    nd.sy = bcy + (-0.06 + Math.sin(a) * er) * S;
    const mx = (nd.sx + nd.x) / 2;
    const my = (nd.sy + nd.y) / 2;
    const dx = nd.x - nd.sx;
    const dy = nd.y - nd.sy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const bend = (index % 2 === 0 ? 1 : -1) * len * 0.16;
    nd.cx = mx + (-dy / len) * bend;
    nd.cy = my + (dx / len) * bend;
    nd.dist = Math.sqrt((nd.x - bcx) ** 2 + (nd.y - ringCy) ** 2);
    if (!nd.packets.length) {
      const count = nd.agent.emphasis ? 3 : 2;
      for (let p = 0; p < count; p++) {
        nd.packets.push({
          t: hash2(index * 41 + p, p * 13, 211),
          sp: 0.16 + hash2(index, p, 17) * 0.16,
          // Rox solo escribe hacia el núcleo: es quien emite la directiva que
          // los otros leen, no un agente que recibe instrucciones.
          up: nd.agent.dir === 'in' ? true : p % 2 === 0,
        });
      }
    }
  }

  function layout() {
    const rect = container.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    // La altura del VIEWPORT, no la del contenedor. En modo lista el contenedor
    // crece para que quepan las fichas, y si el layout se calculara con esa
    // altura crecida el ResizeObserver volveria a dispararse con un valor mayor
    // cada vez: la pantalla se inflaba sola (bug real, 900px -> 2210px en dos
    // pasadas). Con el viewport como entrada, layout() es idempotente.
    const viewH = Math.max(1, Math.round(container.parentElement?.clientHeight || window.innerHeight));
    H = viewH;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    let chipW = 0;
    let chipH = 34;
    for (const nd of nodes) {
      chipW = Math.max(chipW, nd.el.offsetWidth);
      chipH = Math.max(chipH, nd.el.offsetHeight);
    }

    const padX = chipW + 18 + 14;
    const padY = chipH + 18 + 12;
    let ringRx = W / 2 - padX;
    let ringRy = H / 2 - padY;
    listMode = ringRx < chipW * 0.9 || ringRx < 150;

    if (!listMode) {
      container.style.removeProperty('height');
      // El cerebro es el protagonista: se dimensiona por el hueco que de verdad
      // queda entre él y el anillo, no por una fracción arbitraria del viewport.
      // Sus semiejes reales son ~1.10*S de ancho y ~0.95*S de alto (ver F()),
      // así que se despeja S de "borde del cerebro + aire <= radio del anillo".
      const GAP_X = 74;
      const GAP_Y = 44;
      S = Math.min((ringRx - GAP_X) / 1.1, (ringRy - GAP_Y) / 0.95, W * 0.34, H * 0.44);
      // El anillo se abre hasta donde de verdad alcanza el ancho de pantalla:
      // antes se recortaba a S*1.8 y dejaba franjas muertas a los costados.
      ringRx = Math.min(ringRx, S * 2.4);
      ringRy = Math.min(ringRy, S * 1.7);
      bcx = W / 2;
      ringCy = H / 2;
      bcy = ringCy - 0.07 * S;
      nodes.forEach((nd, i) => {
        const a = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2 + 0.17;
        nd.x = bcx + ringRx * Math.cos(a);
        nd.y = ringCy + ringRy * Math.sin(a);
        const ox = Math.cos(a);
        const oy = Math.sin(a);
        const tx = ox > 0.3 ? '0%' : ox < -0.3 ? '-100%' : '-50%';
        const ty = ox > 0.3 || ox < -0.3 ? '-50%' : oy > 0 ? '0%' : '-100%';
        nd.el.style.left = `${nd.x + ox * 17}px`;
        nd.el.style.top = `${nd.y + oy * 17}px`;
        nd.el.style.transform = `translate(${tx}, ${ty})`;
        setLink(nd, a, i);
      });
    } else {
      // Pantalla angosta: el anillo no cabe con etiquetas de 2 líneas, así que
      // pasa a cerebro arriba + equipo en dos columnas abajo. Las conexiones se
      // siguen dibujando, solo cambia a dónde llegan.
      const zone = viewH * 0.44;
      S = Math.min(W * 0.3, zone * 0.42);
      bcx = W / 2;
      bcy = zone * 0.52;
      ringCy = bcy;
      // Dos columnas solo si las etiquetas MÁS ANCHAS caben de verdad. El rol
      // más largo del equipo real ("Performance & Data Analytics", de Neil) da
      // un chip de ~223px: en un teléfono de 414px, dos columnas dejaban ese
      // chip 4px fuera de la pantalla. Medido, no estimado - se usa el ancho
      // real ya renderizado, así que sigue siendo correcto si mañana entra un
      // rol más largo todavía.
      const cols = chipW * 2 + 28 <= W ? 2 : 1;
      const rows = Math.ceil(nodes.length / cols);
      const top = zone + 26;
      // Con la ficha completa, 7 agentes en una columna no entran en un
      // viewport de teléfono. En vez de apretarlos hasta que se pisen, el
      // contenedor crece a la altura que de verdad necesitan y la pantalla
      // scrollea (.brain-screen tiene overflow-y:auto). 64px abajo para que la
      // última ficha no quede debajo del botón Entrar, que es fixed.
      const needed = Math.round(top + rows * (chipH + 22) + 64);
      if (needed > viewH) {
        H = needed;
        container.style.height = `${H}px`;
        canvas.height = Math.round(H * DPR);
      } else {
        container.style.removeProperty('height');
      }
      const rowH = (H - top - 64) / rows;
      const half = chipW / 2 + 10;
      const colX = cols === 1
        ? [W / 2]
        : [Math.max(half, W * 0.26), Math.min(W - half, W * 0.74)];
      nodes.forEach((nd, i) => {
        const col = i % cols;
        const row = (i / cols) | 0;
        nd.x = colX[col];
        nd.y = top + row * rowH + rowH * 0.5;
        nd.el.style.left = `${nd.x}px`;
        nd.el.style.top = `${nd.y}px`;
        nd.el.style.transform = 'translate(-50%, -50%)';
        setLink(nd, Math.atan2(nd.y - bcy, nd.x - bcx), i);
      });
    }

    nebula = buildNebula();
  }

  const ease = (v: number) => 1 - (1 - clamp(v, 0, 1)) ** 3;

  const pulses = Array.from({ length: 26 }, (_, i) => ({
    f: (i * 7919) % Math.max(folds.length, 1),
    t: i / 26,
    sp: 0.13 + (i % 5) * 0.045,
  }));

  const t0 = performance.now();
  let introT0 = 0;
  let lastSync = -3000;
  let syncR = -1;
  let raf = 0;

  function draw(now: number) {
    const t = (now - t0) / 1000;
    if (!introT0) introT0 = now;
    const intro = reduced ? 1 : clamp((now - introT0) / 1500, 0, 1);
    const brainIn = ease(intro * 1.9);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    if (nebula) ctx.drawImage(nebula, 0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    const Sb = S * (1 + Math.sin(t * 0.62) * 0.011);
    const TX = (x: number) => bcx + x * Sb;
    const TY = (y: number) => bcy + y * Sb;

    if (!reduced) {
      if (intro >= 1 && now - lastSync > 9000) { lastSync = now; syncR = 0; }
      if (syncR >= 0) {
        syncR += 3.4;
        const maxR = Math.max(W, H) * 0.78;
        if (syncR > maxR) syncR = -1;
        else {
          const fade = 1 - syncR / maxR;
          ctx.strokeStyle = `rgba(${pal.synapse},${(0.26 * fade * fade).toFixed(3)})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(bcx, ringCy, syncR, syncR * 0.8, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      const nodeIn = reduced ? 1 : ease((intro - (0.34 + i * 0.045)) / 0.3);
      if (nodeIn <= 0) continue;
      const dim = hovered >= 0 && hovered !== i;
      let base = (nd.agent.emphasis ? 0.32 : 0.22) * nodeIn;
      if (hovered === i) base = 0.55 * nodeIn;
      else if (dim) base *= 0.3;

      ctx.strokeStyle = `rgba(${pal.link},${base.toFixed(3)})`;
      ctx.lineWidth = hovered === i || nd.agent.emphasis ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(nd.sx, nd.sy);
      ctx.quadraticCurveTo(nd.cx, nd.cy, nd.x, nd.y);
      ctx.stroke();

      for (const pk of nd.packets) {
        if (!reduced) { pk.t += pk.sp * 0.0125; if (pk.t > 1) pk.t -= 1; }
        const tt = pk.up ? 1 - pk.t : pk.t;
        const px = qbez(nd.sx, nd.cx, nd.x, tt);
        const py = qbez(nd.sy, nd.cy, nd.y, tt);
        const alpha = 0.85 * (dim ? 0.3 : 1) * (hovered === i ? 1.25 : 1) * nodeIn;
        const sz = pk.up ? 11 : 15;
        ctx.globalAlpha = Math.min(alpha, 1);
        ctx.drawImage(pk.up ? GLOW_BASE : GLOW_SYN, px - sz / 2, py - sz / 2, sz, sz);
        ctx.globalAlpha = 1;
      }

      if (syncR >= 0 && Math.abs(syncR - nd.dist) < 26 && !nd.litOn) {
        nd.litOn = true;
        nd.el.classList.add('is-lit');
        nd.lit = now;
      }
      if (nd.litOn && now - nd.lit > 700) { nd.litOn = false; nd.el.classList.remove('is-lit'); }
      const litF = nd.litOn ? 1 - (now - nd.lit) / 700 : 0;

      const nsz = 16 + litF * 26 + (hovered === i ? 10 : 0) + (nd.agent.emphasis ? 6 : 0);
      ctx.globalAlpha = 0.75 * nodeIn;
      ctx.drawImage(GLOW_SYN, nd.x - nsz / 2, nd.y - nsz / 2, nsz, nsz);
      ctx.globalAlpha = nodeIn;
      ctx.fillStyle = `rgba(${pal.synapse},0.95)`;
      ctx.beginPath();
      ctx.arc(nd.x, nd.y, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    const gd = (hovered >= 0 ? 0.72 : 1) * brainIn;
    const heart = 0.5 + 0.5 * Math.sin(t * 1.05);

    const coreR = Sb * (1.28 + heart * 0.06);
    const cg = ctx.createRadialGradient(bcx, bcy - Sb * 0.1, 0, bcx, bcy - Sb * 0.1, coreR);
    cg.addColorStop(0, `rgba(${pal.link},${((0.27 + heart * 0.09) * brainIn).toFixed(3)})`);
    cg.addColorStop(0.42, `rgba(${pal.link},0.09)`);
    cg.addColorStop(1, `rgba(${pal.link},0)`);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(bcx, bcy - Sb * 0.1, coreR, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 1;
    for (const f of folds) {
      ctx.strokeStyle = `rgba(${pal.fold},${(0.42 * f.br * gd).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(TX(f.pts[0]), TY(f.pts[1]));
      for (let k = 2; k < f.pts.length; k += 2) ctx.lineTo(TX(f.pts[k]), TY(f.pts[k + 1]));
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(${pal.contour},${(0.3 * gd).toFixed(3)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let s = 0; s < segs.length; s += 4) {
      ctx.moveTo(TX(segs[s]), TY(segs[s + 1]));
      ctx.lineTo(TX(segs[s + 2]), TY(segs[s + 3]));
    }
    ctx.stroke();

    for (const d of dots) {
      const fl = reduced ? 0.7 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * d.sp + d.ph));
      const X = TX(d.x);
      const Y = TY(d.y);
      if (d.big) {
        ctx.globalAlpha = 0.55 * fl * gd;
        ctx.drawImage(GLOW_SYN, X - 9, Y - 9, 18, 18);
      }
      ctx.globalAlpha = (0.28 + 0.52 * fl) * gd;
      ctx.fillStyle = `rgba(${d.big ? pal.synapse : pal.lit},1)`;
      ctx.beginPath();
      ctx.arc(X, Y, d.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const pu of pulses) {
      const f = folds[pu.f % folds.length];
      if (!f) continue;
      const count = f.pts.length / 2;
      if (!reduced) {
        pu.t += pu.sp * 0.011;
        if (pu.t > 1) { pu.t = 0; pu.f = (pu.f * 7 + 13) % folds.length; }
      }
      const head = Math.floor(pu.t * (count - 1));
      for (let q = 0; q < 12; q++) {
        const idx = head - q;
        if (idx < 0) break;
        const a2 = (1 - q / 12) * 0.85 * gd;
        const PX = TX(f.pts[idx * 2]);
        const PY = TY(f.pts[idx * 2 + 1]);
        ctx.globalAlpha = a2 * 0.55;
        ctx.drawImage(GLOW_SYN, PX - 7, PY - 7, 14, 14);
        ctx.globalAlpha = a2;
        ctx.fillStyle = `rgba(${pal.synapse},1)`;
        ctx.beginPath();
        ctx.arc(PX, PY, q === 0 ? 1.7 : 1.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // El logo no se dibuja ENCIMA del cerebro: primero se borra un claro con
    // destination-out, así queda alojado adentro y los pliegues salen radiando
    // desde él en vez de pasarle por debajo como una calcomanía.
    if (logo && logoReady && intro > 0.15) {
      const lIn = ease((intro - 0.15) / 0.45);
      const lr = S * 0.44;
      const lx = bcx;
      const ly = ringCy - S * 0.06;

      ctx.globalCompositeOperation = 'destination-out';
      const clr = lr * 1.62;
      const cl = ctx.createRadialGradient(lx, ly, 0, lx, ly, clr);
      cl.addColorStop(0, 'rgba(0,0,0,1)');
      cl.addColorStop(0.6, 'rgba(0,0,0,0.97)');
      cl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cl;
      ctx.beginPath();
      ctx.arc(lx, ly, clr, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      const hg = ctx.createRadialGradient(lx, ly, lr * 0.85, lx, ly, lr * 1.75);
      hg.addColorStop(0, `rgba(${pal.link},${(0.26 * lIn).toFixed(3)})`);
      hg.addColorStop(0.35, `rgba(${pal.lit},${(0.12 * lIn * (0.6 + heart * 0.4)).toFixed(3)})`);
      hg.addColorStop(1, `rgba(${pal.link},0)`);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(lx, ly, lr * 1.75, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(${pal.contour},${(0.34 * lIn).toFixed(3)})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(lx, ly, lr * 1.1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = lIn;
      ctx.drawImage(logo, lx - lr, ly - lr, lr * 2, lr * 2);
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = 'source-over';
    if (!reduced) raf = requestAnimationFrame(draw);
  }

  let resizeTimer: number | undefined;
  const observer = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      layout();
      if (reduced) draw(performance.now() + 2400);
    }, 120);
  });
  observer.observe(container);

  layout();
  if (reduced) draw(performance.now() + 2400);
  else raf = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(resizeTimer);
    observer.disconnect();
    canvas.remove();
    for (const nd of nodes) nd.el.remove();
  };
}
