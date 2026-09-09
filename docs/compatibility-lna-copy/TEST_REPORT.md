# 접속 호환성·HMR·문구 정비 검증 기록

이 문서는 2026-09-08 UTC의 완료된 실행 기록이다. 전체 단위 실행은281 PASS, 별도 최종 URL 경계 단위 실행은51 PASS, 격리 온라인 서비스는15 PASS다. CSS 후속 빌드 `3d03e7e0daad7476`의 새 fixture 화면 시험은69/69 PASS, Home 최종 그룹은70 PASS/1 OBSERVED·exit0, local-browser 최종 그룹은56 PASS·exit0이다. 앞선 `52546caae6f959a8`의 `browser`6 configs는 **22 Jest PASS/1 FAIL, wrapper exit1**로 남긴다. 이후 최종 CSS 빌드의 관전자와 효과 개별 실행은 각각1 PASS·exit0이지만, 최초 관전자 실패의 직접 원인은 미확정이다. 부분 성공을 전체 PASS로 세지 않는다.

대상은 `sungmpar/ft_transcendence_project`, `main/ecbb0ee30694f372b8e6e51c1642ef258681443d` 위의 이번 미커밋 변경이다. 이전 Goal의 PASS는 이번 결과로 재사용하지 않았다. 이 문서 작성자는 로그·JSON·소스를 독립적으로 읽었으며 이 문서 작업에서 시험이나 Chrome을 새로 실행하지 않았다. 최초 실패를 지우지 않고 후속 실행과 구분한다.

[마지막 원격 조회](evidence/completion-remote-gate.json)는20:03:42–44 UTC에 같은 기본 브랜치 SHA·열린 issue0/PR0을 확인했다. [로컬 완료 상태](evidence/completion-local-state.json)는 같은 main/HEAD, staged 경로0, 제품15경로·검증18경로·README 변경 및 이전 증거 문서 diff0을 기록한다. 이는 검증 당시의 미커밋 결과물이며 commit·push·PR·배포 완료 기록이 아니다.

## 실행 환경과 명령 기록

- 기존 설치 Node18.20.8, Yarn1.22.22, VueCLI5.0.8, webpack-dev-server4.9.3, Jest28.0.3, Socket.IO4.5.1, Playwright1.55.0, Chrome152.0.7977.77, PostgreSQL14.23을 사용했다. 세부 preflight는 [범위 기록](BASELINE_AND_SCOPE.md)을 따른다.
- DB를 쓰는 시험은 소유한 loopback HTTP/Socket.IO와 폐기 가능한 PostgreSQL schema에서 실행했다. 운영 guest·계정·매칭·채팅·DB 변경은 하지 않았다. 화면용 before와 after는 같은 합성 리뷰 닉네임을 사용한 **서로 다른 fixture 계정**이다.
- [루트 명령 기록](evidence/root-command-record.json)은 검사 명령, cwd, 실행 결과를 담는다. 모든 읽기 도구 호출의 전사나 완전한 shell history가 아니다. `exit_code`가 없는 장기 fixture 시작 항목을 완료 성공으로 해석하지 않는다.
- P1의 정확한 별도 명령은 [P1 기록](P1_AUTH_CONTRACT.md), P2의 명령·cwd·실제 exit는 [P2 실행 JSON](evidence/p2-execution-record.json)에 있다. 임시 build 재사용·대역·초기 실패 범위도 각 기록에 명시되어 있다.

주요 루트 명령은 다음과 같다. 아래 `node`와 `yarn` 앞에는 실제로 `PATH=/private/tmp/ft-transcendence-runtime/node_modules/.bin:$PATH`가 설정됐다. 완전한 환경 변수·출력 리디렉션은 위 JSON의 해당 ID에 보존되어 있다.

| ID / cwd | 실행한 명령의 본체 | 실제 결과 |
|---|---|---|
| `baseline-unit`, repository | `node scripts/check-arcade.cjs unit` | exit0, 11 config / 233 tests |
| `compat-unit`, `after-unit`, repository | 같은 `unit` 명령, 이번 evidence 디렉터리 명시 | 각각 exit0, 13 config / 281 tests. 두 실행을 합산하지 않음 |
| `preservation-online`, repository | `node scripts/check-arcade.cjs online` | exit1, fixture connect EPERM으로 첫 config의3개 FAIL |
| `preservation-online-v2`, repository | 같은 `online` 명령, 새 evidence 폴더 | exit0, 3 config / 15 tests |
| `baseline-build`, frontend | `VUE_APP_BACKEND_URL= VUE_APP_WS_URL= VUE_APP_ENABLE_GUEST_LOGIN=true VUE_APP_ARCADE_DEBUG=true yarn build --dest /private/tmp/ft-compat-baseline-dist --report-json` | exit0 |
| `after-frontend-build`, frontend | 같은 네 env 설정으로 `yarn build --report-json` | exit0, 현재 `frontend/dist` |
| `backend-build`, backend | `yarn build` | exit0, `nest build` 완료 |
| `after-frontend-typecheck`, frontend | `node node_modules/typescript/bin/tsc --noEmit` | exit0 |
| `backend-typecheck`, backend | `node node_modules/typescript/bin/tsc --noEmit --incremental false` | exit2, 아래 기존3개 오류 |
| `final-private-boundary-unit`, backend | `node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/guest-navigation-jest.json --runInBand --watchman=false` | exit0, 2 suites / 51 tests, 별도 선택 실행 |
| `final-private-boundary-lint`, backend | `node node_modules/eslint/bin/eslint.js src/game/guest-navigation-url.spec.ts src/game/guest-redirect-controller.spec.ts --no-fix` | exit0 |
| before/after frontend lint, frontend | `node node_modules/eslint/bin/eslint.js src --ext .ts,.vue --no-fix` | 각각 exit1 |
| before/after backend lint, backend | `node node_modules/eslint/bin/eslint.js 'src/**/*.ts' --ignore-pattern '*spec.ts' --no-fix` | 각각 exit1 |

