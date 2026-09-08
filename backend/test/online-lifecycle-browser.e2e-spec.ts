import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { OnlineFixture, startOnlineFixture } from './online-fixture';
const { chromium } = require(process.env.ARCADE_PLAYWRIGHT_MODULE ||
  '/opt/miniconda3/lib/python3.12/site-packages/playwright/driver/package');
const evidence = process.env.ARCADE_EVIDENCE_DIR
  ? resolve(process.env.ARCADE_EVIDENCE_DIR)
  : resolve(__dirname, '../../docs/home-online-polish/evidence');
mkdirSync(evidence, { recursive: true });

describe('real browser reconnect and ownership lifecycle', () => {
  let fixture: OnlineFixture;
  let browser: any;
  let report: Record<string, unknown> | undefined;
  const contexts: any[] = [];
  beforeAll(async () => {
    fixture = await startOnlineFixture({ serveFrontend: true });
    browser = await chromium.launch({
      executablePath:
        process.env.ARCADE_CHROMIUM_EXECUTABLE ||
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
    });
  }, 30000);
  afterAll(async () => {
    for (const context of contexts) await context.close();
    if (browser) await browser.close();
    if (fixture) await fixture.close();
    if (report)
      writeFileSync(
        resolve(evidence, 'p4-online-lifecycle-browser.json'),
        JSON.stringify(report, null, 2),
      );
  }, 15000);

  it('pauses a disconnected match, resumes full state with a new generation, and rejects another active tab', async () => {
    const faultHistory: Array<Record<string, unknown>> = [];
    let blockNewConnections = false;
    const recordFault = (type: string) => {
      faultHistory.push({ type, atMs: Date.now() });
      if (faultHistory.length > 48) faultHistory.shift();
    };
    report = {
      status: 'FAIL',
      browser: browser.version(),
      impairment:
        'Explicit existing browser WebSocket.close plus Playwright routing that temporarily closes only new connection attempts; other routed traffic connects to the actual server and is forwarded without packet changes',
      faultHistory,
    };
    const users = await Promise.all([
      fixture.createPlayer(),
      fixture.createPlayer(),
    ]);
    const pages: any[] = [];
    const errors: string[] = [];
    try {
      for (const [index, user] of users.entries()) {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
        });
        contexts.push(context);
        await context.addInitScript(() => {
          const OriginalWebSocket = window.WebSocket;
          const sockets = new Set<WebSocket>();
          const history: Array<Record<string, unknown>> = [];
          const record = (
            type: string,
            values: Record<string, unknown> = {},
          ) => {
            history.push({
              type,
              atMs: Math.round(performance.now()),
              ...values,
            });
            if (history.length > 48) history.shift();
          };
          class AuditedWebSocket extends OriginalWebSocket {
            constructor(url: string | URL, protocols?: string | string[]) {
              super(url, protocols);
              sockets.add(this);
              record('created');
              this.addEventListener('open', () => record('open'));
              this.addEventListener('error', () => record('transport-error'));
              this.addEventListener('close', (event) => {
                sockets.delete(this);
                record('close', { code: event.code, wasClean: event.wasClean });
              });
              this.addEventListener('message', (event) => {
                if (
                  typeof event.data !== 'string' ||
                  !event.data.startsWith('42')
                )
                  return;
                try {
                  const start = event.data.indexOf('[');
                  if (start < 0) return;
                  const packet = JSON.parse(event.data.slice(start));
                  if (packet[0] === 'error' || packet[0] === 'exception') {
                    const conflict =
                      typeof packet[1]?.message === 'string' &&
                      packet[1].message.includes('이미 연결된 게임 세션');
                    record('game-error', {
                      category: conflict
                        ? 'active-session-conflict'
                        : 'unclassified',
                    });
                  }
                } catch {
                  /* Do not retain raw frames or authentication data. */
                }
              });
            }
          }
          window.WebSocket = AuditedWebSocket;
          (window as any).__LIFECYCLE_TRANSPORT__ = Object.freeze({
            read: () => ({
              openSockets: [...sockets].filter(
                (socket) => socket.readyState === WebSocket.OPEN,
              ).length,
              history: history.map((event) => ({ ...event })),
            }),
            close: () => {
              record('explicit-close-requested');
              for (const socket of sockets)
                if (socket.readyState === WebSocket.OPEN)
                  socket.close(1000, 'owned lifecycle impairment');
            },
          });
        });
        if (index === 0) {
          await context.routeWebSocket(
            (url: URL) =>
              url.hostname === '127.0.0.1' &&
              url.pathname.startsWith('/socket.io'),
            (route: any) => {
              if (blockNewConnections) {
                recordFault('new-attempt-blocked');
                return route.close({
                  code: 1013,
                  reason: 'owned lifecycle impairment',
                });
              }
              recordFault('actual-server-forwarding');
              route.connectToServer();
            },
          );
        }
        await context.addInitScript(
          (credential: string) => localStorage.setItem('token', credential),
          fixture.browserCredential(user),
        );
        const page = await context.newPage();
        page.on('pageerror', () => errors.push('Uncaught browser error'));
        await page.goto(fixture.httpUrl + '/game?debug=1');
        await page.getByTestId('online-play').waitFor();
        pages.push(page);
      }
      await Promise.all(
        pages.map((page) => page.getByTestId('online-play').click()),
      );
      await Promise.all(
        pages.map((page) =>
          page.waitForFunction(
            () => !!(window as any).__ONLINE_DEBUG__?.identity,
          ),
        ),
      );
      const before = await pages[0].evaluate(() =>
        (window as any).__ONLINE_DEBUG__.identity(),
      );
      blockNewConnections = true;
      recordFault('blocking-started');
      await pages[0].evaluate(() =>
        (window as any).__LIFECYCLE_TRANSPORT__.close(),
      );
      await pages[1]
        .getByTestId('online-status')
        .filter({ hasText: '일시정지' })
        .waitFor();
      const pausedTick = await pages[1].evaluate(
        () => (window as any).__ONLINE_DEBUG__.latest().tick,
      );
      await new Promise((done) => setTimeout(done, 200));
      const stillPausedTick = await pages[1].evaluate(
        () => (window as any).__ONLINE_DEBUG__.latest().tick,
      );
      expect(stillPausedTick).toBe(pausedTick);
      Object.assign(report, {
        pausedTick,
        stillPausedTick,
        pausedFor200ms: true,
      });
      blockNewConnections = false;
      recordFault('blocking-released');
      await pages[0].waitForFunction((oldGeneration: number) => {
        const debug = (window as any).__ONLINE_DEBUG__;
        return debug?.identity().generation > oldGeneration;
      }, before.generation);
      const after = await pages[0].evaluate(() =>
        (window as any).__ONLINE_DEBUG__.identity(),
      );
      expect(after.matchId).toBe(before.matchId);
      expect(after.side).toBe(before.side);
      Object.assign(report, {
        newGeneration: after.generation > before.generation,
        sameMatch: after.matchId === before.matchId,
        sameSide: after.side === before.side,
      });
      await pages[1].waitForFunction(
        (tick: number) =>
          (window as any).__ONLINE_DEBUG__?.latest().tick > tick,
        pausedTick,
      );
      await pages[0].screenshot({
        path: resolve(evidence, 'online-reconnected.png'),
        fullPage: true,
      });
      const duplicate = await contexts[0].newPage();
      pages.push(duplicate);
      await duplicate.goto(fixture.httpUrl + '/game?debug=1');
      await duplicate
        .getByTestId('online-status')
        .filter({ hasText: /이미|기존|연결이 끊/ })
        .waitFor();
      await duplicate.waitForFunction(() =>
        (window as any).__LIFECYCLE_TRANSPORT__
          .read()
          .history.some(
            (event: any) => event.category === 'active-session-conflict',
          ),
      );
      Object.assign(report, {
        duplicateTransport: await duplicate.evaluate(() =>
          (window as any).__LIFECYCLE_TRANSPORT__.read(),
        ),
      });
      expect(
        await duplicate.evaluate(() => !!(window as any).__ONLINE_DEBUG__),
      ).toBe(false);
      const current = await pages[0].evaluate(() =>
        (window as any).__ONLINE_DEBUG__.identity(),
      );
      expect(current).toEqual(after);
      await duplicate.close();
      await pages[0].getByTestId('online-menu').click();
      await pages[1].getByTestId('online-result').waitFor();
      expect(errors).toEqual([]);
      Object.assign(report, {
        status: 'PASS',
        pausedTick,
        stillPausedTick,
        newGeneration: after.generation > before.generation,
        sameMatch: after.matchId === before.matchId,
        activeTabRetained: true,
        explicitForfeitEndedPeer: true,
        pageErrors: errors,
      });
    } catch (error) {
      Object.assign(report, {
        failure: error instanceof Error ? error.name : 'UnknownError',
      });
      throw error;
    } finally {
      blockNewConnections = false;
      const diagnostics = [];
      for (const page of pages) {
        if (page.isClosed()) {
          diagnostics.push({ closed: true });
          continue;
        }
        try {
          diagnostics.push(
            await page.evaluate(() => {
              const debug = (window as any).__ONLINE_DEBUG__;
              const latest = debug?.latest(),
                identity = debug?.identity();
              const status =
                document.querySelector('[data-testid=online-status]')
                  ?.textContent || '';
              return {
                path: location.pathname,
                phase: latest?.phase ?? null,
                tick: latest?.tick ?? null,
                generation: identity?.generation ?? null,
                side: identity?.side ?? null,
                paused: status.includes('일시정지'),
                conflict: status.includes('이미 연결된'),
                disconnected: status.includes('연결이 끊'),
                resultVisible: !!document.querySelector(
                  '[data-testid=online-result]',
                ),
                transport:
                  (window as any).__LIFECYCLE_TRANSPORT__?.read() ?? null,
              };
            }),
          );
        } catch {
          diagnostics.push({ diagnosticUnavailable: true });
        }
      }
      Object.assign(report, { diagnostics, pageErrors: errors });
      writeFileSync(
        resolve(evidence, 'p4-online-lifecycle-browser.json'),
        JSON.stringify(report, null, 2),
      );
    }
  });
});
