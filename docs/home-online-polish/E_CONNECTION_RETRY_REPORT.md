# E — 활성 탭 충돌의 반복 연결과 안내

저장소 `sungmpar/ft_transcendence_project`, 기존 `main` / HEAD `2f11bee69c2d55ed938b53f9750119a890396fb7`의 이번 Goal 미커밋 작업이다. 서버·공통 물리·공개 Home·오디오를 수정하지 않았다. commit/push/PR/댓글/배포/운영 DB 변경은 하지 않았다.

## 실제 재현과 철회한 가설

온라인 담당자가 실제 guest 전체 로그인으로 같은 browser context의 두 탭을 열었다. 첫 탭의 인증된 서버 session과 연결은 유지됐지만, 두 번째 탭은 `active-session-conflict` 오류 뒤 계속 새 transport를 만들었다. 정식 baseline은 **6초 동안 추가 연결 5회**, 원인 문구 유지 false, 원래 owner 보호 true로 `REPRODUCED` / exit 1이었다. 원시 증거는 `evidence/rejected-session-churn-before/online-rejected-session.json`, `e-rejected-session-churn-before.log`이다.

원래 탭을 닫은 뒤 실제 서버의 이전 generation 부재/session count 0도 확인했다. 거절되던 두 번째 탭은 **새로고침 없이 자동 복귀했고 최종 server session 1개**가 됐다. 따라서 “서버 거절이 자동 재접속을 영구 중단한다”는 초기 가설은 이 경로에서 **반증됐다**. 이 작업의 수정 대상은 자동 복귀 기능의 부재가 아니라, owner가 살아 있는 동안 불필요한 연결을 반복하고 구체적 거절 이유가 generic 대기 문구로 사라지는 문제다.

설치된 Socket.IO client 4.5.1 소스는 namespace DISCONNECT packet을 수신하면 manager 구독을 해제한다. 그러나 서버의 `disconnect(true)` 호출이 실제 client에서 그 packet의 수신을 보장하는 것은 아니다. 진단 browser는 namespace packet 41이 아닌 transport close 1005와 반복 재연결을 관찰했다. 소스의 조건부 경로를 실제 wire 관측과 동일시했던 추론을 철회했다. 먼저 수행한 23초/19회 진단은 `rejected-session-before-diagnostic/`에, 더 짧은 정식 재현은 위 별도 폴더에 남겼다.

이 결함은 이전 통합 `final-browser/online-final-browser.json`의 관전자 created 2/open 0 실패와 **별개**다. 뒤의 `final-online-diagnostic-all`은 모든 시나리오를 통과했고 active conflict를 관찰하지 않았다. 그 이전 관전자 실패의 원인이 이번 수정으로 확정되거나 설명됐다고 주장하지 않는다.

## 최소 변경

새 `ConnectionRetry`는 정확한 현재 서버의 active-owner 거절 메시지를 받은 경우에만 **해당 route가 소유한 socket의 `disconnect()`**를 호출해 자동 반복을 멈춘다. 기존 owner를 교체하지 않으며, 서버의 session/입력 권한 검사와 다중 탭 거부 규칙은 그대로다. 최초 mount의 `socket.connect()`와 일반 transport 오류의 기존 자동 재연결도 유지한다. 다른 서버/game 오류를 active conflict로 분류하지 않는다.

Game/Invite/Spectate 세 화면은 `online-connection-notice`의 별도 안내와 native `online-reconnect` 버튼을 표시한다. 안내를 disconnect 전에 먼저 저장하므로 후속 generic 상태가 구체적 거절 이유를 없애지 않는다. 같은 소켓에서 사용자가 명시적으로 누른 재시도만 5초 기한을 갖는다. 재시도 중 중복 클릭은 무시하고, 확인되지 않은 시도는 기한 뒤 중지하며 이유와 다시 시도/기존 메뉴를 남긴다. 자동 반복 timer나 새 socket 객체는 만들지 않는다.

실제 connect가 오면 연결 시도 timer만 취소하고 기존 `onConnect → SessionRecovery` 흐름을 사용한다. 연결 자체를 경기 복구 성공으로 표시하지 않는다. 해당 경기의 5초 조회/권한/instance/generation gate는 변경하지 않았다. Spectate는 명시 재시도 때 `desiredRoom` 의도를 보존해 이전 조회 실패로 active/waiting이 false였어도 선택했던 경기를 다시 조회할 수 있다.

