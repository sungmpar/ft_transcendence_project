import { execFileSync } from 'child_process';
import { createServer, Server } from 'http';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync, createReadStream } from 'fs';
import { resolve, extname, sep } from 'path';
import { ServiceUnavailableException } from '@nestjs/common';
import { UserService } from '../src/user/user.service';
import { User } from '../src/user/entity/user.entity';
import { OnlineFixture, startOnlineFixture } from './online-fixture';

const { chromium } = require(process.env.ARCADE_PLAYWRIGHT_MODULE ||
  '/opt/miniconda3/lib/python3.12/site-packages/playwright/driver/package');
const evidence = resolve(__dirname, '../../docs/home-online-polish/evidence');
const temporary = `/private/tmp/ft-home-guest-entry-${process.pid}`;
const delay = (ms: number) => new Promise(done => setTimeout(done, ms));

/** Real guest endpoint/cookie/JWT/user guards, with no credential injection.
 * Separate compiled frontends preserve the root-owned frontend/dist. A second
 * frontend origin uses the same host and a different port, matching the existing
 * supported split-port cookie behavior. This does not test cross-site cookies.
 */
describe('Guest entry preserves one request, public fallback and login intent', () => {
  let fixture: OnlineFixture;
  let browser: any;
  let browserVersion = '';
  let splitServer: Server;
  let splitOrigin: string;
  let quiet: jest.SpyInstance;
  let userService: UserService;
  const results: Array<Record<string, unknown>> = [];
  const contexts: any[] = [];
  const previous = { front: process.env.FRONT_URL, guest: process.env.ENABLE_GUEST_LOGIN, image: process.env.DEFAULT_IMG };
  let stage = 'setup';

  function build(name: string, backend = '') {
    const output = resolve(temporary, name);
    mkdirSync(output, { recursive: true });
    try {
      const log = execFileSync(process.execPath, [resolve(__dirname, '../../frontend/node_modules/@vue/cli-service/bin/vue-cli-service.js'),
        'build', '--dest', output], { cwd: resolve(__dirname, '../../frontend'), maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, NODE_ENV: 'production', VUE_APP_ENABLE_GUEST_LOGIN: 'true',
          VUE_APP_ARCADE_DEBUG: 'true', VUE_APP_BACKEND_URL: backend,
          VUE_APP_WS_URL: backend.replace(/^http/, 'ws') } });
      writeFileSync(resolve(evidence, `guest-entry-${name}-build.log`), log);
    } catch (error) {
      writeFileSync(resolve(evidence, `guest-entry-${name}-build.log`), String(error?.stdout || '') + String(error?.stderr || ''));
      throw new Error(`${name} temporary frontend build failed; inspect its build log`);
    }
    return output;
  }

  beforeAll(async () => {
    mkdirSync(evidence, { recursive: true });
    quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env.ENABLE_GUEST_LOGIN = 'true';
    process.env.DEFAULT_IMG = resolve(__dirname, '../profiles/default.jpeg');
    const sameDist = build('same-origin');
    fixture = await startOnlineFixture({ includeServices: true, serveFrontend: true, frontendDist: sameDist, cors: true });
    userService = fixture.app.get(UserService);
    const splitDist = build('split-origin', fixture.httpUrl);
    splitServer = createServer((request, response) => {
      let pathname: string;
      try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
      catch { response.writeHead(400).end(); return; }
      let file = resolve(splitDist, '.' + pathname);
      if (!file.startsWith(splitDist + sep) && file !== splitDist) { response.writeHead(403).end(); return; }
      if (!existsSync(file) || !statSync(file).isFile()) file = resolve(splitDist, 'index.html');
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
      response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      createReadStream(file).pipe(response);
    });
    await new Promise<void>(done => splitServer.listen(0, '127.0.0.1', done));
    const address = splitServer.address();
    if (!address || typeof address === 'string') throw new Error('Split frontend has no TCP address');
    splitOrigin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true, executablePath: process.env.ARCADE_CHROMIUM_EXECUTABLE ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    browserVersion = browser.version();
  }, 180000);

  afterAll(async () => {
    jest.restoreAllMocks();
    for (const context of contexts) await context.close();
    if (browser) await browser.close();
    if (splitServer) await new Promise<void>(done => splitServer.close(() => done()));
    if (fixture) await fixture.close();
    if (previous.front === undefined) delete process.env.FRONT_URL; else process.env.FRONT_URL = previous.front;
    if (previous.guest === undefined) delete process.env.ENABLE_GUEST_LOGIN; else process.env.ENABLE_GUEST_LOGIN = previous.guest;
    if (previous.image === undefined) delete process.env.DEFAULT_IMG; else process.env.DEFAULT_IMG = previous.image;
    writeFileSync(resolve(evidence, 'home-guest-entry.json'), JSON.stringify({
      scope: 'Actual guest HTTP/cookie/JWT and browser UI on isolated PostgreSQL; no credential injection; two temporary frontend builds',
      splitOriginScope: 'Same host, different ports; cross-site/subdomain cookie policies not covered',
      createdAt: new Date().toISOString(), viewport: { width: 1440, height: 900 },
      rootDistWrittenByThisSuite: false, temporaryBuildRoot: temporary, browserVersion,
      frontendScripts: Object.fromEntries(['same-origin', 'split-origin'].map(name => {
        const index = resolve(temporary, name, 'index.html');
        return [name, existsSync(index) ? [...readFileSync(index, 'utf8').matchAll(/js\/[^"\s]+\.js/g)].map(match => match[0]) : []];
      })), results,
    }, null, 2));
  }, 20000);

  async function pageAt(origin: string) {
    process.env.FRONT_URL = origin;
    process.env.ENABLE_GUEST_LOGIN = 'true';
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    contexts.push(context);
    const allowed = new Set([origin, fixture.httpUrl]);
    await context.route('**/*', route => allowed.has(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    const observed = { guestRequests: 0, nativeCallbacks: 0, pageErrors: 0, sockets: 0 };
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/auth/guest' && request.method() === 'GET') observed.guestRequests++;
      if (request.isNavigationRequest() && url.pathname === '/login' && url.searchParams.get('token') === 'check') observed.nativeCallbacks++;
    });
    page.on('pageerror', () => observed.pageErrors++);
    page.on('websocket', () => observed.sockets++);
    await page.goto(origin + '/login?next=/game');
    await page.getByTestId('guest-login').waitFor();
    return { page, context, observed };
  }
  async function scenario(name: string, run: () => Promise<Record<string, unknown>>) {
    try { results.push({ name, status: 'PASS', ...await run() }); }
    catch { results.push({ name, status: 'FAIL', stage }); throw new Error(`${name} failed at ${stage}; inspect sanitized guest-entry evidence`); }
  }
  async function returnedGame(page: any, observed: any) {
    await page.waitForURL((url: URL) => url.pathname === '/game');
    await page.getByTestId('online-play').waitFor();
    await page.waitForFunction(() => !(document.querySelector('[data-testid="online-play"]') as HTMLButtonElement)?.disabled);
    expect(observed.guestRequests).toBe(1);
    expect(observed.nativeCallbacks).toBe(1);
    expect(observed.pageErrors).toBe(0);
    expect(await page.evaluate(() => Boolean(localStorage.getItem('token')))).toBe(true);
    expect(await page.evaluate(() => sessionStorage.getItem('transcendence.online-intent.v1'))).toBeNull();
  }

  for (const split of [false, true]) {
    const label = split ? 'split-origin' : 'same-origin';
    it(`${label}: real guest login creates one account and uses one full callback`, async () => {
      await scenario(`${label}-real-guest`, async () => {
        stage = 'real-guest-button';
        const { page, context, observed } = await pageAt(split ? splitOrigin : fixture.httpUrl);
        const before = await fixture.dataSource.getRepository(User).count();
        await page.getByTestId('guest-login').click();
        await returnedGame(page, observed);
        expect(await fixture.dataSource.getRepository(User).count()).toBe(before + 1);
        await context.close();
        return { guestAccountsAdded: 1, guestRequests: observed.guestRequests, fullCallbacks: observed.nativeCallbacks, finalRoute: '/game' };
      });
    });
    it(`${label}: HTTP 503 stays on Login and the real public AI link works`, async () => {
      await scenario(`${label}-503-fallback`, async () => {
        stage = 'guest-service-503';
        const original = jest.spyOn(userService, 'createGuest').mockRejectedValueOnce(new ServiceUnavailableException('Isolated guest service failure'));
        try {
          const { page, context, observed } = await pageAt(split ? splitOrigin : fixture.httpUrl);
          const before = await fixture.dataSource.getRepository(User).count();
          await page.getByTestId('guest-login').click();
          await page.getByTestId('guest-login-error').waitFor();
          expect(new URL(page.url()).pathname).toBe('/login');
          expect(observed.guestRequests).toBe(1);
          expect(observed.nativeCallbacks).toBe(0);
          expect(await fixture.dataSource.getRepository(User).count()).toBe(before);
          await page.getByRole('link', { name: 'AI 대전 시작 →', exact: true }).click();
          await page.getByTestId('court').waitFor();
          expect(new URL(page.url()).pathname).toBe('/play/ai');
          expect(observed.sockets).toBe(0);
          await context.close();
          return { http503InjectedAtRealService: true, guestRequests: 1, fullCallbacks: 0, accountsAdded: 0, finalRoute: '/play/ai' };
        } finally { original.mockRestore(); }
      });
    });
  }

  it('a fast double click issues one real guest request and one account', async () => {
    await scenario('double-click-single-guest', async () => {
      stage = 'double-click-pending';
      const create = userService.createGuest.bind(userService);
      const delayed = jest.spyOn(userService, 'createGuest').mockImplementation(async () => { await delay(400); return create(); });
      try {
        const { page, context, observed } = await pageAt(fixture.httpUrl);
        const before = await fixture.dataSource.getRepository(User).count();
        await page.getByTestId('guest-login').dblclick();
        await returnedGame(page, observed);
        expect(await fixture.dataSource.getRepository(User).count()).toBe(before + 1);
        await context.close();
        return { guestRequests: 1, accountsAdded: 1, fullCallbacks: 1 };
      } finally { delayed.mockRestore(); }
    });
  });

  it('choosing public AI during a pending request prevents a late callback', async () => {
    await scenario('pending-guest-cancel-to-public', async () => {
      stage = 'pending-request-route-exit';
      const create = userService.createGuest.bind(userService);
      const delayed = jest.spyOn(userService, 'createGuest').mockImplementation(async () => { await delay(600); return create(); });
      try {
        const { page, context, observed } = await pageAt(splitOrigin);
        const before = await fixture.dataSource.getRepository(User).count();
        await page.getByTestId('guest-login').click();
        await page.getByRole('link', { name: 'AI 대전 시작 →', exact: true }).click();
        await page.getByTestId('court').waitFor();
        await delay(1200);
        expect(new URL(page.url()).pathname).toBe('/play/ai');
        expect(observed.nativeCallbacks).toBe(0);
        expect(observed.guestRequests).toBe(1);
        expect(observed.sockets).toBe(0);
        const added = await fixture.dataSource.getRepository(User).count() - before;
        expect(added).toBeLessThanOrEqual(1);
        await context.close();
        return { guestRequests: 1, fullCallbacks: 0, finalRoute: '/play/ai', serverAccountsAddedAfterCancellation: added,
          note: 'Aborting transport does not promise cancellation of already running server work' };
      } finally { delayed.mockRestore(); }
    });
  });

  it('the visible new-tab fallback preserves an allowlisted direct-entry intent', async () => {
    await scenario('new-tab-preserves-spectator-intent', async () => {
      stage = 'new-tab-link';
      const { page, context } = await pageAt(fixture.httpUrl);
      await page.goto(fixture.httpUrl + '/spectate');
      await page.waitForURL((url: URL) => url.pathname === '/login');
      await page.locator('summary').click();
      const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: '새 탭에서 열기 ↗', exact: true }).click()]);
      await popup.getByRole('heading', { name: '경기 관전 계속하기', exact: true }).waitFor();
      expect(new URL(popup.url()).searchParams.get('next')).toBe('/spectate');
      await popup.getByTestId('guest-login').click();
      await popup.waitForURL((url: URL) => url.pathname === '/spectate');
      await popup.getByTestId('online-play').waitFor();
      await context.close();
      return { query: 'next=/spectate', actualGuestCallbackFinalRoute: '/spectate' };
    });
  });

  it('credential CORS is endpoint-scoped, exact-origin, and retained on disabled errors', async () => {
    await scenario('guest-header-scope-and-disabled-flag', async () => {
      stage = 'cors-header-contract';
      const context = await browser.newContext();
      contexts.push(context);
      process.env.FRONT_URL = splitOrigin;
      process.env.ENABLE_GUEST_LOGIN = 'false';
      const allowed = await context.request.get(fixture.httpUrl + '/auth/guest', { headers: { Origin: splitOrigin }, maxRedirects: 0 });
      expect(allowed.status()).toBe(403);
      expect(allowed.headers()['access-control-allow-origin']).toBe(splitOrigin);
      expect(allowed.headers()['access-control-allow-credentials']).toBe('true');
      expect(allowed.headers().vary).toContain('Origin');
      const rejected = await context.request.get(fixture.httpUrl + '/auth/guest', { headers: { Origin: 'https://untrusted.invalid' }, maxRedirects: 0 });
      expect(rejected.status()).toBe(403);
      expect(rejected.headers()['access-control-allow-credentials']).toBeUndefined();
      const unrelated = await context.request.get(fixture.httpUrl + '/user/me', { headers: { Origin: splitOrigin } });
      expect(unrelated.headers()['access-control-allow-credentials']).toBeUndefined();
      delete process.env.FRONT_URL;
      const missing = await context.request.get(fixture.httpUrl + '/auth/guest', { headers: { Origin: splitOrigin }, maxRedirects: 0 });
      expect(missing.headers()['access-control-allow-credentials']).toBeUndefined();
      await context.close();
      return { allowedOriginExact: true, credentialsAllowedOnlyOnGuest: true, disabledStatus: 403,
        untrustedOriginCredentialsAbsent: true, missingConfigurationCredentialsAbsent: true, varyOrigin: true };
    });
  });
});
