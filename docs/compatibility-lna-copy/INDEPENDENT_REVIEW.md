# P4 독립 소스 리뷰

대상: `sungmpar/ft_transcendence_project`, `main`, `ecbb0ee30694f372b8e6e51c1642ef258681443d` 위의 이번 작업 미커밋 diff. 2026-09-09 검토. 검토자는 루트가 변경한 문구와 기존 동작의 연결을 읽었으며, 이 리뷰에서 제품 소스 수정·시험 실행·Chrome 실행·운영 요청은 하지 않았다.

## 범위와 한계

- 검토 diff: `LoginView.vue`, `LocalPlayView.vue`, `OnlineGameShell.vue`, `GameView.vue`, `InviteGameView.vue`, `SideBar.vue`, `online-result.ts`, `scripts/browser-home-auth.py`.
- 대조 근거: 실행 명세 §7 P4, `shared/game-core.ts`, `game.service.ts`, `keyboard-controller.ts`, `online-preferences.ts`, `online-session.ts`, `snapshot-buffer.ts`, router, login-intent, auth-session 및 관련 단위·브라우저 시험 소스.
- `ProjectInfo`, `LaunchPanel`, Home, 공개 허브는 다른 담당자가 편집 중이어서 이번 독립 리뷰 대상에서 제외했다. Login에 추가된 공통 소개의 import/배치만 확인했다.
- 검토자 자신이 작성한 P1 URL/guest navigation 구현은 독립 검증 성과로 세지 않는다. P1의 실행 기록과 최초 전체 실행 실패·bfcache 개별 후속 성공 구분은 별도 `P1_AUTH_CONTRACT.md`에 그대로 둔다. 이 문서는 새 전체 16개 브라우저 시험 성공을 주장하지 않는다.

## 확정 발견과 처리 상태

| ID | 발견 | 제안/상태 |
|---|---|---|
| COPY-R1 | 최초 읽기 시 `backend/src/game/online-result.spec.ts:9`가 기존 부분 문자열 `저장 여부는 확인되지`를 요구했다. 새 pending 문구에는 이 문자열이 없어 그 소스 조합은 단언을 만족하지 않았다. | 루트에 알린 뒤 재독에서 새 전체 문장 `경기는 끝났지만 전적 저장 여부를 확인하지 못했습니다.`의 정확한 일치 검사로 수정된 것을 확인했다. `status === pending`과 저장 성공을 추론하지 않는 기존 의미를 유지한 해결을 수락한다. **실행으로 재현한 시험 실패가 아닌 소스상 확정 불일치와 수정 확인**이다. |
| COPY-R2 | 최초 읽기 시 AI 오른쪽 키 안내는 역할 문장만 표시했지만 `browser-local-modes.py:56`은 그 요소에 `보통`이 있는지 검사했다. 난이도 표시를 없애면 기존 손상된 설정의 Normal 복귀 검증이 깨진다. | 루트에 알린 뒤 재독에서 `LocalPlayView.vue:80`이 실제 `preferences.difficulty`의 한국어 이름과 오른쪽 AI 역할을 함께 표시하도록 수정된 것을 확인했다. 기존 Classic/Normal 복귀 단언을 유지한 해결을 수락한다. 이 리뷰에서 브라우저를 재실행하지 않았다. |

## 동작·코드 사실 대조

