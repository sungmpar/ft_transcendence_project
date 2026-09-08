# Execution record (in progress)

All commands below ran locally on macOS with Node 18.20.8 unless an exception is stated. Runtime was installed outside the repository at `/private/tmp/ft-transcendence-runtime`; use `PATH=/private/tmp/ft-transcendence-runtime/node_modules/.bin:$PATH` for this session. Evidence is under `docs/arcade-upgrade/evidence/`. PASS does not imply human play or online integration.

## Installation / environment

| Command (cwd) | Actual result |
|---|---|
| `yarn install --frozen-lockfile --non-interactive --cache-folder /private/tmp/ft-transcendence-yarn-cache` (frontend, restricted network) | exit 1 DNS ENOTFOUND; environment failure |
| `npm ci --cache /private/tmp/ft-transcendence-npm-cache --no-audit --no-fund` (backend, restricted network) | interrupted exit 130 during unavailable DNS; not a test result |
| frontend same Yarn install with permitted network, Node 23.6.0 | exit 1: @achrinza/node-ipc supports Node through 18; environment incompatibility |
| `npm install --prefix /private/tmp/ft-transcendence-runtime --cache /private/tmp/ft-transcendence-npm-cache --no-audit --no-fund node@18.20.8` | exit 0, temporary runtime only |
| frontend frozen Yarn install with Node 18 and permitted network | exit 0; no tracked lockfile changes |
| `npm ci --cache /private/tmp/ft-transcendence-npm-cache --no-audit --no-fund --fetch-retries=0` (backend, Node 18/permitted network) | exit 0; no tracked lockfile changes |

## Baseline f970554 (production source unchanged when executed)

| Exact command (cwd) | Result / evidence |
|---|---|
| `yarn build` (frontend) | PASS exit 0; baseline-frontend-build.log |
| `npm run build` (backend) | PASS exit 0; baseline-backend-build.log |
| `node node_modules/eslint/bin/eslint.js src --ext .ts,.vue --no-fix` (frontend) | FAIL exit 1, existing 1 error/89 warnings; baseline-frontend-lint.log |
| `node node_modules/eslint/bin/eslint.js 'src/**/*.ts' --ignore-pattern '*spec.ts' --no-fix` (backend) | FAIL exit 1, existing 2187 errors/33 warnings; baseline-backend-lint.log |
| `npx --no-install jest --config test/arcade-jest.json --runInBand` (backend) | Environment failure exit 1: Watchman socket permission; separate environment log |
| `npx --no-install jest --config test/arcade-jest.json --runInBand --watchman=false` (backend) | 6 PASS, 7 FAIL, exit 1; baseline-backend-regressions.log |
| `node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/frontend-contract-jest.json --runInBand` (backend) | 1 PASS, 6 FAIL, exit 1; baseline-frontend-regressions.log |
| `/opt/miniconda3/bin/python scripts/browser-baseline.py` (root; static server `node scripts/serve-frontend.cjs`) | Initial restricted Chrome launch failed. Permitted isolated Chrome retry PASS exit 0: public play routes absent; /game authentication retained. baseline-browser.json and baseline-login.png. No original match played. |

No pre-existing executable test files were found; the regression suites above were added before changing their production paths. Frontend harness import/DOM fixture errors and source-map/Node18 fetch incompatibility were corrected before recording product failures; see its log. They are not counted as application bugs.

## P1

Latest upstream/issue/PR refresh before production edits: f970554, open issue and PR lists empty. Shared core/protocol follow-up: 2026-09-07T05:16:52Z, unchanged.

| Exact command (backend cwd) | Actual result |
|---|---|
| `npx --no-install jest --config test/arcade-jest.json --runInBand --watchman=false` | 10 PASS / 3 FAIL, exit 1; P1 corrected C01/C02/C07, C09/C10 pending online persistence phase. p1-backend-regressions.log |
| `node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/frontend-contract-jest.json --runInBand` | 8 PASS / 1 FAIL, exit 1; mode/dispose/opposed keys corrected, movement+Power pending online protocol. p1-frontend-regressions.log |
| `node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/core-jest.json --runInBand` | PASS exit 0, 28 tests; core physics/time and protocol/TTL/capture. p1-core-protocol.log. Initial new snapshot validator TS narrowing error was fixed and rerun; not a baseline error. |
| `node node_modules/typescript/bin/tsc --noEmit` (frontend cwd) | PASS exit 0 after P1 frontend changes |
| `git diff --check` (root) | PASS exit 0 at P1 |