## 빌드와 정적 검사

| 대상 | 수정 전 | 수정 후 | 근거·판정 |
|---|---|---|---|
| Frontend production build | hash `99110685ef45f988`, exit0 | hash `52546caae6f959a8`, exit0 | [전](evidence/baseline-frontend-build.log) / [후](evidence/after-frontend-build.log). 둘 다 기존54 warnings를 출력했다. warnings를 숨기거나 전체 lint 성공으로 바꾸지 않음 |
| Backend production build | 이번 표의 before 생산 build 비교 없음 | exit0 | [로그](evidence/backend-build.log). Yarn cache/global-folder 경고와 실제 build 성공을 구분 |
| Frontend noEmit | P1·P3 소유 검사도 exit0 | 최종 exit0 | [최종](evidence/after-frontend-typecheck.log), [P3](evidence/P3-owned-typecheck.log). 빈 파일만 보고 판정한 것이 아니라 실행자의 exit 기록과 대조 |
| Frontend 전체 nonfix lint | 1 error / 61 warnings, exit1 | 동일, exit1 | [전](evidence/baseline-frontend-lint.log) / [후](evidence/after-frontend-lint.log). 두 파일이 byte-identical임을 읽기 비교로 확인 |
| Backend 전체 nonfix lint | 1857 errors / 32 warnings, exit1 | 동일, exit1 | [전](evidence/baseline-backend-lint.log) / [후](evidence/after-backend-lint.log). 위치를 제외한 진단은 동일하며 auth controller 줄 이동이 차이 |
| Backend 넓은 noEmit | HEAD의 격리 임시 소스에서도 같은3개 오류, exit2 | exit2, 같은3개 오류 | [HEAD 비교](evidence/baseline-backend-typecheck.log) / [현재](evidence/backend-typecheck.log). 두 출력은 byte-identical. `root-command-record.json`의 `baseline-backend-typecheck`에 실제 임시 cwd·argv·exit2가 추가되어 있음 |

넓은 backend 타입 검사의3개 오류는 `online-session.spec.ts:320`의 Jest `doNotFake` 타입 불일치, frontend `gamePlayService.ts`의 `@/store`, `store/index.ts`의 `@/interfaces/User` alias 해석 실패다. 현재 production build 성공이 이 실패를 대신 해결했다는 뜻은 아니다. baseline에 존재하는 별도 검증 경계로 남긴다.

HEAD 비교는 `git archive HEAD`에서 지정한 backend/frontend 소스·시험·tsconfig·shared를 `/private/tmp/ft-compat-type-baseline-fmasm6pz`에 추출하고 기존 node_modules만 링크했다. 실제 cwd는 그 아래 `backend`, argv는 기존 Node18, 해당 임시 디렉터리의 `node_modules/typescript/bin/tsc`, `--noEmit --incremental false`다. 현재 미커밋 파일을 baseline인 것처럼 복사한 비교가 아니다.

P1 Login/helper 소유 lint와 noEmit은 최종 exit0이다. AuthController 소유 lint는 최초 기존69+새 signature 형식1 오류를 보고했고, 해당 형식을 보완한 뒤 기존69 errors/3 warnings, exit1로 돌아왔다. P2 config lint exit0, P3 네 소유 Vue 파일 lint exit0도 각 단계 로그에 남아 있다. 전체 저장소의 실패를 소유 파일 성공으로 덮지 않는다.

후속 변경 파일 검사에서는 frontend 소유 범위 lint exit0을 확인했다. Backend 변경 범위 첫 검사177 errors/5 warnings 중 신규 두 단위 파일의 Prettier26개와 `online-result.spec.ts`의 새 줄바꿈1개를 정리했다. 새 두 파일 lint는 exit0이며 실행자 확인으로 해당 단위40 PASS를 재실행했다. [변경 범위 최초](evidence/changed-backend-lint.log)와 [후속](evidence/changed-backend-lint-final.log)은 보존한다. 후속 전체 변경 범위는 여전히150 errors/5 warnings, exit1이다: auth69, clock70, 기존 result8, `parserOptions.project`가 test 파일을 포함하지 않는 진단3이다. [HEAD 기존 경로](evidence/baseline-changed-backend-lint.log)의150 errors/5 warnings는 clock71·기존 test 제외 진단2를 포함하므로 총수만 같고 모든 진단 집합이 같다는 뜻은 아니다. 신규 형식 문제를 기존 부채로 숨기거나 tsconfig 제외 진단을 제품 타입 오류와 혼동하지 않는다.

