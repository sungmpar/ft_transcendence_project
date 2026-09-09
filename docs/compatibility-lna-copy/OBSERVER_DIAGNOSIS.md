# 최종 관전자 시험 진단

## 보존된 실패

실행 명령·종료 코드·설정별 집계는 [실행 기록](evidence/final-browser-execution-record.json), 원본은 [wrapper 로그](evidence/final-browser-command.log)와 [관전자 실패 JSON](evidence/final-browser/online-final-browser.json)에 있다. 빌드 `52546caae6f959a8`에서 앞 5개 설정의 22개 Jest 시험은 PASS이고, 마지막 통합 설정은 FAIL이다. 통합 내부 실제 6점 경기·마우스 재대결은 PASS지만 관전 복구의 20초 조건이 실패했으며, 효과·오디오 후속 case와 마지막 fixture의 Match 조회 단언은 실행되지 않았다.

관전자는 실제 두 번째 WebSocket을 열었고 실패 시점 열린 연결 1개/보낸 입력 0을 기록했다. 두 플레이어도 각 원래 열린 WebSocket 1개를 유지했다. 세 문서 모두 결과 화면을 표시했고 두 플레이어는 저장 완료 상태였다. 이 증거로 연결 자체가 영구 중단됐다고 결론 내릴 수 없다. 경기 종료가 복구 조건 실패보다 먼저였는지, 복구 문제가 먼저였는지를 판정할 점수·phase·focus·ready/ACK 시간순서가 최초 기록에 없다.

`final-browser/server-session-observation.json`은 첫 번째 **중복 탭** 설정의 다른 fixture가 남긴 마지막 aggregate다. 마지막 관전자 fixture의 상태로 사용하지 않는다. 공통 core, ServerMatchRunner, OnlineSession은 이번 Goal의 git diff가 없었다. 이것은 새 제품 결함의 부재 증명은 아니다.

## 읽기 진단과 추가 관측

`PaddleDriver`는 서버의 읽기 전용 snapshot으로 도착점을 계산하고 실제 키보드 이벤트를 보낸다. canvas focus 및 `!document.hidden`일 때만 조작하며 위치·점수·tick·Socket.IO payload를 쓰지 않는다. 기존 task 예외는 `stop()`의 await에서 CancelledError 외에는 전파되므로 조용히 삼키지는 않는다. 다만 주 시나리오는 그 시점 전까지 driver 실패나 포커스 부재를 별도 기록 없이 기다릴 수 있었다.

루트의 한정 위임으로 `scripts/browser-online-final.py`에 다음 관측만 추가했다.

- 실제 fault 직전, online 명령 직후, 회복 또는 실패 시점의 score/phase/tick/FPS/focus/hidden 및 최근 서버 상태.
- 네이티브 WebSocket에서 ready, 실제 sessionSync 요청에 대응하는 ACK, sessionStatus/resultStatus/matchEnded, score·phase 전환 순서. 서버 프레임과 원래 메서드를 바꾸지 않는다.
- driver의 실제 키 입력과 0.5초 간격 상태 표본, task 완료 여부 및 error 종류. 예외는 계속 재전파한다.
- 각 이력은 최대 128개다. match ID는 문서 안의 작은 별칭 숫자로 대체하고 request/account ID, 이름, 토큰, 임의 응답 body는 직렬화하지 않는다.

원래 입력 알고리즘, offline fault, 새 generation 및 live tick의 20초 기한, 동일 경기/side, 양쪽 플레이어의 기존 socket 유지, 화면 캡처 뒤 관전자 입력 0 단언을 유지했다. 자동 재시도·점수/속도 조정·경기 상태 덮어쓰기·시험 skip을 추가하지 않았다. 관측만으로 아직 원인이 확정됐다고 주장하지 않는다.

온라인 담당자의 독립 소스 리뷰는 ACK 상관·허용 필드·이력 제한·기존 단언 보존에서 확정 결함을 찾지 못했다(리뷰 담당자는 실행하지 않음). 각 문서의 `performance.now()`는 기준점이 다르다는 해석상 의견을 수락했다. checkpoint에 `timeOriginMs`를 함께 기록하며 서로 다른 문서의 `atMs`만 직접 비교하지 않는다.

