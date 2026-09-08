# Independent Home implementation review

Review target: the uncommitted Phase B implementation over `main` / `2f11bee69c2d55ed938b53f9750119a890396fb7`. The reviewer did not author the production Home, navigation or authentication changes. The reviewer did author earlier browser harnesses; those harnesses are supporting execution evidence, not an independent review of their own test implementation.

**Follow-up verdict: both reproduced P2 findings are resolved in the tested repair; no open P0/P1/P2 finding remains in this Home review scope.** The initial findings are preserved below. The original reproductions used the served Phase B build at the owned `http://127.0.0.1:59707` fixture. The repairs were independently checked using two separately compiled temporary frontends and a fresh isolated backend fixture: **8/8 tests passed, exit 0**. N1/N2 server, shared protocol and online views were being edited by another agent and remain excluded from this Home review's final implementation verdict.

## Resolved P2 — Guest service failure removes the public-play alternative

Location at review: `frontend/src/views/LoginView.vue:45`, `signinGuest` assigning `document.location.href` directly to `/auth/guest`.

Reproduction in a fresh Chrome 152.0.7977.77 context, viewport 1440 × 900:

1. Open `/login?next=/game` on the owned fixture.
2. Intercept only `/auth/guest` and return HTTP 503 with the test body `Isolated guest service unavailable`.
3. Click the real `게스트로 체험하기` button.

Observed: the browser navigates to `/auth/guest` and shows the raw failure document. The Login page had one `/play/ai` link before the click; afterwards `/play/ai` and `/play/local` links are both absent. No account was created because the fixture endpoint was intercepted before reaching the server.

This direct-redirect behavior also existed before Phase B, so it is not described as a newly introduced regression. It remains an explicit completion gap in the revised login experience: specification §4.2 requires local/AI entry to remain usable when the online server is unavailable. Keep the failed attempt on a usable Login surface, report the failure, and preserve one guest-account creation attempt and the existing authenticated callback/intent flow. Do not create a guest account merely to probe readiness and then create another on navigation.

The root implementation agent accepted this finding. The tested repair uses one bounded `redirect: 'manual'` guest request followed by the existing fixed full-document callback only for an opaque redirect. Failures stay on Login, and route unmount aborts the pending request. See the repair verification below.

## Resolved P2 — Opening the login fallback in a new tab drops a stored destination

Locations at review: `frontend/src/views/LoginView.vue:27` and `:41`, the new-tab link using only the captured `window.location.href`.

Reproduction in a fresh context:

1. Navigate directly to protected `/spectate` while anonymous. The guard redirects to `/login` and retains `/spectate` in the allowed sessionStorage intent.
2. Expand the existing login-help disclosure.
3. Click the real `새 탭에서 열기 ↗` link, which uses `rel="noopener noreferrer"`.

Observed in Chrome: the original tab shows `경기 관전 계속하기` and contains an intent. The new tab opens `/login` without a query, displays `시작하기`, and has no stored intent. This loses the selected destination through a visible login action. The primary public hub links already carry `next`, which is why this direct protected-entry case needs its own check.

The root implementation agent accepted this finding. The tested repair builds a fixed `/login` URL with only the validated destination in `next`, retaining `noopener noreferrer`. Actual guest login in the newly opened tab then returns to `/spectate`; it does not accept arbitrary return URLs or copy credentials between tabs.

## Repair constraint observed from source

The existing `backend/src/main.ts` enables default `cors: true`; it does not explicitly enable credentialed cross-origin requests. This source-based concern was subsequently reproduced with real Chrome and two disposable HTTP origins in `scripts/probe-guest-cors.cjs`. Wildcard CORS fails for credentialed guest fetches. Exact credential headers on the guest endpoint still do not make `redirect: 'follow'` sufficient: the follow-up frontend callback request arrives with `Origin: null` and is not readable as a credentialed CORS response. Exact endpoint headers plus `redirect: 'manual'` resolves as an opaque redirect, installs the cookie, and permits one ordinary full-document callback without exposing its `Location` or broadening frontend HTML CORS.

The final repair therefore scopes exact-origin credential permission to `AuthController.guestLogin`, matching the configured HTTP(S) `FRONT_URL` only, with `Vary: Origin`. Other APIs keep their existing CORS behavior. The frontend navigates to its own fixed `/login?token=check`; the existing router still validates the cookie and prerequisites. Both the platform probe and real application tests confirm the same-host/different-port case. Cross-site/subdomain cookie policies remain outside the tested scope.

## Independent repair verification — 8/8 PASS

