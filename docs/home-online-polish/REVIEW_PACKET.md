# 독립 검토 패킷 — READY_FOR_REVIEW

대상은 `sungmpar/ft_transcendence_project` 하나다. 기준은 `main` / `2f11bee69c2d55ed938b53f9750119a890396fb7`. 현재 자료는 미커밋 변경의 검토용이다. Home·공개 허브·실제 동선과 온라인 복구·보간·효과를 구현했고 격리된 실제 서버/DB/Chrome 통합 검증을 완료했다. 운영·사람의 물리 플레이/청취는 검증하지 않았다. 기존 `docs/arcade-upgrade/`는 이전 개편의 역사 기록으로 보존했다.

## 먼저 확인할 자료

- [실제 검증 색인](EVIDENCE_INDEX.md): 실행별 정확한 명령·결과·초기 실패·중복 집계의 경계.
- [구현 보고서](IMPLEMENTATION_REPORT.md): Home 설계, 현재 코드 근거, 기여 경계.
- [검증 보고서](TEST_REPORT.md): 실행 환경과 단계별 결과.
- [독립 Home 리뷰](INDEPENDENT_HOME_REVIEW.md): 재현된 P2 두 건과 수정 후 실제 8/8 검증.
- [N1/N2 복구](N1_N2_REPORT.md), [N3 clock](N3_CLOCK_REPORT.md), [이벤트·오디오](D_FEEDBACK_REPORT.md): 실패부터 수정까지의 계약과 실행 근거.
- [중복 탭 연결 보완](E_CONNECTION_RETRY_REPORT.md): 정적 추론을 실제 wire로 반증하고 반복 연결·안내 소실만 좁혀 수정한 기록.
- [독립 온라인 리뷰](INDEPENDENT_ONLINE_REVIEW.md), [서비스 화면 리뷰](SERVICE_LAYOUT_REVIEW.md), [패키징 검토](PACKET_REVIEW.md): 수용한 지적과 실제 검토 범위.
- [포트폴리오 사례](PORTFOLIO_CASE_STUDY.md): 팀 작업·기존 공통 코어·이번 변경의 기여 경계.
- [내비게이션 기록](NAVIGATION_NOTES.md), [실제 메뉴 검증](BROWSER_NAVIGATION_REVIEW.md).

[다운로드 ZIP](home-online-review-packet.zip), [전체 변경 파일·SHA-256 manifest](review/file-manifest.json), [추적/미추적 소스 patch](review/source-changes.patch), [실제 패키징 결과](evidence/final-review-package.log)를 함께 제공한다. root에서 `/opt/miniconda3/bin/python scripts/package-home-review.py`로 생성한다. 이 명령은 현재 dirty tree에서 `git apply --check --reverse`만 실행하여 patch 일치 여부를 확인하며 Git에 쓰지 않는다. ZIP·manifest는 자기 자신과 패키징 출력 로그를 제외한 변경 소스·이번 문서·증거를 담는다. 과거 증거, 환경 파일, dependency 설치물은 패키지에 추가하지 않는다. 실제 명령의 성공 여부와 파일 수는 패키징 로그가 기준이다.

## 변경 경로와 검토 질문

| 영역 | 중심 경로 | 확인할 계약 |
|---|---|---|
| Home·공개 허브 | `frontend/src/views/HomeView.vue`, `PlayHubView.vue`, `components/arcade/LaunchPanel.vue`, `arcade/launch.css`, `App.vue` | 공통 모드/규칙/도움말, 실제 CTA, 공개 경계, 80px rail, 저장된 설정과 표시 일치 |
| 로그인·복귀 | `LoginView.vue`, `router/index.ts`, `arcade/login-intent.ts`, `InfoView.vue`, `TfaView.vue`, `backend/src/auth/auth.controller.ts` | exact allowlist/TTL/consume, 기존 실제 cookie callback와 nickname/2FA, guest 단일 요청, endpoint 한정 CORS |
| 메뉴·수명 | `SideBar.vue`, `friends/FriendsSlider.vue`, `game/InviteSlider.vue`, `SpectateSlider.vue`, `arcade/auth-session.ts`, `route-game-socket.ts`, `plugins/gamePlayService.ts` | 실제 친구 대상/초대 계약, empty/error, abort/focus, 로그아웃, 새 route의 socket/canvas 소유 |
| N1/N2 | `GameView.vue`, `InviteGameView.vue`, `SpectateView.vue`, `arcade/session-recovery.ts`, `game/OnlineGameShell.vue`, `backend/src/game/game.service.ts`, `game.gateway.ts`, `backend/src/user/match.service.ts`, `shared/protocol.ts` | 인증 참가/관전 권한, 요청·경기·generation, 결과 저장 분리, 무응답 timeout, ACK/DB/binding 상한, 좌우 점수 오표시 방지 |
| 명시 재연결 | `arcade/connection-retry.ts`, 세 온라인 View, `connection-retry.spec.ts`, `browser-online-rejected-session.py` | 정확한 기존 충돌 응답에서만 반복 중단, 원래 탭 보호, 5초 사용자 재시도, 일반 자동 복구 유지, 세 화면 실제 버튼 |
| N3 | `ServerMatchRunner`, `SnapshotBuffer`, snapshot 계약 및 `clock-recovery.spec.ts` | 정상 지터와 영구 시간 손실 구분, 300ms 내 strict 보간, epoch와 input generation 분리 |
| 온라인 효과 | `server-match-runner.ts`, `shared/protocol.ts`, `event-presentation.ts`, `online-session.ts`, `court-renderer.ts`, `audio-feedback.ts`, `online-preferences.ts`, `OnlineGameShell.vue` | 120tick/64개 이력, full ready cursor, presentation tick, 6tick late skip, gesture·mute·motion·키·자원 정리 |
| 기존 서비스 배치 | `ChatView.vue`, `ChatContainer.vue`, `BoardView.vue`, `InfoView.vue`, `TfaView.vue` | 입력과 native 메뉴 접근, 좁은 표의 자체 스크롤. 기존 데이터/인증 핸들러 보존 |

