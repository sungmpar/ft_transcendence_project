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
const evidence = process.env.ARCADE_EVIDENCE_DIR || resolve(__dirname, '../../docs/home-online-polish/evidence');
const temporary = `/private/tmp/ft-home-guest-entry-${process.pid}`;
const reuseBuildRoot = process.env.ARCADE_GUEST_REUSE_ROOT;
const delay = (ms: number) => new Promise(done => setTimeout(done, ms));

/** Real guest endpoint/cookie/JWT/user guards, with no credential injection.
 * Separate compiled frontends preserve the root-owned frontend/dist. A second
 * frontend origin uses the same host and a different port, matching the existing
 * supported split-port cookie behavior. This does not test cross-site cookies.
 */
describe('Guest document entry preserves one request, browser return and login intent', () => {
  let fixture: OnlineFixture;
  let browser: any;
  let browserVersion = '';
  let splitServer: Server;
  let disabledServer: Server;
  let splitOrigin: string;
  let disabledOrigin: string;
  let quiet: jest.SpyInstance;
  let userService: UserService;
  const results: Array<Record<string, unknown>> = [];
  const contexts: any[] = [];
  const previous = { front: process.env.FRONT_URL, guest: process.env.ENABLE_GUEST_LOGIN, image: process.env.DEFAULT_IMG };
  let stage = 'setup';
  let diagnostic: Record<string, unknown> = {};

  function build(name: string, backend = '', enabled = true) {
    if (reuseBuildRoot) {
      // Used only with the explicit bfcache test-name filter. Split-origin
      // bundles retain their original endpoint and are not revalidated this way.
      if (!/^\/private\/tmp\/ft-home-guest-entry-\d+$/.test(reuseBuildRoot)) throw new Error('Invalid owned guest build root');
      const existing = resolve(reuseBuildRoot, name);
      if (!existsSync(resolve(existing, 'index.html'))) throw new Error('The owned guest build no longer exists');
      return existing;
    }
    const output = resolve(temporary, name);
    mkdirSync(output, { recursive: true });
    try {
      const log = execFileSync(process.execPath, [resolve(__dirname, '../../frontend/node_modules/@vue/cli-service/bin/vue-cli-service.js'),
        'build', '--dest', output], { cwd: resolve(__dirname, '../../frontend'), maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, NODE_ENV: 'production', VUE_APP_ENABLE_GUEST_LOGIN: String(enabled),
          VUE_APP_ARCADE_DEBUG: 'true', VUE_APP_BACKEND_URL: backend,
          VUE_APP_WS_URL: backend.replace(/^http/, 'ws') } });
      writeFileSync(resolve(evidence, `guest-entry-${name}-build.log`), log);
    } catch (error) {
      writeFileSync(resolve(evidence, `guest-entry-${name}-build.log`), String(error?.stdout || '') + String(error?.stderr || ''));
      throw new Error(`${name} temporary frontend build failed; inspect its build log`);
    }
    return output;
  }

  async function serveDist(directory: string): Promise<{ server: Server; origin: string }> {
    const server = createServer((request, response) => {
      let pathname: string;
      try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
      catch { response.writeHead(400).end(); return; }
      let file = resolve(directory, '.' + pathname);
      if (!file.startsWith(directory + sep) && file !== directory) { response.writeHead(403).end(); return; }
      if (!existsSync(file) || !statSync(file).isFile()) file = resolve(directory, 'index.html');
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
      response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      createReadStream(file).pipe(response);
    });
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Temporary frontend has no TCP address');
    return { server, origin: `http://127.0.0.1:${address.port}` };
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
    const split = await serveDist(splitDist);
    splitServer = split.server; splitOrigin = split.origin;
    const disabled = await serveDist(build('guest-disabled', '', false));
    disabledServer = disabled.server; disabledOrigin = disabled.origin;
    browser = await chromium.launch({ headless: true, executablePath: process.env.ARCADE_CHROMIUM_EXECUTABLE ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    browserVersion = browser.version();
  }, 180000);

  afterAll(async () => {
    jest.restoreAllMocks();
    for (const context of contexts) await context.close();
    if (browser) await browser.close();
    if (splitServer) await new Promise<void>(done => splitServer.close(() => done()));
    if (disabledServer) await new Promise<void>(done => disabledServer.close(() => done()));
    if (fixture) await fixture.close();
    if (previous.front === undefined) delete process.env.FRONT_URL; else process.env.FRONT_URL = previous.front;
    if (previous.guest === undefined) delete process.env.ENABLE_GUEST_LOGIN; else process.env.ENABLE_GUEST_LOGIN = previous.guest;
    if (previous.image === undefined) delete process.env.DEFAULT_IMG; else process.env.DEFAULT_IMG = previous.image;
    writeFileSync(resolve(evidence, 'home-guest-entry.json'), JSON.stringify({
      scope: 'Actual guest document HTTP/cookie/JWT and browser UI on isolated PostgreSQL; no credential injection; temporary frontend builds',
      splitOriginScope: 'Same host, different ports; cross-site/subdomain cookie policies not covered',
      createdAt: new Date().toISOString(), viewport: { width: 1440, height: 900 },
      rootDistWrittenByThisSuite: false, temporaryBuildRoot: reuseBuildRoot || temporary,
      reusedBuilds: Boolean(reuseBuildRoot), browserVersion,
      frontendScripts: Object.fromEntries(['same-origin', 'split-origin', 'guest-disabled'].map(name => {
        const index = resolve(reuseBuildRoot || temporary, name, 'index.html');
        return [name, existsSync(index) ? [...readFileSync(index, 'utf8').matchAll(/js\/[^"\s]+\.js/g)].map(match => match[0]) : []];
      })), results,
    }, null, 2));
  }, 20000);

  async function pageAt(origin: string, destination = '/game', blockedIntent = false) {
    process.env.FRONT_URL = origin;
    process.env.ENABLE_GUEST_LOGIN = 'true';
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    contexts.push(context);
    if (blockedIntent) await context.addInitScript(() => {
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args: string[]) {
          if (this === window.sessionStorage) throw new DOMException('Fixture storage denial', 'SecurityError');
          return original.apply(this, args);
        };
      }
    });
    const allowed = new Set([origin, fixture.httpUrl]);
    await context.route('**/*', route => allowed.has(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    const observed = { guestRequests: 0, guestDocuments: 0, guestFetches: 0, nativeCallbacks: 0, pageErrors: 0, sockets: 0 };
    diagnostic = observed;
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/auth/guest' && request.method() === 'GET') {
        observed.guestRequests++;
        if (request.isNavigationRequest() && request.resourceType() === 'document') observed.guestDocuments++;
        if (['fetch', 'xhr'].includes(request.resourceType())) observed.guestFetches++;
      }
      if (request.isNavigationRequest() && url.pathname === '/login' && url.searchParams.get('token') === 'check') observed.nativeCallbacks++;
    });
    page.on('pageerror', () => observed.pageErrors++);
    page.on('websocket', () => observed.sockets++);
    await page.goto(origin + '/login?next=' + encodeURIComponent(destination));
    await page.getByTestId('guest-login').waitFor();
    return { page, context, observed };
  }
  async function scenario(name: string, run: () => Promise<Record<string, unknown>>) {
    diagnostic = {};
    try {
      results.push({ name, status: 'PASS', ...await run() });
      process.stdout.write(JSON.stringify({ name, status: 'PASS' }) + '\n');
    } catch {
      results.push({ name, status: 'FAIL', stage, diagnostic: { ...diagnostic } });
      process.stdout.write(JSON.stringify({ name, status: 'FAIL', stage }) + '\n');
      throw new Error(`${name} failed at ${stage}; inspect sanitized guest-entry evidence`);
    }
  }
  async function returnedGame(page: any, observed: any, destination = '/game') {
    await page.waitForURL((url: URL) => url.pathname === destination);
    await page.getByTestId('online-play').waitFor();
    await page.waitForFunction(() => !(document.querySelector('[data-testid="online-play"]') as HTMLButtonElement)?.disabled);
    expect(observed.guestRequests).toBe(1);
    stage = 'guest-request-is-one-document-not-fetch';
    expect(observed.guestDocuments).toBe(1);
    expect(observed.guestFetches).toBe(0);
    expect(observed.nativeCallbacks).toBe(1);
    expect(observed.pageErrors).toBe(0);
    expect(await page.evaluate(() => Boolean(localStorage.getItem('token')))).toBe(true);
    expect(await page.evaluate(() => sessionStorage.getItem('transcendence.online-intent.v1'))).toBeNull();
  }

  for (const split of [false, true]) {
    const label = split ? 'split-origin' : 'same-origin';
    for (const destination of ['/game', '/invite', '/spectate']) it(`${label}: real guest document returns to ${destination}`, async () => {
      await scenario(`${label}-real-guest-${destination.slice(1)}`, async () => {
        stage = 'real-guest-button';
        const { page, context, observed } = await pageAt(split ? splitOrigin : fixture.httpUrl, destination);
        const before = await fixture.dataSource.getRepository(User).count();
        await page.getByTestId('guest-login').click();
        await returnedGame(page, observed, destination);
        expect(await fixture.dataSource.getRepository(User).count()).toBe(before + 1);
        await context.close();
        return { guestAccountsAdded: 1, guestRequests: observed.guestRequests, guestDocuments: observed.guestDocuments,
          guestFetches: observed.guestFetches, fullCallbacks: observed.nativeCallbacks, finalRoute: destination };
      });
    });
    it(`${label}: a failed guest document permits browser Back and public AI without automatic retries`, async () => {
      await scenario(`${label}-503-fallback`, async () => {
        stage = 'guest-service-503';
        const original = jest.spyOn(userService, 'createGuest').mockRejectedValueOnce(new ServiceUnavailableException('Isolated guest service failure'));
        try {
          const { page, context, observed } = await pageAt(split ? splitOrigin : fixture.httpUrl);
          const before = await fixture.dataSource.getRepository(User).count();
          const failedDocument = page.waitForResponse(response => response.request().isNavigationRequest() &&
            new URL(response.url()).pathname === '/auth/guest' && response.status() === 503);
          await page.getByTestId('guest-login').click();
          await failedDocument;
          await page.waitForURL((url: URL) => url.pathname === '/auth/guest');
          stage = 'back-from-failed-document';
          await page.goBack();
          await page.getByTestId('guest-login').waitFor();
          expect(await page.getByTestId('guest-login').isEnabled()).toBe(true);
          expect(new URL(page.url()).pathname).toBe('/login');
          expect(observed.guestRequests).toBe(1);
          expect(observed.guestDocuments).toBe(1);
          expect(observed.guestFetches).toBe(0);
          expect(observed.nativeCallbacks).toBe(0);
          expect(await fixture.dataSource.getRepository(User).count()).toBe(before);
          await page.locator('a[href="/play/ai"]').click();
          await page.getByTestId('court').waitFor();
          expect(new URL(page.url()).pathname).toBe('/play/ai');
          expect(observed.sockets).toBe(0);
          await context.close();
          return { http503InjectedAtRealService: true, guestDocuments: 1, guestFetches: 0,
            browserBackRestoredButton: true, fullCallbacks: 0, accountsAdded: 0, finalRoute: '/play/ai',
            failureBoundary: 'HTTP error is a separate document; the old SPA does not intercept it' };
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

  it('cancelling before guest navigation clears intent and never creates an account', async () => {
    await scenario('cancel-before-guest-document', async () => {
      stage = 'cancel-without-starting-login';
      const { page, context, observed } = await pageAt(splitOrigin);
      const before = await fixture.dataSource.getRepository(User).count();
      await page.locator('a.login-cancel').click();
      await page.getByTestId('play-ai').waitFor();
      expect(await page.evaluate(() => sessionStorage.getItem('transcendence.online-intent.v1'))).toBeNull();
      await page.getByTestId('play-ai').click();
      await page.getByTestId('court').waitFor();
      expect(new URL(page.url()).pathname).toBe('/play/ai');
      expect(observed.nativeCallbacks).toBe(0);
      expect(observed.guestRequests).toBe(0);
      expect(observed.sockets).toBe(0);
      expect(await fixture.dataSource.getRepository(User).count()).toBe(before);
      await context.close();
      return { guestRequests: 0, fullCallbacks: 0, accountsAdded: 0, intentCleared: true, finalRoute: '/play/ai' };
    });
  });

  it('blocked intent storage falls back to Home after the real document callback', async () => {
    await scenario('blocked-intent-storage-home-fallback', async () => {
      stage = 'blocked-session-storage';
      const { page, context, observed } = await pageAt(fixture.httpUrl, '/spectate', true);
      const before = await fixture.dataSource.getRepository(User).count();
      await page.getByTestId('guest-login').click();
      await page.waitForURL((url: URL) => url.pathname === '/');
      await page.getByTestId('play-online').waitFor();
      expect(observed.guestRequests).toBe(1);
      expect(observed.guestDocuments).toBe(1);
      expect(observed.guestFetches).toBe(0);
      expect(observed.nativeCallbacks).toBe(1);
      expect(observed.pageErrors).toBe(0);
      expect(observed.sockets).toBe(0);
      expect(await fixture.dataSource.getRepository(User).count()).toBe(before + 1);
      await context.close();
      return { sessionStorageDenied: true, guestDocuments: 1, guestFetches: 0, accountsAdded: 1, finalRoute: '/' };
    });
  });

  it('reloading Login preserves the intended document-return destination', async () => {
    await scenario('login-reload-keeps-intent', async () => {
      stage = 'login-reload';
      const { page, context, observed } = await pageAt(fixture.httpUrl, '/invite');
      await page.reload();
      await page.getByTestId('guest-login').click();
      await returnedGame(page, observed, '/invite');
      await context.close();
      return { guestDocuments: 1, guestFetches: 0, fullCallbacks: 1, finalRoute: '/invite' };
    });
  });

  it('the disabled frontend flag keeps both public modes available without a guest request', async () => {
    await scenario('frontend-guest-flag-disabled', async () => {
      stage = 'disabled-frontend-flag';
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      contexts.push(context);
      const page = await context.newPage();
      let guestRequests = 0, sockets = 0;
      page.on('request', request => { if (new URL(request.url()).pathname === '/auth/guest') guestRequests++; });
      page.on('websocket', () => sockets++);
      await page.goto(disabledOrigin + '/login');
      await page.getByTestId('guest-disabled').waitFor();
      expect(await page.getByTestId('guest-login').count()).toBe(0);
      expect(await page.locator('a[href="/play/local"]').count()).toBe(1);
      await page.locator('a[href="/play/ai"]').click();
      await page.getByTestId('court').waitFor();
      expect(guestRequests).toBe(0);
      expect(sockets).toBe(0);
      await context.close();
      return { guestButtonAbsent: true, publicLocalLink: true, publicAiReached: true, guestRequests: 0, sockets: 0 };
    });
  });

  it('actual bfcache restoration clears the pending button after a failed document', async () => {
    await scenario('actual-bfcache-back-after-guest-failure', async () => {
      stage = 'bfcache-browser-setup';
      // Playwright otherwise disables bfcache. Remove only that default switch;
      // do not relax permissions, certificate checks or browser security.
      const cacheBrowser = await chromium.launch({ headless: true,
        ignoreDefaultArgs: ['--disable-back-forward-cache'], executablePath: process.env.ARCADE_CHROMIUM_EXECUTABLE ||
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
      const failure = jest.spyOn(userService, 'createGuest').mockRejectedValueOnce(new ServiceUnavailableException('Isolated guest service failure'));
      try {
        process.env.FRONT_URL = fixture.httpUrl; process.env.ENABLE_GUEST_LOGIN = 'true';
        const context = await cacheBrowser.newContext({ viewport: { width: 1440, height: 900 } });
        await context.addInitScript(() => {
          (window as any).__P1_PAGE_SHOW__ = [];
          window.addEventListener('pageshow', event => { (window as any).__P1_PAGE_SHOW__.push(event.persisted); });
        });
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Page.enable');
        const notRestored: string[] = [];
        cdp.on('Page.backForwardCacheNotUsed', event => {
          for (const reason of event.notRestoredExplanations || []) {
            notRestored.push(String(reason.reason));
          }
        });
        let guestDocuments = 0, guestFetches = 0, callbacks = 0, pageErrors = 0;
        const unexpected: string[] = [];
        // This case needs an un-intercepted owned document for real bfcache.
        // Source uses only this fixture; observe any unexpected origin explicitly.
        page.on('request', request => {
          const url = new URL(request.url());
          if (url.origin !== fixture.httpUrl) unexpected.push('unexpected origin');
          if (url.pathname === '/auth/guest') {
            if (request.isNavigationRequest()) guestDocuments++;
            else guestFetches++;
          }
          if (url.pathname === '/login' && url.searchParams.get('token') === 'check') callbacks++;
        });
        page.on('pageerror', () => pageErrors++);
        await page.goto(fixture.httpUrl + '/login?next=/game');
        await page.getByTestId('guest-login').waitFor();
        const timeOrigin = await page.evaluate(() => performance.timeOrigin);
        const before = await fixture.dataSource.getRepository(User).count();
        await page.getByTestId('guest-login').click();
        await page.waitForURL((url: URL) => url.pathname === '/auth/guest');
        await page.waitForLoadState('domcontentloaded');
        stage = 'actual-pageshow-persisted';
        try {
          // A bfcache restoration has no new load event. Wait for history commit,
          // then assert the real pageshow event and original document below.
          await page.goBack({ waitUntil: 'commit', timeout: 10000 });
        } catch {
          diagnostic = { stage: 'browser-back-wait', notRestored,
            path: new URL(page.url()).pathname,
            pageShow: await page.evaluate(() => (window as any).__P1_PAGE_SHOW__),
            sameDocument: await page.evaluate(() => performance.timeOrigin) === timeOrigin,
            navigationReasons: await page.evaluate(() => {
              const navigation = performance.getEntriesByType('navigation')[0] as any;
              return navigation?.notRestoredReasons?.toJSON?.() || null;
            }) };
          await page.screenshot({ path: resolve(evidence, 'P1-bfcache-back-wait-failed.png'), fullPage: true });
          throw new Error('Browser Back did not complete its commit wait');
        }
        await page.getByTestId('guest-login').waitFor();
        const persisted = await page.evaluate(() => (window as any).__P1_PAGE_SHOW__.includes(true));
        const sameDocument = await page.evaluate(() => performance.timeOrigin) === timeOrigin;
        diagnostic = { persisted, sameDocument, guestDocuments, guestFetches, callbacks, pageErrors, notRestored };
        expect(persisted).toBe(true);
        expect(sameDocument).toBe(true);
        expect(await page.getByTestId('guest-login').isEnabled()).toBe(true);
        expect(guestDocuments).toBe(1); expect(guestFetches).toBe(0); expect(callbacks).toBe(0);
        expect(await fixture.dataSource.getRepository(User).count()).toBe(before);
        expect(unexpected).toEqual([]); expect(pageErrors).toBe(0);
        await page.screenshot({ path: resolve(evidence, 'P1-bfcache-login-restored.png'), fullPage: true });
        return { persisted, sameDocument, restoredButtonEnabled: true, guestDocuments, guestFetches, callbacks, notRestored,
          accountsAdded: 0, pageErrors, browserSecurity: 'Default security; only Playwright bfcache-disable switch omitted' };
      } finally { failure.mockRestore(); await cacheBrowser.close(); }
    });
  });

  it('the visible new-tab fallback preserves an allowlisted direct-entry intent', async () => {
    await scenario('new-tab-preserves-spectator-intent', async () => {
      stage = 'new-tab-link';
      const { page, context } = await pageAt(fixture.httpUrl);
      await page.goto(fixture.httpUrl + '/spectate');
      await page.waitForURL((url: URL) => url.pathname === '/login');
      await page.getByTestId('login-help').locator('summary').click();
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

  it('document navigation needs no endpoint credential CORS and the guest flag still rejects creation', async () => {
    await scenario('guest-header-scope-and-disabled-flag', async () => {
      stage = 'cors-header-contract';
      const context = await browser.newContext();
      contexts.push(context);
      process.env.FRONT_URL = splitOrigin;
      process.env.ENABLE_GUEST_LOGIN = 'false';
      const before = await fixture.dataSource.getRepository(User).count();
      const allowed = await context.request.get(fixture.httpUrl + '/auth/guest', { headers: { Origin: splitOrigin }, maxRedirects: 0 });
      diagnostic = { status: allowed.status(), endpointCredentialsPresent: allowed.headers()['access-control-allow-credentials'] !== undefined };
      expect(allowed.status()).toBe(403);
      expect(allowed.headers()['access-control-allow-credentials']).toBeUndefined();
      const rejected = await context.request.get(fixture.httpUrl + '/auth/guest', { headers: { Origin: 'https://untrusted.invalid' }, maxRedirects: 0 });
      expect(rejected.status()).toBe(403);
      expect(rejected.headers()['access-control-allow-credentials']).toBeUndefined();
      const unrelated = await context.request.get(fixture.httpUrl + '/user/me', { headers: { Origin: splitOrigin } });
      expect(unrelated.headers()['access-control-allow-credentials']).toBeUndefined();
      delete process.env.FRONT_URL;
      const missing = await context.request.get(fixture.httpUrl + '/auth/guest', { headers: { Origin: splitOrigin }, maxRedirects: 0 });
      expect(missing.headers()['access-control-allow-credentials']).toBeUndefined();
      expect(await fixture.dataSource.getRepository(User).count()).toBe(before);
      await context.close();
      return { endpointCredentialCorsAbsent: true, disabledStatus: 403,
        untrustedOriginCredentialsAbsent: true, missingConfigurationCredentialsAbsent: true };
    });
  });
});
