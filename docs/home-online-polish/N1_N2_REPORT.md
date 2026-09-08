# N1 / N2 recovery implementation and evidence

This is the Phase C player/observer recovery handoff, before N3 clock and Phase D feedback changes. The repository is `sungmpar/ft_transcendence_project`, on the existing `main` checkout at `2f11bee69c2d55ed938b53f9750119a890396fb7` with this Goal's uncommitted changes. Root completed the read-only semantic-duplicate gates and Phase B browser prerequisites before authorizing these edits. No branch change, commit, push, GitHub write, deployment, or production DB access was performed by this executor.

## Observed causes and resulting behavior

- N1: a reconnected transport did not resolve a match whose room had already expired and been released. The browser stayed waiting for a full state forever. An authenticated, request-identified `sessionSync` ACK now returns active/waiting state, saving/retrying/saved/failed outcome, unavailable, or lookup error. Only the authenticated participant can recover player results. Existing active-tab ownership remains enforced. A saved DB row can recover a participant result after a server restart; an unfinished row cannot recreate physics.
- N2: observer disconnect removed its subscription and its own reconnect did not resubscribe. The observer now asks for the intended match's full state, receives no paddle authority, and rejects responses for an older target. Duplicate registration remains one socket entry. A completed/missing match leads to a confirmed result or a list/retry action.
- Neither the client timeout nor local score determines a winner. Recovered results display confirmed winner/loser names and scores, with the stale left/right scoreboard hidden because DB history does not preserve the original side mapping.

`sessionSync` and `matchEnded` are explicitly validated envelopes carrying request/match identity. Input, ready and snapshot remained protocol v1 during N1/N2; there was no presentation-clock field yet. Client and server must be upgraded together: scalar server `end` notifications are replaced by `matchEnded`. Client `end` remains the explicit forfeit command. An old server that does not answer recovery results in a bounded query failure and retry/lobby choices, without silently inventing compatibility or a result.

## Independent review decisions

All findings below were accepted after repository inspection and reproduction:

| Finding | Evidence and fix |
| --- | --- |
| Pending-save reconnect retained old socket bindings | `review-bindings-before.log` failed; disconnected bindings are now removed before asynchronous cleanup. Repeated saving/reconnect regression ends with zero bindings. |
| A UI timer did not bound Socket.IO ACK references | `review-raw-ack-reproduction.log` used the installed client without network and found a raw ACK/sendBuffer entry still present after 5100ms. Recovery uses the installed `.timeout(5000).emit` error-first API. A real client registry test queues eight requests, disposes the owner, advances 5001ms and observes zero ACK and sendBuffer entries. Owner cancellation suppresses late callbacks; transport entries can remain until their five-second bound. |
| Overlapping DB queries were unbounded per account | `review-db-bound-before.log` failed with eight queries. One in-flight lookup per authenticated account is now enforced: same target shares its Promise; a different target receives lookup error and can retry. The DB operation itself is not claimed to be canceled or given a new database timeout. |
| Historical spectator role bypassed participant authorization | `review-spectator-grant-before.log` had 2 FAIL / 27 PASS. Live spectating stays available under existing policy. Completed-result recovery now additionally requires an actual earlier live subscription by that authenticated account: a process-local grant lasts ten minutes and the registry holds at most 1000 grants. Missing, expired, evicted or post-restart grants produce unavailable without a history lookup. The legacy spectate history path uses the same guard and account DB bound. This is a deliberate defense-boundary tightening for the new recovery feature, separate from ordinary live spectating. |
| Recovered final view showed stale side-based scores and repeated confirmed scores | The shell now presents confirmed winner/loser score once, hides stale left/right numbers, and leaves status text to explain persistence. Root opened the captured actual result screen and confirmed no invented six-point score. |

## Verification at source handoff

Exact commands, cwd and exit codes are in `evidence/recovery-execution-record.json`. These counts are individual, non-overlapping groups; do not add earlier repeated runs to them.

| Group | Actual result |
| --- | --- |
| Final N1/N2 server service/runner regression | 30 PASS, `n2-server-grant-final.log` |
| Final client session/recovery regression | 24 PASS, `n2-client-grant-final.log` |
| Core/protocol before grant-only backend change | 45 PASS, `n2-protocol-core-final.log` |
| Isolated PostgreSQL/HTTP/Socket.IO online regression | 15 PASS across 3 configurations, `n2-online-grant-final.log` |
| Backend build | Exit 0, `n2-backend-grant-final-build.log` |
| Frontend guest/debug fixture build | Exit 0, hash `7ec1f0d3183ec242`, `n2-frontend-grant-fixture-build.log` |
| Scoped frontend/backend non-fixing lint | Exit 0 in `n2-frontend-final-scoped-lint.log` / `n2-backend-final-scoped-lint.log`; full baseline lint debt remains separate |

The earlier N1 aggregate unit run was **170 PASS across nine configurations**, not 149: navigation21 + core43 + local16 + snapshot16 + frontend-contract10 + client22 + result8 + arcade13 + server21. Root subsequently added the intentionally failing N3 clock configuration. That later configuration is not disguised as N1/N2 regression failure or included in these passing counts.

