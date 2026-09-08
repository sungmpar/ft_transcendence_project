import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { Match } from '../src/user/entity/match.entity';
import { OnlineFixture, startOnlineFixture, waitForFixture } from './online-fixture';

// Reuse the installed browser automation runtime; a fresh browser profile is created.
// Tokens live only in test memory and the two temporary browser contexts.
const playwrightModule = process.env.ARCADE_PLAYWRIGHT_MODULE ||
  '/opt/miniconda3/lib/python3.12/site-packages/playwright/driver/package';
const { chromium } = require(playwrightModule);
const evidence = process.env.ARCADE_EVIDENCE_DIR
  ? resolve(process.env.ARCADE_EVIDENCE_DIR)
  : resolve(__dirname, '../../docs/home-online-polish/evidence');
mkdirSync(evidence, { recursive: true });

describe('two real browser clients with actual HTTP and Socket.IO authentication', () => {
  let fixture: OnlineFixture;
  let browser: any;
  let report: Record<string, unknown> | undefined;
  const contexts: any[] = [];
  beforeAll(async () => {
    fixture = await startOnlineFixture({ serveFrontend: true });
    browser = await chromium.launch({
      executablePath: process.env.ARCADE_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
    });
  }, 30000);
  afterAll(async () => {
    for (const context of contexts) await context.close();
    if (browser) await browser.close();
    if (fixture) await fixture.close();
    if (report) writeFileSync(resolve(evidence, 'p3-online-browser.json'), JSON.stringify(report, null, 2));
  }, 15000);

  it('runs a real-time authenticated match from the existing /game route and persists its result', async () => {
    const users = await Promise.all([fixture.createPlayer(), fixture.createPlayer()]);
    const pages: any[] = [];
    const errors: string[] = [];
    const external: string[] = [];
    const telemetry = [
      { receivedFrames: 0, websocketPayloadBytes: 0, lastMetrics: null as any },
      { receivedFrames: 0, websocketPayloadBytes: 0, lastMetrics: null as any },
    ];
    for (let index = 0; index < 2; index++) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
      contexts.push(context);
      await context.addInitScript((credential: string) => localStorage.setItem('token', credential),
        fixture.browserCredential(users[index]));
      await context.route('**/*', (route: any) => {
        if (route.request().url().startsWith(fixture.httpUrl + '/')) route.continue();
        else { external.push(new URL(route.request().url()).pathname); route.abort(); }
      });
      const page = await context.newPage();
      page.on('pageerror', (error: Error) => errors.push(error.message));
      page.on('websocket', (socket: any) => socket.on('framereceived', ({ payload }: any) => {
        telemetry[index].receivedFrames++;
        telemetry[index].websocketPayloadBytes += Buffer.byteLength(payload);
      }));
      await page.goto(fixture.httpUrl + '/game?debug=1');
      await page.getByTestId('online-play').waitFor();
      pages.push(page);
    }
    const startTime = Date.now();
    await Promise.all(pages.map((page) => page.getByTestId('online-play').click()));
    await Promise.all(pages.map((page) => page.waitForFunction(() => !!(window as any).__ONLINE_DEBUG__)));
    await Promise.all(pages.map((page) => page.getByTestId('online-court').click()));
    await Promise.all(pages.map((page) => page.keyboard.down('ArrowUp')));
    let lastTick = 0;
    for (let sample = 0; sample < 900; sample++) {
      for (let index = 0; index < 2; index++) {
        const data = await pages[index].evaluate(() => {
          const debug = (window as any).__ONLINE_DEBUG__;
          return debug ? { state: debug.latest(), metrics: debug.metrics() } : null;
        });
        if (data) {
          lastTick = Math.max(lastTick, data.state.tick);
          telemetry[index].lastMetrics = data.metrics;
        }
      }
      if (await pages[0].getByTestId('online-result').isVisible() &&
        await pages[1].getByTestId('online-result').isVisible()) break;
      await new Promise((done) => setTimeout(done, 100));
    }
    await Promise.all(pages.map((page) => page.keyboard.up('ArrowUp')));
    await Promise.all(pages.map((page) => page.getByTestId('online-result').waitFor({ timeout: 1000 })));
    const stored = await waitForFixture(() => fixture.dataSource.getRepository(Match).find(),
      (matches) => matches.some((match) => match.winnerScore === 6));
    const match = stored.find((value) => value.winnerScore === 6);
    expect(match).toBeDefined();
    expect(lastTick).toBeGreaterThan(120);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    for (let index = 0; index < 2; index++) {
      expect(telemetry[index].receivedFrames).toBeGreaterThan(20);
      await pages[index].screenshot({ path: resolve(evidence, `online-browser-${index + 1}-finished.png`), fullPage: true });
    }
    await Promise.all(pages.map((page) => page.getByTestId('online-rematch').click()));
    await Promise.all(pages.map((page) => page.waitForFunction(() => {
      const debug = (window as any).__ONLINE_DEBUG__;
      return debug && debug.latest().tick > 5 && debug.latest().tick < 120;
    })));
    await pages[0].getByTestId('online-menu').click();
    await pages[0].waitForFunction(() => !(window as any).__ONLINE_DEBUG__);
    report = {
      status: 'PASS', browser: browser.version(), clock: 'real browser/server wall clock',
      input: 'synthetic held keyboard input; no game-state injection', durationMs: Date.now() - startTime,
      lastObservedTick: lastTick, score: [match.winnerScore, match.loserScore],
      rematchStarted: true, menuDisposed: true,
      telemetry, errors, externalRequests: external,
      bytesDefinition: 'Received WebSocket payload bytes including Socket.IO framing, not TCP/TLS or total network bandwidth',
    };
  }, 115000);
});
