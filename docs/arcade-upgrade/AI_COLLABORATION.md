# AI 협업 기록 — Arcade upgrade

작성일: 2026-09-07. 대상은 `sungmpar/ft_transcendence_project`, 기준 SHA는 `f970554de528b2fceb46aa7aa3a10d43c192b65b`다. 전체 목표의 최종 판정은 **`PARTIALLY_IMPLEMENTED`**다. 이 문서는 사용자 정의 목표와 AI가 수행한 구현·검증·리뷰를 구분하며, 사람이 이미 직접 구현·발견·플레이한 것처럼 회고를 대신 작성하지 않는다.

## 1. 사용자가 정의한 목표와 경계

사용자는 첨부 실행 명세 전체를 이번 Goal의 기준으로 지정했다. 최우선은 로그인·백엔드·DB 없이 실행되는 로컬 2인과 규칙 기반 AI 대전이었다. 이후 기존 Socket.IO 온라인 대전을 같은 경기 코어에 통합하고 실제 검증을 진행하도록 지시했다.

사용자는 대상 저장소를 정확히 제한하고, 기존 팀 작업과 서비스 기능을 보존하도록 요구했다. 코드 수정 전에 읽기 전용 preflight와 의미상 중복 검사를 수행하고, 실행하지 않은 테스트·플레이를 성공으로 기록하지 않도록 했다. commit·push·PR·GitHub 댓글·배포·운영 데이터 변경은 금지했다. HexagonHero와 다른 저장소는 이 작업의 수정 대상이 아니다.

기존 Vue/Nest 구조, 서버 권한 온라인 Pong, 로그인·게스트·채팅·친구·초대·관전·프로필·전적은 기준 코드에 있던 팀 작업이다. 개별 작성자가 확인되지 않은 부분의 개인 소유권을 추정하지 않았다. 이번 문서는 그 이후 AI 보조 변경에 대해서만 설명한다.

## 2. AI에 위임한 작업

| 작업 | 실제 역할과 경계 |
|---|---|
| 진행 조정 | 주 에이전트가 저장소·기본 브랜치·이슈/PR·작업 상태 게이트를 갱신하고 단계 순서, 파일 소유 범위, 증거 기록을 조정했다. |
| frontend/local 경험 | 별도 에이전트가 기존 입력·수명 문제의 baseline 테스트, local runner·키보드·canvas UI, 공개 경로, AI 연결, 온라인 뷰와 저장 상태 표시를 구현했다. |
| backend/DB | 별도 에이전트와 주 에이전트가 기존 회귀 재현, 서버 코어 연결, 소켓 소유권, 재접속·최종화·transaction, 실제 PostgreSQL 통합을 구현·검증했다. |
| 공유 코어·AI·리뷰 | 다른 에이전트가 순수 코어·fixed clock·AI를 작성하고, 담당 구현과 다른 경로의 protocol·수명 경계 및 측정 해석을 검토했다. |
| 실행 증거 | 도구로 Jest·TypeScript·build·non-fixing lint를 실행하고, Chromium 자동 입력 및 실제 Socket.IO/격리 PostgreSQL 시험 결과를 로그·JSON·스크린샷으로 남겼다. |

동일 생산 파일을 여러 에이전트가 동시에 수정하지 않도록 소유 범위를 전달했다. 공유 소스는 browser/server 모두 같은 원본을 사용한다. 별도 에이전트 리뷰도 AI 리뷰이며, 사람의 독립 코드 리뷰로 표시하지 않는다. frontend 작성 에이전트의 frontend 자체 점검과, 그 에이전트가 작성하지 않은 backend/shared 점검의 독립성도 구분했다.

## 3. 채택한 선택과 채택하지 않은 대안

| 판단 | 채택 여부와 이유 |
|---|---|
| `shared/` 원본을 frontend/backend가 직접 import | **채택**. 기존 manifest·lockfile·Vue CLI/Nest build 경로를 확인한 뒤 작은 통합으로 규칙 중복을 없앴다. Docker context도 수정했지만 실제 Docker 실행을 통과했다고 주장하지 않는다. |
| 별도 엔진·ECS·대규모 workspace·프레임워크 교체 | **범위에서 제외**. 사용자 목표를 위해 필요하지 않았으며, 비교 구현 후 성능 열세로 탈락한 대안은 아니다. |
| AI에 좌표 변경 권한이나 별도 이동 속도 부여 | **채택하지 않음**. 지연된 관측으로 동일 `PlayerInput`만 출력하게 했다. 인간 유사성이나 승률은 입증하지 않았다. |
| 공과 양쪽 패들을 같은 snapshot 시간축에서 보간 | **채택**. 추가 표시 지연과 고갈 시 멈춤을 명시하고 최신 snapshot 즉시 표시와 비교했다. 측정 결과를 '무조건 더 빠르다'고 해석하지 않는다. |
| 자기 패들만 예측하는 reconciliation | **기본 경로에서 제외**. 공과 패들의 시간축이 달라지는 비용과 필요한 재적용 시간 계약을 해결하지 않은 채 완성으로 선언하지 않았다. |
| 클라이언트의 업적 요청이 결과를 갱신 | **교체**. 서버의 경기 결과와 업적을 한 transaction에서 처리하고 기존 이벤트는 무해한 호환 경계로 남겼다. |

