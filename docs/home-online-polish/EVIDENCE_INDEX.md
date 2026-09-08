# 실제 검증 증거 색인 — 패키징 직전 확정 기록

대상: `sungmpar/ft_transcendence_project`, `main`, baseline `2f11bee69c2d55ed938b53f9750119a890396fb7`. 이 색인은 **2026-09-08 04:38 UTC까지 확인한 실행 기록**을 패키징 전에 고정한다. 기존 미커밋 작업 위에서 실행한 결과이며 커밋별 전체 인증서가 아니다. 최신 단위233 PASS, 고정 build의 서비스37·로컬56, 새 build991의 Home48/메뉴4, 개별 browser6 configs15 PASS를 분리한다. **두 aggregate browser wrapper의 exit1은 그대로**이며 후속 P4·final all 개별 성공으로 바꾸지 않는다. 과거 미확정 실패와 미실행 범위를 보존하고, 아직 실행하지 않은 패키징은 맨 아래에 예정 출력으로만 표시한다.

작성자는 기존 로그·JSON·실행자 기록을 대조했으며 이 색인 작성 때문에 검사를 재실행하지 않았다. `exit 0`은 프로세스 성공, `PASS`는 해당 단언 성공, `REPRODUCED`는 기대한 결함 재현이다. 셋은 서로 대체할 수 없다. 숫자는 Jest test, Python check, JSON 관측 record 단위로 표시하며 합쳐서 하나의 품질 점수로 만들지 않는다.

## 명령과 출처를 읽는 방법

- root cwd: `/Users/sm/dev_park/ft_transcendence_project`. frontend/backend cwd는 그 하위 디렉터리다.
- [baseline-commands.json](evidence/baseline-commands.json)은 baseline 각 명령의 **정확한 전체 command, cwd, exit**를 보존한 실행 기록이다.
- [recovery-execution-record.json](evidence/recovery-execution-record.json)은 N1/N2 실행자가 tool 결과로 작성한 **정확한 command, cwd, exit**다. 아래 C 표는 이 레코드와 실제 Jest/브라우저 로그를 함께 대조했다.
- [final-root-commands.json](evidence/final-root-commands.json)과 [final-online-execution-record.json](evidence/final-online-execution-record.json)은 완료된 최종 실행의 정확한 command/cwd/exit를 보존한다. 앞으로 레코드가 추가될 수 있으며 이 색인의 현재 확인 범위와 구분한다.
- [guest-disabled-commands.json](evidence/guest-disabled-commands.json)은 별도 flag-off build/preview/browser의 정확한 명령이다. 임시 preview의 종료는 정상적인 검증 후 정리이며 테스트 실패가 아니다.
- 나머지 정확한 명령은 아래 명령 목록, [BROWSER_NAVIGATION_REVIEW.md](BROWSER_NAVIGATION_REVIEW.md), [NAVIGATION_NOTES.md](NAVIGATION_NOTES.md), [INDEPENDENT_HOME_REVIEW.md](INDEPENDENT_HOME_REVIEW.md)에 있다. 실행자 문서만으로 확인한 exit는 해당 사실을 표시했다.
- 로그가 비어 있다는 이유로 exit 0을 추정하지 않았다. 실행자 기록이 없는 정확한 명령/exit는 `unknown`이다. 시각은 JSON 자체의 실행 시각을 사용하며 파일 mtime을 실행 시각으로 치환하지 않는다.

## A. 변경 전 baseline

정확한 명령/cwd/exit: [baseline-commands.json](evidence/baseline-commands.json), 기록 시각 `2026-09-08T00:55:50Z`.

| 증거 | 실제 결과 | 분류와 한계 |
|---|---|---|
| [baseline-unit.log](evidence/baseline-unit.log) | exit 0; 8 configs, **136 Jest PASS** = 43+16+16+9+17+8+13+14 | baseline 단위/회귀. 브라우저 플레이 아님 |
| [baseline-frontend-noemit.log](evidence/baseline-frontend-noemit.log) | exit 0; 진단 없음 | 타입 검사 |
| [baseline-frontend-build.log](evidence/baseline-frontend-build.log), [baseline-backend-build.log](evidence/baseline-backend-build.log) | 각각 exit 0; frontend hash `705af758a21aa3ca` | 빌드 성공. bundle-size 경고는 남음; 배포 아님 |
| [baseline-frontend-lint.log](evidence/baseline-frontend-lint.log) | exit 1; **1 error/64 warnings** | 변경 전 lint 부채, `score.ts` 혼합 들여쓰기. nonfix 실행 |
| [baseline-backend-lint.log](evidence/baseline-backend-lint.log) | exit 1; **1858 errors/32 warnings** | 변경 전 src-only/non-spec lint 부채. nonfix 실행 |
| [baseline-online.log](evidence/baseline-online.log) | exit 1; 첫 config **3 FAIL** | **환경 실패**: fixture PostgreSQL 연결 EPERM; 시나리오 미실행, 나머지 configs 미실행 |
| [baseline-online-loopback.log](evidence/baseline-online-loopback.log) | 허용된 loopback 재실행 exit 0; 3 configs, **15 Jest PASS** = 3+7+5 | 실제 격리 PostgreSQL/HTTP/Socket.IO; 브라우저 검사 아님 |
| [before-screen-report.json](evidence/before-screen-report.json) | 캡처 작업 PASS, Chrome 152, Home 4 viewport, page errors 0. Home 본문 local/AI CTA 각각 0 | **관찰 기록**. 좋은 Home 동선이 통과했다는 뜻 아님. 일회성 캡처 command/exit는 이 JSON에 없어 unknown |
| [baseline-login-return.json](evidence/baseline-login-return.json) | `FAIL_EXPECTED`: `/game` 기대, 실제 guest callback 후 `/` | **H06 제품 문제 재현**. 해당 JSON에는 process exit 없음 |
| [baseline-navigation-browser.json](evidence/baseline-navigation-browser.json), [navigation-initial-attempts.json](evidence/navigation-initial-attempts.json) | 마지막 baseline 시도 exit 1; checks 0; callback timeout, 31.776초 | rebuild와 겹친 불확정 시도. **H08 baseline UI UNVERIFIED**; after 결과로 소급 보충하지 않음 |

최초 Home PNG: [1440×900](evidence/before-home-1440x900.png), [1366×768](evidence/before-home-1366x768.png), [1024×768](evidence/before-home-1024x768.png), [390×844](evidence/before-home-390x844.png). 추가 Login/PlayHub/lobby 캡처도 `before-*.png`로 보존된다. root 실행자가 직접 열어 검토한 기록은 TEST_REPORT에 있으며, 색인 작성자가 새 시각 리뷰를 했다고 주장하지 않는다.

초기 E 단계 upstream 재확인은 실행자 [final-live-gate.json](evidence/final-live-gate.json)의 **2026-09-08 03:36:22 UTC** 기록이다. 정확한 repository/branch/issues/pulls API URL이 들어 있으며 default `main`은 같은 baseline SHA, archived/disabled false다. open issues/PR 각각 page1/per_page100의 실제 결과가0이므로 추가 open page와 겹치는 PR diff는 없다. root의 `git fetch origin`과 `git diff --check`는 각각 실제 exit0다. 이 색인 작성자가 fetch나 새 GitHub 조회를 실행한 것은 아니다. 이 availability 재확인은 최초 현재코드·사용자 미커밋·회귀 가능성 검사를 대체하지 않는다. 더 늦은04:37 전달 직전 조회는 맨 아래에 별도로 연결한다.

## B. Home·공개 진입·인증·기존 메뉴

| 증거 | 실제 결과 | 적용 범위 |
|---|---|---|
| [phase-b-unit.log](evidence/phase-b-unit.log) | exit 0 (root 실행 기록); 9 configs, **158 Jest PASS** = 21+43+16+16+10+17+8+13+14 | Home intent 추가 후 당시 단위 검사 |
| [navigation-unit.log](evidence/navigation-unit.log) | **21 Jest PASS**, 4.614초; exit 0 (navigation 실행 기록) | exact allowlist/TTL/consume 등 순수 intent 검사 |
| [navigation-lifecycle-unit.log](evidence/navigation-lifecycle-unit.log) | **10 Jest PASS**, 1.319초; exit 0 (navigation 실행 기록) | 자원 소유 계약 단위 검사. 실제 browser suite와 별도 |
| [phase-b-tsc.log](evidence/phase-b-tsc.log), [home-owned-lint.log](evidence/home-owned-lint.log) | 각각 exit 0 (root 실행 기록) | 타입 및 소유 Home 파일 scoped lint; 전체 lint 부채 해소 주장 없음 |
| [phase-b-frontend-build.log](evidence/phase-b-frontend-build.log), [phase-b-final-build.log](evidence/phase-b-final-build.log), [phase-b-prerequisite-layout-build.log](evidence/phase-b-prerequisite-layout-build.log) | 각각 exit 0 (root 실행 기록); 마지막 hash `fb75099850003ac9` | 서로 다른 시점의 build. 최종 온라인 build의 증거로 재사용하지 않음 |
| [auth-navigation-20260908T011312Z.json](evidence/auth-navigation-20260908T011312Z.json) | exit 0; **18 Python checks PASS**, 154.251초 | 실제 guest full redirect로 game/invite/spectate 복귀; malformed/external intent, TTL, cancel, 공개 backend 차단, 친구 empty/error/focus, logout 503 로컬 정리 |
| [after-navigation-20260908T012107Z.json](evidence/after-navigation-20260908T012107Z.json) | exit 0; **4 PASS + 1 OBSERVED records**, 57.745초 | 실제 친구 선택→대상 전달→거절→재초대→수락→양 코트 진입; spectator empty/timeout/retry; back/forward 2회; 소켓/RAF 정리 |
| [guest-disabled-commands.json](evidence/guest-disabled-commands.json), [auth-navigation-20260908T011844Z.json](evidence/auth-navigation-20260908T011844Z.json) | build exit 0 + browser exit 0; **1 selected check PASS**, 11.489초 | guest flag-off 별도 temp build. 안내+guest 버튼 없음+실제 AI 링크 작동. 인증은 시도하지 않음 |
| [home-auth-prerequisites-final.log](evidence/home-auth-prerequisites-final.log) | 당시 exit0; **3 Jest PASS**,43.238초 | 실제 expired JWT401/nickname form/2FA verify와 복귀. 이 고정 log는 Phase B 실행이며 latest JSON과 같은 실행으로 묶지 않음 |

