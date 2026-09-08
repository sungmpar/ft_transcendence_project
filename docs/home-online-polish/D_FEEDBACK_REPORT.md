# D — 서버 확정 이벤트와 온라인 피드백

기준 저장소는 `sungmpar/ft_transcendence_project`, 브랜치는 `main`, HEAD는 `2f11bee69c2d55ed938b53f9750119a890396fb7`이다. 이 문서는 기존 팀 코드·공개된 공통 경기 코어·이번 Goal의 B/N1/N2/N3 변경 위에 추가한 D를 설명한다. commit/push/PR/댓글/배포/운영 DB 변경은 하지 않았다. 이전 `docs/arcade-upgrade/` 증거는 수정하지 않았다.

D의 서버 이벤트 전달, 표시 시점 중복 억제, 오디오 수명과 설정 구현은 완료했다. 아래 자동 시험과 실제 Socket.IO·격리 DB 회귀를 실행했다. 별도 담당자의 최종 Chrome 화면/경기 시험은 통합 `TEST_REPORT.md` 및 `INDEPENDENT_ONLINE_REVIEW.md`에서 구분해 기록한다. 이 문서의 단위 시험 PASS는 사람이 소리를 들었다거나 WAN에서 검증했다는 뜻이 아니다.

## 원인과 변경

기존 온라인 session은 서버 위치를 표시했지만 로컬처럼 실제 `GameEvent`를 `CourtRenderer.events()`와 `AudioFeedback.play()`에 전달하지 않았다. 60Hz 물리에서 일어나는 이벤트를 20Hz snapshot의 마지막 tick만 보고 보내면 중간 타격이 빠진다. 위치에서 충돌을 추측하는 대신 서버 runner가 실제 코어 이벤트를 누적하도록 했다. 공통 물리, 경기 규칙, 점수와 승패 판정, 서버 입력 권한은 바꾸지 않았다.

또한 `snapshot()` 호출이 전송 cadence의 기준 tick을 바꾸어 개별 ready가 정기 broadcast를 미룰 수 있었다. 개별 상태 캡처는 cadence를 바꾸지 않고, `advance()`가 정기/경계 broadcast를 결정한 때에만 기준 tick을 갱신한다.

### 계약과 보관 경계

- `Snapshot`의 필수 `events`는 `{ id, event }` 목록이고 `eventCursor`는 그 시점까지 발급한 가장 큰 ID다. `event.tick`은 코어 발생 tick이다. enclosing `matchId`, `instanceId`, `clockEpoch`와 함께 소속을 판별한다. 플레이어별 input `generation`과 공통 이벤트 ID를 혼용하지 않는다.
- 실제 `stepGame`의 모든 이벤트에 runner 단위의 단조 증가 ID를 붙인다. 보관은 최대 **64개 / 최근 120tick(60Hz에서 2초)**다. 전송 캡처는 소유된 복사본이며 point score도 복사한다. 한 관전자에게 ready를 보내도 다른 수신자의 이벤트를 소비하지 않는다.
- validator는 필수 목록, 크기, ID/tick 순서, cursor 상한, 시간 범위, 이벤트별 종류·정확한 필드·값을 검사한다. 클라이언트 buffer도 event cursor 역행을 거부한다.
- 초기 참가·관전·재접속 full ready의 `eventCursor`는 **과거 효과 재생을 막는 고정 기준**이다. 새로운 epoch는 old queue와 해당 첫 snapshot의 이력을 버리고 새 기준을 세운다. 서버의 시간 폐기·중지 후 재개는 N3의 epoch 정책을 그대로 쓴다.
- `PROTOCOL_VERSION`/`v: 1`은 유지하지만 snapshot은 N3의 `instanceId/clockEpoch`와 D의 `eventCursor/events`가 필수다. 기존 N1/N2의 `sessionSync`/`matchEnded`와 함께 **이 소스의 서버·클라이언트·validator·fixture를 한 쌍으로 사용해야 한다. 이전 버전 혼합 호환이나 옛 계약 fallback은 제공하지 않는다.**

