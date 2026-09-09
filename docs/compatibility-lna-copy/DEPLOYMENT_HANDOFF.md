# 접속 호환성 복원 — 별도 배포 확인 인계

대상은 `sungmpar/ft_transcendence_project`다. **운영 배포·재시작·env·DB 변경은 실행하지 않았다.** P1/P2 소스 복원과 P3/P4 소개·문구 정비를 로컬에서 구현하고 실제 회귀를 실행했다. 이 문서는 금지된 운영 작업을 실행하지 않고 별도 담당자가 확인할 범위와 순서를 정리한다. 실행 중인 서비스 이름이나 Compose override를 추정해 확정 운영 명령을 만들지 않는다.

## 지금 확인한 것

- 공개 `/login`의 개발 클라이언트가 `ws://172.18.0.3:3000/ws` 연결 시도를 생성한 요청·Initiator stack이 있다. 공개 자산에 같은 HMR query가 들어 있다. [DIAGNOSIS](DIAGNOSIS.md)와 원시 evidence에 정확한 URL·시각·해시가 있다.
- 정상 공개 Origin을 보내면 `wss://transcendence.koreacentral.cloudapp.azure.com/ws`가 기본 TLS 검증으로101/open과 개발 서버 frames를 반환했다. 공개 `/ws` 경로가 존재한다는 근거이며 그 프록시 설정 전체를 읽었다는 뜻은 아니다.
- 저장소 [frontend/Dockerfile](../../frontend/Dockerfile)은 Node18-alpine에서 `yarn serve --host 0.0.0.0`을 시작한다. [docker-compose.yml](../../docker-compose.yml)은 frontend env_file/source mount와 포트3000을 정의한다. **파일 존재가 운영에서 그 파일·override·mount를 실제 사용한다는 증거는 아니다.**
- 운영 `.env`, container/process 목록, 현재 Compose 실행 인수, Caddy 등 프록시 설정·재시작 절차는 확보하지 않았다. 기존 공개 HMR 주소를 만들었던 최종 설정 출처는 배포 담당자의 확인이 필요하다.

## 설정 역할과 보존할 계약

| 설정·경로 | 역할 | 승인 전 확인할 값·경계 |
|---|---|---|
| `VUE_APP_DEV_WEBSOCKET_URL` | Vue 개발 서버의 HMR client 목적지 | 비어 있으면 구현된 auto 기본값을 사용한다. 명시값은 지원되는 공개 WSS 주소일 수 있다. 사설 literal override가 들어 있으면 기본값 변경만으로 수정되지 않으므로 유효값 출처부터 확인한다. |
| `client.webSocketURL = override || 'auto://0.0.0.0:0/ws'` | 설치된 webpack-dev-server가 브라우저 protocol/hostname/port와 `/ws`를 조합하게 하는 설정 | `auto://`와 `0.0.0.0:0`는 설정 문법이다. 브라우저 실제 요청이 `0.0.0.0`이나 내부3000으로 나가야 한다는 뜻이 아니다. 실제 public proxy에서 생성된 URL을 다시 확인한다. |
| `VUE_APP_BACKEND_URL` | 브라우저 API·guest 시작 주소 | 빈 값이면 browser origin. 별도 공개 API override는 무조건 무시하지 않는다. 공개 HTTPS 페이지를 private literal 또는 HTTP로 보내는 guest 목적지는 현재 helper가 거부한다. 다른 API의 잘못된 override까지 모두 정정한 기능은 아니다. |
| `VUE_APP_WS_URL` | Socket.IO `/game`·`/chat` 연결의 base URL | HMR `/ws`와 별도다. public 또는 지원되는 local dev 주소를 사용하고 protocol paired를 유지한다. 게임 소켓을 꺼서 LNA 시도를 숨기지 않는다. |
| `FRONT_URL` | backend guest/OAuth 후 `/login?token=check`로 redirect할 frontend base | 브라우저에서 실제 사용하는 공개 frontend 주소와 기존 cookie/callback 계약을 맞춘다. 운영의 유효값을 확인하기 전 수정값을 확정하지 않는다. |
| `ENABLE_GUEST_LOGIN` / `VUE_APP_ENABLE_GUEST_LOGIN` | 실제 guest 생성 허용 / UI 버튼 노출 | 기존 데모 정책을 유지한다. flag-off에서 로그인 없는 local/AI가 가능해야 한다. 현재 42 UI 비활성 상태를 임의 변경하지 않는다. |
| `/ws` | 개발용 HMR proxy path | 실제 frontend dev server로 전달되는지 확인한다. Socket.IO transport와 충돌시키지 않는다. |
| `/socket.io/` 및 `/game`·`/chat` | Socket.IO transport path 및 namespace | 그대로 보존한다. 문자열 protocol의 과거 `update` 계약으로 되돌리지 않는다. |

