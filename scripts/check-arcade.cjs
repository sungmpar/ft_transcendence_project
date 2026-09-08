// Uses the repository's pinned Jest/ts-jest; never installs or rewrites files.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const groups = {
  unit: ['core', 'local', 'snapshot', 'frontend-contract', 'online-session', 'online-result', 'arcade', 'server'],
  online: ['online', 'lifecycle', 'service'],
  browser: ['online-browser', 'online-lifecycle-browser'],
};
const group = process.argv[2] || 'unit';
if (!groups[group]) {
  console.error('Usage: node scripts/check-arcade.cjs unit|online|browser'); process.exit(2);
}
const cwd = path.resolve(__dirname, '../backend');
for (const name of groups[group]) {
  const args = ['--no-experimental-fetch', 'node_modules/jest/bin/jest.js', '--config', `test/${name}-jest.json`, '--runInBand', '--watchman=false'];
  console.log(`\n[${name}] node ${args.join(' ')} (backend cwd)`);
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`All ${groups[group].length} ${group} suites completed successfully.`);