**교체되는 alias 주의:** [home-auth-prerequisites.json](evidence/home-auth-prerequisites.json)은 최종 root 재실행으로 `createdAt=04:15:11.457Z`/app`f9b85f4e`로 갱신됐다. 위43.238초의 예전 실행과 현재 JSON은 서로 다르다. 최신 실행은 아래 root6-config의 prerequisite3 PASS/41.803초다. 고정된 과거 command log를 유지하고 current alias를 과거 실행의 JSON으로 소급하지 않는다.

B의 정확한 browser 명령은 root cwd에서 다음과 같다. 이 명령들은 당시 frontend/backend 쌍에 대한 결과다. 기존 59707 주소가 이후 새 build나 오래된 backend를 제공할 수 있으므로 URL만 같다고 동일 버전으로 간주하면 안 된다.

```sh
/opt/miniconda3/bin/python scripts/browser-home-auth.py http://127.0.0.1:59707
/opt/miniconda3/bin/python scripts/browser-home-navigation.py http://127.0.0.1:59707 --phase after
/opt/miniconda3/bin/python scripts/browser-home-auth.py http://127.0.0.1:59707 --disabled-base http://127.0.0.1:61643 --only Guest-disabled
```

prerequisite 검사 정확한 명령, backend cwd:

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/home-auth-prerequisites-jest.json --runInBand --watchman=false
```

인증 근거는 세 종류를 분리한다. `browser-home-auth/navigation`은 실제 렌더링된 guest 버튼과 full document callback, cookie, 기존 guard를 사용했다. `home-auth-prerequisites`는 서명된 fixture JWT를 storage에 넣어 선행 상태를 준비했고 in-memory 2FA code를 실제 원래 endpoint에 제출했다. 이것은 실제 guest login 재실행이나 외부 메일 배달 검증이 아니다. `home-guest-entry`는 아래 수정 검증에서 다시 실제 guest 생성부터 실행했다. 모든 계정/DB는 격리 fixture이며 credential은 증거에 직렬화하지 않는다.

### 화면 검사 스냅샷과 초기 실패

| 증거 | 실제 결과 | 해석 |
|---|---|---|
| [phase-b-visual-attempt1.log](evidence/phase-b-visual-attempt1.log), [phase-b-visual-attempt1.json](evidence/phase-b-visual-attempt1.json) | 전체 FAIL; 32개 앞선 checks 통과 후 dialog visible timeout; process exit는 원시 로그에 없어 unknown | HeadlessUI의 0-size wrapper를 고른 **시험 locator 오류**. 실제 panel selector로 수정 |
| [phase-b-visual-command.log](evidence/phase-b-visual-command.log), [phase-b-visual-before-zoom.json](evidence/phase-b-visual-before-zoom.json) | **39 checks PASS**, `01:06:42Z`; exit 0은 root 실행 기록 | 초기 문서의 37이라는 수기 숫자 대신 보존 원시 JSON39 사용. 이후 200% 이미지에서 card 내부 넘침을 발견했으므로 이 PASS로 전체 시각 완성 주장 불가 |
| [phase-b-final-visual-command.log](evidence/phase-b-final-visual-command.log) | **40 checks PASS**, `01:16:08Z`; exit 0은 root 실행 기록 | card 내 control 경계 단언 추가 후 재실행 |
| [phase-b-keyboard-visual-command.log](evidence/phase-b-keyboard-visual-command.log) | **44 checks PASS**, `01:25:27Z`; exit 0은 root 실행 기록 | keyboard/reduced-motion 검사 확장 |
| [home-visual-stress-command.log](evidence/home-visual-stress-command.log) | **48 checks PASS**, `01:55:38Z`; root tool 실행 기록 exit 0 | 실제 긴 한글 nickname API/모바일 fit/복원 + 계산된 sampled contrast 4개 추가. 이전 39/40/44와 합산하지 않음 |

첫48의 정확한 명령, root cwd:

```sh
/opt/miniconda3/bin/python scripts/browser-home-visual.py http://127.0.0.1:59707 > docs/home-online-polish/evidence/home-visual-stress-command.log 2>&1
```

원래 같은 계정의 전후 비교 화면: [1440×900](evidence/after-home-1440x900.png), [1366×768](evidence/after-home-1366x768.png), [1024×768](evidence/after-home-1024x768.png), [390×844](evidence/after-home-390x844.png), [200%](evidence/after-home-200percent.png), [긴 nickname 모바일](evidence/after-home-long-nickname-390x844.png). root가 전후 동일 viewport 및 이미지를 열어 검토했고, 자동 폭 검사만으로 대체하지 않았다. 이후 새 build 캡처는 별도 폴더에 보존한다. 200%는 CSS zoom이며 모든 브라우저 UI 확대 동작 검증이 아니다. sampled contrast는 검사한 텍스트 대상만 의미한다. Python invalid-escape SyntaxWarning은 PASS와 별개이며 이후 raw-string 표기로 수정한 것은 assertion 변경이 아니다.

초기 navigation 실패의 정확한 시도 목록은 [navigation-initial-attempts.json](evidence/navigation-initial-attempts.json)에 있다: Chrome SIGABRT/kill EPERM은 환경 실패, generic Error는 진단 불충분, baseline callback timeout은 build 겹침으로 불확정, 두 거절 텍스트의 strict locator 일치는 시험 오류다. [after-navigation-20260908T011737Z.json](evidence/after-navigation-20260908T011737Z.json)은 두 실제 invitation 검사 PASS 뒤 `/tempwatchpage` 이동 timeout으로 전체 FAIL을 보존한다. 이 오류를 H08 수락 실패로 다시 집계하지 않는다. 후속 실제 route 명시 대기 검사에서 통과했으며 baseline 부재를 지우지는 않는다.

prerequisite의 [초기 환경 로그](evidence/home-auth-prerequisites.log)는 EPERM으로 3 FAIL, [레이아웃 수정 전 로그](evidence/home-auth-prerequisites-escalated.log)는 2 PASS/1 FAIL이다. 후자는 실제 Choose 버튼이 rail에 가려진 **제품 UI 문제**였고 [수정 전 screenshot](evidence/auth-nickname-before-layout-fix.png)으로 확인했다. force click 없이 root의 containing-block 수정 후 3/3 PASS를 얻었다.

## B-보완. 독립 리뷰의 guest 실패·새 탭 수정

두 P2 원본 재현, 수용한 수정, 범위: [INDEPENDENT_HOME_REVIEW.md](INDEPENDENT_HOME_REVIEW.md). 일회성 관찰용 Python 실행 exit 0은 당시 제품 PASS가 아니다. 503에서 raw `/auth/guest` 문서로 이탈해 공개 대안이 사라진 문제와 새 탭의 저장된 관전 목적지 소실을 각각 재현했다.

| 증거 | 실제 결과 | 검증 경계 |
|---|---|---|
| [guest-cors-platform-probe.json](evidence/guest-cors-platform-probe.json) | 실행 exit 0; **5 browser observations** | wildcard/follow 실패, exact+manual opaque redirect/cookie/native callback, exact+manual503 관찰. 실제 HTTP 두 origin의 플랫폼 검사이며 앱 DB/JWT 로그인 아님 |
| [home-guest-entry-command.log](evidence/home-guest-entry-command.log) | 당시 **exit0; 1 suite,8 Jest PASS**,118.135초 | 실제 guest HTTP/cookie/JWT/guard/UI와 격리 DB. fixture credential 주입 없음. current JSON은 아래 별도 실행 |
| 원래 임시 build에 대한 [독립 실행 기록](INDEPENDENT_HOME_REVIEW.md) | 당시 suite 내부 execFileSync build 성공; 두 독립 temp outputs | 당시 관측한 same app`96275d18`/split app`330aaff2`; defaultdist 쓰기 없음. 아래 latest build logs를 이 과거 실행의 log로 묶지 않음 |
| [login-review-fix-lint.log](evidence/login-review-fix-lint.log), [login-review-fix-tsc.log](evidence/login-review-fix-tsc.log), [login-review-fix-backend-build.log](evidence/login-review-fix-backend-build.log) | 각각 exit 0 (root 실행 기록) | scoped Login lint/타입/backend build. 빈 로그 자체가 성공 근거는 아님 |

[home-guest-entry.json](evidence/home-guest-entry.json)은 현재 `createdAt=04:14:28.655Z`의 최신8-result alias다. [same-origin build log](evidence/guest-entry-same-origin-build.log)도 `04:13:00.178Z`/hash`99110685ef45f988`, [split-origin build log](evidence/guest-entry-split-origin-build.log)는 `04:13:18.180Z`/hash`47fb5325a46729d5`로 갱신돼 있다. 이 세 파일은 아래 최신 root6-config의 guest8 PASS/112.415초를 지원하며, 위01:52의118.135초 실행과 같지 않다. 과거 JSON의 기록 당시 SHA와 현재 alias를 구별한다.

정확한 실행 명령, root cwd:

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node scripts/probe-guest-cors.cjs
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch backend/node_modules/jest/bin/jest.js --config backend/test/home-guest-entry-jest.json --runInBand --watchman=false > docs/home-online-polish/evidence/home-guest-entry-command.log 2>&1
```

8 tests는 동일/분리 origin 정상2, 동일/분리 service503 2, double-click1, pending cancel1, new-tab1, HTTP CORS/flag1이다. HTTP 하위 단언 수를 추가 Jest test로 세지 않는다. 정상은 guest GET/DB account/native callback 각각 1회; 503은 계정0·Login 유지·실제 AI 진입이다. pending cancel에서는 늦은 이동/소켓은 0이지만 이미 시작된 서버 guest 생성1이 있었다. 취소가 서버 side effect를 롤백했다고 주장하지 않는다. cross-origin은 동일 `127.0.0.1`의 다른 port이며 cross-site/subdomain 쿠키 정책은 미검증이다. 두 임시 서버/schema는 suite가 종료했다.

