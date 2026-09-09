// Observation only: preserve installed ws method behavior, arguments and return.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const fromFrontend = createRequire(path.join(__dirname, '../frontend/package.json'));
const fromServer = createRequire(fromFrontend.resolve('webpack-dev-server/lib/servers/WebsocketServer.js'));
const WS = fromServer('ws');
const file = path.join(process.env.COMPAT_HMR_EVIDENCE_DIR, 'server-websocket-trace.jsonl');
const identities = new WeakMap();
let sequence = 0;
function write(socket, event, detail = {}) {
  fs.appendFileSync(file, JSON.stringify({ at: Date.now(), connection: identities.get(socket), event, ...detail }) + '\n');
}
const emit = WS.Server.prototype.emit;
WS.Server.prototype.emit = function (event, ...args) {
  if (event === 'connection') {
    const socket = args[0];
    identities.set(socket, ++sequence);
    write(socket, 'connection', { path: (args[1]?.url || '').split('?')[0] });
    socket.on('pong', () => write(socket, 'pong'));
    socket.on('close', code => write(socket, 'close', { code }));
    socket.on('error', error => write(socket, 'error', { code: error.code || 'unavailable' }));
  }
  return Reflect.apply(emit, this, [event, ...args]);
};
for (const method of ['ping', 'terminate']) {
  const original = WS.prototype[method];
  WS.prototype[method] = function (...args) {
    if (identities.has(this)) write(this, method, { alive: this.isAlive, readyState: this.readyState });
    return Reflect.apply(original, this, args);
  };
}
