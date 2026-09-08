# Arcade implementation decisions

## Contribution boundary and shared source

The baseline team project already had Vue/TypeScript, Nest/Socket.IO server-authoritative Pong, authentication, accounts, chat, friends, invitations, spectators and persisted history. This work preserves those service boundaries and adds an explicitly public arcade entry. Guest login still creates a real account and is not the local mode.

`shared/game-core.ts` owns config, scalar state, inputs, phases, collision, Power, scoring and seeded serve randomness. Browser and backend compile the same TypeScript source. A file dependency package/workspace was considered but unnecessary: direct source imports avoid copied builds and new dependency/lockfile relationships. Backend rootDir is the repository root and output is `backend/dist/backend/src/main.js` plus `backend/dist/shared/`; Nest CLI entry and production start follow that path. Docker builds use repository context and mount the shared directory alongside each app. Actual Docker execution must be distinguished from inspection and native builds.

## Rules and time

Default world 1200×800, first to 6. Paddles remain 30×200 (Power 400), at a 20-unit inset, maximum movement 900 units/second. Default ball total speed 720/s, accelerating 1.025 per valid hit to 1500/s. Support tests extend to a bounded max speed 6000/s and paddle height 20. The old ball began with dx10,dy-10 per 60Hz call, approximately 848.5/s total; slower initial speed and symmetric center reflection are deliberate feel policies, not discovered historical incidents.

The core accepts one immutable step at 60Hz. Ready=120 ticks, point delay=60, then next serve; a finished state is frozen. RNG is injected; no hidden wall clock or random source. Fixed clock accepts injected elapsed milliseconds, caps a frame at 250ms, runs at most 8 steps, discards remaining whole overdue ticks and retains only fractional time. Pause clears accumulator; hidden return must never fast-forward seconds. Same tick inputs/config/seed reproduce in the tested implementation, not a claim of bitwise cross-platform determinism.

Paddles move and clamp before ball sweep. Contacts use swept inward paddle faces with a radius-expanded vertical interval, including tangency. This is an AABB-style corner approximation, not exact circle-versus-rounded-corner geometry. Goals use the ball center at x=radius or width−radius. Earliest time wins; for simultaneous contacts paddle reflection is resolved before the wall directs velocity inward, goals last. Eight contacts per tick and separation epsilon bound work and repeat contact; exceptional leftover time is discarded. Center hit vy=0; normalized hit offset sets up/down-symmetric angle up to 60°, total speed is bounded. A point increments once, centers the next serve once and transitions before later physics can score again.

Power only activates on a press edge in rally, with charge5. Held motion is independent. Normal valid reflection charges up to5; powered reflection consumes one charge and zero immediately restores normal height. Both activation and release clamp y to worldHeight−effectiveHeight. Drawing uses the authoritative effective height.

## Input and AI

Platform keyboard control translates physical codes into up/down held booleans and action edges, neutralizes opposed keys, ignores key repeat for action, and owns/disposes its listeners. Focus/form/chat handling belongs to the controller/session, not the core. Local blur/hidden pauses and clears; online must clear input without independently stopping server time. Physical keyboard rollover remains a manual limitation.

`shared/ai.ts` reads copied observations only after a configured delay. It predicts time to the inward face and folds vertical travel over the ball-center wall interval; negative modulo and multiple bounces are handled. Moving-away/invalid/near-zero vx inputs choose central return or neutral. Easy/Normal/Hard vary observation/decision intervals, delay, aim error and deadzone; they never alter movement speed or score. Random aiming uses its own injected RNG. Debug values expose actual observations/targets/inputs. No human win-rate claim has been measured.

## Network protocol groundwork

`shared/protocol.ts` validates complete bounded input DTOs at runtime. A connection-owned inbox checks match ID, generation, monotonically increasing sequence, bounded sequence/action jumps and token bucket frequency. Held input refresh is expected every100ms; a350ms TTL releases lost keyups. Repeated actionId cannot activate repeatedly; multiple unseen presses before one step collapse to a single pending edge. `receivedSeq` and applied `ack` are separate; the server runner must call `markApplied` only after its synchronous step succeeds. Input reception never steps simulation.