### 표시 시점과 허용되는 누락

새 `EventPresentation`은 buffer가 승인한 snapshot만 받는다. 실제 buffer의 `presentationTick`이 이벤트 tick에 도달해야 한 번 전달한다. 동일 ID가 여러 snapshot에 반복되어도 enqueue하지 않는다. 다른 경기/instance, 과거 epoch/sequence/cursor도 받지 않는다. pending queue 역시 최대 64개다.

표시 시점보다 **6tick(100ms) 초과 늦은 효과**는 건너뛴다. 한 표시 batch에서 point/serve/finished 경계가 있으면 그 경계 이전 이벤트도 버린다. 전송 중 누락, 서버 ring 범위 밖 이력, 새 full-state 기준, epoch reset, queue overflow와 명시적 late skip 때문에 이벤트가 빠질 수 있다. 이는 중복 억제와 제한된 이력 복구이며 네트워크 exactly-once 전달 보장이 아니다.

득점/서브/종료/재동기화에서 과거 trail/flash와 진행 중 음을 정리한다. disconnect와 waiting에서도 queue·audio·renderer를 함께 비워, 정지된 tick 위에 흰 타격 flash가 붙어 있지 않게 한다.

경기 종료는 100ms 보간을 기다리지 않고 서버의 최신 점수를 즉시 표시한다. 이때 **실제 최신 terminal tick에 이미 수신한 point/finished만** terminal feedback으로 전달하고, 아직 표시하지 않은 과거 타격음은 앞으로 당겨 재생하지 않는다. 종료 이벤트가 없는 forfeit/disconnect 결과에는 새 득점을 만들어내지 않는다. point와 finished가 같은 tick이면 오디오 우선순위로 한 음만 낸다. 결과 뒤 남는 이 실제 terminal 음은 route 소유 context의 최대 110ms voice이며, mute/새 session/화면 이탈이 즉시 끊는다.

`serverEventsReceived`, `effectsPresented`, `effectsSkipped`, `effectQueueDepth` 진단을 추가했다. `effectsPresented`는 표시 시점에 adapter로 전달한 이벤트 수다. serve/wall 등은 소리를 만들지 않으므로 화면에서도 “표시 시점 이벤트”로 표시한다. `audioTones`는 실제 oscillator 시작 횟수이며 사람의 청취 측정이 아니다.

### 오디오·설정·소유권

`OnlineGameShell`이 context와 설정을 소유하고 canvas별 bridge로 현재 `OnlineSession`에 전달한다. session 생성이나 저장된 unmute preference만으로 context를 만들거나 resume하지 않는다. 실제 native 소리 버튼/경기 화면 pointer·Enter·Space 제스처에서만 활성화한다. 입력/select/링크와 명시적 소리 버튼은 상위 capture 자동 활성화에서 제외해 두 번 toggle되지 않는다.

상태는 `muted`, `gesture-required`, `starting`, `ready`, `blocked`, `unavailable`로 사용자에게 표시한다. `resume()` 거절과 제스처 부족을 성공으로 숨기지 않는다. 이미 실행 중인 context가 있어도 독립 activation gate를 거쳐야 `play()`가 동작한다. 저장된 unmute 복원은 새 제스처가 필요하다.

각 context는 최대 8개의 oscillator/gain 쌍을 소유한다. mute, disconnect, 경계, session 교체와 dispose는 진행 중 노드를 stop/disconnect한다. 종료 callback도 소유 목록에서 노드를 제거한다. route dispose는 context를 닫고 늦은 resume callback을 무효화한다. 같은 tick의 tone 우선순위는 finished > point > Power > paddle이며 wall/serve는 무음이다. 기존 로컬 `setMuted/play/dispose` API와 실제 제스처 기반 진입은 유지한다.

