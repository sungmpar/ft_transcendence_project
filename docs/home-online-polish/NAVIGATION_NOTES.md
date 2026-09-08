# Navigation implementation notes

Baseline: main `2f11bee69c2d55ed938b53f9750119a890396fb7`; this Goal's changes are uncommitted. These notes describe the navigation subtask. Browser results belong to the separately executed browser reports, not to the unit tests below.

## Changes

- `frontend/src/arcade/login-intent.ts`: only exact `/game`, `/invite`, `/spectate` destinations; no arbitrary query or fragment. Session storage record contains only version, destination and timestamp. Ten-minute TTL, single use after protected user lookup, cancellation on public play/logout, malformed/future/expired values rejected. Router preserves nickname and 2FA prerequisites before returning.
- `frontend/src/arcade/auth-session.ts`: shared bounded server logout (5-second Axios timeout), then owned game/chat connection and authenticated display/cache cleanup. Concurrent calls share one attempt. Failed remote confirmation has a separate login-page message; local cleanup does not claim remote success. `openFriends()` opens the existing drawer.
- `frontend/src/router/index.ts`, `LoginView.vue`, `InfoView.vue`, `TfaView.vue`: carry the intent across the existing full document guest callback; keep 42 login disabled; successful prerequisite lookup resumes through the protected Home guard. Unknown protected-user/status errors return to login rather than constructing an unverified online socket.
- `frontend/src/components/SideBar.vue`: retains 80px width, visible names, buttons for actions, current links/focus, internal vertical scrolling for small heights.
- `frontend/src/components/friends/FriendsSlider.vue`: owned/cancelled request, distinct loading/empty/error states, retry, semantic buttons, accessible dialog controls, avatar fallback. Vue Router 4.1.3 in the lockfile and installed source preserves the existing named route params; the H08 candidate did not justify rewriting them. Browser agent separately exercises actual selection.
- `frontend/src/arcade/route-game-socket.ts`, `GameView.vue`, `InviteGameView.vue`, `SpectateView.vue`, `plugins/gamePlayService.ts`: each rendered online view obtains a distinct socket and connects only after mount. Unmount closes its captured socket; store cleanup checks that the route still owns that socket. Canvas-specific disposal prevents an old route's cleanup from destroying the next view's rendering session. Invite entry explicitly resets a previous target if no new target was passed.

## Commands actually executed

Cwd `backend`, Node `/private/tmp/ft-transcendence-runtime/node_modules/.bin/node`:

```sh
node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/navigation-jest.json --runInBand --watchman=false
node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/frontend-contract-jest.json --runInBand --watchman=false
```

Final results: **21/21 intent cases PASS**, **10/10 frontend lifecycle cases PASS** (one new old-route disposal regression). Exit 0 for both. Logs: `evidence/navigation-unit.log`, `evidence/navigation-lifecycle-unit.log`. These are synthetic storage/DOM/socket tests, not full authentication or rendered gameplay.

