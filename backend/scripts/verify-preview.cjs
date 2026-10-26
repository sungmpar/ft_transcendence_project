/* Read-only verification; no credentials or user content are printed. */
'use strict';
const { Client } = require('pg');
const expectedProject = 'super-water-47684191';
async function main() {
  if (process.env.VERIFY_PREVIEW_DB !== 'true') return;
  if (process.env.VERCEL_ENV !== 'preview' || process.env.NEON_PROJECT_ID !== expectedProject)
    throw new Error('Refusing verification outside the explicitly isolated Preview database');
  const url = new URL(process.env.DATABASE_URL || '');
  if (!url.hostname.endsWith('.neon.tech')) throw new Error('Unexpected Preview database host');
  const ids = (process.env.VERIFY_PREVIEW_MATCH_IDS || '6,7').split(',').map(Number);
  if (!ids.length || ids.length > 20 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Invalid match id selection');
  const db = new Client({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, application_name: 'ft-preview-readonly-verification'});
  await db.connect();
  try {
    await db.query('BEGIN READ ONLY');
    await db.query("SET LOCAL statement_timeout = '5s'");
    const matches = await db.query('SELECT id, "winnerId", "loserId", "winnerScore", "loserScore" FROM "Match" WHERE id = ANY($1::int[]) ORDER BY id', [ids]);
    const counts = await db.query('SELECT count(*)::int AS total, count(*) FILTER (WHERE "winnerId" IS NOT NULL AND "loserId" IS NOT NULL)::int AS completed FROM "Match"');
    const users = await db.query('SELECT count(*)::int AS total, count(*) FILTER (WHERE email LIKE $1)::int AS guest FROM "User"', ['%@guest.local']);
    await db.query('COMMIT');
    console.log('MIGRATION_DATABASE_EVIDENCE ' + JSON.stringify({at:new Date().toISOString(),project:expectedProject,readOnly:true,matches:matches.rows,matchCounts:counts.rows[0],userCounts:users.rows[0]}));
  } finally { await db.end(); }
}
main().catch(() => { console.error('Preview database verification failed; inspect connectivity and the explicit Preview scope. No connection strings are logged.'); process.exitCode = 1; });