온라인 preference `transcendence.online.preferences.v1`는 `arrows|wasd`와 `system|reduce`를 저장한다. 온라인 한 명의 기본 **↑/↓/Space**, 대체 **W/S/D**를 유지하고 HUD도 같은 binding 함수에서 만든다. 사용자 지정 키 편집기는 추가하지 않았다. 로컬 6키의 설정 key와 기본 오른쪽 Power `ArrowLeft`는 바꾸지 않았다. online keyboard는 현재 한쪽 player와 선택된 3키만 잡으며, preset 교체 때 neutral 입력을 보낸다. 관전자는 입력을 보내지 않는다.

음소거는 기존 공통 저장 preference를 존중한다. 모션은 시스템 reduced motion 또는 사용자의 reduce 선택을 적용해 기존 renderer의 trail/flash를 줄인다. 키/음/모션 선택은 서버 경기 규칙을 바꾸지 않는다.

## 파일 범위

| 파일 | D 변경 |
|---|---|
| `shared/protocol.ts` | 필수 이벤트 envelope, cursor, bounded validator와 소유 복사 |
| `backend/src/game/server-match-runner.ts` | 실제 60Hz event ring, nondestructive capture, broadcast cadence |
| `frontend/src/arcade/event-presentation.ts` | 새 표시 시점 queue, 중복·late·epoch·terminal 정책 |
| `frontend/src/arcade/snapshot-buffer.ts` | event 필드 복사, cursor 순서 검사 |
| `frontend/src/arcade/online-session.ts` | presenter/공통 renderer/audio 연결, 경계 정리, 진단, 한쪽 키 소유 |
| `frontend/src/arcade/audio-feedback.ts` | 실제 gesture/status, voice/context cleanup, 같은 tick 중복 tone 억제 |
| `frontend/src/arcade/online-preferences.ts` | 별도 온라인 3키 preset/motion 저장 |
| `frontend/src/arcade/keyboard-controller.ts` | 기본 로컬 양쪽 동작을 유지하는 선택적 active side |
| `frontend/src/plugins/gamePlayService.ts` | canvas별 feedback 소유 bridge |
| `frontend/src/components/game/OnlineGameShell.vue` | 소리 상태/실제 버튼, motion/preset/HUD와 route cleanup |
| `backend/src/game/{online-feedback,event-presentation,audio-feedback,online-preferences}.spec.ts` | 새 D 회귀 |
| `backend/src/game/{online-session,protocol}.spec.ts` | 실제 session/validator 회귀 추가 |
| `backend/test/online-browser-unit-fixture.ts` | 소유 snapshot에 이벤트 계약 포함 |
| `backend/test/feedback-jest.json` | 새 4개 suite 진입점; root가 `check-arcade unit`에 연결 |

`CourtRenderer`는 기존 공통 구현을 재사용하며 D에서 파일을 변경하지 않았다. `shared/game-core.ts`, `shared/fixed-clock.ts`, GameService의 승패/결과 저장 구현도 D에서 바꾸지 않았다. 앞 단계 변경과 D 변경이 같은 파일에 있을 수 있으므로 전체 diff를 D만의 변경으로 해석하지 않는다.

## 실패를 먼저 보존한 회귀와 독립 리뷰

서버 red 2건은 실제 runner의 중간 tick 타격 누락과 개별 capture가 정기 snapshot을 미루는 동작을 재현했다. 오디오 red 2건은 mute/dispose가 이미 만든 노드를 정리하지 않는 동작을 재현했다. 실패 로그는 수정 후 로그와 별개로 보존했다.

독립 온라인 담당자가 읽기 검토로 다음 두 경로를 찾았다. 둘 다 수락하고 해당 회귀가 실패함을 먼저 확인했다.

1. 이미 running인 context에서 mute 후 비제스처 unmute가 `muted=false`만 바꾸어 계속 소리를 낼 수 있었다. `d-review-gesture-red.log`의 1 FAIL 뒤 독립 activation gate를 적용했다.
2. disconnect/waiting 때 frozen 표시 tick 위의 기존 flash가 남았다. `d-review-flash-red.log`의 2 FAIL 뒤 해당 경계에 renderer reset을 추가했다.