Executed from `/Users/sm/dev_park/ft_transcendence_project`:

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch backend/node_modules/jest/bin/jest.js --config backend/test/home-guest-entry-jest.json --runInBand --watchman=false > docs/home-online-polish/evidence/home-guest-entry-command.log 2>&1
```

Actual result: **exit 0, 1 suite passed, 8 tests passed, 118.135 seconds**. The fixture report was written at `2026-09-08T01:52:15.811Z`.

| Checked behavior | Actual result |
|---|---|
| Same-origin real guest login | One guest GET, one DB account, one native callback, intended `/game` lobby |
| Split-origin real guest login | Same one-request/account/callback contract with a different frontend port |
| Same-origin and split-origin service 503 | Real service fault, zero accounts, no native callback, Login error retained, actual AI link reaches `/play/ai` |
| Fast double click | One guest GET, one account, one native callback |
| Public AI selected during pending guest work | No late callback or socket; AI remains active. The already-running server request did create one account, accurately recorded rather than described as rolled back |
| Visible new-tab fallback | `next=/spectate` survives and real guest login reaches `/spectate` |
| CORS/flag HTTP checks | Exact allowed-origin credential headers including on disabled 403; no credential permission for an untrusted origin, missing configuration or unrelated `/user/me` |

The suite uses the actual guest endpoint, cookie, JWT, user guards and rendered Vue UI against a disposable PostgreSQL schema. It injects no credentials. Only failure/latency cases replace `UserService.createGuest` behavior inside that fixture. The separate browser-platform probe uses no app DB/authentication and is not counted as a real-login test.

Test files are `backend/test/home-guest-entry.e2e-spec.ts` and `home-guest-entry-jest.json`. The test helper gained optional `frontendDist` and `cors` settings so this suite can serve two temporary Vue builds while matching `main.ts`'s default noncredential CORS. Existing fixture defaults are preserved. This suite does not write the root-owned `frontend/dist`; its tested app bundles were `app.96275d18.js` (same origin) and `app.330aaff2.js` (split origin). Its own HTTP servers and schema were closed after the run, leaving the existing 59707 and 4173 servers untouched.

Evidence: `evidence/home-guest-entry.json`, `home-guest-entry-command.log`, `guest-entry-same-origin-build.log`, `guest-entry-split-origin-build.log`, and `guest-cors-platform-probe.json`. Later changes to those source paths need appropriate targeted revalidation; these results are evidence for the tested repair rather than a blanket guarantee for all future builds.

Final packet note: the 01:52 timestamp, 118.135-second command log and app names above are the original Phase B repair execution. The shared `home-guest-entry.json` and two temporary-build log aliases were updated by later runs, most recently the 04:14 UTC execution in the final browser group. The command log above remains the Phase B result; [TEST_REPORT](TEST_REPORT.md) and `final-browser-after-connection-retry-command.log` record the newer eight-test PASS. Likewise, the prerequisite JSON mentioned below is now the latest991 execution rather than its initial Phase B snapshot. Do not combine historical timestamps with these newer aliases.

## Scope examined and conclusions

Read the diffs and relevant current source for `App.vue`, `HomeView.vue`, `LaunchPanel.vue`, `PlayHubView.vue`, `launch.css`, `arcade.css`, `SideBar.vue`, `FriendsSlider.vue`, `LoginView.vue`, `InfoView.vue`, `TfaView.vue`, `router/index.ts`, `login-intent.ts`, `auth-session.ts`, `route-game-socket.ts`, and store mutations. Read adjacent Chat, Board, UserGuard and authentication-fixture source where required to assess changed contracts.

- Home and the public hub share the mode/rule/help component. Local/AI CTA query values and displayed bindings derive from persisted preferences. The launch component does not create game loops, sockets or user requests.
- Public route handling returns before protected authentication and socket setup. `/` remains protected. The login intent is limited to three exact paths, versioned, time-bounded, single use and cleared on public entry/cancel/logout. Backend guards continue to enforce nickname/2FA prerequisites before the destination is consumed.
- The new friend drawer aborts/invalidate-checks requests on close or unmount and separates loading, empty and error states. Keyboard focus return and actual friend target/refusal/acceptance were exercised in the earlier browser suite. No router-version upgrade or speculative params rewrite is justified by that evidence.
- The service rail remains 80px and scrollable. Launch and login CSS remain scoped to the relevant surfaces. Home account disclosure provides Escape close/focus return and no unnecessary ARIA menu widget. Prior four-viewport/200% visual checks were run by the root agent; this code review does not relabel them as separately executed here.
- Logout attempts the existing server endpoint once, reports an unconfirmed server outcome separately, closes owned connections and clears the relevant cached user/chat/game state. The Phase B browser suite checked local cleanup under a 503 response. Shared/protocol/online lifecycle changes in progress are outside this review's final verdict.

Additional prerequisite evidence created by the navigation implementation agent was read: `evidence/home-auth-prerequisites.json` records three passing actual-browser fixtures for an expired signed JWT, missing nickname form completion and original 2FA verification endpoint completion, with zero external mail calls. Those fixtures intentionally inject signed test credentials and must stay distinct from the separately executed real guest full-redirect suite.

## Review execution record

The two new reproductions were executed with `/opt/miniconda3/bin/python -` using Playwright's `sync_playwright`, `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, fresh contexts and a request allowlist limited to the owned fixture. Both commands exited 0 because they recorded the observed product behavior; they were not passing assertions of the desired behavior.

Guest-failure observation:

```json
{"path":"/auth/guest","aiLinksBefore":1,"aiLinksAfter":0,"localLinksAfter":0,"body":"Isolated guest service unavailable"}
```

New-tab observation:

```json
{"sourceTitle":"경기 관전 계속하기","targetTitle":"시작하기","targetPath":"/login","targetQuery":"","sourceHasIntent":true,"targetHasIntent":false}
```

No production source, dependencies, lockfiles, Git state or external application was mutated by this reviewer. During the authorized repair verification, the reviewer additionally wrote validation code/evidence and the two optional fixture settings described above. The implementation agent authored the production fixes. No deployed backend, WAN session, real OAuth or external mail delivery is covered by this review.
