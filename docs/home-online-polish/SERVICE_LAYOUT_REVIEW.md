# 독립 기존 서비스 레이아웃 검토 — 수정 전·중간·최종 검증

판정: 최종 고정 빌드에서 **1440×900/390×844의 37개 지정 검사 PASS, 실제 process exit0**다. 처음 재현한 모바일 Chat 입력 폭0과 Info의 실제 Main 클릭 차단, 첫 보완에서 남은 과도한 Send 폭과 Board 가로 넘침·헤더 겹침을 최종 실제 조작으로 재검증했다. 서비스의 레이아웃과 지정 메뉴 동작에 대한 판정이며 채팅 전송·외부 메일·2FA 설정 변경까지 전체 서비스 PASS로 확장하지 않는다. 아래 초기 실패와 중간28 PASS는 그대로 보존한다.

대상은 `sungmpar/ft_transcendence_project`, `main`, baseline `2f11bee69c2d55ed938b53f9750119a890396fb7` 위 미커밋 작업이다. 최초 검토는 root가 지정한 **frontend build `7ec1f0d3183ec242` / 실제 served app `/js/app.62d305d4.js` / owned fixture `http://127.0.0.1:65199`**를 사용했다. 당시 N3 source 작업과 이 고정 served build는 분리되어 있었다. 최종 검증은 아래 새 고정 빌드·fixture를 사용한다. 이 reviewer는 production 파일·빌드·서버·Git을 수정하지 않았다.

## 실제 실행과 관찰

Chrome `152.0.7977.77`, fresh guest context, actual guest button→HTTP/cookie→full document callback→Home, credential 주입 없음. Home의 실제 sidebar 링크로 Chat/Info/Tfa/Board에 들어갔다. Chat은 채널 선택 없이 빈 메시지 패널과 Channels 목록 펼치기만 확인했다. 프로필 입력의 포커스/임시 draft 입력 후 지우기, Choose의 native actionability trial, Tfa 버튼 포커스와 trial을 사용했다. Choose submit, 파일 업로드, 2FA on/off, Send, 다른 사용자 대화 선택은 실행하지 않았다. `/auth/email*` 요청 관측0, pageerror0이었다. 실제 이메일/사람 계정/운영 데이터에 접근하지 않았다.

root cwd의 정확한 실행 명령은 네 시도 모두 다음과 같다. 관찰 스크립트의 선택 범위를 진행하면서 줄였으며 각 JSON의 `selection`과 아래 표가 실행 범위를 구분한다. 현재 스크립트는 마지막 Tfa/Board 모바일 부분 실행 상태다.

```sh
/opt/miniconda3/bin/python docs/home-online-polish/evidence/home-service-layout-probe.py http://127.0.0.1:65199 > docs/home-online-polish/evidence/home-service-layout-command.log 2>&1
```

| 시도와 보존 파일 | 실제 process 결과 | 의미 |
|---|---|---|
| [initial-locator JSON](evidence/home-service-layout-initial-locator.json), [log](evidence/home-service-layout-initial-locator-command.log), `02:18:32–02:19:37 UTC` | exit1; desktop Chat/Info/Tfa 관찰 후 Board role locator timeout | 기존 표가 기대한 `columnheader` role로 잡히지 않은 시험 선택자 오류. `th`로 대체했으며 제품 PASS/FAIL 판정 아님 |
| [mobile-chat-failure JSON](evidence/home-service-layout-mobile-chat-failure.json), [log](evidence/home-service-layout-mobile-chat-failure-command.log), `02:20:34–02:22:13 UTC` | exit1; desktop4화면 완료 후 mobile Chat 실제 input click15초 timeout | **제품 문제 재현**. desktop 결과를 전체 실패에 묻거나 mobile 실패를 PASS로 바꾸지 않음 |
| [mobile-profile-failure JSON](evidence/home-service-layout-mobile-profile-failure.json), [log](evidence/home-service-layout-mobile-profile-failure-command.log), `02:23:25–02:24:04 UTC` | exit1; mobile Chat 실패를 관측으로 보존하고 Info 실제 Main click15초 timeout | **제품 문제 재현**. Logout wrapper의 pointer interception 로그 |
| [마지막 부분 JSON](evidence/home-service-layout.json), [log](evidence/home-service-layout-command.log), `02:25:04–02:25:23 UTC` | exit0, **OBSERVED**, 모바일2화면(Tfa/Board) | Tfa 주요 버튼과 실제 Main 복귀 확인. Board 가로 넘침은 관측값이며 exit0을 제품 PASS로 해석하지 않음 |

