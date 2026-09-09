// Exercises the installed Vue CLI option assembly and webpack URL generator.
// Compilation, port selection and the observed LAN address are deterministic
// test doubles. No server starts, sockets connect, or files are generated.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const frontend = path.resolve(__dirname, '../frontend');
const frontendRequire = createRequire(path.join(frontend, 'package.json'));

function evaluateCommonJS(file, mocks, env) {
  const module = { exports: {} };
  const realRequire = createRequire(file);
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module, exports: module.exports, __dirname: path.dirname(file),
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : realRequire(name),
    process: { env }, console,
  }, { filename: file });
  return module.exports;
}

async function resolveInstalledHmr({ origin, override, lan = '172.18.0.3' }) {
  const env = { NODE_ENV: 'development', VUE_CLI_TEST: 'true' };
  if (override !== undefined) env.VUE_APP_DEV_WEBSOCKET_URL = override;
  const project = evaluateCommonJS(path.join(frontend, 'vue.config.js'), {
    '@vue/cli-service': { defineConfig: value => value },
  }, env);
  const stop = new Error('Capture options before starting compiler/server');
  let command, captured;
  const compiler = { options: {}, hooks: { failed: { tap() {} } }, getInfrastructureLogger: () => console };
  const options = { publicPath: '/', outputDir: 'dist', ...project };
  const install = evaluateCommonJS(frontendRequire.resolve('@vue/cli-service/lib/commands/serve.js'), {
    '@vue/cli-shared-utils': { info() {}, error() {}, chalk: {} },
    fs: { existsSync: () => false },
    webpack: () => compiler,
    'webpack-dev-server': class { constructor(value) { captured = value; throw stop; } },
    portfinder: { getPortPromise: async () => 3000 },
    '../util/prepareURLs': () => ({ lanUrlForConfig: lan, localUrlForBrowser: 'http://localhost:3000/' }),
    '../util/prepareProxy': () => undefined,
    'launch-editor-middleware': () => undefined,
    '../util/validateWebpackConfig': () => undefined,
    '../util/targets': { projectTargets: undefined },
  }, env);
  install({
    registerCommand: (_name, _help, run) => { command = run; },
    chainWebpack() {},
    resolveWebpackConfig: () => ({ plugins: [], output: {} }),
    resolve: value => path.resolve(frontend, value),
  }, options);
  try { await command({ _: [], host: '0.0.0.0', port: 3000 }); }
  catch (error) { if (error !== stop) throw error; }
  if (!captured) throw new Error('Installed CLI did not construct dev-server options');
  const Server = frontendRequire('webpack-dev-server');
  // URL normalization needs only these data options. Copy them into this realm;
  // schema-utils otherwise rejects the unused VM-created middleware function.
  const urlOptions = JSON.parse(JSON.stringify({
    client: captured.client, allowedHosts: captured.allowedHosts,
    host: captured.host, port: captured.port, server: captured.server, static: false,
  }));
  const server = new Server(urlOptions, compiler);
  await server.normalizeOptions();
  const file = frontendRequire.resolve('webpack-dev-server/client/utils/createSocketURL.js');
  const source = fs.readFileSync(file, 'utf8').replace('export default createSocketURL;', 'globalThis.resolveSocket = createSocketURL;');
  const context = { self: { location: new URL(origin) } };
  vm.runInNewContext(source, context, { filename: file });
  return {
    url: context.resolveSocket(server.options.client.webSocketURL),
    configured: project.devServer.client?.webSocketURL,
    allowedHosts: Array.from(project.devServer.allowedHosts),
  };
}

module.exports = { resolveInstalledHmr };
