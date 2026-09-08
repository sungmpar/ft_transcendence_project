# 독립 리뷰 패킷 — 2026-09-07

판정은 **PARTIALLY_IMPLEMENTED**다. 로컬·AI는 서버 없는 실제 브라우저 경기/재시작을 검증했고 온라인은 실제 JWT·Socket.IO·PostgreSQL·두 Chrome의 매칭/종료/저장/재접속을 검증했다. 외부 OAuth/메일, Docker, WAN, 다른 브라우저, 사람이 직접 플레이한 근거는 없다. 전체 lint도 실패한다. 이 패킷은 완료 범위를 독립 검토하기 위한 자료이며 커밋·PR·배포가 아니다.

## 저장소 상태와 적용 경계

- 대상: `sungmpar/ft_transcendence_project`만. HexagonHero와 다른 저장소는 수정하지 않았다.
- 기준/현재 HEAD: `f970554de528b2fceb46aa7aa3a10d43c192b65b`, branch `main`. 시작은 clean, 끝은 이번 Goal의 dirty 변경이다. 새 브랜치/commit/push/PR/comment 없음.
- P0·P1·P2·P3·P4·P5 전 upstream/issue/PR를 갱신했다. 마지막 P5 core gate2026-09-07 05:52:04UTC: main동일, openissues/PR각0. empty firstpage로열거종료, PR diff는비교대상없음. 볼 수 없는 다른 세션은 알 수 없다.
- [source-changes.patch](review/source-changes.patch)는 기존 파일 diff와 새 코드·검사·script를 포함한다. docs/evidence는 별도 읽는다. HEAD 자체에 적용된 commit이 아니다.
- [file-manifest.json](review/file-manifest.json)은 변경/신규 파일명과 SHA-256을 기록한다. [arcade-review-packet.zip](arcade-review-packet.zip)에 변경 파일과 문서·원시 측정·증거를 상대 경로로 묶었다. node_modules·dist·.env·Git DB·토큰은 넣지 않았다.

## 권장 검토 순서

1. [BASELINE](BASELINE.md)에서 원래 팀 기능과 실제 실패/불확실성 경계를 읽는다.
2. [DESIGN](DESIGN.md)의 규칙·시간·소유권·저장 경계를 소스와 비교한다.
3. [TEST_REPORT](TEST_REPORT.md)의 실제 명령·exit code·실패 로그를 확인한다. PASS만 골라 읽지 않는다.
4. 아래 위험 경로를 코드와 테스트 양쪽에서 확인한다.
5. [MEASUREMENTS](MEASUREMENTS.md)와 raw CSV/JSON에서 동일 입력 비교와 실제 socket 측정을 구분한다.
6. [PORTFOLIO_CASE_STUDY](PORTFOLIO_CASE_STUDY.md), [AI_COLLABORATION](AI_COLLABORATION.md)이 증거보다 넓게 주장하는지 확인한다.

## 우선 검토할 코드와 질문

| 질문 | 생산 경로 | 실제 검사 |
|---|---|---|
| 세 모드가 규칙을 복사하지 않는가? | `shared/game-core.ts`, local/server runner | core/local/server specs, frontend import 경계 JSON |
| 빠른 공의 벽·패들·골 순서와 접선/모서리 정책은 일관적인가? | `stepGame`과 sweep 충돌 함수 | `backend/src/game/core.spec.ts`, legacy 특성화 |
| AI가 지연 관측·주기·일반 입력만 사용하고 Power 요청을 다시 할 수 있는가? | `shared/ai.ts` | `ai.spec.ts`, 실제 AI overlay/종료 screenshot |
| 입력 수신과 실제 tick 적용 ACK가 분리되어 있는가? | `shared/protocol.ts`, ServerMatchRunner | protocol/server specs, 실제 ACK 분포 |
| 보간의100ms 비용·반사 오차·jitter 고갈을 숨기지 않는가? | SnapshotBuffer, OnlineSession | snapshot spec, frames/packets CSV |
| 새 연결 뒤 옛 소켓·다른 탭·관전자에게 입력 권한이 없는가? | GameService registry/addUser/dropUser | 실제 lifecycle7cases, Chrome offline/online JSON |
| DB rollback/중복/모호한 응답에서 승패·업적이 중복되지 않는가? | MatchService.update, finalizeMatch | 실제PG constraint 실패·postcommit 응답 오류·중복최종화 |
| 종료/메뉴/restart/latecallback에서 RAF·listener·buffer가 해제되는가? | local runner, OnlineSession, 세 게임 views | lifecycle/session specs, local25checks, online rematch |

