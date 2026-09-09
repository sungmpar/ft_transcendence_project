// Starts only an owned loopback Vue development server and /ws reverse proxy.
// No backend, account request, database or operational service is used.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const repositoryFrontend = path.join(root, 'frontend');
const requireFrontend = createRequire(path.join(repositoryFrontend, 'package.json'));
const evidence = process.env.COMPAT_HMR_EVIDENCE_DIR;
if (!evidence || !path.isAbsolute(evidence)) throw new Error('Set absolute COMPAT_HMR_EVIDENCE_DIR');
fs.mkdirSync(evidence, { recursive: true });
const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let child, proxyServer, proxy, stopping = false;
const sockets = new Set();
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const socket of sockets) socket.destroy();
  if (proxyServer) proxyServer.close();
  if (proxy) proxy.close();
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(5000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await stop(); process.exit(0); });
process.stdin.on('data', async data => { if (data.toString().includes('stop')) { await stop(); process.exit(0); } });
async function main() {
  // Isolate source from concurrent copy edits. Dependencies are read-only links;
  // never copy an env file, old dist or a live user's local configuration.
  const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-compat-hmr-source-'));
  const frontend = path.join(snapshotRoot, 'frontend');
  fs.mkdirSync(frontend);
  for (const item of ['src', 'public', 'package.json', 'babel.config.js', 'tailwind.config.js', 'postcss.config.js', 'tsconfig.json', 'vue.config.js']) {
    fs.cpSync(path.join(repositoryFrontend, item), path.join(frontend, item), { recursive: true });
  }
  fs.cpSync(path.join(root, 'shared'), path.join(snapshotRoot, 'shared'), { recursive: true });
  fs.symlinkSync(path.join(repositoryFrontend, 'node_modules'), path.join(frontend, 'node_modules'), 'dir');
  const sourceHashes = {};
  function hashTree(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (item.name === 'node_modules') continue;
      const file = path.join(directory, item.name);
      if (item.isDirectory()) hashTree(file);
      else if (item.isFile()) sourceHashes[path.relative(snapshotRoot, file)] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  }
  hashTree(snapshotRoot);
  fs.writeFileSync(path.join(evidence, 'source-hashes.json'), JSON.stringify(sourceHashes, null, 2));
  const reservation = http.createServer();
  const port = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  const log = fs.openSync(path.join(evidence, 'dev-server.log'), 'wx');
  const args = ['--require', path.join(root, 'scripts/compat-hmr-server-trace.cjs'), 'node_modules/@vue/cli-service/bin/vue-cli-service.js', 'serve', '--host', '127.0.0.1', '--port', String(port)];
  const env = { ...process.env, VUE_APP_DEV_WEBSOCKET_URL: '', VUE_APP_BACKEND_URL: '', VUE_APP_WS_URL: '', VUE_APP_ENABLE_GUEST_LOGIN: 'false', VUE_APP_ARCADE_DEBUG: 'false' };
  child = spawn(process.execPath, args, { cwd: frontend, env, stdio: ['ignore', log, log] });
  fs.closeSync(log);
  child.once('error', error => { console.error(error.message); });
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (child.exitCode !== null) throw new Error(`Owned dev server exited ${child.exitCode}`);
    ready = await new Promise(resolve => {
      const request = http.get(`${origin}/login`, { headers: { Accept: 'text/html' } }, response => { response.resume(); resolve(response.statusCode === 200); });
      request.on('error', () => resolve(false));
      request.setTimeout(1000, () => { request.destroy(); resolve(false); });
    });
    if (ready) break;
    await delay(1000);
  }
  if (!ready) throw new Error('Owned dev server did not become ready');
  proxy = requireFrontend('http-proxy').createProxyServer({ target: origin, ws: true, changeOrigin: false });
  proxy.on('error', (_error, _request, response) => { if (response && response.writeHead) { response.writeHead(502); response.end(); } });
  proxyServer = http.createServer((request, response) => proxy.web(request, response));
  proxyServer.on('upgrade', (request, socket, head) => {
    if (request.url.split('?')[0] !== '/ws') return socket.destroy();
    proxy.ws(request, socket, head);
  });
  proxyServer.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  const proxyPort = await listen(proxyServer);
  const metadata = {
    startedAt: new Date().toISOString(), node: process.version, frontendCwd: frontend,
    command: [process.execPath, ...args], runtimeOverrides: Object.fromEntries(Object.entries(env).filter(([key]) => ['VUE_APP_DEV_WEBSOCKET_URL', 'VUE_APP_BACKEND_URL', 'VUE_APP_WS_URL', 'VUE_APP_ENABLE_GUEST_LOGIN', 'VUE_APP_ARCADE_DEBUG'].includes(key))),
    directOrigin: origin, proxyOrigin: `http://127.0.0.1:${proxyPort}`,
    proxy: 'Owned HTTP /ws upgrade passthrough; unchanged Host; no TLS fixture or operational proxy',
    serverTrace: 'Observe-only ws ping/pong/terminate/close; original methods and return values preserved',
    source: 'Immutable temporary copy of current src/public/shared and listed build configs, dependency symlink; no env or dist copy',
    versions: { vueCli: requireFrontend('@vue/cli-service/package.json').version, webpack: requireFrontend('webpack/package.json').version, webpackDevServer: requireFrontend('webpack-dev-server/package.json').version },
  };
  fs.writeFileSync(path.join(evidence, 'fixture.json'), JSON.stringify(metadata, null, 2));
  console.log(JSON.stringify({ status: 'READY', ...metadata }));
}
main().catch(async error => { console.error(error.stack); await stop(); process.exit(1); });