검토자는 수정 소스와 author-run 로그를 다시 읽고 두 수정을 수락했다. 검토자가 단위 시험을 직접 재실행했다고 쓰지 않는다. 상세는 `INDEPENDENT_ONLINE_REVIEW.md`에 있다. 관련 없는 refactor나 기존 lint 전면 정리는 하지 않았다. Root의 전체 non-fix lint 비교에서 runner에 생긴 새 8개 Prettier 오류는 해당 파일만 기존 Prettier로 정리했고, 단일 파일 lint 0으로 확인했다.

## 실제 실행 명령

Node는 `/private/tmp/ft-transcendence-runtime/node_modules/.bin/node` 18.20.8이다. 현재 설치된 Jest/ts-jest/TypeScript/Prettier/ESLint를 사용했고 의존성/lockfile을 바꾸지 않았다. 아래 Jest/format 명령은 `backend/` cwd다. stdout/stderr는 `> ../docs/home-online-polish/evidence/<이름>.log 2>&1`로 표의 별도 로그에 저장했다.

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/feedback-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/feedback-jest.json --runInBand --watchman=false --testPathPattern=audio-feedback.spec
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/feedback-jest.json --runInBand --watchman=false --testNamePattern='cannot reuse'
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/online-session-jest.json --runInBand --watchman=false --testNamePattern='clears an actual presented hit flash'
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/online-session-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/prettier/bin-prettier.js --write src/game/server-match-runner.ts
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/eslint/bin/eslint.js src/game/server-match-runner.ts --no-fix
```

frontend 타입/범위 lint/temp build는 `frontend/` cwd다.

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/typescript/bin/tsc --noEmit --pretty false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/eslint/bin/eslint.js src/arcade/audio-feedback.ts src/arcade/event-presentation.ts src/arcade/online-preferences.ts src/arcade/online-session.ts src/arcade/snapshot-buffer.ts src/arcade/keyboard-controller.ts src/components/game/OnlineGameShell.vue src/plugins/gamePlayService.ts --no-fix
VUE_APP_ENABLE_GUEST_LOGIN=true VUE_APP_ARCADE_DEBUG=true /private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/@vue/cli-service/bin/vue-cli-service.js build --dest /private/tmp/ft-transcendence-d-dist
```