Snapshot capture owns a scalar clone so delayed sends cannot read later mutations. Runtime checks reject non-finite/invalid geometry, rule and phase data. The score-finished contract requires the winning score. Forfeit/disconnect instead sends a separate resultStatus winner/reason plus end; it preserves the actual score and never invents six points. These DTO checks are complemented by the actual server/session and database tests listed in TEST_REPORT.md.

## Source references

The bounded accumulator design follows the tradeoff between catch-up work and overload described by [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/). Delayed [snapshot interpolation](https://gafferongames.com/post/snapshot_interpolation/) exchanges display latency for smoother time-consistent rendering; its value must be tested here. [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/) distinguish ordering from delivery, and its [connection recovery documentation](https://socket.io/docs/v4/connection-state-recovery/) does not prove support in this repository's pinned Socket.IO4.5.1. Do not claim that changing emit options eliminates TCP head-of-line blocking.


## 온라인 시간과 표시

`ServerMatchRunner`는 같은 `stepGame` 원본을 60Hz로 실행한다. Socket 입력은 registry로 현재 사용자·소켓·경기·generation을 확인하고 한 connection inbox에만 전달한다. 명목 20Hz snapshot과 serve/point/finish 즉시 snapshot은 simulation과 분리되어 있다. DB 저장은 tick callback 안에서 await하지 않으며, 한 방 오류는 다른 방 loop를 중단하지 않는다.

`OnlineSession` 하나가 RAF·KeyboardController·socket listener·측정값을 소유한다. snapshot 도착은 RAF를 만들지 않는다. 매 frame은 `SnapshotBuffer`의 같은 presentation tick에 있는 공과 양쪽 패들을 그린다. 자기 패들 예측은 추가하지 않았다. 다른 시점의 공과 자기 패들을 섞는 불일치 및 재적용 입력 시간 정의를 피하고, 우선 같은 시간축의 표시와 실제 측정 가능성을 택했다. 사용자가 누른 키는 즉시 로컬 패들을 움직이지 않으며 서버 적용→snapshot→표시 지연을 거친다.

보간 buffer는 최대 32개 scalar snapshot을 소유 복사한다. `arrivalMs − serverTick × 1000/60`의 관측 최솟값으로 시간 대응을 추정하고 기본 100ms 뒤를 표시한다. 이는 시계 동기화나 편도 지연 측정이 아니다. 늦은/중복 seq를 거절하고 표시 시간을 되감지 않는다. 고갈하면 최신 상태에 고정하고 무제한 외삽하지 않는다. 득점·랠리·phase·유효 패들 크기·config 변화는 직선 보간하지 않는다. reconnect full state는 새 session generation으로 buffer를 버리고 시작한다. 벽/패들 반사 사이를 직선으로 잇는 짧은 표시 오차는 남으며, 실제 측정에서 최대 오차와 jitter 고갈을 공개했다.

개발용 `?debug=1`은 dev 또는 `VUE_APP_ARCADE_DEBUG=true` 빌드에서만 복제한 상태·실측값을 제공한다. 상태 주입 API는 없다. `?display=latest`는 비교용 최신 snapshot 즉시 표시다. HUD의 input ACK 왕복은 키 패킷 송신부터 실제 적용 ACK 수신까지이며, 서버 tick/송신 대기를 포함한다. 별도 nonce echo는 동일 클라이언트 시계로 전송 RTT를 잰다. 광학 지연을 계측한 수치가 아니다.

## 연결 소유권과 결과 저장

인증 사용자 ID, DB 경기 ID, 일시적 socket ID, 단조 증가 generation은 서로 다르다. 활성 게임 탭이 있으면 새 탭은 거절하여 기존 탭이 제어권을 가진다. 실제 단절 시 입력을 비우고 방 전체를 5초간 멈춘다. 같은 인증 사용자가 유예 안에 돌아오면 새 소켓에 소유권을 연결한다. 모두 복귀하면 accumulator를 비우고 양쪽 플레이어와 관전자에게 새 generation/full state를 전송한다. 옛 소켓 disconnect나 이전 generation 입력은 새 소유자를 제거하거나 조작하지 못한다. 명시적 메뉴/포기는 즉시 종료하고, 단절은 유예 만료 때 종료한다. 관전은 입력 권한을 갖지 않는다.

매칭은 await 전 두 사용자를 예약하고 실제 `MatchService.create`의 DB 생성 ID를 받은 뒤에만 방을 publish한다. 생성 도중 단절한 미공개 경기 행은 그 생성 경로에서 정리한다. `finalizeMatch`는 저장 await 전 인메모리 종료를 예약한다. 정상 점수·포기·단절 만료가 같은 경로를 쓰며, core의 종료 상태와 영속 저장 완료는 별개다.

`MatchService.update`는 DB transaction에서 사용자 행을 ID 순으로 잠그고 참여자를 확인한다. 아직 winner/loser가 없는 행에만 조건부로 결과를 쓰며 affected rows를 확인한다. 이미 같은 결과라면 저장된 값을 반환하고 다른 결과는 conflict다. 업적은 이 transaction 안에서 승수와 함께 계산하며 Set으로 중복 항목을 막는다. 클라이언트의 achievement 요청은 더 이상 저장 주체가 아니다. 실패하면 rollback하고 첫 시도 후 250ms, 다시 실패하면 1000ms 뒤에 재시도하여 총 3번으로 제한한다.

마지막에도 저장 응답을 확인하지 못하면 실패 안내와 권위 있는 경기 승패를 따로 보내고 소켓·방·binding을 해제해 재매칭을 허용한다. COMMIT 후 응답 유실일 수 있으므로 '전적 미반영'으로 단정하지 않는다. 최근 100개의 scalar 실패 진단만 메모리에 남긴다. 완료되지 않은 DB 행은 전적 조회에서 제외하여 기존 프로필의 null winner 역참조를 막는다. 프로세스 재시작 복구, 영속 retry queue, 여러 서버 사이 exactly-once는 제공하지 않는다.

예상하지 못한 simulation 예외는 `sessionStatus: aborted`로 알리고 승패를 만들지 않은 채 runner/registry를 해제한다. 그 방의 미완료 행 정리를 시도하며 정리 실패는 제한된 진단에 남긴다. 정상 득점이나 DB 저장 확인 실패와 UI 상태를 구분한다.

## 화면·검증의 범위

로컬/AI는 같은 renderer와 입력 controller를 쓰며 충돌 flash, 짧은 궤적, 득점/종료 피드백, muted 기본값의 합성음을 제공한다. 소리는 첫 사용자 상호작용 뒤에만 시작하며 다운로드한 음원이 없다. reduced motion에서는 flash/궤적을 줄인다. 온라인도 같은 논리 좌표와 renderer를 사용한다. CSS 크기와 DPR backing store는 physics를 바꾸지 않으며 매 draw의 setTransform으로 누적 변환을 피한다. 640px 화면에서는 물리 키보드가 필요함을 안내한다.

새 코트는 CSS/Canvas 기하 도형이고 외부 상표 캐릭터·음악·이미지를 복제하지 않았다. 기존 팀의 sidebar, 프로필 기본 이미지, 아트는 보존했으며 개인 저작물이라고 주장하지 않는다. 기존 자산의 라이선스를 새로 확정한 것은 아니다.

정적 코어/프로토콜/runner 검사, 실제 브라우저 키 입력 검사, 실제 JWT/HTTP/Socket.IO/PostgreSQL fixture를 구분한다. fixture는 app.module.ts의 운영 DB 설정과 외부 OAuth/메일 bootstrap을 불러오지 않지만 기존 middleware/controller/gateway/service와 production ValidationPipe를 실행한다. 수동 fixture도 기존 guest endpoint가 발행한 JWT를 쓴다. 소스가 바뀐 후 실제 실행된 명령과 지원 한계는 TEST_REPORT의 최종 표가 기준이다.
