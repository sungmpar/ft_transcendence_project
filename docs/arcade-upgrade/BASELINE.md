# Arcade upgrade baseline — 2026-09-07

## P0 gate: GO (implementation permission, not test success)

Target: `sungmpar/ft_transcendence_project`, local `/Users/sm/dev_park/ft_transcendence_project`.
Branch `main`, HEAD / fetched `origin/main` / `FETCH_HEAD`: `f970554de528b2fceb46aa7aa3a10d43c192b65b`.
Initial tracked and untracked status clean. Registered worktrees: this checkout only. No assumption is made about unobservable concurrent sessions. No new branch, commit, push, PR, comment, deployment, or production-data mutation is authorized or performed.

Read-only GitHub API GETs on 2026-09-07 returned default branch `main`, open issues `[]`, open PRs `[]`, and one public branch (`main`, same SHA). Collections used `per_page=100&page=1`; an empty first page terminates enumeration. Thus there are no open PR changed-file lists/diffs to compare. Related issue state/locked/assignee/comments/timeline/claimants/links: not applicable, because no issue is selected or open. Semantic scope checked: local multiplayer, AI/bot, loop/input/physics/collision/score, matchmaking/room lifecycle/reconnect/snapshot/spectator/result persistence, and backend game, match service/entity, frontend plugins/game views/router/store/shared build paths. Direct duplicate: none found. Semantic/superseding active work: none found. Ordinary adjacent existing code: guest login and viewport scale; preserve and do not claim as this contribution. Hidden local work remains unknown.

## Exact preflight commands and results

- `pwd`; `git status --short --branch`; `git remote -v`; `git worktree list`; `git log -1 --format='%H %s'`: target, clean `main`, one worktree, SHA above.
- `git diff --stat`; `git diff --cached --stat`; `git status --porcelain=v1 --untracked-files=all`: empty.
- `git symbolic-ref refs/remotes/origin/HEAD`: exit 128, local symbolic pointer absent; remote default verified independently.
- `git ls-remote --symref origin HEAD && git fetch --no-tags origin main`: restricted-network attempt exit 128 (DNS unavailable). Authorized network retry succeeded, exit 0, changed only permitted Git fetch metadata.
- `git rev-parse HEAD origin/main FETCH_HEAD`; `git rev-list --left-right --count HEAD...origin/main`: all same SHA; `0 0`.
- `git diff --exit-code`; `git diff --cached --exit-code`: exit 0 before implementation.
- `rg --files` and `git ls-files` searches for instructions, manifests, locks, configs, tests, CI, Docker: no repository CONTRIBUTING/AGENTS/CI or actual spec/test files found; backend Jest e2e configuration exists.
- Read full supplied execution specification, root/frontend/backend READMEs, both manifests, lockfile roots/resolved versions, tsconfigs, Vue/Nest configs, Dockerfiles/compose/Makefile, frontend main/App/router/store/game plugins/views, backend game and match/auth paths.
- Runtime: Node `v23.6.0`, npm `10.9.2`, Yarn `1.22.22`. Neither app has installed node_modules. Docker/docker-compose unavailable. Python Playwright CLI available; browser execution not yet verified.

## Installation and test feasibility

Frontend: existing `yarn.lock` matches its Docker installation approach; existing npm lock is stale relative to manifest. Use `yarn install --frozen-lockfile --non-interactive`; do not silently rewrite/remove locks. Backend: `npm ci` using existing package-lock. Use existing Jest/ts-jest with explicit alias mapping for backend regressions and the dependency-free shared core. Browser tests will use an available browser runtime with no production auth weakening. Build/lint/test results follow in TEST_REPORT.md. Never run backend `lint` as baseline because it includes `--fix`.

## Existing functionality and contribution boundary

Team baseline is Vue 3/TypeScript/Vue CLI and Nest 9/Socket.IO 4.5.1/PostgreSQL/TypeORM. Existing server-authoritative Pong, 42 OAuth, optional account-creating guest login, login/2FA, lobby/navigation, chat, friends/invite, spectators, profile, history/achievements remain team work; unknown individual authorship is not inferred. This task's changes are AI-assisted additions/fixes after the SHA above. Local play must bypass only explicitly public arcade routes and must not create accounts or write public history.

Current observations (not claims of user incidents): input is one string; roomMode/gameMode mismatch; y=575 lower clamp over-adjusts; IDs use count()+1 despite generated IDs; scoring/reset order and disposal need executable reproduction. Unused unsafe removal helpers are latent defects. Waiting queue normally has at most one entry, so non-last pop removal is not established as reachable in normal matching. Expanded paddle hardcoded y=400 is valid for the existing 800-high world; do not call that alone an offscreen defect.

## 최종 상태 연결

이 문서는 변경 전 시점의 기준을 보존한다. 이후 P1~P5 실행·회귀·실제 두 브라우저·PostgreSQL·측정·미검증 범위는 [TEST_REPORT](TEST_REPORT.md)의 최종 절이 기준이다. branch/HEAD는 main/f970554 그대로이고 이번 코드·검사·문서만 dirty 상태다. 의미상 중복 gate의 마지막 core-phase 확인은2026-09-07 05:52:04UTC, 같은 SHA와 빈 openissue/PR였다. 실제 변경 목록·hash·patch는 [REVIEW_PACKET](REVIEW_PACKET.md)에 있다.
