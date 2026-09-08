import { resolve } from 'path';
import { writeFileSync } from 'fs';
import { OnlineFixture, startOnlineFixture } from './online-fixture';
const { chromium } = require(process.env.ARCADE_PLAYWRIGHT_MODULE ||
  '/opt/miniconda3/lib/python3.12/site-packages/playwright/driver/package');
const evidence = resolve(__dirname, '../../docs/arcade-upgrade/evidence');

describe('real browser reconnect and ownership lifecycle', () => {
  let fixture: OnlineFixture;
  let browser: any;
  let report: Record<string, unknown> | undefined;
  const contexts: any[] = [];
  beforeAll(async () => {
    fixture = await startOnlineFixture({ serveFrontend: true });
    browser = await chromium.launch({ executablePath: process.env.ARCADE_CHROMIUM_EXECUTABLE ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  }, 30000);
  afterAll(async () => {
    for (const context of contexts) await context.close();
    if (browser) await browser.close();
    if (fixture) await fixture.close();
    if (report) writeFileSync(resolve(evidence, 'p4-online-lifecycle-browser.json'), JSON.stringify(report, null, 2));
  }, 15000);

  it('pauses a disconnected match, resumes full state with a new generation, and rejects another active tab', async () => {
    const users = await Promise.all([fixture.createPlayer(), fixture.createPlayer()]);
    const pages: any[] = [];
    const errors: string[] = [];
    for (const user of users) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
      contexts.push(context);
      await context.addInitScript((credential: string) => localStorage.setItem('token', credential), fixture.browserCredential(user));
      const page = await context.newPage();
      page.on('pageerror', (error: Error) => errors.push(error.message));
      await page.goto(fixture.httpUrl + '/game?debug=1');
      await page.getByTestId('online-play').waitFor(); pages.push(page);
    }
    await Promise.all(pages.map((page) => page.getByTestId('online-play').click()));
    await Promise.all(pages.map((page) => page.waitForFunction(() => !!(window as any).__ONLINE_DEBUG__?.identity)));
    const before = await pages[0].evaluate(() => (window as any).__ONLINE_DEBUG__.identity());
    await contexts[0].setOffline(true);
    await pages[1].getByTestId('online-status').filter({ hasText: '일시정지' }).waitFor();
    const pausedTick = await pages[1].evaluate(() => (window as any).__ONLINE_DEBUG__.latest().tick);
    await new Promise((done) => setTimeout(done, 200));
    const stillPausedTick = await pages[1].evaluate(() => (window as any).__ONLINE_DEBUG__.latest().tick);
    expect(stillPausedTick).toBe(pausedTick);
    await contexts[0].setOffline(false);
    await pages[0].waitForFunction((oldGeneration: number) => {
      const debug = (window as any).__ONLINE_DEBUG__;
      return debug?.identity().generation > oldGeneration;
    }, before.generation);
    const after = await pages[0].evaluate(() => (window as any).__ONLINE_DEBUG__.identity());
    expect(after.matchId).toBe(before.matchId);
    expect(after.side).toBe(before.side);
    await pages[1].waitForFunction((tick: number) => (window as any).__ONLINE_DEBUG__?.latest().tick > tick, pausedTick);
    await pages[0].screenshot({ path: resolve(evidence, 'online-reconnected.png'), fullPage: true });
    const duplicate = await contexts[0].newPage();
    await duplicate.goto(fixture.httpUrl + '/game?debug=1');
    await duplicate.getByTestId('online-status').filter({ hasText: /이미|기존|연결이 끊/ }).waitFor();
    expect(await duplicate.evaluate(() => !!(window as any).__ONLINE_DEBUG__)).toBe(false);
    const current = await pages[0].evaluate(() => (window as any).__ONLINE_DEBUG__.identity());
    expect(current).toEqual(after);
    await duplicate.close();
    await pages[0].getByTestId('online-menu').click();
    await pages[1].getByTestId('online-result').waitFor();
    expect(errors).toEqual([]);
    report = { status: 'PASS', browser: browser.version(),
      impairment: 'Playwright browser context offline/online, actual Socket.IO reconnect; no state injection',
      pausedTick, stillPausedTick, newGeneration: after.generation > before.generation,
      sameMatch: after.matchId === before.matchId, activeTabRetained: true,
      explicitForfeitEndedPeer: true, pageErrors: errors };
  });
});
