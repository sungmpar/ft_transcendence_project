# 기존 Pong을 서버 없는 로컬·AI 대전과 공통 경기 코어로 확장한 사례

작성일: 2026-09-07. 대상은 `sungmpar/ft_transcendence_project`이며, 기준 커밋은 `f970554de528b2fceb46aa7aa3a10d43c192b65b`다. 최종 판정은 **`PARTIALLY_IMPLEMENTED`**다. 로컬·AI와 격리된 온라인 환경에서 실행 가능한 결과와 검증 증거를 확보했지만, 전체 서비스 Docker 실행·실제 외부 OAuth·추가 브라우저·사람의 직접 플레이까지 모두 검증한 상태는 아니다.

기존 Vue/TypeScript, NestJS/Socket.IO, PostgreSQL 서비스와 팀 작업을 기반으로 한 AI 보조 개선 사례다. 기존 프로젝트 전체나 저자가 확인되지 않은 코드를 사용자의 독자 작업으로 설명하지 않는다. 이번 변경은 기준 커밋 이후의 로컬 미커밋 변경이며, commit·push·PR·배포·운영 데이터 변경은 수행하지 않았다. 착수 시점과 기여 경계는 [BASELINE.md](BASELINE.md)에 기록했다.

## 1. 문제

우선 해결할 문제는 로그인·백엔드·DB 없이 한 화면과 한 키보드로 Pong을 실행할 수 없다는 점이었다. 목표는 공개 경로에서 로컬 두 플레이어가 동시에 조작하고, 같은 규칙으로 AI와도 대전하며, 한 경기의 종료·재시작·메뉴 복귀까지 이어지는 경험이었다. 기존 온라인 대전에는 이미 서버 권한 판정이 있었다. 이를 새로 도입했다고 주장하지 않고 공통 경기 코어에 통합했다.

경기 실행부를 바꾸면서 로그인·게스트 플래그·채팅·친구·초대·관전·프로필·전적을 보존해야 했다. 따라서 온라인 인증을 전체 해제하거나 기존 서비스를 별도 게임으로 대체하는 방식은 요구에 맞지 않았다.

## 2. 원인과 재현

구현 전에 최신 기본 브랜치, 로컬 worktree와 미커밋 변경, 열린 이슈·PR의 의미상 중복, 설치 및 회귀 테스트 경로를 확인했다. 열린 이슈와 PR은 조회 시점에 없었지만, 이것을 관찰할 수 없는 모든 동시 작업이 없다는 뜻으로 확장하지 않았다.

다음은 당시 코드에 실행한 회귀 테스트에서 확인한 현상이다. 테스트 실패 수를 사용자 장애의 수로 해석하지 않는다.

| 관찰한 현상 | 코드상 원인 | 확보한 증거 |
|---|---|---|
| 이동 중 Power 발동을 독립적으로 표현하지 못하고, 위·아래 동시 입력도 중립이 아니었다. | 한 문자열에 이동과 능력 요청을 함께 넣는 입력 계약이었다. | [frontend baseline](evidence/baseline-frontend-regressions.log) |
| 서버가 보낸 Power 모드가 화면 상태에서 `undefined`가 되었다. | `roomMode`와 다른 필드명을 읽는 store 계약이 어긋났다. | 같은 baseline의 C03 |
| 반복 start와 중단 뒤 늦은 콜백이 렌더링 수명을 늘릴 수 있었다. | RAF·이벤트 리스너의 소유와 실행 세대 정리가 충분하지 않았다. | 같은 baseline의 C08 |
| 정상 하단 이동에서 y=575의 다음 위치가 590 대신 600이 되었다. | 이동과 경계 보정 순서가 유효한 이동까지 과하게 보정했다. | [backend baseline](evidence/baseline-backend-regressions.log)의 C07 |
| DB가 반환한 실제 경기 ID와 공개한 방 ID가 달랐고, 종료 저장이 중복 호출될 수 있었다. | `count()+1`로 ID를 추정하고, 저장을 기다리기 전에 최종화 소유를 확보하지 않았다. | 같은 baseline의 C09·C10 |

초대·관전자 삭제 helper의 잘못된 인덱스 처리도 시험으로 재현했다. 다만 사용되지 않던 helper의 결함과 정상 사용자 흐름에서 관찰한 장애를 구분했다. 기존 대기열의 비마지막 항목 삭제나 고속 공의 터널링을 실제 운영 장애로 단정하지 않았다. 정상 랠리의 특성화와 새 코어의 경계 시험은 각각 별도로 남겼다.

## 3. 검토한 대안

