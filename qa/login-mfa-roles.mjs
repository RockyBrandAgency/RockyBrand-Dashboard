// QA del login con desafíos de Cognito (MFA/TOTP, nueva contraseña) y de los
// roles del panel. Todo con red simulada: Cognito y la API se responden desde
// este script y cualquier otro host se bloquea y se reporta.
//
// Uso (desde la raíz del repo):
//   PLAYWRIGHT_CORE=/ruta/a/node_modules/playwright-core/index.mjs \
//   CHROMIUM=~/Library/Caches/ms-playwright/chromium_headless_shell-XXXX/chrome-headless-shell-mac-arm64/chrome-headless-shell \
//   node qa/login-mfa-roles.mjs
// playwright-core NO es dependencia del repo (decisión 2026-10-20): se le pasa
// la ruta al index.mjs de una copia instalada aparte (p. ej. `npm i
// playwright-core` en una carpeta temporal). Sale 0 si todos los casos pasan.
// Levanta su propio Vite con variables de entorno falsas (nunca lee .env).
import { spawn } from 'node:child_process';
import { setTimeout as esperar } from 'node:timers/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const PUERTO = Number(process.env.PUERTO ?? 5199);
const BASE = `http://localhost:${PUERTO}/`;
const COGNITO = 'https://cognito-idp.us-east-2.amazonaws.com/';
const API = 'https://api.example.test';
const SECRETO = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'; // clave de ejemplo, no es de nadie
const ANCHO = Number(process.env.ANCHO ?? 320);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.firma`;
function tokens(grupos) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const id = { sub: 'u-1', email: 'qa@example.test', 'custom:client_id': 'demo', exp, token_use: 'id' };
  if (grupos) id['cognito:groups'] = grupos;
  return {
    AuthenticationResult: {
      IdToken: jwt(id),
      AccessToken: jwt({ sub: 'u-1', exp, token_use: 'access', scope: 'aws.cognito.signin.user.admin' }),
      RefreshToken: 'refresco-falso',
      ExpiresIn: 3600,
      TokenType: 'Bearer',
    },
  };
}
const BORRADOR = {
  campaign_id: 'qa-borrador', name: 'Borrador QA', subject: 'Asunto', html_body: '<p>hola</p>', template_id: '',
  status: 'draft', created_at: '2026-10-20T12:00:00Z', updated_at: '2026-10-20T12:00:00Z', sent_at: '',
};
const ME = {
  client_id: 'demo', display_name: 'Cliente QA', display_subtitle: 'Prueba', logo_data_url: null,
  services: { agents: false, pms: false, crm: false, email_marketing: true, content_approval: false, store: false, agencias: false, publicacion: false },
  pms_room_views: false, terminologia: null, email_from: null, features: null,
};

const vite = spawn('npx', ['vite', '--port', String(PUERTO), '--strictPort'], {
  env: {
    ...process.env,
    VITE_DASHBOARD_API_URL: API,
    VITE_COGNITO_USER_POOL_ID: 'us-east-2_QAqaQAqaQ',
    VITE_COGNITO_CLIENT_ID: 'qaclientequaclientequacl',
    VITE_COGNITO_REGION: 'us-east-2',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* todavía no */ }
  await esperar(500);
}

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM });
const resultados = [];
const ajenos = [];
const fugas = [];

async function caso(nombre, cognito, cuerpo) {
  const ctx = await navegador.newContext({ viewport: { width: ANCHO, height: 720 } });
  const page = await ctx.newPage();
  const llamadas = [];
  const errores = [];
  page.on('console', (m) => {
    if (m.text().includes(SECRETO)) fugas.push(`${nombre}: consola`);
    if (m.type() === 'error') errores.push(m.text().split('\n')[0]);
  });
  page.on('pageerror', (e) => errores.push(String(e.message).split('\n')[0]));
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.startsWith(COGNITO)) {
      const target = (req.headers()['x-amz-target'] ?? '').split('.').pop();
      const body = JSON.parse(req.postData() ?? '{}');
      llamadas.push({ target, body });
      const [status, resp] = cognito(target, body);
      return route.fulfill({ status, contentType: 'application/x-amz-json-1.1', body: JSON.stringify(resp) });
    }
    if (url.startsWith(API)) {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const ruta = new URL(url).pathname;
      const resp = ruta === '/dashboard/me' ? ME : ruta === '/dashboard/email/campaigns' ? { campanas: [BORRADOR] } : null;
      // Lo que esta prueba no necesita responde 503: la pantalla muestra su
      // estado de error en vez de dibujar datos inventados.
      if (!resp) return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"qa"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(resp) });
    }
    if (url.startsWith(BASE) || url.startsWith('data:')) return route.continue();
    ajenos.push(url);
    if ((req.postData() ?? '').includes(SECRETO) || url.includes(SECRETO)) fugas.push(`${nombre}: ${url}`);
    return route.abort();
  });
  try {
    await page.goto(BASE);
    await page.getByPlaceholder('tu@correo.cl').fill('qa@example.test');
    await page.getByPlaceholder('••••••••').fill('Clave-de-prueba-1');
    await page.getByRole('button', { name: 'Ingresar al Panel' }).click();
    const notas = await cuerpo(page, llamadas);
    resultados.push({ caso: nombre, ok: true, notas });
  } catch (e) {
    resultados.push({ caso: nombre, ok: false, notas: `${String(e.message ?? e).split('\n')[0].slice(0, 120)} · errores: ${errores.join(' / ').slice(0, 300)}` });
  } finally {
    await ctx.close();
  }
}

const desborde = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const entro = (page) => page.waitForRequest((r) => r.url().endsWith('/dashboard/me'), { timeout: 8000 });
const exigir = (cond, msg) => { if (!cond) throw new Error(msg); };

// 1. Login normal: InitiateAuth devuelve tokens directo.
await caso('login normal', () => [200, tokens()], async (page) => {
  await entro(page);
  return 'entró sin desafío';
});

// 2. SOFTWARE_TOKEN_MFA, con un código malo primero (5. código incorrecto).
await caso('SOFTWARE_TOKEN_MFA + código incorrecto', (t, b) => {
  if (t === 'InitiateAuth') return [200, { ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 's-1', ChallengeParameters: { USER_ID_FOR_SRP: 'u-1' } }];
  if (t === 'RespondToAuthChallenge') {
    if (b.ChallengeResponses?.SOFTWARE_TOKEN_MFA_CODE === '000000') return [400, { __type: 'CodeMismatchException', message: 'Invalid code received for user' }];
    return [200, tokens()];
  }
  return [400, { __type: 'InvalidParameterException', message: 'no esperado' }];
}, async (page, llamadas) => {
  const campo = page.getByLabel('Código de 6 dígitos');
  await campo.waitFor();
  exigir(await campo.getAttribute('inputmode') === 'numeric', 'inputmode no es numeric');
  exigir(await campo.getAttribute('autocomplete') === 'one-time-code', 'autocomplete no es one-time-code');
  const d = await desborde(page);
  await campo.fill('000000');
  await page.getByRole('button', { name: 'Verificar y entrar' }).click();
  const alerta = await page.getByRole('alert').first().textContent({ timeout: 5000 });
  await campo.fill('123456');
  await page.getByRole('button', { name: 'Verificar y entrar' }).click();
  await entro(page);
  const r = llamadas.filter((l) => l.target === 'RespondToAuthChallenge').pop();
  exigir(r.body.ChallengeResponses.USERNAME === 'u-1', 'USERNAME no salió de USER_ID_FOR_SRP');
  return `desborde ${ANCHO}px=${d}; error mostrado: «${alerta.trim()}»`;
});

// 3. MFA_SETUP: QR local, clave a la vista, verificar y entrar.
await caso('MFA_SETUP con QR', (t) => {
  if (t === 'InitiateAuth') return [200, { ChallengeName: 'MFA_SETUP', Session: 's-1', ChallengeParameters: { USER_ID_FOR_SRP: 'u-1' } }];
  if (t === 'AssociateSoftwareToken') return [200, { SecretCode: SECRETO, Session: 's-2' }];
  if (t === 'VerifySoftwareToken') return [200, { Status: 'SUCCESS', Session: 's-3' }];
  if (t === 'RespondToAuthChallenge') return [200, tokens()];
  return [400, { __type: 'InvalidParameterException', message: 'no esperado' }];
}, async (page, llamadas) => {
  const qr = page.getByRole('img', { name: /Código QR/ });
  await qr.waitFor();
  const caja = await qr.boundingBox();
  const clave = (await page.locator('[data-secreto-totp]').textContent()).replace(/\s/g, '');
  exigir(clave === SECRETO, 'la clave en texto no coincide');
  const d = await desborde(page);
  await page.getByLabel('Código de 6 dígitos').fill('123456');
  await page.getByRole('button', { name: 'Activar y entrar' }).click();
  await entro(page);
  const orden = llamadas.map((l) => l.target).join(' → ');
  const fin = llamadas.filter((l) => l.target === 'RespondToAuthChallenge').pop();
  exigir(fin.body.ChallengeName === 'MFA_SETUP' && fin.body.Session === 's-3', 'MFA_SETUP no usó la sesión de VerifySoftwareToken');
  return `QR ${Math.round(caja.width)}x${Math.round(caja.height)} px; desborde ${ANCHO}px=${d}; ${orden}`;
});

// 4. NEW_PASSWORD_REQUIRED.
await caso('NEW_PASSWORD_REQUIRED', (t) => {
  if (t === 'InitiateAuth') return [200, { ChallengeName: 'NEW_PASSWORD_REQUIRED', Session: 's-1', ChallengeParameters: { USER_ID_FOR_SRP: 'u-1', requiredAttributes: '[]', userAttributes: '{}' } }];
  if (t === 'RespondToAuthChallenge') return [200, tokens()];
  return [400, { __type: 'InvalidParameterException', message: 'no esperado' }];
}, async (page, llamadas) => {
  const campos = page.locator('input[autocomplete="new-password"]');
  await campos.first().waitFor();
  const d = await desborde(page);
  await campos.nth(0).fill('Nueva-Clave-123');
  await campos.nth(1).fill('Otra-Clave-123');
  await page.getByRole('button', { name: 'Guardar y entrar' }).click();
  const distinto = await page.getByRole('alert').first().textContent({ timeout: 3000 });
  await campos.nth(1).fill('Nueva-Clave-123');
  await page.getByRole('button', { name: 'Guardar y entrar' }).click();
  await entro(page);
  const r = llamadas.filter((l) => l.target === 'RespondToAuthChallenge').pop();
  exigir(r.body.ChallengeName === 'NEW_PASSWORD_REQUIRED' && !!r.body.ChallengeResponses.NEW_PASSWORD, 'no mandó NEW_PASSWORD');
  return `desborde ${ANCHO}px=${d}; si no coinciden: «${distinto.trim()}»`;
});

// 3 minutos vencidos: Cognito responde NotAuthorizedException dentro del desafío.
await caso('sesión de 3 minutos vencida', (t) => {
  if (t === 'InitiateAuth') return [200, { ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 's-1', ChallengeParameters: { USER_ID_FOR_SRP: 'u-1' } }];
  return [400, { __type: 'NotAuthorizedException', message: 'Invalid session for the user, session is expired.' }];
}, async (page) => {
  await page.getByLabel('Código de 6 dígitos').fill('123456');
  await page.getByRole('button', { name: 'Verificar y entrar' }).click();
  await page.getByPlaceholder('tu@correo.cl').waitFor({ timeout: 5000 });
  const msg = await page.getByRole('alert').first().textContent();
  return `volvió al formulario: «${msg.trim()}»`;
});

// 6. Roles en Email: lectura no ve «Nueva campaña»; editor no ve «Enviar Ahora»; admin sí.
async function abrirEmail(page) {
  await entro(page);
  const tab = page.getByRole('tab', { name: 'Campañas' });
  // Con solo Email Marketing contratado, el panel puede abrir directo ahí.
  if (await tab.waitFor({ timeout: 2000 }).then(() => true, () => false)) return;
  await page.getByRole('button', { name: /Email Marketing/ }).or(page.getByRole('link', { name: /Email Marketing/ })).first().click();
  if (await tab.waitFor({ timeout: 6000 }).then(() => true, () => false)) return;
  const nombres = await page.evaluate(() => [...document.querySelectorAll('button,a,[role=tab]')].map((e) => (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 30)));
  const texto = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300);
  throw new Error(`no llegó a Email; controles: ${nombres.join(' | ')}; texto: ${texto}`);
}
for (const [rol, grupos] of [['lectura', ['cliente-lectura']], ['editor', ['cliente-editor']], ['admin (sin grupo)', null]]) {
  await caso(`rol ${rol} en Email`, () => [200, tokens(grupos)], async (page) => {
    await abrirEmail(page);
    const tabNueva = await page.getByRole('tab', { name: 'Nueva campaña' }).count();
    // Borrar una campaña (también un borrador) es solo de admin.
    await page.getByRole('tab', { name: 'Campañas' }).click();
    await page.getByText('Borrador QA').first().waitFor({ timeout: 8000 });
    const eliminar = await page.getByRole('button', { name: 'Eliminar' }).count();
    let enviar = 0;
    let borrador = 0;
    if (tabNueva) {
      await page.getByRole('tab', { name: 'Nueva campaña' }).click();
      await page.getByRole('button', { name: /Guardar Borrador/ }).waitFor({ timeout: 8000 });
      enviar = await page.getByRole('button', { name: /^Enviar Ahora/ }).count();
      borrador = await page.getByRole('button', { name: /Guardar Borrador/ }).count();
    }
    if (rol === 'lectura') exigir(tabNueva === 0 && enviar === 0 && eliminar === 0, 'lectura ve Nueva campaña, Enviar o Eliminar');
    if (rol === 'editor') exigir(tabNueva === 1 && enviar === 0 && borrador === 1 && eliminar === 0, 'editor: esperaba borrador sin Enviar ni Eliminar');
    if (rol.startsWith('admin')) exigir(tabNueva === 1 && enviar > 0 && eliminar === 1, 'admin no ve Enviar o Eliminar');
    return `tab «Nueva campaña»=${tabNueva}; «Eliminar» campaña=${eliminar}; «Enviar Ahora…»=${enviar}; «Guardar Borrador»=${borrador}; desborde ${ANCHO}px=${await desborde(page)}`;
  });
}

await navegador.close();
vite.kill();
console.table(resultados);
console.log(`hosts ajenos bloqueados: ${ajenos.length ? [...new Set(ajenos)].join(', ') : 'ninguno'}`);
console.log(`clave TOTP fuera de Cognito o en consola: ${fugas.length ? fugas.join('; ') : 'nunca'}`);
process.exit(resultados.every((r) => r.ok) && fugas.length === 0 ? 0 : 1);