CSS 후속 최종 소스에서도 직접 `tsc --noEmit`은 exit0 ([로그](evidence/final-frontend-tsc.log)), 변경 frontend13경로 ESLint `--no-fix`는 exit0 ([로그](evidence/final-changed-frontend-lint.log))였다. 그 직전 실행자의 `yarn typecheck`는 존재하지 않는 script 이름 때문에 exit1로 끝났고 컴파일을 시작하지 않았다. [잘못된 명령 원본](evidence/final-frontend-typecheck.log)을 보존하며 올바른 직접 tsc 실행과 구분한다.

최종 독립 리뷰에서 추가한 URL 경계 시험의 두 파일도 ESLint `--no-fix` exit0이었다([로그](evidence/final-private-boundary-lint.log), 실행자 종료 확인). 빈 로그만으로 성공을 추정하지 않았다. 이 마지막 보강은 시험만 변경했고 URL helper나 생산 코드를 변경하지 않았다.

## 단위·실제 서비스 시험

| 실행 | 실제 집계 | 근거 |
|---|---|---|
| baseline unit | 11 config, 233 PASS, exit0 | [로그](evidence/baseline-unit.log) |
| 호환성 구현 후 unit | 13 config, 281 PASS, exit0 | [로그](evidence/compat-unit-command.log) |
| P3/P4 적용 후 unit | 13 config, 281 PASS, exit0 | [로그](evidence/after-unit-command.log) |
| 최종 private 경계 보강 단위 | 2 suites, 51 PASS, exit0, 5.799초 | [로그](evidence/final-private-boundary-unit.log). 아래 별도 선택 실행이며 전체281 실행과 합산하지 않음 |
| 온라인 첫 시도 | 첫3개 FAIL, exit1; 나머지 config 미실행 | [원본](evidence/preservation-online-command.log). 격리 fixture 초기 연결 EPERM, 제품 동작까지 도달하지 못함 |
| 온라인 후속 | 3+7+5 = 15 PASS, 3 config, exit0 | [후속](evidence/preservation-online-v2-command.log) |

전체281 실행의 집계는 P1 URL/controller40 + P2 HMR8 + 기존 navigation29, clock8, feedback18, core47, local16, snapshot19, frontend contract10, online session34, result8, legacy13, server31이다. config별 Jest test 수의 합이며 같은 시험을 여러 차례 실행한 결과를 누적 성과로 합산하지 않았다.

리뷰에서 HTTPS 공개 주소→HTTP private 주소 거절 사례는 downgrade 검사와 private 대역 검사가 겹칠 수 있다는 검증 공백을 수락했다. 생산 동작을 바꾸지 않고 경계를 분리한11개 시험을 추가해 기존40개와 함께 **51개를 별도 실행**했다. 최초40개·281개 로그는 그대로 유지하며, 전체13 config를 다시 실행해292개가 통과했다고 쓰지 않는다.

실제 서비스15개는 HTTP/Socket.IO/PostgreSQL 경로에서 인증 거부, 점수로 끝나는 경기와 저장, 친구 초대·거절·관전, 동시 결과 저장/중복 방지, 끊김·새 generation·활성 탭 보호,5초 grace 만료, DB rollback/retry/저장 실패 상태, guest flag·cookie·프로필·이미지·친구·2FA guard, 두 chat client의 join/message/leave 저장, 전적 조회를 검증했다. DB 실패·응답 상실을 의도적으로 주입하는 일부 사례는 그렇게 명명된 회귀 시험이다. 이15개를 실제 Chrome 경기, WAN 대전 또는 사람이 플레이한 기록으로 부르지 않는다.

## P1 guest 계약과 P2 HMR의 실패·후속 성공

| 항목 | 최초 기록 | 후속 기록·범위 |
|---|---|---|
| P1 신규 URL 모듈 전 | TS2307, 0tests, exit1 | setup 오류, 행동 재현으로 세지 않음 |
| P1 controller / 실제 guest RED | 단위2 FAIL, 실제 document/CORS2 FAIL | [단위 RED](evidence/P1-controller-red.log) / [브라우저 RED](evidence/P1-browser-red-command.log) |
| P1 HTTPS downgrade | 1 FAIL/39 미선택 | 보완 포함40 PASS, exit0: [RED](evidence/P1-https-downgrade-red.log) / [GREEN](evidence/P1-unit-final.log) |
| P1 첫 after browser 전체 | 15 PASS/1 bfcache FAIL, exit1 | [원본](evidence/P1-browser-after-command.log). 첫 전체 실행을 PASS로 고치지 않음 |
| P1 bfcache 후속 | 첫 실패에는 원인 판별 진단 부족 | [후속](evidence/P1-bfcache-diagnostic-command.log): 1 PASS/15 미선택, exit0; 실제 `pageshow.persisted=true`, 같은 문서, 버튼 enabled. 첫 실행 원인을 소급 확정하지 않음 |
| P2 최초 단위 | VM middleware validator 오류7 FAIL/1 PASS | harness 오류로 보존. [원본](evidence/p2-hmr-red.log) |
| P2 실제 설치 URL 처리 | 의도된4 FAIL/4 PASS | 최소 fallback 후8 PASS: [RED](evidence/p2-hmr-red-url.log) / [GREEN](evidence/p2-hmr-green.log) |
| P2 최초 Chrome 연결 유지 | 여러 원본 FAIL, traced direct/proxy도 각각 FAIL | correct `/ws` URL·HTTP101·hash는 수신. 기존 WDS1초 heartbeat가 pong 미수신 뒤 terminate하여1006: [추적](evidence/p2-hmr-runtime-isolated/browser-hmr.json) |
| P2 별도 자동 재연결 | 초기 연결 생존은 둘 다 false | [eventual](evidence/p2-hmr-eventual/browser-hmr.json): direct/proxy 각각 자동retry1회·101/hash·3.070/3.048초 유지 PASS, exit0. 서버 pong과 PNG 후 열린 상태도 확인 |

