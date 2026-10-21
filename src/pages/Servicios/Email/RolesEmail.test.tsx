import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { puede, type Rol } from '../../../lib/permisos';

vi.mock('../../../config', () => ({
  DASHBOARD_API_URL: 'https://api.test',
  COGNITO_IDP_URL: 'https://idp.test/',
  COGNITO_CLIENT_ID: 'cliente-test',
  COGNITO_REGION: 'us-east-2',
  COGNITO_USER_POOL_ID: 'pool-test',
}));

// El rol de la prueba lo fija cada caso; usePermiso usa la misma tabla real.
// handleUnauthorized estable: los efectos lo tienen de dependencia.
const sesion = vi.hoisted(() => ({ rol: 'lectura' as Rol, handleUnauthorized: () => {} }));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    handleUnauthorized: sesion.handleUnauthorized, clientDisplayName: 'Cliente Test', clientEmailFrom: 'hola@cliente.test',
    userEmail: 'editor@cliente.test', rol: sesion.rol,
  }),
  usePermiso: (a: Parameters<typeof puede>[1]) => puede(sesion.rol, a),
}));

const api = vi.hoisted(() => ({ sendTestEmail: vi.fn() }));
vi.mock('../../../api/dashboardApi', async (original) => ({
  ...(await original<typeof import('../../../api/dashboardApi')>()),
  getEmailCampaigns: async () => ({
    campanas: [{ campaign_id: 'c-1', name: 'Borrador QA', subject: 'Hola', html_body: '<p>x</p>', template_id: '', status: 'draft', created_at: '2026-10-20T00:00:00Z', updated_at: '2026-10-20T00:00:00Z' }],
  }),
  getEmailContacts: async () => ({ contacts: [] }),
  getEmailTemplates: async () => ({ templates: [] }),
  sendTestEmail: (...a: unknown[]) => api.sendTestEmail(...a),
}));

import { CampanasEmail } from './Campanas';
import { NuevaCampana } from './NuevaCampana';

let root: Root | null = null;
let contenedor: HTMLDivElement | null = null;

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  contenedor?.remove();
  api.sendTestEmail.mockReset();
});

async function montar(ui: React.ReactElement) {
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  await act(async () => { root!.render(ui); });
  await act(async () => {}); // deja resolver las promesas de carga
}
const botones = (texto: string) => [...contenedor!.querySelectorAll('button')].filter((b) => b.textContent?.trim() === texto);

describe('Campañas por rol', () => {
  it('lectura: el borrador se lista pero sin «Eliminar»', async () => {
    sesion.rol = 'lectura';
    await montar(<CampanasEmail onVerDetalle={() => {}} />);
    expect(contenedor!.textContent).toContain('Borrador QA');
    expect(botones('Eliminar')).toHaveLength(0);
  });

  it('admin: el mismo borrador sí muestra «Eliminar» (control)', async () => {
    sesion.rol = 'admin';
    await montar(<CampanasEmail onVerDetalle={() => {}} />);
    expect(botones('Eliminar').length).toBeGreaterThan(0);
  });
});

describe('Envío de prueba por rol', () => {
  const campo = () => contenedor!.querySelector<HTMLInputElement>('input[aria-label="Correo para el envío de prueba"]');
  const props = { campaignId: null, onGuardada: () => {}, onCancelar: () => {} };

  it('editor: sin campo editable, ve su correo con la nota y la prueba va sin destinatario', async () => {
    sesion.rol = 'editor';
    api.sendTestEmail.mockResolvedValue({ ok: true, enviado_a: 'editor@cliente.test' });
    await montar(<NuevaCampana {...props} />);
    expect(campo()).toBeNull();
    const nota = contenedor!.querySelector('#nota-prueba-propia');
    expect(nota?.textContent).toBe('Como editor, la prueba llega a tu correo: editor@cliente.test');
    await act(async () => { botones('Enviar prueba')[0].click(); });
    expect(api.sendTestEmail).toHaveBeenCalledWith('', '', undefined);
    expect(contenedor!.textContent).toContain('Prueba enviada a editor@cliente.test');
  });

  it('admin: el campo es libre y sin la nota de editor', async () => {
    sesion.rol = 'admin';
    api.sendTestEmail.mockResolvedValue({ ok: true, enviado_a: 'otra@cliente.test' });
    await montar(<NuevaCampana {...props} />);
    expect(campo()).not.toBeNull();
    expect(contenedor!.querySelector('#nota-prueba-propia')).toBeNull();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { set.call(campo()!, 'otra@cliente.test'); campo()!.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { botones('Enviar prueba')[0].click(); });
    expect(api.sendTestEmail).toHaveBeenCalledWith('', '', 'otra@cliente.test');
    expect(contenedor!.textContent).toContain('Prueba enviada a otra@cliente.test');
  });

  it('lectura: no ve el envío de prueba', async () => {
    sesion.rol = 'lectura';
    await montar(<NuevaCampana {...props} />);
    expect(botones('Enviar prueba')).toHaveLength(0);
  });
});