P1 collision policy is explicitly radius-expanded inward paddle faces, not exact round-corner contact. Central vy=0 and starting speed 720/s are intentional new rules, not a claim that the old bias was an accidental bug. Queue non-last deletion is defensive: normal old sequential queue length <=1, no user incident demonstrated. Browser route unmount, full local match, AI, real Socket.IO, real DB and reconnect are still NOT RUN at this point.

## Independent P1 review

A separate agent inspected core/protocol code and tests without editing them. A bounded extreme-config probe (40 seeds, 200,000 calls including calls after finished) returned no invalid snapshots or vertical escape; this is not evidence of 200,000 active physics ticks. Two protocol findings were accepted: received input was prematurely called applied ACK, and a scored finished state with 0:0 was accepted. `p1-review-regressions-before.log`: 8 PASS / 2 FAIL, exit 1. After splitting receivedSeq / take / markApplied and validating scored phase consistency, `p1-review-regressions-after.log`: 10 PASS, exit 0. Caller must invoke markApplied only after stepGame succeeds. A future forfeiture outcome must have its own explicit contract; do not invent a winning score.

Exact before/after command (root): `node --no-experimental-fetch backend/node_modules/jest/bin/jest.js --config backend/test/core-jest.json --runInBand --runTestsByPath backend/src/game/protocol.spec.ts`.

Shared-source backend build: `npm run build` (backend) PASS exit 0; both `dist/backend/src/main.js` and `dist/shared/game-core.js` exist. Nest CLI entryFile/start:prod and Docker root context/mounts are adjusted for this layout. Actual Docker build remains BLOCKED (no Docker executable).

## P2 — local/AI vertical result verified

- `node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/core-jest.json --runInBand` (backend): exit0, 42 PASS including AI and independent protocol review fixes; p2-core-ai-protocol.log.
- Local runner/keyboard dedicated suite: 16 PASS, exit0; exact commands plus new-source lint and frontend noEmit checks in p2-local-verification.log.
- `VUE_APP_ARCADE_DEBUG=true yarn build` (frontend): exit0, build hash ed84e54dacb1882e, 2026-09-07T05:24:54Z. Explicit opt-in diagnostic build, not deployment. Source maps (10) contained no backend/src, TypeORM or Nest sources.
- `/opt/miniconda3/bin/python scripts/browser-check.py` (root, isolated Chrome152.0.7977.77, static loopback preview): exit0, 25 checks PASS. Synthetic keys and Playwright accelerated clock, no game-state mutation. Local finished6:0 at tick726; AI finished2:6 at tick1753. These are one controlled test trajectory, not human win rates. Backend/auth/Socket requests0, external asset requests0, page runtime errors0. Full machine-readable record p2-browser-report.json.
- Browser cases include simultaneous two-player movement, opposed neutral, pause/resume bounded clock, remap validation/application, form focus, window blur, resize state identity/DPR2, each mode six-point ending/restart, three reentries, unmounted diagnostic removal, AI delayed observation and original online auth guard. Hidden visibility and listener count restoration are additionally unit tested; do not conflate synthetic events with a physical keyboard rollover test.
- `/opt/miniconda3/bin/python scripts/browser-live-smoke.py`: exit0, live wall-clock local rally and simultaneous controls; p2-live-smoke.json. This separate check uses real browser time and still synthetic keyboard input.
- Screenshots: local-hub.png, local-live-rally.png, local-finished.png, ai-playing.png, ai-finished.png, hub-small-screen.png. No video recording or human play is claimed.
- Independent frontend review accepted and fixed malformed binding-field validation, event-callback restart generation isolation and reseeding AI on restart. Numeric debug fields are measured/computed state, not decorative claims.
- `git diff --exit-code -- frontend/yarn.lock frontend/package-lock.json backend/package-lock.json`: exit0. Existing locks unchanged. `git diff --check`: exit0.

