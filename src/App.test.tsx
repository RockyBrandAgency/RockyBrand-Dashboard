import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./config', () => ({
  DASHBOARD_API_URL: 'https://api.test',
  COGNITO_IDP_URL: 'https://idp.test/',
  COGNITO_CLIENT_ID: 'cliente-test',
  COGNITO_REGION: 'us-east-2',
  COGNITO_USER_POOL_ID: 'pool-test',
}));

const getMe = vi.fn();
vi.mock('./api/dashboardApi', async (original) => ({
  ...(await original<typeof import('./api/dashboardApi')>()),
  getMe: () => getMe(),
}));

import App from './App';
import { setStoredSession } from './api/cognitoAuth';

let root: Root | null = null;
let contenedor: HTMLDivElement | null = null;

beforeAll(() => {
  // jsdom no trae matchMedia; gsap y los hovers lo consultan al montar.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  contenedor?.remove();
  sessionStorage.clear();
  getMe.mockReset();
});

async function montar() {
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  await act(async () => {
    root!.render(<App />);
  });
}

describe('perfil que no carga', () => {
  it('muestra el error con Reintentar en vez del spinner eterno, y reintentar recupera el panel', async () => {
    setStoredSession({ idToken: 'x.e30.y', accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3_600_000 });
    sessionStorage.setItem('rockybrand.brainIntroSeen', '1');
    getMe
      .mockRejectedValueOnce(new Error('No se pudo conectar con el panel. Revisa tu conexión e intenta de nuevo.'))
      .mockResolvedValueOnce({
        client_id: 'cliente-test', display_name: 'Cliente Test', display_subtitle: '',
        services: {}, pms_room_views: false, logo_data_url: null,
      });

    await montar();

    expect(contenedor!.textContent).toContain('No pudimos cargar tu panel');
    expect(contenedor!.textContent).toContain('No se pudo conectar con el panel');
    expect(contenedor!.querySelector('.brain-espera')).toBeNull();

    const reintentar = [...contenedor!.querySelectorAll('button')].find((b) => b.textContent === 'Reintentar');
    await act(async () => {
      reintentar!.click();
    });

    expect(getMe).toHaveBeenCalledTimes(2);
    expect(contenedor!.textContent).not.toContain('No pudimos cargar tu panel');
  });
});
