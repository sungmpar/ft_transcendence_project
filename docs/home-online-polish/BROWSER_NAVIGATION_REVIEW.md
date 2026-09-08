# Independent Phase B browser checks

This record belongs to the Home/online polish Goal on `main`, baseline `2f11bee69c2d55ed938b53f9750119a890396fb7`. The browser checks were implemented and executed by a separate coding agent from the agents changing Home and navigation. This is independent automated review within the same agent team, not an external human review.

All browser contexts used Chrome `152.0.7977.77`, viewport `1440 × 900`, and synthetic input. Only the owned loopback fixture was reachable. Actual guest login used the rendered button, existing cookie, full page redirect and existing authentication guard; no credential was injected or returned to the driver. Authenticated HTTP prepared disposable friendships and a 2FA prerequisite; invitation selection, refusal, acceptance and navigation used the real rendered UI.

## Executed commands and results

Working directory, except the separate build: `/Users/sm/dev_park/ft_transcendence_project`.

```sh
/opt/miniconda3/bin/python scripts/browser-home-auth.py http://127.0.0.1:59707
/opt/miniconda3/bin/python scripts/browser-home-navigation.py http://127.0.0.1:59707 --phase after
```

- Authentication/navigation suite: **exit 0, 18 checks passed**, 154.251 seconds, completed `2026-09-08T01:13:12Z`. Record: `evidence/auth-navigation-20260908T011312Z.json`.
- Final invitation/spectator/navigation suite on the Phase B build: **exit 0**, 57.745 seconds, completed `2026-09-08T01:21:07Z`. Four behavioral records are PASS; the intermediate resource snapshot is labeled OBSERVED and is followed by explicit socket/RAF/enabled assertions. Record: `evidence/after-navigation-20260908T012107Z.json`.

The 18-check suite verified three intended protected destinations after real guest redirects; external/scheme/callback/unexpected-query rejection; missing, expired and malformed intent fallback; cancel clearing; all three public paths with backend requests blocked and zero auth/socket activity; required 2FA routing without consuming the intended destination or sending mail; friend empty/error distinction and Escape focus return; and truthful local cleanup when the remote logout request returns 503.

The final invitation suite verified actual friend target delivery through the pinned router and existing wrapper, recipient refusal, re-invitation and recipient acceptance, both courts entering live game phases, sidebar invitation-to-spectator transition, real empty room-list responses, a deliberately withheld browser room-list request producing a timeout error, retry recovery, and two back/forward cycles with one online socket and zero sockets/RAF on Home. The deliberate invitation departure sent exactly one leave event. These are not claims of a complete six-point match.

The screenshot `evidence/after-friend-invite.png` was opened using the image-view tool. It shows the actual refusal state and the retained invitation target; the target is a disposable fixture nickname. No before/after H08 comparison is claimed: the attempted baseline browser run overlapped the frontend rebuild and did not establish the baseline behavior.

## Guest-disabled build

Executed from `/Users/sm/dev_park/ft_transcendence_project/frontend`:

```sh
VUE_APP_ENABLE_GUEST_LOGIN=false VUE_APP_ARCADE_DEBUG=true /private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/@vue/cli-service/bin/vue-cli-service.js build --dest /private/tmp/ft-home-guest-disabled-output
```

The separate build passed, hash `6f7483b7794b3b87`, and did not replace `frontend/dist`. A temporary static preview served only that directory at `http://127.0.0.1:61643`, with auth/user/socket endpoints unavailable. This command passed one selected check:

```sh
/opt/miniconda3/bin/python scripts/browser-home-auth.py http://127.0.0.1:59707 --disabled-base http://127.0.0.1:61643 --only Guest-disabled
```

The disabled notice was visible, the guest action was absent, and the real Login-page AI link reached the public court. No login was attempted in this check. The temporary preview was stopped after validation; its address is not currently advertised as live. Exact commands, shutdown scope and timings are in `evidence/guest-disabled-commands.json`.

## Failed attempts and limits

Initial Chrome sandbox failure, baseline attempts and a duplicate text locator failure are preserved in `evidence/navigation-initial-attempts.json`. The subsequent wrapper click timeout is preserved in `evidence/after-navigation-20260908T011737Z.json`; both invitation checks had passed before that timeout. No production wrapper change was made to make that run pass. The final run used the accessible navigation link and an explicit assertion on the real destination, and passed without a simultaneous build.

No real OAuth or external 2FA email/verification was executed. The 2FA browser check verifies the prerequisite barrier and pending intent, not completed email verification. A truly expired signed JWT and a nickname-missing callback were not prepared by this browser fixture and remain unverified here. An expired **intent TTL** is a different checked case. Loopback tests do not establish WAN resilience, production deployment, production account behavior or human audio listening.

The latest read-only live gate refresh before the server/shared phase was `2026-09-08T01:21:43Z`: upstream default `main` remained at the baseline SHA; open issue and PR collections each returned zero entries, so related issue details and PR diffs were N/A. This observation does not prove the absence of other local or private work.