## 로컬·AI 추가 회귀

| 증거 | 실제 결과 | 실제 플레이 범위 |
|---|---|---|
| [local-browser-command.log](evidence/local-browser-command.log), [local-browser/p2-browser-report.json](evidence/local-browser/p2-browser-report.json) | exit 0 (root 실행 기록); **25 Python checks PASS** | Classic 로컬, Power/Normal AI 6점 완주·재시작; 두 키 입력/재지정/일시정지/resize/DPR; 공개 auth/socket 요청0 |
| [local-modes-command.log](evidence/local-modes-command.log), [local-modes/report.json](evidence/local-modes/report.json) | exit 0 (root 실행 기록); **31 Python checks PASS** | 실제 Power charge/action/6점 완주; AI 규칙2×난이도3 조합 각각 완주·재시작/route 정리 |
| [local-modes-environment-failure.log](evidence/local-modes-environment-failure.log) | Chrome launch 실패; exit exact는 원시 로그에 없어 unknown | 환경 실패; 플레이 성공 아님 |
| [initial-navigation-timing-local-modes-command.log](evidence/initial-navigation-timing-local-modes-command.log), [local-modes/initial-navigation-timing-report.json](evidence/local-modes/initial-navigation-timing-report.json) | 전체 FAIL; 초기13개 기록 중 route 정리 assertion 실패 포함 | 메뉴 이동 완료 전 즉시 검사한 **시험 대기 오류**. 실제 URL/diagnostic 해제를 기다리도록 고친 뒤 위31 PASS |

정확한 명령, root cwd, root 실행 문서 기록:

```sh
ARCADE_EVIDENCE_DIR=docs/home-online-polish/evidence/local-browser /opt/miniconda3/bin/python scripts/browser-check.py
/opt/miniconda3/bin/python scripts/browser-local-modes.py
```

이는 실제 Chrome의 synthetic input/관측에 의한 게임 완주다. Playwright의 가속 browser Clock을 사용하므로 기록된 경기 초나 진단 FPS/CPU를 실제 벽시계 성능 측정으로 해석하지 않는다. 사람이 물리 키보드로 플레이했거나 듣고 타격음을 확인했다는 주장으로 바꾸지 않는다.

## C. 온라인 회복 — 현재 확인된 중간 결과

다음 모든 exact command/cwd/exit는 [recovery-execution-record.json](evidence/recovery-execution-record.json)에 파일별로 보존된다. 그 기록이 후속 실행으로 확장될 수 있으므로 이 표의 스냅샷 범위와 구분한다.

| 로그/JSON | Exit와 실제 결과 | 분류 |
|---|---|---|
| [n1-browser-before.log](evidence/n1-browser-before.log), [n-player-recovery-before.json](evidence/n-player-recovery-before.json) | exit 0, **REPRODUCED** | 실제 guest2/경기. 단절 유예 후 동일 페이지가 전체 상태 대기에 남음. 제품 PASS 아님 |
| [n1-server-before.log](evidence/n1-server-before.log) | exit 1, **7 FAIL/14 PASS** | 신규 recovery 계약 실패; 원본14 통과 |
| [n1-server-after.log](evidence/n1-server-after.log) | exit 0, **21 PASS** | 해당 N1 server 단계 |
| [n1-unit-after.log](evidence/n1-unit-after.log) | exit 1; 앞5 configs106 PASS, client17 PASS/5 FAIL에서 중단 | readonly `performance`를 fake timer로 교체한 **시험 환경 오류**. 이후 config 실행 안 됨 |
| [n1-unit-timer-fix.log](evidence/n1-unit-timer-fix.log) | exit 0, **170 PASS/9 configs** = 21+43+16+16+10+22+8+13+21 | performance를 fake하지 않도록 harness 보정 후 실제 전체 실행. 앞선 수기149는21개 누락이므로 사용하지 않음 |
| [n1-online-after.log](evidence/n1-online-after.log) | exit 0, **15 PASS/3 configs** = 3+7+5 | 실제 격리 PostgreSQL/HTTP/Socket.IO. 사람/WAN 검증 아님 |
| [n1-browser-after.log](evidence/n1-browser-after.log), [n-player-recovery-after.json](evidence/n-player-recovery-after.json) | exit 1, FAIL; peer disconnect 대기65초 timeout | unattended 경기 종료가 먼저 일어나 시나리오 미도달. 제품 recovery 성공/실패 결론 없음 |
| [n1-browser-after-controlled.log](evidence/n1-browser-after-controlled.log), [n-player-recovery-after-closed-transport.json](evidence/n-player-recovery-after-closed-transport.json) | exit 0, **PASS** | 실제 guest full redirect, 동일 페이지의 저장 결과 복구와 rematch. 당시 backend63106/frontend hash `3b682e74d148bd63` |
| [n2-browser-before.log](evidence/n2-browser-before.log), [n-spectator-recovery-before-closed-transport.json](evidence/n-spectator-recovery-before-closed-transport.json) | exit 0, **REPRODUCED** | 플레이어 유지/관전자만 reconnect 후4초 tick 미진전. 제품 PASS 아님 |
| [n2-server-before.log](evidence/n2-server-before.log) | exit 1, **3 FAIL/22 PASS** | observer 계약 미구현; 늦은 요청 케이스의 resolver TypeError도 원본 보존 |
| [n2-server-after.log](evidence/n2-server-after.log) | exit 0, **25 PASS** | 당시 server 변경 검사 |
| [review-bindings-before.log](evidence/review-bindings-before.log) | exit 1, **1 FAIL/25 PASS** | pending save 중 반복 reconnect binding 잔존 재현 |
| [review-db-bound-before.log](evidence/review-db-bound-before.log) | exit 1, **1 FAIL/26 PASS** | 동시에 발행되는 복구 DB lookup bound 문제 재현 |
| [review-raw-ack-reproduction.log](evidence/review-raw-ack-reproduction.log) | **REPRODUCED**, exact command/exit unknown | 설치된 Socket.IO client4.5.1, 네트워크0;5100ms 뒤 ACK registry1/send buffer1 남음. 실제 네트워크 장애 아님 |
| [n2-server-final.log](evidence/n2-server-final.log) | exit 0, **27 PASS** | 위 binding/DB 제한 포함. 파일명의 final은 해당 server 검사 범위임 |
| [n2-client-final.log](evidence/n2-client-final.log) | exit 0, **24 PASS** | client recovery/설치된 ACK registry·buffer expiry 계약 |
| [n2-protocol-core-final.log](evidence/n2-protocol-core-final.log) | exit 0, **45 PASS** | protocol/core/AI 단위 범위 |
| [n1-frontend-noemit.log](evidence/n1-frontend-noemit.log), [n2-frontend-noemit.log](evidence/n2-frontend-noemit.log) | 각각 exit 0 | 타입 검사 |
| [n1-frontend-build.log](evidence/n1-frontend-build.log), [n2-frontend-build.log](evidence/n2-frontend-build.log) | 각각 exit 0; hash `3b682e74d148bd63` / `968743285e3c018c` | 두 시점 build. N2 browser나 온라인 전체 PASS를 뜻하지 않음 |

N1/N2 browser fault는 실제 브라우저 WebSocket close와 Playwright context offline/online의 **제어된 transport 단절**이다. 실제 browser/server time을 사용했고 게임/UI 상태를 주입하지 않았지만 WAN/TCP 장애·프로덕션 network resilience 증거는 아니다. 기존 fixture server log는 서버가 시작되었다는 증거일 뿐 검사 PASS가 아니다. 초기 색인 이후 확인한 N2 after/최종 부분 실패는 아래 후속 절에 추가했다.

## N3. clock/보간 baseline — 수정 전 실패

[clock-recovery-baseline.log](evidence/clock-recovery-baseline.log)는 **exit 1, Jest7 tests: 3 PASS/4 FAIL**이다. [clock-recovery-baseline.json](evidence/clock-recovery-baseline.json)은 **9 reports: 3 PASS/6 FAIL**이다. 반복 stall Jest1 test가3회의 report를 남기므로 두 단위가 다르며 둘 다 정확한 수치다. normal/200ms stall/jitter40ms는 통과,500ms/1000ms/반복 stall/pause-resume의 엄격한 재보간 경계가 실패했다.

root 실행 문서의 정확한 명령, backend cwd (Node18 PATH 사용):

```sh
ARCADE_CLOCK_REPORT=clock-recovery-baseline node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/clock-recovery-jest.json --runInBand --watchman=false
```

실제 `ServerMatchRunner`와 `SnapshotBuffer`를 사용하되 scheduler10ms/transit50ms/client sampling10ms를 **합성 clock**으로 제어한다. 기준은 재개300ms 이내 실제 두 post-resume snapshot 사이 tick/움직이는 좌표의 strict interpolation과 정확한 lerp다. network/WAN/실브라우저 재접속 시간 검증이 아니다. 수정 후 동일 기준과 추가 인스턴스 경계 검사는 아래 N3 후속 절에 기록했다. D 효과음/온라인 타격·최종 통합 완료를 N3 PASS에서 추정하지 않는다.

## C 후속 확인 — N2 grant와 마지막 브라우저 실행

exact command/cwd/exit의 출처는 실행자 [recovery-execution-record.json](evidence/recovery-execution-record.json), 상세 해석은 [N1_N2_REPORT.md](N1_N2_REPORT.md)다. 아래 숫자는 앞선 N1/N2 표와 중복 합산하지 않는다.