[frontend/.env.sample](../../frontend/.env.sample)의 빈 API/Socket override는 샘플 기본값이다. 실제 운영 env가 빈 값이었다거나 localhost였다는 증거로 삼지 않는다. `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`, 실행 shell, Compose env_file/override, build 인수 중 **현재 실행에서 유효한 항목**을 선택적으로 확인한다. `VUE_APP_*`는 번들/개발 컴파일에 주입되는 값이므로 env 파일만 바꾸고 기존 자산을 계속 제공하면 반영되지 않는다. 전체 env나 cookie/JWT를 인계 문서에 복사하지 않는다.

## API origin과 cookie의 범위

guest 흐름은 사용자 클릭 → 검증된 `/auth/guest`의 전체 문서 이동 → 기존 계정 생성·cookie·redirect → callback의 실제 사용자 확인이다. 로그인 의도 allowlist·10분 TTL·사용/취소 후 정리와 닉네임/2FA는 유지한다. guest endpoint로 사전 health check, timeout 자동 재요청 또는 계정 생성 probe를 하지 않는다.

[AuthController](../../backend/src/auth/auth.controller.ts)의 기존 cookie 설정은 임의 broad domain을 추가하지 않는다. **같은 hostname의 별도 개발 포트**와 **서로 다른 공개 hostname**은 같은 지원 계약이 아니다. 별도 포트 fixture의 성공으로 다른 hostname 사이에서 cookie를 읽을 수 있다고 주장하지 않는다. `resolveGuestLoginUrl`이 URL을 허용한다는 사실도 인증 cookie/callback 성공을 보증하지 않는다.

별도 공개 backend를 실제 사용하는 경우 backend가 설정한 cookie가 frontend의 기존 callback에서 처리될 수 있는 이미 지원된 배포 계약인지 확인해야 한다. 필요하면 기존 same-origin 공개 proxy 경로를 이용하는 방식을 검토한다. 이번 복원을 이유로 wildcard credential CORS, broad cookie domain, JWT 저장체계 교체 또는 인증 검사 우회를 추가하지 않는다.

P1에서 guest fetch만 지원하던 endpoint 전용 credential CORS를 제거하는 소스 변경은 controller 단위 시험과 실제 guest 문서 이동 fixture에서 검증했다. 다른 API의 정상 CORS 계약을 일괄 삭제하지 않는다. CORS 헤더 제거 자체는 사설 HMR 주소나 LNA의 해결책이 아니다.

## 승인 전에 배포 담당자가 확인할 최소 정보

1. 현재 frontend가 개발 서버인지 정적 build인지, 실제 실행 경로·선택 Compose/override·서비스 관리 도구·재시작 대상이 무엇인지 확인한다. 저장소 Dockerfile만 보고 Azure 프로세스를 확정하지 않는다.
2. 실제 frontend가 읽는 모드와 관련 URL env의 **정제된 유효값/출처**를 확인한다. URL userinfo/query/token은 제거하고 값이 어디서 들어왔는지를 기록한다. 내부 listen/컨테이너 주소와 방문자 browser endpoint를 구분한다.
3. 공개 `/ws`, API, `/socket.io/`의 실제 proxy path/upstream과 TLS 설정을 확인한다. 기존 정상 Origin의 WSS101 결과를 참고하되 config를 추정해 교체하지 않는다.
4. 현재 배포된 frontend 자산의 URL·hash와 backend 프로토콜 버전을 확인한다. 이번 로컬 source/artifact와 연결되는지 비교하고 stale bundle인지 구분한다. 이미 수집한 공개 app/chunk SHA는 [fingerprints](evidence/public-bundle-fingerprints.json)에 있다.
5. 확정된 토폴로지에 맞는 최소 대상과 정확한 재빌드/재기동 명령, 예상 일시 중단, 검증 순서를 review 가능한 작업안으로 만든다. **그 구체적인 운영 변경에 사용자 승인을 받은 뒤** 실행한다.

이번 단계에는 운영 설정 자료가 없으므로 실행 가능한 것처럼 보이는 `docker compose up`·container 이름·Caddy reload 명령을 발급하지 않는다. 운영 명령을 몰라서 guest endpoint를 호출해 추측하는 방법도 사용하지 않는다.

## 승인 뒤 적용할 최소 범위

**현재 운영이 기존 개발 서버인 경우:** P2의 HMR 목적지 변경과 P1/P3/P4의 frontend 소스가 실제 서비스가 사용하는 source/image에 들어가도록 확인한다. bind mount인지 image 내 source인지에 따라 필요한 재빌드·재기동 범위가 달라진다. 기존 `/ws` proxy path를 활용할 수 있는지 먼저 확인하고, frontend만의 설정 변경에 DB나 전체 Compose stack을 재기동하지 않는다. 수정 뒤 새 compile 자산 fingerprint와 실제 요청 URL을 남긴다.