| 확인 항목 | 근거와 판단 |
|---|---|
| 로그인 목적지/선행 절차 | copy diff가 `clearLoginIntent`, 로그인 경로, callback, nickname/2FA guard를 변경하지 않는다. `/game`, `/invite`, `/spectate` 허용 목록 및 10분 세션 의도는 기존 router/login-intent에 유지된다. |
| 취소/로그아웃 | 취소 문구만 바뀌고 `/play` 링크와 `clearLoginIntent`가 유지된다. 서버 미확인 로그아웃 안내는 기존 `logout=unconfirmed` 조건에서만 표시된다. `browser-home-auth.py`의 두 정확한 텍스트 선택자도 새 문구로 갱신되어 있다. |
| guest와 기능 플래그 | 게스트가 체험 계정을 **만든다**는 사실을 숨기지 않는다. 게스트 버튼 testid, busy/disabled 상태, 환경 플래그와 42 로그인 비활성 상태는 유지된다. 계정 삭제·무저장·운영 로그인 성공을 주장하지 않는다. |
| 로컬/AI 키 | 왼쪽 키는 기존 `labels(isAi ? preferences.humanKeys : 'left')`, 오른쪽 로컬 키는 기존 저장 설정을 사용한다. 컴퓨터는 기존 AI 생성/샘플 경로에서 오른쪽 패들을 조작한다. 온라인 기본 ↑/↓/Space와 대체 W/S/D, 로컬 기본 오른쪽 Power ←는 바뀌지 않는다. |
| Power 충전 | `game-core.ts`는 일반 타격마다 charge를 최대 5까지 올리고, charge 5에서 action으로 길이를 늘리며, 강화 타격마다 1을 차감하고 0일 때 원래 길이로 되돌린다. 이동과 action을 같은 tick에서 처리한다. 로컬·온라인 화면은 실제 5개 칸과 charge/5를 표시한다. 새 설명의 ‘충전량이 한 칸씩’은 길이가 타격마다 점진적으로 짧아진다는 오해를 피한다. |
| 랜덤/초대 규칙 | `createRoom`의 `other.mode === true && mode === true`는 랜덤 양쪽 Power 조건과 일치한다. `joinToFriend`는 초대한 사람의 mode를 양쪽 인자로 전달한다. 초대 수신 대상은 `/game` namespace의 sessions에 있어야 한다는 안내도 `invite()` 조회와 일치한다. |
| 조작 focus | `KeyboardController`는 canvas focus 및 입력 요소 제외를 확인하며 blur 시 held 입력을 비운다. 온라인 설명이 채팅·설정 중 패들을 조작하지 않는 기존 계약과 일치한다. |
| 진단값 | RTT는 별도 요청/응답까지의 경과시간, 입력 반영 확인은 해당 seq ACK를 포함한 상태 수신까지의 시간이다. 표시 지연은 추정 server tick과 presentation tick 차이이며 광학/편도 지연으로 바꾸지 않았다. underflow는 `underflow && !underflowing` 때만 증가하므로 부족 **구간**을 센다는 설명이 정확하다. metric 이름·값 계산은 변경되지 않는다. |
| 온라인 프로토콜/결과 | copy 범위에서 `matchmaking` payload, route name, ready/snapshot/sessionSync/resultStatus 처리, 타이머 또는 경기 규칙 diff는 없다. `online-result.ts`는 pending 안내 한 줄만 바뀌며 saved/failed/aborted 상태 구분은 유지한다. |
| 홈 링크 | `SideBar`의 접근 가능한 이름만 Home→홈으로 바뀌고 `/` 및 aria-current 판정은 유지된다. OnlineShell의 `/` 링크는 ‘홈으로’가 되었으며 브라우저 시험의 `online-menu` testid는 유지된다. |

## P1 16개 시험 및 기존 브라우저 선택자 정적 확인

`home-guest-entry.e2e-spec.ts`의 guest/busy/disabled/온라인 도착 선택자는 testid를 사용한다. 취소는 유지된 `.login-cancel`, 공개 대안은 유지된 경로/testid를 사용한다. 정확한 문구 의존 두 곳은 현재 Login과 일치한다.

- 새 탭 링크: `새 탭에서 열기 ↗`.
- 팝업 heading: `경기 관전 계속하기`.

`browser-online-final.py`는 key hint의 W/S/D를 확인하고 같은 키의 실제 outgoing 입력을 별도로 검사하므로 ‘위로/아래로/Power’ 설명 추가와 충돌하지 않는다. 기존 Home/navigation/온라인 브라우저 소스에서 변경된 홈 링크 이름에 의존하는 미갱신 선택자는 발견하지 못했다. 이는 소스 읽기 결과이며 새 빌드에서 실행한 결과가 아니다.

## 실행한 읽기 명령과 결과

작업 디렉터리는 저장소 루트다. `git status --short`, `git diff --stat`, 위 검토 파일 대상 `git diff`, 보존 경로 대상 `git diff --numstat`, `git branch --show-current`, `git rev-parse HEAD`, 지정 소스·시험·명세에 대한 `sed -n`/`grep -n`/`grep -RIn` 및 `find scripts -maxdepth 1 -type f -name 'browser-*.py'`를 실행했다. Git 명령은 모두 종료 0이며 branch/HEAD는 위와 같다. 보존 경로의 numstat 출력은 없었다.

한 선택자 검색은 존재하지 않는 가정 경로 `scripts/browser-service-preservation.py`를 포함하여 종료 2였고, 이를 시험 실패로 해석하지 않았다. 실제 scripts 목록을 `find`로 다시 확인했다. 다른 읽기 명령은 정상 완료했다. 제품·시험·빌드·lint 실행 명령은 이 하위 리뷰에서 실행하지 않았다.