P1의 bfcache 시험은 Playwright 기본 `--disable-back-forward-cache` 인자 하나를 제외하고 실제 Back/`pageshow.persisted`/같은 `timeOrigin`을 검사했다. 인위 event나 단순 Back을 bfcache 성공으로 세지 않았다. 고정 P1 빌드에서 얻은15개+별도1개의 결과를 단일16개 PASS로 합치지 않는다. 이후 `52546` 기준 전체 `home-guest-entry`16개를 새 임시 빌드로 한 번에 실행해 PASS한 기록은 아래 최종 browser 묶음에 별도로 있다.

## `52546` 브라우저 묶음의 실제 종료

[실행자 명령·종료 기록](evidence/final-browser-execution-record.json)과 [원본 로그](evidence/final-browser-command.log)를 읽었다. repository cwd에서 `env -u ARCADE_GUEST_REUSE_ROOT`와 명시 Node18/Python/evidence 환경으로 `node scripts/check-arcade.cjs browser`를 실행했다. 19:33:52–19:43:57 UTC는 시작·종료 관측 시각이며 정밀 측정한 wrapper 소요시간은 아니다. 실제 wrapper exit1,5 config PASS/1 config FAIL,22 Jest tests PASS/1 FAIL이다. 이 묶음의 frontend는 CSS 후속 전 `52546`/index `d274...`이며 뒤 CSS 빌드로 소급 바꾸지 않는다.

| config | 실제 결과 | 범위 |
|---|---|---|
| `online-rejected-session-browser` | 1 Jest PASS | 실제 game/invite/spectate 거절 탭 정책3경로 PASS |
| `home-guest-entry` | 16 PASS | 고정 옛 빌드 재사용 없이 새 same/split/flag 빌드; 실제 bfcache persisted·sameDocument·버튼 활성 포함 |
| `home-auth-prerequisites` | 3 PASS | 실제 계정 선행 절차의 별도 사례 |
| `online-browser` | 1 PASS | 기존 실제 온라인 경기 브라우저 회귀 |
| `online-lifecycle-browser` | 1 PASS | 실제 연결 수명 회귀 |
| `online-final-browser` | 1 FAIL | 내부 6점 경기·mouse rematch PASS 뒤 관전자 live generation/tick 대기20초 실패. 효과/오디오/모션/키 사례는 NOT_RUN |

마지막 시험의 [원시 JSON](evidence/final-browser/online-final-browser.json)과 [Python 로그](evidence/final-browser/online-final-python.log)를 보존했다. timeout 시 세 페이지 모두 result UI가 보였고 관전자 입력은0이었다. 새 generation/live tick 회복 실패와 경기 종료 중 어느 일이 먼저 원인을 만들었는지 기존 기록만으로 확정하지 않는다. Python 실패 뒤 마지막 fixture Match repository 검증도 실행되지 않았으므로 전체 마지막 경기의 DB 검증 성공으로 쓰지 않는다. 이전 독립 서비스15개나 첫 browser config의 성공과 구분한다.

### 최종 CSS 빌드의 별도 관전자·효과 실행

그 뒤 기존 입력·fault·단언을 유지하고 제한된 상태·실제 ready/ACK·driver 이력을 추가해 관전자와 효과를 각각 선택 실행했다. [실행자 명령·종료 기록](evidence/online-targeted-execution-record.json)의 cwd는 repository 루트이고, `ARCADE_FINAL_CASE=observer` 또는 `effects`, 각각 새 evidence 폴더, Node18/Python을 명시했다. `ARCADE_GUEST_REUSE_ROOT`와 `ARCADE_FINAL_FRONTEND_DIST`를 제거하고 기존 `online-final-browser-jest.json`을 `--runInBand --watchman=false`로 실행했다. 사용 index는 최신 CSS의 `f168717e...`, app은 `app.d972f9c7.js`다. 두 실행은 서로 다른 소유 fixture를 사용하고 각각 브라우저·fixture 정리 뒤 exit0으로 종료했다.

