# 공개 로그인 요청 진단 — 운영 수정 전 기록

대상은 `sungmpar/ft_transcendence_project`다. 소스 기준은 `main`/`ecbb0ee30694f372b8e6e51c1642ef258681443d`이며 live gate는 [BASELINE_AND_SCOPE](BASELINE_AND_SCOPE.md)에 있다. 아래는 이번에 수집한 공개 페이지 읽기 기록과 로컬 소스의 대조다. **guest 문서 이동과 HMR 기본 목적지를 로컬 소스에서 복원하고 회귀 시험을 실행했다. 운영 수정·재배포는 하지 않았다.** 각 관측의 실행 주체와 한계는 아래에 구분했다.

## 판정

**확정:** 공개 HTTPS 로그인 첫 로딩에서 개발용 HMR 클라이언트가 `ws://172.18.0.3:3000/ws` 연결 시도를 생성했다. 브라우저가 공개 사이트 origin 대신 사설 IPv4 literal을 사용한 사실과 webpack-dev-server의 생성 경로가 함께 기록돼 있다. 이 시도는 guest 버튼을 누르기 전이다.

**미확정:** 사용자 스크린샷의 LNA 권한창을 이 요청이 직접 열었는지, 해당 사용자의 DNS·프로필에서도 같은 요청이 발생했는지는 확인하지 못했다. 이번 새 Chrome의 native 권한 UI 접근은 CUA에서 `not approved`로 거부되어 **BLOCKED**다. permission 상태 `prompt`와 WebSocket 생성 이벤트는 팝업 직접 관측 또는 권한 승인 증거가 아니다.

**미검증:** 운영 로그인 클릭·계정 생성·인증 사용자 요청·온라인 경기·초대·관전·채팅, 수정 후 운영 무프롬프트. 이들 운영 행동을 이번 읽기 조사에서 실행하지 않았다. 로컬 격리 fixture의 회귀 성공으로 운영 결과를 대체하지 않는다.

## A. 토큰 없는 공개 로그인 첫 로딩

원시 정제 기록: [public-login-before-network.json](evidence/public-login-before-network.json). 수집 시작 `2026-09-08T18:32:24.460242Z`이며 요청별 시각은 JSON의 `at`에 있다.

환경은 실제 Chrome `152.0.7977.77`, 새 task 전용 프로필, headful/top-level 페이지다. 기록의 `securityFlagsDisabled=false`, `permissionsGrantedByTest=false`, `tokenExists=false`이며 `permissionQuery='prompt'`다. guest 버튼은 1개 보였지만 누르지 않았다. 운영 `/auth/guest` 요청과 계정 생성은 **0**이다.

| 행동 → 실제 전체 URL | 종류·Initiator | 관측된 결과·주소 공간 | 판정 |
|---|---|---|---|
| 첫 로딩 → `https://transcendence.koreacentral.cloudapp.azure.com/login` | Document/other | HTTPS200, remote `20.194.105.25:443`, HTTP/2, securityState secure, Public | 이번 관측에서 공개 문서 접근 성공 |
| 문서 파싱 → `https://transcendence.koreacentral.cloudapp.azure.com/js/chunk-vendors.js` | Script/parser, 원 문서 `/login` | HTTPS200, 같은 remote/Public | 자산 로드 성공 |
| 문서 파싱 → `https://transcendence.koreacentral.cloudapp.azure.com/js/app.js` | Script/parser, 원 문서 `/login` | HTTPS200, 같은 remote/Public | 자산 로드 성공 |
| 개발 클라이언트 실행 → **`ws://172.18.0.3:3000/ws`** | WebSocket/script; 아래 stack | 사설 literal 목적지의 연결 생성 이벤트. 이 WebSocket의 handshake 상태·remote address·차단 사유는 이 JSON에 없음 | 브라우저가 사용할 HMR 주소의 오류 확인. 원격 사설 서버 도달 성공이나 LNA 허용/차단 결과는 확정하지 않음 |
| favicon → `https://transcendence.koreacentral.cloudapp.azure.com/favicon.ico` | Other/other | `net::ERR_ABORTED`, blockedReason/corsStatus null; 응답 remote/status 없음 | 별도 요청 실패 관찰. LNA 원인으로 분류하지 않음 |

HMR 생성 stack은 다음 순서다. line은 수집한 CDP 필드 그대로이며 소스 문서의 1-based line으로 변환한 주장이 아니다.

1. `WebSocketClient`, `webpack-internal:/./node_modules/webpack-dev-server/client/clients/WebSocketClient.js`, line43.
2. `initSocket`, `webpack-internal:/./node_modules/webpack-dev-server/client/socket.js`, line30.
3. `webpack-dev-server/client/index.js`, line286.
4. 공개 `chunk-vendors.js`, line685의 client query: `protocol=ws&hostname=172.18.0.3&port=3000&pathname=%2Fws&logging=none&reconnect=10`.
5. 공개 `app.js`의 `__webpack_require__`, line1427과 초기화 line2606.

