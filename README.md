# ft_transcendence · Home & Arcade

기존 팀 Vue/TypeScript·Nest/Socket.IO 프로젝트에 공통 경기 코어와 로컬 2인·규칙 기반 AI·온라인 실행부가 통합되어 있습니다. 이번 후속 작업의 공개 `main` 기준은 `2f11bee69c2d55ed938b53f9750119a890396fb7`입니다. 이전 개편의 `f970554` 기준·테스트·당시 미커밋 상태는 `docs/arcade-upgrade/`의 역사 기록입니다. GitHub에 코드가 통합된 사실은 운영 배포 검증을 뜻하지 않습니다.

현재 작업 트리의 Home/공개 허브·안전한 로그인 복귀·온라인 개선은 후속 미커밋 변경입니다. [구현 기록](docs/home-online-polish/IMPLEMENTATION_REPORT.md), [실제 검증](docs/home-online-polish/TEST_REPORT.md), [검토 패킷](docs/home-online-polish/REVIEW_PACKET.md)을 기준으로 구현과 검증 범위를 확인하세요.

## 로그인·백엔드·DB 없이 플레이

이번 검증 환경은 Node **18.20.8**, Yarn **1.22.22**입니다. 설치된 고정 의존성을 사용했으며 의존성/lockfile을 업데이트하지 않았습니다. 다른 Node 버전의 지원 여부를 이번 결과에서 추론하지 않습니다.

```sh
cd frontend
yarn install --frozen-lockfile --non-interactive
yarn serve
```

브라우저에서 `http://localhost:3000/play`를 엽니다. `/play/local`과 `/play/ai`도 공개 경로입니다. 백엔드 프로세스·로그인·게스트 계정 생성이 필요하지 않습니다. 로컬 결과는 서버 전적에 저장하지 않습니다.

- P1: W/S 이동, D Power. P2: ↑/↓ 이동, ← Power. 경기 화면의 키 설정에서 재지정할 수 있으며 허브는 저장된 키를 표시합니다.
- AI: Easy/Normal/Hard, 사람은 W/S 또는 화살표 구성을 선택합니다.
- 코트를 클릭해 포커스를 준 뒤 조작합니다. 로컬 화면 숨김/포커스 상실 시 일시정지하며 ‘계속하기’ 버튼으로 재개합니다.
- Classic/Power 모두 6점 선승, 경기 종료 뒤 재시작·메뉴 복귀를 지원합니다. Power는 유효 반사로 5칸 충전 후 발동하고 강화 반사마다 1칸 소모합니다.
- 한 키보드 동시 입력은 물리 키보드의 rollover 한계가 있습니다. 모바일 터치 조작은 제공하지 않습니다.

빌드 결과만 실행하는 검증된 방법:

```sh
cd frontend
yarn build
cd ..
node scripts/serve-frontend.cjs
```

정적 프리뷰는 `http://127.0.0.1:4173/play`입니다. 서버를 종료하려면 해당 터미널에서 Ctrl+C를 누릅니다.

## 기존 전체 온라인 서비스

기존 인증·게스트·로비·채팅·프로필·친구·초대·관전 경로를 유지했습니다. 온라인 조작은 기본 ↑/↓와 Space이며 W/S/D도 선택할 수 있습니다. **frontend/backend를 같은 변경 버전으로 함께 실행**해야 합니다. 공통 코어의 서버 권한을 유지하며, 경기 ID와 요청 ID를 가진 복구 계약을 사용합니다. snapshot에는 `instanceId`, `clockEpoch`, `eventCursor`, `events`가 필요하고 종료는 경기 ID를 가진 `matchEnded`를 사용합니다. 이전 서버/클라이언트와 호환되지 않으므로 두 버전을 함께 맞추세요. 이전 `update` 프로토콜로 우회하지 않습니다.

온라인 소리는 기본 음소거이며 저장된 소리 켬 설정도 버튼·경기 시작 등 실제 조작 뒤 활성화합니다. 브라우저 차단 상태를 화면에 표시합니다. 서버가 확정한 타격·득점 이벤트를 보간된 화면 시점에 전달하며, 재참가 시 과거 효과를 재생하지 않습니다. 온라인의 ↑/↓/Space와 W/S/D 선택은 별도로 저장하고 안내도 같은 값을 사용합니다. 모션은 시스템 설정을 따르거나 줄이기를 선택할 수 있습니다.

```sh
cd backend
npm ci
cp .env.sample .env
# 로컬 테스트 DB와 본인의 기존 OAuth/메일 설정을 작성한 뒤
npm run build
npm run start:prod
```

별도 터미널:

```sh
cd frontend
cp .env.sample .env
# 별도 포트 실행: VUE_APP_BACKEND_URL=http://localhost:5000
#                 VUE_APP_WS_URL=http://localhost:5000
yarn install --frozen-lockfile --non-interactive
yarn serve
```