| 선택 실행 | 실제 결과 | 확인한 범위 |
|---|---|---|
| [관전자](evidence/observer-diagnostic/online-final-browser.json) / [로그](evidence/observer-diagnostic-command.log) | Jest1/1 PASS, exit0, 74.304초; Python62.866초 | 같은 live 경기에서 generation3→4, 실제 active ACK·ready tick1946 뒤 tick2012, 점수2:1 유지. 양쪽 기존 player 연결 유지·새 관전자 연결·PNG 후 관전자 입력0 |
| [효과](evidence/effects-targeted/online-final-browser.json) / [로그](evidence/effects-targeted-command.log) | Jest1/1 PASS, exit0, 56.869초; Python47.373초 | 실제 서버 타격/Canvas flash, native 오디오·음소거·모션 감소·키 전송·route 정리 및 설정 복원 |

관전자 진단에서 driver error는 둘 다 null이었다. native close 요청과 close 이벤트 사이 약4.1초, offline 구간의1006 시도 뒤 다음 연결의 실제 active ACK가 관측됐다. 그러나 이 후속에서는 최초 실패를 재현하지 못했으므로 해당 시간 변동을 최초 실패의 확정 원인으로 쓰지 않는다. 원래20초 기한·live tick·같은 경기·기존 player 연결·관전자 입력0 단언은 유지했다. 각 문서의 시간은 `timeOriginMs`와 함께 해석하며 서로 다른 문서의 `atMs`만 직접 비교하지 않는다. 상세 근거는 [관전자 진단](OBSERVER_DIAGNOSIS.md)에 있다.

효과 시험은 서버의 새 타격이 실제 presentation tick에 도달하고 skip이 없음을 확인한 뒤 음소거와 모션 감소를 검사했다. 사용자 클릭 뒤 AudioContext1개·oscillator1개가 실제 생성됐고, 음소거 뒤 새 서버 타격에도 추가 음원이 없었다. 시스템 설정과 명시적 모션 감소는 flash/trail을 억제했다. native canvas 키 이벤트의 sequence·held key와 outgoing packet을 연관해 W/S/D 조작 및 비활성 화살표 무이동을 확인했고, route 이탈의 오디오 종료와 복귀 설정의 자동 재생 방지도 통과했다. 사람이 청취하거나 물리 키보드로 플레이한 시험은 아니다.

후속 [관전자 DB 조회](evidence/observer-diagnostic/online-final-persistence.json)는 완료 row0/6점 row0, [효과 DB 조회](evidence/effects-targeted/online-final-persistence.json)는 route 이탈 이후 완료 row1/6점 row1·6:0이었다. 전자는 완료 경기 시험이 아니며 후자도 추가 자연6점 경기의 단언으로 확대하지 않는다. 실행 담당자는 [회복 관전자](evidence/observer-diagnostic/final-observer-reconnected.png), [계속 진행한 player](evidence/observer-diagnostic/final-observer-peer-still-playing.png), [효과·키 안내](evidence/effects-targeted/final-online-effects-and-key-hint.png), [모션 감소](evidence/effects-targeted/final-online-reduced-motion.png)4장을 직접 열었다. 이 문서 작성자는 그 실행·이미지 열람을 대신 수행했다고 주장하지 않는다.

최초 묶음은 **22 PASS/1 FAIL**, 후속 개별 명령은 **1 PASS+1 PASS**로 남긴다. 이를6 config 전체의 성공 재실행으로 합치지 않는다. 앞서 미실행이던 효과 case는 이 별도 명령에서 실행 완료됐지만 최초 기록의 NOT_RUN은 바꾸지 않았다.

P2 단위는 설치 CLI/WDS URL 함수와 명시된 대역을 사용한 순수 검사다. Chrome eventual은 소유 HTTP loopback 직접 서버와 `/ws` 프록시이며 TLS·운영 LNA UI 시험이 아니다. immutable source copy·실제 script SHA·native close·서버 trace를 기록했고 초기 실패를 그대로 남겼다. explicit override/private override 한계, 실제 hot replacement 미실행, 완료된 소유 fixture 종료는 [P2 기록](P2_HMR_REVIEW.md)에 있다.

## 화면과 실제 진입 검증

최초 비교의 수정 전 `http://127.0.0.1:51658`은 고정 baseline dist, 수정 후 `http://127.0.0.1:52435`는 `52546` build를 제공했다. 두 화면 JSON의 `indexSha256`은 각각 `e60b86fcc3aa8596dd33c3250bfbc7c7d171ceeade93b6bc2c256b93189a735a`, `d274384d17c47c8ce6da5b3849dd96a5620f2633f2e7c3dd25b1bfb8915875f3`다. 서로 다른 격리 계정에 같은 합성 닉네임을 준비해 비교했다. 아래 최초35장과 후속 CSS 캡처를 구분한다.