| 증거 | 실제 결과 | 해석 |
|---|---|---|
| [review-spectator-grant-before.log](evidence/review-spectator-grant-before.log) → [after.log](evidence/review-spectator-grant-after.log) | exit1,2 FAIL/27 PASS → exit0,29 PASS | 등록되지 않은 observer의 저장 결과 접근과 expired grant의 DB 조회 재현 후 수정 |
| [n2-server-grant-final.log](evidence/n2-server-grant-final.log), [n2-client-grant-final.log](evidence/n2-client-grant-final.log) | 각각 exit0; server30 PASS/client24 PASS | grant1000 bound·eviction/권한과 기존 ACK 정리. 이전 server27/client24의 재실행 포함 |
| [n2-online-final.log](evidence/n2-online-final.log), [n2-online-grant-final.log](evidence/n2-online-grant-final.log) | 각각 exit0,15 PASS=3+7+5 | 실제 격리 DB/HTTP/Socket.IO의 두 시점 재실행;30개 독립 test가 아님 |
| [n2-browser-after.log](evidence/n2-browser-after.log) | exit0,PASS; `02:01:51Z` | 세 actual guest, observer-only 복귀·tick 진전·input0. grant 추가 수정 전 build의 전체 성공 |
| [n1-browser-recovered-score-after.log](evidence/n1-browser-recovered-score-after.log) | exit1,PARTIAL/FAIL | 같은 페이지 결과/확인된 score 표시까지 확인한 뒤 rematch mouse click timeout; 전체 PASS 아님 |
| [n1-browser-grant-final.log](evidence/n1-browser-grant-final.log), [JSON](evidence/n-player-recovery-after-closed-transport-grant-final.json) | exit0,PASS; `02:15:28Z` | 실제 mouse click 뒤 양쪽 새 경기/tick 진행과 결과 복귀; 자동 navigation 대기 대신 실제 새 경기 단언 유지 |
| [n2-browser-grant-final.log](evidence/n2-browser-grant-final.log), [JSON](evidence/n-spectator-recovery-after-closed-transport-grant-final.json) | exit1,전체 FAIL; tick 진전 true/input0 뒤 screenshot15초 timeout | **기능 단언의 부분 성공과 캡처 실패**. 이 JSON을 전체 PASS로 바꾸지 않음 |
| [n2-browser-grant-final-retry.log](evidence/n2-browser-grant-final-retry.log), [JSON](evidence/n-spectator-recovery-after-closed-transport-grant-final-retry.json) | exit1,FAIL; observerTickAdvanced false | 캡처 제한45초 재시도에서 unattended 경기가 먼저 끝나 saved-result 화면이 됨. live-resubscription PASS로 재해석하지 않음 |
| [n2-frontend-grant-final-build.log](evidence/n2-frontend-grant-final-build.log) | build exit0/hash6e72dd88f6b178bb | GAME_DEBUG는 fixture guest/debug flag가 아님; 이 build로 browser 미실행 |
| [n2-frontend-grant-fixture-build.log](evidence/n2-frontend-grant-fixture-build.log) | exit0/hash7ec1f0d3183ec242 | 실제 guest/debug flags를 포함한 후속 browser build |
| [n2-backend-grant-final-build.log](evidence/n2-backend-grant-final-build.log), [frontend scoped lint](evidence/n2-frontend-final-scoped-lint.log), [backend scoped lint](evidence/n2-backend-final-scoped-lint.log) | 각각 exit0 | 빌드·소유 파일 nonfix lint이며 전체 repo lint 통과 아님 |

마지막 N2 browser가 완전한 성공 artifact를 남겼다고 주장하지 않는다. 지정 기능은 해당 grant-final 시도에서 확인됐지만 캡처까지 포함한 command가 실패했고 별도 재시도도 live 시나리오를 완료하지 못했다. WAN·실서버 재시작·장기간 보존은 여전히 이 증거의 범위 밖이다.

## N3 후속 확인 — 고정 strict 기준과 실제 fixture 회귀

실행자 [N3_CLOCK_REPORT.md](N3_CLOCK_REPORT.md)에 각 exact command/cwd/exit/log가 있다. 이 색인 작성자는 원시 요약과 JSON report 수를 대조했고 해당 시험을 직접 재실행하지 않았다.

| 원시 증거 | 실제 결과 | 검증 범위 |
|---|---|---|
| [clock-recovery-after.log](evidence/clock-recovery-after.log), [JSON](evidence/clock-recovery-after.json) | exit0,**7 Jest PASS/9 JSON reports PASS** | baseline과 같은 기준 유지; 반복3회가 Jest1 test |
| [n3-clock-final.log](evidence/n3-clock-final.log), [JSON](evidence/n3-clock-final.json) | exit0,**8 Jest PASS/10 JSON reports PASS** | 실제 다른 runner instance 경계1 test/report 추가; baseline의300ms strict interpolation 기준 완화 없음 |
| [n3-core.log](evidence/n3-core.log), [n3-snapshot.log](evidence/n3-snapshot.log), [n3-server.log](evidence/n3-server.log) | 각각 exit0;46/19/31 PASS | core·protocol·buffer·runner/N1/N2 server 계약 |
| [n3-client.log](evidence/n3-client.log) | exit0,27 PASS | 리뷰 보완 이전 client 검사 |
| [n3-review-ack-red.log](evidence/n3-review-ack-red.log) | exit1,**1 FAIL/27 미선택** | 승인 불가능한 다른-instance ACK가 owner timeout을 취소하는 결함 재현. 미선택27을 PASS로 세지 않음 |
| [n3-client-final.log](evidence/n3-client-final.log) | exit0,28 PASS | ACK 승인 전에 clock/instance 경계 확인하도록 수정 후 전체 client |
| [n3-frontend-contract.log](evidence/n3-frontend-contract.log) | exit0,10 PASS | frontend 소유권·계약 |
| [n3-online-integration.log](evidence/n3-online-integration.log), [n3-online-lifecycle.log](evidence/n3-online-lifecycle.log), [n3-service-preservation.log](evidence/n3-service-preservation.log) | 각각 exit0;3+7+5=**15 PASS** | 실제 JWT/Nest/Socket.IO/격리 PostgreSQL. 새 Chrome fault 검사는 아님 |
| [n3-reconnect-clock.log](evidence/n3-reconnect-clock.log) | exit0,**1 PASS/6 미선택** | 기존 lifecycle7 중1 test에 추가 epoch 단언을 넣어 선택 재실행. 위15에 다시 더하지 않음 |
| [n3-frontend-typecheck-final.log](evidence/n3-frontend-typecheck-final.log), [n3-frontend-lint-final.log](evidence/n3-frontend-lint-final.log), [n3-backend-build.log](evidence/n3-backend-build.log) | 각각 exit0 (실행자 기록) | 비어 있는 파일만으로 exit를 추정한 것이 아님; scoped lint |
| [n3-frontend-build.log](evidence/n3-frontend-build.log) → [final.log](evidence/n3-frontend-build-final.log) | 각각 exit0; hash21b898c02412d3eb → d47d4cedc84297c2 | 별도 `/private/tmp/ft-transcendence-n3-dist`, root 기본dist 변경 없이 실행 |

N3는 합성 scheduler의 실제 runner+buffer 결합과 실제 service fixture를 구분한다. stall500/1000/반복의 strict 보간은 재개155ms, pause-resume은205ms로 검사한300ms 이내에 도달했다. 다른 runner 객체 두 개의 경계 검사는 서버 프로세스 재시작/영속 경기 복원 검증이 아니다. N3 담당자가 새 Chrome 화면/WAN impairment를 실행했다고 주장하지 않았으며 이 색인도 그 경계를 유지한다. D event/audio 완료를 위 PASS에서 추정하지 않는다.

## 서비스 레이아웃 첫 보완과 같은 Home48 재실행

독립 서비스 검토의 exact 명령/시도/실패/이미지는 [SERVICE_LAYOUT_REVIEW.md](SERVICE_LAYOUT_REVIEW.md)에 있다.

- 고정 N1/N2 build의1440×900/390×844 실제 guest UI에서 Chat input폭0 click 실패와 Info Main의 Logout wrapper pointer interception을 재현했다. Board role locator 오류는 별도 시험 오류로 보존했다. 기존 CSS와 새 containing block의 상호작용을 관찰했고 baseline browser 미실행 상태에서 도입 시점을 단정하지 않았다.
- root의 첫 Info/Tfa/Chat scoped 보완 뒤 `home-service-layout-after-first.json` 및 `home-service-layout-after-first-command.log`는 **exit0,28 Python checks PASS**, `02:38:42Z`다. 두 viewport의 actual guest→실제 input draft/focus, Send native trial(무전송), Info/Tfa Main native click→Home을 확인했다. 원본 실패를 덮어쓰지 않았다.
- 첫 보완의 mobile input50.25px/Send153.9px, desktop Send488.5px와 Boardmobile document666px/title겹침은 화면을 열어 추가로 발견한 시각 잔여다. 이후 root가 compact Send와 자체 Board horizontal scroll region을 보완했고 별도의 최종37 PASS를 아래에 기록했다. 중간28 PASS를 최종 서비스 전체 완료로 소급 해석하지 않는다.
- [home-visual-n3-service-build-command.log](evidence/home-visual-n3-service-build-command.log), [latest JSON](evidence/home-visual-browser.json)은 기존 before와 같은59707 guest/저장 상태로 재실행한 **48 checks PASS, exit0**, `02:38:42.011159Z`다. root 실행자가 latest comparison PNG들을 열어 검토했다. 최초48과 중복 합산하지 않는다.

root가 직접 확인한 exact 명령과 cwd:

```sh
# frontend cwd, exit0, hash48d5f08ffe220840
PATH=/private/tmp/ft-transcendence-runtime/node_modules/.bin:$PATH VUE_APP_ENABLE_GUEST_LOGIN=true VUE_APP_ARCADE_DEBUG=true yarn build > ../docs/home-online-polish/evidence/service-layout-fix-flagged-build.log 2>&1
# root cwd, exit0,48 PASS
/opt/miniconda3/bin/python scripts/browser-home-visual.py http://127.0.0.1:59707 > docs/home-online-polish/evidence/home-visual-n3-service-build-command.log 2>&1
# root cwd, reviewer actual execution exit0,28 PASS
/opt/miniconda3/bin/python docs/home-online-polish/evidence/home-service-layout-after-probe.py http://127.0.0.1:50396 > docs/home-online-polish/evidence/home-service-layout-after-command.log 2>&1
```