**현재 운영이 정적 build인 경우:** 확인된 공개 endpoint 설정으로 frontend를 다시 build하고, 현재 static 제공 절차와 SPA fallback을 유지해 결과물을 교체한다. 정적 build에 HMR client가 포함되지 않는지 확인한다. 정적 제공으로의 토폴로지 전환은 이번 문서에서 승인된 작업이 아니며 개발 서버 사용 중이라면 무단 전환하지 않는다.

guest endpoint 전용 CORS 제거를 운영에 반영하기 위해 backend 재빌드·재기동이 필요하다면 그 대상을 별도 승인 범위에 명시한다. frontend와 backend의 경기 protocol은 이미 통합된 공통 core/clockEpoch·복구·event 계약을 유지한다. 서로 호환되는 버전을 확인하고 한쪽을 개편 전 문자열 입력/`update` 서버로 바꾸지 않는다. 이 변경을 이유로 DB schema·기존 볼륨·운영 결과를 변경하지 않는다.

설치가 필요할 때만 기존 lockfile을 존중한다. 프레임워크·의존성 전면 교체나 무관한 전체 포맷은 필요하지 않다. 이번 문서에서 install/build/restart/deploy 명령을 운영에 실행한 적은 없다.

## 적용 뒤 판정에 필요한 확인

| 확인 | 필요한 실제 근거 | 현재 상태 |
|---|---|---|
| 공개 첫 로그인 로딩 | 권한 미결정의 새 Chrome 프로필, 기본 보안, top-level; 전체 Request URL/Initiator·주소 공간·차단 사유·native 권한 UI 관찰 | 수정 전 network는 확보. native UI는 승인 거부로 BLOCKED. 수정 후 NOT_RUN |
| HMR | 개발 서버라면 실제 브라우저가 public `wss://…/ws`를 사용하고 내부 literal 요청이 없어야 한다. 정상 HMR 연결과 기존 게임 transport를 따로 확인한다. | 현재 public path의 passive101만 확인. 수정 배포 후 browser NOT_RUN |
| 로그인 | 별도 승인된 테스트 계정/환경에서 click1→document request1→생성1, guest fetch0, cookie/callback·의도·닉네임·2FA·뒤로가기/재시도 | 격리 guest 최종 단위51/브라우저16 통과. 운영 계정 생성 미승인/NOT_RUN |
| 인증 뒤 주소 | `/user/me`, 이미지, `/game`, `/chat`의 실제 browser 목적지가 public이어야 한다. guest navigation만 고치고 다음 요청이 private이면 완료 아님 | 운영 인증 행동 NOT_RUN |
| 로컬/AI | 새 공개 진입에서 auth/backend/game socket 요청0, 실제 종료/재시작, 소개 펼치기로 요청 추가0 | 실제 결과와 개별 제한은 TEST_REPORT에 기록. 운영에서 새로 실행하지 않음 |
| 온라인 보존 | 같은 protocol의 격리2인 완주·결과 저장·재매칭·초대·관전·재연결·Socket.IO 채팅 | root의 이번 격리 시험과 운영 검증을 분리한다. 여기서 운영 PASS로 바꾸지 않음 |
| 기술 소개·문구 | 로그인 없이 기술 이름 발견, 시작 CTA 우선, 같은 viewport 전후 화면·focus/details·390px/확대 | 구현 완료; 최종 빌드69 UI 단언 통과, 전12/후23 PNG 팀 직접 열람. [COPY_REVIEW](COPY_REVIEW.md)의 적용 전후 참조 |

localhost fixture는 public→private 주소 공간 경계를 재현하지 않는다. permissions.query의 prompt/granted/denied 값이나 JS dialog 이벤트0만으로 LNA 권한창 미표시를 판정하지 않는다. 권한을 사전 허용하거나 보안을 끄고 팝업을 숨기는 검증은 하지 않는다. public Node WebSocket 성공도 Chrome LNA 시험을 대신하지 않는다.

## 인계 상태

**LOCAL_IMPLEMENTED / PARTIAL_NEEDS_DEPLOYMENT_VERIFICATION.** 다음 최소 외부 단계는 현재 운영 frontend 실행 방식·유효 URL 설정·proxy 경로 자료 확인, 그리고 그 결과로 만든 정확한 최소 frontend 재빌드/재기동 작업안의 승인이다. 운영 guest 생성이나 backend 재기동이 필요해지면 그 행동도 명시적으로 범위에 포함한다.

이 인계는 배포 승인·배포 완료·권한 문제 완전 해결을 뜻하지 않는다. 로컬 구현과 실제 시험 기록은 [TEST_REPORT](TEST_REPORT.md)에 있으며 운영 파일·프로세스·계정·DB는 변경하지 않았다.