## Actual browser evidence and limits

`scripts/browser-online-recovery.py` uses real guest HTTP redirects, separate Chrome browser contexts at 1440×900, and the existing fixture's real HTTP/Socket.IO/DB path. It records no token, account identifier or socket payload. Debug state is read only; fault injection closes the real browser WebSocket and/or toggles Playwright context offline. Controlled transport closure is not a WAN/TCP fault test.

- `n1-browser-before.log`: baseline defect reproduced on fixture59707. The peer's waiting indication appeared after 29.963 seconds; the returning same page still lacked a result after its 12-second observation window.
- `n1-browser-after.log`: the first after attempt did not reach the required peer-disconnect waiting condition before timeout. It is a scenario/environment failure, not a recovery PASS.
- `n1-browser-after-controlled.log`: actual same-page expired-match result and rematch PASS on fixture63106. The confirmed score was 5:4. The measured 27.738-second recognition observation and 4.487-second wait-to-result interval use the **peer-rendered waiting indication**, not the exact server disconnect timestamp. The deterministic service tests separately establish the five-second server grace rule.
- `n2-browser-before.log`: with both players connected, observer-only reconnect remained waiting with no advancing ticks: REPRODUCED.
- `n2-browser-after.log`: observer-only reconnect PASS on fixture64424, advancing ticks, zero observer input messages and zero page errors. Root opened the actual observer and still-playing player PNGs.
- `n1-browser-recovered-score-after.log`: confirmed recovery, actual score rendering and stale-side-score suppression passed and the PNG was captured. The later ordinary mouse rematch click timed out after becoming visible/enabled/stable. This entire script has exit 1 and is not reported as fully passing. Root opened its result PNG. A separate final run uses a real mouse `click(no_wait_after=True)` followed by both clients entering the same new match and receiving new ticks; its result is recorded separately.
- `n1-browser-grant-final.log`: final N1/N2 pair on fixture65199 PASS, exit 0. Actual mouse `click(no_wait_after=True)` and both clients' same new match with advancing ticks passed, alongside same-page result recovery, confirmed score display and stale-side-score suppression. Page errors: 0. `n1-recovered-result-after-grant-final.png` was captured and opened by this executor; confirmed 0:0 forfeit scores appear once, with no arbitrary six-point result or stale side scoreboard. Peer-rendered waiting appeared after 1.549s and result 4.26s after that observation; these remain UI observations, not exact server disconnect timestamps.
- `n2-browser-grant-final.log`: observer ticks and zero inputs passed on the final grant implementation, and the observer PNG was captured and opened. The second, player screenshot timed out at 15 seconds, so the full script has exit 1. The separate retry keeps all functional assertions and permits screenshots 45 seconds; no force-click, DOM mutation, test skip or functional timeout change was used.
- `n2-browser-grant-final-retry.log`: exit 1 at the live tick advancement assertion. The observer displayed the confirmed saved-result state: the unattended match had ended during this slower run. This is not relabeled as a live resubscription PASS. The earlier final-grant run separately demonstrated advancing observer ticks and input count zero before its screenshot failure, and the earlier `n2-browser-after.log` remains a complete passing browser run. The final combined N3/D/E pair should rerun the live observer scenario; these failed executions remain available for review.

Browser assertions cover automated input and rendered state, not human physical-keyboard play, perceived latency, human audio listening, or production behavior. Database persistence failures/restart/authorization races are deterministic service and isolated integration tests; they are not mislabeled as every scenario being played through a browser. N3 timing recovery and online effects remain outside this handoff.

## Changed paths and execution

The N1/N2 implementation spans `shared/protocol.ts`; backend `game.gateway.ts`, `game.service.ts`, `user/match.service.ts`; frontend `arcade/session-recovery.ts`, `GameView.vue`, `InviteGameView.vue`, `SpectateView.vue`, and `OnlineGameShell.vue`. Regression changes include `session-recovery.spec.ts`, `online-session.spec.ts`, `protocol.spec.ts`, existing lifecycle/integration event fixtures, and `test/server-jest.json`. Root owns the Home/auth/navigation changes and N3/D were handed to another agent after this phase; inspect the final aggregate diff with those ownership boundaries in mind.

The browser executor uses the confirmed Node18 runtime under `/private/tmp/ft-transcendence-runtime/node_modules/.bin`, Python `/opt/miniconda3/bin/python` and Chrome `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` version152.0.7977.77. Actual online tests connect only to isolated PostgreSQL at `127.0.0.1:55432` through the existing disposable fixture. The final N1/N2 fixture was started with `scripts/serve-online-fixture.ts` and loaded at `http://127.0.0.1:65199`; availability is temporary, so the final root report must confirm whether that process is still running before advertising it.

Fixture cleanup update: after the root's service UI reviewer released this fixture, its owned process was stopped normally with Ctrl+C, exit 0. Port65199 is no longer advertised as running. The separate root-owned baseline fixture was untouched.