보간·전송 주기·지연 비교의 원시 수치와 조건은 [MEASUREMENTS.md](MEASUREMENTS.md)에만 근거한다. 시험하지 않은 모든 대안의 우열이나 최적 설정을 도출했다고 주장하지 않는다.

## 4. 실제 발견·재현·수정한 오류

| 분류 | 발견과 수정 | 근거 및 해석 |
|---|---|---|
| 기존 frontend 계약 | 모드 필드 불일치, 중복 start/늦은 RAF, 반대 이동·이동+능력 표현 실패를 재현했다. 실행 세대·dispose와 새 입력 계약으로 수정했다. | [baseline](evidence/baseline-frontend-regressions.log), [최종 contract tests](evidence/final-unit-check.log). baseline의 6 FAIL은 6건의 사용자 사고를 뜻하지 않는다. |
| 기존 backend 계약 | 하단 이동 보정, 실제 생성 ID 사용, 0행 update 결과, await 전 최종화 소유 문제를 재현했다. | [baseline](evidence/baseline-backend-regressions.log), [최종 회귀](evidence/final-backend-regressions.log). 사용되지 않던 helper 결함은 잠재 결함으로 구분한다. |
| 새 AI 작성 protocol의 오류 | 입력을 수신한 순간 ACK를 '적용 완료'로 올렸고, 잘못된 승점의 finished snapshot을 허용했다. 독립 리뷰가 실패 테스트를 만들고 `receivedSeq`·`markApplied` 및 상태 일관성 검사를 분리했다. | [수정 전 2 FAIL](evidence/p1-review-regressions-before.log), [수정 후](evidence/p1-review-regressions-after.log). AI 초안도 검증 대상이었다. |
| 새 local adapter의 경계 | 손상된 key mapping의 필드 검사, callback 안의 restart 세대 격리, AI rematch RNG 재초기화 문제를 리뷰에서 찾아 보완했다. | [local 검증](evidence/p2-local-verification.log), [최종 unit](evidence/final-unit-check.log). AI `reset()`만으로 외부 소유 RNG까지 되감긴다고 가정하지 않았다. |
| 새 온라인 표시 수명 | snapshot의 mutable 참조, dispose 뒤 늦게 전달된 상태 콜백을 검사해 복사·guard를 보완했다. | [온라인 frontend 회귀](evidence/p3-frontend-regressions.log), [추가 리뷰](evidence/p4-shared-review-regressions.log). fake DOM 시험과 실제 browser 시험은 별개다. |
| 저장 확인 문구 | AI가 처음 작성한 '승패·업적이 반영되지 않았다'는 표현을 수정했다. COMMIT 후 응답 유실이 가능하므로 terminal failure는 '반영 여부 확인 불가'로 표시한다. | [online-result.ts](../../frontend/src/arcade/online-result.ts), [리뷰](evidence/frontend-and-service-review.md). 결과 승패와 저장 성공을 분리했다. |
| 저장 실패와 기존 전적 연결 | 미완료 경기의 null winner를 기존 전적 formatter가 읽는 TypeError를 backend 리뷰에서 실제 재현했다. 완료 행만 전적에 포함하도록 최소 수정했다. | [실패](evidence/p4-failed-history-before.log), [실제 HTTP 재확인](evidence/final-service-preservation.log). |
| 실제 screenshot 피드백 | 한국어 패배 제목의 단어 중간 줄바꿈과 사용자가 판단할 필요 없는 구현 상세 문구를 고쳤다. | [OnlineGameShell.vue](../../frontend/src/components/game/OnlineGameShell.vue), 최종 frontend build. 사람이 직접 시각 평가했다고 서술하지 않는다. |

다음 실패는 제품 결함과 분리했다. 초기 DNS·로컬 TCP EPERM·Watchman 권한 문제는 환경 실패였다. Node 23과 고정된 기존 의존성의 engine 불일치에는 임시 Node 18 런타임을 사용했으며 lockfile을 일괄 갱신하지 않았다. 테스트 작성 중의 CommonJS `supertest` import 오류와 실제 `g...` 형식 대신 `guest...`를 기대한 오류는 **테스트 코드의 잘못**이었다. 해당 초기 로그를 보존하고 실제 코드 계약에 맞게 시험을 바로잡았다. 기존 서비스를 green으로 만들기 위해 생산 코드를 그 잘못된 기대에 맞추지 않았다.

초기 서비스 fixture에는 production의 global ValidationPipe가 빠져 있었다. 이를 fixture에 추가한 뒤 create/join DTO를 모두 만족하는 값으로 최종 5건을 재실행했다. 이 과정만으로 기존 public-channel의 빈 password UI가 실제로 실패한다고 단정하지 않는다. 상세 이력은 [명령 기록](evidence/frontend-agent-command-record.log)과 [서비스 리뷰](evidence/frontend-and-service-review.md)에 있다.