## 준비 검증

저장소 루트에서 Python `ast.parse`로 파일을 읽고 AST의 `AUDIT` 문자열만 `/private/tmp/ft-compat-observer-audit-check.js`로 추출했다. `/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --check /private/tmp/ft-compat-observer-audit-check.js` 및 `git diff --check -- scripts/browser-online-final.py`는 실제 종료 0이었다. 이는 문법 확인이며 아래 실제 실행과 별도다.

## 후속 실제 실행

브라우저 슬롯을 인계받은 뒤 `ARCADE_FINAL_CASE=observer`, 이어 `effects`로 기존 `online-final-browser-jest.json`을 각각 실행했다. 명령 전문, 환경 변수, 종료 코드, 빌드·harness 지문은 [후속 실행 기록](evidence/online-targeted-execution-record.json)에 있다. 두 실행은 루트의 최종 한국어 줄바꿈 CSS 빌드(`app.d972f9c7.js`, index SHA256 `f168717e4c47034a74243bbd68e38467112c107f5ff64b6af358904eb197e570`)와 서로 다른 격리 fixture를 사용했다.

| 실행 | 실제 결과 |
|---|---|
| [observer 진단](evidence/observer-diagnostic/online-final-browser.json) | Jest 1/1 PASS, 종료 0, 74.304초(Python 62.866초). 기존 live 회복 단언을 모두 통과했다. |
| [effects 후속](evidence/effects-targeted/online-final-browser.json) | Jest 1/1 PASS, 종료 0, 56.869초(Python 47.373초). 앞선 wrapper에서 실행하지 못한 효과·오디오·키 설정 case를 실제 수행했다. |

관전자 후속에서는 fault 전후 점수가 2:1로 유지되었다. 실제 sessionSync 응답은 `active`, 새 ready는 generation 4/tick 1946이고 화면 검토 후 tick 2012까지 진행했다(이전 generation 3). 양쪽 플레이어는 같은 경기·기존 socket을 유지했고 관전자는 두 PNG 촬영 뒤에도 입력 0이었다. 두 driver error는 null이며 보존된 상태 표본에서 focus/hidden 조건 손실은 없었다.

새 진단은 실행 환경의 시간 변동을 관측했다. fault 직전 두 플레이어의 표본 FPS는 약 0.10/1.36이었다가 이후 40/60으로 올라왔고, 관전자 native close 요청부터 close 이벤트까지 약 4.1초가 걸렸다. offline 구간의 한 연결 시도는 1006으로 닫혔고 다음 연결에서 실제 active ACK와 새 ready를 받았다. **이 관측은 최초 실패 원인의 증명이 아니다.** 최초 실패의 종료·복구 선후관계에는 여전히 근거가 부족하며 이번 후속에서는 동일한 실패를 재현하지 못했다. 이를 이유로 점수/물리/프로토콜/driver를 변경하지 않았다.

효과 시험에서는 실제 서버 타격과 Canvas flash, 사용자 클릭 뒤 실제 AudioContext/oscillator, 음소거 중 추가 음원 없음, 시스템·명시적 모션 줄이기에서 flash/trail 억제, 실제 W/S/D 입력의 전송 연관, 비활성 화살표 무이동, route 이탈 시 오디오 종료 및 저장된 설정의 자동 재생 방지를 확인했다. native 오디오 호출 관측이며 사람이 청취한 시험이 아니다.

후속의 관전자 2장과 효과 2장 PNG를 실행 담당자가 실제 열어 검토했다. 원래 wrapper의 **22 PASS / 1 FAIL**은 그대로 유지한다. 후속의 **1 PASS + 1 PASS**를 원래 6개 설정 전체의 성공으로 합치지 않는다. 두 후속 과정에 남은 미실행 case는 없지만 실제 물리 키보드 플레이·사람의 청취·WAN·운영 LNA/TLS 검증은 이 시험 범위가 아니다.