실제 명령은 repository cwd에서 `/opt/miniconda3/bin/python scripts/browser-compat-copy.py <fixture-origin> --phase before|after`이며, `ARCADE_EVIDENCE_DIR=docs/compatibility-lna-copy/evidence`와 각 `ARCADE_SCREEN_DIST`를 명시했다. before/after 모두 process exit0, JSON status `CAPTURED`다. [전 JSON](evidence/before-copy-browser.json)은5개 단언, [후 JSON](evidence/after-copy-browser.json)은 **69/69 단언 PASS**를 기록한다. `CAPTURED`를 모든 제품 기능 완료 상태로 확대하지 않는다.

69개 단언은 세 viewport의 가로 overflow, 두 desktop 크기에서 주요 CTA 첫 화면 유지, Home/Login/공개 허브의 공통 소개·접힘·노출 기술명·Tab focus·Enter/Space 토글·추가 HTTP/WS0, 실제 guest document1/fetch0·cookie callback·의도한 로비 복귀, 기존 API로 준비한 닉네임, 온라인 진단 설명, 저장·재지정한 키 역할과 사람의 왼쪽 AI 패들 실제 이동, 자동 매칭0, 정적 build의 HMR 연결0, pageerror0을 포함한다. 온라인 로비의 `/socket.io/` 연결은 HMR `/ws`와 별개다. 화면 시험이 온라인 전체 경기·결과 저장 시험을 대체하지 않는다.

같은 viewport로 만든 전후 **12쌍**이다. full-page PNG의 전체 높이가 viewport 높이와 다를 수 있으므로 서로 다른 PNG 높이를 viewport 차이로 해석하지 않는다.

| 화면 | 1440×900 | 1366×768 | 390×844 |
|---|---|---|---|
| 로그인 | [전](evidence/before-login-1440x900.png) / [후](evidence/after-login-1440x900.png) | [전](evidence/before-login-1366x768.png) / [후](evidence/after-login-1366x768.png) | [전](evidence/before-login-390x844.png) / [후](evidence/after-login-390x844.png) |
| 공개 허브 | [전](evidence/before-play-hub-1440x900.png) / [후](evidence/after-play-hub-1440x900.png) | [전](evidence/before-play-hub-1366x768.png) / [후](evidence/after-play-hub-1366x768.png) | [전](evidence/before-play-hub-390x844.png) / [후](evidence/after-play-hub-390x844.png) |
| Home | [전](evidence/before-home-1440x900.png) / [후](evidence/after-home-1440x900.png) | [전](evidence/before-home-1366x768.png) / [후](evidence/after-home-1366x768.png) | [전](evidence/before-home-390x844.png) / [후](evidence/after-home-390x844.png) |
| 온라인 로비 | [전](evidence/before-online-lobby-1440x900.png) / [후](evidence/after-online-lobby-1440x900.png) | [전](evidence/before-online-lobby-1366x768.png) / [후](evidence/after-online-lobby-1366x768.png) | [전](evidence/before-online-lobby-390x844.png) / [후](evidence/after-online-lobby-390x844.png) |

추가11 PNG는 소개를 펼친 세 화면×(1440,390,CSS200%)의9장, [온라인 진단](evidence/after-online-diagnostics-1440x900.png), [재지정 AI 키](evidence/after-ai-remapped-key-copy-1440x900.png)다. 그중 CSS200%3장은 CSS 확대 시험이며 OS 확대·브라우저 native zoom·터치 경기로 확대하지 않는다.

| 소개 펼침 | 1440 | 390 | CSS200% |
|---|---|---|---|
| 로그인 | [PNG](evidence/after-login-details-1440x900.png) | [PNG](evidence/after-login-details-390x844.png) | [PNG](evidence/after-login-details-css-200percent.png) |
| 공개 허브 | [PNG](evidence/after-play-hub-details-1440x900.png) | [PNG](evidence/after-play-hub-details-390x844.png) | [PNG](evidence/after-play-hub-details-css-200percent.png) |
| Home | [PNG](evidence/after-home-details-1440x900.png) | [PNG](evidence/after-home-details-390x844.png) | [PNG](evidence/after-home-details-css-200percent.png) |

파일 생성·단언과 실제 이미지 열람은 구분한다. 실행자 확인에 따르면 before12장은 루트의1440/390 기본8장과 `live_gate`의1366 기본4장으로 모두 직접 열었다. after23장은 루트의1440/390 기본8장·같은 두 크기의 소개6장·온라인 진단1장·AI 재지정1장, `live_gate`의1366 기본4장·CSS200% 소개3장으로 모두 직접 열었다. 총35장의 **팀 에이전트 시각 검토**이며 독립 인간 평가가 아니다. 이 문서 작성자가 이 최초35장을 새로 열었다고 주장하지 않는다. baseline reviewer의 상세 관찰은 [COPY_REVIEW](COPY_REVIEW.md)에 있다. 이 검토에서 발견한 소개 본문의 단독 글자 줄바꿈에 후속 CSS를 적용했고 원본 캡처는 보존했다.

### CSS 후속 빌드와 새 fixture 화면

[후속 production build](evidence/final-css-frontend-build.log)는 exit0, hash `3d03e7e0daad7476`, index SHA256 `f168717e4c47034a74243bbd68e38467112c107f5ff64b6af358904eb197e570`다. Login·ProjectInfo 본문의 줄바꿈 CSS 후속이며 앞선 `52546` 자료를 덮어쓰지 않았다.