스크립트는 DOM rect 및 `elementFromPoint`로 중앙 hit-test를 기록했고 실제 실패는 force click 없이 확인했다. 모바일 Info 입력 focus와 Choose trial은 성공했지만 Main 클릭은 실패했다. 두 viewport와 총8개 서비스 화면을 관찰했지만 하나의 8-test PASS suite로 실행한 것은 아니다. 마지막 browser와 contexts는 모두 닫았고, 65199/defaultdist 사용 완료를 소유 agent에게 알렸다. 임시 guest 계정 생성은 실제 로그인 과정이며 fixture 서버/schema 정리는 서버 소유자가 관리한다.

## P2 수용 — 모바일 Info에서 Logout이 Main 동작을 가로챔

현재 근거: [Info390 screenshot](evidence/home-service-layout-info-390x844.png), [실제 focus screenshot](evidence/home-service-layout-info-focused-390x844.png), [클릭 실패 로그](evidence/home-service-layout-mobile-profile-failure-command.log).

390×844에서 service content는 x80/폭310이다. nickname input x112..313, Choose x112..203은 표시되고 실제 input focus와 Choose trial이 성공했다. Main은 x157.875..304.125, y795..851로 일부가 viewport 아래이며 중앙 hit-test가 false다. 화면의 Logout 버튼 및 absolute wrapper가 Main 윗부분을 덮고 실제 click은 `div.flex.justify-center`가 pointer event를 가로챈다고15초 뒤 실패했다. file input의 고유폭333도 x112..445로55px 가로 넘침을 만들었다.

