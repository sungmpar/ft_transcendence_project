# Vercel managed-runtime migration

## Recovery provenance
The original local Git objects after main 0ec07c8 were not available in the current runtime. All 161 deployed source files from Preview dpl_FkBVD3rPfdnvGomo847DhmmRzKvT (metadata 27b2cc1) were recovered and verified against their Vercel SHA1 digests. Recovery commit 518b395 preserves that snapshot on feat/vercel-managed-runtime. It does not pretend to be the original missing Git commit. Tests omitted from the old deployment were not all recoverable; the present executable test suite and new integration harness are the evidence source.

## Runtime
Vue and compiled NestJS are Vercel Services on the same HTTPS origin. Socket.IO uses WebSocket transport and Redis delivery. A fenced Redis lease elects the simulation authority; a 60 Hz deterministic game core remains authoritative. Checkpoints and explicit session/input generations support instance replacement. PostgreSQL result updates and achievements are transactional and idempotent. Avatars are decoded, bounded, normalized to PNG and persisted in Blob. Existing Azure files are retained for rollback/reference; Docker is not used by the Vercel runtime.

## Reproduce
Use Node 22. Run npm ci in backend and yarn install --frozen-lockfile --non-interactive in frontend. Run npm run build in each. Run NODE_ENV=test npm run test:managed in backend. The managed-integration.cjs harness requires a disposable LOCAL migration_test PostgreSQL on 127.0.0.1:55432 and Redis on 127.0.0.1:56379. It refuses a nonlocal target, starts two real backend processes, creates synthetic users, kills the elected authority and verifies the resulting row and achievements. It does not read any .env file. Run MANAGED_TEST_EVIDENCE=/path/to/evidence node test/managed-integration.cjs from backend.

## Database
Existing Preview database is already initialized. Do not run schema bootstrap on it. npm run db:bootstrap is a read-only plan by default. Applying requires --apply plus CONFIRM_PREVIEW_DATABASE equal to NEON_PROJECT_ID and an entirely empty public schema on Neon. It never runs during application startup and refuses production. No Azure data is imported. npm run verify:preview is disabled unless VERIFY_PREVIEW_DB=true; it verifies only the explicitly selected isolated Neon Preview project and uses BEGIN READ ONLY, returning bounded match IDs/scores and aggregate counts, never credentials, emails or message contents.

## Environment and authentication
Use backend/.env.example for variable names. OAuth requires CLIENT_UID, CLIENT_SEC and a provider-registered HTTPS CALLBACK ending in /auth/42/redirect. SMTP requires EMAIL_USER and EMAIL_PW (app-specific credential). These are not configured/verified merely because guest login works. Keep secrets server-only; never use a VUE_APP_ prefix for credentials. App JWT validation, 2FA checks and channel/DM membership remain enabled.

## Public launch gate
Keep Vercel Authentication on every Preview until the owner confirms the exact production URL and public scope. Prefer Standard Protection rather than disabling protection. Production needs deliberately scoped database/Redis/Blob variables and must not accidentally connect to the Azure database. Before launch review synthetic accounts/channels/matches, configure usage budgets, and verify anonymous visitors reach the app while protected API calls still return 401. No automatic promotion or main merge.

## Notion
The Content-Security-Policy permits frame ancestors only from this origin and Notion domains. Other origins are blocked. X-Frame-Options must not conflict with this allowlist. Public local/AI modes do not require app login. Login cookies remain SameSite=Lax; the UI offers a new-window login link when embedded. Browser third-party cookie/storage restrictions and the OAuth provider can still prevent embedded login. Do not weaken cookie policy or send bearer tokens in an embed URL to work around this. A browser iframe harness is not proof that a real Notion embed works; verify the existing Notion test page after the public-domain approval.

## Cost and safety
Reuse the existing ft-transcendence-preview project and its three stores. Upstash Free has a 500,000-command monthly allowance and auto-upgrade must remain off. Real-time games can consume this quickly: guest-creation limits do not limit total gameplay. Keep public concurrency/session duration modest and inspect actual usage. Vercel Sandbox is a temporary development/testing tool, NOT an application dependency; stop it after preserving a snapshot. Backend npm audit --omit=dev reports are separate from build-tool advisories. Never claim zero total cost without billing evidence.

## Azure / Git publishing
main stays at 0ec07c8. The repository contains no GitHub Actions workflows and the public workflow API returned zero runs. External Azure VM polling, Deployment Center and repository hooks could not be independently inspected with the current credentials; absence of Actions is not proof those do not exist. Do not claim an unconditional no-trigger guarantee. Keep the recovery bundle and branch local until that remaining publishing gate is satisfied; never force-push or merge main.

## API transport fallback
When a direct Git push is blocked by the unresolved Azure trigger check, the protected API build can restore a bounded source-only archive with a fixed SHA256. The transport wrapper differs from the canonical vercel.json only in install/build transport commands. Backend build preserves the same secret-scanned archive under migration-source/<sha256>.tar.gz in the already connected Blob store; a subsequent API deployment uses that durable URL. No credentials, browser state, database contents, test uploads, node_modules or Git history are included in this source archive. The application is still Vercel Services, not the temporary Sandbox.
