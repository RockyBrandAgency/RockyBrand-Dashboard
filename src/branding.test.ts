import { describe, expect, it } from 'vitest';
import { clientIdFromHostname, CLIENT_BRANDING, CLIENT_THEME, applyClientTheme, applyClientTitle } from './branding';

/**
 * El panel de un cliente no se abre con la cuenta de otro.
 *
 * Estas son las primeras pruebas de este repositorio, y existen por un caso
 * real (2026-09-08): entrar a karibu-safari-africa.panel.rockybrand.cl con la
 * cuenta de Alto Castillo abría el panel de Alto Castillo entero —su marca,
 * sus métricas, sus campañas— bajo la URL de Karibu. Ningún dato se filtró: el
 * tenant salía del claim del JWT, como siempre. Lo que estaba mal es que la
 * pantalla afirmaba algo falso.
 *
 * El backend también lo rechaza ahora (tenant.client_id_de_origen +
 * crm_dashboard_api_lambda), y ESA es la comprobación que no se puede borrar
 * con un despliegue del frontend. Estas pruebas cubren la de acá, que es la
 * que le explica a la persona qué pasó y a qué subdominio ir.
 */
describe('clientIdFromHostname', () => {
  it('reconoce el subdominio de un cliente', () => {
    expect(clientIdFromHostname('karibu-safari-africa.panel.rockybrand.cl')).toBe('karibu-safari-africa');
    expect(clientIdFromHostname('alto-castillo.panel.rockybrand.cl')).toBe('alto-castillo');
  });

  it('devuelve null donde no hay cliente que deducir', () => {
    // null significa «este host no nombra a nadie» y no bloquea nada: es el
    // caso de desarrollo y el de la URL por defecto de Amplify. Si esto
    // devolviera algo, el panel se cerraría solo en local.
    for (const host of ['localhost', '127.0.0.1', 'main.d3j6ejr1sqe253.amplifyapp.com', 'panel.rockybrand.cl']) {
      expect(clientIdFromHostname(host), host).toBeNull();
    }
  });

  it('no se deja engañar por un dominio que sólo se parece', () => {
    // Si esto devolviera 'x', un sitio ajeno podría elegir contra qué cliente
    // se compara y la comprobación quedaría a merced de quien la ataca.
    for (const host of ['x.panel.rockybrand.cl.evil.com', 'evilpanel.rockybrand.cl', 'a.b.c.panel.rockybrand.cl.otro.com']) {
      expect(clientIdFromHostname(host), host).toBeNull();
    }
  });
});

/**
 * La segunda familia de fallas de la misma clase: que la pantalla se quede
 * «pegada» con el dato de un cliente anterior. Ya pasó una vez de verdad —el
 * título de la pestaña decía «Alto Castillo Lodge» para cualquier cliente— y
 * el arreglo fue volver siempre a un neutro, nunca a un cliente concreto.
 */
describe('el panel no se queda pegado con la marca de otro', () => {
  it('sin cliente, el tema vuelve al neutro y no al del último', () => {
    applyClientTheme('alto-castillo');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(CLIENT_THEME['alto-castillo'].primary);

    applyClientTheme(null);
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
  });

  it('sin cliente, el título vuelve al neutro y no al del último', () => {
    applyClientTitle('karibu-safari-africa');
    expect(document.title).toBe('Karibu Safari Africa — Panel');

    applyClientTitle(null);
    expect(document.title).toBe('RockyBrand — Panel');
    expect(document.title).not.toContain('Karibu');
  });

  it('un cliente desconocido no hereda la marca del anterior', () => {
    applyClientTheme('chile-fly-fishing');
    applyClientTitle('chile-fly-fishing');

    applyClientTheme('cliente-que-no-existe');
    applyClientTitle('cliente-que-no-existe');

    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
    expect(document.title).toBe('RockyBrand — Panel');
  });
});

/**
 * Cada cliente con marca declarada tiene que tenerla COMPLETA. Una entrada a
 * medias no falla al compilar: se ve como un logo roto o un color que no es
 * suyo, y sólo se descubre mirando la pantalla del cliente.
 */
describe('la marca declarada de cada cliente está completa', () => {
  it('todo logo tiene sus dos variantes y su texto alternativo', () => {
    for (const [clientId, marca] of Object.entries(CLIENT_BRANDING)) {
      expect(marca.logoSrcDark, clientId).toMatch(/^\//);
      expect(marca.logoSrcLight, clientId).toMatch(/^\//);
      expect(marca.logoAlt.trim().length, clientId).toBeGreaterThan(0);
    }
  });

  it('todo tema declara sus cuatro colores como hex', () => {
    for (const [clientId, tema] of Object.entries(CLIENT_THEME)) {
      for (const [clave, valor] of Object.entries(tema)) {
        expect(valor, `${clientId}.${clave}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