`backend/src/app.module.ts`의 기존 전체 bootstrap은 PostgreSQL 5432의 기존 개발 DB 설정과 `synchronize:true`를 사용합니다. 운영 DB에 연결하는 절차로 사용하지 마세요. 실제 외부 OAuth/메일을 포함한 이 전체 bootstrap과 Docker 실행은 이번 환경에서 검증하지 못했습니다. 검증한 온라인 경로는 아래의 격리된 실제 JWT·HTTP·Socket.IO·PostgreSQL fixture입니다. Docker 관련 기존 변경은 공개 baseline의 일부입니다. 이번 Goal에서 Docker 실행은 검증하지 않았습니다.

## 격리된 실제 온라인 검증과 수동 데모

테스트는 `127.0.0.1:55432`, DB/사용자 `arcade_fixture`만 허용하고 매번 새 스키마를 만들어 종료 시 그 스키마만 삭제합니다. 애플리케이션 `.env`를 읽지 않습니다. 기존 OAuth를 우회하는 production 코드는 추가하지 않았습니다. JWT는 테스트 메모리에서만 만들며 테스트 DB 계정만 사용합니다.

먼저 backend `npm ci`, frontend frozen Yarn 설치가 필요합니다. PostgreSQL의 **로컬 native/bin 경로**를 지정합니다. 이 세션에서 실제 사용한 바이너리는 `/private/tmp/ft-transcendence-pg-runtime/node_modules/@embedded-postgres/darwin-x64/native/bin`의 PostgreSQL 14.23입니다. 이 임시 경로는 다른 컴퓨터에 자동으로 존재하지 않습니다.

```sh
ARCADE_PG_BIN=/path/to/postgresql/bin node scripts/test-postgres.cjs start
node scripts/check-arcade.cjs online
ARCADE_PG_BIN=/path/to/postgresql/bin node scripts/test-postgres.cjs stop
```

수동 온라인 데모도 실제 실행했습니다. 테스트 DB를 시작한 상태에서:

```sh
cd frontend
VUE_APP_BACKEND_URL= VUE_APP_WS_URL= \
VUE_APP_ENABLE_GUEST_LOGIN=true VUE_APP_ARCADE_DEBUG=true yarn build
cd ..
TS_NODE_PROJECT=backend/tsconfig.json node --no-experimental-fetch \
  -r ./backend/node_modules/ts-node/register \
  -r ./backend/node_modules/tsconfig-paths/register \
  scripts/serve-online-fixture.ts
```

위 빌드는 기존 `.env`의 API/Socket URL override를 비워, 출력된 fixture와 같은 origin에 연결합니다. 터미널에 출력되는 `/login` URL을 서로 다른 두 브라우저 프로필에서 열어 실제 게스트 버튼으로 로그인하고 `/game`의 '상대 찾기'를 누릅니다. `transpile-only`는 enum decorator metadata가 달라 이 fixture에서 실패했으므로 위 typed 실행을 사용합니다. Ctrl+C는 해당 서버/스키마만 정리합니다. 테스트 helper는 이 Goal이 만든 임시 클러스터만 종료하며 기존 볼륨이나 운영 데이터를 삭제하지 않습니다. 이번 실행 결과와 실제 사용한 포트·명령은 [검증 기록](docs/home-online-polish/TEST_REPORT.md)에 있습니다. 각 fixture 포트는 실행할 때 정해지므로 터미널에 출력된 주소를 사용하세요.

## 회귀 검사와 근거

```sh
node scripts/check-arcade.cjs unit
# 격리 DB를 시작한 상태에서
node scripts/check-arcade.cjs online
```

브라우저 검사에는 기존 Playwright runtime과 Chrome executable이 필요합니다. `ARCADE_PLAYWRIGHT_MODULE`과 `ARCADE_CHROMIUM_EXECUTABLE`로 경로를 지정할 수 있습니다. 로컬/AI·Home 검사와 최종 온라인 브라우저 시나리오에는 Playwright가 설치된 Python도 필요합니다. 이번 환경에서 실행한 정확한 경로·명령·성공/실패는 [TEST_REPORT](docs/home-online-polish/TEST_REPORT.md)에 있습니다. 이 도구들은 일반 플레이 실행에 필요하지 않습니다.


```sh
# 위 guest/debug frontend 빌드와 격리 PostgreSQL을 준비한 뒤
ARCADE_PYTHON=/path/to/python-with-playwright node scripts/check-arcade.cjs browser
# 별도 터미널에서 정적 preview4173과 수동 fixture를 실행한 뒤
ARCADE_PYTHON=/path/to/python-with-playwright node scripts/check-arcade.cjs local-browser
ARCADE_PYTHON=/path/to/python-with-playwright \
ARCADE_DEMO_URL="$ARCADE_FIXTURE_URL" \
node scripts/check-arcade.cjs home
```

위 `ARCADE_FIXTURE_URL`에는 수동 fixture가 출력한 origin을 먼저 넣습니다(예: `export ARCADE_FIXTURE_URL=http://127.0.0.1:12345`, 실제 포트로 교체).

