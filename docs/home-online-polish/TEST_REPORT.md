# Home / online — 실제 검증 기록

상태: **READY_FOR_REVIEW — Home 구현·검증 완료, 온라인 구현 및 격리된 실제 서버/Chrome 통합 검증 완료.** 운영·사람의 플레이 검증은 포함하지 않는다. 아래의 PASS는 실제 완료한 실행만 뜻한다. 실패한 전체 wrapper와 뒤의 개별 성공을 구분하고 초기 실패·중간 실행은 [증거 색인](EVIDENCE_INDEX.md)에 보존한다. 이전 `docs/arcade-upgrade/`는 변경하지 않았다.

## 환경과 실행 결과

정확한 저장소는 `sungmpar/ft_transcendence_project`, worktree는 `/Users/sm/dev_park/ft_transcendence_project`, branch/HEAD는 `main` / `2f11bee69c2d55ed938b53f9750119a890396fb7`이다. 이번 변경은 미커밋이며 staged 파일은 없다.

- Node 18.20.8: `/private/tmp/ft-transcendence-runtime/node_modules/.bin/node`, Yarn 1.22.22, 기존 lockfile/설치 의존성 사용.
- Python `/opt/miniconda3/bin/python`, Playwright 1.55.0, 실제 Chrome 152.0.7977.77. 자동 키 입력이며 사람의 물리 키보드 플레이가 아니다.
- PostgreSQL 14.23: 작업 전용 `127.0.0.1:55432`. fixture별 임시 스키마·계정·HTTP 포트. 운영 `.env`/AppModule/DB를 로드하지 않았다.
- Node 24의 baseline 환경 문제와 sandbox의 Chrome/loopback EPERM은 제품 실패와 구분하고, 허용된 전용 runtime/loopback 재실행의 실제 결과를 기록했다.

| 검사 | 최신 실제 결과 | 근거 |
|---|---|---|
| 전체 단위·계약·결합 회귀 | **233 PASS**, 11 configs, exit 0 | `final-unit-after-connection-retry.log` |
| 실제 HTTP/Socket.IO/DB 회귀 | **15 PASS**: online 3 + lifecycle 7 + service 5, exit 0 | `d-online-services.log` |
| frontend 타입 검사 | exit 0, 연결 보완 뒤 재확인 | `e-connection-retry-typecheck.log` |
| frontend production build + webpack graph | exit 0, hash `99110685ef45f988` | `final-frontend-build-after-connection-retry.log` |
| backend build (최종 형식 보완 포함) | exit 0 | `final-backend-build-formatted.log` |
| frontend 전체 src lint, no-fix | exit 1: 기존 score.ts 오류 1 / 경고 61 | `final-frontend-lint-after-connection-retry.log` |
| backend 전체 src non-spec lint, no-fix | exit 1: 오류 1857 / 경고 32 | `final-backend-lint-verified.log` |
| 새로 추가한 줄의 lint 진단 | frontend/backend 모두 0 | `final-lint-comparison.json` |
| 최종 서비스 화면 | **37 PASS**, exit 0, 캡처 직접 검토 완료 | `SERVICE_LAYOUT_REVIEW.md` |
| Home 동일 계정 전후 | **48 PASS**, exit 0 | `home-visual-n3-service-build-command.log`, `home-visual-browser.json` |
| Home 그룹, build4de | **48 visual + 18 auth + 4 navigation PASS**, 별도 1 OBSERVED, 3명령 exit 0 | `final-home-command.log`, `final-home-execution-record.json` |
| 최신 Home·메뉴, build991 | **48 visual + 4 navigation PASS**, 별도 1 OBSERVED, 두 명령 exit 0; 인증18 재실행 아님 | `final-home-after-connection-retry/`, `final-home-execution-record.json` |
| 온라인 실제 브라우저, build4de | **3 시나리오 PASS**, Jest 1 test exit 0 / 175.014s. 실제 6:0 DB 행 검증 PASS | `final-online-diagnostic-all/online-final-browser.json`, `online-final-persistence.json` |
| 최종 browser 그룹 첫 실행 | 앞 4 configs **13 PASS**, 최종 온라인 1 config FAIL, wrapper exit 1 | `final-browser-command.log` |
| 연결 보완 뒤 browser 6 configs | 앞4 configs **13 PASS**, P4 1 FAIL, 최종1 config 미도달; wrapper exit1 | `final-browser-after-connection-retry-command.log` |
| 최신 중복 탭 3화면 | `/game`·`/invite`·`/spectate` 실제 충돌·기존 탭 보호·같은 페이지 명시 복귀 PASS; 위13개 중1 test | `final-browser-after-connection-retry/online-rejected-session.json` |
| P4 장애 주입 보완 뒤 개별 재실행 | **1 PASS**, exit0 / 59.053s. 앞서 실패한 wrapper 종료 코드는 유지 | `e-final-lifecycle-controlled-parser-fixed.log`, `final-lifecycle-controlled-parser-fixed/p4-online-lifecycle-browser.json` |
| 최신 온라인 최종 config, build991 | **3 시나리오 PASS**, Jest1 test exit0 / 170.514s, Python159.829s. 실제 DB4경기·6점경기1/6:0 | `e-final-online-after-conflict.log`, `final-online-after-conflict/online-final-browser.json`, `online-final-persistence.json` |
| 최종 local-browser 그룹 | **56 PASS**: 기존 25 + 추가 31, 2명령 exit 0 | `final-local-command.log`, `final-local/report.json`, `final-local/p2-browser-report.json` |

