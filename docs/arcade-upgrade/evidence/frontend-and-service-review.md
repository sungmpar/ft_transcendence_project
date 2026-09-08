# Frontend/service verification and backend/shared review

Reviewer: preflight_code agent. This agent authored the new frontend experience and view tests, so frontend review is self-review. The final backend/shared/persistence inspection is independent of those files' implementing agents. Only `sungmpar/ft_transcendence_project` was inspected or modified; branch remains main with uncommitted task changes.

## Accepted findings

- Terminal result storage failure does not establish that PostgreSQL rolled back. A COMMIT response may be lost. `OnlineResultNotice` now says the outcome/achievement persistence cannot be confirmed, and only explicit matching-room `saved` declares durable success. This correction preserves backend retry/idempotency behavior.
- Simulation abort is distinct from a decided match with storage failure. Matching-room `aborted` disposes browser input/rendering, displays no winner, and allows menu/rematch; old/foreign status is ignored. The three views unregister their named handlers and guard already queued callbacks after unmount.
- Game history formerly dereferenced null `winner.nickname` for a stored unfinished row. The backend review agent reproduced this and added the minimal completed-row filter in MatchService.getAll. Our real HTTP service test subsequently verified `/user/match` returns 200 while a new unfinished fixture match exists. The suspected ManyToMany query issue was not independently established and is not reported as a confirmed failure.
- Online waiting copy now accurately states the existing rule: Power is active when both matching requests select it. Player-facing headers no longer display server implementation wording. Korean result headings preserve words and use a shorter defeat phrase.

## Backend/shared boundaries checked from current source

- Match rows use PostgreSQL-generated IDs before room publication. Awaiting publication reserves both users, checks socket ownership again after persistence, and only cleans up the unpublished row this attempt created.
- Input authority is bound to authenticated socket, room, side and generation. DTOs reject extra fields, old sequences and unreasonable jumps. Input action IDs are one-shot edges; held movement expires after 350ms. ACK advances only after a successful shared simulation step.
- Shared core imports no browser, Socket.IO, Nest, database or clock APIs. Time and RNG are supplied by adapters; the fixed clock limits each advance to 8 ticks and drops excess backlog. Collision handling explicitly documents swept face/AABB approximation rather than claiming exact circular corners.
- Reconnect grace pauses simulation and clears input, assigns fresh generations when both players return, resynchronizes spectators, and restarts time accumulation without catch-up. Explicit forfeit bypasses grace. A second active tab does not replace the owner.
- MatchService's transaction locks player rows in stable order, verifies stored participants, conditionally writes only an unfinalized match, checks an already committed duplicate result, and updates achievements atomically. The old client achievement event is inert and frontend emits were removed.
- Finalization reserves synchronously before persistence, makes at most 3 attempts, releases control after confirmed success or terminal failure, and retains bounded diagnostics. Simulation exceptions abort only the affected room and do not manufacture a winner.
- Build configuration resolves compiled shared sources from the new backend output path. Installed Nest CLI start code checks `outDir/sourceRoot/entryFile`, then `outDir/entryFile`; the configured fallback resolves `dist/backend/src/main`. Docker contexts/copy paths include shared sources. No lockfiles were modified.

No additional blocker was established by this source review after the accepted fixes. This is a bounded review of the changed paths, not a claim of an exhaustive security audit or production deployment verification.

## Executed final evidence

- `p4-online-result-release.log`: 8/8 persistence/abort notice contract tests passed, exit 0.
- `final-frontend-tsc.log`: TypeScript noEmit passed, exit 0.
- `final-online-view-eslint.log`: four online UI files plus result helper passed ESLint with max-warnings 0, exit 0.
- `final-frontend-nonfix-lint.log`: whole frontend lint fails, exit 1, with 2 unchanged baseline errors (score.ts mixed whitespace, tailwind.config.js duplicate keyframes) and 64 warnings. `git diff --exit-code` confirmed both error files and both active lockfiles unchanged. Do not present whole-project lint as passing.
- `final-service-preservation.log`: 5/5 actual PostgreSQL/HTTP/Socket.IO service tests passed, exit 0, 5.971s. Includes anonymous 401, guest flag off/on and issued-cookie authentication, profile image, nickname/friend persistence, unmet-2FA HTTP 403, two chat clients' create/join/message/history/leave with database checks, and match-history availability with an unfinished row.
- `p4-failed-history-before.log` and `p4-online-lifecycle-final.log` were produced by the backend review agent, not executed by this reviewer. Our independent HTTP confirmation is in `service-history-regression.log` and final service log.

## Fixture fidelity and limitations

The initial service smoke used the pre-existing isolated fixture without global ValidationPipe. The fixture owner then added the same `ValidationPipe({transform:true})` as production main.ts. The final 5/5 run uses that fixture, and chat create/join payloads satisfy their DTO constraints even for a public channel. This did not reproduce a production public-channel empty-password failure; such a failure is not claimed. Test data and credentials stay inside the hard-allowlisted disposable local PostgreSQL schema, which is dropped at close. Existing legacy logs containing fixture identifiers are suppressed by the test. No real OAuth, email sending, production data or deployment was used.

The backend/shared runtime remains one server process with in-memory reconnect windows and bounded failure diagnostics. Cross-process/server-restart recovery is not implemented or claimed. Physical keyboard rollover and optical input-to-photon latency are not established by automated tests. Root-owned browser screenshots, online reconnect runs and final measurement reports provide their own exact scope/results.

The latest generated frontend artifact is recorded in `final-frontend-fixture-build.log`: build exit 0 at 2026-09-07T05:57:50.159Z, hash `705af758a21aa3ca`. It was generated with `VUE_APP_ENABLE_GUEST_LOGIN=true VUE_APP_ARCADE_DEBUG=true` for the disposable manual-service fixture. No environment file was edited and nothing was deployed. Default source behavior remains controlled by the existing guest feature flag.