| 대안 | 판단에 사용한 기준 |
|---|---|
| frontend/backend에 별도 물리 코드를 복사 | 같은 Power·충돌·득점 규칙을 수정할 때 다시 어긋날 수 있어 선택하지 않았다. |
| workspace 패키지와 별도 배포 파이프라인 도입 | 기존 Vue CLI/Nest와 lockfile을 유지하는 작업에는 통합 비용이 컸다. 작은 공유 소스 경로로 시작했다. |
| 브라우저 RAF나 입력 메시지가 물리 시간을 직접 진행 | 렌더 주기와 입력 빈도가 판정에 영향을 주므로 고정 tick과 분리했다. |
| 큰 속도를 작은 substep만으로 처리 | 필요한 분할 수가 속도와 형상에 결합된다. 이번 범위에서는 이동 경로의 접촉 시간을 구하는 방식과 반복 상한을 선택했다. |
| 온라인에서 최신 상태만 즉시 표시 | 지연 비용은 작지만 낮은 snapshot 빈도에서 표시가 계단처럼 바뀐다. 같은 코어·입력 조건의 비교 대상으로 보존했다. |
| 자기 패들만 예측하고 공은 과거 snapshot으로 표시 | 다른 시간축의 공·패들이 화면상의 방어와 서버 판정을 어긋나게 할 수 있어 기본 경로에 넣지 않았다. |

위 대안 전체를 실제 구현해 성능 순위를 낸 것은 아니다. 구현·비교한 즉시 표시와 보간의 실험 조건 및 원시 결과는 [MEASUREMENTS.md](MEASUREMENTS.md)에 따로 기록한다. 프레임워크 교체, UDP 전환, 학습형 AI는 사용자가 정한 범위에서 제외했으며, 실험 결과 열등하다고 주장하지 않는다.

## 4. 선택한 설계

`shared/`의 순수 TypeScript 코어는 경기 상태·규칙·이벤트를 담당한다. browser/Node가 같은 원본을 가져오고, 소켓·DOM·DB·시계는 adapter에 둔다. clock과 RNG를 주입하므로 같은 버전·설정·seed·tick 입력을 재생할 수 있다. 모든 플랫폼의 bitwise 동일성이나 인간 입력 시점의 동일성을 보장한다는 뜻은 아니다.

기본 월드는 1200×800, 6점 선승이다. 이동은 초당 속도와 60Hz tick으로 계산한다. clock은 frame delta를 250ms로 제한하고 한 번에 최대 8 tick만 처리하며, 초과한 정수 tick 시간은 버린다. UI에서 일시 정지하거나 재접속을 기다린 시간을 한꺼번에 따라잡지 않는다.

공은 반지름을 반영해 확장한 패들의 안쪽 면과 충돌한다. 한 tick에서 패들을 먼저 이동·clamp한 뒤 공의 접촉 시간을 계산한다. 동시 접촉은 패들, 벽, 골 순서이며, 반복 상한과 작은 분리 오차를 둔다. 이것은 **확장 AABB 근사**로, 정확한 원과 사각형 모서리 접촉 계산은 아니다. 중앙 타격의 수직 속도 0, 타격 위치에 따른 반사각과 속도 상한은 의도적으로 정한 새 규칙이다.

AI는 지연된 관측으로 벽 반사를 포함한 예상 도착점을 구하고, 오차와 dead zone을 적용해 사람과 같은 `PlayerInput`을 만든다. 난이도는 정보의 시점과 판단 정책을 바꾸며, 패들 속도·점수·능력 비용을 우회하지 않는다.

온라인은 서버의 공통 코어를 60Hz로 진행하고 기본 20Hz snapshot을 전송한다. 브라우저는 공과 양쪽 패들을 같은 표시 시간축에서 보간한다. 이는 추가 표시 지연을 지불하는 선택이며 서버 판정을 빠르게 만드는 기능이 아니다. 메시지 수신이 RAF를 새로 시작하지 않는다.

## 5. 구현한 범위