파일의 정확한 최종 목록과 내용 해시는 최종 manifest가 기준이다. 위 표는 중심 경로를 요약한 것이며 전체 변경 목록을 대신하지 않는다.

## 실제 화면 비교

동일한 일회용 guest 계정·데이터와 같은 viewport에서 캡처한 Home이다. root가 이미지 파일을 실제로 열어 검토했다. 긴 닉네임 stress는 기준 캡처 후 실제 fixture API로 별도 수행하고 원래 닉네임을 복구했다.

| 화면 | 변경 전 | 변경 후 |
|---|---|---|
| Home 1440×900 | [전](evidence/before-home-1440x900.png) | [후](evidence/after-home-1440x900.png) |
| Home 1366×768 | [전](evidence/before-home-1366x768.png) | [후](evidence/after-home-1366x768.png) |
| Home 1024×768 | [전](evidence/before-home-1024x768.png) | [후](evidence/after-home-1024x768.png) |
| Home 390×844 | [전](evidence/before-home-390x844.png) | [후](evidence/after-home-390x844.png) |
| 공개 허브 1440×900 | [전](evidence/before-play-hub-1440x900.png) | [후](evidence/after-play-hub-1440x900.png) |
| Login 1440×900 | [전](evidence/before-login-1440x900.png) | [후](evidence/after-login-1440x900.png) |
| 온라인 로비 1440×900 | [전](evidence/before-online-lobby-1440x900.png) | [후](evidence/after-online-lobby-1440x900.png) |

위 동일 계정 전후의 변경 후 build는 `48d5f08…` 단계이며 Home 컴포넌트는 이후 바뀌지 않았다. 별도 최신991 build/fixture52262의 새 guest 화면은 [Home1440](evidence/final-home-after-connection-retry/after-home-1440x900.png), [Home390](evidence/final-home-after-connection-retry/after-home-390x844.png)에서 확인한다. 같은 계정 비교와 최신 빌드 재실행을 혼동하지 않는다. [화면 실행 기록](evidence/final-home-execution-record.json)에 정확한 build·app·index 해시와 명령이 있다.

추가 실제 화면: [최종 온라인6점 종료](evidence/final-online-after-conflict/final-online-six-point-result.png), [관전자 재접속](evidence/final-online-after-conflict/final-observer-reconnected.png), [효과·소리·키](evidence/final-online-after-conflict/final-online-effects-and-key-hint.png), [플레이어 재접속](evidence/final-lifecycle-controlled-parser-fixed/online-reconnected.png), [유예 만료 뒤 복구된 결과](evidence/n1-recovered-result-after-grant-final.png), [실제 로컬 Power 발동](evidence/final-local/local-power-active.png), [AI Power/Hard 종료](evidence/final-local/ai-power-hard-finished.png). 계정은 격리 fixture guest이며 운영 사용자·접속 통계가 아니다.

## 실패에서 수정으로 이어진 근거