PostgreSQL fixture preparation (outside repository dependencies): registry metadata query for nonexistent stable major16 returned E404; selected an actual available PostgreSQL14 package instead. `npm install --prefix /private/tmp/ft-transcendence-pg-runtime --cache /private/tmp/ft-transcendence-npm-cache --no-audit --no-fund @embedded-postgres/darwin-x64@14.23.0-beta.17`: exit0. Its native `postgres --version`: exit0, PostgreSQL14.23. Cluster start subsequently passed: `ARCADE_PG_BIN=/private/tmp/ft-transcendence-pg-runtime/node_modules/@embedded-postgres/darwin-x64/native/bin node scripts/test-postgres.cjs start`, exit 0. PostgreSQL14.23 bound only to127.0.0.1:55432; per-test schemas are isolated and removed by the fixture.

## P3 실제 온라인 통합 / P4 진입

2026-09-07 05:41:40 UTC: open pulls/issues 각 첫 페이지 `[]`로 열거 종료, `main` API와 `git fetch origin main` exit 0 / HEAD·origin/main `f970554de528b2fceb46aa7aa3a10d43c192b65b`, worktree 1개. 이슈 상세/PR diff는 비교 대상 없어 해당 없음. 다른 세션 부재는 단정하지 않는다. 현재 dirty는 이 Goal에서 생성한 범위이며 공유 파일 소유를 에이전트별로 분리했다. P3 실제 2-client 경기 PASS를 근거로 P4 GO.

- Node 18, backend `npx --no-install jest --config test/online-jest.json --runInBand`: exit 0, 3/3 PASS, 20.613초. 실제 Nest gateway / JWT middleware / Socket.IO 두 클라이언트 / 별도 PostgreSQL 14.23에서 정상 6점 경기 및 DB 저장(12.427초), 인증 거부, 초대·거절·관전·포기. 게임 상태 주입 없음. `evidence/p3-online-integration.log`.
- `arcade-jest.json`: exit 0, 기존 결함 13/13 PASS. `server-jest.json`: exit 0, runner·세션 11/11 PASS.
- `frontend-contract-jest.json`: 새 v1 경로에서도 기존 C03/C04/C08 9계약 유지·PASS. `online-session-jest.json`: 11 PASS/2 FAIL 재현 뒤 snapshot 소유 복사와 dispose 후 늦은 상태 콜백 guard 수정, 같은 13계약 PASS. fake DOM/clock/transport 검사이며 브라우저 플레이와 구분한다. `evidence/p3-frontend-regressions.log`.
- P3 two-browser 실행은 별도 기록 예정. P4 재접속·DB 재시도는 이 시점 미완료.


## 최종 판정과 지원 범위

**PARTIALLY_IMPLEMENTED**. 최우선 로컬/AI 구현과 자동 플레이, 실제 온라인·관전·재접속·결과 저장의 격리 검증은 완료했다. 전체 운영 bootstrap/외부 OAuth·메일/Docker/다른 브라우저/실제 사람 물리 키보드는 검증하지 못했고, 전체 lint도 통과하지 않았다. 따라서 모든 필수 환경까지 검증했다는 `IMPLEMENTED_AND_VERIFIED` 판정을 사용하지 않는다. 운영 배포 완료라는 뜻도 아니다.

| 범위 | 실제 결과 | 제한 |
|---|---|---|
| 로컬 2인 | PASS: 백엔드 요청0, 6점 종료·재시작·이탈·재진입 | 실제 키 이벤트 자동화; 사람 두 명의 물리 rollover NOT RUN |
| 규칙 기반 AI | PASS: 난이도/지연 관측/합법 입력/벽 예측/Power 재무장, 실제 브라우저 종료·재시작 | 사람 승률·난이도 재미 평가는 NOT RUN |
| 온라인 2인 | PASS: 기존 실제 guest cookie→JWT router→두 Chrome→6점→저장 확인→재매칭 | 일회성 DB·loopback; 운영 서버/WAN은 NOT RUN |
| 초대·거절·관전 | PASS: 실제 Socket.IO/DB 계약과 관전자 full state·입력 거절 | 모든 친구/관전 UI 동작의 브라우저 전수 검사는 NOT RUN |
| 재접속 | PASS: 실제 socket/Chrome offline·online, 5초 pause, 새 epoch, 활성 탭 유지, 옛 입력 거절 | 프로세스 재시작·여러 서버 복구 미구현 |
| 결과 저장 | PASS: 생성 ID, 동시/중복/상충 결과, rollback, 제한 retry, 업적 중복 방지, 미완료 전적 필터 | 영속 retry queue 없음; 최근100개 실패 진단은 메모리만 |
| 기존 서비스 | PASS: guest flag·JWT·profile/image/friends·2FA HTTP guard·실제 2-client chat/DB | 실제 42 OAuth·메일 전송 미실행; fixture 메일 adapter는 의도적으로 전송 금지 |
| build | PASS: frontend, backend, noEmit, 공통 코어 단일 소스/import 경계 | Docker CLI 없음: BLOCKED |
| lint | 새 UI/새 서버 실행부 PASS, 전체 frontend/backend FAIL | 아래 baseline·변경 범위를 구분 |

