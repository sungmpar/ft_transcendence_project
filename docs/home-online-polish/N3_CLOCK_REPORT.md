# N3 — 폐기된 서버 시간 이후 보간 회복

기준 저장소는 `sungmpar/ft_transcendence_project`, 브랜치는 `main`, HEAD는 `2f11bee69c2d55ed938b53f9750119a890396fb7`이다. 이 문서는 기존 팀 변경과 이번 Goal의 미커밋 작업 위에 적용한 N3만 설명한다. commit/push/PR/댓글/배포/운영 DB 변경은 하지 않았다. `shared/game-core.ts`와 `shared/fixed-clock.ts`는 N3에서 수정하지 않았다.

## 원인과 변경

서버는 60Hz 물리를 최대 8tick까지 따라잡고 남은 시간을 버린다. 기존 buffer는 `도착 시각 - tick × 1000/60`의 최솟값만 보관하므로, 폐기 후 계속 뒤처진 물리 tick을 이전 시간 기준으로 표시했다. 최신 위치가 움직여도 보간은 영구 underflow일 수 있었다.

`Snapshot`에 필수 `instanceId`와 `clockEpoch`를 추가했다. 서버 runner마다 UUID 인스턴스를 만들고, 실제 `droppedMs > 0` 또는 중지 후 `start()`에서만 epoch를 올린다. input `generation`은 그대로 입력 소유권을 뜻한다. 물리 tick, 규칙, 점수와 승패 판정은 바꾸지 않는다.

같은 instance의 더 높은 epoch를 받을 때만 buffer가 과거 보간 기록과 offset을 비우고 첫 새 상태로 명시적으로 snap한다. 이후 동일 epoch에서는 기존 최소 offset, 100ms 표시 지연, 정상 표시 시간 단조성을 유지한다. offset을 모든 도착마다 교체하거나 매 패킷마다 reset하지 않는다. `resyncCount`를 추가하고 누적 underflow/수신/거부 진단을 유지해 시간 폐기를 숨기지 않는다. 화면 renderer의 이전 trail/flash도 epoch 경계에서 reset한다.

epoch가 높더라도 뒤로 간 sequence/tick/도착 시각은 거부한다. 이전 epoch, 중복, 다른 instance의 snapshot도 현재 session을 덮지 못한다. 다른 instance를 채택하는 경계는 새로 승인된 full ready로 생성한 session/buffer이다. `SessionRecovery`는 활성 같은 경기의 다른 instance ready를 input generation이 더 높더라도 거부한다. 서버 재시작 후 이전 경기를 복원하는 기능은 추가하지 않았으며 기존 `unavailable → 로비` 정책을 유지한다.

점진적인 offset 재조정도 검토했다. 도착값만으로 지터와 영구적인 서버 시간 폐기를 구별하려면 추가 임계치·수렴 시간이 필요하다. 실제 폐기 여부를 이미 아는 서버가 epoch를 보내는 방식이 고정된 회복 제한을 명확히 검증하는 최소 변경이었다. 첫 새 상태로의 snap과 이후 buffer 재충전은 의도한 동작이다.

이 변경은 같은 소스의 서버·클라이언트·validator·fixture를 함께 사용해야 한다. `v: 1` 입력 계약을 유지하지만 N3 snapshot의 clock 필드는 필수이며, 이전 서버/클라이언트와의 혼합 호환을 보장하지 않는다. 기존 N1/N2의 request 식별자, participant/watch 권한, Socket.IO ACK timeout, 저장 결과와 retired 경기 정책은 보존했다.

## 변경 파일

- `shared/protocol.ts`: clock 필드, scalar capture, snapshot/full ready 검증.
- `backend/src/game/server-match-runner.ts`: runner instance, 폐기·재개 epoch.
- `frontend/src/arcade/snapshot-buffer.ts`: 명시적 re-anchor, 순서/instance 경계, 진단.
- `frontend/src/arcade/online-session.ts`: instance 소속 검사, clock capture, renderer reset.
- `frontend/src/arcade/session-recovery.ts`: 같은 경기의 instance 경계와 ACK 승인 순서.
- `backend/src/game/{clock-recovery,server-match-runner,snapshot-buffer,protocol,online-session}.spec.ts`: 실제 runner 결합/단위 회귀.
- `backend/test/online-browser-unit-fixture.ts`: clock 필드를 포함한 소유된 test snapshot.
- `backend/test/online-lifecycle.e2e-spec.ts`: 실제 재접속 시 양쪽 플레이어와 관전자의 동일 instance/새 epoch 확인.
- `backend/test/clock-recovery-jest.json`: 별도 결합 시험 설정. 루트 담당자가 `scripts/check-arcade.cjs unit`에 연결했다.

## 사전에 고정한 회복 기준