단위 수는 출력된 config별 test 수의 합계다: 29+8+18+47+16+19+10+34+8+13+31=233. 연결 보완 전의 225개에서 명시 재연결 helper 8개가 추가됐다. 같은 시험의 red/green 재실행을 합산하지 않는다. browser의 큰 시나리오 한 개와 그 안의 여러 검사 조건도 서로 다른 단위로 구분한다.

최신 소스의 browser6 configs는 앞4개13 PASS와 개별 P4/최종 config 각1 PASS로 모두 성공 증거가 있다(합15 tests). **전체6개 wrapper를 한 번에 exit0으로 끝낸 실행은 없다.** 마지막 두 config만 보완·개별 실행한 결과를 wrapper 성공으로 바꾸지 않는다.

root의 정확한 명령·cwd·종료 코드는 [final-root-commands.json](evidence/final-root-commands.json), baseline은 [baseline-commands.json](evidence/baseline-commands.json), N1/N2는 [recovery-execution-record.json](evidence/recovery-execution-record.json), 최종 온라인 브라우저는 [final-online-execution-record.json](evidence/final-online-execution-record.json)에 있다. 서버/clock/효과 담당의 명령은 각 보고서에도 원문으로 남겼다.

## baseline과 이번 lint 부채를 구별

이번 Goal의 mutation 전에도 단위 136개, 격리 온라인 15개, 양쪽 빌드·frontend 타입 검사를 직접 실행했다. 과거 Goal의 동일한 숫자를 가져온 것이 아니다.

| 같은 no-fix 명령 | baseline | 첫 통합 검사 | 최종 |
|---|---:|---:|---:|
| frontend src `.ts,.vue` | 오류 1 / 경고 64 | 1 / 61 | 1 / 61 |
| backend src, `*spec.ts` 제외 | 오류 1858 / 경고 32 | 1884 / 32 | 1857 / 32 |

첫 통합에서 추가된 backend 형식 진단은 새 guest CORS, sessionSync endpoint, 참가자 조회, runner 코드에 있었다. 그 부분만 기존 formatter 규칙에 맞췄고 무관한 파일 전체 포맷이나 rule suppression을 하지 않았다. 마지막 비교는 단순 총계뿐 아니라 git diff의 추가 줄과 untracked src 전체를 현재 진단에 대조해 새 줄 진단 0을 확인했다. 기존 score.ts 오류와 서비스 코드의 lint 부채는 해결했다고 주장하지 않는다. 분석을 재실행하려면 root에서 `/opt/miniconda3/bin/python docs/home-online-polish/evidence/final-lint-analysis.py`를 사용한다.

