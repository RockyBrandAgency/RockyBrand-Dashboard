import { gsap } from 'gsap';

// Hover con GSAP para TODOS los botones del panel (pedido explícito de
// Mato, 2026-08-04: "falta agregar interacciones, como hover a los
// botones... utilicemos GSAP"). En vez de cablear un hover a mano en
// cada uno de los ~60 <button> del codebase (la mayoría con
// style={{all:'unset'}}, así que un :hover de CSS no alcanza sin tocar
// cada archivo), se usa delegación de eventos a nivel de documento: un
// solo listener detecta CUALQUIER <button> real (nativo, no un div que
// actúa como botón) y le anima el hover. Nuevo botón en cualquier
// pantalla futura → hover gratis, sin tocar este archivo ni el
// componente nuevo.
//
// CORREGIDO el mismo día (2026-08-04): la primera versión animaba
// scale+brightness, inventado sin haber revisado antes el spec real de
// Figma ("44 — Spec: GSAP Transiciones", ítem "03. Micro-interacción:
// Hover en Tarjetas"): Duration 0.2s, Y-Offset -2px, "desplazamiento
// sutil hacia arriba e incremento progresivo de la sombra de apoyo para
// crear sensación de profundidad" - exactamente lo que ya definían
// --shadow-card/--shadow-card-hover en index.css (extraídos del spec de
// estados de tarjetas, frame 36), sin conectarlos nunca a un hover real
// hasta ahora.
//
// mouseover/mouseout (no mouseenter/mouseleave) a propósito: son los que
// burbujean, así que un solo listener en document los recibe para
// cualquier botón sin importar cuán anidado esté. relatedTarget +
// .contains() evita togglear la animación en cada pixel de movimiento
// dentro del mismo botón (mouseover/mouseout SÍ disparan al pasar entre
// hijos).
//
// Solo se activa en dispositivos con hover real (mouse/trackpad) - un
// tap en celular no debe simular un hover fantasma. Respeta
// prefers-reduced-motion (spec 43/44: "todas las clases animadas por
// GSAP se anulan de manera estricta") - faltaba en la primera versión.

let current: HTMLElement | null = null;
let initialized = false;

// GSAP interpola box-shadow numéricamente, pero no puede resolver un
// var(--x) sin valor al que compararlo - hay que darle los 2 valores
// literales ya resueltos. Se leen del DOM (no se copian a mano) para que
// nunca queden desincronizados de --shadow-card/--shadow-card-hover en
// index.css si esos tokens cambian.
let shadowRest = '0 2px 2px rgba(0,0,0,0.03)';
let shadowHover = '0 8px 8px rgba(0,0,0,0.07)';

function resolveShadowTokens() {
  const styles = getComputedStyle(document.documentElement);
  shadowRest = styles.getPropertyValue('--shadow-card').trim() || shadowRest;
  shadowHover = styles.getPropertyValue('--shadow-card-hover').trim() || shadowHover;
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animateIn(el: HTMLElement) {
  if (reducedMotion()) return;
  gsap.to(el, { y: -2, boxShadow: shadowHover, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
}

function animateOut(el: HTMLElement) {
  const duration = reducedMotion() ? 0 : 0.2;
  gsap.to(el, { y: 0, boxShadow: shadowRest, duration, ease: 'power2.out', overwrite: 'auto' });
}

function closestButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest('button:not(:disabled)');
}

function handleOver(e: MouseEvent) {
  const btn = closestButton(e.target);
  if (!btn || btn === current) return;
  if (current) animateOut(current);
  current = btn;
  animateIn(btn);
}

function handleOut(e: MouseEvent) {
  const btn = closestButton(e.target);
  if (!btn || btn !== current) return;
  const related = e.relatedTarget;
  if (related instanceof Node && btn.contains(related)) return;
  animateOut(btn);
  current = null;
}

export function initButtonHoverGsap(): () => void {
  if (initialized || typeof window === 'undefined') return () => {};
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  initialized = true;
  resolveShadowTokens();
  document.addEventListener('mouseover', handleOver);
  document.addEventListener('mouseout', handleOut);
  return () => {
    document.removeEventListener('mouseover', handleOver);
    document.removeEventListener('mouseout', handleOut);
    initialized = false;
  };
}
