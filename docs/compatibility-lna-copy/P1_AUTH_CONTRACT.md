# P1 — 기존 guest document navigation 복원

대상은 `sungmpar/ft_transcendence_project`, 작업 시작 기준은 깨끗한 `main/ecbb0ee30694f372b8e6e51c1642ef258681443d`다. `f970554de528b2fceb46aa7aa3a10d43c192b65b`와 현재 Login/router/auth.controller를 읽고 비교했다. 기존 Home/Arcade 문서·증거는 이전 실행 기록이며 수정하지 않았다. 이 단계는 운영 guest endpoint를 호출하지 않고 소유한 격리 fixture만 사용한다.

## 복원·보존 범위

사용자가 명시한 호환 계약에 따라 `LoginView`는 guest fetch/manual redirect/opaque response/8초 abort를 제거하고, 실제 클릭 때 검증한 `/auth/guest` URL로 `document.location.assign()`을 한 번 호출한다. 동기 busy guard가 중복 클릭을 막는다. 이동을 시작했다고 인증 성공으로 표시하지 않으며, 전체 문서가 돌아오는 `pageshow`에서 버튼 상태를 초기화하고 route unmount에서 listener를 제거한다. 전체 navigation의 HTTP·네트워크 실패를 떠난 SPA가 가로챈다고 약속하지 않는다.

backend의 실제 guest 생성·JWT 발급·기존 cookie·`FRONT_URL/login?token=check` redirect·guest flag는 유지한다. 새 fetch만 지원하던 endpoint credential CORS 블록과 guest의 사용하지 않는 `@Req` 인자만 제거했다. 다른 endpoint·전역 CORS·OAuth·cookie domain·DB schema는 바꾸지 않았다. 새 handler signature의 들여쓰기만 기존 formatter에 맞췄다.

현재 router/login-intent/auth-session은 보존한다. 허용한 `/game`·`/invite`·`/spectate`, 10분 TTL, 일회 사용·취소·logout 정리, storage 실패의 Home fallback과 실제 nickname/2FA 검사를 유지한다. 42 로그인 비활성 상태도 그대로다. callback 도착 자체가 인증 성공은 아니다.

`guest-navigation-url.ts`는 순수 URL 검사다. HTTP(S), 기존 same-origin/base-path와 local 개발을 허용하고 userinfo/query/fragment를 거절한다. public 페이지에서 명시적 localhost/private IPv4·IPv6·IPv4-mapped local 주소로 이동하거나 public HTTPS에서 HTTP로 내려가는 것을 거절한다. DNS·사설망을 조회하지 않는다. public hostname이 private IP로 해석되는 경우까지 검증한 것은 아니다. 다른 public hostname은 URL 검사와 기존 cookie handoff 지원을 구분한다. domain 없는 기존 cookie는 같은 hostname의 별도 포트가 이번 browser 지원 시험 대상이며 cross-host/subdomain 지원이나 broad cookie domain을 추가하지 않는다.

이 복원은 사용자 요청에 따른 인증 시작 방식 변경이다. fetch 자체가 LNA 원인이었다고 결론 내리지 않는다. root가 별도 조사한 버튼 클릭 전 HMR 요청과 이 단계의 guest 계약을 혼동하지 않는다.

## 회귀 목표가 달라진 이유

기존 `home-guest-entry`의 ‘503에서도 Login SPA에 남는다’와 ‘pending fetch를 abort해 늦은 callback을 막는다’는 제거된 fetch 계약에 대한 단언이다. 사용자 명세 P1/§8에 맞춰 실제 HTTP503 문서, browser Back, 다시 활성인 버튼, 실제 공개 AI 링크, account/callback/요청 종류를 검사한다. guest를 시작하기 전 명시 취소는 account/request/socket 모두0과 intent 정리를 검사한다. 이미 실행 중인 서버 account 생성을 취소한다고 주장하지 않는다.

기존 one-account/cookie/callback·double click·새 탭 intent·flag 검사를 유지하고, guest GET이 document1/fetch·XHR0인지 추가했다. same-origin 및 같은 hostname의 별도 포트에서 세 목적지를 모두 검사한다. storage 차단과 reload를 추가한다. credential CORS 기대는 실제 disabled403/계정0을 유지하면서 guest 전용 credential 허용이 없는 기대값으로 바꿨다.

`guest-navigation-jest.json`의 controller 시험은 실제 AuthController 메서드와 Nest route-argument metadata를 사용하되 UserService/JWT 발급을 대역으로 둔 단위 시험이다. 실제 DB·HTTP 시험으로 분류하지 않는다. URL 시험도 DNS 또는 실제 공개 서버/LNA 시험이 아니다.

