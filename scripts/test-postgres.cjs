// Optional native PostgreSQL fixture runner. It never reads application .env.
// Install a platform binary under /tmp, then set ARCADE_PG_BIN to native/bin.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('../backend/node_modules/pg');
const control = path.join(os.tmpdir(), 'ft-transcendence-arcade-pg.json');
const command = process.argv[2];
const bin = process.env.ARCADE_PG_BIN;
if (!bin || !['start', 'stop', 'status'].includes(command)) {
  console.error('Usage: ARCADE_PG_BIN=/temporary/path/native/bin node scripts/test-postgres.cjs start|stop|status');
  process.exit(1);
}
function run(tool, args) {
  const result = spawnSync(path.join(bin, tool), args, { encoding: 'utf8' });
  if (result.status !== 0) {
    // Do not print paths, account metadata, or connection settings from native tools.
    throw new Error(`${tool} failed (exit ${result.status}); temporary cluster was not reported as ready.`);
  }
}
function owned(data) {
  return typeof data.dir === 'string' && data.port === 55432 &&
    data.dir.startsWith(path.join(os.tmpdir(), 'ft-transcendence-arcade-db-')) &&
    fs.existsSync(path.join(data.dir, '.arcade-test-only'));
}
(async () => {
  if (command === 'status') {
    console.log(fs.existsSync(control) ? 'Fixture control record exists (not a health check).' : 'No fixture control record.');
    return;
  }
  if (command === 'stop') {
    if (!fs.existsSync(control)) { console.log('No owned fixture to stop.'); return; }
    const state = JSON.parse(fs.readFileSync(control, 'utf8'));
    if (!owned(state)) throw new Error('Refusing to stop an unrecognized cluster.');
    run('pg_ctl', ['-D', path.join(state.dir, 'data'), '-m', 'fast', '-w', 'stop']);
    fs.unlinkSync(control);
    console.log('Stopped only this task’s temporary PostgreSQL cluster; files retained in temporary storage.');
    return;
  }
  if (fs.existsSync(control)) throw new Error('A fixture control record already exists; stop it before starting another.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-transcendence-arcade-db-'));
  fs.writeFileSync(path.join(dir, '.arcade-test-only'), 'Local disposable arcade test data only\n');
  run('initdb', ['-D', path.join(dir, 'data'), '-U', 'arcade_fixture', '-A', 'trust', '--no-locale', '-E', 'UTF8']);
  run('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'server.log'), '-o', '-h 127.0.0.1 -p 55432 -k ' + dir, '-w', 'start']);
  fs.writeFileSync(control, JSON.stringify({ dir, port: 55432 }));
  const client = new Client({ host: '127.0.0.1', port: 55432, database: 'postgres', user: 'arcade_fixture' });
  try {
    await client.connect();
    await client.query('CREATE DATABASE arcade_fixture');
    const result = await client.query('SHOW server_version');
    console.log(`Temporary PostgreSQL ${result.rows[0].server_version} ready on loopback port 55432.`);
  } finally { await client.end(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