저장소 root에서 실제 서비스와 diff 검사를 실행했다.

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node scripts/check-arcade.cjs online
git diff --check
```

`online` 명령이 실제로 실행한 backend Jest config는 `test/online-jest.json`, `test/lifecycle-jest.json`, `test/service-jest.json`이며 위와 같은 Node/`--no-experimental-fetch`/`--runInBand --watchman=false`를 사용했다. 결합 로그 첫 줄마다 명령과 cwd가 있다. fixture는 고정 allowlist `127.0.0.1:55432`의 전용 PostgreSQL에 임의 격리 schema를 만들고 제거한다. 실제 JWT·Nest gateway·Socket.IO·DB transaction을 사용하며 운영 AppModule/.env/DB/OAuth/mail은 사용하지 않는다. 로컬 fixture 연결은 승인된 sandbox escalation으로 실행했고 자격 증명은 출력하지 않았다.

## 결과와 원시 증거

모든 로그는 `docs/home-online-polish/evidence/` 아래다. 중간 red/after 실행과 최종 실행은 중복 합산하지 않는다. 새 설정에 시험 파일을 단계적으로 추가했으므로 초기 feedback 전체 실행의 test 수는 최종 18과 다르다.

| 실행 | 실제 결과 | 로그 |
|---|---|---|
| 서버 이벤트/cadence 수정 전 | 2 FAIL, exit 1 | `d-server-events-red.log` |
| 같은 서버 회귀 수정 후 | 2 PASS, exit 0 | `d-server-events-after.log` |
| 오디오 node cleanup 수정 전 | 2 FAIL, exit 1 | `d-audio-red.log` |
| 초기 D feedback | 4 PASS, exit 0 | `d-feedback-first.log` |
| 리뷰 비제스처 회귀 수정 전 | 1 FAIL / 4 미선택, exit 1 | `d-review-gesture-red.log` |
| 리뷰 flash 회귀 수정 전 | 2 FAIL / 28 미선택, exit 1 | `d-review-flash-red.log` |
| 리뷰 수정 후 feedback | 14 PASS, exit 0 | `d-feedback-after-review.log` |
| 리뷰 수정 후 session | 30 PASS, exit 0 | `d-client-after-review.log` |
| 최종 D feedback | **4 suites / 18 PASS**, exit 0 | `d-feedback-expanded.log` |
| 최종 online session/recovery | **34 PASS**, exit 0 | `d-client-expanded.log` |
| 실제 online/lifecycle/service | **3 + 7 + 5 = 15 PASS**, exit 0 | `d-online-services.log` |
| frontend noEmit | 최초·확장 후 PASS, exit 0 | `d-typecheck-first.log`, `d-typecheck-expanded.log` |
| frontend 범위 lint 최초 | exit 0, non-null assertion 경고 1개 | `d-scoped-lint.log` |
| 같은 범위 lint 최종 | exit 0, 오류/경고 0 | `d-scoped-lint-final.log` |
| 별도 frontend build | PASS, exit 0 | `d-frontend-build.log` |
| runner 단일 파일 format | PASS, exit 0 | `d-runner-format.log` |
| runner 단일 파일 lint | exit 0, 오류/경고 0 | `d-runner-lint-final.log` |
| format 후 diff whitespace | PASS, exit 0 | 실행 tool 결과 (`git diff --check`) |

18개 feedback 시험은 서버 3, presentation 7, audio 6, preference 2개다. 실제 runner에서 합법적인 paddle-follow 입력으로 중간 broadcast 사이 타격을 찾는 시험과, 최대 보관량을 검증하려고 매 tick Power-ready 상태를 인위적으로 준비하는 stress 시험을 분리했다. 후자는 160개 실제 코어 이벤트/최대 64개 보관을 검사하지만 정상 경기 플레이로 보고하지 않는다. 또한 소유 copy, 120tick 제거, epoch cursor 유지, full-ready history 억제, 표시 tick 전 무음, 반복/과거/late/terminal/forfeit, 8 voice 상한과 late resume dispose를 검사했다.

34개 session 시험은 실제 session/renderer/keyboard 클래스를 소유한 fake DOM/transport에서 실행한다. server-confirmed event를 adapter에 전달하는 시점, 실제 흰 paddle fill을 disconnect/waiting에서 지우는 동작, 마지막 점수와 terminal feedback, 선택 preset만 입력 캡처, observer 입력 0과 이전 N1/N2/N3 소유권을 검사한다. 실제 Chrome이나 사람의 키보드/청취 시험으로 분류하지 않는다.

temp build는 `/private/tmp/ft-transcendence-d-dist`, hash `43e00e78cf2258df`다. 이 빌드가 살아 있는 서버라는 뜻은 아니다. 별도 E 담당자에게 같은 소스 backend와 함께 쓰도록 전달했다. default `frontend/dist`를 이 작업이 덮어쓰지 않았다. ts-jest 설정 권고와 Browserslist/번들 크기 경고는 보존했고 숨기지 않았다. 저장소 전체의 기존 lint 실패와 root가 실행한 최종 전체 검증은 통합 보고서에서 구분한다.

## 판정과 한계

D 구현과 위 author-run 검증은 **READY_FOR_REVIEW**다. 소스에서 독립적으로 확인된 두 리뷰 결함은 red 회귀 후 수정했고 새로운 확정 결함은 추가로 보고되지 않았다. 최종 실제 Chrome 경기·음소거·native audio/canvas·관전 재접속 검토와 이전 로컬/AI 회귀는 별도 E 기록을 함께 읽어야 한다. 사람의 직접 청취/물리 키보드, 실제 WAN 지연·패킷 손실, 모든 브라우저 호환, 운영 배포는 이 PASS 범위에 포함하지 않는다.