## 추가 P2 독립 읽기 리뷰

P2 담당자 요청으로 `frontend/vue.config.js`, `scripts/compat-hmr-config.cjs`, `backend/test/compat-hmr.spec.js`, `scripts/browser-compat-hmr.py`, 소유 fixture/서버 trace 및 설치된 Vue CLI/WDS의 URL 생성 소스를 읽었다. 설정의 allowedHosts는 유지되며, 명시 override가 우선이고 미설정/빈 문자열만 `auto://0.0.0.0:0/ws`가 된다. helper는 실제 설치 CLI의 옵션 조립, WDS 정규화, 클라이언트 URL 생성 함수를 사용한다. 컴파일·서버 시작·LAN 추정·위치 값의 test double 범위가 명시되어 있고, 이를 실제 네트워크 시험이라고 주장하지 않는다.

브라우저 harness의 `eventual` 분기는 원래 client의 자동 재연결을 관찰한다. 같은 origin의 정확히 한 열린 socket이 연속 3초 동안 실제 `hash`와 `ok`/`warnings`를 수신했는지, 모든 시도에서 101 응답/오류 0인지, guest/API 요청이 없는지 확인한다. 수동 socket 생성, heartbeat 변경, close 억제 또는 permission 승인은 없다. trace wrapper는 원래 ws 메서드와 반환값을 호출하며 trace로 heartbeat를 수정하지 않는다.

검토자가 Python으로 **기존 JSON만 읽어** 대조한 실제 기록은 다음과 같다.

| 기존 실행 증거 | 기록된 결과 |
|---|---|
| `evidence/p2-hmr-runtime-isolated/browser-hmr.json` | direct/proxy 각각 FAIL. 각 정확한 loopback `/ws`의 101과 webpack hash/warnings 수신은 기록되어 있다. |
| `evidence/p2-hmr-eventual/browser-hmr.json` | direct/proxy 각각 PASS. 각 자동 retry 1회 뒤 3.070초/3.048초 열린 연결, 각 101 두 번, 초기 연결 생존은 둘 다 false. 각 실제 script SHA256 기록 2개. |

후속 PASS가 초기 연결 무중단을 뜻하지 않으며, 실제 파일 편집 뒤의 hot replacement나 운영 TLS/LNA 팝업 해결을 검증하지 않는다. 이 구분을 유지하면 확인된 허위 PASS/override/allowedHosts 회귀는 찾지 못했다. harness는 script body 읽기 예외를 최종 gather에서 흡수하므로 일반적으로 SHA 수집 성공을 강제하지는 않는다. 이번 두 경로의 JSON에는 각각 2개가 있으므로 이번 관측값의 누락은 아니며, 이후에도 SHA 기록 여부는 실제 evidence로 확인해야 한다.

이 추가 리뷰는 `cat`/`sed`/`grep` 및 Python `json.loads`를 이용한 파일 읽기만 수행했다(종료 0). 검토자가 P2 단위 또는 브라우저 시험을 실행한 것은 아니다.


## 최종 호환성·설정·인계 문서 읽기 리뷰 — 추가 검토자

추가 검토자는 P1 guest 구현 담당자 및 P2 HMR 구현 담당자와 다른 에이전트다. 검토 대상은 현재 `main/ecbb0ee30694f372b8e6e51c1642ef258681443d` 위의 [guest-navigation-url](../../frontend/src/arcade/guest-navigation-url.ts), [LoginView](../../frontend/src/views/LoginView.vue), [AuthController](../../backend/src/auth/auth.controller.ts), [vue.config.js](../../frontend/vue.config.js)의 미커밋 변경과 URL/controller 회귀 시험 소스, [README](../../README.md), [DIAGNOSIS](DIAGNOSIS.md), [DEPLOYMENT_HANDOFF](DEPLOYMENT_HANDOFF.md)다. 최신 실행 명세 P1–P4·검증·운영 경계와 대조했다.

**독립성 경계:** 이 추가 검토자는 ProjectInfo/P3와 DIAGNOSIS·DEPLOYMENT_HANDOFF의 초기 작성에 참여했다. 그 부분은 최종 자기 검토 및 root 후속 편집 대조이며 독립 구현 감사 성과로 세지 않는다. 반면 P1 guest helper/Login 동작/AuthController, P2 Vue 설정 및 root README 변경은 이 검토자가 작성하지 않은 코드다. 기존 이 문서의 P4/P2 독립 리뷰와 초기 발견 기록은 삭제하지 않았다.