Playwright1.55는 기본으로 `--disable-back-forward-cache`를 넣는다. 전용 bfcache case는 이 기본 인자 하나만 제외하고 권한·인증서·보안은 완화하지 않는다. 실제 `pageshow.persisted`와 같은 `performance.timeOrigin`을 모두 관측해야 PASS이며, 단순 `goBack()`이나 인위 event dispatch를 실제 bfcache로 세지 않는다.

## 실행 기록

명령은 repository root에서 아래 Node18 runtime으로 실행하며 stdout/stderr를 각 파일에 별도 보존했다. browser의 임시 frontend 빌드는 test 내부에서 `frontend` cwd의 기존 Vue CLI `build --dest /private/tmp/ft-home-guest-entry-<pid>/<mode>`를 실행한다. guest/debug flags와 실제 fixture에 맞는 API/WS override를 명시하며 root dist를 덮지 않는다. `ARCADE_EVIDENCE_DIR`는 반드시 이번 새 폴더를 지정했다.

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch backend/node_modules/jest/bin/jest.js --config backend/test/guest-navigation-jest.json --runInBand --watchman=false
# controller red만 선택
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch backend/node_modules/jest/bin/jest.js --config backend/test/guest-navigation-jest.json --runInBand --watchman=false --testPathPattern=guest-redirect-controller
# HTTPS downgrade red만 선택
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch backend/node_modules/jest/bin/jest.js --config backend/test/guest-navigation-jest.json --runInBand --watchman=false --testNamePattern='does not downgrade'
ARCADE_EVIDENCE_DIR=/Users/sm/dev_park/ft_transcendence_project/docs/compatibility-lna-copy/evidence/P1-red /private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch backend/node_modules/jest/bin/jest.js --config backend/test/home-guest-entry-jest.json --runInBand --watchman=false --testNamePattern='same-origin: real guest|document navigation needs'
ARCADE_EVIDENCE_DIR=/Users/sm/dev_park/ft_transcendence_project/docs/compatibility-lna-copy/evidence/P1-after /private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch backend/node_modules/jest/bin/jest.js --config backend/test/home-guest-entry-jest.json --runInBand --watchman=false
```

| 실행 | 결과 | 새 evidence |
|---|---|---|
| URL 신규 모듈 작성 전 | TS2307, 0tests, exit1. 제품 재현으로 세지 않음 | `P1-url-before.log` |
| controller CORS red | 2 FAIL, exit1/6.356s | `P1-controller-red.log` |
| 실제 guest document/CORS red | 2 FAIL/6 미선택, exit1/60.052s | `P1-browser-red-command.log`, `P1-red/` |
| 최초 구현 단위 | 39 PASS, exit0/6.507s | `P1-unit-after.log` |
| public HTTPS downgrade red | 1 FAIL/39 미선택, exit1/6.47s | `P1-https-downgrade-red.log` |
| downgrade 보완 포함 단위 | 40 PASS, exit0/5.722s | `P1-unit-final.log` |
| 최초 frontend noEmit/lint | 각각 exit0, lint 오류/경고0 | `P1-typecheck.log`, `P1-frontend-lint.log` |
| controller 범위 lint 최초 | exit1, 기존69+새 signature형식1 오류/기존 경고3 | `P1-backend-lint.log` |
| signature 들여쓰기 보완 후 | exit1, baseline과 동일69오류/3경고 | `P1-backend-lint-final.log` |

frontend 명령의 cwd는 `frontend`다: `/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/typescript/bin/tsc --noEmit --pretty false`, 같은 Node의 `node_modules/eslint/bin/eslint.js src/views/LoginView.vue src/arcade/guest-navigation-url.ts --no-fix`. backend 범위 lint는 `backend` cwd에서 같은 Node로 `node_modules/eslint/bin/eslint.js src/auth/auth.controller.ts --no-fix`를 실행했다. repository root의 `git diff --check`는 exit0이었다.

첫 실제 browser after는 **15 PASS/1 FAIL, exit1/234.024s**였다(`P1-browser-after-command.log`, `P1-after/home-guest-entry.json`). same/split의 세 목적지6개,503 문서 후 Back2개, double click, 취소, storage 차단, reload, frontend flag, 새 탭, endpoint CORS/flag가 통과했다. 실제 bfcache case만 browser Back 이후 대기 단계에서 실패했다. 그 실행은 실제 persisted 값을 얻기 전 끝나 원인을 단정하지 않는다. 전체 suite 성공으로 쓰지 않는다.

첫 after의 세 temp builds는 HTTPS downgrade 추가 전 source를 캡처했다: same-origin `app.e2aab0b1.js`, split-origin `app.b8c272af.js`, guest-disabled `app.fd2ed35a.js`, 소유 root `/private/tmp/ft-home-guest-entry-4608`. Login 문서 이동 및 pageshow 동작은 같은 구현이며 P3 문구 변경이나 뒤의 HTTPS guard 검증으로 확대하지 않는다. 최종 frontend noEmit/lint는 downgrade 보완 뒤 다시 실행해 각각 exit0이었다(`P1-typecheck-final.log`, `P1-frontend-lint-final.log`).

bfcache 후속은 이 고정 빌드를 재사용하고 실제 조건을 유지했다. `Page.backForwardCacheNotUsed`의 reason, browser history/페이지 상태를 관측하며 history 대기를 `commit`으로 맞췄다. bfcache에는 새로운 load event가 없으므로 실제 pageshow와 같은 문서 여부를 따로 확인한다. 인위 pageshow로 대체하거나 해당 시험을 제거하지 않았다. 최초 실패에는 충분한 미복원 진단이 없어 원래 browser 정책/제품 원인을 소급 확정하지 않는다.

```sh
ARCADE_GUEST_REUSE_ROOT=/private/tmp/ft-home-guest-entry-4608 ARCADE_EVIDENCE_DIR=/Users/sm/dev_park/ft_transcendence_project/docs/compatibility-lna-copy/evidence/P1-bfcache-diagnostic /private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch backend/node_modules/jest/bin/jest.js --config backend/test/home-guest-entry-jest.json --runInBand --watchman=false --testNamePattern='actual bfcache'
```

실제 결과는 **1 PASS/15 미선택, exit0/21.767s**다(`P1-bfcache-diagnostic-command.log`, `P1-bfcache-diagnostic/home-guest-entry.json`). Chrome152.0.7977.77,1440×900에서 `pageshow.persisted=true`, `sameDocument=true`, 복원된 버튼 enabled=true, guest document1/fetch0/callback0/account0/pageerror0을 관측했고 `notRestored=[]`였다. [복귀 화면](evidence/P1-bfcache-diagnostic/P1-bfcache-login-restored.png)을 실제로 열어 버튼과 레이아웃을 확인했다. 이 그림은 P3 문구 개편 전의 고정 P1 화면이다.

`ARCADE_GUEST_REUSE_ROOT`는 이 한 사례의 고정 same-origin 빌드 재사용용이다. 저장된 split bundle은 이전 fixture 포트를 가지므로 이를 새 서버의 split 인증 회귀 명령으로 쓰면 안 된다. 최종 전체 suite는 이 변수를 주지 않고 현재 소스로 임시 빌드를 만든다. 첫 suite의15 PASS와 별도 bfcache1 PASS는 모든 계약의 성공 근거를 제공하지만, 첫 전체 실행 exit1을 바꾸지 않는다. P3 뒤의 최종 전체16개 실행은 root 통합 기록에서 별도로 판정한다.

Login/URL/helper/auth.controller와 guest 시험의 소유권을 root에 반환했다. Chrome와 이 시험이 만든 schema/server/context만 정리했으며 root의 기존51658/수동52262 fixture는 종료하지 않았다. 이 담당자는 commit/push/PR/댓글/운영 guest/배포/운영 DB 변경을 하지 않았다.

## 최종 통합 후 확인

P3/P4 뒤 현재 소스로 same/split/flag 임시 빌드를 새로 만든 guest 전체16개가 한 번의 실행에서 PASS했다. 정확한 명령과 최초실패/후속 성공의 구분은 [TEST_REPORT](TEST_REPORT.md)와 [최종 browser 실행 기록](evidence/final-browser-execution-record.json)에 있다.

독립 리뷰의 COMPAT-R1은 기존 사설 주소 사례가 모두 HTTPS→HTTP 차단에도 걸려 주소 공간 분기를 독립 검증하지 못한다는 시험 공백이었다. 기존 단언을 유지하고 public HTTPS→private HTTPS 및 public HTTP→private HTTP의10개 주소 사례와 정상 public HTTP1개를 추가했다. 생산 helper는 변경하지 않았다. [최종 단위](evidence/final-private-boundary-unit.log)는51/51 PASS·exit0·5.799초, [신규 두 시험 lint](evidence/final-private-boundary-lint.log)는exit0이다. 처음40개 실행 결과를 수정하거나 여러 실행을 누적한 총수로 쓰지 않는다.
