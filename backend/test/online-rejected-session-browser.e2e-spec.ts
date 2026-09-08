import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { GameService } from '../src/game/game.service';
import { startOnlineFixture, OnlineFixture } from './online-fixture';

const root = resolve(__dirname, '../..');
const evidence = process.env.ARCADE_EVIDENCE_DIR
  ? resolve(process.env.ARCADE_EVIDENCE_DIR)
  : resolve(root, 'docs/home-online-polish/evidence/rejected-session');

describe('actual server-rejected tab conflict policy and recovery', () => {
  let fixture: OnlineFixture;
  let observationTimer: ReturnType<typeof setInterval>;
  const observationPath = resolve(evidence, 'server-session-observation.json');
  const ownedEnvironment = ['ENABLE_GUEST_LOGIN', 'FRONT_URL', 'DEFAULT_IMG'];
  const previous = Object.fromEntries(
    ownedEnvironment.map((key) => [key, process.env[key]]),
  );
  beforeAll(async () => {
    mkdirSync(evidence, { recursive: true });
    process.env.ENABLE_GUEST_LOGIN = 'true';
    process.env.DEFAULT_IMG = resolve(__dirname, '../profiles/default.jpeg');
    fixture = await startOnlineFixture({
      serveFrontend: true,
      includeServices: true,
      frontendDist: process.env.ARCADE_FINAL_FRONTEND_DIST,
    });
    process.env.FRONT_URL = fixture.httpUrl;
    // Read-only test observation of real service ownership. No IDs or mutation.
    const service = fixture.app.get(GameService) as unknown as {
      sessions: Map<unknown, { generation: number }>;
    };
    let sequence = 0;
    const observe = () =>
      writeFileSync(
        observationPath,
        JSON.stringify({
          sequence: ++sequence,
          sessionCount: service.sessions.size,
          generations: [...service.sessions.values()].map(
            (session) => session.generation,
          ),
        }),
      );
    observe();
    observationTimer = setInterval(observe, 50);
  }, 30000);
  afterAll(async () => {
    clearInterval(observationTimer);
    if (fixture) await fixture.close();
    for (const key of ownedEnvironment) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }, 20000);

  it('preserves the active owner without retry churn and explicitly reconnects the rejected tab on all three online routes', async () => {
    const python = process.env.ARCADE_PYTHON || '/opt/miniconda3/bin/python';
    const args = [
      resolve(root, 'scripts/browser-online-rejected-session.py'),
      fixture.httpUrl,
      '--out',
      evidence,
      '--server-observation',
      observationPath,
    ];
    let output = '';
    const exit = await new Promise<number | null>((done, reject) => {
      const child = spawn(python, args, {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const timeout = setTimeout(() => {
        output +=
          '\nBrowser rejection regression exceeded its 210s deadline.\n';
        child.kill('SIGTERM');
      }, 210000);
      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        output += chunk.toString();
      });
      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timeout);
        done(code);
      });
    });
    writeFileSync(
      resolve(evidence, 'online-rejected-session-python.log'),
      output,
    );
    expect(exit).toBe(0);
  }, 240000);
});