이번 단계에서 제품 소스·시험을 수정하지 않았으며 Chrome, 새 시험·빌드·lint, 운영 요청을 실행하지 않았다. root의 후속 검증은 진행 중이다. 당시 최종 browser 묶음의22 PASS/1 FAIL·wrapper exit1과 관전자 후속 진단, local-browser 진행 상태를 전체 PASS로 바꾸지 않는다.

### 확인한 보존 계약

| 항목 | 읽은 근거와 판정 |
|---|---|
| guest 요청은 한 번의 문서 이동 | Login:56–72에서 동기 busy guard 뒤 검증한 URL로 `document.location.assign()`만 호출한다. guest fetch/health check/자동 timeout 재요청이 없다. 이동 자체로 로그인 성공을 표시하거나 fake user를 넣지 않는다. busy 상태를 `pageshow`에서 복구하고 unmount 시 해당 listener를 제거한다. |
| 기존 생성·cookie·redirect·flag | AuthController:35–44의 동작은 기존 ENABLE_GUEST_LOGIN 검사→createGuest→JWT 발급→기존 cookie→기존 FRONT_URL callback을 유지한다. 이번 diff는 guest fetch를 위한 endpoint 전용 CORS와 사용하지 않는 Req 인수를 제거한다. 전체 API CORS나 OAuth·2FA 검사를 제거하지 않는다. |
| URL 보존과 제한 | helper:33–46은 same-origin 기본값, `/api` 등의 base path, 명시 public override 및 지원되는 local 개발 주소를 유지한다. http/https 외 scheme·userinfo·query/fragment를 거부하고 public-page의 literal local 목적지와 HTTPS downgrade를 별도 조건으로 거부한다. DNS를 조회하지 않으며 서로 다른 공개 hostname의 cookie 지원을 보장하지 않는다. 아래 시험 공백은 이 생산 분기의 결함 판정과 구분한다. |
| 로그인 의도 및 선행 절차 | 변경 없는 login-intent의3개 목적지/10분 TTL/단일 소비·정리와 router의 실제 `/user/me` 확인·닉네임/2FA 분기를 읽었다. Login 새 탭 링크도 고정 `/login`과 허용된 next만 만든다. 이번 diff에 guard 우회가 없다. |
| HMR와 게임 소켓 분리 | Vue 설정은 기존 allowedHosts를 유지하고 명시 override가 우선이며 비어 있을 때만 `auto://0.0.0.0:0/ws`를 사용한다. game/chat 소켓 주소나 `/socket.io/`, 서버 heartbeat·protocol을 수정하지 않는다. 설치된 CLI/WDS 주소 조립을 읽는 helper와 실제 direct/proxy 관측, 초기 생존 실패/후속 자동 복구의 구분은 P2 문서에 있다. |
| 팀 기능·경기 코어 | shared, router, login-intent, auth-session, route-game-socket, online-session, snapshot-buffer, auth/user service, game gateway/service/runner, chat, lockfile, Compose/Dockerfile에 대한 한정 `git diff --numstat` 출력이 비어 있었다. 이는 해당 경로의 소스 보존 근거이며 작동 시험 성공의 대체가 아니다. |
| 소개와 문구 | ProjectInfo는 script/network/lifecycle 없이 native details와 scoped CSS만 가진다. 8개 기술명은 접기 밖에 있고 서버 권한·보간 지연·규칙 AI·로그인 없는 local/AI·팀 작업 기여를 코드 사실과 맞게 설명한다. 이 부분의7장 최종 CSS 이미지 열람은 COPY_REVIEW의 자기/교차 검토 기록이다. |
| 운영 진단·배포 경계 | 공개 HMR private literal 요청·Initiator의 확정 사실과 native 권한 UI BLOCKED를 분리한다. Node WSS101을 Chrome 무프롬프트나 실제 hot update로 확대하지 않는다. 실제 운영 topology/env를 읽기 전 프로세스명·Compose 명령·재기동을 추정하지 않으며 최소 운영 변경은 별도 승인 범위다. |

### 추가 발견: private 목적지 거부 시험의 정책 분리 부족