## 5. 검증 결과와 증거 수준

| 범위 | 실제 결과 | 해석 제한 |
|---|---|---|
| local·AI Chromium | **PASS**. 25개 browser 확인 항목에 한 경기 종료·재시작·이탈·동시 키·auth/Socket 요청 없음 포함. 별도 wall-clock 랠리도 실행했다. | 주 시험은 가속 browser clock과 합성 키 입력. 사람 대 사람 플레이·키보드 rollover·AI 인간 상대 승률이 아니다. |
| 공통 코어·입력·buffer·adapter | **PASS**, [최종 unit 로그](evidence/final-unit-check.log)에 실행한 suite별 결과 기록. | fake clock/transport 결과만으로 실제 네트워크 성공을 주장하지 않는다. |
| 실제 Socket.IO·PostgreSQL | **PASS**. 정상 경기·인증 거부·초대·관전·세대 복구·결과 transaction·재시도 검증. | 운영 DB 대신 소유한 임시 schema. 응답 유실 주입은 실제 TCP packet-loss 구현과 구분한다. |
| 실제 온라인 Chromium 두 context | **PASS**. 실제 browser/server 시간으로 한 경기·rematch·메뉴, 실제 소켓 단절/복구를 확인했다. | 사람 두 명이나 실제 WAN 환경 시험이 아니다. [경기](evidence/p3-online-browser.json), [복구](evidence/p4-online-lifecycle-browser.json). |
| 기존 서비스 fixture | **PASS, 5/5**. guest·JWT·profile/image·friends·2FA HTTP 조건·chat·미완료 전적. | 외부 OAuth·메일·전체 AppModule 기동과 다르다. [최종 로그](evidence/final-service-preservation.log). |
| build/type/lint | build·TypeScript·변경 UI lint **PASS**. 전체 non-fixing lint **FAIL**, 변경하지 않은 기존 오류 별도 기록. | 경고나 기존 실패를 생략해 저장소 전체가 green이라고 쓰지 않는다. [TEST_REPORT.md](TEST_REPORT.md). |

측정 보고는 실행 조건·반복·분포·실제 생성된 CSV/JSON을 사용한다. ACK 왕복과 별도 probe RTT, application 지연과 Socket.IO 통신, payload 크기와 전체 대역폭, RAF와 모니터 광학 지연을 서로 바꾸어 부르지 않는다. 구체적인 수치는 [MEASUREMENTS.md](MEASUREMENTS.md)와 연결된 원시 파일을 참고한다.

## 6. 아직 사람이 확인하지 않은 부분

이 세션에서 사용자가 직접 코드를 읽거나 같은 물리 키보드로 한 경기를 완료했다는 기록은 없다. 다음 항목은 후속 검토 대상으로 남긴다.

- 두 사람의 동시 키 입력·Power 발동·키 rollover와 장시간 조작감: **NOT RUN**.
- AI 난이도의 인간 상대 적정성·재미·승률: **NOT RUN**.
- 실제 외부 42 OAuth·메일 전달: **NOT RUN**.
- 전체 AppModule을 기존 Docker compose로 실행하는 검증: **BLOCKED**, Docker 도구 부재. fixture 결과로 대체하지 않는다.
- Firefox·실제 Safari의 경기·접근성·canvas 입력 확인: **NOT RUN**.
- 실제 WAN 손실, 광학 입력 지연, 한 서버 프로세스 재시작 후 경기 복구: **NOT RUN 또는 범위 미구현**.

따라서 `IMPLEMENTED_AND_VERIFIED`를 사용하지 않고 **`PARTIALLY_IMPLEMENTED`**로 보고한다. 이는 실행 가능한 local/AI 결과와 실제 격리 online 검증이 없다는 뜻이 아니라, 전체 필수 환경 및 사람 검증 범위를 과장하지 않기 위한 판정이다.

## 7. 사람이 설명하고 검토할 다음 단계

먼저 [포트폴리오 사례의 8개 코드 질문](PORTFOLIO_CASE_STUDY.md#8-관련-소스와-설명할-수-있어야-할-질문)에 대해 구현과 테스트를 함께 열고 설명하는 것이 필요하다. 질문은 공통 코어의 이유, 충돌 순서, AI 공정성, 입력/표시 시간, 보간 비용, 재접속 소유권, 결과 멱등성, AI 초안을 바꾼 판단이다. 문서가 존재한다는 것만으로 사용자가 이 내용을 이해·승인했다는 증거로 삼지 않는다.

기존 팀 기여와 이번 AI 보조 변경을 설명할 때는 기준 SHA와 실제 변경 파일·검증 날짜를 제시한다. 사용자가 실제로 수행하지 않은 '직접 발견했다', '사람과 플레이해 확인했다', '성능을 개선했다'는 1인칭 문장을 제출용 성과로 만들지 않는다. 본 작업은 TypeScript 구현 근거이며 다른 언어 역량, 채용 합격, 공식 평가 점수를 보장하지 않는다.
