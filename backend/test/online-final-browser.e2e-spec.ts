import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { Match } from '../src/user/entity/match.entity';
import { startOnlineFixture, OnlineFixture } from './online-fixture';

const root = resolve(__dirname, '../..');
const evidence = process.env.ARCADE_EVIDENCE_DIR
  ? resolve(process.env.ARCADE_EVIDENCE_DIR)
  : resolve(root, 'docs/home-online-polish/evidence/final-online');

describe('independent final online browser scenarios', () => {
  let fixture: OnlineFixture;
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
  }, 30000);
  afterAll(async () => {
    if (fixture) await fixture.close();
    for (const key of ownedEnvironment) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }, 20000);

  it(`executes the real browser ${
    process.env.ARCADE_FINAL_CASE || 'match, observer and effects'
  } scenarios`, async () => {
    const python = process.env.ARCADE_PYTHON || '/opt/miniconda3/bin/python';
    const args = [
      resolve(root, 'scripts/browser-online-final.py'),
      fixture.httpUrl,
      '--out',
      evidence,
    ];
    if (process.env.ARCADE_FINAL_CASE)
      args.push('--case', process.env.ARCADE_FINAL_CASE);
    let output = '';
    const exit = await new Promise<number | null>((done, reject) => {
      const child = spawn(python, args, {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const timeout = setTimeout(() => {
        output += '\nBrowser harness exceeded its 300s deadline.\n';
        child.kill('SIGTERM');
      }, 300000);
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
    writeFileSync(resolve(evidence, 'online-final-python.log'), output);
    expect(exit).toBe(0);
    const matches = await fixture.dataSource.getRepository(Match).find();
    const completed = matches.filter((match) => match.winner && match.loser);
    const scored = completed.filter((match) => match.winnerScore === 6);
    if (
      !process.env.ARCADE_FINAL_CASE ||
      process.env.ARCADE_FINAL_CASE === 'match'
    )
      expect(scored.length).toBeGreaterThan(0);
    writeFileSync(
      resolve(evidence, 'online-final-persistence.json'),
      JSON.stringify(
        {
          status: 'PASS',
          source:
            'Read actual Match rows from this disposable fixture after browser completion',
          requestedCase: process.env.ARCADE_FINAL_CASE || 'all',
          completedRows: completed.length,
          sixPointRows: scored.length,
          scores: scored.map((match) => [match.winnerScore, match.loserScore]),
          note: 'No production DB, fabricated score, token or account identifier is included.',
        },
        null,
        2,
      ),
    );
  }, 360000);
});
