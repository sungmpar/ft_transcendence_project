// Uses the repository's pinned Jest/ts-jest; never installs or rewrites files.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const groups = {
  unit: ['navigation', 'clock-recovery', 'feedback', 'core', 'local', 'snapshot', 'frontend-contract', 'online-session', 'online-result', 'arcade', 'server'],
  online: ['online', 'lifecycle', 'service'],
  browser: ['online-rejected-session-browser', 'home-guest-entry', 'home-auth-prerequisites', 'online-browser', 'online-lifecycle-browser', 'online-final-browser'],
};
const group = process.argv[2] || 'unit';
const root = path.resolve(__dirname, '..');
if (group === 'home' || group === 'local-browser') {
  const python = process.env.ARCADE_PYTHON || 'python3';
  const env = { ...process.env, ARCADE_EVIDENCE_DIR: process.env.ARCADE_EVIDENCE_DIR || path.join(root, 'docs/home-online-polish/evidence', group) };
  let commands;
  if (group === 'home') {
    let origin;
    try { origin = new URL(process.env.ARCADE_DEMO_URL); } catch { /* Report below. */ }
    if (!origin || origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || origin.username || origin.password) {
      console.error('home requires ARCADE_DEMO_URL=http://127.0.0.1:<owned-fixture-port>. Start the disposable fixture first.');
      process.exit(2);
    }
    commands = [
      ['scripts/browser-home-visual.py', origin.origin],
      ['scripts/browser-home-auth.py', origin.origin],
      ['scripts/browser-home-navigation.py', origin.origin, '--phase', 'after'],
    ];
  } else {
    commands = [['scripts/browser-check.py'], ['scripts/browser-local-modes.py']];
  }
  for (const args of commands) {
    console.log(`[${group}] ${python} ${args.join(' ')} (repository cwd)`);
    const result = spawnSync(python, args, { cwd: root, env, stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
  console.log(`All ${commands.length} ${group} browser commands completed successfully.`);
  process.exit(0);
}
if (!groups[group]) {
  console.error('Usage: node scripts/check-arcade.cjs unit|online|browser|home|local-browser'); process.exit(2);
}
const cwd = path.resolve(__dirname, '../backend');
for (const name of groups[group]) {
  const args = ['--no-experimental-fetch', 'node_modules/jest/bin/jest.js', '--config', `test/${name}-jest.json`, '--runInBand', '--watchman=false'];
  console.log(`\n[${name}] node ${args.join(' ')} (backend cwd)`);
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`All ${groups[group].length} ${group} suites completed successfully.`);