- H06은 실제 guest 전체 이동 뒤 의도한 `/game` 대신 Home으로 복귀하는 현상으로 확인했다. intent 순수 시험과 실제 3개 목적지 복귀를 분리해 검증했다.
- H08의 정적 params 의심은 설치 Router4.1.3에서 실제 친구 대상 전달이 유지되어 계약을 바꾸지 않았다. 실패하지 않은 문제를 수정 성과로 보고하지 않는다.
- 200% 화면은 처음 폭 검사를 통과했어도 실제 이미지에서 카드 내부 control 넘침을 발견했다. grid 최소 폭을 수정하고 더 강한 경계 단언을 추가했다.
- nickname 선행 화면의 Choose 버튼이 rail에 덮이는 실제 실패는 App의 containing block을 보완해 수정했다. force click으로 시험을 통과시키지 않았다.
- 독립 리뷰의 guest503/public 대안 소실·새 탭 intent 소실은 기존 흐름을 유지하는 단일 요청/고정 callback/allowlisted URL로 수정하고 실제 DB/JWT의 8개 시험을 실행했다.
- N1/N2의 최초 브라우저 `REPRODUCED`는 제품 PASS가 아니다. 서버 disconnect 인식까지의 시간, 5초 유예, 같은 페이지 복귀 결과를 구별한다.
- N3 baseline은 500ms 이상 stall 뒤 latest 위치가 움직여도 실제 보간은 회복되지 않음을 보였다. Jest 7개 중 4개 FAIL과 반복 사례를 담은 JSON 9 records를 혼동하지 않는다.
- 독립 온라인 리뷰의 부적합 ready ACK 타이머 취소, running AudioContext의 제스처 누락, 단절 시 타격 flash 잔류는 각각 red 회귀 후 수정했다. 네트워크 이벤트를 exactly-once로 전달한다고 주장하지 않는다.
- 중복 탭의 namespace DISCONNECT/복귀 중단 가설은 실제 transport 관찰과 기존 탭 종료 뒤 자동 복귀로 반증됐다. 확인된 문제는 반복 접속과 이유 소실이다. 기존 서버 소유자 보호를 바꾸지 않고 세 화면에서 추가 연결0·같은 페이지 native 재시도 복귀를 검증했다.

## 최종 검증과 남은 실패

단위233/11 configs, 실제 HTTP·Socket.IO·DB15, frontend/backend build 및 frontend noEmit은 PASS/exit0이다. 최신 browser6 configs는 앞4개13 tests PASS 뒤 P4 실패로 wrapper exit1을 남겼다. 장애 주입·관측 parser 보완 뒤 P4 개별1 test와 미도달 온라인 최종1 test는 각각 exit0으로 끝났다. 최종 config의 실제3시나리오는6점 종료·재매칭·DB 저장, 관전자 단독 재접속, 서버 효과·native audio·키·motion·dispose를 검증했다. **개별6 configs 합15 PASS와 전체 wrapper exit0은 다르다.**

Home은 같은 계정 비교48 PASS, build4de에서48 visual/18 auth/4 navigation PASS+관찰1, 최신991에서48 visual/4 navigation PASS+관찰1이다. 서비스 배치37, 공개 local-browser56도 통과했으며 반복 실행 수를 더하지 않는다. root 명령은 [실행 원문](evidence/final-root-commands.json), 에이전트 명령은 [온라인](evidence/final-online-execution-record.json)과 [Home](evidence/final-home-execution-record.json)에 있다.

전체 no-fix lint는 기존 부채로 실패한다: frontend1오류/61경고, backend1857/32. 추가 소스 줄 진단0과 전체 lint 성공을 혼동하지 않는다. 최초 통합 관전자 timeout과 offline-only P4 실패 원인은 미확정이다. P4 controlled 시험은 실제 close/새 연결과 서버 pause200ms·동일 경기 복구를 검증했지만 짧은 차단 구간에 새 시도가 없어 차단 분기 자체는 미실행이다. 화면 잔여 P3는 Board의 조밀한 열 제목과 연결 거절 안내의 반복이다.

우선 사람 검토 시나리오는 서로 다른 두 브라우저 프로필로 실제 게스트 로그인→Home에서 온라인 선택→상대 찾기→소리 켜고 한 경기→세 번째 프로필 관전의 단절/복귀다. 현재 실행 주소와 재시작 명령은 [검증 기록](TEST_REPORT.md#현재-실행과-재현) 및 [README](../../README.md)를 사용한다.

## 검증과 기여의 한계

이 패킷은 운영 배포, WAN, 사람의 광학 입력 지연, 물리 키보드 rollover, 실제 청취, 모든 브라우저 호환을 증명하지 않는다. guest CORS는 같은 호스트의 다른 포트까지 실제 실행했으며 cross-site/subdomain cookie 정책은 검증하지 않았다. 42 OAuth와 외부 2FA 메일은 실행하지 않았다. 별도 prerequisite 시험은 메모리에서 서명한 fixture credential/code로 상태를 준비했고 실제 기존 guard/endpoint를 사용했다. 이는 guest 전체 로그인 시험과 다르다.

원래 팀 서비스 기능, 이미 공개 baseline에 포함된 이전 개인/AI 보조 경기 코어 개편, 이번 Home·온라인 후속 변경을 분리해서 읽어야 한다. 독립 에이전트 리뷰는 외부 사람이 수행한 리뷰로 표현하지 않는다. commit/push/PR/댓글/배포/운영 DB 변경은 수행하지 않는다.

새 서버와 클라이언트는 같은 소스로 함께 빌드해야 한다. snapshot의 `instanceId`/`clockEpoch`/이벤트 계약과 full ready cursor, `sessionSync`/`matchEnded`는 이전 공개 baseline과 호환되는 점진적 배포를 제공하지 않는다. 기존 `PROTOCOL_VERSION=1` 숫자를 유지했더라도 validator는 확장된 필수 계약을 검사하며 옛 패킷으로 조용히 우회하지 않는다.