## 최종 실제 명령과 결과

기본 Node 경로는 `/private/tmp/ft-transcendence-runtime/node_modules/.bin/node`이며 `PATH`에 그 디렉터리를 앞에 둔다. 쉘 출력 리다이렉션은 해당 evidence 파일에 실제 stdout/stderr를 저장한 것이다.

| cwd | 명령 | 실제 결과 / 증거 |
|---|---|---|
| root | `node scripts/check-arcade.cjs unit` | exit0, 8개 config / 136 assertions PASS; `evidence/final-unit-check.log` |
| frontend | `VUE_APP_ENABLE_GUEST_LOGIN=true VUE_APP_ARCADE_DEBUG=true yarn build` | exit0, hash705af758a21aa3ca; `evidence/final-frontend-fixture-build.log` |
| frontend | `node node_modules/typescript/bin/tsc --noEmit` | exit0; `evidence/final-frontend-tsc.log` |
| backend | `npm run build` | exit0; `evidence/final-backend-build.log` |
| backend | `node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/online-jest.json --runInBand` | exit0,3 PASS,20.688s; `evidence/final-online-integration.log` |
| backend | `node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/lifecycle-jest.json --runInBand` | exit0,7 PASS,14.166s; `evidence/final-online-lifecycle.log` |
| backend | `node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/service-jest.json --runInBand` | exit0,5 PASS,5.971s; `evidence/final-service-preservation.log` |
| backend | `node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/online-browser-jest.json --runInBand` | exit0,1 PASS,48.805s; `evidence/p3-online-browser-command.log` |
| backend | `node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/online-lifecycle-browser-jest.json --runInBand` | exit0,1 PASS,54.003s; `evidence/p4-online-lifecycle-browser-command.log` |
| root | `ARCADE_EVIDENCE_DIR=docs/arcade-upgrade/evidence/final-local-browser /opt/miniconda3/bin/python scripts/browser-check.py` | exit0,25 checks PASS; `evidence/final-local-browser-command.log` / `final-local-browser/p2-browser-report.json` |
| root | `/opt/miniconda3/bin/python scripts/browser-guest-demo.py http://127.0.0.1:65054` | exit0, 실제 guest 로그인→6점 저장→재매칭→메뉴, 경기 이후25.594s; `evidence/final-online-guest-browser.json` |
| root | `node --no-experimental-fetch backend/node_modules/jest/bin/jest.js --config backend/test/measurement-jest.json --runInBand` | exit0,57.39s; `evidence/p5-real-socket-measurement.log` |
| root | `node backend/node_modules/ts-node/dist/bin.js --project backend/tsconfig.json scripts/measure-arcade.ts` | exit0; `evidence/p5-application-measurement.log`, 원시100runs |
| root | `git diff --check`; `git diff --exit-code -- frontend/yarn.lock frontend/package-lock.json backend/package-lock.json` | 각각exit0; lockfile 변경 없음 |

`check-arcade.cjs`는 core43/local16/snapshot16/frontend-contract9/online-session17/online-result8/legacy13/server14를 순차 실행한다. 테스트 개수는 발견한 버그 개수나 품질 점수가 아니다. 기존 baseline 실패는 앞 절의 입력과 별도 로그가 기준이다. root의 최초 aggregate 실행은 arcade config의 Watchman 접근에서 exit1이었다. 같은 script에 모든 config용 `--watchman=false`를 추가한 뒤 전체136 검사를 통과했다(`final-unit-watchman-failure.log` 보존). 테스트를 skip하거나 기대값을 약화하지 않았다.