| 실행 | 실제 결과 | 해석 |
|---|---|---|
| `final-css`, 재사용 fixture52435 | 35 PASS/1 FAIL, exit1 | [원본 JSON](evidence/final-css/after-copy-browser.json) / [로그](evidence/final-css-copy-browser-command.log). 고정 리뷰 닉네임 준비 API가200이 아니어서 중단. 정확한 HTTP 오류값은 JSON에 없으므로 추측하지 않음 |
| `final-css-v2`, 새 schema fixture52957 | 69/69 true, `CAPTURED`, exit0 | [JSON](evidence/final-css-v2/after-copy-browser.json) / [로그](evidence/final-css-v2-copy-browser-command.log). 실제 document guest, nickname 준비와 모든 기존 화면 단언 통과. 재사용 fixture의 원본 실패는 그대로 유지 |

명령 본체는 같은 `browser-compat-copy.py <origin> --phase after`이며 `ARCADE_SCREEN_DIST=frontend/dist`, 각 새 evidence 폴더를 사용했다. final-css-v2의 기본12+추가11 PNG는 새3d03 build의 자료다. 아래6장은 이 문서 작성자가 `view_image`로 **직접 열었다**. 모바일3장은 자동 축소본 다음 원본 해상도로도 재열람했다. 이 읽기 검토에서 Chrome이나 생산 코드를 실행·수정하지 않았다.

| 직접 검토한 소개 화면 | 실제 관찰 |
|---|---|
| [Login1440](evidence/final-css-v2/after-login-details-1440x900.png) | 로그인 panel과 소개 사이 간격, 기술 chip, 펼친 summary focus가 유지된다. 본문 단어가 행 단위로 이어지며 소개 문단 겹침이 보이지 않는다. |
| [Login390](evidence/final-css-v2/after-login-details-390x844.png) | 긴 기술명 chip이 다음 행으로 이동하고 summary outline이 콘텐츠 폭 안에 있다. 본문의 한국어 단어 단위 줄바꿈을 확인했다. |
| [Home1440](evidence/final-css-v2/after-home-details-1440x900.png) | rail·세 시작 card·서비스 링크 뒤 소개가 문서 흐름에 배치되어 겹치지 않는다. 펼친 기술 설명과 제작 배경 전체가 이어진다. |
| [Home390](evidence/final-css-v2/after-home-details-390x844.png) | rail을 제외한 좁은 본문 폭에서도 ProjectInfo의 기술 chip과 문장이 감기며 가로 잘림이 보이지 않는다. |
| [공개 허브1440](evidence/final-css-v2/after-play-hub-details-1440x900.png) | 세 CTA 앞 배치를 유지하고 하단의 소개 제목·문단·focus 표시가 구분된다. |
| [공개 허브390](evidence/final-css-v2/after-play-hub-details-390x844.png) | 세 card 뒤 소개 본문이 잘리지 않고 이어지며 chip과 제목이 겹치지 않는다. |

이6장의 ProjectInfo 본문에서는 한국어 단어 중간의 부자연스러운 단독 글자 줄바꿈, 겹침, 가로 잘림을 발견하지 못했다. 소개 밖 Home390 온라인 card/키·터치 안내에는 `진/행합니다`, `바/꿀`, `터/치`처럼 기존 문자 단위 줄바꿈이 일부 남는다. 읽을 수 있는 경미한 시각 잔여이며 이번 소개 CSS의 검증 결과와 분리한다. 실행자 확인에 따르면 루트가 최신 기본1440/3908장+진단/AI2장을, `live_gate`가1366 기본4장+CSS200%3장을 직접 열었다. 이 문서 작성자의6장과 합쳐 최신23장 전부 팀이 검토했으며, 이 작성자가 나머지17장을 열었다고 주장하지 않는다.

### 새 CSS의 Home 최종 그룹

`check-arcade.cjs home`은 새 CSS3d03/fixture52957와 backend-free preview52431에서 실제 wrapper exit0,3개 명령 모두 완료했다. [원본 로그](evidence/final-home-command.log)의 개별 결과를 [화면 JSON](evidence/final-home/home-visual-browser.json), [인증 JSON](evidence/final-home/after-auth-navigation-browser.json), [동선 JSON](evidence/final-home/after-navigation-browser.json)과 대조했다. **48+18+4=70 PASS, 별도1 OBSERVED**다. timestamp가 붙은 같은 JSON 사본을 추가 실행으로 합산하지 않는다.

화면48개에는 실제 AI 시작·local 진입·온라인 로비의 자동 매칭0, 세 backend-free 공개 경로의 auth/socket0, viewport/focus/대조도/긴 닉네임 검사가 포함된다. 인증18개와 동선4개는 실제 전체 guest redirect·거절 목적지·친구 초대/수락·빈 관전 목록과 timeout의 구분·Home 왕복 수명을 검사했다. `Invite → spectator via existing service navigation`은 결과를 **OBSERVED**로 남겼으며 PASS로 바꾸지 않았다. 합성 키 입력과 loopback 실행이지 운영 플레이나 인간 평가가 아니다.

