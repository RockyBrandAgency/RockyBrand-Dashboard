import { describe, expect, it } from 'vitest';
import { puede, rolDesdeClaims } from './permisos';

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