검토 당시 소스: [InfoView.vue:2](../../frontend/src/views/InfoView.vue#L2)의 absolute inset0 root, [InfoView.vue:54](../../frontend/src/views/InfoView.vue#L54)의 absolute bottom/right Logout wrapper, [InfoView.vue:72](../../frontend/src/views/InfoView.vue#L72)의 파일 input, [App.vue:18](../../frontend/src/App.vue#L18)의 새 containing block. Info의 template 스타일은 baseline부터 동일하지만 새 containing block은 viewport 대신 rail 오른쪽310px를 사용한다. 이 폭 변화와 기존 footer positioning의 상호작용이 현재 차단의 원인으로 보인다. **baseline browser는 재실행하지 않아 새 회귀 여부를 확정하지 않았고, 기존 CSS였다는 이유로 이번 변경과 무관하다고 단정하지 않았다.**

root는 Info/Tfa root·footer를 문서 흐름에 두는 최소 수정안을 수용했다. 인증/submit 동작 변경은 요구하지 않는다. 수정 후 같은 viewport의 실제 Main click과 파일 input 가로 범위 확인이 필요하다.

## P2 수용 — 모바일 Chat의 입력 폭0

현재 근거: [Chat390 screenshot](evidence/home-service-layout-chat-390x844.png), [실패 JSON](evidence/home-service-layout-mobile-chat-failure.json).

390×844에서 service content 폭310, channel bar 폭320(x80..400), message input x432/폭0, Send x472..575.641이다. document width600이며 input은 실제 mouse click15초 timeout으로 클릭할 수 없었다. 채팅 입력을 단지 화면 밖으로 스크롤하면 된다고 설명할 수 없는 폭0 상태다. 1440×900에서는 input x432..1185.688, Send x1225.688..1329.328로 정상이며 실제 draft 입력 후 지우기와 focus를 확인했다.

검토 당시 소스: [ChatView.vue:2](../../frontend/src/views/ChatView.vue#L2)의 두 flex 열, [tailwind.css:58](../../frontend/src/assets/tailwind.css#L58)의 고정 `w-80` channel bar, [tailwind.css:158](../../frontend/src/assets/tailwind.css#L158)의 chat container, [tailwind.css:216](../../frontend/src/assets/tailwind.css#L216)의 입력 row width와 [ChatContainer.vue:9](../../frontend/src/components/chat/ChatContainer.vue#L9)의 Send 배치. 이 소스들은 HEAD 대비 변경이 없었다. 새 App `min-width:0`/고정 rail과 기존 고정폭의 상호작용이 있으므로 baseline 실행 없이 정확한 도입 시점을 주장하지 않는다.

root는 ChatView의 scoped 반응형 column/input 최소 폭 보완을 수용했다. 채널/메시지 핸들러나 소켓 계약 변경은 이 레이아웃 검토에서 요구하지 않는다. 수정 후390/1440의 실제 입력 focus, 무전송 draft 편집, Send 표시를 재검증해야 한다.

## 추가 관찰 — Board 모바일 가로 넘침

[Board390 screenshot](evidence/home-service-layout-board-390x844.png)에서 title과 fixture nickname이 겹치고 우측 열들이 viewport 밖에 있다. table x112/폭731.719/right843.719, document width844이다. 1440에서는 table x112..1408로 가로 폭 안에 있고 실제 fixture 전적 행이 렌더링되었다. 행 수와 세로 높이는 이 공유 격리 fixture에서 다른 검증이 생성한 데이터에 따라 달랐으며 사용자 운영 전적이 아니다.

[BoardView.vue:3](../../frontend/src/views/BoardView.vue#L3)의 `left-20`은 position이 없는 static div라80px offset을 추가하지 않는다. [BoardView.vue:19](../../frontend/src/views/BoardView.vue#L19)부터7열 표와 헤더 flex 구조는 baseline 대비 무변경이다. 모바일 표의 containment/별도 가로 스크롤 개선 여지가 있지만 이 검토에서는 production을 바꾸지 않았다. baseline browser 미실행으로 regression 여부는 확정하지 않는다.

## 정상 관찰과 이미지 검토

| 화면 | 1440×900 | 390×844 |
|---|---|---|
| Chat | rail 겹침 없음, input/Send 보임, 실제 input focus 및 draft 편집 | 위 P2 재현 |
| Info | rail 겹침 없음, input/Choose/upload/Main 표시, 실제 Main→Home | nickname/Choose 정상, footer 실제 클릭 차단 및 file input 넘침 |
| Tfa | Turn on/Main 표시 및 native trial/focus, 실제 Main→Home | document width390, Turn on x152.703..309.281와 Main x157.875..304.125 정상, 실제 Main→Home |
| Board | rail 겹침 없이7열/fixture 전적 렌더링, 세로 스크롤 필요 | 가로 넘침 및 title 충돌 |

직접 image-view로 열어 검토한 파일: `home-service-layout-chat-1440x900.png`, `chat-390x844.png`, `info-1440x900.png`, `info-390x844.png`, `info-focused-1440x900.png`, `info-focused-390x844.png`, `tfa-1440x900.png`, `tfa-390x844.png`, `board-1440x900.png`, `board-390x844.png` (모두 같은 `home-service-layout-` 접두어/evidence 디렉터리). 모든 PNG는 viewport 캡처이며 overflow를 감추기 위해 viewport를 확장하지 않았다.

Tfa는 guest의 2FA-off 관리 상태만 검토했고 code-entry 상태는 이번 레이아웃 검사에서 만들지 않았다. 실제 prerequisite 인증 완료 증거는 별도 home-auth-prerequisites suite이며 여기서 소급 실행했다고 주장하지 않는다. 터치 플레이, 사람 키보드/오디오, 외부 메일, 프로덕션 메시지 송수신, baseline 전후 서비스 화면 비교는 이 보고서 범위 밖이다.


## 첫 보완 실제 재검증 — 28/28 PASS, 시각 잔여 별도

root가 guest/debug flags를 포함해 빌드한 frontend `48d5f08ffe220840`, served app `/js/app.1e5bb53b.js`, 새 owned fixture `http://127.0.0.1:50396`에서 실행했다. 정확한 build 로그는 `evidence/service-layout-fix-flagged-build.log`다. 직전 flags 누락 build는 브라우저로 실행하지 않았으며 제품 실패로 집계하지 않는다.

root cwd의 정확한 명령:

```sh
/opt/miniconda3/bin/python docs/home-online-polish/evidence/home-service-layout-after-probe.py http://127.0.0.1:50396 > docs/home-online-polish/evidence/home-service-layout-after-command.log 2>&1
```

실제 **exit0, 28 Python checks PASS**, 종료 `2026-09-08T02:38:42.439689Z`. 원시 기록을 [after-first JSON](evidence/home-service-layout-after-first.json)과 [command log](evidence/home-service-layout-after-first-command.log), `home-service-layout-after-first-*.png`10장으로 고정 보존했다. latest `after-*`는 후속 검증에서 바뀔 수 있다. 이 실행은 fresh guest2, 각각1440×900/390×844로 수행했고 모든 contexts를 종료한 뒤 root에 fixture/defaultdist 사용 해제를 알렸다.

- Info: 두 viewport 모두 native nickname focus, Choose trial, file input width, Main hit-test와 **실제 Main click→Home** 통과. 390px file input은333→246px, right358로 내용 영역 안에 들어왔다. Main은 정상 문서 스크롤 후 중앙 hit-test true이고 Logout이 가로채지 않았다.
- Tfa: 두 viewport native button focus/trial과 실제 Main click→Home 통과. toggle/mail/verify는 실행하지 않았다.
- Chat: 두 viewport document width가 viewport와 같고 입력은 양수폭, 실제 클릭/focus/draft 편집 후 지우기와 Send native trial 통과. 메시지는 전송하지 않았다. 다만 모바일 input50.25px/Send153.906px, 데스크톱 input384.844px/Send488.484px여서 Send가 과도하게 폭을 차지했다. 스크린샷을 열어 발견한 **시각 잔여**이며 양수폭 테스트 PASS로 숨기지 않는다. reviewer는 기존 Send `flex-auto`와 새 bottom-bar `flex:1`의 폭 분할에 대해 scoped Send `flex:0 0 auto`를 권고했다.
- Board: 모바일 document width666/table554.094/right666.094, Achievements x530.406..666.094로 계속 offscreen이고 title/fixture nickname이 겹친다. 이 fresh fixture는 이전 fixture보다 행/전적 데이터가 적어 정확한 폭이 다르다. 같은 원본 소스였다는 이유로 도입 시점을 단정하지 않는다. root는 scoped header wrapping 및 표 자체의 가로 scroll region 개선을 진행하기로 했다.

두 P2의 클릭/입력 차단은 첫 보완의 실제 동작에서 해소됐다. 보고서 상태 `PASS_WITH_BOARD_LIMITATION`은28개 지정 단언의 통과와 별도의 Board 관찰을 뜻하며 서비스 전체의 시각 완료를 의미하지 않는다. 첫 보완의10장도 모두 image-view로 열어 검토했다. 추가 Send/Board 보완 후에는 같은 viewport의 입력 크기 및 native table horizontal scroll 접근을 다시 검사해야 한다.

## 최종 보완 실제 재검증 — 37/37 PASS

root의 고정 frontend build **`4de1388331743be3`**, 실제 두 browser context에서 관측한 app **`/js/app.89b642c7.js`**, root 소유의 같은 소스 backend fixture **`http://127.0.0.1:52262`**를 사용했다. Chrome `152.0.7977.77`에서 새 guest 두 개를 각각 실제 Login 버튼→HTTP cookie/JWT→full document callback으로 만들었다. credential 주입은 하지 않았다. 다음 root cwd 명령은 reviewer가 직접 실행했으며 tool process 결과는 **exit0**다.

```sh
/opt/miniconda3/bin/python docs/home-online-polish/evidence/home-service-layout-final-probe.py http://127.0.0.1:52262 > docs/home-online-polish/evidence/home-service-layout-final-command.log 2>&1
```

[최종 JSON](evidence/home-service-layout-final.json), [정확한 출력](evidence/home-service-layout-final-command.log): **37 Python checks PASS**, 실행 `2026-09-08T03:14:15.117616Z`부터 `03:14:55.869672Z`. 실제 검사는 Home sidebar에서 Chat/Info/Tfa/Board로 들어가며 rail은 두 viewport 모두80px다. 37은 아래 동작·geometry·자원 관측 단언 수이며 37개 독립 서비스나 Jest test가 아니다.

| 화면 | 1440×900 | 390×844 |
|---|---|---|
| Chat | input912.36px / Send71.64px. 실제 input click·draft 입력 후 삭제·focus, Send native trial PASS | input182.36px / Send71.64px. 입력150px 이상 및 Send120px 이하, right374px, 같은 native 검사 PASS |
| Info | nickname focus/Choose trial, 파일 입력 right445px. 정상 세로 스크롤 후 Main center hit-test true, 실제 Main→Home PASS | 파일 입력246px/right358px. 스크롤 후 Main y740..796, hit-test true, 실제 Main→Home PASS |
| Tfa | Turn on focus/trial과 실제 Main→Home PASS | Turn on x152.70..309.28, 동일 검사 PASS |
| Board | 표1296px/right1408px,7열이 보임. labeled region focus 및 헤더 겹침0 | document390px, 자체 region310px/scrollWidth752px, 표720px. native ArrowRight로 scrollLeft0→442, Achievements right374px/실제 hit-test true. body scrollX0, 헤더 겹침0 |

모든8개 화면에서 document width는 viewport와 같았다. 모바일 표의 넓은 내용은 labeled/focusable 자체 scroll region 안에 남겨 키보드로 마지막 열까지 접근했다. 전역 overflow를 숨겨 통과시킨 것이 아니다. Chat은 빈 메시지 영역에서 임시 draft만 편집하고 지웠으며 Send는 native actionability trial만 실행했다. Info Choose도 trial이며 nickname submit/파일 업로드는 없었다. Tfa on/off·Verify를 실행하지 않았다. 두 context의 pageerror0 및 `/auth/email*` 요청0을 관측했다. 검증 뒤 contexts와 Chrome을 닫고 root와 온라인 담당자에게 사용 해제를 알렸다. 서버는 종료하지 않았다.

최종 PNG11장을 모두 image-view로 실제 열어 검토했다. 같은 viewport의 원본 실패 및 첫 보완 PNG와 별도 이름으로 남겼다. fixture 계정과 전적 데이터는 새 서버이므로 이전 캡처와 행 수/닉네임을 같다고 주장하지 않는다.

| 화면 | 최종 데스크톱 | 최종 모바일 |
|---|---|---|
| Chat | [1440×900](evidence/home-service-layout-final-chat-1440x900.png) | [390×844](evidence/home-service-layout-final-chat-390x844.png) |
| Info 처음 위치 | [1440×900](evidence/home-service-layout-final-info-1440x900.png) | [390×844](evidence/home-service-layout-final-info-390x844.png) |
| Info Main 조작 위치 | [1440×900](evidence/home-service-layout-final-info-main-1440x900.png) | [390×844](evidence/home-service-layout-final-info-main-390x844.png) |
| Tfa | [1440×900](evidence/home-service-layout-final-tfa-1440x900.png) | [390×844](evidence/home-service-layout-final-tfa-390x844.png) |
| Board 처음 위치 | [1440×900](evidence/home-service-layout-final-board-1440x900.png) | [390×844](evidence/home-service-layout-final-board-390x844.png) |
| Board 키보드 스크롤 후 | 해당 없음 | [390×844 마지막 열](evidence/home-service-layout-final-board-scrolled-390x844.png) |

수용된 수정은 Info/Tfa 문서 흐름, Chat의 scoped composer/input/compact Send, Board의 scoped header wrapping 및 자체 스크롤 영역이다. root가 production을 수정했고 reviewer는 검사·증거·이 문서만 작성했다. 기존 handler/인증·채팅·전적 데이터 계약을 바꾸라는 권고는 하지 않았다. 본 최종 검증에서 추가 조작 차단은 발견하지 않았다. Board의 기존 조밀한 열 헤더는 모바일 스크롤 캡처에서 `Losses`/`Ladder Level` 등이 가깝게 붙어 보이는 시각 한계가 남는다. Board PASS는 document containment·키보드로 마지막 열 접근·title/account 충돌 해소를 뜻하며 표 typography 전면 개선이나 기존 table semantics 개선을 뜻하지 않는다. baseline 서비스 runtime 비교, 물리 키보드/터치, 실제 대화 전송, 외부 메일/2FA 변경, 전체 기존 서비스 기능은 이37 PASS의 범위 밖이다.