기한 callback은 generation으로 무효화하며, route unmount는 helper timer를 지운다. 기존 route가 자기 socket/canvas를 정리하는 구조를 유지한다. 화면 밖 callback이 새 route 상태를 갱신하지 않게 한다. 거절 이후 사용자가 원래 탭을 닫고 버튼을 누르는 수동 흐름은 의도한 제품 변경이다. 기존에는 원래 탭 종료 뒤 자동으로 복귀했던 사실을 감추지 않는다.

## 파일

- `frontend/src/arcade/connection-retry.ts`: 정확한 거절 분류, 명시 재시도 기한, 소유 timer/notice.
- `frontend/src/views/{GameView,InviteGameView,SpectateView}.vue`: 별도 안내/버튼과 기존 connect/recovery 연결.
- `backend/src/game/connection-retry.spec.ts`: 새 행동 시험 8개.
- `backend/test/navigation-jest.json`: 기존 intent 21개와 새 연결 8개를 같은 기존 검사 그룹에 포함. 설치된 Jest/Node의 performance 교체 문제에 대한 시험 환경 옵션.

## 실행한 명령과 결과

Node `/private/tmp/ft-transcendence-runtime/node_modules/.bin/node` 18.20.8을 사용했다. 아래 backend 명령은 `backend/` cwd이고 각 실행의 stdout/stderr를 서로 다른 `../docs/home-online-polish/evidence/` 로그에 저장했다.

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/navigation-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/frontend-contract-jest.json --runInBand --watchman=false
```

frontend 검사는 `frontend/` cwd다.

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/typescript/bin/tsc --noEmit --pretty false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/eslint/bin/eslint.js src/arcade/connection-retry.ts src/views/GameView.vue src/views/InviteGameView.vue src/views/SpectateView.vue --no-fix
```

root cwd의 `git diff --check`도 exit 0이었다. 이 담당자가 frontend/default dist를 빌드하거나 다른 실행 중인 fixture를 바꾸지는 않았다. Root가 단독으로 새 build와 최종 browser 실행을 담당한다.

| 실행 | 실제 결과 | 로그 |
|---|---|---|
| 새 navigation 첫 실행 | exit 1, helper 8개는 timer 설치 단계 실패 / 기존 intent 21 PASS | `e-connection-retry-unit-first.log` |
| local fake timer 옵션 시도 | exit 1, 새 suite 타입 컴파일 실패 / 기존 intent 21 PASS | `e-connection-retry-unit-final.log` |
| 환경 옵션 보완 후 navigation | **29 PASS: intent 21 + connection 8**, exit 0 | `e-connection-retry-unit-verified.log` |
| 기존 frontend 수명/입력 계약 | **10 PASS**, exit 0 | `e-connection-retry-lifecycle.log` |
| frontend noEmit | exit 0 | `e-connection-retry-typecheck.log` |
| helper/세 route 범위 lint | exit 0, 오류/경고 0 | `e-connection-retry-lint.log` |

첫 시험 실패는 설치된 Jest 28이 Node 18의 읽기 전용 `performance` 속성을 바꾸려다가 발생했다. local `doNotFake` 옵션은 runtime이 지원했지만 현재 `@types/jest` 27이 받지 않아 다음 실행이 컴파일에서 실패했다. 기존 navigation config에 `fakeTimers.doNotFake: ["performance"]`를 명시하고 테스트에서는 일반 `useFakeTimers()`를 호출했다. helper가 사용하는 **setTimeout의 5초 단언은 그대로**이며 시험을 skip하거나 성공 mock으로 바꾸지 않았다. 의존성과 lockfile을 갱신하지 않았다. 이 두 환경 실패는 제품 red 재현으로 세지 않는다.

8개 helper 시험은 일반 오류/초기 연결 무개입, 정확한 거절의 안내 우선 발행·반복 없음, 같은 socket의 1회 명시 연결·중복 클릭, 5초 경계와 다음 시도, 성공 뒤 늦은 deadline 무효화, 반복 거절 및 늦은 연결 차단, unmount 뒤 callback 무효화, state 소유 복사를 검사한다. fake timer/transport 단위 시험이며 실제 Chrome 두 탭 검증으로 분류하지 않는다.

## 후속 실제 검증

별도 온라인 담당자는 정확한 메시지 분류, disconnect 전에 안내 발행, 반복 거절의 멱등성, 명시 5초 기한과 generation, stopped 상태의 늦은 연결 거부, 세 route의 dispose/기존 sessionSync, Spectate 재시도 의도 및 8개 시험 소스를 읽었다. 추가로 확정된 결함은 찾지 못했고 이 제한된 소스 검토를 수락했다. 검토자가 author 단위 시험을 직접 실행했다고 표현하지 않는다.