Cwd `frontend`:

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/typescript/bin/tsc --noEmit --pretty false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/eslint/bin/eslint.js --no-fix src/arcade/login-intent.ts src/arcade/auth-session.ts src/arcade/route-game-socket.ts src/views/LoginView.vue src/components/SideBar.vue src/components/friends/FriendsSlider.vue src/router/index.ts src/views/GameView.vue src/views/InviteGameView.vue src/views/SpectateView.vue src/plugins/gamePlayService.ts
```

Type check: exit 0 after final navigation edits. Scoped lint: exit 0, zero errors, 13 pre-existing router warnings (unused imports and explicit `any`). This does not replace the overall baseline/final lint comparison. Root `git diff --check`: exit 0.

## Intermediate failures, not baseline product failures

1. Initial new intent test before implementation: expected missing-module TS2307, 0 tests run. This is not the H06 UI reproduction; root's browser evidence provides that separately.
2. Moving the test to backend but invoking with the repository root/config mismatch produced missing Jest globals (0 tests). Config/cwd was corrected without weakening assertions.
3. Initial storage-denial test replaced Jest's VM global accessor after module reload; the module retained the VM-bound data object, so 20 passed/1 failed. The fixture now shares one explicit storage object and throws from its methods, faithfully representing denied storage operations. Production intent validation was not weakened.
4. One config preparation command used frontend cwd with a root-relative path and failed before changing that file; the subsequent type check still ran and passed. The path was corrected explicitly.

No new dependency or lockfile change, commit, push, PR, comment, deployment or production DB mutation was performed by this subtask. Browser tests and independent review are reported by their actual executors. The online recovery/clock/event features are later-phase work and are not claimed complete here.

## Additional Phase B spectator list work

`SpectateView.vue` and `components/game/SpectateSlider.vue` now show request loading, an actual empty-array result, and query failure separately. A five-second response timeout, existing socket errors, and disconnects become failure states rather than an empty list. Closing the drawer/unmounting cancels the timer; old-view callbacks remain guarded. The existing wire protocol is unchanged, so there is no new request correlation guarantee across retries; later online recovery work handles its own match/request identities. Room selection and retry/close controls are native buttons in the existing Headless UI dialog.

After these edits, frontend `tsc --noEmit --pretty false` again exited 0. Scoped `eslint --no-fix src/views/SpectateView.vue src/components/game/SpectateSlider.vue src/arcade/auth-session.ts` exited 0 with no warnings. An intermediate lint run reported two missing compiler-macro bindings; explicit Vue imports resolved them without changing lint settings. Rendered empty/failure/dialog behavior is left to the actual browser executor and is not inferred from these type/lint checks.

## Actual browser authentication prerequisites

New owned test/config: `backend/test/home-auth-prerequisites.e2e-spec.ts`, `backend/test/home-auth-prerequisites-jest.json`. No fixture helper or production authentication bypass was added. A separate fixture application created its own temporary schema on the permitted loopback test PostgreSQL database and removed it on close.

Executed from backend:

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/home-auth-prerequisites-jest.json --runInBand --watchman=false
```

- First sandbox run: fixture setup failed with `EPERM` connecting to 127.0.0.1:55432; no authentication scenario executed (`evidence/home-auth-prerequisites.log`).
- Same authorized command with local-network/browser sandbox escalation: expired JWT and 2FA passed, nickname setup failed because its native Choose button was obstructed by the 80px rail. Screenshot `auth-nickname-before-layout-fix.png` was opened and inspected. Root fixed the containing block in App, preserving the existing profile form; no force/offset click was used. Original run remains in `home-auth-prerequisites-escalated.log` and `home-auth-prerequisites-before-layout-fix.json`.
- After the rebuilt layout fix: **3/3 PASS**, exit 0, 43.238 seconds, Chrome **152.0.7977.77**, viewport **1440×900**, built app `js/app.227405da.js`. Final log: `home-auth-prerequisites-final.log`; structured results: `home-auth-prerequisites.json`.

Final packet note: the 43.238-second log and app name above describe the Phase B execution. The shared `home-auth-prerequisites.json` output alias was subsequently updated by the latest browser run (2026-09-08 04:15 UTC, app `f9b85f4e`, build991). Do not use that newer JSON as the original Phase B timestamp/build evidence. The retained Phase B log and [TEST_REPORT](TEST_REPORT.md) distinguish both successful executions.

Verified behaviors:

1. A JWT signed with the fixture's real temporary secret validates when expiry is ignored and is rejected as expired when enforced. Actual `/user/me` returned 401; the browser stayed on Login, removed its local token, and opened zero online sockets.
2. An authenticated fixture account with no nickname reached `/info` before opening any online socket. The actual profile form submitted `/user/nickname` (200), the persisted nickname changed, the browser resumed `/game`, one online socket opened, and the intent was consumed.
3. A fixture account with `need2fa=true,is2fa=false` received the real UserGuard's 403 and reached `/tfa` before opening any online socket. The existing AuthService generated an in-memory code; the actual verification form called the existing `/auth/email/verify` endpoint. The persisted verified flag became true, `/game` resumed, one socket opened, and the intent was consumed. External EmailService calls: zero.

These cases inject signed fixture credentials into browser storage to prepare authentication prerequisites. They are separate from the actual guest-provider full redirect verified by root/browser navigation. They do not claim OAuth or delivered email. Credentials, generated addresses, and verification codes are not logged or serialized. Final Login, nickname prerequisite, and resumed online lobby screenshots were all opened for visual review; the corrected Choose button is fully visible to the right of the rail. No online match is claimed from these lobby-only authentication cases.
