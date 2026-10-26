/* Explicit one-time bootstrap. Never called when the application starts. */
'use strict';
const { Client } = require('pg');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
async function main() {
  const project = process.env.NEON_PROJECT_ID;
  const url = new URL(process.env.DATABASE_URL || '');
  if (!project || !url.hostname.endsWith('.neon.tech') || process.env.VERCEL_ENV === 'production') throw new Error('An isolated Neon Preview target is required');
  const apply = process.argv.includes('--apply');
  if (apply && process.env.CONFIRM_PREVIEW_DATABASE !== project) throw new Error('Explicit Preview project confirmation is required');
  const db = new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
  await db.connect();
  try {
    const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    if (!apply) { console.log(JSON.stringify({mode:'plan',existingTables:tables.rows.map(row=>row.tablename),empty:tables.rowCount===0})); return; }
    if (tables.rowCount !== 0) throw new Error('Refusing to initialize a non-empty database');
    await db.query(readFileSync(join(__dirname,'../migrations/0001-preview-schema.sql'),'utf8'));
    console.log('Isolated empty Preview schema initialized');
  } finally {await db.end();}
}
main().catch(() => {console.error('Bootstrap refused or failed. Check the explicit Preview target and empty-schema precondition. No credentials are logged.');process.exitCode=1;});