Frontend 전체 `yarn lint --no-fix`는 exit1: 변경하지 않은 `src/plugins/score.ts` 혼합 들여쓰기와 `tailwind.config.js` 중복 keyframes, 2오류/64warnings. baseline의 src-only 범위 1오류/89warnings와 검색 범위가 다르므로 단순 증감 비교하지 않는다. 신규 화면/helper scoped lint는 exit0. Backend 전체 동일 src-only nonfix 명령은1858오류/32warnings로 exit1(기준2187/33). 대부분 기존 형식 불일치이며 수정된 legacy 파일 안의 형식도 포함한다. 오류 개수 감소를 제품 개선 성과로 삼지 않는다. 이번 전체 재작성 GameService/ServerMatchRunner/Room scoped lint는exit0. 상세는 `final-frontend-nonfix-lint.log`, `final-backend-nonfix-lint.log`, `backend-owned-nonfix-lint.log`에 있다. 무관한 legacy 전체 포맷 정리는 하지 않았다.

최종 frontend sourcemap10개 검사에서 backend/src·Nest·TypeORM 유입0, shared import는 자체 코어만 확인했다. `evidence/final-import-boundary.json`에는 JS파일 hash도 있다. backend 생산 산출물은 `backend/dist/backend/src/main.js` 및 `backend/dist/shared/game-core.js`이다. Docker context/config 검토와 실제 native build를 Docker 실행 성공이라고 부르지 않는다.

## P4/P5 실패 재현·리뷰 반영

- receivedSeq를 applied ACK로 너무 일찍 노출하고 score-finished0:0을 받는 문제: 최초FAIL→markApplied/phase 일관성 검사→PASS.
- snapshot 원본 변경이 OnlineSession.latest/완료에 새는 문제, dispose 뒤 queued 상태 콜백: 최초FAIL→소유 복사/수명 guard→PASS.
- AI가 point 중 거절된 지연 Power 요청의 latch를 유지하는 문제: 최초1FAIL→지연 관측에서 랠리 종료를 확인하면 재무장→core43/local16PASS.
- 잘못된 roomId의 상태 메시지가 UI를 바꾸는 문제: 최초1FAIL→현재 경기 ID검사→online17PASS.
- 재개 시 관전자 buffer만 오래된 clock epoch를 쓰는 문제: 리뷰 채택→관전자도 새 generation/full state→실제 Socket 검사PASS.
- simulation 예외로 한 방이 영구 busy가 되는 경로: 리뷰 채택→승패 없는 aborted/해제→다른 방 계속 진행 회귀PASS.
- 최종 저장 실패 뒤 null winner 전적 오류: 실제TypeError FAIL→완료 결과만전적노출→단위/실제HTTP PASS.
- COMMIT 후 응답 유실 가능성: 실제commit 뒤 응답 오류를 주입해 동일 결과 retry/업적1회 PASS. UI '미반영' 단정을 '반영 여부 확인 불가'로 수정했다. 실제 TCP 패킷 손실 시험은 아니다.
- 두 Chrome 최초 경기는 단언을 통과했으나 존재하지 않는 fixture-avatar HTTP stream 때문에 suite exit1. 실제 기본 프로필 이미지 파일을 사용해 같은 suite exit0으로 재실행했다. `p3-online-browser-fixture-failure.*` 보존.
- 서비스 시험 초기 EPERM은 환경 차단, supertest import/guest 접두사 기대 불일치는 테스트 작성 오류였다. 유효 DTO와 production ValidationPipe를 포함한 최종5건을 통과했다. 외부 OAuth/메일을 실행하지 않았다.
- 수동 demo `ts-node/register/transpile-only`는 string enum decorator metadata를 Object로 만들어 TypeORM 초기화 실패. production 수정 없이 typed `ts-node/register`로 바꿔 정상 HTTP200 및 실제 guest 브라우저 흐름을 통과했다.
- 측정 warm-up 마지막 tick의 부동소수 경계 오류는 정수 tick 경계로 고쳐 다시 측정했다. 실제 성능 개선이 없는60Hz 조건과 jitter 고갈도 삭제하지 않았다.