이것은 게임 Socket.IO의 `/socket.io/` transport 또는 `/game` namespace가 아니다. HMR의 `/ws`다. 주소 `172.18.0.3`이 실제 어떤 컨테이너에 속하는지는 운영 프로세스·네트워크를 읽지 않았으므로 확정하지 않는다. `0.0.0.0` listen 주소와 방문자에게 주어진 사설 주소도 혼동하지 않는다.

root 실행 기록상 수집 뒤 stdin 대기에서 EOF가 나 프로브 프로세스는 exit1이었다. 이미 수집한 요청 기록은 관찰 근거로 남지만 전체 프로브를 process PASS로 바꾸지 않는다. native Chrome UI 도구 승인 거부는 별도의 접근 제한이며 사이트의 인증 실패가 아니다. 이 페이지 읽기에 인증서 오류 무시나 권한 사전 허용은 사용하지 않았다.

## B. 공개 자산의 재확인과 API 주소 범위

[public-bundle-fingerprints.json](evidence/public-bundle-fingerprints.json), 수집 `2026-09-08T19:07:16.307965Z`:

| 실제 공개 자산 | HTTP·바이트 수 | SHA256 |
|---|---|---|
| `https://transcendence.koreacentral.cloudapp.azure.com/js/app.js` | 200 /1,216,734 | `4c68aa50033bda15bba7e028d70b8712336309b4a06d6b0aa309e469c453e465` |
| `https://transcendence.koreacentral.cloudapp.azure.com/js/chunk-vendors.js` | 200 /7,879,118 | `2d58ae62892a8a52491888da723ce3e05836192341f34363b941d12da0e92906` |

두 자산에서 위 HMR query가 확인됐다. 이 해시는 후속 별도 읽기의 자산 fingerprint이며 18:32에 로드한 자산의 응답 body를 그때 해시한 것이라고 소급하지 않는다. 운영 프로세스의 env 값을 읽은 기록도 아니다.

[public-bundle-endpoint-expressions.json](evidence/public-bundle-endpoint-expressions.json)은 위 `app.js` 해시에 한정해 다음 실제 모듈을 확인했다.

| 모듈 | 확인한 주입값·fallback | 한계 |
|---|---|---|
| LoginView, FriendsSlider, main.ts | 해당 embedded env에 `VUE_APP_BACKEND_URL` key 없음, `window.location.origin` fallback | 운영 API를 localhost로 지정했다는 증거가 아니다. callback redirect나 lazy chunk 전체를 검사한 것은 아니다. |
| route-game-socket.ts, router/index.ts | 해당 embedded env에 `VUE_APP_WS_URL` key 없음, `window.location.origin.replace(/^http/, 'ws')` fallback | 게임·채팅의 실제 인증 연결은 실행하지 않았다. 공개 hostname의 미래 DNS까지 보증하지 않는다. |

따라서 관측된 사설 HMR 주소와 API/game/chat의 기본 주소 표현은 구분해야 한다. `/user/me`, 프로필 이미지, `/game`, `/chat`의 운영 인증 동작은 이 분석에서 **NOT_RUN**이다. fetch 자체가 사설망 권한을 필요로 한다거나 실제 Azure `.env`가 localhost였다고 결론 내리지 않는다.

## C. 기존 공개 `/ws` 경로의 수동 upgrade 확인

아래는 root가 수행한 **Node WebSocket 클라이언트의 수동 관찰**이다. browser LNA 판정 경계를 재현하지 않는다. 세 시도 모두 주소는 `wss://transcendence.koreacentral.cloudapp.azure.com/ws`이고 인증서 검증은 기본값이며 우회하지 않았다. 애플리케이션 메시지를 전송하지 않았다.

| 기록·시각 UTC | 실제 결과 | 분류 |
|---|---|---|
| [public-ws-upgrade-sandbox.json](evidence/public-ws-upgrade-sandbox.json),19:17:12.689 | `getaddrinfo ENOTFOUND`, UPGRADE_FAILED | 첫 sandbox 환경의 DNS/접근 실패. 뒤 승인된 동일 주소 연결 결과와 구분하고 운영 DNS 장애라고 단정하지 않는다. |
| [public-ws-upgrade.json](evidence/public-ws-upgrade.json),19:17:37.794 | 승인된 실행에서101/open, remote `20.194.105.25:443`, TLS authorized true. error frame 후 close1005, CLOSED_BEFORE_COMPLETION | 정상 browser Origin을 넣지 않은 클라이언트 시도. handshake 성공과 HMR 세션 유지 실패를 함께 남긴다. |
| [public-ws-upgrade-origin.json](evidence/public-ws-upgrade-origin.json),19:18:24.359 | Origin=`https://transcendence.koreacentral.cloudapp.azure.com`;101/open, 같은 remote/TLS authorized true. hot/liveReload/progress/reconnect/overlay/hash/warnings frame 수신, PASSIVE_UPGRADE_OBSERVED | **정상 Origin에서 공개 WSS 경로로 개발 서버 응답을 받을 수 있음**을 확인했다. warnings 원문은 정제되어 있으며 메시지 수신을 경고 없는 build나 코드 HMR 갱신 성공으로 확대하지 않는다. |