## 실제 화면과 Home·인증·서비스 범위

최초 baseline build `705af758a21aa3ca`를 실제 guest 전체 페이지 이동으로 실행했다. 같은 일회용 계정 상태는 tmp의 0600 파일에서만 읽고 증거에 token/cookie를 저장하지 않았다. Home 전후 1440×900, 1366×768, 1024×768, 390×844와 Login/공개허브/온라인 로비를 캡처하고 파일을 직접 열었다. [전후 링크](REVIEW_PACKET.md#실제-화면-비교).

최종 패키징 전 이미 종료된 baseline fixture의 이 Goal 소유 임시 browser-state 파일을 내용 출력 없이 제거했다. 실행 중인52262 데모, 현재 사용자 파일과 이전 Goal 문서는 지우지 않았다. 새 browser-final Python bytecode도 담당자가 자기 생성 파일만 제거했다.

Home 48개 검사는 세 CTA와 첫 화면 가시성, 실제 AI Power/Hard/선택 키 전달, 명시적 Start 전 대기, 계정 disclosure/Escape/focus, 친구 drawer focus, broken avatar, 200% CSS zoom, 실제 10자 한글 닉네임 PATCH 후 복구, 표본 텍스트 대비 4.5:1 이상을 포함한다. CSS zoom은 브라우저 UI의 확대 조작과 구분한다. 공개 `/play`, `/play/local`, `/play/ai`는 새 context의 별도 정적 서버에서 실제로 열고 시작했으며 인증·사용자 API·game socket 요청 0을 기록했다.

이전 Phase B에서 다음을 실제 실행했다. 마지막 통합 그룹 결과와 중복해서 더하지 않는다.

- `browser-home-navigation.py`: 실제 친구 대상 선택 → 거절 → 재초대 → 수락 → 두 코트, 관전 empty/timeout/retry, route/back-forward의 socket·RAF 수명. H08은 설치 Router 4.1.3이 params를 보존하므로 기존 전달 계약을 유지했다. baseline 친구 UI의 실패 여부는 미확정이다.
- `browser-home-auth.py`: 18개 검사 PASS. 실제 guest full redirect의 세 목적지, 허용되지 않은 URL/만료·손상 intent, 취소, logout 실패 시 정리, 공개 경계. guest-disabled 별도 임시 빌드의 공개 AI 진입도 별도로 PASS.
- `home-auth-prerequisites` 3개 PASS: 실제 만료 JWT/HTTP401, 실제 닉네임 PATCH 폼, 실제 2FA 검증 폼. fixture에서 credential/code를 준비했고 외부 메일은 보내지 않았다.
- `home-guest-entry` 8개 PASS: 실제 DB/JWT/cookie/전체 callback, 같은 origin 및 같은 호스트의 별도 포트, 503, double click, pending 취소, 새 탭 intent, 정확한 CORS 허용 범위. 요청 취소가 이미 진행 중인 서버 계정 생성까지 취소한다는 뜻은 아니다.
- 서비스 화면: 실제 메뉴에서 Chat 입력과 Send의 native actionability, Info/Tfa의 Main 클릭, 좁은 Board 표의 키보드 스크롤을 검증한다. 실제 메시지 전송·파일 업로드·2FA on/off는 이 레이아웃 검사에서 수행하지 않았다. 해당 서비스의 HTTP/DB 회귀와 레이아웃 검사는 구분한다.

## N1 / N2 / N3 / 효과의 실패 → 수정 증거

| 항목 | 재현 및 수정 근거 |
|---|---|
| N1 플레이어 만료 | 같은 페이지가 무한 full-state 대기에 남는 실제 baseline 재현. 요청·경기 ID/인증 참가 권한으로 진행·저장·실패·복원 불가를 분리. 실제 결과 복구와 새 경기 재매칭 확인. [N1/N2 보고서](N1_N2_REPORT.md) |
| N2 관전자 자신의 단절 | 두 플레이어는 계속 연결한 채 관전자만 끊었을 때 tick 정지 재현. 재구독·전체 상태·이전 권한 검증 후 입력 0 유지. 초기 최종 브라우저 실패는 transient ‘복구’ 문구 대기이며 이후 실제 새 연결/generation/동일 경기/tick 조건으로 별도 PASS. 이전 종료/스크린샷 timeout 실패도 보존. |
| N3 clock | 실제 runner+buffer 결합. 고정 300ms 기준을 수정 전에 정함. baseline 7개 중 4 FAIL → 같은 7개 PASS → 확장 8개 PASS. stall 155ms, pause/resume 205ms. 정상 60/20Hz, ±40ms 지터, 반복 stall, 다른 인스턴스 경계. [N3 보고서](N3_CLOCK_REPORT.md) |
| 온라인 효과 | 60Hz 중간 타격 보존·개별 full-state 비소비/송신 시점 유지의 red 2개, audio cleanup red 2개, 독립 리뷰 gesture red 1개와 flash red 2개를 보존. 최종 feedback 18/client 34 PASS. [효과 보고서](D_FEEDBACK_REPORT.md) |

서버 disconnect 인식 전의 transport 감지 시간과 그 뒤 5초 유예를 구별한다. 가짜 시계, 애플리케이션 수준 지연, controlled WebSocket close/context offline, 실제 WAN/TCP 장애는 같은 검증이 아니다. N3는 단순히 latest 위치가 움직이는 조건으로 통과시키지 않고, 새 두 snapshot 사이의 fractional tick과 움직이는 보간 좌표를 확인한다.

효과 browser 검사는 실제 서버의 고유 타격 ID를 관찰하고 그 tick이 presentation에 도달한 뒤 native Canvas/Audio 호출을 검사한다. 패킷 도착만 기다린 검사를 효과 재생 검증이라고 하지 않는다. 실제 AudioContext/oscillator 호출 관찰은 사람의 청취와 다르다.

최초 최종 browser wrapper는 앞 4개 config의 13 tests를 통과한 뒤 마지막 config에서 실패했다. 그 안의 0:6 경기·mouse 재매칭은 PASS였지만, 관전자 자신의 연결은 transport 2개 생성/열린 연결0·옛 generation/tick에 남았다. 이는 초기 transient 문구 selector 실패와 다른 실행 실패다. 해당 실행에는 종료 이유 진단이 없었으므로 원인은 **미확정**으로 남긴다. 그 뒤 서버 메시지를 바꾸지 않는 bounded native transport 이력과 native 키 입력→실제 outgoing packet의 인과관계 관찰을 보완한 같은 전체 3시나리오 재실행은 PASS였다. 성공 이력은 offline 중 실패한 연결 뒤 새 transport가 정상 열렸음을 보여주며, 이전 실패의 원인을 소급해 증명하지 않는다. 첫 wrapper의 exit1을 exit0으로 바꾸거나 실패를 집계에서 지우지 않았다.

Home 그룹 전체3명령은 build `4de1388331743be3`와 fixture52262의 새로운 guest에서 수행했다. 최종 연결 helper와 세 온라인 화면만 바뀐 build `99110685ef45f988`에서도 visual48 및 navigation4 PASS/관찰1을 각각 다시 수행하고 새 PNG9장을 직접 열었다. root도 최신 desktop/mobile을 열었다. 인증18과 서비스37·로컬56은 해당 실행 후 관련 소스가 바뀌지 않았으므로 재실행하지 않았다. 최신991 browser 그룹의 guest8·선행인증3 PASS는 별도다. 같은 계정으로 비교한 원래 `evidence/before-*`/`after-*` 파일은 덮어쓰지 않았다. 두 Home 테스트의 출력 경로만 공통 `ARCADE_EVIDENCE_DIR`를 따르도록 바꿨으며 단언·인증 동작은 유지했다.

최신991 browser wrapper는 중복 탭1, guest8, 선행인증3, 기존 온라인1의13 tests를 통과했다. P4는 `context.setOffline(true)` 뒤 상대의 일시정지 문구를 30초 안에 관측하지 못해 exit1이었다. 이 실행에서 서버 단절이 발생했음을 증명하지 못했으므로 제품 또는 환경 원인을 단정하지 않는다. 순차 wrapper가 여기서 종료해 마지막 온라인 config는 실행되지 않았다. 이미 통과한 앞4 configs를 반복하지 않고 실패한 P4와 미도달 최종 config만 개별 실행했다.

P4 시험은 설치 Playwright1.55의 WebSocket routing으로 기존 연결을 실제 닫고, 짧은 구간에 새 시도가 발생하면 거부하도록 보완했다. 정상 연결은 실제 서버에 전달하며 애플리케이션 패킷·점수·상태를 생성하거나 바꾸지 않는다. Playwright가 WebSocket wrapper를 주입하므로 이 시험의 모든 handshake를 변형 없는 native 연결이라고 부르지 않는다. 기존 pause→200ms 같은 tick→새 generation/같은 경기·편→상대 재개→다른 탭 거절·기존 소유 보존→기권 결과 단언은 유지했다. 최초 보완 실행은 추가 관측 parser가 `42/game,[...]`의 namespace를 처리하지 못해 실패했다. 배열 시작에서 파싱하도록 고친 뒤 같은 단언은59.053초 exit0으로 통과했다. tick317→317, 새 generation, pageerror0을 JSON과 캡처로 확인했다. 611ms 제어 구간 안에 새 연결 시도는 없었으므로 새 시도 차단 분기 실행은 확인하지 않았다. 두 실패 로그를 보존한다.

별도 연결 충돌 회귀는 초기 정적 추론의 반증도 담는다. 수정 전에는 namespace41이 관측되지 않았고 반복 transport close 및6초5회 추가 연결·오류 안내 소실이 재현됐다. 기존 탭 종료 뒤 자동 복귀는 이미 작동했으므로 ‘복귀 불가’를 수정 성과로 쓰지 않는다. 최종 세 화면에서는 정확한 충돌 응답 후6초 추가 연결0, 원래 소유자 유지, 원래 소유자 종료 후 자동 시도 없이 native 재시도1회, 같은 URL/timeOrigin·서버 새 연결·idle 입력0을 PASS했다. [실행·반증·화면 기록](E_CONNECTION_RETRY_REPORT.md).

마지막991 온라인 config는 실제0:6 표시→mouse 재매칭의 두 화면 같은 새 경기→메뉴 해제, 관전자만 단절→새 transport/generation/같은 경기 tick진행·플레이어 연결 불변·캡처 전후 입력0, 서버 확정 타격·native Canvas/AudioContext·키 입력 seq 인과관계·음소거·모션·자원 정리의3시나리오를 모두 PASS했다. 실제 DB 완료행4개 중6점 종료행1개는6:0이었다. 모션 검사의 허용된 late-skip 경계는 재관찰 횟수(system1/manual2)와 이전 skip 수(1, 3/2)를 기록한다. 성공 구간에는 새로운 실제 서버 타격이 presentation에 도달하고 추가 skip0이어야 하며, 음원·모션 불변식은 재관찰 중에도 유지한다. 모든 타격을 화면/음향으로 재생한다는 주장은 하지 않는다. 담당자가5개 PNG를 열었고 root는6점 결과·관전자 복귀·효과/키 화면3개를 직접 열었다. 이 PASS는 이전 원인 미확정 실패를 소급해서 해명하지 않는다.

## 로컬·AI 보존과 번들 경계

Phase B와 공유 AudioFeedback 변경 후 최종 Chrome 회귀에서 각각 기존 25개와 추가 31개가 PASS였다. Classic 로컬 완주와 Power 로컬의 유효 반사 5회 충전·실제 Power 발동·6점 종료·재시작, Classic/Power × Easy/Normal/Hard AI 전 조합 완주·재시작·지연 관찰, 입력 재지정·포커스·일시정지·resize/DPR·메뉴 해제를 포함한다. 가속 시계와 자동 키를 썼고 game state/점수를 임의로 쓰지 않았다. 서비스/외부 요청과 pageerror는 0이었다. 최종 결과는 `final-local/`에 분리했고 root는 새 Power 활성·AI Power/Hard 종료 캡처를 실제로 열었다.

실제 최종 webpack graph에서 454개 모듈을 검사했다. 공유된 자체 모듈은 AI/fixed-clock/game-core/protocol이며 backend/Nest/TypeORM/pg 모듈은 0이었다. `final-bundle-boundary.json`은 실제 report SHA-256을 기록한다. 연결 보완 전 453개 결과는 별도 `final-bundle-boundary-before-connection-retry.json`으로 보존했다. root에서 `/opt/miniconda3/bin/python docs/home-online-polish/evidence/check-bundle-boundary.py`로 재확인할 수 있다. 이 검사는 `frontend` cwd의 `yarn build --report-json` 결과가 필요하다.

## 현재 실행과 재현

이번 최종 정적 preview는 `http://127.0.0.1:4173/play`, 최종 paired fixture는 `http://127.0.0.1:52262/login`이다. 2026-09-08 04:38:16 UTC 두 경로의 실제 HTTP200을 재확인했다(`final-delivery-runtime-state.json`). 마지막 GitHub 조회도 동일 main/open issue·PR0이었고, sandbox의 FETCH_HEAD 쓰기 거부(exit255) 후 명시 허용된 `git fetch origin`은 exit0이었다(`final-delivery-live-gate.json`). 예전59707/50396 fixture는 정상 종료하고 자기 스키마만 정리했다. fixture는 새로 시작할 때 포트가 달라지므로 출력된 주소가 기준이다.

재현용 명령과 환경 URL override 제거는 [README](../../README.md)에 있다. 준비된 이 컴퓨터에서는 다음 runtime을 사용한다.

```sh
export PATH=/private/tmp/ft-transcendence-runtime/node_modules/.bin:$PATH
node scripts/serve-frontend.cjs
# 별도 터미널, 작업 전용 PostgreSQL이 실행 중인 상태에서
TS_NODE_PROJECT=backend/tsconfig.json node --no-experimental-fetch \
  -r ./backend/node_modules/ts-node/register \
  -r ./backend/node_modules/tsconfig-paths/register scripts/serve-online-fixture.ts
```

검사 그룹은 `node scripts/check-arcade.cjs unit|online|browser|home|local-browser`이다. browser/Home/local-browser에는 준비된 Python을 `ARCADE_PYTHON=/opt/miniconda3/bin/python`으로 지정한다. Home은 `ARCADE_DEMO_URL=http://127.0.0.1:<실제 fixture 포트>`와 정적 preview도 필요하다. 없는 서버 주소를 접속 가능한 결과로 표현하지 않는다.

## 미실행과 검증의 한계

사람 두 명의 물리 키보드/rollover·실제 소리 청취·광학 입력 지연, 원격 WAN/TCP 장애, cross-site/subdomain cookie, Firefox/WebKit/Safari, Docker/기존 전체 bootstrap, 외부 42 OAuth/2FA 메일, 운영 배포는 NOT_RUN이다. 독립 에이전트 검토는 외부 사람의 리뷰가 아니다. 잔여 P3는 기존 Board 열 제목의 조밀한 배치와 연결 거절 안내의 세 위치 반복이다. 최초 최종 관전자 timeout과 context offline만 사용한 P4 실패의 원인은 확정하지 않았다. 뒤의 개별 PASS가 실패한 wrapper 결과를 덮어쓰지 않는다. commit, push, PR, GitHub 댓글, 배포, 운영 DB 변경은 수행하지 않았다.
