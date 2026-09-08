// Browser-platform probe only: two disposable loopback HTTP origins, no app DB,
// JWT, application authentication or production source changes.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/opt/miniconda3/lib/python3.12/site-packages/playwright/driver/package');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => server.close(resolve));

async function main() {
  const counters = new Map();
  let frontendOrigin;
  let activeScenario;
  const callbackRequests = [];
  const frontend = http.createServer((request, response) => {
    const url = new URL(request.url, frontendOrigin);
    const callback = url.pathname === '/login' && url.searchParams.get('token') === 'check';
    if (callback) callbackRequests.push({ scenario: activeScenario, originHeader: request.headers.origin || null,
      mode: request.headers['sec-fetch-mode'] || null });
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end(`<html><body><p>${callback ? 'callback document' : 'login document'}</p><a href="/play/ai">AI</a></body></html>`);
  });
  frontendOrigin = await listen(frontend);
  const backend = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const scenario = url.searchParams.get('case');
    counters.set(scenario, (counters.get(scenario) || 0) + 1);
    // Same broad default header as main.ts's current cors:true. The proposal
    // narrows credential permission on this one response to configured FRONT_URL.
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (scenario.startsWith('exact-') && request.headers.origin === frontendOrigin) {
      response.setHeader('Access-Control-Allow-Origin', frontendOrigin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Vary', 'Origin');
    }
    if (scenario.endsWith('-503')) {
      response.writeHead(503, { 'Content-Type': 'text/plain' });
      response.end('Isolated service failure');
      return;
    }
    response.setHeader('Set-Cookie', 'guest_cors_probe=opaque_fixture_value; Path=/; SameSite=Lax');
    response.writeHead(302, { Location: frontendOrigin + '/login?token=check' });
    response.end();
  });
  const backendOrigin = await listen(backend);
  let browser;
  const report = { scope: 'Two real same-host/different-port browser origins; platform probe, not application login',
    frontendOrigin, backendOrigin, cases: [] };
  try {
    browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    report.browser = browser.version();
    for (const scenario of ['wildcard-follow', 'wildcard-manual', 'exact-follow', 'exact-manual', 'exact-manual-503']) {
      activeScenario = scenario;
      const context = await browser.newContext();
      const page = await context.newPage();
      await context.route('**/*', route => {
        const origin = new URL(route.request().url()).origin;
        return origin === frontendOrigin || origin === backendOrigin ? route.continue() : route.abort();
      });
      await page.goto(frontendOrigin + '/login');
      const observation = await page.evaluate(async ({ backendOrigin, scenario }) => {
        try {
          const response = await fetch(backendOrigin + '/auth/guest?case=' + scenario, {
            credentials: 'include', redirect: scenario.includes('manual') ? 'manual' : 'follow',
          });
          return { outcome: 'resolved', status: response.status, type: response.type,
            callbackURLReadable: response.url.endsWith('/login?token=check'),
            cookieInstalled: document.cookie.split(';').some(value => value.trim().startsWith('guest_cors_probe=')) };
        } catch (error) {
          return { outcome: 'rejected', errorType: error.name,
            cookieInstalled: document.cookie.split(';').some(value => value.trim().startsWith('guest_cors_probe=')) };
        }
      }, { backendOrigin, scenario });
      if (scenario === 'exact-manual' && observation.type === 'opaqueredirect') {
        await page.evaluate(() => document.location.assign('/login?token=check'));
        await page.waitForURL('**/login?token=check');
        observation.nativeCallbackDocumentLoaded = await page.locator('p').innerText() === 'callback document';
      }
      report.cases.push({ scenario, ...observation, guestRequests: counters.get(scenario) || 0 });
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await close(backend);
    await close(frontend);
    report.finishedAt = new Date().toISOString();
    report.callbackRequests = callbackRequests;
    const output = path.resolve(__dirname, '../docs/home-online-polish/evidence/guest-cors-platform-probe.json');
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
}
main().catch(() => { console.error('Guest CORS platform probe failed; inspect the isolated report'); process.exitCode = 1; });