이 결과는 기존 공개 `/ws` 경로를 활용하는 최소 복원안을 뒷받침한다. 현재 프록시의 제품명·설정 파일·container upstream을 완전히 확인한 것은 아니다. 특히 Node에서 성공한 공개 WSS를 Chrome의 수정 후 무프롬프트 성공이라고 쓰지 않는다. 원시 JSON에 shell 명령/프로세스 exit가 없는 시도는 JSON 상태를 process exit0으로 바꾸지 않으며 최종 TEST_REPORT의 실행자 명령 기록과 함께 판단한다.

## D. 구현과 로컬 확인

P1은 guest의 기존 redirect 계약에 맞춰 사용자 클릭의 document navigation으로 복원했다. 이 계약 변경은 사용자 요청에 따른 호환성 복원이며 사설 HMR의 직접 해법이라는 주장이 아니다. [LoginView](../../frontend/src/views/LoginView.vue)의 동기 busy guard·`document.location.assign`·`pageshow` 복구와 [guest-navigation-url](../../frontend/src/arcade/guest-navigation-url.ts)의 scheme·literal 주소 검증을 적용했다. 기존 callback, cookie, 닉네임, 2FA, intent allowlist/TTL, flag-off 및 공개 경로는 보존했다. guest 전용 fetch/CORS만 제거했다.

[P1_AUTH_CONTRACT](P1_AUTH_CONTRACT.md)의 당시 단위 계약 40개와 최종 guest 브라우저 16개가 통과했다. 독립 리뷰에서 주소 공간 차단과 scheme downgrade가 중첩된 시험 공백을 찾아 같은 scheme의 사설 목적지 및 정상 공개 HTTP 사례11개를 추가했고, 최종 단위51개도 통과했다. 실제 문서 요청과 계정 생성, 같은 hostname의 별도 포트, 응답 실패 후 뒤로가기, 실제 bfcache의 `pageshow.persisted`를 확인했다. fetch를 LNA 원인으로 확정하는 시험은 아니다. 브라우저 이동 이후의 서버 오류는 원 페이지의 JavaScript가 직접 잡을 수 없으며 뒤로가기 안내와 재진입 상태 복구로 처리한다.

P2는 [vue.config.js](../../frontend/vue.config.js)의 기본 HMR 주소를 `override || 'auto://0.0.0.0:0/ws'`로 바꿨다. 설치된 webpack-dev-server 4.9.3의 URL parser 단위 8개가 통과했고, 실제 로컬 serve와 소유한 reverse proxy 경유 Chrome에서 각 browser origin의 `/ws`로101/hash를 받았다. 초기 연결은 기존 1초 heartbeat에 pong이 늦어 code1006으로 끊겼으며 이 실패를 보존했다. 별도 후속 관측에서는 기존 자동 재연결 후 같은 연결이 3초 이상 유지되고 pong이 확인됐다. heartbeat·게임/채팅 소켓·프로토콜을 바꾸지 않았다. 상세 원시 기록과 초기 실패/후속 성공 구분은 [P2_HMR_REVIEW](P2_HMR_REVIEW.md)에 있다. 실제 소스 파일 편집을 통한 hot update는 실행하지 않았다.

이들은 아직 공개 자산에 배포됐다는 증거가 아니다. URL 문자열 검사는 private DNS 응답을 알아내는 기능이 아니며, 명시적 사설 HMR override까지 auto 기본값이 교정하지 않는다. 다른 공개 hostname 간 cookie/callback 지원 여부는 별도다. [DEPLOYMENT_HANDOFF](DEPLOYMENT_HANDOFF.md)에 운영 확인 경계를 분리했다.

## 남은 확인

- **BLOCKED:** native Chrome의 실제 LNA 권한창 표시/미표시 직접 관찰. 권한이 prompt라는 값이나 Playwright dialog 이벤트 수로 대신하지 않는다.
- **NOT_RUN:** 운영 guest 생성, callback·닉네임·2FA, 인증 API·프로필 이미지·게임·채팅의 실제 요청 주소, 수정 후 운영 무프롬프트와 기능 보존.
- **UNVERIFIED:** 현재 Azure 프로세스, 선택된 Compose override, runtime/build env, Caddy 또는 다른 프록시의 실제 upstream과 path 설정, public hostname의 모든 사용자 DNS 결과.
- **LOCAL VERIFIED WITH LIMITS:** guest 단위·브라우저 계약과 HMR 주소/자동 재연결 관측. 온라인 전체 브라우저 실행에는 관전자 복구 timeout이 있었으며, 최종 후속 결과와 미실행 범위는 [TEST_REPORT](TEST_REPORT.md) 및 [OBSERVER_DIAGNOSIS](OBSERVER_DIAGNOSIS.md)에서 별도로 보고한다.

상태는 **PUBLIC_PRIVATE_HMR_REQUEST_CONFIRMED / NATIVE_PERMISSION_UI_BLOCKED / PARTIAL_NEEDS_DEPLOYMENT_VERIFICATION**이다. 운영 env 수정·재배포·재시작·DB 변경·계정 생성은 수행하지 않았다.