## 재현 가능한 수동 온라인 데모

기존 frontend guest 버튼을 켠 최종 build와 `test-postgres.cjs start` 후 root에서 실제 성공한 명령:

```sh
TS_NODE_PROJECT=backend/tsconfig.json node --no-experimental-fetch \
  -r ./backend/node_modules/ts-node/register \
  -r ./backend/node_modules/tsconfig-paths/register \
  scripts/serve-online-fixture.ts
```

터미널에 출력되는 loopback URL의 `/login`을 서로 다른 두 브라우저 프로필에서 열고 '게스트로 체험하기'를 누른다. 이는 기존 endpoint가 임시 DB에 계정을 만들고 JWT를 발행하는 실제 로그인이다. 각 `/game`에서 상대 찾기를 누르면 경기한다. local/AI와 달리 이 데모에는 테스트 DB가 필요하다. `/chat`, 프로필, 친구도 실제 서비스 handler를 쓰지만 외부 OAuth/메일은 없다. Ctrl+C로 서버를 종료하면 해당 스키마만 제거하고, 별도 `test-postgres.cjs stop`은 이 Goal의 클러스터만 종료한다. 로그에 인증 토큰을 출력하지 않는다.

## 시연·사람 검증·잔여 위험

최종 로컬/AI 캡처는 `evidence/final-local-browser/`, 실제 guest 온라인 종료는 `evidence/final-online-guest-finished.png`, 재접속은 `evidence/online-reconnected.png`다. 녹화 동영상은 만들지 않았다. 화면의 계정은 모두 테스트용 임시 계정이며 실제 사용자 계정을 열지 않았다.

실제 브라우저는 Chrome152.0.7977.77 한 종류다. Firefox/WebKit/Safari 및 실제 Safari라고 주장할 자료는 없다. localhost의 자동 키 입력 경기는 통과했지만 인간의 조작감/키보드 rollover/네트워크 판정 체감은 미검증이다. 먼저 사람이 두 키 세트로 Power를 함께 쓰며1경기하고, 다음에 WAN에서 같은 시간축의 표시 지연과 충돌 체감을 확인하는 것이 우선이다. 정량 한계는 MEASUREMENTS의 ±40ms jitter 고갈과 최대 반사 표시 오차다.

P5 전 live gate는2026-09-07 05:52:04UTC에 다시 확인했다. openissues/PR각[] 첫 페이지 종료, 기본main f970554 동일, gitfetch exit0. 관찰 가능한새겹침없음. commit/push/PR/comment/deployment/production DB mutation은 모두 미실행이다.


## 최종 정리

추가 실제 로컬 입력 단계 측정: `/opt/miniconda3/bin/python scripts/measure-local-input.py`, root, exit0. warm-up2회/30표본, keydown→변경된논리패들의첫RAF관측 p95 19.700ms/최대83.600ms. 광학/물리 입력 지연이 아니다. `evidence/p5-local-input-stage.log`, `measurements/local-input-stages.json`.

수동 온라인 demo는 SIGINT 종료 exit0으로 소유스키마를 정리했다. 이어 `ARCADE_PG_BIN=/private/tmp/ft-transcendence-pg-runtime/node_modules/@embedded-postgres/darwin-x64/native/bin node scripts/test-postgres.cjs stop`도 exit0. 이 Goal의 임시클러스터만종료했고원시임시파일은남겼다(`evidence/final-fixture-cleanup.log`). root와subagent의 process-session ID는공유되지않아root의직접종료시도는Unknown process id였으며, 소유agent가같은서버를정상종료했다. 서버없는정적프리뷰127.0.0.1:4173은유지했다.

문서의상대링크존재검사와evidence의JWT/개인키패턴검사는발견0. shell하드웨어sysctl질의는샌드박스권한실패여서그출력을성공한계측으로사용하지않았고, 환경정보는measurement script가실제로반환한Node/os정보를기록했다. commit/push/PR/comment/deployment 없이 main과기준HEAD를유지한다.