`source-changes.patch`의 새 게임 경로 외에 기존 `src/plugins/bar.ts`와 backend old pong-model은 baseline 특성화/미사용 호환 흔적이 남아 있다. 실제 온라인 실행은 새 common core/OnlineSession 경로다. 이전 코드를 별도 엔진으로 계속 실행한다고 설명해서는 안 된다.

## 확인된 회귀와 리뷰 판단

C01 잘못된 배열 제거, C02 없는 대상 제거, C03 mode 이름, C04 이동+action, C07 하단 clamp, C08 RAF/키 수명, C09 ID 추측, C10 저장 경쟁을 실행 가능한 입력으로 검사했다. C02의 비마지막 queue pop은 정상 큐 길이 제약 때문에 실제 사용자 사건이라고 주장하지 않는다. 중앙 반사의 vy=0·초기 공 속도 조정은 의도적으로 바꾼 게임 규칙이다. 강화 높이400에서 기존 y400 자체가 화면 이탈이라는 주장은 채택하지 않았다.

독립 AI 리뷰의 ACK 조기노출·snapshot 참조·늦은 callback·AI latch·다른 경기 status·관전자 epoch·오류 방 해제·null 전적·저장 확인 문구 지적을 채택했다. 각 실패→수정→PASS와 fixture 작성 오류를 TEST_REPORT에 구분했다. 이는 사람의 독립 리뷰가 완료됐다는 뜻이 아니다.

## 다시 실행하기

Node18.20.8과 기존 frozen 의존성으로 [README](../../README.md)를 따른다. root에서 `node scripts/check-arcade.cjs unit`, 지정한 임시 PG를 시작한 뒤 `node scripts/check-arcade.cjs online`이 검사 진입점이다. 실제 브라우저 환경과 정확한 설치 경로는 TEST_REPORT에 있다. 스크립트가 필요한 도구를 자동 설치하거나 production 환경으로 우회하지 않는다.

현재 checkout은 dirty이므로 `git apply`를 여기서 다시 실행하지 않는다. 리뷰어가 별도로 승인한 clean 기준 복사본을 사용할 때만 patch 적용 여부를 점검한다. commit/push/PR은 사용자의 별도 승인과 새 semantic gate가 필요하다.

## 남은 위험과 다음 검증

- 최우선 수동 확인: 실제 키보드 하나로 두 사람이 Power까지 포함한1경기와 재시작을 하고 입력 rollover·포커스·가독성을 확인한다.
- WAN과 지연 변동에서는 고정100ms buffer가 충분하지 않을 수 있다. 적응형 buffer를 검증하기 전 현재 정책을 최적/무지연이라고 설명하지 않는다.
- 코어 반사 시점을 snapshot 사이에서 선형 보간하므로 최대16.05단위 표시 오차가 측정됐다. 자기 패들 예측·rollback·reconciliation은 구현하지 않았다.
- 단일 프로세스 밖의 복구, 영속 재시도 queue, 여러 서버 사이 exactly-once는 제공하지 않는다. 저장 확인 실패는 실제 DB 미반영과 같지 않다.
- 전체 nonfix lint는 FAIL이며 Docker·실OAuth·메일·다른 브라우저는 미검증이다. 기존 서비스의 모든 화면/권한/채팅 기능을 전수 검사하지 않았다.
- 이 변경은 기존 TypeScript 팀 프로젝트의 AI 보조 개선이다. 개인의 과거 단독 개발·직접 인간 플레이·C++/C# 구현·채용/평가 결과의 증거로 확대하지 않는다.
