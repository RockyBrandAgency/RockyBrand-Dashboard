import { describe, expect, it } from 'vitest';
import { puede, rolDesdeClaims, tieneGrupoDeCliente } from './permisos';

describe('rolDesdeClaims', () => {
  it('sin grupo de cliente es admin (migración)', () => {
    expect(rolDesdeClaims({})).toBe('admin');
    expect(rolDesdeClaims({ 'cognito:groups': ['otro-grupo'] })).toBe('admin');
  });
  it('lee el grupo y, con dos, manda el de menos permisos', () => {
    expect(rolDesdeClaims({ 'cognito:groups': ['cliente-editor'] })).toBe('editor');
    expect(rolDesdeClaims({ 'cognito:groups': ['cliente-admin', 'cliente-lectura'] })).toBe('lectura');
  });
});

describe('puede', () => {
  it('lectura no cambia nada; editor opera pero no envía; admin todo', () => {
    expect(puede('lectura', 'email.borrador')).toBe(false);
    expect(puede('editor', 'pms.operar')).toBe(true);
    expect(puede('editor', 'email.enviar')).toBe(false);
    expect(puede('editor', 'tienda.garantias.borrar')).toBe(false);
    expect(puede('editor', 'email.campanas.borrar')).toBe(false);
    expect(puede('editor', 'email.borrador')).toBe(true);
    expect(puede('admin', 'email.enviar')).toBe(true);
  });
});

// 10-nov: el servidor trata al usuario sin grupo como cliente-lectura para
// borrar una reserva; el panel no le ofrece el botón, y lo demás no cambia.
describe('borrar reserva: solo admin con grupo', () => {
  it('tieneGrupoDeCliente distingue sin grupo de con grupo', () => {
    expect(tieneGrupoDeCliente({})).toBe(false);
    expect(tieneGrupoDeCliente({ 'cognito:groups': ['otro-grupo'] })).toBe(false);
    expect(tieneGrupoDeCliente({ 'cognito:groups': ['cliente-admin'] })).toBe(true);
  });
  it('admin con grupo sí; admin sin grupo, editor y lectura no', () => {
    expect(puede('admin', 'pms.reservas.borrar', true)).toBe(true);
    expect(puede('admin', 'pms.reservas.borrar', false)).toBe(false);
    expect(puede('editor', 'pms.reservas.borrar', true)).toBe(false);
    expect(puede('lectura', 'pms.reservas.borrar', true)).toBe(false);
  });
  it('sin grupo, el resto de las acciones de admin sigue igual', () => {
    expect(puede('admin', 'email.enviar', false)).toBe(true);
    expect(puede('admin', 'tienda.garantias.borrar', false)).toBe(true);
    expect(puede('admin', 'pms.operar', false)).toBe(true);
  });
});