Root가 새 최종 frontend build **`99110685ef45f988`**와 같은 현재 backend로 `browser` 그룹을 실행했다. 그 첫 하위 명령인 `test/online-rejected-session-browser-jest.json`은 **Jest 1개 PASS / 82.756초**, 내부 실제 Chrome의 **세 route 사례 모두 PASS / Python 70.844초**였다. 이 문서 갱신 시 여섯 config 전체 묶음은 아직 진행 중이므로 wrapper 전체 exit 0이나 온라인 전체 완료를 주장하지 않는다.

첫 하위 명령은 backend cwd의 다음 실제 실행이다. 전체 실행 로그의 첫 줄에도 같은 명령/cwd가 있다.

```sh
node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/online-rejected-session-browser-jest.json --runInBand --watchman=false
```

원시 결과는 `evidence/final-browser-after-connection-retry/online-rejected-session.json`, Python 출력은 같은 폴더의 `online-rejected-session-python.log`, Jest 출력은 `evidence/final-browser-after-connection-retry-command.log`다. 실제 Chrome 152.0.7977.77, viewport 1440×900, full-page PNG를 사용했다. 실제 guest HTTP 전체 이동과 같은 browser context의 두 탭으로 준비했으며 credential·socket 상태를 주입하지 않았다. 서버 관측은 fixture의 session 수/generation 집계만 읽었다.

| 실제 route | 원래 owner가 살아 있는 6초의 추가 연결 | 거절 이유 유지 | 원래 owner 제거 후 실제 클릭의 새 연결 | 같은 문서·서버 session 복구·캡처 후 idle input |
|---|---:|---|---:|---|
| `/game` | 0 | PASS | 정확히 1개 | PASS / 1 session / 0 input |
| `/invite` | 0 | PASS | 정확히 1개 | PASS / 1 session / 0 input |
| `/spectate` | 0 | PASS | 정확히 1개 | PASS / 1 session / 0 input |

세 사례 모두 첫 탭의 native 연결/인증된 server owner가 보호된 것을 먼저 확인했다. 원래 탭 종료 후 그 generation이 없어지고 server session count가 0이 된 다음, **0.75초 동안 자동 추가 시도가 없는 상태**를 관찰했다. 그 뒤 실제 버튼을 클릭해 native 연결 한 개와 server session 한 개를 복구했고 reload 없이 같은 문서가 유지됐다. PNG 뒤에도 idle input 0이었으며 pageerror는 없었다. 0.75초는 해당 관찰 구간이며 모든 미래 시간에 대한 실측 보장으로 확대하지 않는다. 이 사례는 로비의 연결 복구이고, 실제 진행 중 경기의 sessionSync/관전자 복구는 별도 통합 경기 사례로 확인한다.

Root는 `/game`의 거절/복귀 두 PNG를, 별도 온라인 검토자는 세 route의 여섯 PNG 전부를 실제로 열어 검토했다. 이 보고서 담당자도 `/game` 두 PNG를 열었다. 거절 이유, 연결 다시 확인 버튼과 복귀 뒤 활성 로비 버튼이 읽히며 겹침은 없었다. 다만 같은 안내가 **court overlay·하단 status·actions notice에 반복되는 P3 수준의 표현 중복**은 남아 있다. 이번 기능 수정의 차단 요인은 아니며, 읽기 가능한 이 상태를 기록하고 추가 source 변경은 하지 않았다.

대표 화면: [거절 안내와 명시 재시도](evidence/final-browser-after-connection-retry/game-rejected-session-while-owner-active.png), [같은 문서의 연결 복귀](evidence/final-browser-after-connection-retry/game-rejected-session-reconnected.png). 일반 관전자 단독 단절의 자동 복귀와 전체 브라우저 묶음 결과는 이후 같은 서버·클라이언트 쌍의 통합 기록에서 별도로 판정한다.

최종 패킷 시점의 후속 결과: 첫4 configs13 tests PASS 뒤 P4에서 wrapper exit1이었고, 장애 주입·관측 parser 보완 뒤 P4와 미도달 최종 온라인 config를 각각 개별 PASS했다. 전체 wrapper exit0은 아니다. 최종3시나리오의 실제 관전자 자동 복귀와 경기·효과·DB 결과는 [TEST_REPORT](TEST_REPORT.md)에 구분했다.
