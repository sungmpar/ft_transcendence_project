/**
 * Manual loopback demo using existing JWT/guest HTTP and game/chat handlers.
 * Load with ts-node/register: transpile-only loses the imported UserLadder enum's
 * decorator type metadata, which PostgreSQL/TypeORM needs for User.ladder.
 */
import { resolve } from 'path';
import { startOnlineFixture } from '../backend/test/online-fixture';

async function main() {
  // This process never loads the application .env or its production DB options.
  process.env.ENABLE_GUEST_LOGIN = 'true';
  process.env.DEFAULT_IMG = resolve(__dirname, '../backend/profiles/default.jpeg');
  const fixture = await startOnlineFixture({ includeServices: true, serveFrontend: true });
  process.env.FRONT_URL = fixture.httpUrl;
  console.log(`Disposable online demo: ${fixture.httpUrl}/login`);
  console.log('Use two separate browser profiles and the existing guest login. All new accounts and matches stay in the disposable fixture schema.');
  console.log('Ctrl+C closes this server and removes only its owned test schema. No production OAuth/mail is configured.');
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await fixture.close();
  };
  process.once('SIGINT', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });
}
main().catch((error: unknown) => {
  if (error instanceof Error && error.message.startsWith('Disposable online fixture initialization failed')) {
    console.error(error.message);
  }
  console.error('Disposable demo could not start; start the dedicated test PostgreSQL instance and build the frontend first.');
  process.exitCode = 1;
});