- `/play`, `/play/local`, `/play/ai`만 공개 경로로 분리했다. 자산을 제공하는 frontend 이후 로컬·AI 경기 흐름에서 인증·사용자 생성·백엔드·Socket.IO 요청은 필요하지 않다. 온라인 경로의 기존 인증은 유지한다.
- 두 키 세트의 동시 이동, 위·아래 중립, 한 번의 능력 press, 키 재매핑·중복 방지, form focus 보호, blur/visibility 일시 정지와 명시적 재개를 구현했다. 점수·카운트다운·결과·재시작·메뉴와 음소거·모션 감소를 함께 제공한다.
- Easy/Normal/Hard AI에 관측 지연·예측·오차·능력 요청을 연결했다. 개발용 진단 화면은 실제 관측 tick·목표·입력을 읽으며, rematch에서는 공과 AI의 난수 수명을 함께 초기화한다.
- 기존 `/game`, 친구 초대, 관전 흐름을 v1 ready/input/snapshot 계약으로 연결했다. 플레이어 권한은 서버의 인증 소켓·방·side·generation이 결정하고, 클라이언트가 주장하는 좌표나 playerId는 사용하지 않는다.
- 입력 sequence와 action ID를 분리하고 TTL·빈도·세대 검사를 적용했다. 짧은 연결 단절은 5초 유예 동안 경기를 멈추며, 복구 시 새 세대와 전체 상태를 전달한다. 명시적 포기는 즉시 처리한다.
- 경기 결과와 업적을 한 DB transaction으로 기록한다. 동일 결과 요청은 중복 반영하지 않으며, 저장 실패는 제한된 횟수만 재시도한다. 종료 승패, 저장 성공, 저장 확인 불가, 시뮬레이션 중단을 UI에서 구분한다. 미완료 행은 기존 전적 응답에서 제외한다.

## 6. 실제 검증

| 범위 | 상태와 검증 방식 | 근거 |
|---|---|---|
| 로컬 2인 | **PASS**. Chromium의 합성 키 입력으로 동시 조작·한 경기 종료·재시작·이탈을 검증. 가속 browser clock 시험과 별도의 실제 wall-clock 랠리 시험을 구분했다. | [P2 browser](evidence/p2-browser-report.json), [live smoke](evidence/p2-live-smoke.json) |
| AI | **PASS**. 같은 browser에서 실제 코어 경기 종료·재시작·지연 관측 표시를 확인. 세 난이도의 정책은 자동 테스트로 검증했다. 사람 상대 승률은 측정하지 않았다. | [P2 browser](evidence/p2-browser-report.json), [최종 unit](evidence/final-unit-check.log) |
| 온라인 2인 | **PASS, 격리 환경 범위**. 실제 Nest/JWT/Socket.IO 두 클라이언트와 PostgreSQL의 한 경기·저장, Chromium 두 context의 한 경기·rematch·메뉴 복귀를 확인했다. 게임 상태를 주입한 성공이 아니다. | [실제 통합](evidence/final-online-integration.log), [두 browser](evidence/p3-online-browser.json) |
| 초대·관전·재접속·저장 실패 | **PASS, 각 시험 범위**. 실제 Socket/DB에서 초대·거절·관전·세대 교체·유예·transaction 재시도·중복 요청을 검증했다. browser 단절/복구도 별도로 확인했다. | [최종 lifecycle](evidence/final-online-lifecycle.log), [browser 복구](evidence/p4-online-lifecycle-browser.json) |
| 기존 서비스 | **PASS, fixture 범위**. 실제 인증된 HTTP와 채팅 두 클라이언트로 게스트 플래그, 프로필·이미지·친구·2FA 접근 조건, 채널·메시지·퇴장, 미완료 경기 전적을 검증했다. | [서비스 5건](evidence/final-service-preservation.log) |
| build·타입·lint | frontend/backend build와 타입 검사 **PASS**. 변경 UI의 scoped lint **PASS**. 전체 프로젝트 lint에는 기존 오류가 남아 **FAIL**을 유지한다. | [build](evidence/final-frontend-fixture-build.log), [backend build](evidence/final-backend-build.log), [타입](evidence/final-frontend-tsc.log), [lint](evidence/final-frontend-nonfix-lint.log) |

숫자 비교는 [MEASUREMENTS.md](MEASUREMENTS.md)와 연결된 CSV/JSON만 사용한다. 추가 지연 0은 실제 RTT 0이 아니며, 입력 ACK 관측 왕복과 별도 전송 RTT를 구분한다. browser RAF 단계 측정을 광학 지연으로, 직렬화 payload 바이트를 전체 네트워크 대역폭으로 부르지 않는다. 실제 명령·exit code·초기 실패는 [TEST_REPORT.md](TEST_REPORT.md)와 [명령 기록](evidence/frontend-agent-command-record.log)을 따른다.

## 7. 한계와 다음 검증

| 아직 완료로 주장하지 않는 항목 | 상태 |
|---|---|
| 전체 AppModule·Docker compose 서비스 실행 | **BLOCKED**. 현재 환경에 Docker 실행 도구가 없으며, 격리 Nest fixture 실행을 전체 서비스 기동으로 대체 표기하지 않는다. |
| 실제 42 OAuth와 외부 메일 전달 | **NOT RUN**. 기존 인증 코드를 보존했지만 외부 공급자까지 검증하지 않았다. |
| Firefox·실제 Safari | **NOT RUN**. Chromium 결과를 다른 브라우저의 성공으로 확대하지 않는다. |
| 두 사람이 같은 물리 키보드로 플레이, 키 rollover·사람 상대 AI 평가 | **NOT RUN**. 브라우저 입력은 자동화된 합성 이벤트다. |
| 모니터의 광학 입력 지연·실제 WAN 손실·서버 재시작 후 경기 복구 | **NOT RUN / 범위 미구현**. 자동화 timing, application 지연 실험, 한 프로세스 내 유예 복구와 구분한다. |