실제 `ServerMatchRunner`와 `SnapshotBuffer`를 10ms 가짜 scheduler, 50ms 전송 지연, 10ms 표시 샘플링으로 연결했다. 처음 1초에 실제 60tick/20snapshot을 확인한다. 서버 callback만 멈춘 뒤 다시 실행하고, **복귀 후 300ms 이내** 실제 복귀 이후 두 snapshot의 tick 사이에서 표시 tick과 움직이는 좌표가 엄격한 중간값이어야 한다. 모든 보간 좌표가 실제 끝점의 lerp와 일치해야 한다. 표시 위치 이동이나 underflow 횟수만으로 통과시키지 않는다.

`clock-recovery-baseline.log/.json`은 구현 전 증거로 보존했다. 7개 중 3 PASS / 4 FAIL이었다. 500/1000ms·반복 stall과 의도적 pause/resume에서 회복하지 못했다. 이때 underflow episode는 1로 유지되므로 카운터만 보면 실패를 놓친다.

`clock-recovery-after.log/.json`은 최초 수정 후 같은 7개 조건의 7 PASS이다. `n3-clock-final.log/.json`은 같은 조건과 다른 실제 runner 인스턴스 경계 사례를 합한 8 PASS이다. 300ms 판정은 완화하지 않았다.

| 사례 | baseline | N3 strict interpolation 회복 | 시간 폐기 |
|---|---|---|---|
| 200ms stall | PASS (105ms) | PASS (155ms) | 66.667ms |
| 500ms stall | FAIL | PASS (155ms) | 366.667ms |
| 1000ms stall | FAIL | PASS (155ms) | 866.667ms |
| 500ms × 3회 | FAIL | 매번 PASS (155ms) | 매번 366.667ms |
| 의도적 500ms pause/resume | FAIL | PASS (205ms) | 0ms |
| ±40ms 도착 지터 | PASS | PASS, 중간 보간 200회·표시 역행 없음 | 0ms |

200ms 사례의 추가 50ms는 새 epoch에서 오래된 보간 구간을 사용하지 않고 새 데이터로 100ms buffer를 채우는 명시적 정책의 결과다. 반복 stall에서는 epoch/resyncCount가 각각 1→2→3으로 증가하고 누적 underflow 기록도 유지된다. 이 숫자는 합성 scheduler 시험 결과이며 WAN/TCP 장애, 실제 브라우저 지연이나 사람의 체감 측정이 아니다.

다른 인스턴스 사례는 같은 경기 ID의 두 실제 runner 객체를 만든다. 기존 buffer는 다른 인스턴스를 거부하고, 새 full-state 경계로 reset한 buffer만 새 tick을 채택하며 늦은 이전 인스턴스 패킷을 거부한다. 실제 서버 프로세스 재시작이나 경기 복원 성공을 의미하지 않는다.

## 독립 리뷰 반영

온라인 담당자가 `SessionRecovery`의 ACK 경로를 검토했다. 다른 instance의 direct ready는 거부했지만, 구조상 유효한 복구 ACK가 먼저 timeout을 취소하면 View가 ready를 거부한 뒤 실패/로비 경로를 잃을 수 있었다. 해당 지적을 수락했다.

새 회귀 `keeps the owner timeout when a matching recovery ACK contains an inadmissible server instance`를 수정 전에 실행해 **1 FAIL**을 재현했다(`n3-review-ack-red.log`). ready 승인 여부를 부작용 없는 공통 검사로 추출하고 ACK 소비 전에 검사한다. 승인할 수 없는 ACK는 기존 5초 타이머를 유지하며 확인되지 않은 승패를 만들지 않는다. 수정 후 전체 client **28 PASS**이며, 검토자가 소스와 로그를 다시 읽고 수정 수락을 기록했다(`INDEPENDENT_ONLINE_REVIEW.md`; 검토자는 직접 시험을 재실행하지 않았다). 단순 스타일 의견이나 범위 밖 refactor는 추가하지 않았다.

## 정확한 실행 명령과 증거

Node는 `/private/tmp/ft-transcendence-runtime/node_modules/.bin/node` (18.20.8), 저장소에 설치된 Jest/ts-jest/TypeScript를 사용했다. 의존성/lockfile은 바꾸지 않았다. 아래 Jest 명령은 모두 `backend/`에서 실행했다.

```sh
ARCADE_CLOCK_REPORT=clock-recovery-baseline /private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/clock-recovery-jest.json --runInBand --watchman=false
ARCADE_CLOCK_REPORT=clock-recovery-after /private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/clock-recovery-jest.json --runInBand --watchman=false
ARCADE_CLOCK_REPORT=n3-clock-final /private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/clock-recovery-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/core-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/snapshot-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/server-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/online-session-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/online-session-jest.json --runInBand --watchman=false --testNamePattern='keeps the owner timeout'
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/frontend-contract-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/online-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/lifecycle-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/lifecycle-jest.json --runInBand --watchman=false --testNamePattern='pauses short disconnects'
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch node_modules/jest/bin/jest.js --config test/service-jest.json --runInBand --watchman=false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/@nestjs/cli/bin/nest.js build
```

