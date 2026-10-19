import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { BadgePrograma, BanderaPescador, MercadoConBandera, PaisConBandera, PaisPescador } from './BadgePrograma';

let container: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
function render(el: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(el));
}

describe('BadgePrograma', () => {
  it('Full Day y All Inclusive con clase propia y el nombre dentro', () => {
    render(<><BadgePrograma codigo="FULL_DAY" /><BadgePrograma codigo="ALL_INCLUSIVE" /></>);
    expect(container.querySelector('.badge-programa--fd')?.textContent).toBe('Full Day');
    expect(container.querySelector('.badge-programa--ai')?.textContent).toBe('All Inclusive');
  });

  it('otro RoomID (Alto Castillo) queda como texto, sin badge', () => {
    render(<BadgePrograma codigo="Suite 1" />);
    expect(container.innerHTML).toBe('Suite 1');
  });
});

describe('banderas en pantalla', () => {
  it('país visible y emoji oculto a lectores de pantalla', () => {
    render(<PaisConBandera pais="Brazil" />);
    expect(container.textContent).toBe('🇧🇷Brazil');
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('🇧🇷');
  });

  it('sin país: raya, sin bandera', () => {
    render(<PaisConBandera pais={null} />);
    expect(container.innerHTML).toBe('—');
  });

  it('país desconocido: solo el nombre', () => {
    render(<PaisConBandera pais="Atlantis" />);
    expect(container.textContent).toBe('Atlantis');
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('junto al pescador: el país va como texto para lectores y en title', () => {
    render(<BanderaPescador pais="United States" />);
    const b = container.querySelector('.bandera--pescador')!;
    expect(b.getAttribute('title')).toBe('United States');
    expect(b.querySelector('[aria-hidden="true"]')?.textContent).toBe('🇺🇸');
    expect(b.querySelector('.solo-lector')?.textContent).toBe('(United States)');
  });

  it('junto al pescador sin país: nada', () => {
    render(<BanderaPescador pais="" />);
    expect(container.innerHTML).toBe('');
  });

  // Decisión del jefe (spec-ventas-mix.md, 17-oct): en las listas va la bandera
  // más el nombre del país visible; solo el calendario queda con la bandera sola.
  it('en las listas: bandera oculta a lectores, nombre visible y completo en title', () => {
    render(<PaisPescador pais="United States" />);
    const p = container.querySelector('.pais-pescador')!;
    expect(p.textContent).toBe('🇺🇸United States');
    expect(p.getAttribute('title')).toBe('United States');
    expect(p.querySelector('[aria-hidden="true"]')?.textContent).toBe('🇺🇸');
    expect(p.querySelector('.pais-pescador__nombre')?.textContent).toBe('United States');
  });

  it('en las listas, país desconocido: solo el nombre, sin bandera', () => {
    render(<PaisPescador pais="Atlantis" />);
    expect(container.textContent).toBe('Atlantis');
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('en las listas, sin país: nada', () => {
    render(<PaisPescador pais={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('mercado con su bandera', () => {
    render(<MercadoConBandera mercado="CL" etiqueta="Chile" />);
    expect(container.textContent).toBe('🇨🇱Chile');
  });
});