**COMPAT-R1 — 회귀 시험 공백, 생산 오작동 확정 아님.** [guest-navigation-url.spec.ts](../../backend/src/game/guest-navigation-url.spec.ts):4의 기준 페이지는 HTTPS다. 그런데 literal private·loopback·IPv6 mapped 주소 거부 사례(:43–60)는 전부 `http://`다. 현재 helper:42–43의 local 목적지 조건을 실수로 제거하더라도 이 사례들은 남아 있는 HTTPS→HTTP 차단만으로 `null`이 된다. 따라서 초안의 private-address 행들이 실제 literal 분류 정책을 독립적으로 보호하지 못한다는 점은 소스만으로 확인할 수 있다. 이번 리뷰에서 분기를 제거하거나 시험을 실행해 본 것은 아니다.

제안은 `https://10.1.2.3`, `https://[::1]`, `https://[::ffff:c0a8:0102]`와 같은 **HTTPS private 목적지**, 또는 public HTTP 페이지에서 private HTTP로 향하는 경우를 추가해 주소 공간 검사와 scheme downgrade 검사를 나누는 것이다. 정상 public override·local 개발 허용 사례는 유지해야 한다. 명세 §8 인증/주소6의 public 배포 private 목적지 부정 시험을 더 정확히 보호하는 최소 시험 조정이며 생산 URL 정책 확대나 DNS 탐색을 제안하지 않는다. root가 의견을 수용했다. 후속 소스 재독에서 같은 spec:64–80의10개 hostname 각각에 public HTTPS→private HTTPS와 public HTTP→private HTTP를 모두 검사하고, :81–85에 정상 public HTTP 목적지 허용1개를 추가한 것을 확인했다. 기존 허용·거부 단언은 유지되며 생산 helper 변경은 없다. 두 정책을 독립 보호하는 **시험 변경을 수락**한다. 10개 parameterized test가 각각2개 주소를 검사하고 positive1개가 더해지는 구조다. targeted 시험의 actual exit·최종 PASS는 실행자인 root 기록을 따른다; 이 검토자가 실행한 결과가 아니다.

이 범위에서 새 생산 코드의 확정 실행 결함은 발견하지 못했다. ‘문서 이동만 되면 다른 hostname 인증도 성공한다’, ‘auto 기본값만으로 잘못된 명시 HMR override까지 고쳐진다’, ‘정적 fixture69 UI 단언이 운영 LNA/온라인 전체 성공이다’라는 해석은 **거절**한다. 현재 코드와 인계 문서가 그러한 보장을 하지 않고 실제 한계를 구분하므로 별도 생산 결함으로 등록하지 않았다.

### 문서 경로와 실제 읽기 결과

README와 새 폴더 Markdown11개에서 로컬 링크267개를 읽은 시점에 누락은0개였다. 과거 경로를 가리키는 링크12개는 README의 역사 기록 절에만 있고, 과거 성공을 이번 검증으로 소개하는 잔여 링크는 발견하지 못했다. `DIAGNOSIS`의 OBSERVER_DIAGNOSIS 참조도 실제 파일이 존재한다. 문서와 증거는 다른 담당자가 계속 갱신 중이므로 이 수치는 해당 검사 시점의 결과다.

실제 읽기 명령은 repository cwd에서 다음과 같다. 모든 호출의 process exit는0이었다.

```sh
git diff -- frontend/src/views/LoginView.vue backend/src/auth/auth.controller.ts frontend/vue.config.js README.md
git diff --numstat -- shared frontend/src/router frontend/src/arcade/login-intent.ts frontend/src/arcade/auth-session.ts frontend/src/arcade/route-game-socket.ts frontend/src/arcade/online-session.ts frontend/src/arcade/snapshot-buffer.ts backend/src/auth/auth.service.ts backend/src/user/user.service.ts backend/src/game/game.gateway.ts backend/src/game/game.service.ts backend/src/game/server-match-runner.ts backend/src/chat frontend/yarn.lock backend/yarn.lock docker-compose.yml frontend/Dockerfile
```

추가로 `/opt/miniconda3/bin/python`에서 `Path.read_text()`로 명세·지정 소스·시험·문서를 읽고, `re`/`Path.exists()`로 링크를 확인했다. 읽기와 이 리뷰 문서 append 외의 변경은 하지 않았다.


root의 README 후속 교정도 재독했다. 자동 브라우저 fixture 회귀를 실제 사람이 두 브라우저에서 플레이한 결과로 보고하지 않고, 실제 사람2명·WAN·외부 OAuth/메일·다른 브라우저·Docker를 별도 범위로 명시한 구분을 수락한다. 이번 수정과 baseline에 포함된 과거 Home 개선의 기여 구분도 유지한다.