### 새 CSS의 로컬·AI 최종 그룹

`check-arcade.cjs local-browser`도 최종 CSS build에서 실제 exit0으로 두 명령을 완료했다. [원본 로그](evidence/final-local-command.log)의 `browser-check.py`25개와 `browser-local-modes.py`31개를 읽어 **56/56 PASS**로 집계했다. [기본 local/AI JSON](evidence/final-local/p2-browser-report.json)과 [규칙·난이도 JSON](evidence/final-local/report.json)에 각각 원시 단언이 있다.

검증 범위는 두 키 세트 동시 이동·반대 입력 중립, pause/resume·blur·resize·DPR, 키 충돌 거절·재지정, local/AI6점 종료·재시작, route 수명, AI의 사람 왼쪽 조작·지연 관측, 잘못된 설정의 Classic/Normal 복귀, 실제5회 타격 후 Power 키 활성, Classic/Power×AI 세 난이도의 종료·재시작·수명, backend/auth/socket/external 요청0과 runtimeerror0이다. 반복 재진입 사례는 JSON에 실행한 세 번을 그대로 센 것이며 같은 로그 사본을 중복 집계한 것은 아니다. 이 실행은 자동화된 브라우저 회귀이며 사람의 수동 플레이나 터치 지원 검증이 아니다.

## 운영 관찰과 아직 검증하지 않은 범위

- **OBSERVED:** 새 토큰 없는 Chrome에서 운영 `/login`의 공개 HTTPS 문서/JS와 실제 private HMR `ws://172.18.0.3:3000/ws` 요청·webpack initiator. 운영 guest 클릭/요청0. [정제 network](evidence/public-login-before-network.json), [번들 SHA](evidence/public-bundle-fingerprints.json), [컴파일 URL 식](evidence/public-bundle-endpoint-expressions.json).
- **BLOCKED:** native CUA 앱 화면 접근이 승인되지 않아 실제 LNA 권한창 직접 검토. `permissions.query`의 prompt 상태나 JS dialog0을 ‘권한창 없음’으로 세지 않는다. raw public probe는 데이터 수집 뒤 stdin EOF로 process exit1이었다. 이를 네트워크 수집 전체 실패나 제품 성공으로 재분류하지 않는다.
- **별도 passive 관찰:** sandbox DNS ENOTFOUND 원본, 정상 TLS/Origin 없는 접속의101 후 error/close, 정상 browser Origin을 준 public WSS101/hash/warnings를 각각 보존했다. [DNS](evidence/public-ws-upgrade-sandbox.json) / [Origin 없음](evidence/public-ws-upgrade.json) / [Origin 포함](evidence/public-ws-upgrade-origin.json). 마지막 결과는 Node의 passive upgrade이며 변경된 브라우저 배포 검증이 아니다. 인증서 검사를 끄지 않았고 application message를 보내지 않았다.
- **NOT_RUN:** 운영 계정/기존 토큰의 `/user/me`·이미지·game/chat 요청, 운영 guest 생성·로그인 완료, 운영 env/선택된 proxy/cgroup 확인, 수정 후 운영 LNA UI, 배포·운영 재시작. 기본값/컴파일식/격리 fixture 결과로 이를 추정하지 않는다.
- **FAILED 기록 보존:** `52546`의 최종 `browser`6 configs는22 PASS/1 FAIL·exit1. 관전자 live generation/tick timeout의 직접 원인 순서는 미확정이다. 그 실행에서 효과 case와 마지막 DB 조회는 NOT_RUN이었다.
- **별도 PASS:** 최종 CSS 빌드의 관전자 진단과 효과 선택 실행은 각각1 PASS·exit0이다. 최초 묶음 전체를 다시 실행한 결과가 아니며, 후속 성공으로 최초 실패의 원인을 소급 확정하지 않는다.
- **PASS:** 새 CSS3d03/fixture52957·backend-free preview52431의 `check-arcade.cjs home` 최종 그룹은70 PASS/1 OBSERVED, wrapper exit0이다. OBSERVED를 PASS 수에 합치지 않는다.
- **PASS:** `check-arcade.cjs local-browser` 최종 재실행은25+31=56 PASS, wrapper exit0이다. 이전 Goal의 플레이를 가져온 집계가 아니다. WAN 안정성·사람의 청취·터치 플레이도 검증하지 않았다.

잔여 사항은 전체 lint/넓은 backend 타입의 baseline 실패, 개발 HMR 최초 연결 유지 실패와 후속 자동 회복의 구분, 원래 온라인 묶음에서 발생한 관전자 timeout의 원인 미확정, 운영 권한창 직접 관측·수정 후 배포 검증의 부재다. 실행한 범위의 결과를 확정했으며 전체 저장소 검사나 운영 배포가 모두 성공했다고 보고하지 않는다.

마지막 루트 명령 기록36개 및 별도 P1/P2/온라인 실행 기록을 대조했다. 실행자 확인으로 소유한 임시 인증·DB fixture와 Chrome은 정리됐고, backend-free 정적 preview52431만 검토용으로 남겼다. 다른 프로세스나 운영 서비스의 종료·변경으로 확대하지 않는다.
