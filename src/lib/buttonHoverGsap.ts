import { gsap } from 'gsap';

// Hover con GSAP para TODOS los botones del panel (pedido explícito de
// Mato, 2026-08-04: "falta agregar interacciones, como hover a los
// botones... utilicemos GSAP"). En vez de cablear un hover a mano en
// cada uno de los ~60 <button> del codebase (la mayoría con
// style={{all:'unset'}}, así que un :hover de CSS no alcanza sin tocar
// cada archivo), se usa delegación de eventos a nivel de documento: un
// solo listener detecta CUALQUIER <button> real (nativo, no un div que
// actúa como botón) y le anima un lift sutil (scale + brightness). Nuevo
// botón en cualquier pantalla futura → hover gratis, sin tocar este
// archivo ni el componente nuevo.
//
// mouseover/mouseout (no mouseenter/mouseleave) a propósito: son los que
// burbujean, así que un solo listener en document los recibe para
// cualquier botón sin importar cuán anidado esté. relatedTarget +
// .contains() evita togglear la animación en cada pixel de movimiento
// dentro del mismo botón (mouseover/mouseout SÍ disparan al pasar entre
// hijos).
//
// Solo se activa en dispositivos con hover real (mouse/trackpad) - un
// tap en celular no debe simular un hover fantasma.

let current: HTMLElement | null = null;
let initialized = false;

function animateIn(el: HTMLElement) {
  gsap.to(el, { scale: 1.025, filter: 'brightness(1.04)', duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
}

function animateOut(el: HTMLElement) {
  gsap.to(el, { scale: 1, filter: 'brightness(1)', duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
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
  document.addEventListener('mouseover', handleOver);
  document.addEventListener('mouseout', handleOut);
  return () => {
    document.removeEventListener('mouseover', handleOver);
    document.removeEventListener('mouseout', handleOut);
    initialized = false;
  };
}