frontend 명령은 `frontend/`에서 실행했다.

```sh
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/typescript/bin/tsc --noEmit --pretty false
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/eslint/bin/eslint.js src/arcade/snapshot-buffer.ts src/arcade/online-session.ts src/arcade/session-recovery.ts --no-fix
VUE_APP_ENABLE_GUEST_LOGIN=true VUE_APP_ARCADE_DEBUG=true /private/tmp/ft-transcendence-runtime/node_modules/.bin/node node_modules/@vue/cli-service/bin/vue-cli-service.js build --dest /private/tmp/ft-transcendence-n3-dist
```

각 명령의 stdout/stderr는 `docs/home-online-polish/evidence/n3-*.log`에 직접 저장했다. 실행 시 shell의 `> ../docs/home-online-polish/evidence/<이름>.log 2>&1` 리다이렉션을 붙였다. baseline/최초 after/리뷰 red/최종 결과는 서로 다른 파일이며 이전 실패를 덮어쓰지 않았다.

실제 online 시험은 `startOnlineFixture`가 고정 allowlist `127.0.0.1:55432`의 전용 PostgreSQL에 임의 이름의 격리 스키마를 만들고 시험 후 삭제한다. 운영 AppModule/.env/DB/OAuth/mail을 사용하지 않는다. fixture의 실제 JWT·Nest gateway·Socket.IO 연결·DB 저장을 사용하며, 자격 증명은 로그에 남기지 않는다. 로컬 DB 연결을 위해 승인된 sandbox escalation으로 실행했다.

## 검증 결과

| 검증 | 실제 결과 | 원시 로그 |
|---|---|---|
| 구현 전 결합 회귀 | 3 PASS / 4 FAIL, exit 1 | `clock-recovery-baseline.log` |
| 최초 구현 후 같은 결합 조건 | 7 PASS, exit 0 | `clock-recovery-after.log` |
| 최종 결합/인스턴스 | 8 PASS, exit 0 | `n3-clock-final.log` |
| core/AI/protocol | 46 PASS, exit 0 | `n3-core.log` |
| SnapshotBuffer | 19 PASS, exit 0 | `n3-snapshot.log` |
| 서버/N1/N2 세션 | 31 PASS, exit 0 | `n3-server.log` |
| 최초 online client | 27 PASS, exit 0 | `n3-client.log` |
| 리뷰 ACK 회귀 수정 전 | 1 FAIL / 27 미선택, exit 1 | `n3-review-ack-red.log` |
| 최종 online client | 28 PASS, exit 0 | `n3-client-final.log` |
| frontend 소유권/계약 | 10 PASS, exit 0 | `n3-frontend-contract.log` |
| 실제 Socket.IO 통합 | 3 PASS, exit 0 | `n3-online-integration.log` |
| 실제 저장/연결 수명 | 7 PASS, exit 0 | `n3-online-lifecycle.log` |
| 실제 재접속의 epoch 추가 확인 | 1 PASS / 6 미선택, exit 0 | `n3-reconnect-clock.log` |
| 실제 기존 서비스 API 보존 | 5 PASS, exit 0 | `n3-service-preservation.log` |
| frontend 타입/범위 lint | 최초·최종 PASS, exit 0 | `n3-frontend-typecheck*.log`, `n3-frontend-lint*.log` |
| backend build | PASS, exit 0 | `n3-backend-build.log` |
| 별도 frontend build | 최초·최종 PASS, exit 0 | `n3-frontend-build*.log` |

최종 temp frontend build hash는 `d47d4cedc84297c2`이며 `/private/tmp/ft-transcendence-n3-dist`에 있다. 첫 build hash `21b898c02412d3eb`는 ACK 리뷰 수정 이전이다. 최종 `git diff --check`도 exit 0이었다.

ts-jest의 기존 설정 권고와 Browserslist 데이터/번들 크기 경고가 출력되었다. 의존성 갱신이나 경고 은폐를 하지 않았다. 범위 frontend lint에는 오류/경고가 없었다. 저장소 전체의 기존 lint 부채를 해결했다고 주장하지 않는다.

N3 판정은 **READY_FOR_REVIEW — N3 구현 및 위 명령 검증 완료**이다. 실제 runner+buffer의 결정적 회복과 실제 service 회귀를 검증했다. 이 단계의 새로운 Chrome 화면/체감/WAN impairment 시험은 아직 하지 않았다. 별도 temp frontend build를 사용해 다른 담당자가 검토 중인 N1/N2 서버+기존 `frontend/dist` 쌍을 바꾸지 않았다. 최종 화면/온라인 효과 검증은 이후 같은 소스 서버·클라이언트 쌍에서 수행해야 한다. D 이벤트 전달/오디오는 N3 완료와 별도 단계이며 이 문서의 PASS에 포함하지 않는다.