직전 guest/debug flag 누락 서비스 build는 브라우저로 실행하지 않았으므로 제품 실패가 아닌 준비 설정 오류다. D/final build와 이 첫 보완 fixed build 결과를 섞지 않는다.

## D. 서버 확정 효과·오디오의 author-run 검증

정확한 command/cwd/exit와 동작 계약은 실행자 [D_FEEDBACK_REPORT.md](D_FEEDBACK_REPORT.md)에 있다. 색인 작성자는 아래 원시 Jest 요약을 대조했으며 단위 시험을 독립 재실행한 것은 아니다.

| 증거 | 실제 결과 | 분류와 범위 |
|---|---|---|
| [d-server-events-red.log](evidence/d-server-events-red.log) → [after](evidence/d-server-events-after.log) | exit1,2 FAIL → exit0,2 PASS | 실제 runner의 중간 tick 이벤트 누락·snapshot capture가 cadence를 지연시키는 제품 결함 재현/수정 |
| [d-audio-red.log](evidence/d-audio-red.log) | exit1,2 FAIL | 기존 음 노드의 mute/dispose 정리 결함 재현 |
| [d-review-gesture-red.log](evidence/d-review-gesture-red.log), [d-review-flash-red.log](evidence/d-review-flash-red.log) | 각각 exit1;1 FAIL/4 미선택,2 FAIL/28 미선택 | 독립 소스 리뷰의 비제스처 음 재사용·단절 뒤 frozen flash를 red로 확인. 미선택은 PASS 아님 |
| [d-feedback-expanded.log](evidence/d-feedback-expanded.log) | exit0,4 suites/**18 Jest PASS** | server3/presentation7/audio6/preference2. 서버 ring stress는 상태 준비가 있으며 정상 플레이로 주장하지 않음 |
| [d-client-expanded.log](evidence/d-client-expanded.log) | exit0,**34 Jest PASS** | fake DOM/transport의 실제 session/renderer/keyboard 소유 계약. 실제 Chrome 아님 |
| [d-online-services.log](evidence/d-online-services.log) | exit0,**15 Jest PASS**=3+7+5 | 실제 JWT/Nest/Socket.IO/격리 PostgreSQL 회귀. N3/앞 단계 재실행과 중복 합산하지 않음 |
| [d-typecheck-expanded.log](evidence/d-typecheck-expanded.log), [d-scoped-lint-final.log](evidence/d-scoped-lint-final.log), [d-runner-lint-final.log](evidence/d-runner-lint-final.log) | 각각 exit0 | frontend noEmit/소유 파일 lint/runner 단일 lint. 전체 저장소 lint PASS 아님 |
| [d-frontend-build.log](evidence/d-frontend-build.log) | exit0/hash`43e00e78cf2258df` | 별도 `/private/tmp/ft-transcendence-d-dist`; root default dist와 구분 |

초기 feedback4 PASS, 리뷰 후14 PASS/session30 PASS는 최종18/34의 중간 재실행이다. 각각을 합하지 않는다. Native AudioContext의 실제 오디오 출력 생성과 사람의 청취는 별개이며 위 단위 검사에서 둘 다 추정하지 않는다.

## 최종 서비스 레이아웃 — 독립 actual Chrome37 PASS

[home-service-layout-final.json](evidence/home-service-layout-final.json), [command log](evidence/home-service-layout-final-command.log), [전체 화면/한계](SERVICE_LAYOUT_REVIEW.md): reviewer 직접 실행 **exit0,37 Python checks PASS**, `03:14:15.117616–03:14:55.869672 UTC`. 고정 root build `4de1388331743be3`, 실제 app `/js/app.89b642c7.js`, 같은 소스 backend fixture52262, Chrome152의 실제 guest full callback이며 credential 주입이 아니다.

```sh
# root cwd; 실제 실행 exit0
/opt/miniconda3/bin/python docs/home-online-polish/evidence/home-service-layout-final-probe.py http://127.0.0.1:52262 > docs/home-online-polish/evidence/home-service-layout-final-command.log 2>&1
```

1440×900/390×844의 Chat·Info·Tfa·Board를 실제 Home sidebar로 열었다. 모바일 Chat input182.36px/Send71.64px, input actual draft/focus 및 Send native trial(무전송), Info/Tfa 실제 Main→Home을 확인했다. Board 자체 region에서 native ArrowRight scrollLeft0→442로 마지막 열 right374/hit-test true, body scrollX0/document390, title/account 충돌0을 확인했다. 최종11 PNG 모두 직접 image-view로 열었다. 정상 문서 스크롤은 허용하며 가로 넘침을 전역으로 숨기지 않았다.

Board의 기존 열 헤더는 모바일에서 조밀하게 붙는 시각 한계가 남고 table semantics는 변경하지 않았다.37 PASS는 document containment/주요 control/native 접근/헤더 충돌 해소이며 전면 typography 개선이나 채팅전송·2FA 설정·운영 기능 전체 PASS가 아니다. 두 context의 pageerror0/mailRequest0을 확인했고 contexts/Chrome은 닫았다. 초기 제품 실패와 시험 locator 오류, 첫28 PASS는 별도 이름으로 계속 보존한다.

## root 최종 통합 검사 — 완료된 기록만

[final-root-commands.json](evidence/final-root-commands.json)의 완료된 정확한 command/cwd/exit와 원시 요약을 대조했다. 후속 레코드는 아직 이 표에 포함하지 않는다.

다음225검사/build4de 표는 **접속 충돌 재시도 보완 이전**의 완료된 통합 실행이다. 뒤의233검사/build991 실행과 버전을 구분하며 이 표를 지우거나 새 build를 검사한 것으로 바꾸지 않는다.

| 증거 | 실제 결과 | 의미 |
|---|---|---|
| [final-unit.log](evidence/final-unit.log) | exit0,11 configs/**225 Jest PASS**=21+8+18+47+16+19+10+34+8+13+31 | 최종 통합 단위/회귀. 앞 단계 동일 테스트와 합산하지 않음 |
| [final-frontend-noemit.log](evidence/final-frontend-noemit.log), [final-backend-build-formatted.log](evidence/final-backend-build-formatted.log) | 각각 exit0 (실행자 record) | 타입/빌드. 빈 noEmit 로그만 보고 성공을 추정한 것이 아님 |
| [final-frontend-build.log](evidence/final-frontend-build.log) | exit0, hash`4de1388331743be3`, build 시각`03:10:38.005Z` | 서비스37에 사용한 build. 정확한 command/cwd/exit는 최신 root record의 `final-frontend-build` |
| [final-frontend-lint.log](evidence/final-frontend-lint.log) | exit1;**1 error/61 warnings** | baseline1/64 대비. 기존 score 혼합 들여쓰기 error 잔존 |
| [final-backend-lint.log](evidence/final-backend-lint.log) → [verified](evidence/final-backend-lint-verified.log) | 둘 다 exit1;1884 errors/32 warnings → **1857 errors/32 warnings** | baseline1858/32 대비 첫 통합 새 format26 오류가 있어 소유 새 코드만 보완. repo 전체 lint PASS 아님 |
| [final-lint-comparison.json](evidence/final-lint-comparison.json) | frontend/backend **추가 line diagnostic0**, untracked src 포함 | 범위 비교 결과. 전체 lint 실패를 무효화하지 않음 |

### 접속 충돌 재시도 보완 후의 완료된 소스 검사

[E_CONNECTION_RETRY_REPORT.md](E_CONNECTION_RETRY_REPORT.md)는 **정확한 active-owner 충돌**에 한정한 route 소유 disconnect·원인 안내 유지·명시적5초 재시도를 설명한다. 일반 transport 자동 재연결 변경이 아니다. 기존 두 탭 재현은 자동 복귀 부재라는 가설을 반증했으며 실제 결함은 owner가 살아 있을 때 반복 연결과 사라지는 이유였다. 이 색인에서 그 가설을 확인된 결함으로 바꾸지 않는다. 세 route의 완료된 actual browser 결과는 아래에 기록한다.

| 최신 원시 증거 | 실제 결과 | 적용 범위 |
|---|---|---|
| [final-unit-after-connection-retry.log](evidence/final-unit-after-connection-retry.log) | **233 Jest PASS**,11 configs, exit0(root 실행 결과) =29+8+18+47+16+19+10+34+8+13+31 | navigation21+새 helper8이29로 확장됨. 이전225와 합산하지 않음 |
| [final-frontend-build-after-connection-retry.log](evidence/final-frontend-build-after-connection-retry.log) | exit0(root 실행 결과), hash`99110685ef45f988`, 실제 build 시각`04:08:49.939Z` | 기존 build4de와 다른 artifact. build 내부 lint 경고54는 전체 src lint 경고61과 검사 범위가 다름 |
| [final-frontend-lint-after-connection-retry.log](evidence/final-frontend-lint-after-connection-retry.log), [comparison](evidence/final-lint-comparison.json) | **exit1**,전체src **1 error/61 warnings**, 추가 line diagnostic0 | 기존 실패 유지. comparison의 latestLogs가 이 frontend 로그와 기존 backend verified 로그를 명시한다. exact command/cwd/exit는 최신 root record에 있음 |
| [final-bundle-boundary.json](evidence/final-bundle-boundary.json) | **PASS, 실제 webpack modules454**, backend/Nest/TypeORM/pg0 | report SHA`0b796bf64d3ef63e3a34f6d2edc03e898429535d9dd9ede7054e739e1a85b224`, build991 확인. shared AI/fixed-clock/game-core/protocol4개 포함. 소스 문자열 검색만의 주장 아님 |

root가 전달한 완료 결과와 로그 요약을 직접 대조했다. 위 새 unit/build/lint/분석/bundle의 exact 전체 command/cwd/exit는 최신 [root record](evidence/final-root-commands.json)의 `runs`에 있다. 색인 작성자가 이 명령을 재실행했다고 쓰지 않는다. 별도 author의 helper29/기존수명10/noEmit/scopedlint는 E 보고서에 정확한 command/cwd/exit가 있다. 첫 fake-timer8실패와 다음 타입 컴파일 실패는 환경/시험 설정 문제이며 제품 red가 아니다. Home·서비스·로컬 actual Chrome은 각각 명시한 고정 build의 증거이며 최신 source 통합 결과와 버전을 구분한다.

## E 온라인 browser — 현재까지 완료된 시도

정확한 command/cwd/exit는 [final-online-execution-record.json](evidence/final-online-execution-record.json)이다. 해당 Jest wrapper는 선택한 browser case 묶음을 **Jest1 test**로 실행하므로 Python 내부 check 수와 혼동하지 않는다. 아래는 현재 완료된 서로 다른 시도이며 이후 all 실행 성공을 추정하지 않는다.

| 증거 | 실제 결과 | 적용 범위와 미도달 |
|---|---|---|
| [e-final-online-first.log](evidence/e-final-online-first.log), [JSON](evidence/final-online-first/online-final-browser.json) | exit1,전체 FAIL | 실제6:1 완주·mouse rematch case PASS 후 observer의 짧게 바뀌는 status 문구 대기 timeout. stable tick/input, effects 및 post-browser DB 단언 미도달 |
| [e-final-online-observer.log](evidence/e-final-online-observer.log), [JSON](evidence/final-online-observer/online-final-browser.json), [DB 관찰](evidence/final-online-observer/online-final-persistence.json) | exit0,선택한 observer case PASS; Jest1 PASS/74.842초 | 새 native WebSocket·증가 generation·같은 live 경기/tick·observer app/native input0, players 연결수 불변. PNG 후 양쪽 player live/same match 재확인. input0은 첫 이 시도에서 PNG 전 측정. 완료 DB 결과0은 정상 관찰이며6점 저장 증거 아님 |
| [e-final-online-effects.log](evidence/e-final-online-effects.log), [JSON](evidence/final-online-effects/online-final-browser.json) | exit1,전체 FAIL; 앞5 feedback 단언 PASS | 서버 타격→실제 native canvas flash/default mute, native AudioContext·oscillator 제스처 활성화, mute/OS·사용자 reduced motion 확인. WASD 선택 뒤 정상 경기 종료 overlay가 court click을 막아 key/route-dispose 및 post-browser DB 단언 미도달 |
| [e-final-online-effects-retry.log](evidence/e-final-online-effects-retry.log), [JSON](evidence/final-online-effects-retry/online-final-browser.json) | exit1,전체 FAIL | WASD HUD/실제 outgoing movement·arrow 비활성, default-muted hit/flash, native audio unlock까지 PASS. mute 검사에서 누적 skipped event를 strict guard가 감지하여 mute/motion/cleanup 성공으로 판정하지 않음 |
| [e-final-online-effects-stable.log](evidence/e-final-online-effects-stable.log), [JSON](evidence/final-online-effects-stable/online-final-browser.json), [DB 관찰](evidence/final-online-effects-stable/online-final-persistence.json) | exit0,선택한 effects case PASS; Jest1 PASS/76.202초, Python63.771초 | 실제 키/HUD/outgoing input, default mute/server hit/native flash, native AudioContext·oscillator unlock, mute, 시스템/사용자 reduced motion, route context close, 설정 복원 뒤 no-autostart까지 PASS. mute는 이전 skip 경계2회(각6개)를 기록하고 새 안정 구간을 잡았으며 음 수 불변은 첫 경계 전부터 유지. motion 구간 재설정0. 실제 DB6:1 행은 관찰값이며 선택한 effects case에 match-case 저장 최소 단언을 적용하지 않음 |
| [e-final-harness-lint.log](evidence/e-final-harness-lint.log) → [test override](evidence/e-final-harness-lint-test-override.log) → [final](evidence/e-final-harness-lint-final.log) | exit1 parser 범위 오류 → exit1 Prettier22 → exit0 | 기존 tsconfig가 test를 제외해 명시적으로 이 새 파일만 parser project:null로 읽고 기존 규칙을 유지. reviewer-owned wrapper만 기존 formatter로 정리. production/config/단언 변경 없음 |

이 harness의 legal keyboard follower는 실제 입력을 보내 경기를 유지하는 자동 관찰 보조다. 게임 상태를 설정해 완료시킨 것은 아니지만 사람의 플레이/물리 키보드/실제 청취/WAN 장애 검증도 아니다. NativeCanvas/Audio/WebSocket 관측 wrapper는 원래 구현으로 위임한다. 독립 소스 읽기 검토는 [INDEPENDENT_ONLINE_REVIEW.md](INDEPENDENT_ONLINE_REVIEW.md)에 있으며 실행 PASS로 추가 계산하지 않는다. 당시 `check-arcade.cjs browser`에는5 configs가 등록되었고 이후 접속 충돌 회귀를 추가해6개가 되었다. 등록 자체는 성공이 아니며 실제 묶음 실행의 두 실패와 후속 개별 성공을 아래에 분리한다. 정확한 명령/exit는 최종 root·online 실행 기록에 있다.

### 그 뒤 실제 통합·진단과 접속 충돌 회귀

첫 root5-config의 정확한 command/exit는 [final-root-commands.json](evidence/final-root-commands.json)의 `final-browser`, 독립 all 및 충돌 수정 전 진단은 [final-online-execution-record.json](evidence/final-online-execution-record.json)에 있다. 다음 실행을 앞선 transient 문구 대기 실패와 혼동하지 않는다.

| 증거 | 실제 결과 | 남는 경계 |
|---|---|---|
| [첫 root group](evidence/final-browser-command.log) | wrapper **exit1**; 앞4 configs13 PASS=8+3+1+1, 마지막 config1 FAIL | 마지막 case의6점·mouse rematch는 완료했지만 observer native 연결2개 생성/열림0·과거 generation/tick에 남음. 종료 원인 진단이 없어 원인 **UNRESOLVED**. transient selector 실패라고 단정하지 않음 |
| [진단 all log](evidence/e-final-online-diagnostic-all.log), [browser JSON](evidence/final-online-diagnostic-all/online-final-browser.json), [DB JSON](evidence/final-online-diagnostic-all/online-final-persistence.json) | **exit0**,선택한 전체3 cases/Jest1 PASS,175.014초 | build4de에서 실제0:6·mouse rematch, 관전자 자신의 새 연결/generation/tick/input0을 PNG 후에도 확인, 실제 native key/event/audio/motion/정리. DB completed4/six-point1/6:0 정식 단언. offline 중 연결 실패 뒤 새 연결 회복을 관찰했지만 이전 root 실패 원인은 증명하지 않음 |
| [충돌 수정 전](evidence/e-rejected-session-churn-before.log), [JSON](evidence/rejected-session-churn-before/online-rejected-session.json) | **exit1,REPRODUCED**; Python23.182/Jest44.401초 | 별도 두 탭의 정확한 충돌 뒤6초 추가연결5회·원인 문구 소실, 원래 owner 보호. owner 종료 뒤 거절 탭은 같은 페이지에서 **자동 복귀**함. 영구 자동복귀 부재 가설을 반증한 사실을 보존 |
| [새 root6-config group](evidence/final-browser-after-connection-retry-command.log), [충돌 after JSON](evidence/final-browser-after-connection-retry/online-rejected-session.json) | wrapper **exit1**(root 실제 session66229); 앞4 configs13 PASS=1+8+3+1, 다음 lifecycle1 FAIL, 마지막 all **NOT_RUN** | build991에서 충돌 after는 game/invite/spectate3 cases PASS(Python70.844/Jest82.756초). 다른 lifecycle 시험은 offline-only 후 peer 일시정지 표시를30초 안에 관찰하지 못함. 이후 단계의 pause/resume/세션 및 final all 성공을 추정하지 않음 |

새 충돌 after의 세 route는 exact conflict·원인 안내·6초 추가시도0·기존 owner보호·원래 server generation 해제·추가0.75초 stopped·같은 페이지 실제 재시도 버튼의 정확히1회 연결·idle input0을 검사했다. **idle lobby/transport** 검사이며 세 route의 활성 경기 복구를 모두 플레이한 증거는 아니다. namespace DISCONNECT를 요구했던 앞선 두 실패는 가설 기반 시험 조건의 실패로 실행 기록에 남으며 영구 자동복귀 부재의 제품 재현으로 집계하지 않는다.

새6-config lifecycle의 offline-only 실패는 당시 peer 일시정지 표시를 관찰하지 못한 결과이며 원인은 확정되지 않았다. 후속 시험은 실제 브라우저의 기존 WebSocket을 닫고 Playwright의 WebSocket routing으로 실제 서버에 전달하면서 잠시 새 연결 시도만 차단하도록 fault를 명시했다. 응답·경기 상태·점수를 성공으로 설정하지 않았으며 원래 pause/resume·소유 계약 단언을 유지했다. 새 root6-group 전체 명령/exit는 [root 기록](evidence/final-root-commands.json)의 `runs` 중 `final-browser-after-connection-retry`에 있다.

| 후속 개별 실행 | 실제 결과 | 원래 실패와 구분할 한계 |
|---|---|---|
| [controlled lifecycle 첫 실행](evidence/e-final-lifecycle-controlled.log) | **exit1**,Jest74.353초 | pause/recovery와 화면 캡처 뒤 duplicate frame 관측의 namespace JSON parser가 실패. `42/game,[]`를 고정 slice로 읽은 **시험 parser 오류**를 확인했다. 앞선 offline-only 실패의 원인으로 소급하지 않음 |
| [parser 수정 lifecycle](evidence/e-final-lifecycle-controlled-parser-fixed.log), [JSON](evidence/final-lifecycle-controlled-parser-fixed/p4-online-lifecycle-browser.json) | **exit0,1 Jest PASS**,59.053초 | 실제200ms 동안 tick317→317, 새 generation/같은 match·side/peer 진행, 다른 active tab 거절과 owner 유지, 명시적 포기 종료, pageerror0. 실제 서버에 전달하는 Playwright routed transport이며 untouched native handshake/WAN 검증 아님 |
| [최종 all991](evidence/e-final-online-after-conflict.log), [browser JSON](evidence/final-online-after-conflict/online-final-browser.json), [DB JSON](evidence/final-online-after-conflict/online-final-persistence.json) | **exit0,1 Jest PASS/3 cases PASS**,Jest170.514초/Python159.829초 | 실제0:6 완주·native mouse 새 경기 재대결·메뉴 정리, 관전자 단독 새 연결/generation·같은 live 경기·tick 진행·캡처 전후 input0·players 연결수 불변, 실제 키 패킷과 서버 타격·canvas·audio·motion·정리. 실제 fixture DB completed4행/six-point1행/6:0의 정식 단언 통과 |

두 개별 실행의 정확한 command/cwd/exit는 [final-online-execution-record.json](evidence/final-online-execution-record.json)의 `e-final-lifecycle-controlled-parser-fixed`, `e-final-online-after-conflict`다. P4의 차단 gate는 실제611ms였고 그 사이 새 연결 시도가 없었으므로 **새 시도 차단 branch는 미실행**이다. 기존 browser connection의 실제 close/reopen과 서버 pause/resume은 관측했다. 이 suite의 인증은 fixture credential로 준비했으므로 실제 guest UI 로그인 시험과 구분한다. P4 PNG는 실행자와 root가 열었고, 색인 작성자는 원시 JSON/log를 대조했다.

최종 all의 mute 안정 구간에는 새 skip0, OS motion은 앞선 skip1 경계 뒤1회 재설정, 수동 motion은 skip3/2 경계 뒤2회 재설정이 있었다. 받아들인 각 구간의 새 skip은0이며 음·draw 불변 기준은 이전 경계 전부터 유지했다. native AudioContext1/oscillator1과 server paddle12/white draw11은 서로 다른 단위이며 draw11을11개의 독립 타격으로 세지 않는다. 이 실행은 실제 guest 생성과 격리 DB를 사용했다. 담당자가 새5 PNG를 모두 열었고 root도 결과·관전·effects3장을 열었다. contexts/자체 fixture는 종료했다. 성공한 후속 observer 회복으로 앞 root5-config의 **원인 미확정 observer 실패**를 지우거나 그 원인을 증명하지 않는다.

최종6 configs를 **개별 성공한 명령들**로 집계하면 아래와 같다. 앞4개는 실패한 root6 wrapper에서 완료되었고 뒤2개는 별도 명령으로 완료되었다. **합계15 Jest PASS는 단일 wrapper exit0을 뜻하지 않는다.**

| config | 성공한 Jest tests / 시간 | 실행 출처 |
|---|---|---|
| online-rejected-session-browser | 1 /82.756초; 내부3 route cases | root6 group, build991 |
| home-guest-entry | 8 /112.415초 | 같은 root6 group; latest guest JSON04:14:28.655Z |
| home-auth-prerequisites | 3 /41.803초 | 같은 root6 group; latest prerequisite JSON04:15:11.457Z |
| online-browser | 1 /51.944초 | 같은 root6 group |
| online-lifecycle-browser | 1 /59.053초 | 위 controlled parser-fixed 개별 명령 |
| online-final-browser | 1 /170.514초; 내부3 cases | 위 final all991 개별 명령 |

개별15와 별도 Home Python48/18/4, 로컬 Python56, service Python37은 서로 다른 단위와 실행이므로 더하지 않는다. 기존 전체 wrapper 실패2회, 제어 시험의 parser 실패, 미실행 fault branch, 실제 청취·WAN·외부 OAuth의 미검증 범위를 함께 남긴다.

## 최종 Home group — 독립 실행3명령 성공

정확한 command/cwd/실제 exit는 reviewer [final-home-execution-record.json](evidence/final-home-execution-record.json), 전체 출력은 [final-home-command.log](evidence/final-home-command.log)이다. **wrapper process exit0**, `All 3 home browser commands completed successfully.`를 실제 확인했다. 고정 build `4de1388331743be3`/app`app.89b642c7.js`와 root 소유 backend52262/static4173을 사용했다. 원래 matched before/after PNG는 보존하고 새 `final-home/` 폴더에 출력했다.

```sh
# repository cwd; reviewer directly observed exit0
PATH=/private/tmp/ft-transcendence-runtime/node_modules/.bin:$PATH ARCADE_PYTHON=/opt/miniconda3/bin/python ARCADE_DEMO_URL=http://127.0.0.1:52262 ARCADE_PREVIEW_URL=http://127.0.0.1:4173 ARCADE_EVIDENCE_DIR=/Users/sm/dev_park/ft_transcendence_project/docs/home-online-polish/evidence/final-home node scripts/check-arcade.cjs home > docs/home-online-polish/evidence/final-home-command.log 2>&1
```

| 최종 기록 | 실제 결과 | 범위 |
|---|---|---|
| [visual JSON](evidence/final-home/home-visual-browser.json) | **48 Python checks PASS**, 시작 기록`03:35:39.025324Z` | 네 viewport Home CTA/실제 로컬·AI 진입/온라인 lobby, 키·모션·초점·200%·긴 닉네임·실제 공개3경로 요청0. 새 guest이므로 원래 matched baseline 계정 재현이라고 주장하지 않음 |
| [auth JSON](evidence/final-home/auth-navigation-20260908T033906Z.json) | **18 Python checks PASS**,156.347초 | 실제 guest full callback 목적지/TTL·외부 intent·취소·공개 backend 차단·친구 empty/error·실패 logout 정리. disabled build/실제 expired JWT·nickname/2FA prerequisite suite 재실행은 이18에 포함하지 않음 |
| [navigation JSON](evidence/final-home/after-navigation-20260908T034003Z.json) | **4 PASS+1 OBSERVED**,55.711초 | 실제 친구 선택→초대 대상→거절·수락→양쪽 court, spectator empty/withheld-request timeout/retry, back/forward2회·online socket1/Home RAF0·leave1 |

이번 실행 전 `browser-home-auth.py`와 `browser-home-navigation.py`의 evidence out만 `ARCADE_EVIDENCE_DIR`/기존 경로 fallback으로 바꾸었다. 기존 alias 덮어쓰기를 막는 reviewer-owned 시험 출력 변경이며 production·단언은 변경하지 않았다. 두 스크립트의 실제 `py_compile` exit0를 [기록](evidence/final-home-output-path-compile.log)에 남겼고 bytecode는 `/private/tmp`에만 썼다. 이 구문검사를 새 제품 테스트로 세지 않는다.

새 PNG9장을 reviewer가 모두 image-view로 실제 열었다: [Home1440](evidence/final-home/after-home-1440x900.png), [1366](evidence/final-home/after-home-1366x768.png), [1024](evidence/final-home/after-home-1024x768.png), [390](evidence/final-home/after-home-390x844.png), [200%](evidence/final-home/after-home-200percent.png), [긴 닉네임390](evidence/final-home/after-home-long-nickname-390x844.png), [Login](evidence/final-home/after-login-1440x900.png), [공개 hub](evidence/final-home/after-play-hub-1440x900.png), [온라인 lobby](evidence/final-home/after-online-lobby-1440x900.png). 1440/1366/1024의3개 CTA는 첫 viewport에 있으며390은 세로 단일 열로 스크롤한다. 200%는2열 재배치와 card 내부 control 접근을 확인했다. PNG는 full-page여서 전체 높이는 viewport 높이와 다르지만 같은 viewport 크기로 렌더링했다. 이9장은 동일 계정의 원본 before/after 비교를 대체하지 않는다.

실행 종료 뒤 모든 Chrome contexts와 subprocess가 닫혔음을 확인하고 root에 Chrome을 반환했다. root 소유 서버·기본dist는 변경/종료하지 않았다. 세 명령의 이전48/18/4 PASS와 최종 값을 합산하지 않는다. 실제 게임 진입은 실행했지만 이 Home group이 새6점 완주·외부 로그인·사람의 직접 플레이를 검증했다고 주장하지 않는다.

### 새 build991에서 Home 화면과 메뉴만 추가 재검증

접속 충돌 재시도 변경 뒤 root가 지정한 **build`99110685ef45f988`**, fixture52262/static4173에서 reviewer가 다음 두 명령을 직접 실행했다. 각각 실제 **exit0**(visual session12359/navigation session50424)이며 exact command와 결과는 [같은 실행 기록](evidence/final-home-execution-record.json)에 추가했다. 새 app은 `app.f9b85f4e.js`, index SHA는 `e60b86fcc3aa8596dd33c3250bfbc7c7d171ceeade93b6bc2c256b93189a735a`였다. 이전 source/bundle에서의 성공을 가져온 것이 아니다.

```sh
# repository cwd, each actual exit0; separate commands, auth18 not rerun
ARCADE_PREVIEW_URL=http://127.0.0.1:4173 ARCADE_EVIDENCE_DIR=/Users/sm/dev_park/ft_transcendence_project/docs/home-online-polish/evidence/final-home-after-connection-retry /opt/miniconda3/bin/python scripts/browser-home-visual.py http://127.0.0.1:52262 > docs/home-online-polish/evidence/final-home-after-connection-retry-visual-command.log 2>&1
ARCADE_EVIDENCE_DIR=/Users/sm/dev_park/ft_transcendence_project/docs/home-online-polish/evidence/final-home-after-connection-retry /opt/miniconda3/bin/python scripts/browser-home-navigation.py http://127.0.0.1:52262 --phase after > docs/home-online-polish/evidence/final-home-after-connection-retry-navigation-command.log 2>&1
```

[새 visual JSON](evidence/final-home-after-connection-retry/home-visual-browser.json)/[log](evidence/final-home-after-connection-retry-visual-command.log)는 **48 PASS**, 시작 기록`04:21:11.189731Z`다. [새 navigation JSON](evidence/final-home-after-connection-retry/after-navigation-20260908T042325Z.json)/[log](evidence/final-home-after-connection-retry-navigation-command.log)는 **4 PASS+1 OBSERVED**,67.055초/pageerror0다. 실제 친구 대상·거절·수락·양쪽 초대 court·관전 목록 empty/timeout/retry·back-forward2회/소켓1·Home RAF0·leave1을 확인했다. 독립 auth18은 이번 선택 실행에서 반복하지 않았다.

새9 PNG를 모두 직접 image-view로 열었다: [1440](evidence/final-home-after-connection-retry/after-home-1440x900.png), [1366](evidence/final-home-after-connection-retry/after-home-1366x768.png), [1024](evidence/final-home-after-connection-retry/after-home-1024x768.png), [390](evidence/final-home-after-connection-retry/after-home-390x844.png), [200%](evidence/final-home-after-connection-retry/after-home-200percent.png), [긴 닉네임390](evidence/final-home-after-connection-retry/after-home-long-nickname-390x844.png), [Login](evidence/final-home-after-connection-retry/after-login-1440x900.png), [공개 hub](evidence/final-home-after-connection-retry/after-play-hub-1440x900.png), [online lobby](evidence/final-home-after-connection-retry/after-online-lobby-1440x900.png). 새 시각 차단은 발견하지 않았다. fresh guest/full-page/synthetic input 경계는 앞 실행과 같고, 원래 같은 계정의 matched before/after와 이전`final-home/`를 보존했다. 앱 소스·단언·서버·기본dist를 이 재검증에서 변경하지 않았고, 두 browser 종료 뒤 root에 Chrome을 반환했다.

## 최종 로컬·AI group — root 실행25+31 PASS

root 실행자가 실제 session36485의 **exit0**를 전달했고 [final-local-command.log](evidence/final-local-command.log)의 `All 2 local-browser browser commands completed successfully.` 및 두 JSON을 대조했다. 색인 작성자는 이 browser group을 다시 실행하지 않았다. 정확한 root cwd 명령은 다음과 같다.

```sh
PATH=/private/tmp/ft-transcendence-runtime/node_modules/.bin:$PATH ARCADE_PYTHON=/opt/miniconda3/bin/python ARCADE_EVIDENCE_DIR=/Users/sm/dev_park/ft_transcendence_project/docs/home-online-polish/evidence/final-local node scripts/check-arcade.cjs local-browser > docs/home-online-polish/evidence/final-local-command.log 2>&1
```

| 기록 | 실제 결과 | 최종 검증 내용 |
|---|---|---|
| [p2-browser-report.json](evidence/final-local/p2-browser-report.json) | **25 Python checks PASS** | 실제 두 키 동시입력/반대입력 중립, pause/resume·blur·키 재지정·폼·resize/DPR, Classic 로컬6:0 종료·재시작·route정리, Power/Normal AI2:6 종료·재시작. 서비스·외부 요청0/pageerror0 |
| [report.json](evidence/final-local/report.json) | **31 Python checks PASS** | 실제5회 반환 뒤 Power키 활성화·확장 paddle, 로컬Power0:6 종료·재시작. AI Classic/Power 각각 Easy1:6·Normal2:6·Hard0:6 종료와 난이도별 지연 관측·재시작·session정리. 서비스·외부 요청0/pageerror0 |

총56은 이 실행의 Python check 수이며56개 독립 경기나 앞선25/31과 더한112개 시험이 아니다. 실제 브라우저·실제 공통 코어를 사용하되 **Playwright 가속 Clock과 synthetic keyboard**로 진행했고 read-only 진단만 읽었다. 경기 상태를 써서 점수/승패를 만든 시험이 아니며 물리 키보드/사람의 청취/실시간 성능 검증도 아니다.

새 폴더에는 PNG13장이 있다. root는 `local-power-active.png`와 `ai-power-hard-finished.png`를 직접 열었다고 기록했다. reviewer는 다음 대표6장을 별도로 직접 image-view로 열었다: [작은 hub](evidence/final-local/hub-small-screen.png), [Classic 로컬 종료](evidence/final-local/local-finished.png), [Power 로컬 종료](evidence/final-local/local-power-finished.png), [Classic Hard AI 종료](evidence/final-local/ai-classic-hard-finished.png), [Power Easy AI 종료](evidence/final-local/ai-power-easy-finished.png), [Power Normal AI 종료](evidence/final-local/ai-finished.png). 종료 점수/승자/재대결·모드 복귀가 서로 가리지 않았고, 작은 hub의3카드는 정상 세로 배치로 보였다. 추가 시각 차단은 발견하지 않았다.13장 전부를 reviewer가 열었다는 주장은 하지 않는다.

작은 hub는 script의 **640×900 viewport/DPR2**에서 full-page 캡처한1280px 폭 이미지다. 최종 Home group의390×844 검사와 구분한다. 기본 게임 캡처도 DPR2일 수 있어 PNG 픽셀 수를 CSS viewport 크기로 바꾸어 주장하지 않는다. 이미지 안의 분석 진단은 가속 Clock에서의 관측이며 실제 latency/FPS 벤치마크가 아니다.

## 중복, 변경 가능 파일, 남은 경계

- `after-auth-navigation-browser.json`은 `auth-navigation-20260908T011312Z.json`과 같은18 checks의 latest alias다. `after-auth-navigation-filtered.json`은 flag-off1개의 alias다. `after-navigation-browser.json`은 `after-navigation-20260908T012107Z.json`과 같은 최종4PASS+1OBSERVED의 alias다. 추가 실행수로 세지 않는다.
- Home latest48은 앞선39/40/44의 확장 재실행이다. baseline136, B158, N1 170은 상당수 같은 검사를 다시 실행한 값이다. server21/25/27 역시 버전별 재실행이며 합계73개의 독립 test가 아니다.
- JSON `results`, `checks`, `reports` 길이는 Jest test 수가 아니다. navigation의 OBSERVED record를 PASS로 바꾸지 않는다. guest8 tests에는 복수 HTTP assertions가 있지만 JSON도8 results이며 clock9 report 문제와 혼동하지 않는다.
- 과거 guest evidence metadata 보완은 실제 결과를 유지하면서 default dist 쓰기 범위를 명확히 하고 검증하지 않은 opener 필드를 제거한 사실이다. 그 보완만을 새로운 테스트로 세지 않는다. 이후04:14/04:15의 guest/prerequisite 재실행이 latest alias를 다시 갱신했으므로 과거 log와 현재 alias를 같은 실행으로 묶지 않는다.
- 최초02:06 색인에서 확인한 별칭의 SHA256(후속 파일 버전과 구분): `home-visual-browser.json` = `aece6be27d13e72ce0c91a74451ed48d864226cbf440e2f661b9221ed65668e8`; `home-guest-entry.json` = `fc34ff78ee9ff1244db7d84625b5e20c780cca40921462ef9b8188e15237044d`; `clock-recovery-baseline.json` = `399b637a2dd360369bc6827fedec74d6e14aff5912f4ae9638241985c5f2bf8a`. 이후 파일이 바뀌면 이 수치가 새 결과에 대한 주장으로 간주되지 않는다. Home latest는02:38:42의 새48검사로 갱신되었고 그 원시 JSON은 `home-visual-n3-service-build-command.log`에도 보존된다.
- 모든 테스트의 PASS에서 외부42 OAuth, 실제 메일 전달, 원격WAN, 다른 브라우저 전체호환, 사람의 오디오 청취, 운영 데이터/배포 검증을 추론하지 않는다. Home 완료, 로컬·AI 실제 완주, 온라인 recovery 및 clock/effect 완성도는 별도로 판정한다.

## 전달 직전 상태와 예정 패킷

[final-delivery-live-gate.json](evidence/final-delivery-live-gate.json)은 root가 **04:37:25 UTC**에 확인한 exact API URL/결과다. main SHA는 같은 `2f11bee69c2d55ed938b53f9750119a890396fb7`, open issues/PR 각각 첫100개 페이지0으로 전체 open 목록이 비었다. 관련 issue 상세/PR diff는 N/A다. `git fetch origin`의 초기 sandbox exit255(`FETCH_HEAD` 쓰기 불허)는 **환경 실패**로 보존하고 허용된 재실행 exit0와 구분한다. 색인 작성자가 조회나 fetch를 새로 실행한 것은 아니다.

[final-delivery-runtime-state.json](evidence/final-delivery-runtime-state.json)은 root의 **04:38:16.519069 UTC** 기록이다. main 단일 worktree/HEAD=originMain, staged0, 보존 대상 경로 diff0, `git diff --check` exit0, 공개4173 `/play`와 fixture52262 `/login`의 실제 HTTP200을 기록했다. HTTP200은 프로세스 생존 확인이며 새 플레이 시험이 아니다. 미커밋 변경 파일 목록은 이 JSON에 있고 자동 commit·push·배포는 하지 않았다.

마지막 독립 문서 감사에서는 별도 navigation reviewer가 루트 최종 TEST/IMPLEMENTATION/REVIEW 문서를 원시 로그·JSON과 읽기 전용으로 대조했고 확정 오류0을 보고했다. 현재 alias와 과거 고정 log의 실행 시각 구분도 반영했다. 이 문서 감사는 새 제품 시험이 아니다.

다음은 root가 모든 작성자 동결 후 생성할 **예정 출력 링크**다. 이 색인 동결 시점에는 파일을 생성·압축 검사하지 않았으며 패킷 성공을 주장하지 않는다.

- [독립 리뷰 패킷 — 생성 예정](home-online-review-packet.zip)
- [파일별 manifest — 생성 예정](review/file-manifest.json)
- [source patch — 생성 예정](review/source-changes.patch)

패킷 내용·실제 생성과 검증 결과는 root의 패키징 명령 결과로 판단해야 한다. 이 색인 갱신은 문서 한 파일만 수정했고 코드·증거 원본·루트 보고서·Git 상태·외부 서비스를 변경하지 않았다. 이 기록 이후 색인 작성자의 모든 쓰기를 동결한다.