따라서 이 사례의 최종 판정은 `PARTIALLY_IMPLEMENTED`다. 실행 결과가 있는 로컬·AI 완결과 격리 온라인 검증을 보존하면서, 위 미검증 항목을 추가해야 전체 환경의 완료 판정을 논의할 수 있다. 다음 우선 검증은 두 사람이 같은 물리 키보드로 로컬 한 경기와 Power 동시 입력을 수행하고, 실제 브라우저·디스플레이에서 조작감과 판정 불일치를 관찰하는 것이다.

## 8. 관련 소스와 설명할 수 있어야 할 질문

아래는 설명 준비를 위한 질문이다. 사용자가 이미 직접 답하거나 구현을 검토했다는 증거는 아니다. 줄 번호는 2026-09-07 작성 시점이며, 이후 편집 시 심볼을 기준으로 찾는다.

| 질문 | 설명할 핵심과 코드 위치 |
|---|---|
| 1. 왜 공통 코어를 분리했는가? | 같은 규칙 원본을 local/server에서 사용하고 시계·네트워크를 분리하는 이유. [game-core.ts](../../shared/game-core.ts) `createGame`·`stepGame`(96·259행), [두 runner](../../backend/src/game/server-match-runner.ts). |
| 2. 한 tick의 충돌 순서와 정확성 한계는 무엇인가? | 패들 이동 뒤 swept contact, 동시 접촉 우선순위, AABB 근사, 반복 상한. [game-core.ts](../../shared/game-core.ts) `moveBall`(181행). |
| 3. AI의 공정성을 어떻게 제한했는가? | 지연 관측, 반사 예측, 오차와 동일 입력·속도·자원 규칙. [ai.ts](../../shared/ai.ts) `predictIntercept`·`createAiController`(47·64행). |
| 4. 입력 시점·물리 tick·표시 시점은 어떻게 다른가? | held/edge 수집, 고정 tick 반영, ACK와 RAF. [keyboard-controller.ts](../../frontend/src/arcade/keyboard-controller.ts), [fixed-clock.ts](../../shared/fixed-clock.ts), [protocol.ts](../../shared/protocol.ts) `InputInbox`. |
| 5. 보간의 비용과 비교 기준은 무엇인가? | 공·양쪽 패들의 같은 표시 시간축, 추가 지연, 고갈 시 freeze와 불연속 처리. [snapshot-buffer.ts](../../frontend/src/arcade/snapshot-buffer.ts) `receive`·`display`(98·135행), [MEASUREMENTS.md](MEASUREMENTS.md). |
| 6. 재접속 뒤 누가 패들을 소유하는가? | 인증 계정의 세션·room binding·새 generation, 옛 소켓 입력 거부, 관전자 resync. [game.service.ts](../../backend/src/game/game.service.ts) `addUser`·`dropUser`, [protocol.ts](../../shared/protocol.ts) `InputInbox.receive`. |
| 7. 결과 멱등성을 어떻게 보장하며 어떤 불확실성이 남는가? | transaction·안정된 lock 순서·조건부 update·동일 결과 재조회·응답 유실. [match.service.ts](../../backend/src/user/match.service.ts) `update`, [game.service.ts](../../backend/src/game/game.service.ts) `finalizeMatch`·`persistResult`. |
| 8. AI가 처음 제안한 것 중 어떤 판단을 바꿨는가? | 수신 ACK를 반영 ACK로 수정하고, 저장 실패의 '미반영' 단정을 '확인 불가'로 수정한 근거. [protocol.ts](../../shared/protocol.ts) `markApplied`, [online-result.ts](../../frontend/src/arcade/online-result.ts) `OnlineResultNotice`, [AI 협업 기록](AI_COLLABORATION.md). |

입력·렌더·뷰의 연결은 [LocalPlayView.vue](../../frontend/src/views/LocalPlayView.vue), [online-session.ts](../../frontend/src/arcade/online-session.ts), [OnlineGameShell.vue](../../frontend/src/components/game/OnlineGameShell.vue)에서 확인할 수 있다. 기존 서비스 보존의 실행 근거는 [service-preservation.e2e-spec.ts](../../backend/test/service-preservation.e2e-spec.ts)에 있다. 이 TypeScript 작업을 C++/C# 구현 실적으로 설명하거나 채용·평가 결과를 보장하지 않는다.