`unit`에는 Home intent, runner/buffer 보간, 서버 이벤트·표시 시점·오디오·설정 회귀가 포함됩니다. `browser`는 중복 탭 재연결, 실제 닉네임·2FA 선행, 같은/별도 포트 guest 전체 복귀, 실제 경기·관전·효과를 6개 설정으로 검사합니다. guest 회귀는 루트 dist를 덮어쓰지 않고 작업 전용 임시 디렉터리에 두 프런트를 빌드합니다. Python Home 검사는 별도 실행 중인 fixture와 정적 preview가 필요합니다. `ARCADE_PREVIEW_URL`로 정적 preview 주소를 바꿀 수 있습니다.

이번 변경의 Home은 실제 로컬 2인·AI·온라인 로비 진입을 먼저 제공하고, 규칙과 난이도·저장된 키를 함께 표시합니다. 공개 허브에는 사용자 API나 게임 소켓을 붙이지 않았습니다. 온라인 선택은 로그인·닉네임·2FA 확인 후 선택한 로비/초대/관전 화면으로 이어집니다. 게스트 요청 실패 시 로컬·AI 링크가 남으며, 요청 취소는 이미 진행 중인 서버 계정 생성까지 취소한다는 뜻은 아닙니다. 별도 포트의 게스트 credential CORS는 `/auth/guest`에서 설정된 `FRONT_URL` origin에만 허용합니다.

서버가 이미 연결된 다른 탭 때문에 거부하면 해당 탭의 반복 연결을 멈추고 이유를 표시합니다. 기존 탭을 닫은 뒤 `연결 다시 확인`으로 같은 화면에서 재시도할 수 있습니다. 명시 재시도는 5초 제한이며, 연결 뒤 경기 복구는 서버의 실제 상태 조회로 결정됩니다. 일반 네트워크 단절의 기존 자동 재연결과 서버의 활성 탭 보호는 유지합니다.

- [이번 구현과 기여 경계](docs/home-online-polish/IMPLEMENTATION_REPORT.md)
- [이번 기술 사례와 포트폴리오 근거](docs/home-online-polish/PORTFOLIO_CASE_STUDY.md)
- [이번 검증·실패·미실행 범위](docs/home-online-polish/TEST_REPORT.md)
- [Home 독립 에이전트 리뷰](docs/home-online-polish/INDEPENDENT_HOME_REVIEW.md)
- [이번 독립 검토 패킷](docs/home-online-polish/REVIEW_PACKET.md)

아래는 이미 공개 baseline에 통합된 이전 개편의 기록입니다.

- [기준과 기여 경계](docs/arcade-upgrade/BASELINE.md)
- [경기·AI·네트워크 설계](docs/arcade-upgrade/DESIGN.md)
- [실제 검증 기록](docs/arcade-upgrade/TEST_REPORT.md)
- [측정과 원시 자료](docs/arcade-upgrade/MEASUREMENTS.md)
- [한국어 기술 사례](docs/arcade-upgrade/PORTFOLIO_CASE_STUDY.md)
- [AI 협업과 사람이 확인할 항목](docs/arcade-upgrade/AI_COLLABORATION.md)
- [독립 리뷰 패킷](docs/arcade-upgrade/REVIEW_PACKET.md)

실제 사람 두 명의 물리 키보드 플레이, 원격 WAN/TCP 장애, 외부 OAuth/메일, Firefox/WebKit/Safari, Docker는 별도 검증 범위입니다. 자동 키 입력·제어된 시계·fixture 성공을 이들 검증으로 확대하지 않습니다.

---

# ft_transcendence_final

## Portfolio Demo Guest Login

이 프로젝트의 기본 로그인 방식인 42 OAuth는 과제 요구사항으로 그대로 유지합니다.
포트폴리오 공개 데모에서는 42 계정이 없는 외부 방문자도 기능을 체험할 수 있도록 일회용 게스트 계정 생성 로그인을 추가했습니다.

- 게스트 로그인은 `ENABLE_GUEST_LOGIN=true`일 때만 backend의 `/auth/guest` 엔드포인트에서 활성화됩니다.
- frontend에서는 `VUE_APP_ENABLE_GUEST_LOGIN=true`일 때만 로그인 화면에 `게스트로 체험하기` 버튼을 보여줍니다.
- 게스트 계정은 별도 테이블이나 새 컬럼 없이 기존 `User` 테이블에 저장됩니다.
- 게스트 계정의 `name`과 `nickname`은 같은 `guestId`를 사용합니다. 예: `g` + timestamp 기반 7자
- 게스트 계정의 `email`은 `${guestId}@guest.local` 형식으로 저장됩니다.
- 게스트 프로필 이미지는 별도 이미지 파일을 만들지 않고 `DEFAULT_IMG` 경로를 사용합니다.
- `nickname`을 바로 설정하므로 게스트는 `/info` 닉네임 입력 화면을 건너뛰고 데모를 체험할 수 있습니다.

Azure 배포 환경에서 게스트 로그인을 켜려면 실제 env에 아래 값을 추가합니다.

```
# backend
ENABLE_GUEST_LOGIN=true

# frontend
VUE_APP_ENABLE_GUEST_LOGIN=true
```
